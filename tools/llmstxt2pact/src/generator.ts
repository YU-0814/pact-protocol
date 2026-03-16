import type { PactDiscovery, PactEndpointDef } from '@pact-protocol/core';
import { createDiscovery } from '@pact-protocol/core';
import type { LlmsTxtParsed } from './parser.js';

/** Keyword to schema mapping for inference. */
const SCHEMA_HINTS: Record<string, string> = {
  product: 'pact:commerce/product@1',
  shop: 'pact:commerce/product@1',
  store: 'pact:commerce/product@1',
  price: 'pact:commerce/product@1',
  article: 'pact:news/article@1',
  blog: 'pact:news/article@1',
  news: 'pact:news/article@1',
  post: 'pact:news/article@1',
  restaurant: 'pact:food/restaurant@1',
  food: 'pact:food/restaurant@1',
  menu: 'pact:food/restaurant@1',
  hotel: 'pact:travel/hotel@1',
  travel: 'pact:travel/hotel@1',
  booking: 'pact:travel/hotel@1',
  property: 'pact:realestate/listing@1',
  listing: 'pact:realestate/listing@1',
  rent: 'pact:realestate/listing@1',
  event: 'pact:events/event@1',
  concert: 'pact:events/event@1',
  conference: 'pact:events/event@1',
  job: 'pact:jobs/posting@1',
  career: 'pact:jobs/posting@1',
  hiring: 'pact:jobs/posting@1',
  course: 'pact:education/course@1',
  learn: 'pact:education/course@1',
  tutorial: 'pact:education/course@1',
  video: 'pact:media/video@1',
  watch: 'pact:media/video@1',
  business: 'pact:local/business@1',
  local: 'pact:local/business@1',
  service: 'pact:local/business@1',
};

/**
 * Infer PACT schema IDs from text content by matching keywords.
 */
export function inferSchemas(text: string): string[] {
  const lower = text.toLowerCase();
  const words = lower.split(/[\s,.:;!?()[\]{}"'`\-_/\\|#@&*+=<>~^]+/);
  const schemaSet = new Set<string>();

  for (const word of words) {
    const trimmed = word.trim();
    if (trimmed && SCHEMA_HINTS[trimmed]) {
      schemaSet.add(SCHEMA_HINTS[trimmed]);
    }
  }

  return [...schemaSet];
}

/**
 * Attempt to extract a domain from a list of URLs.
 */
function extractDomain(urls: string[]): string | undefined {
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      // skip invalid URLs
    }
  }
  return undefined;
}

/**
 * Determine the path portion of a URL relative to its domain.
 */
function urlToPath(urlStr: string): string | null {
  try {
    const parsed = new URL(urlStr);
    return parsed.pathname + parsed.search;
  } catch {
    return null;
  }
}

/**
 * Generate a PACT discovery document from parsed llms.txt content.
 *
 * - Infers schemas from section keywords
 * - Generates endpoint paths from URLs found in content
 * - Extracts domain from URLs if not provided
 * - Defaults to L1 conformance (discovery only)
 */
export function generateDiscovery(parsed: LlmsTxtParsed, domain?: string): PactDiscovery {
  // Infer schemas from all section content
  const allText = parsed.sections.map(s => s.heading + ' ' + s.content).join(' ');
  const schemas = inferSchemas(allText);

  // Fall back to a generic schema if none inferred
  if (schemas.length === 0) {
    schemas.push('pact:general/page@1');
  }

  // Resolve domain
  const resolvedDomain = domain || extractDomain(parsed.urls) || 'example.com';

  // Build endpoints from discovered URLs
  const endpoints: Record<string, PactEndpointDef> = {};

  for (const schema of schemas) {
    // Extract the category name from schema ID, e.g. "pact:news/article@1" -> "article"
    const schemaName = schema.split('/').pop()?.split('@')[0] ?? 'default';
    const endpointDef: PactEndpointDef = {};

    // Look for relevant URLs in sections
    for (const section of parsed.sections) {
      for (const url of section.urls) {
        const path = urlToPath(url);
        if (!path) continue;

        // Heuristic: URLs with "search" or "?q=" are search endpoints
        if (path.includes('search') || path.includes('?q=')) {
          if (!endpointDef.search) {
            endpointDef.search = path;
          }
        }
        // URLs containing the schema name or "api" are likely list endpoints
        else if (path.includes(schemaName) || path.includes('/api/')) {
          if (!endpointDef.list) {
            endpointDef.list = path;
          }
        }
      }
    }

    // Provide defaults if no endpoints were found
    if (!endpointDef.list) {
      endpointDef.list = `/pact/${schemaName}s`;
    }

    endpoints[schema] = endpointDef;
  }

  const discovery = createDiscovery({
    site: resolvedDomain,
    description: parsed.description || undefined,
    schemas,
    endpoints,
  });

  // Default to L1 conformance (discovery only)
  discovery.conformance = 'L1';

  return discovery;
}
