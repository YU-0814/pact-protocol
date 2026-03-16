"""Comprehensive tests for the PACT Python SDK.

Run with:
    cd ~/project/pact-protocol/pact-python && python3 -m unittest tests/test_core.py -v
"""

import unittest

from pact.constants import PACT_VERSION, PACT_MIME_TYPE, PACT_DISCOVERY_PATH, PACT_ACCEPT_HEADER
from pact.schema_registry import SchemaRegistry
from pact.key_compressor import compress, expand, compress_batch, expand_batch
from pact.envelope import create_envelope, create_table_envelope, to_table, from_table
from pact.discovery import create_discovery
from pact.validator import (
    validate_discovery,
    validate_schema,
    validate_response,
    validate_conformance,
)


# ---------------------------------------------------------------------------
# Shared test fixtures
# ---------------------------------------------------------------------------

SAMPLE_SCHEMA = {
    "$schema": "https://pact-protocol.org/schema/v1",
    "id": "pact:shopping/product@1",
    "description": "Product listing schema",
    "keys": {
        "n": {"full": "name", "type": "string", "required": True},
        "p": {"full": "price", "type": "number", "required": True},
        "u": {"full": "url", "type": "url"},
        "img": {"full": "image", "type": "url", "layer": "media"},
        "r": {"full": "rating", "type": "number", "range": [0, 5]},
    },
}

SAMPLE_ITEMS_FULL = [
    {"name": "Widget A", "price": 9.99, "url": "https://example.com/a", "rating": 4.5},
    {"name": "Widget B", "price": 19.99, "url": "https://example.com/b", "rating": 3.0},
]

SAMPLE_ITEMS_COMPRESSED = [
    {"n": "Widget A", "p": 9.99, "u": "https://example.com/a", "r": 4.5},
    {"n": "Widget B", "p": 19.99, "u": "https://example.com/b", "r": 3.0},
]


# ===================================================================
# Constants
# ===================================================================

class TestConstants(unittest.TestCase):
    def test_pact_version(self):
        self.assertEqual(PACT_VERSION, "1.0")

    def test_pact_mime_type(self):
        self.assertEqual(PACT_MIME_TYPE, "application/pact+json")

    def test_pact_discovery_path(self):
        self.assertEqual(PACT_DISCOVERY_PATH, "/.well-known/pact.json")

    def test_pact_accept_header(self):
        self.assertEqual(PACT_ACCEPT_HEADER, "application/pact+json")


# ===================================================================
# Key Compression
# ===================================================================

class TestKeyCompression(unittest.TestCase):
    def test_compress_single(self):
        full = {"name": "Widget", "price": 9.99, "url": "https://x.com"}
        result = compress(full, SAMPLE_SCHEMA)
        self.assertEqual(result, {"n": "Widget", "p": 9.99, "u": "https://x.com"})

    def test_expand_single(self):
        abbreviated = {"n": "Widget", "p": 9.99, "u": "https://x.com"}
        result = expand(abbreviated, SAMPLE_SCHEMA)
        self.assertEqual(result, {"name": "Widget", "price": 9.99, "url": "https://x.com"})

    def test_roundtrip(self):
        """compress then expand should return the original data."""
        original = {"name": "Test", "price": 5.0, "rating": 4.0}
        compressed = compress(original, SAMPLE_SCHEMA)
        restored = expand(compressed, SAMPLE_SCHEMA)
        self.assertEqual(restored, original)

    def test_roundtrip_reverse(self):
        """expand then compress should return the original abbreviated data."""
        original = {"n": "Test", "p": 5.0, "r": 4.0}
        expanded = expand(original, SAMPLE_SCHEMA)
        restored = compress(expanded, SAMPLE_SCHEMA)
        self.assertEqual(restored, original)

    def test_unknown_key_passthrough(self):
        """Keys not in the schema should pass through unchanged."""
        data = {"name": "X", "unknown_field": 42}
        result = compress(data, SAMPLE_SCHEMA)
        self.assertIn("unknown_field", result)
        self.assertEqual(result["unknown_field"], 42)

    def test_compress_batch(self):
        result = compress_batch(SAMPLE_ITEMS_FULL, SAMPLE_SCHEMA)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["n"], "Widget A")
        self.assertEqual(result[1]["p"], 19.99)

    def test_expand_batch(self):
        result = expand_batch(SAMPLE_ITEMS_COMPRESSED, SAMPLE_SCHEMA)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["name"], "Widget A")
        self.assertEqual(result[1]["price"], 19.99)

    def test_batch_roundtrip(self):
        compressed = compress_batch(SAMPLE_ITEMS_FULL, SAMPLE_SCHEMA)
        restored = expand_batch(compressed, SAMPLE_SCHEMA)
        self.assertEqual(restored, SAMPLE_ITEMS_FULL)

    def test_empty_data(self):
        self.assertEqual(compress({}, SAMPLE_SCHEMA), {})
        self.assertEqual(expand({}, SAMPLE_SCHEMA), {})

    def test_empty_batch(self):
        self.assertEqual(compress_batch([], SAMPLE_SCHEMA), [])
        self.assertEqual(expand_batch([], SAMPLE_SCHEMA), [])


# ===================================================================
# Envelope
# ===================================================================

class TestEnvelope(unittest.TestCase):
    def test_create_envelope_basic(self):
        env = create_envelope(
            schema="pact:shopping/product@1",
            items=[{"n": "A", "p": 1}],
        )
        self.assertEqual(env["$pact"], PACT_VERSION)
        self.assertEqual(env["$s"], "pact:shopping/product@1")
        self.assertIsInstance(env["$t"], int)
        self.assertEqual(env["items"], [{"n": "A", "p": 1}])
        self.assertNotIn("$ttl", env)
        self.assertNotIn("total", env)
        self.assertNotIn("page", env)

    def test_create_envelope_with_options(self):
        page = {"offset": 0, "limit": 10, "next": "/page2"}
        env = create_envelope(
            schema="pact:shopping/product@1",
            items=[],
            total=100,
            ttl=300,
            page=page,
        )
        self.assertEqual(env["$ttl"], 300)
        self.assertEqual(env["total"], 100)
        self.assertEqual(env["page"], page)

    def test_create_table_envelope(self):
        env = create_table_envelope(
            schema="pact:shopping/product@1",
            cols=["n", "p"],
            rows=[["A", 1], ["B", 2]],
        )
        self.assertEqual(env["$layout"], "table")
        self.assertEqual(env["cols"], ["n", "p"])
        self.assertEqual(len(env["rows"]), 2)

    def test_create_table_envelope_with_options(self):
        env = create_table_envelope(
            schema="pact:shopping/product@1",
            cols=["n"],
            rows=[["X"]],
            total=50,
            ttl=60,
            page={"offset": 10, "limit": 5},
        )
        self.assertEqual(env["$ttl"], 60)
        self.assertEqual(env["total"], 50)
        self.assertEqual(env["page"]["offset"], 10)


# ===================================================================
# Table Layout Roundtrip
# ===================================================================

class TestTableLayout(unittest.TestCase):
    def test_to_table(self):
        env = create_envelope(
            schema="pact:shopping/product@1",
            items=[
                {"n": "A", "p": 10},
                {"n": "B", "p": 20},
            ],
            total=2,
        )
        table = to_table(env, ["n", "p"])
        self.assertEqual(table["$layout"], "table")
        self.assertEqual(table["cols"], ["n", "p"])
        self.assertEqual(table["rows"], [["A", 10], ["B", 20]])
        self.assertEqual(table["total"], 2)
        self.assertEqual(table["$pact"], env["$pact"])
        self.assertEqual(table["$s"], env["$s"])
        self.assertEqual(table["$t"], env["$t"])

    def test_from_table(self):
        table = create_table_envelope(
            schema="pact:shopping/product@1",
            cols=["n", "p"],
            rows=[["X", 5], ["Y", 15]],
        )
        env = from_table(table)
        self.assertNotIn("$layout", env)
        self.assertEqual(len(env["items"]), 2)
        self.assertEqual(env["items"][0], {"n": "X", "p": 5})
        self.assertEqual(env["items"][1], {"n": "Y", "p": 15})

    def test_roundtrip_standard_to_table_back(self):
        original_items = [
            {"n": "A", "p": 10, "r": 4.5},
            {"n": "B", "p": 20, "r": 3.0},
        ]
        env = create_envelope(
            schema="pact:shopping/product@1",
            items=original_items,
        )
        keys = ["n", "p", "r"]
        table = to_table(env, keys)
        restored = from_table(table)
        self.assertEqual(restored["items"], original_items)

    def test_to_table_missing_key_yields_none(self):
        env = create_envelope(
            schema="s",
            items=[{"a": 1}],
        )
        table = to_table(env, ["a", "b"])
        self.assertEqual(table["rows"], [[1, None]])

    def test_to_table_preserves_ttl(self):
        env = create_envelope(schema="s", items=[], ttl=600)
        table = to_table(env, [])
        self.assertEqual(table["$ttl"], 600)

    def test_from_table_preserves_ttl_and_page(self):
        table = create_table_envelope(
            schema="s",
            cols=["x"],
            rows=[[1]],
            ttl=120,
            page={"offset": 0, "limit": 10},
        )
        env = from_table(table)
        self.assertEqual(env["$ttl"], 120)
        self.assertEqual(env["page"]["offset"], 0)


# ===================================================================
# Discovery
# ===================================================================

class TestDiscovery(unittest.TestCase):
    def test_create_discovery_minimal(self):
        disc = create_discovery(
            site="Example Store",
            schemas=["pact:shopping/product@1"],
            endpoints={
                "pact:shopping/product@1": {
                    "list": "/api/products",
                }
            },
        )
        self.assertEqual(disc["pact"], PACT_VERSION)
        self.assertEqual(disc["site"], "Example Store")
        self.assertEqual(disc["schemas"], ["pact:shopping/product@1"])
        self.assertNotIn("description", disc)
        self.assertNotIn("platforms", disc)
        self.assertNotIn("rate_limit", disc)

    def test_create_discovery_with_platforms(self):
        disc = create_discovery(
            site="My Shop",
            schemas=["pact:shopping/product@1"],
            endpoints={
                "pact:shopping/product@1": {"list": "/api/p"}
            },
            description="Test store",
            platforms={
                "ios": {
                    "bundle_id": "com.example.app",
                    "app_store": "https://apps.apple.com/...",
                    "universal_link": "https://example.com/app",
                },
                "android": {
                    "package": "com.example.app",
                    "play_store": "https://play.google.com/...",
                },
                "local": {
                    "protocol": "bonjour",
                    "mdns": "_pact._tcp",
                    "port": 8080,
                },
            },
            rate_limit={"rpm": 60, "burst": 10},
            auth={"type": "bearer", "register": "https://example.com/register"},
            license={"ai_input": True, "ai_train": False, "attribution": True},
        )
        self.assertEqual(disc["description"], "Test store")
        self.assertIn("ios", disc["platforms"])
        self.assertEqual(disc["platforms"]["ios"]["bundle_id"], "com.example.app")
        self.assertEqual(disc["platforms"]["local"]["port"], 8080)
        self.assertEqual(disc["rate_limit"]["rpm"], 60)
        self.assertEqual(disc["auth"]["type"], "bearer")
        self.assertTrue(disc["license"]["ai_input"])
        self.assertFalse(disc["license"]["ai_train"])

    def test_create_discovery_optional_fields_omitted(self):
        disc = create_discovery(
            site="S",
            schemas=[],
            endpoints={},
        )
        for key in ("description", "platforms", "rate_limit", "auth", "license"):
            self.assertNotIn(key, disc)


# ===================================================================
# Schema Registry
# ===================================================================

class TestSchemaRegistry(unittest.TestCase):
    def setUp(self):
        self.registry = SchemaRegistry()

    def test_register_and_get(self):
        self.registry.register(SAMPLE_SCHEMA)
        result = self.registry.get("pact:shopping/product@1")
        self.assertIsNotNone(result)
        self.assertEqual(result["id"], "pact:shopping/product@1")

    def test_get_nonexistent(self):
        self.assertIsNone(self.registry.get("pact:nonexistent/schema@1"))

    def test_list_schemas(self):
        self.registry.register(SAMPLE_SCHEMA)
        schema2 = {
            "$schema": "https://pact-protocol.org/schema/v1",
            "id": "pact:food/menu@1",
            "description": "Menu schema",
            "keys": {"n": {"full": "name", "type": "string"}},
        }
        self.registry.register(schema2)
        ids = self.registry.list()
        self.assertEqual(len(ids), 2)
        self.assertIn("pact:shopping/product@1", ids)
        self.assertIn("pact:food/menu@1", ids)

    def test_get_key_map(self):
        self.registry.register(SAMPLE_SCHEMA)
        km = self.registry.get_key_map("pact:shopping/product@1")
        self.assertEqual(km["n"], "name")
        self.assertEqual(km["p"], "price")
        self.assertEqual(km["u"], "url")

    def test_get_reverse_key_map(self):
        self.registry.register(SAMPLE_SCHEMA)
        rkm = self.registry.get_reverse_key_map("pact:shopping/product@1")
        self.assertEqual(rkm["name"], "n")
        self.assertEqual(rkm["price"], "p")

    def test_key_map_nonexistent_schema(self):
        self.assertEqual(self.registry.get_key_map("nonexistent"), {})
        self.assertEqual(self.registry.get_reverse_key_map("nonexistent"), {})

    def test_overwrite_schema(self):
        self.registry.register(SAMPLE_SCHEMA)
        updated = dict(SAMPLE_SCHEMA)
        updated["description"] = "Updated"
        self.registry.register(updated)
        result = self.registry.get("pact:shopping/product@1")
        self.assertEqual(result["description"], "Updated")
        self.assertEqual(len(self.registry.list()), 1)


# ===================================================================
# Validator: Discovery
# ===================================================================

class TestValidateDiscovery(unittest.TestCase):
    def _valid_discovery(self):
        return {
            "pact": "1.0",
            "site": "Example",
            "schemas": ["pact:shopping/product@1"],
            "endpoints": {
                "pact:shopping/product@1": {"list": "/api/products"}
            },
        }

    def test_valid_discovery(self):
        result = validate_discovery(self._valid_discovery())
        self.assertTrue(result["valid"])
        self.assertEqual(len(result["errors"]), 0)
        self.assertEqual(result["conformance_level"], "L1")

    def test_not_object(self):
        result = validate_discovery("not an object")
        self.assertFalse(result["valid"])
        self.assertEqual(result["errors"][0]["code"], "DISC_NOT_OBJECT")

    def test_missing_pact(self):
        d = self._valid_discovery()
        del d["pact"]
        result = validate_discovery(d)
        self.assertFalse(result["valid"])
        self.assertTrue(any(e["code"] == "DISC_NO_VERSION" for e in result["errors"]))

    def test_missing_site(self):
        d = self._valid_discovery()
        del d["site"]
        result = validate_discovery(d)
        self.assertFalse(result["valid"])
        self.assertTrue(any(e["code"] == "DISC_NO_SITE" for e in result["errors"]))

    def test_empty_site(self):
        d = self._valid_discovery()
        d["site"] = ""
        result = validate_discovery(d)
        self.assertFalse(result["valid"])
        self.assertTrue(any(e["code"] == "DISC_SITE_EMPTY" for e in result["errors"]))

    def test_missing_schemas(self):
        d = self._valid_discovery()
        del d["schemas"]
        result = validate_discovery(d)
        self.assertFalse(result["valid"])

    def test_missing_endpoints(self):
        d = self._valid_discovery()
        del d["endpoints"]
        result = validate_discovery(d)
        self.assertFalse(result["valid"])

    def test_invalid_schema_id_format(self):
        d = self._valid_discovery()
        d["schemas"] = ["bad-format"]
        result = validate_discovery(d)
        self.assertTrue(result["valid"])  # warning, not error
        self.assertTrue(any(w["code"] == "DISC_SCHEMA_ID_FORMAT" for w in result["warnings"]))

    def test_valid_with_platforms(self):
        d = self._valid_discovery()
        d["platforms"] = {
            "ios": {"bundle_id": "com.example", "app_store": "https://apps.apple.com/x"},
        }
        result = validate_discovery(d)
        self.assertTrue(result["valid"])

    def test_rate_limit_validation(self):
        d = self._valid_discovery()
        d["rate_limit"] = {"rpm": 60}
        result = validate_discovery(d)
        self.assertTrue(result["valid"])

    def test_rate_limit_missing_rpm(self):
        d = self._valid_discovery()
        d["rate_limit"] = {}
        result = validate_discovery(d)
        self.assertTrue(any(w["code"] == "DISC_RATE_RPM" for w in result["warnings"]))

    def test_auth_validation(self):
        d = self._valid_discovery()
        d["auth"] = {"type": "bearer"}
        result = validate_discovery(d)
        self.assertTrue(result["valid"])

    def test_license_validation(self):
        d = self._valid_discovery()
        d["license"] = {"ai_input": True, "ai_train": False, "attribution": True}
        result = validate_discovery(d)
        self.assertTrue(result["valid"])


# ===================================================================
# Validator: Schema
# ===================================================================

class TestValidateSchema(unittest.TestCase):
    def test_valid_schema(self):
        result = validate_schema(SAMPLE_SCHEMA)
        self.assertTrue(result["valid"])
        self.assertEqual(result["conformance_level"], "L2")

    def test_not_object(self):
        result = validate_schema([])
        self.assertFalse(result["valid"])
        self.assertEqual(result["errors"][0]["code"], "SCHEMA_NOT_OBJECT")

    def test_missing_dollar_schema(self):
        s = dict(SAMPLE_SCHEMA)
        del s["$schema"]
        result = validate_schema(s)
        self.assertFalse(result["valid"])
        self.assertTrue(any(e["code"] == "SCHEMA_NO_SCHEMA" for e in result["errors"]))

    def test_missing_id(self):
        s = dict(SAMPLE_SCHEMA)
        del s["id"]
        result = validate_schema(s)
        self.assertFalse(result["valid"])

    def test_bad_id_format(self):
        s = dict(SAMPLE_SCHEMA)
        s["id"] = "bad-id"
        result = validate_schema(s)
        self.assertFalse(result["valid"])
        self.assertTrue(any(e["code"] == "SCHEMA_ID_FORMAT" for e in result["errors"]))

    def test_missing_keys(self):
        s = dict(SAMPLE_SCHEMA)
        del s["keys"]
        result = validate_schema(s)
        self.assertFalse(result["valid"])

    def test_empty_keys_warning(self):
        s = dict(SAMPLE_SCHEMA)
        s["keys"] = {}
        result = validate_schema(s)
        self.assertTrue(result["valid"])
        self.assertTrue(any(w["code"] == "SCHEMA_KEYS_EMPTY" for w in result["warnings"]))

    def test_invalid_key_type(self):
        s = dict(SAMPLE_SCHEMA)
        s["keys"] = {"x": {"full": "x_field", "type": "banana"}}
        result = validate_schema(s)
        self.assertFalse(result["valid"])
        self.assertTrue(any(e["code"] == "SCHEMA_KEY_TYPE_INVALID" for e in result["errors"]))

    def test_key_missing_full(self):
        s = dict(SAMPLE_SCHEMA)
        s["keys"] = {"x": {"type": "string"}}
        result = validate_schema(s)
        self.assertFalse(result["valid"])
        self.assertTrue(any(e["code"] == "SCHEMA_KEY_NO_FULL" for e in result["errors"]))

    def test_invalid_layer_warning(self):
        s = dict(SAMPLE_SCHEMA)
        s["keys"] = {"x": {"full": "xf", "type": "string", "layer": "invalid"}}
        result = validate_schema(s)
        self.assertTrue(any(w["code"] == "SCHEMA_KEY_LAYER_INVALID" for w in result["warnings"]))

    def test_invalid_range_warning(self):
        s = dict(SAMPLE_SCHEMA)
        s["keys"] = {"x": {"full": "xf", "type": "number", "range": [1, 2, 3]}}
        result = validate_schema(s)
        self.assertTrue(any(w["code"] == "SCHEMA_KEY_RANGE_INVALID" for w in result["warnings"]))


# ===================================================================
# Validator: Response
# ===================================================================

class TestValidateResponse(unittest.TestCase):
    def _valid_response(self):
        return {
            "$pact": "1.0",
            "$s": "pact:shopping/product@1",
            "$t": 1700000000000,
            "items": [
                {"n": "Widget", "p": 9.99},
            ],
        }

    def test_valid_response(self):
        result = validate_response(self._valid_response())
        self.assertTrue(result["valid"])
        self.assertEqual(result["conformance_level"], "L2")

    def test_not_object(self):
        result = validate_response(42)
        self.assertFalse(result["valid"])

    def test_missing_pact(self):
        r = self._valid_response()
        del r["$pact"]
        result = validate_response(r)
        self.assertFalse(result["valid"])

    def test_missing_schema(self):
        r = self._valid_response()
        del r["$s"]
        result = validate_response(r)
        self.assertFalse(result["valid"])

    def test_missing_items(self):
        r = self._valid_response()
        del r["items"]
        result = validate_response(r)
        self.assertFalse(result["valid"])
        self.assertTrue(any(e["code"] == "RESP_NO_ITEMS" for e in result["errors"]))

    def test_table_layout_valid(self):
        r = {
            "$pact": "1.0",
            "$s": "pact:shopping/product@1",
            "$t": 1700000000000,
            "$layout": "table",
            "cols": ["n", "p"],
            "rows": [["A", 1], ["B", 2]],
        }
        result = validate_response(r)
        self.assertTrue(result["valid"])

    def test_table_layout_missing_cols(self):
        r = {
            "$pact": "1.0",
            "$s": "s",
            "$t": 1,
            "$layout": "table",
            "rows": [["A"]],
        }
        result = validate_response(r)
        self.assertFalse(result["valid"])

    def test_table_layout_missing_rows(self):
        r = {
            "$pact": "1.0",
            "$s": "s",
            "$t": 1,
            "$layout": "table",
            "cols": ["x"],
        }
        result = validate_response(r)
        self.assertFalse(result["valid"])

    def test_table_row_length_mismatch_warning(self):
        r = {
            "$pact": "1.0",
            "$s": "s",
            "$t": 1,
            "$layout": "table",
            "cols": ["a", "b"],
            "rows": [[1]],
        }
        result = validate_response(r)
        self.assertTrue(any(w["code"] == "RESP_TABLE_ROW_LENGTH" for w in result["warnings"]))

    def test_response_with_schema_required_key_missing(self):
        r = self._valid_response()
        r["items"] = [{"n": "Widget"}]  # missing required "p"
        result = validate_response(r, schema=SAMPLE_SCHEMA)
        self.assertTrue(any(w["code"] == "RESP_ITEM_MISSING_KEY" for w in result["warnings"]))

    def test_response_with_schema_unknown_key(self):
        r = self._valid_response()
        r["items"] = [{"n": "W", "p": 1, "zzz": "unknown"}]
        result = validate_response(r, schema=SAMPLE_SCHEMA)
        self.assertTrue(any(w["code"] == "RESP_ITEM_UNKNOWN_KEY" for w in result["warnings"]))

    def test_response_page_validation(self):
        r = self._valid_response()
        r["page"] = {"offset": 0, "limit": 10}
        result = validate_response(r)
        self.assertTrue(result["valid"])

    def test_response_page_bad_format(self):
        r = self._valid_response()
        r["page"] = "not_an_object"
        result = validate_response(r)
        self.assertTrue(any(w["code"] == "RESP_PAGE_TYPE" for w in result["warnings"]))

    def test_id_is_reserved_key(self):
        """'id' should not trigger unknown key warnings."""
        r = self._valid_response()
        r["items"] = [{"id": "abc", "n": "W", "p": 1}]
        result = validate_response(r, schema=SAMPLE_SCHEMA)
        unknown_warnings = [w for w in result["warnings"] if w["code"] == "RESP_ITEM_UNKNOWN_KEY"]
        self.assertEqual(len(unknown_warnings), 0)


# ===================================================================
# Validator: Conformance
# ===================================================================

class TestValidateConformance(unittest.TestCase):
    def test_l1_minimal(self):
        disc = {
            "pact": "1.0",
            "site": "Test",
            "schemas": [],
            "endpoints": {},
        }
        result = validate_conformance(disc)
        self.assertTrue(result["valid"])
        self.assertEqual(result["conformance_level"], "L1")

    def test_l2(self):
        disc = {
            "pact": "1.0",
            "site": "Test",
            "schemas": ["pact:shopping/product@1"],
            "endpoints": {
                "pact:shopping/product@1": {"list": "/api/p"},
            },
        }
        result = validate_conformance(disc)
        self.assertEqual(result["conformance_level"], "L2")

    def test_l3(self):
        disc = {
            "pact": "1.0",
            "site": "Test",
            "schemas": ["pact:shopping/product@1"],
            "endpoints": {
                "pact:shopping/product@1": {
                    "list": "/api/p",
                    "item": "/api/p/{id}",
                    "search": "/api/p/search",
                },
            },
        }
        result = validate_conformance(disc)
        self.assertEqual(result["conformance_level"], "L3")

    def test_l4(self):
        disc = {
            "pact": "1.0",
            "site": "Test",
            "schemas": ["pact:shopping/product@1"],
            "endpoints": {
                "pact:shopping/product@1": {
                    "list": "/api/p",
                    "item": "/api/p/{id}",
                    "search": "/api/p/search",
                },
            },
            "auth": {"type": "bearer"},
            "license": {"ai_input": True, "ai_train": False, "attribution": True},
            "rate_limit": {"rpm": 60},
        }
        result = validate_conformance(disc)
        self.assertEqual(result["conformance_level"], "L4")

    def test_invalid_discovery_returns_none(self):
        result = validate_conformance("not valid")
        self.assertFalse(result["valid"])
        self.assertEqual(result["conformance_level"], "none")

    def test_l2_missing_list(self):
        disc = {
            "pact": "1.0",
            "site": "Test",
            "schemas": ["pact:shopping/product@1"],
            "endpoints": {
                "pact:shopping/product@1": {"item": "/api/p/{id}"},
            },
        }
        result = validate_conformance(disc)
        self.assertEqual(result["conformance_level"], "L1")
        self.assertTrue(any(w["code"] == "CONF_L2_NO_LIST" for w in result["warnings"]))

    def test_l3_missing_search(self):
        disc = {
            "pact": "1.0",
            "site": "Test",
            "schemas": ["pact:shopping/product@1"],
            "endpoints": {
                "pact:shopping/product@1": {
                    "list": "/api/p",
                    "item": "/api/p/{id}",
                },
            },
        }
        result = validate_conformance(disc)
        self.assertEqual(result["conformance_level"], "L2")
        self.assertTrue(any(w["code"] == "CONF_L3_NO_SEARCH" for w in result["warnings"]))

    def test_l4_missing_auth(self):
        disc = {
            "pact": "1.0",
            "site": "Test",
            "schemas": ["pact:shopping/product@1"],
            "endpoints": {
                "pact:shopping/product@1": {
                    "list": "/api/p",
                    "item": "/api/p/{id}",
                    "search": "/api/p/search",
                },
            },
            "license": {"ai_input": True, "ai_train": False, "attribution": True},
            "rate_limit": {"rpm": 60},
        }
        result = validate_conformance(disc)
        self.assertEqual(result["conformance_level"], "L3")
        self.assertTrue(any(w["code"] == "CONF_L4_NO_AUTH" for w in result["warnings"]))


# ===================================================================
# Integration: __init__.py re-exports
# ===================================================================

class TestImports(unittest.TestCase):
    """Verify that the top-level pact package exposes the public API."""

    def test_constants(self):
        import pact
        self.assertEqual(pact.PACT_VERSION, "1.0")
        self.assertEqual(pact.PACT_MIME_TYPE, "application/pact+json")

    def test_types(self):
        from pact import PactPage, PactEnvelope, PactTableEnvelope, ValidationResult
        page = PactPage(offset=0, limit=10)
        self.assertEqual(page.offset, 0)

    def test_functions(self):
        import pact
        self.assertTrue(callable(pact.compress))
        self.assertTrue(callable(pact.expand))
        self.assertTrue(callable(pact.create_envelope))
        self.assertTrue(callable(pact.create_table_envelope))
        self.assertTrue(callable(pact.to_table))
        self.assertTrue(callable(pact.from_table))
        self.assertTrue(callable(pact.create_discovery))
        self.assertTrue(callable(pact.validate_discovery))
        self.assertTrue(callable(pact.validate_schema))
        self.assertTrue(callable(pact.validate_response))
        self.assertTrue(callable(pact.validate_conformance))
        self.assertTrue(callable(pact.discover_pact))

    def test_classes(self):
        import pact
        self.assertTrue(callable(pact.SchemaRegistry))
        self.assertTrue(callable(pact.PactClient))


if __name__ == "__main__":
    unittest.main()
