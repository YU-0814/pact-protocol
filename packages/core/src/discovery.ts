import type { PactDiscovery, PactEndpointDef, PactPlatformDef } from './types.js';
import { PACT_VERSION } from './constants.js';

export interface CreateDiscoveryOptions {
  site: string;
  description?: string;
  schemas: string[];
  endpoints: Record<string, PactEndpointDef>;
  platforms?: Record<string, PactPlatformDef>;
  rateLimit?: { rpm: number; burst?: number };
  auth?: { type: string; register?: string };
  license?: { ai_input: boolean; ai_train: boolean; attribution: boolean };
}

/**
 * Create a PACT discovery document for /.well-known/pact.json.
 */
export function createDiscovery(options: CreateDiscoveryOptions): PactDiscovery {
  const discovery: PactDiscovery = {
    pact: PACT_VERSION,
    site: options.site,
    schemas: options.schemas,
    endpoints: options.endpoints,
  };

  if (options.description !== undefined) {
    discovery.description = options.description;
  }

  if (options.platforms !== undefined) {
    discovery.platforms = options.platforms;
  }

  if (options.rateLimit !== undefined) {
    discovery.rate_limit = options.rateLimit;
  }

  if (options.auth !== undefined) {
    discovery.auth = options.auth;
  }

  if (options.license !== undefined) {
    discovery.license = options.license;
  }

  return discovery;
}
