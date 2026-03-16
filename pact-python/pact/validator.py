"""PACT validation utilities.

Ports the TypeScript validator logic to pure Python.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SCHEMA_ID_PATTERN = re.compile(r"^pact:[a-z]+/[a-z]+@\d+$")

VALID_KEY_TYPES = [
    "string", "number", "boolean", "url", "object", "array", "integer",
]

VALID_KEY_LAYERS = ["media", "action"]


def _create_result() -> Dict[str, Any]:
    return {
        "valid": True,
        "errors": [],
        "warnings": [],
        "conformance_level": "none",
    }


def _add_error(result: Dict[str, Any], path: str, message: str, code: str) -> None:
    result["errors"].append({"path": path, "message": message, "code": code})
    result["valid"] = False


def _add_warning(result: Dict[str, Any], path: str, message: str, code: str) -> None:
    result["warnings"].append({"path": path, "message": message, "code": code})


def _is_object(value: Any) -> bool:
    return isinstance(value, dict)


# ---------------------------------------------------------------------------
# validate_discovery
# ---------------------------------------------------------------------------

def validate_discovery(data: Any) -> Dict[str, Any]:
    """Validate a PACT discovery document."""
    result = _create_result()

    if not _is_object(data):
        _add_error(result, "$", "Discovery must be a JSON object", "DISC_NOT_OBJECT")
        return result

    # Required: pact
    if "pact" not in data:
        _add_error(result, "$.pact", 'Missing required field "pact"', "DISC_NO_VERSION")
    elif not isinstance(data["pact"], str):
        _add_error(result, "$.pact", 'Field "pact" must be a string', "DISC_VERSION_TYPE")
    elif not re.match(r"^\d+\.\d+$", data["pact"]):
        _add_warning(result, "$.pact", 'Field "pact" should follow semver format (e.g. "1.0")', "DISC_VERSION_FORMAT")

    # Required: site
    if "site" not in data:
        _add_error(result, "$.site", 'Missing required field "site"', "DISC_NO_SITE")
    elif not isinstance(data["site"], str):
        _add_error(result, "$.site", 'Field "site" must be a string', "DISC_SITE_TYPE")
    elif len(data["site"]) == 0:
        _add_error(result, "$.site", 'Field "site" must not be empty', "DISC_SITE_EMPTY")

    # Required: schemas
    if "schemas" not in data:
        _add_error(result, "$.schemas", 'Missing required field "schemas"', "DISC_NO_SCHEMAS")
    elif not isinstance(data["schemas"], list):
        _add_error(result, "$.schemas", 'Field "schemas" must be an array', "DISC_SCHEMAS_TYPE")
    else:
        if len(data["schemas"]) == 0:
            _add_warning(result, "$.schemas", 'Field "schemas" is empty', "DISC_SCHEMAS_EMPTY")
        for i, s in enumerate(data["schemas"]):
            if not isinstance(s, str):
                _add_error(result, "$.schemas[{}]".format(i), "Schema ID must be a string", "DISC_SCHEMA_ID_TYPE")
            elif not SCHEMA_ID_PATTERN.match(s):
                _add_warning(
                    result,
                    "$.schemas[{}]".format(i),
                    'Schema ID "{}" does not match expected format "pact:domain/type@version"'.format(s),
                    "DISC_SCHEMA_ID_FORMAT",
                )

    # Required: endpoints
    if "endpoints" not in data:
        _add_error(result, "$.endpoints", 'Missing required field "endpoints"', "DISC_NO_ENDPOINTS")
    elif not _is_object(data["endpoints"]):
        _add_error(result, "$.endpoints", 'Field "endpoints" must be an object', "DISC_ENDPOINTS_TYPE")
    else:
        valid_ep_keys = ["list", "item", "search"]
        for key, ep in data["endpoints"].items():
            if not _is_object(ep):
                _add_error(
                    result,
                    '$.endpoints["{}"]'.format(key),
                    "Endpoint definition must be an object",
                    "DISC_ENDPOINT_TYPE",
                )
                continue
            for ep_key in ep:
                if ep_key not in valid_ep_keys:
                    _add_warning(
                        result,
                        '$.endpoints["{}"].{}'.format(key, ep_key),
                        'Unknown endpoint key "{}"'.format(ep_key),
                        "DISC_ENDPOINT_UNKNOWN_KEY",
                    )
            for ep_key in valid_ep_keys:
                if ep_key in ep and not isinstance(ep[ep_key], str):
                    _add_error(
                        result,
                        '$.endpoints["{}"].{}'.format(key, ep_key),
                        'Endpoint "{}" must be a string URL path'.format(ep_key),
                        "DISC_ENDPOINT_VALUE_TYPE",
                    )

    # Optional: description
    if "description" in data and not isinstance(data["description"], str):
        _add_warning(result, "$.description", 'Field "description" should be a string', "DISC_DESC_TYPE")

    # Optional: platforms
    if "platforms" in data:
        if not _is_object(data["platforms"]):
            _add_warning(result, "$.platforms", 'Field "platforms" should be an object', "DISC_PLATFORMS_TYPE")
        else:
            valid_platform_keys = [
                "base_url", "bundle_id", "package", "universal_link", "app_link",
                "app_store", "play_store", "min_version", "docs", "protocol",
                "mdns", "local_ip", "port",
            ]
            string_fields = [
                "base_url", "bundle_id", "package", "universal_link", "app_link",
                "app_store", "play_store", "min_version", "docs", "protocol",
                "mdns", "local_ip",
            ]
            for platform, defn in data["platforms"].items():
                if not _is_object(defn):
                    _add_warning(
                        result,
                        '$.platforms["{}"]'.format(platform),
                        "Platform definition should be an object",
                        "DISC_PLATFORM_DEF_TYPE",
                    )
                    continue
                for k in defn:
                    if k not in valid_platform_keys:
                        _add_warning(
                            result,
                            '$.platforms["{}"].{}'.format(platform, k),
                            'Unknown platform key "{}"'.format(k),
                            "DISC_PLATFORM_UNKNOWN_KEY",
                        )
                for sf in string_fields:
                    if sf in defn and not isinstance(defn[sf], str):
                        _add_warning(
                            result,
                            '$.platforms["{}"].{}'.format(platform, sf),
                            'Field "{}" should be a string'.format(sf),
                            "DISC_PLATFORM_FIELD_TYPE",
                        )
                if "port" in defn and not isinstance(defn["port"], (int, float)):
                    _add_warning(
                        result,
                        '$.platforms["{}"].port'.format(platform),
                        'Field "port" should be a number',
                        "DISC_PLATFORM_PORT_TYPE",
                    )

    # Optional: rate_limit
    if "rate_limit" in data:
        if not _is_object(data["rate_limit"]):
            _add_warning(result, "$.rate_limit", 'Field "rate_limit" should be an object', "DISC_RATE_TYPE")
        else:
            rl = data["rate_limit"]
            if "rpm" not in rl or not isinstance(rl.get("rpm"), (int, float)):
                _add_warning(result, "$.rate_limit.rpm", 'Field "rate_limit.rpm" should be a number', "DISC_RATE_RPM")

    # Optional: auth
    if "auth" in data:
        if not _is_object(data["auth"]):
            _add_warning(result, "$.auth", 'Field "auth" should be an object', "DISC_AUTH_TYPE")
        elif "type" not in data["auth"] or not isinstance(data["auth"].get("type"), str):
            _add_warning(result, "$.auth.type", 'Field "auth.type" should be a string', "DISC_AUTH_MISSING_TYPE")

    # Optional: license
    if "license" in data:
        if not _is_object(data["license"]):
            _add_warning(result, "$.license", 'Field "license" should be an object', "DISC_LICENSE_TYPE")
        else:
            for field in ["ai_input", "ai_train", "attribution"]:
                if field in data["license"] and not isinstance(data["license"][field], bool):
                    _add_warning(
                        result,
                        "$.license.{}".format(field),
                        'Field "license.{}" should be a boolean'.format(field),
                        "DISC_LICENSE_FIELD_TYPE",
                    )

    if result["valid"]:
        result["conformance_level"] = "L1"

    return result


# ---------------------------------------------------------------------------
# validate_schema
# ---------------------------------------------------------------------------

def validate_schema(data: Any) -> Dict[str, Any]:
    """Validate a PACT schema definition."""
    result = _create_result()

    if not _is_object(data):
        _add_error(result, "$", "Schema must be a JSON object", "SCHEMA_NOT_OBJECT")
        return result

    # Required: $schema
    if "$schema" not in data:
        _add_error(result, "$.$schema", 'Missing required field "$schema"', "SCHEMA_NO_SCHEMA")
    elif not isinstance(data["$schema"], str):
        _add_error(result, "$.$schema", 'Field "$schema" must be a string', "SCHEMA_SCHEMA_TYPE")

    # Required: id
    if "id" not in data:
        _add_error(result, "$.id", 'Missing required field "id"', "SCHEMA_NO_ID")
    elif not isinstance(data["id"], str):
        _add_error(result, "$.id", 'Field "id" must be a string', "SCHEMA_ID_TYPE")
    elif not SCHEMA_ID_PATTERN.match(data["id"]):
        _add_error(
            result,
            "$.id",
            'Schema ID "{}" must match format "pact:domain/type@version"'.format(data["id"]),
            "SCHEMA_ID_FORMAT",
        )

    # Required: keys
    if "keys" not in data:
        _add_error(result, "$.keys", 'Missing required field "keys"', "SCHEMA_NO_KEYS")
    elif not _is_object(data["keys"]):
        _add_error(result, "$.keys", 'Field "keys" must be an object', "SCHEMA_KEYS_TYPE")
    else:
        if len(data["keys"]) == 0:
            _add_warning(result, "$.keys", 'Field "keys" is empty', "SCHEMA_KEYS_EMPTY")
        for abbr, defn in data["keys"].items():
            if not _is_object(defn):
                _add_error(
                    result,
                    '$.keys["{}"]'.format(abbr),
                    "Key definition must be an object",
                    "SCHEMA_KEY_NOT_OBJECT",
                )
                continue

            # full
            if "full" not in defn or not isinstance(defn.get("full"), str):
                _add_error(
                    result,
                    '$.keys["{}"].full'.format(abbr),
                    'Key definition must have a "full" string',
                    "SCHEMA_KEY_NO_FULL",
                )

            # type
            if "type" not in defn:
                _add_error(
                    result,
                    '$.keys["{}"].type'.format(abbr),
                    'Key definition must have a "type" field',
                    "SCHEMA_KEY_NO_TYPE",
                )
            elif not isinstance(defn["type"], str):
                _add_error(
                    result,
                    '$.keys["{}"].type'.format(abbr),
                    "Key type must be a string",
                    "SCHEMA_KEY_TYPE_TYPE",
                )
            elif defn["type"] not in VALID_KEY_TYPES:
                _add_error(
                    result,
                    '$.keys["{}"].type'.format(abbr),
                    'Invalid key type "{}". Must be one of: {}'.format(
                        defn["type"], ", ".join(VALID_KEY_TYPES)
                    ),
                    "SCHEMA_KEY_TYPE_INVALID",
                )

            # required
            if "required" in defn and not isinstance(defn["required"], bool):
                _add_warning(
                    result,
                    '$.keys["{}"].required'.format(abbr),
                    'Key "required" should be a boolean',
                    "SCHEMA_KEY_REQUIRED_TYPE",
                )

            # layer
            if "layer" in defn:
                if not isinstance(defn["layer"], str) or defn["layer"] not in VALID_KEY_LAYERS:
                    _add_warning(
                        result,
                        '$.keys["{}"].layer'.format(abbr),
                        'Key "layer" should be one of: {}'.format(", ".join(VALID_KEY_LAYERS)),
                        "SCHEMA_KEY_LAYER_INVALID",
                    )

            # range
            if "range" in defn:
                r = defn["range"]
                if (
                    not isinstance(r, list)
                    or len(r) != 2
                    or not isinstance(r[0], (int, float))
                    or not isinstance(r[1], (int, float))
                ):
                    _add_warning(
                        result,
                        '$.keys["{}"].range'.format(abbr),
                        'Key "range" should be a [min, max] number tuple',
                        "SCHEMA_KEY_RANGE_INVALID",
                    )

    # Optional: description
    if "description" in data and not isinstance(data["description"], str):
        _add_warning(result, "$.description", 'Field "description" should be a string', "SCHEMA_DESC_TYPE")

    if result["valid"]:
        result["conformance_level"] = "L2"

    return result


# ---------------------------------------------------------------------------
# validate_response
# ---------------------------------------------------------------------------

def validate_response(data: Any, schema: Optional[dict] = None) -> Dict[str, Any]:
    """Validate a PACT data response, optionally against a schema."""
    result = _create_result()

    if not _is_object(data):
        _add_error(result, "$", "Response must be a JSON object", "RESP_NOT_OBJECT")
        return result

    # $pact
    if "$pact" not in data:
        _add_error(result, "$.$pact", 'Missing required field "$pact"', "RESP_NO_PACT")
    elif not isinstance(data["$pact"], str):
        _add_error(result, "$.$pact", 'Field "$pact" must be a string', "RESP_PACT_TYPE")

    # $s
    if "$s" not in data:
        _add_error(result, "$.$s", 'Missing required field "$s"', "RESP_NO_SCHEMA")
    elif not isinstance(data["$s"], str):
        _add_error(result, "$.$s", 'Field "$s" must be a string', "RESP_SCHEMA_TYPE")

    # $t
    if "$t" in data and not isinstance(data["$t"], (int, float)):
        _add_warning(result, "$.$t", 'Field "$t" should be a number (timestamp)', "RESP_T_TYPE")

    # $ttl
    if "$ttl" in data and not isinstance(data["$ttl"], (int, float)):
        _add_warning(result, "$.$ttl", 'Field "$ttl" should be a number (seconds)', "RESP_TTL_TYPE")

    # Layout check
    is_table = data.get("$layout") == "table"

    if is_table:
        # cols
        if "cols" not in data:
            _add_error(result, "$.cols", 'Table layout requires "cols" array', "RESP_TABLE_NO_COLS")
        elif not isinstance(data["cols"], list):
            _add_error(result, "$.cols", 'Field "cols" must be an array', "RESP_TABLE_COLS_TYPE")
        else:
            for i, c in enumerate(data["cols"]):
                if not isinstance(c, str):
                    _add_error(result, "$.cols[{}]".format(i), "Column name must be a string", "RESP_TABLE_COL_TYPE")

        # rows
        if "rows" not in data:
            _add_error(result, "$.rows", 'Table layout requires "rows" array', "RESP_TABLE_NO_ROWS")
        elif not isinstance(data["rows"], list):
            _add_error(result, "$.rows", 'Field "rows" must be an array', "RESP_TABLE_ROWS_TYPE")
        else:
            col_count = len(data["cols"]) if isinstance(data.get("cols"), list) else 0
            for i, row in enumerate(data["rows"]):
                if not isinstance(row, list):
                    _add_error(result, "$.rows[{}]".format(i), "Each row must be an array", "RESP_TABLE_ROW_TYPE")
                elif col_count > 0 and len(row) != col_count:
                    _add_warning(
                        result,
                        "$.rows[{}]".format(i),
                        "Row has {} values but {} columns defined".format(len(row), col_count),
                        "RESP_TABLE_ROW_LENGTH",
                    )

        # schema validation for table columns
        if schema and isinstance(data.get("cols"), list):
            schema_keys = set(schema.get("keys", {}).keys())
            reserved_cols = {"id"}
            for i, col in enumerate(data["cols"]):
                if isinstance(col, str) and col not in schema_keys and col not in reserved_cols:
                    _add_warning(
                        result,
                        "$.cols[{}]".format(i),
                        'Column "{}" is not defined in the schema'.format(col),
                        "RESP_TABLE_COL_NOT_IN_SCHEMA",
                    )
    else:
        # Standard layout
        if "items" not in data:
            _add_error(result, "$.items", 'Standard layout requires "items" array', "RESP_NO_ITEMS")
        elif not isinstance(data["items"], list):
            _add_error(result, "$.items", 'Field "items" must be an array', "RESP_ITEMS_TYPE")
        elif schema:
            schema_keys = set(schema.get("keys", {}).keys())
            required_keys = [
                abbr for abbr, defn in schema.get("keys", {}).items()
                if defn.get("required")
            ]
            reserved_keys = {"id"}
            for i, item in enumerate(data["items"]):
                if not _is_object(item):
                    _add_error(
                        result,
                        "$.items[{}]".format(i),
                        "Each item must be an object",
                        "RESP_ITEM_TYPE",
                    )
                    continue
                for key in required_keys:
                    if key not in item:
                        full_name = schema["keys"][key].get("full", key)
                        _add_warning(
                            result,
                            "$.items[{}].{}".format(i, key),
                            'Missing required key "{}" ({})'.format(key, full_name),
                            "RESP_ITEM_MISSING_KEY",
                        )
                for key in item:
                    if key not in schema_keys and key not in reserved_keys:
                        _add_warning(
                            result,
                            "$.items[{}].{}".format(i, key),
                            'Key "{}" is not defined in the schema'.format(key),
                            "RESP_ITEM_UNKNOWN_KEY",
                        )

    # page
    if "page" in data:
        if not _is_object(data["page"]):
            _add_warning(result, "$.page", 'Field "page" should be an object', "RESP_PAGE_TYPE")
        else:
            if "offset" not in data["page"] or not isinstance(data["page"].get("offset"), (int, float)):
                _add_warning(result, "$.page.offset", 'Field "page.offset" should be a number', "RESP_PAGE_OFFSET")
            if "limit" not in data["page"] or not isinstance(data["page"].get("limit"), (int, float)):
                _add_warning(result, "$.page.limit", 'Field "page.limit" should be a number', "RESP_PAGE_LIMIT")

    # total
    if "total" in data and not isinstance(data["total"], (int, float)):
        _add_warning(result, "$.total", 'Field "total" should be a number', "RESP_TOTAL_TYPE")

    if result["valid"]:
        result["conformance_level"] = "L2"

    return result


# ---------------------------------------------------------------------------
# validate_conformance
# ---------------------------------------------------------------------------

def validate_conformance(discovery: Any) -> Dict[str, Any]:
    """Determine the conformance level of a PACT implementation."""
    result = _create_result()

    disc_result = validate_discovery(discovery)
    result["errors"].extend(disc_result["errors"])
    result["warnings"].extend(disc_result["warnings"])

    if not disc_result["valid"]:
        result["valid"] = False
        result["conformance_level"] = "none"
        return result

    # L1: valid discovery
    result["conformance_level"] = "L1"

    has_schemas = isinstance(discovery.get("schemas"), list) and len(discovery["schemas"]) > 0
    has_endpoints = _is_object(discovery.get("endpoints")) and len(discovery["endpoints"]) > 0

    all_endpoints_have_list = False
    if has_endpoints:
        all_endpoints_have_list = all(
            _is_object(ep) and "list" in ep
            for ep in discovery["endpoints"].values()
        )

    # L2: schemas + typed data
    if has_schemas and has_endpoints and all_endpoints_have_list:
        result["conformance_level"] = "L2"
    else:
        if not has_schemas:
            _add_warning(result, "$.schemas", "L2 requires at least one schema", "CONF_L2_NO_SCHEMAS")
        if not all_endpoints_have_list:
            _add_warning(result, "$.endpoints", 'L2 requires all endpoints to have a "list" path', "CONF_L2_NO_LIST")
        return result

    # L3: search + item endpoints
    has_search = False
    has_item = False
    if _is_object(discovery.get("endpoints")):
        for ep in discovery["endpoints"].values():
            if _is_object(ep):
                if "search" in ep:
                    has_search = True
                if "item" in ep:
                    has_item = True

    if has_search and has_item:
        result["conformance_level"] = "L3"
    else:
        if not has_search:
            _add_warning(result, "$.endpoints", "L3 requires search endpoints", "CONF_L3_NO_SEARCH")
        if not has_item:
            _add_warning(result, "$.endpoints", "L3 requires item endpoints", "CONF_L3_NO_ITEM")
        return result

    # L4: auth + license + rate limiting
    has_auth = _is_object(discovery.get("auth")) and "type" in discovery["auth"]
    has_license = _is_object(discovery.get("license"))
    has_rate_limit = _is_object(discovery.get("rate_limit")) and "rpm" in discovery["rate_limit"]

    if has_auth and has_license and has_rate_limit:
        result["conformance_level"] = "L4"
    else:
        if not has_auth:
            _add_warning(result, "$.auth", "L4 requires auth configuration", "CONF_L4_NO_AUTH")
        if not has_license:
            _add_warning(result, "$.license", "L4 requires license information", "CONF_L4_NO_LICENSE")
        if not has_rate_limit:
            _add_warning(result, "$.rate_limit", "L4 requires rate limiting", "CONF_L4_NO_RATE_LIMIT")

    return result
