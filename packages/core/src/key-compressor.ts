import type { PactSchema } from './types.js';

/**
 * Guard against prototype pollution by rejecting dangerous keys.
 */
function isSafeKey(key: string): boolean {
  return key !== '__proto__' && key !== 'constructor' && key !== 'prototype';
}

/**
 * Build a full-key to abbreviated-key map from a schema.
 */
function buildReverseMap(schema: PactSchema): Map<string, string> {
  const map = new Map<string, string>();
  for (const [abbr, def] of Object.entries(schema.keys)) {
    map.set(def.full, abbr);
  }
  return map;
}

/**
 * Build an abbreviated-key to full-key map from a schema.
 */
function buildForwardMap(schema: PactSchema): Map<string, string> {
  const map = new Map<string, string>();
  for (const [abbr, def] of Object.entries(schema.keys)) {
    map.set(abbr, def.full);
  }
  return map;
}

/**
 * Compress a single record using a pre-built reverse map.
 */
function compressWithMap(
  data: Record<string, unknown>,
  reverseMap: Map<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!isSafeKey(key)) continue;
    const abbr = reverseMap.get(key);
    result[abbr ?? key] = value;
  }
  return result;
}

/**
 * Expand a single record using a pre-built forward map.
 */
function expandWithMap(
  data: Record<string, unknown>,
  forwardMap: Map<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!isSafeKey(key)) continue;
    const full = forwardMap.get(key);
    result[full ?? key] = value;
  }
  return result;
}

/**
 * Compress a record by converting full keys to abbreviated keys using the schema.
 */
export function compress(
  data: Record<string, unknown>,
  schema: PactSchema
): Record<string, unknown> {
  const reverseMap = buildReverseMap(schema);
  return compressWithMap(data, reverseMap);
}

/**
 * Expand a record by converting abbreviated keys back to full keys using the schema.
 */
export function expand(
  data: Record<string, unknown>,
  schema: PactSchema
): Record<string, unknown> {
  const forwardMap = buildForwardMap(schema);
  return expandWithMap(data, forwardMap);
}

/**
 * Batch compress an array of records.
 * Builds the reverse map once and reuses it for all items.
 */
export function compressBatch(
  items: Record<string, unknown>[],
  schema: PactSchema
): Record<string, unknown>[] {
  const reverseMap = buildReverseMap(schema);
  return items.map((item) => compressWithMap(item, reverseMap));
}

/**
 * Batch expand an array of records.
 * Builds the forward map once and reuses it for all items.
 */
export function expandBatch(
  items: Record<string, unknown>[],
  schema: PactSchema
): Record<string, unknown>[] {
  const forwardMap = buildForwardMap(schema);
  return items.map((item) => expandWithMap(item, forwardMap));
}
