import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { PactDiscovery, PactSchema } from '@pact-protocol/core';
import { PACT_MIME_TYPE, PACT_DISCOVERY_PATH } from '@pact-protocol/core';

/**
 * Configuration for creating a PACT route handler.
 */
export interface PactRouteConfig {
  discovery: PactDiscovery;
  schemas: PactSchema[];
  handlers?: Record<
    string,
    (req: NextRequest, params: Record<string, string>) => Promise<object>
  >;
}

/**
 * Match a URL path against a pattern containing {param} placeholders.
 * Returns the extracted params if matched, or null if no match.
 *
 * Example: matchRoute('/products/123', '/products/{id}') => { id: '123' }
 */
export function matchRoute(
  path: string,
  pattern: string,
): Record<string, string> | null {
  const pathParts = path.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);

  if (pathParts.length !== patternParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith('{') && patternPart.endsWith('}')) {
      const paramName = patternPart.slice(1, -1);
      params[paramName] = pathPart;
    } else if (patternPart !== pathPart) {
      return null;
    }
  }

  return params;
}

/**
 * Build a Headers object with CORS headers and any additional headers.
 */
function buildHeaders(
  contentType: string,
  cacheControl?: string,
): Headers {
  const headers = new Headers();
  headers.set('Content-Type', contentType);
  if (cacheControl) {
    headers.set('Cache-Control', cacheControl);
  }
  // CORS headers
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Accept, Content-Type');
  return headers;
}

/**
 * Create a Next.js App Router GET handler that serves PACT discovery,
 * schemas, and data endpoints.
 */
export function createPactRouteHandler(config: PactRouteConfig) {
  const { discovery, schemas, handlers = {} } = config;

  // Build a lookup map for schemas by ID
  const schemaMap = new Map<string, PactSchema>();
  for (const schema of schemas) {
    schemaMap.set(schema.id, schema);
  }

  async function GET(
    req: NextRequest,
    context: { params: Promise<{ path?: string[] }> },
  ): Promise<NextResponse> {
    const { path: pathSegments = [] } = await context.params;

    // Reconstruct the path and decode URI components
    const rawPath =
      pathSegments.length === 0
        ? '/'
        : '/' + pathSegments.map((s) => decodeURIComponent(s)).join('/');

    // --- Discovery endpoint ---
    if (rawPath === '/' || rawPath === PACT_DISCOVERY_PATH) {
      return NextResponse.json(discovery, {
        status: 200,
        headers: buildHeaders('application/json', 'public, max-age=3600'),
      });
    }

    // --- Schema endpoint: /schemas/{schemaId} ---
    const schemaMatch = matchRoute(rawPath, '/schemas/{schemaId}');
    if (schemaMatch) {
      const schemaId = decodeURIComponent(schemaMatch.schemaId);
      const schema = schemaMap.get(schemaId);
      if (!schema) {
        return NextResponse.json(
          { error: 'Schema not found', id: schemaId },
          {
            status: 404,
            headers: buildHeaders('application/json'),
          },
        );
      }
      return NextResponse.json(schema, {
        status: 200,
        headers: buildHeaders('application/json', 'public, max-age=86400'),
      });
    }

    // --- User-defined handlers ---
    for (const [pattern, handler] of Object.entries(handlers)) {
      const params = matchRoute(rawPath, pattern);
      if (params) {
        const data = await handler(req, params);
        return NextResponse.json(data, {
          status: 200,
          headers: buildHeaders(PACT_MIME_TYPE, 'public, max-age=300'),
        });
      }
    }

    // --- No match ---
    return NextResponse.json(
      { error: 'Not found' },
      {
        status: 404,
        headers: buildHeaders('application/json'),
      },
    );
  }

  return { GET };
}
