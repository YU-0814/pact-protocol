import { type PactDiscovery, PACT_DISCOVERY_PATH, PACT_MIME_TYPE } from '@pact-protocol/core';

/**
 * Attempt to discover PACT support on a given domain.
 *
 * Tries fetching /.well-known/pact.json from the domain.
 * Returns the discovery document if found, or null if the
 * domain does not support PACT.
 *
 * @param domain - The domain to probe (e.g., "example.com" or "https://example.com")
 * @returns The PactDiscovery document, or null if not found
 */
export async function discoverPact(domain: string): Promise<PactDiscovery | null> {
  // Normalize the domain to a proper URL
  let baseUrl: string;
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    baseUrl = domain.replace(/\/+$/, '');
  } else {
    baseUrl = `https://${domain}`;
  }

  const url = `${baseUrl}${PACT_DISCOVERY_PATH}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': PACT_MIME_TYPE,
        'User-Agent': 'PactAutoDiscover/1.0',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as PactDiscovery;

    // Basic validation: a valid PACT discovery doc must have a pact version and schemas
    if (!data.pact || !Array.isArray(data.schemas)) {
      return null;
    }

    return data;
  } catch {
    // Network error, timeout, or invalid JSON - domain does not support PACT
    return null;
  }
}
