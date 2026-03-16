"""PACT schema registry.

Stores schema definitions and provides key-mapping helpers.
"""

from __future__ import annotations

from typing import Dict, List, Optional


class SchemaRegistry:
    """In-memory registry for PACT schemas."""

    def __init__(self) -> None:
        self._schemas: Dict[str, dict] = {}

    def register(self, schema: dict) -> None:
        """Register a schema by its ``id``."""
        self._schemas[schema["id"]] = schema

    def get(self, schema_id: str) -> Optional[dict]:
        """Return the schema for *schema_id*, or ``None``."""
        return self._schemas.get(schema_id)

    def list(self) -> List[str]:
        """Return all registered schema IDs."""
        return list(self._schemas.keys())

    def get_key_map(self, schema_id: str) -> Dict[str, str]:
        """Return a mapping of abbreviated key -> full key name."""
        schema = self._schemas.get(schema_id)
        if schema is None:
            return {}
        return {abbr: defn["full"] for abbr, defn in schema["keys"].items()}

    def get_reverse_key_map(self, schema_id: str) -> Dict[str, str]:
        """Return a mapping of full key name -> abbreviated key."""
        schema = self._schemas.get(schema_id)
        if schema is None:
            return {}
        return {defn["full"]: abbr for abbr, defn in schema["keys"].items()}
