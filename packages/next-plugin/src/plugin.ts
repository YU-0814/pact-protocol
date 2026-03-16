import { PACT_DISCOVERY_PATH } from '@pact-protocol/core';

/**
 * Options for the withPact Next.js config wrapper.
 */
export interface WithPactOptions {
  /** The route path where the PACT handler is mounted. Defaults to '/api/pact'. */
  pactRoute?: string;
}

/**
 * Next.js configuration type (minimal subset used by this plugin).
 */
interface NextConfig {
  rewrites?: () => Promise<
    | Array<{ source: string; destination: string }>
    | {
        beforeFiles?: Array<{ source: string; destination: string }>;
        afterFiles?: Array<{ source: string; destination: string }>;
        fallback?: Array<{ source: string; destination: string }>;
      }
  >;
  [key: string]: unknown;
}

/**
 * Wrap a Next.js config to add PACT rewrites.
 *
 * Adds a rewrite from /.well-known/pact.json to the PACT API route
 * so that the discovery document is served at the well-known path.
 */
export function withPact(
  nextConfig: NextConfig,
  options?: WithPactOptions,
): NextConfig {
  const pactRoute = options?.pactRoute ?? '/api/pact';

  const originalRewrites = nextConfig.rewrites;

  return {
    ...nextConfig,
    rewrites: async () => {
      const pactRewrite = {
        source: PACT_DISCOVERY_PATH,
        destination: pactRoute,
      };

      if (!originalRewrites) {
        return [pactRewrite];
      }

      const existing = await originalRewrites();

      // If the existing rewrites return an array, prepend our rewrite
      if (Array.isArray(existing)) {
        return [pactRewrite, ...existing];
      }

      // If the existing rewrites return an object with phases,
      // add our rewrite to beforeFiles
      return {
        ...existing,
        beforeFiles: [pactRewrite, ...(existing.beforeFiles ?? [])],
      };
    },
  };
}
