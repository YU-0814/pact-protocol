export type {
  PactSchema,
  PactKeyDef,
  PactEnvelope,
  PactTableEnvelope,
  PactPage,
  PactPlatformDef,
  PactDiscovery,
  PactEndpointDef,
  PactAction,
  PactMediaRef,
  PactErrorResponse,
} from './types.js';

export { SchemaRegistry } from './schema-registry.js';

export {
  compress,
  expand,
  compressBatch,
  expandBatch,
} from './key-compressor.js';

export {
  createEnvelope,
  createTableEnvelope,
  toTable,
  fromTable,
} from './envelope.js';
export type {
  CreateEnvelopeOptions,
  CreateTableEnvelopeOptions,
} from './envelope.js';

export { createDiscovery } from './discovery.js';
export type { CreateDiscoveryOptions } from './discovery.js';

export {
  PACT_VERSION,
  PACT_MIME_TYPE,
  PACT_DISCOVERY_PATH,
  PACT_ACCEPT_HEADER,
} from './constants.js';
