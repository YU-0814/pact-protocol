export interface PactSchema {
  $schema: string;
  id: string;
  description: string;
  keys: Record<string, PactKeyDef>;
}

export interface PactKeyDef {
  full: string;
  type: 'string' | 'number' | 'boolean' | 'url' | 'object' | 'array' | 'integer';
  required?: boolean;
  layer?: 'media' | 'action';
  default?: unknown;
  range?: [number, number];
}

export interface PactEnvelope<T = Record<string, unknown>> {
  $pact: string;
  $s: string;
  $t: number;
  $ttl?: number;
  items: T[];
  total?: number;
  page?: PactPage;
}

export interface PactTableEnvelope {
  $pact: string;
  $s: string;
  $t: number;
  $ttl?: number;
  $layout: 'table';
  cols: string[];
  rows: unknown[][];
  total?: number;
  page?: PactPage;
}

export interface PactPage {
  offset: number;
  limit: number;
  next?: string;
}

export interface PactPlatformDef {
  base_url?: string;
  bundle_id?: string;
  package?: string;
  universal_link?: string;
  app_link?: string;
  app_store?: string;
  play_store?: string;
  min_version?: string;
  docs?: string;
  protocol?: string;
  mdns?: string;
  local_ip?: string;
  port?: number;
}

export interface PactDiscovery {
  pact: string;
  site: string;
  description?: string;
  schemas: string[];
  endpoints: Record<string, PactEndpointDef>;
  platforms?: Record<string, PactPlatformDef>;
  rate_limit?: { rpm: number; burst?: number };
  auth?: { type: string; register?: string };
  license?: { ai_input: boolean; ai_train: boolean; attribution: boolean };
  conformance?: 'L1' | 'L2' | 'L3' | 'L4';
  mcp_server?: string;
}

export interface PactEndpointDef {
  list?: string;
  item?: string;
  search?: string;
}

export interface PactAction {
  verb: 'GET' | 'POST' | 'PUT' | 'DELETE';
  name: string;
  description?: string;
  url: string;
  body?: Record<string, string>;
  platforms?: Record<string, string>;
  confirmation?: string;
  auth_required?: boolean;
  ap2?: boolean;
}

export interface PactMediaRef {
  id: string;
  images?: string[];
  videos?: string[];
}

export interface PactErrorResponse {
  $pact: string;
  error: string;
  message?: string;
  status?: number;
}
