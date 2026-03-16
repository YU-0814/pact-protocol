"""PACT key compression / expansion utilities.

Converts between full-name keys and abbreviated keys using the schema
definition.
"""

from __future__ import annotations

from typing import Any, Dict, List


def _build_reverse_map(schema: dict) -> Dict[str, str]:
    """Build a full-key -> abbreviated-key map from a schema."""
    return {defn["full"]: abbr for abbr, defn in schema["keys"].items()}


def _build_forward_map(schema: dict) -> Dict[str, str]:
    """Build an abbreviated-key -> full-key map from a schema."""
    return {abbr: defn["full"] for abbr, defn in schema["keys"].items()}


def compress(data: Dict[str, Any], schema: dict) -> Dict[str, Any]:
    """Compress a record by converting full keys to abbreviated keys."""
    reverse_map = _build_reverse_map(schema)
    return {reverse_map.get(key, key): value for key, value in data.items()}


def expand(data: Dict[str, Any], schema: dict) -> Dict[str, Any]:
    """Expand a record by converting abbreviated keys to full keys."""
    forward_map = _build_forward_map(schema)
    return {forward_map.get(key, key): value for key, value in data.items()}


def compress_batch(items: List[Dict[str, Any]], schema: dict) -> List[Dict[str, Any]]:
    """Batch compress a list of records."""
    return [compress(item, schema) for item in items]


def expand_batch(items: List[Dict[str, Any]], schema: dict) -> List[Dict[str, Any]]:
    """Batch expand a list of records."""
    return [expand(item, schema) for item in items]
