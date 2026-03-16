"""PACT envelope creation and table-layout conversion utilities."""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from .constants import PACT_VERSION


def create_envelope(
    schema: str,
    items: List[Dict[str, Any]],
    total: Optional[int] = None,
    ttl: Optional[int] = None,
    page: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create a standard PACT envelope."""
    envelope: Dict[str, Any] = {
        "$pact": PACT_VERSION,
        "$s": schema,
        "$t": int(time.time() * 1000),
        "items": items,
    }
    if ttl is not None:
        envelope["$ttl"] = ttl
    if total is not None:
        envelope["total"] = total
    if page is not None:
        envelope["page"] = page
    return envelope


def create_table_envelope(
    schema: str,
    cols: List[str],
    rows: List[List[Any]],
    total: Optional[int] = None,
    ttl: Optional[int] = None,
    page: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create a table-layout PACT envelope."""
    envelope: Dict[str, Any] = {
        "$pact": PACT_VERSION,
        "$s": schema,
        "$t": int(time.time() * 1000),
        "$layout": "table",
        "cols": cols,
        "rows": rows,
    }
    if ttl is not None:
        envelope["$ttl"] = ttl
    if total is not None:
        envelope["total"] = total
    if page is not None:
        envelope["page"] = page
    return envelope


def to_table(envelope: Dict[str, Any], keys: List[str]) -> Dict[str, Any]:
    """Convert a standard envelope to a table-layout envelope.

    *keys* specifies the column order. Missing values become ``None``.
    """
    rows: List[List[Any]] = [
        [item.get(k) for k in keys]
        for item in envelope.get("items", [])
    ]
    table: Dict[str, Any] = {
        "$pact": envelope["$pact"],
        "$s": envelope["$s"],
        "$t": envelope["$t"],
        "$layout": "table",
        "cols": keys,
        "rows": rows,
    }
    if "$ttl" in envelope:
        table["$ttl"] = envelope["$ttl"]
    if "total" in envelope:
        table["total"] = envelope["total"]
    if "page" in envelope:
        table["page"] = envelope["page"]
    return table


def from_table(table: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a table-layout envelope to a standard envelope."""
    cols = table.get("cols", [])
    items: List[Dict[str, Any]] = []
    for row in table.get("rows", []):
        item: Dict[str, Any] = {}
        for i, col in enumerate(cols):
            item[col] = row[i] if i < len(row) else None
        items.append(item)

    envelope: Dict[str, Any] = {
        "$pact": table["$pact"],
        "$s": table["$s"],
        "$t": table["$t"],
        "items": items,
    }
    if "$ttl" in table:
        envelope["$ttl"] = table["$ttl"]
    if "total" in table:
        envelope["total"] = table["total"]
    if "page" in table:
        envelope["page"] = table["page"]
    return envelope
