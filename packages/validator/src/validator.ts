import type { PactSchema } from '@pact-protocol/core';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  conformanceLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'none';
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
}

function createResult(): ValidationResult {
  return {
    valid: true,
    errors: [],
    warnings: [],
    conformanceLevel: 'none',
  };
}

function addError(
  result: ValidationResult,
  path: string,
  message: string,
  code: string
): void {
  result.errors.push({ path, message, code });
  result.valid = false;
}

function addWarning(
  result: ValidationResult,
  path: string,
  message: string,
  code: string
): void {
  result.warnings.push({ path, message, code });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const SCHEMA_ID_PATTERN = /^pact:[a-z]+\/[a-z]+@\d+$/;

const VALID_KEY_TYPES = [
  'string',
  'number',
  'boolean',
  'url',
  'object',
  'array',
  'integer',
];

const VALID_KEY_LAYERS = ['media', 'action'];

/**
 * Validate a PACT discovery file.
 */
export function validateDiscovery(data: unknown): ValidationResult {
  const result = createResult();

  if (!isObject(data)) {
    addError(result, '$', 'Discovery must be a JSON object', 'DISC_NOT_OBJECT');
    return result;
  }

  // Required: pact version
  if (!('pact' in data)) {
    addError(result, '$.pact', 'Missing required field "pact"', 'DISC_NO_VERSION');
  } else if (typeof data.pact !== 'string') {
    addError(result, '$.pact', 'Field "pact" must be a string', 'DISC_VERSION_TYPE');
  } else if (!/^\d+\.\d+$/.test(data.pact)) {
    addWarning(result, '$.pact', 'Field "pact" should follow semver format (e.g. "1.0")', 'DISC_VERSION_FORMAT');
  }

  // Required: site
  if (!('site' in data)) {
    addError(result, '$.site', 'Missing required field "site"', 'DISC_NO_SITE');
  } else if (typeof data.site !== 'string') {
    addError(result, '$.site', 'Field "site" must be a string', 'DISC_SITE_TYPE');
  } else if (data.site.length === 0) {
    addError(result, '$.site', 'Field "site" must not be empty', 'DISC_SITE_EMPTY');
  }

  // Required: schemas array
  if (!('schemas' in data)) {
    addError(result, '$.schemas', 'Missing required field "schemas"', 'DISC_NO_SCHEMAS');
  } else if (!Array.isArray(data.schemas)) {
    addError(result, '$.schemas', 'Field "schemas" must be an array', 'DISC_SCHEMAS_TYPE');
  } else {
    if (data.schemas.length === 0) {
      addWarning(result, '$.schemas', 'Field "schemas" is empty', 'DISC_SCHEMAS_EMPTY');
    }
    for (let i = 0; i < data.schemas.length; i++) {
      const s = data.schemas[i];
      if (typeof s !== 'string') {
        addError(result, `$.schemas[${i}]`, 'Schema ID must be a string', 'DISC_SCHEMA_ID_TYPE');
      } else if (!SCHEMA_ID_PATTERN.test(s)) {
        addWarning(
          result,
          `$.schemas[${i}]`,
          `Schema ID "${s}" does not match expected format "pact:domain/type@version"`,
          'DISC_SCHEMA_ID_FORMAT'
        );
      }
    }
  }

  // Required: endpoints object
  if (!('endpoints' in data)) {
    addError(result, '$.endpoints', 'Missing required field "endpoints"', 'DISC_NO_ENDPOINTS');
  } else if (!isObject(data.endpoints)) {
    addError(result, '$.endpoints', 'Field "endpoints" must be an object', 'DISC_ENDPOINTS_TYPE');
  } else {
    for (const [key, ep] of Object.entries(data.endpoints)) {
      if (!isObject(ep)) {
        addError(
          result,
          `$.endpoints["${key}"]`,
          'Endpoint definition must be an object',
          'DISC_ENDPOINT_TYPE'
        );
        continue;
      }
      const validEndpointKeys = ['list', 'item', 'search'];
      for (const epKey of Object.keys(ep)) {
        if (!validEndpointKeys.includes(epKey)) {
          addWarning(
            result,
            `$.endpoints["${key}"].${epKey}`,
            `Unknown endpoint key "${epKey}"`,
            'DISC_ENDPOINT_UNKNOWN_KEY'
          );
        }
      }
      for (const epKey of validEndpointKeys) {
        if (epKey in ep && typeof ep[epKey] !== 'string') {
          addError(
            result,
            `$.endpoints["${key}"].${epKey}`,
            `Endpoint "${epKey}" must be a string URL path`,
            'DISC_ENDPOINT_VALUE_TYPE'
          );
        }
      }
    }
  }

  // Optional: description
  if ('description' in data && typeof data.description !== 'string') {
    addWarning(result, '$.description', 'Field "description" should be a string', 'DISC_DESC_TYPE');
  }

  // Optional: platforms
  if ('platforms' in data) {
    if (!isObject(data.platforms)) {
      addWarning(result, '$.platforms', 'Field "platforms" should be an object', 'DISC_PLATFORMS_TYPE');
    } else {
      const validPlatformKeys = [
        'base_url', 'bundle_id', 'package', 'universal_link', 'app_link',
        'app_store', 'play_store', 'min_version', 'docs', 'protocol',
        'mdns', 'local_ip', 'port',
      ];
      for (const [platform, def] of Object.entries(data.platforms)) {
        if (!isObject(def)) {
          addWarning(
            result,
            `$.platforms["${platform}"]`,
            'Platform definition should be an object',
            'DISC_PLATFORM_DEF_TYPE'
          );
          continue;
        }
        for (const key of Object.keys(def)) {
          if (!validPlatformKeys.includes(key)) {
            addWarning(
              result,
              `$.platforms["${platform}"].${key}`,
              `Unknown platform key "${key}"`,
              'DISC_PLATFORM_UNKNOWN_KEY'
            );
          }
        }
        // Validate string fields
        const stringFields = [
          'base_url', 'bundle_id', 'package', 'universal_link', 'app_link',
          'app_store', 'play_store', 'min_version', 'docs', 'protocol',
          'mdns', 'local_ip',
        ];
        for (const field of stringFields) {
          if (field in def && typeof def[field] !== 'string') {
            addWarning(
              result,
              `$.platforms["${platform}"].${field}`,
              `Field "${field}" should be a string`,
              'DISC_PLATFORM_FIELD_TYPE'
            );
          }
        }
        // Validate port is a number
        if ('port' in def && typeof def.port !== 'number') {
          addWarning(
            result,
            `$.platforms["${platform}"].port`,
            'Field "port" should be a number',
            'DISC_PLATFORM_PORT_TYPE'
          );
        }
      }
    }
  }

  // Optional: rate_limit
  if ('rate_limit' in data) {
    if (!isObject(data.rate_limit)) {
      addWarning(result, '$.rate_limit', 'Field "rate_limit" should be an object', 'DISC_RATE_TYPE');
    } else {
      if (!('rpm' in data.rate_limit) || typeof data.rate_limit.rpm !== 'number') {
        addWarning(result, '$.rate_limit.rpm', 'Field "rate_limit.rpm" should be a number', 'DISC_RATE_RPM');
      }
    }
  }

  // Optional: auth
  if ('auth' in data) {
    if (!isObject(data.auth)) {
      addWarning(result, '$.auth', 'Field "auth" should be an object', 'DISC_AUTH_TYPE');
    } else if (!('type' in data.auth) || typeof data.auth.type !== 'string') {
      addWarning(result, '$.auth.type', 'Field "auth.type" should be a string', 'DISC_AUTH_MISSING_TYPE');
    }
  }

  // Optional: license
  if ('license' in data) {
    if (!isObject(data.license)) {
      addWarning(result, '$.license', 'Field "license" should be an object', 'DISC_LICENSE_TYPE');
    } else {
      for (const field of ['ai_input', 'ai_train', 'attribution']) {
        if (field in data.license && typeof data.license[field] !== 'boolean') {
          addWarning(
            result,
            `$.license.${field}`,
            `Field "license.${field}" should be a boolean`,
            'DISC_LICENSE_FIELD_TYPE'
          );
        }
      }
    }
  }

  if (result.valid) {
    result.conformanceLevel = 'L1';
  }

  return result;
}

/**
 * Validate a PACT schema definition.
 */
export function validateSchema(data: unknown): ValidationResult {
  const result = createResult();

  if (!isObject(data)) {
    addError(result, '$', 'Schema must be a JSON object', 'SCHEMA_NOT_OBJECT');
    return result;
  }

  // Required: $schema
  if (!('$schema' in data)) {
    addError(result, '$.$schema', 'Missing required field "$schema"', 'SCHEMA_NO_SCHEMA');
  } else if (typeof data.$schema !== 'string') {
    addError(result, '$.$schema', 'Field "$schema" must be a string', 'SCHEMA_SCHEMA_TYPE');
  }

  // Required: id in pact:domain/type@version format
  if (!('id' in data)) {
    addError(result, '$.id', 'Missing required field "id"', 'SCHEMA_NO_ID');
  } else if (typeof data.id !== 'string') {
    addError(result, '$.id', 'Field "id" must be a string', 'SCHEMA_ID_TYPE');
  } else if (!SCHEMA_ID_PATTERN.test(data.id)) {
    addError(
      result,
      '$.id',
      `Schema ID "${data.id}" must match format "pact:domain/type@version"`,
      'SCHEMA_ID_FORMAT'
    );
  }

  // Required: keys object with valid key definitions
  if (!('keys' in data)) {
    addError(result, '$.keys', 'Missing required field "keys"', 'SCHEMA_NO_KEYS');
  } else if (!isObject(data.keys)) {
    addError(result, '$.keys', 'Field "keys" must be an object', 'SCHEMA_KEYS_TYPE');
  } else {
    if (Object.keys(data.keys).length === 0) {
      addWarning(result, '$.keys', 'Field "keys" is empty', 'SCHEMA_KEYS_EMPTY');
    }
    for (const [abbr, def] of Object.entries(data.keys)) {
      if (!isObject(def)) {
        addError(
          result,
          `$.keys["${abbr}"]`,
          'Key definition must be an object',
          'SCHEMA_KEY_NOT_OBJECT'
        );
        continue;
      }

      // Required: full name
      if (!('full' in def) || typeof def.full !== 'string') {
        addError(
          result,
          `$.keys["${abbr}"].full`,
          'Key definition must have a "full" string',
          'SCHEMA_KEY_NO_FULL'
        );
      }

      // Required: type
      if (!('type' in def)) {
        addError(
          result,
          `$.keys["${abbr}"].type`,
          'Key definition must have a "type" field',
          'SCHEMA_KEY_NO_TYPE'
        );
      } else if (typeof def.type !== 'string') {
        addError(
          result,
          `$.keys["${abbr}"].type`,
          'Key type must be a string',
          'SCHEMA_KEY_TYPE_TYPE'
        );
      } else if (!VALID_KEY_TYPES.includes(def.type)) {
        addError(
          result,
          `$.keys["${abbr}"].type`,
          `Invalid key type "${def.type}". Must be one of: ${VALID_KEY_TYPES.join(', ')}`,
          'SCHEMA_KEY_TYPE_INVALID'
        );
      }

      // Optional: required (boolean)
      if ('required' in def && typeof def.required !== 'boolean') {
        addWarning(
          result,
          `$.keys["${abbr}"].required`,
          'Key "required" should be a boolean',
          'SCHEMA_KEY_REQUIRED_TYPE'
        );
      }

      // Optional: layer
      if ('layer' in def) {
        if (typeof def.layer !== 'string' || !VALID_KEY_LAYERS.includes(def.layer)) {
          addWarning(
            result,
            `$.keys["${abbr}"].layer`,
            `Key "layer" should be one of: ${VALID_KEY_LAYERS.join(', ')}`,
            'SCHEMA_KEY_LAYER_INVALID'
          );
        }
      }

      // Optional: range
      if ('range' in def) {
        if (
          !Array.isArray(def.range) ||
          def.range.length !== 2 ||
          typeof def.range[0] !== 'number' ||
          typeof def.range[1] !== 'number'
        ) {
          addWarning(
            result,
            `$.keys["${abbr}"].range`,
            'Key "range" should be a [min, max] number tuple',
            'SCHEMA_KEY_RANGE_INVALID'
          );
        }
      }
    }
  }

  // Optional: description
  if ('description' in data && typeof data.description !== 'string') {
    addWarning(result, '$.description', 'Field "description" should be a string', 'SCHEMA_DESC_TYPE');
  }

  if (result.valid) {
    result.conformanceLevel = 'L2';
  }

  return result;
}

/**
 * Validate a PACT data response, optionally against a schema.
 */
export function validateResponse(data: unknown, schema?: PactSchema): ValidationResult {
  const result = createResult();

  if (!isObject(data)) {
    addError(result, '$', 'Response must be a JSON object', 'RESP_NOT_OBJECT');
    return result;
  }

  // Required: $pact
  if (!('$pact' in data)) {
    addError(result, '$.$pact', 'Missing required field "$pact"', 'RESP_NO_PACT');
  } else if (typeof data.$pact !== 'string') {
    addError(result, '$.$pact', 'Field "$pact" must be a string', 'RESP_PACT_TYPE');
  }

  // Required: $s
  if (!('$s' in data)) {
    addError(result, '$.$s', 'Missing required field "$s"', 'RESP_NO_SCHEMA');
  } else if (typeof data.$s !== 'string') {
    addError(result, '$.$s', 'Field "$s" must be a string', 'RESP_SCHEMA_TYPE');
  }

  // Optional: $t (timestamp)
  if ('$t' in data && typeof data.$t !== 'number') {
    addWarning(result, '$.$t', 'Field "$t" should be a number (timestamp)', 'RESP_T_TYPE');
  }

  // Optional: $ttl
  if ('$ttl' in data && typeof data.$ttl !== 'number') {
    addWarning(result, '$.$ttl', 'Field "$ttl" should be a number (seconds)', 'RESP_TTL_TYPE');
  }

  // Determine layout type
  const isTable =
    '$layout' in data && data.$layout === 'table';

  if (isTable) {
    // Table layout: must have cols and rows
    if (!('cols' in data)) {
      addError(result, '$.cols', 'Table layout requires "cols" array', 'RESP_TABLE_NO_COLS');
    } else if (!Array.isArray(data.cols)) {
      addError(result, '$.cols', 'Field "cols" must be an array', 'RESP_TABLE_COLS_TYPE');
    } else {
      for (let i = 0; i < data.cols.length; i++) {
        if (typeof data.cols[i] !== 'string') {
          addError(
            result,
            `$.cols[${i}]`,
            'Column name must be a string',
            'RESP_TABLE_COL_TYPE'
          );
        }
      }
    }

    if (!('rows' in data)) {
      addError(result, '$.rows', 'Table layout requires "rows" array', 'RESP_TABLE_NO_ROWS');
    } else if (!Array.isArray(data.rows)) {
      addError(result, '$.rows', 'Field "rows" must be an array', 'RESP_TABLE_ROWS_TYPE');
    } else {
      const colCount = Array.isArray(data.cols) ? data.cols.length : 0;
      for (let i = 0; i < data.rows.length; i++) {
        if (!Array.isArray(data.rows[i])) {
          addError(
            result,
            `$.rows[${i}]`,
            'Each row must be an array',
            'RESP_TABLE_ROW_TYPE'
          );
        } else if (colCount > 0 && (data.rows[i] as unknown[]).length !== colCount) {
          addWarning(
            result,
            `$.rows[${i}]`,
            `Row has ${(data.rows[i] as unknown[]).length} values but ${colCount} columns defined`,
            'RESP_TABLE_ROW_LENGTH'
          );
        }
      }
    }

    // Validate cols against schema keys if schema provided (id is a reserved PACT identifier)
    if (schema && Array.isArray(data.cols)) {
      const schemaKeys = new Set(Object.keys(schema.keys));
      const reservedCols = new Set(['id']);
      for (let i = 0; i < data.cols.length; i++) {
        const col = data.cols[i];
        if (typeof col === 'string' && !schemaKeys.has(col) && !reservedCols.has(col)) {
          addWarning(
            result,
            `$.cols[${i}]`,
            `Column "${col}" is not defined in the schema`,
            'RESP_TABLE_COL_NOT_IN_SCHEMA'
          );
        }
      }
    }
  } else {
    // Standard layout: must have items
    if (!('items' in data)) {
      addError(result, '$.items', 'Standard layout requires "items" array', 'RESP_NO_ITEMS');
    } else if (!Array.isArray(data.items)) {
      addError(result, '$.items', 'Field "items" must be an array', 'RESP_ITEMS_TYPE');
    } else if (schema) {
      // Validate items against schema keys
      const schemaKeys = new Set(Object.keys(schema.keys));
      const requiredKeys = Object.entries(schema.keys)
        .filter(([, def]) => def.required)
        .map(([abbr]) => abbr);

      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        if (!isObject(item)) {
          addError(
            result,
            `$.items[${i}]`,
            'Each item must be an object',
            'RESP_ITEM_TYPE'
          );
          continue;
        }

        // Check required keys
        for (const key of requiredKeys) {
          if (!(key in item)) {
            addWarning(
              result,
              `$.items[${i}].${key}`,
              `Missing required key "${key}" (${schema.keys[key].full})`,
              'RESP_ITEM_MISSING_KEY'
            );
          }
        }

        // Check for unknown keys (id is a reserved PACT item identifier)
        const reservedKeys = new Set(['id']);
        for (const key of Object.keys(item)) {
          if (!schemaKeys.has(key) && !reservedKeys.has(key)) {
            addWarning(
              result,
              `$.items[${i}].${key}`,
              `Key "${key}" is not defined in the schema`,
              'RESP_ITEM_UNKNOWN_KEY'
            );
          }
        }
      }
    }
  }

  // Optional: page
  if ('page' in data) {
    if (!isObject(data.page)) {
      addWarning(result, '$.page', 'Field "page" should be an object', 'RESP_PAGE_TYPE');
    } else {
      if (!('offset' in data.page) || typeof data.page.offset !== 'number') {
        addWarning(result, '$.page.offset', 'Field "page.offset" should be a number', 'RESP_PAGE_OFFSET');
      }
      if (!('limit' in data.page) || typeof data.page.limit !== 'number') {
        addWarning(result, '$.page.limit', 'Field "page.limit" should be a number', 'RESP_PAGE_LIMIT');
      }
    }
  }

  // Optional: total
  if ('total' in data && typeof data.total !== 'number') {
    addWarning(result, '$.total', 'Field "total" should be a number', 'RESP_TOTAL_TYPE');
  }

  if (result.valid) {
    result.conformanceLevel = 'L2';
  }

  return result;
}

/**
 * Validate conformance level of a PACT implementation.
 * Analyzes a discovery document to determine which conformance level it achieves.
 */
export function validateConformance(
  discovery: unknown,
  options?: { checkEndpoints?: boolean }
): ValidationResult {
  const result = createResult();

  // First validate as a discovery document
  const discResult = validateDiscovery(discovery);
  result.errors.push(...discResult.errors);
  result.warnings.push(...discResult.warnings);
  if (!discResult.valid) {
    result.valid = false;
    result.conformanceLevel = 'none';
    return result;
  }

  const data = discovery as Record<string, unknown>;

  // L1: Has valid discovery
  result.conformanceLevel = 'L1';

  // L2: Has schemas + typed data
  const hasSchemas =
    Array.isArray(data.schemas) && data.schemas.length > 0;

  const hasEndpoints = isObject(data.endpoints) && Object.keys(data.endpoints).length > 0;

  let allEndpointsHaveList = false;
  if (hasEndpoints) {
    const endpoints = data.endpoints as Record<string, unknown>;
    allEndpointsHaveList = Object.values(endpoints).every(
      (ep) => isObject(ep) && 'list' in ep
    );
  }

  if (hasSchemas && hasEndpoints && allEndpointsHaveList) {
    result.conformanceLevel = 'L2';
  } else {
    if (!hasSchemas) {
      addWarning(result, '$.schemas', 'L2 requires at least one schema', 'CONF_L2_NO_SCHEMAS');
    }
    if (!allEndpointsHaveList) {
      addWarning(result, '$.endpoints', 'L2 requires all endpoints to have a "list" path', 'CONF_L2_NO_LIST');
    }
    return result;
  }

  // L3: Has field selection / pagination / table layout support
  let hasSearch = false;
  let hasItem = false;

  if (isObject(data.endpoints)) {
    const endpoints = data.endpoints as Record<string, unknown>;
    for (const ep of Object.values(endpoints)) {
      if (isObject(ep)) {
        if ('search' in ep) hasSearch = true;
        if ('item' in ep) hasItem = true;
      }
    }
  }

  if (hasSearch && hasItem) {
    result.conformanceLevel = 'L3';
  } else {
    if (!hasSearch) {
      addWarning(result, '$.endpoints', 'L3 requires search endpoints', 'CONF_L3_NO_SEARCH');
    }
    if (!hasItem) {
      addWarning(result, '$.endpoints', 'L3 requires item endpoints', 'CONF_L3_NO_ITEM');
    }
    return result;
  }

  // L4: Has auth + license + rate limiting
  const hasAuth = isObject(data.auth) && 'type' in data.auth;
  const hasLicense = isObject(data.license);
  const hasRateLimit = isObject(data.rate_limit) && 'rpm' in data.rate_limit;

  if (hasAuth && hasLicense && hasRateLimit) {
    result.conformanceLevel = 'L4';
  } else {
    if (!hasAuth) {
      addWarning(result, '$.auth', 'L4 requires auth configuration', 'CONF_L4_NO_AUTH');
    }
    if (!hasLicense) {
      addWarning(result, '$.license', 'L4 requires license information', 'CONF_L4_NO_LICENSE');
    }
    if (!hasRateLimit) {
      addWarning(result, '$.rate_limit', 'L4 requires rate limiting', 'CONF_L4_NO_RATE_LIMIT');
    }
  }

  if (options?.checkEndpoints) {
    addWarning(
      result,
      '$.endpoints',
      'Endpoint liveness checking is not yet implemented',
      'CONF_CHECK_ENDPOINTS_UNSUPPORTED'
    );
  }

  return result;
}
