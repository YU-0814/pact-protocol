import type { Request, Response, NextFunction, RequestHandler, Router } from 'express';
import express from 'express';
import {
  type PactSchema,
  type PactDiscovery,
  type PactEnvelope,
  PACT_MIME_TYPE,
  PACT_DISCOVERY_PATH,
  PACT_VERSION,
  createEnvelope,
} from '@pact-protocol/core';

export interface PactServerOptions {
  discovery: PactDiscovery;
  schemas: PactSchema[];
}

declare global {
  namespace Express {
    interface Response {
      pact: <T = Record<string, unknown>>(data: {
        schema: string;
        items: T[];
        total?: number;
        ttl?: number;
      }) => void;
      pactError: (data: {
        error: string;
        message?: string;
        status?: number;
      }) => void;
    }
  }
}

/**
 * Content negotiation middleware.
 *
 * Checks the Accept header for application/pact+json and attaches
 * a res.pact() helper method that wraps data in a PACT envelope
 * and sends it with the correct Content-Type.
 */
export function pactContentNegotiation(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.pact = <T = Record<string, unknown>>(data: {
      schema: string;
      items: T[];
      total?: number;
      ttl?: number;
    }): void => {
      const envelope: PactEnvelope<T> = createEnvelope<T>({
        schema: data.schema,
        items: data.items,
        total: data.total,
        ttl: data.ttl,
      });

      res.setHeader('Content-Type', PACT_MIME_TYPE);
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('Vary', 'Accept');
      res.json(envelope);
    };

    res.pactError = (data: {
      error: string;
      message?: string;
      status?: number;
    }): void => {
      const statusCode = data.status ?? 500;
      const errorResponse: Record<string, unknown> = {
        $pact: PACT_VERSION,
        error: data.error,
      };
      if (data.message) {
        errorResponse.message = data.message;
      }

      res.status(statusCode);
      res.setHeader('Content-Type', PACT_MIME_TYPE);
      res.json(errorResponse);
    };

    const accept = req.headers.accept ?? '';
    if (accept.includes(PACT_MIME_TYPE)) {
      res.setHeader('X-PACT', '1');
    }

    next();
  };
}

/**
 * Discovery endpoint middleware.
 *
 * Serves the PACT discovery document at /.well-known/pact.json.
 * Responds only to GET requests and sets appropriate cache headers.
 */
export function pactDiscovery(discovery: PactDiscovery): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET') {
      next();
      return;
    }

    if (req.path !== PACT_DISCOVERY_PATH) {
      next();
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(discovery);
  };
}

/**
 * Full PACT middleware setup.
 *
 * Creates an Express Router that:
 * - Applies content negotiation on all routes
 * - Serves the discovery document at /.well-known/pact.json
 * - Registers schema routes at /pact/schemas/:type
 */
export function createPactMiddleware(options: PactServerOptions): Router {
  const { discovery, schemas } = options;
  const router = express.Router();

  // Build a schema lookup map
  const schemaMap = new Map<string, PactSchema>();
  for (const schema of schemas) {
    schemaMap.set(schema.id, schema);
  }

  // Apply content negotiation to all routes through this router
  router.use(pactContentNegotiation());

  // Discovery endpoint
  router.get(PACT_DISCOVERY_PATH, (_req: Request, res: Response): void => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(discovery);
  });

  // Schema endpoints - serve individual schema definitions
  // Use wildcard because schema IDs contain : and / (e.g. pact:commerce/product@1)
  router.get('/pact/schemas/*', (req: Request, res: Response): void => {
    const schemaId = decodeURIComponent(req.params[0] || req.url.split('/pact/schemas/')[1] || '');
    const schema = schemaMap.get(schemaId);

    if (!schema) {
      res.status(404).json({
        error: 'schema_not_found',
        message: `Schema "${schemaId}" is not registered`,
      });
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(schema);
  });

  return router;
}
