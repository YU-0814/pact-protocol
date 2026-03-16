import type { PactEnvelope, PactTableEnvelope, PactPage } from './types.js';
import { PACT_VERSION } from './constants.js';

export interface CreateEnvelopeOptions<T> {
  schema: string;
  items: T[];
  total?: number;
  ttl?: number;
  page?: PactPage;
}

export interface CreateTableEnvelopeOptions {
  schema: string;
  cols: string[];
  rows: unknown[][];
  total?: number;
  ttl?: number;
  page?: PactPage;
}

/**
 * Create a standard PACT envelope.
 */
export function createEnvelope<T>(options: CreateEnvelopeOptions<T>): PactEnvelope<T> {
  const envelope: PactEnvelope<T> = {
    $pact: PACT_VERSION,
    $s: options.schema,
    $t: Date.now(),
    items: options.items,
  };

  if (options.ttl !== undefined) {
    envelope.$ttl = options.ttl;
  }

  if (options.total !== undefined) {
    envelope.total = options.total;
  }

  if (options.page !== undefined) {
    envelope.page = options.page;
  }

  return envelope;
}

/**
 * Create a table layout PACT envelope.
 */
export function createTableEnvelope(options: CreateTableEnvelopeOptions): PactTableEnvelope {
  const envelope: PactTableEnvelope = {
    $pact: PACT_VERSION,
    $s: options.schema,
    $t: Date.now(),
    $layout: 'table',
    cols: options.cols,
    rows: options.rows,
  };

  if (options.ttl !== undefined) {
    envelope.$ttl = options.ttl;
  }

  if (options.total !== undefined) {
    envelope.total = options.total;
  }

  if (options.page !== undefined) {
    envelope.page = options.page;
  }

  return envelope;
}

/**
 * Convert a standard envelope to a table layout by extracting specified keys into cols/rows.
 */
export function toTable(
  envelope: PactEnvelope,
  keys: string[]
): PactTableEnvelope {
  const rows: unknown[][] = envelope.items.map((item) =>
    keys.map((key) => (item as Record<string, unknown>)[key] ?? null)
  );

  const table: PactTableEnvelope = {
    $pact: envelope.$pact,
    $s: envelope.$s,
    $t: envelope.$t,
    $layout: 'table',
    cols: keys,
    rows,
  };

  if (envelope.$ttl !== undefined) {
    table.$ttl = envelope.$ttl;
  }

  if (envelope.total !== undefined) {
    table.total = envelope.total;
  }

  if (envelope.page !== undefined) {
    table.page = envelope.page;
  }

  return table;
}

/**
 * Convert a table layout envelope back to a standard envelope.
 */
export function fromTable(table: PactTableEnvelope): PactEnvelope {
  const items: Record<string, unknown>[] = table.rows.map((row) => {
    const item: Record<string, unknown> = {};
    for (let i = 0; i < table.cols.length; i++) {
      item[table.cols[i]] = row[i] ?? null;
    }
    return item;
  });

  const envelope: PactEnvelope = {
    $pact: table.$pact,
    $s: table.$s,
    $t: table.$t,
    items,
  };

  if (table.$ttl !== undefined) {
    envelope.$ttl = table.$ttl;
  }

  if (table.total !== undefined) {
    envelope.total = table.total;
  }

  if (table.page !== undefined) {
    envelope.page = table.page;
  }

  return envelope;
}
