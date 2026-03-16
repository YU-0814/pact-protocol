#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type {
  PactDiscovery,
  PactEnvelope,
  PactTableEnvelope,
} from '@pact-protocol/core';
import {
  PACT_DISCOVERY_PATH,
  PACT_ACCEPT_HEADER,
  fromTable,
} from '@pact-protocol/core';

// ---------------------------------------------------------------------------
// PactClient - inline implementation for use within the bridge
// ---------------------------------------------------------------------------

/**
 * Lightweight PACT client for fetching discovery documents and data endpoints.
 * This mirrors the @pact-protocol/client API so the bridge works standalone
 * while also accepting an injected client instance.
 */
class PactClient {
  private baseUrl: string;
  private discovery: PactDiscovery | null = null;
  private cacheTimestamp: number = 0;
  private readonly cacheTtlMs: number;

  /**
   * Validate and normalize a base URL. Rejects non-http(s) protocols to prevent SSRF.
   */
  private static validateBaseUrl(url: string): string {
    const normalized = url.replace(/\/+$/, '');
    let parsed: URL;
    try {
      parsed = new URL(normalized);
    } catch {
      throw new Error(`Invalid PACT base URL: ${url}`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`PACT base URL must use http or https protocol: ${url}`);
    }

    return normalized;
  }

  constructor(baseUrl: string, cacheTtlMs: number = 5 * 60 * 1000) {
    this.baseUrl = PactClient.validateBaseUrl(baseUrl);
    this.cacheTtlMs = cacheTtlMs;
  }

  /** Fetch and cache the PACT discovery document with TTL. */
  async discover(): Promise<PactDiscovery> {
    const now = Date.now();
    if (this.discovery && (now - this.cacheTimestamp) < this.cacheTtlMs) {
      return this.discovery;
    }

    const url = `${this.baseUrl}${PACT_DISCOVERY_PATH}`;
    const res = await fetch(url, {
      headers: { Accept: PACT_ACCEPT_HEADER },
    });

    if (!res.ok) {
      throw new Error(
        `PACT discovery failed: ${res.status} ${res.statusText} (${url})`
      );
    }

    this.discovery = (await res.json()) as PactDiscovery;
    this.cacheTimestamp = now;
    return this.discovery;
  }

  /** List items for a given schema. */
  async list(
    schemaId: string,
    params?: Record<string, string>
  ): Promise<PactEnvelope> {
    const disc = await this.discover();
    const endpoint = disc.endpoints[schemaId];
    if (!endpoint?.list) {
      throw new Error(`No list endpoint for schema "${schemaId}"`);
    }

    return this.fetchPact(endpoint.list, params);
  }

  /** Get a single item by schema and id. */
  async get(schemaId: string, itemId: string): Promise<PactEnvelope> {
    const disc = await this.discover();
    const endpoint = disc.endpoints[schemaId];
    if (!endpoint?.item) {
      throw new Error(`No item endpoint for schema "${schemaId}"`);
    }

    const url = endpoint.item.replace('{id}', encodeURIComponent(itemId));
    return this.fetchPact(url);
  }

  /** Search items for a given schema. */
  async search(
    schemaId: string,
    query: string,
    params?: Record<string, string>
  ): Promise<PactEnvelope> {
    const disc = await this.discover();
    const endpoint = disc.endpoints[schemaId];
    if (!endpoint?.search) {
      throw new Error(`No search endpoint for schema "${schemaId}"`);
    }

    return this.fetchPact(endpoint.search, { q: query, ...params });
  }

  /** Internal: fetch a PACT endpoint and normalise the response. */
  private async fetchPact(
    path: string,
    params?: Record<string, string>
  ): Promise<PactEnvelope> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), {
      headers: { Accept: PACT_ACCEPT_HEADER },
    });

    if (!res.ok) {
      throw new Error(`PACT request failed: ${res.status} ${res.statusText}`);
    }

    const body = await res.json();

    // Normalise table layout to standard envelope for consistent handling
    if (body.$layout === 'table') {
      return fromTable(body as PactTableEnvelope);
    }

    return body as PactEnvelope;
  }
}

// ---------------------------------------------------------------------------
// MCP Server factory
// ---------------------------------------------------------------------------

export function createPactMcpServer(siteUrl: string): McpServer {
  const client = new PactClient(siteUrl);

  const server = new McpServer({
    name: 'pact-bridge',
    version: '1.0.0',
  });

  // -----------------------------------------------------------------------
  // Tool: pact_discover
  // -----------------------------------------------------------------------
  server.tool(
    'pact_discover',
    'Discover PACT endpoints and capabilities on a site',
    {
      url: z
        .string()
        .optional()
        .describe(
          'Site URL to discover. Defaults to the configured PACT site.'
        ),
    },
    async ({ url }) => {
      try {
        if (url) {
          let parsed: URL;
          try {
            parsed = new URL(url);
          } catch {
            return {
              content: [{ type: 'text' as const, text: 'Error: Invalid URL provided' }],
              isError: true,
            };
          }
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return {
              content: [{ type: 'text' as const, text: 'Error: URL must use http or https protocol' }],
              isError: true,
            };
          }
        }
        const targetClient = url ? new PactClient(url) : client;
        const discovery = await targetClient.discover();
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(discovery, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error discovering PACT site: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Tool: pact_search
  // -----------------------------------------------------------------------
  server.tool(
    'pact_search',
    'Search for items on a PACT-enabled site',
    {
      schema: z.string().describe('Schema ID to search (e.g. "product")'),
      query: z.string().describe('Search query string'),
      limit: z
        .string()
        .optional()
        .describe('Maximum number of results to return'),
      offset: z.string().optional().describe('Offset for pagination'),
    },
    async ({ schema, query, limit, offset }) => {
      try {
        const params: Record<string, string> = {};
        if (limit) params.limit = limit;
        if (offset) params.offset = offset;

        const envelope = await client.search(schema, query, params);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(envelope, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error searching: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Tool: pact_get
  // -----------------------------------------------------------------------
  server.tool(
    'pact_get',
    'Get a specific item by schema and ID from a PACT-enabled site',
    {
      schema: z.string().describe('Schema ID (e.g. "product")'),
      id: z.string().describe('Item ID to retrieve'),
    },
    async ({ schema, id }) => {
      try {
        const envelope = await client.get(schema, id);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(envelope, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error getting item: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Tool: pact_list
  // -----------------------------------------------------------------------
  server.tool(
    'pact_list',
    'List items of a schema type from a PACT-enabled site',
    {
      schema: z.string().describe('Schema ID to list (e.g. "product")'),
      limit: z
        .string()
        .optional()
        .describe('Maximum number of results to return'),
      offset: z.string().optional().describe('Offset for pagination'),
    },
    async ({ schema, limit, offset }) => {
      try {
        const params: Record<string, string> = {};
        if (limit) params.limit = limit;
        if (offset) params.offset = offset;

        const envelope = await client.list(schema, params);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(envelope, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error listing items: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Resource: pact://discovery
  // -----------------------------------------------------------------------
  server.resource(
    'pact-discovery',
    'pact://discovery',
    {
      description: "The site's PACT discovery document",
      mimeType: 'application/json',
    },
    async () => {
      const discovery = await client.discover();
      return {
        contents: [
          {
            uri: 'pact://discovery',
            mimeType: 'application/json',
            text: JSON.stringify(discovery, null, 2),
          },
        ],
      };
    }
  );

  // -----------------------------------------------------------------------
  // Resource template: pact://{schemaId}/list
  // -----------------------------------------------------------------------
  server.resource(
    'pact-list',
    'pact://{schemaId}/list',
    {
      description: 'List items for a PACT schema',
      mimeType: 'application/json',
    },
    async (uri) => {
      // Extract schemaId from URI: pact://<schemaId>/list
      const match = uri.href.match(/^pact:\/\/([^/]+)\/list$/);
      if (!match) {
        throw new Error(`Invalid list resource URI: ${uri.href}`);
      }

      const schemaId = decodeURIComponent(match[1]);
      const envelope = await client.list(schemaId);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(envelope, null, 2),
          },
        ],
      };
    }
  );

  // -----------------------------------------------------------------------
  // Resource template: pact://{schemaId}/{id}
  // -----------------------------------------------------------------------
  server.resource(
    'pact-item',
    'pact://{schemaId}/{id}',
    {
      description: 'Get a specific item from a PACT schema',
      mimeType: 'application/json',
    },
    async (uri) => {
      // Extract schemaId and id from URI: pact://<schemaId>/<id>
      const match = uri.href.match(/^pact:\/\/([^/]+)\/([^/]+)$/);
      if (!match) {
        throw new Error(`Invalid item resource URI: ${uri.href}`);
      }

      const schemaId = decodeURIComponent(match[1]);
      const itemId = decodeURIComponent(match[2]);
      const envelope = await client.get(schemaId, itemId);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(envelope, null, 2),
          },
        ],
      };
    }
  );

  return server;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const pactSiteUrl = process.argv[2] || process.env.PACT_SITE_URL;

  if (!pactSiteUrl) {
    console.error(
      'Usage: pact-mcp <site-url>\n' +
        '  Or set PACT_SITE_URL environment variable.\n\n' +
        'Example:\n' +
        '  pact-mcp https://example.com\n' +
        '  PACT_SITE_URL=https://example.com pact-mcp'
    );
    process.exit(1);
  }

  const server = createPactMcpServer(pactSiteUrl);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run only when executed directly (not imported)
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('/server.js') ||
    process.argv[1].endsWith('/server.ts'));

if (isDirectRun) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
