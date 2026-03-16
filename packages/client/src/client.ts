import {
  type PactDiscovery,
  type PactEnvelope,
  type PactSchema,
  type PactAction,
  PACT_MIME_TYPE,
  PACT_DISCOVERY_PATH,
  expand,
} from '@pact-protocol/core';

export interface PactClientOptions {
  /** API key for authenticated endpoints */
  apiKey?: string;
  /** Custom User-Agent header */
  userAgent?: string;
  /** Discovery cache TTL in milliseconds (default: 5 minutes) */
  cacheTtlMs?: number;
}

/**
 * AI agent client SDK for consuming PACT protocol endpoints.
 *
 * Uses native fetch() (Node 18+). Sets Accept: application/pact+json
 * on all requests to signal PACT support.
 */
export class PactClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly userAgent: string;
  private readonly cacheTtlMs: number;
  private cachedDiscovery: PactDiscovery | null = null;
  private cacheTimestamp: number = 0;

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

  constructor(baseUrl: string, options?: PactClientOptions) {
    this.baseUrl = PactClient.validateBaseUrl(baseUrl);
    this.apiKey = options?.apiKey;
    this.userAgent = options?.userAgent ?? 'PactClient/1.0';
    this.cacheTtlMs = options?.cacheTtlMs ?? 5 * 60 * 1000;
  }

  /**
   * Build common headers for all PACT requests.
   */
  buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': PACT_MIME_TYPE,
      'User-Agent': this.userAgent,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * Perform a fetch request and handle errors uniformly.
   */
  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const headers = {
      ...this.buildHeaders(),
      ...(init?.headers as Record<string, string> | undefined),
    };

    const response = await fetch(url, { ...init, headers });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new PactClientError(
        `PACT request failed: ${response.status} ${response.statusText}`,
        response.status,
        body,
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Discover available schemas and endpoints from the server.
   *
   * Fetches /.well-known/pact.json and caches the result
   * for subsequent calls.
   */
  async discover(): Promise<PactDiscovery> {
    const now = Date.now();
    if (this.cachedDiscovery && (now - this.cacheTimestamp) < this.cacheTtlMs) {
      return this.cachedDiscovery;
    }

    const discovery = await this.request<PactDiscovery>(
      `${this.baseUrl}${PACT_DISCOVERY_PATH}`,
    );

    this.cachedDiscovery = discovery;
    this.cacheTimestamp = now;
    return discovery;
  }

  /**
   * Fetch a list of items for a given schema type.
   *
   * Uses the endpoint URL from the discovery document if available,
   * otherwise falls back to a conventional URL pattern.
   */
  async list(
    schemaId: string,
    options?: { offset?: number; limit?: number },
  ): Promise<PactEnvelope> {
    const discovery = await this.discover();
    const endpoint = discovery.endpoints[schemaId];

    let url = endpoint?.list ?? `/pact/${schemaId}`;
    if (!url.startsWith('http')) {
      url = `${this.baseUrl}${url}`;
    }

    const params = new URLSearchParams();
    if (options?.offset !== undefined) {
      params.set('offset', String(options.offset));
    }
    if (options?.limit !== undefined) {
      params.set('limit', String(options.limit));
    }

    const queryString = params.toString();
    if (queryString) {
      url += `${url.includes('?') ? '&' : '?'}${queryString}`;
    }

    return this.request<PactEnvelope>(url);
  }

  /**
   * Fetch a single item by its ID.
   *
   * Optionally request specific data layers (e.g., 'media', 'action').
   */
  async get(
    schemaId: string,
    id: string,
    options?: { layers?: string[] },
  ): Promise<PactEnvelope> {
    const discovery = await this.discover();
    const endpoint = discovery.endpoints[schemaId];

    let url = endpoint?.item ?? `/pact/${schemaId}/{id}`;
    url = url.replace('{id}', encodeURIComponent(id));
    if (!url.startsWith('http')) {
      url = `${this.baseUrl}${url}`;
    }

    const params = new URLSearchParams();
    if (options?.layers && options.layers.length > 0) {
      params.set('layers', options.layers.join(','));
    }

    const queryString = params.toString();
    if (queryString) {
      url += `${url.includes('?') ? '&' : '?'}${queryString}`;
    }

    return this.request<PactEnvelope>(url);
  }

  /**
   * Search items matching a query string.
   */
  async search(
    schemaId: string,
    query: string,
    options?: { offset?: number; limit?: number },
  ): Promise<PactEnvelope> {
    const discovery = await this.discover();
    const endpoint = discovery.endpoints[schemaId];

    let url = endpoint?.search ?? `/pact/${schemaId}/search`;
    if (!url.startsWith('http')) {
      url = `${this.baseUrl}${url}`;
    }

    const params = new URLSearchParams();
    params.set('q', query);
    if (options?.offset !== undefined) {
      params.set('offset', String(options.offset));
    }
    if (options?.limit !== undefined) {
      params.set('limit', String(options.limit));
    }

    url += `${url.includes('?') ? '&' : '?'}${params.toString()}`;

    return this.request<PactEnvelope>(url);
  }

  /**
   * Execute a PACT action (e.g., add to cart, purchase).
   *
   * Sends the request using the method and URL defined in the action,
   * with optional parameters as the request body.
   */
  async executeAction(
    action: PactAction,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const url = action.url.startsWith('http')
      ? action.url
      : `${this.baseUrl}${action.url}`;

    const init: RequestInit = {
      method: action.verb,
    };

    if (params && (action.verb === 'POST' || action.verb === 'PUT')) {
      init.body = JSON.stringify(params);
      init.headers = { 'Content-Type': 'application/json' };
    }

    return this.request<unknown>(url, init);
  }

  /**
   * Expand abbreviated keys in a PACT envelope using a schema definition.
   *
   * Converts short keys (e.g., "n", "p") back to their full names
   * (e.g., "name", "price") for human readability.
   */
  expand(data: PactEnvelope, schema: PactSchema): PactEnvelope {
    const expandedItems = data.items.map((item) =>
      expand(item as Record<string, unknown>, schema),
    );

    return {
      ...data,
      items: expandedItems,
    };
  }
}

/**
 * Error class for PACT client request failures.
 */
export class PactClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(message);
    this.name = 'PactClientError';
  }
}
