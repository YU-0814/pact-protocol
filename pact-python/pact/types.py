"""PACT protocol type definitions.

Uses dataclasses for value types and TypedDict for structural types.
Compatible with Python 3.8+.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

if sys.version_info >= (3, 8):
    from typing import TypedDict
else:
    from typing import Dict as TypedDict  # fallback


# ---------------------------------------------------------------------------
# TypedDict-based structural types
# ---------------------------------------------------------------------------

class PactKeyDef(TypedDict, total=False):
    """Schema key definition."""
    full: str           # required
    type: str           # required
    required: bool
    layer: str
    default: Any
    range: List[float]


class PactSchema(TypedDict, total=False):
    """PACT schema definition.

    Note: the JSON field ``$schema`` is represented as ``dollar_schema``
    in Python because ``$`` is not valid in identifiers.  Helper functions
    in this SDK translate between the two representations automatically.
    """
    dollar_schema: str  # maps to JSON "$schema"
    id: str
    description: str
    keys: Dict[str, PactKeyDef]


class PactPlatformDef(TypedDict, total=False):
    """Platform-specific metadata."""
    base_url: str
    bundle_id: str
    package: str
    universal_link: str
    app_link: str
    app_store: str
    play_store: str
    min_version: str
    docs: str
    protocol: str
    mdns: str
    local_ip: str
    port: int


class PactEndpointDef(TypedDict, total=False):
    """Endpoint definition inside a discovery document."""
    list: str
    item: str
    search: str


class PactAction(TypedDict, total=False):
    """An action that can be performed on an item."""
    verb: str
    name: str
    description: str
    url: str
    body: Dict[str, str]
    platforms: Dict[str, str]
    confirmation: str
    auth_required: bool


class PactDiscovery(TypedDict, total=False):
    """PACT discovery document (/.well-known/pact.json)."""
    pact: str
    site: str
    description: str
    schemas: List[str]
    endpoints: Dict[str, PactEndpointDef]
    platforms: Dict[str, PactPlatformDef]
    rate_limit: Dict[str, Any]
    auth: Dict[str, Any]
    license: Dict[str, Any]
    conformance: str


# ---------------------------------------------------------------------------
# Dataclass-based value types
# ---------------------------------------------------------------------------

@dataclass
class PactPage:
    """Pagination metadata."""
    offset: int
    limit: int
    next: Optional[str] = None


@dataclass
class PactEnvelope:
    """Standard PACT response envelope."""
    pact_version: str
    schema: str
    timestamp: int
    ttl: Optional[int] = None
    items: List[Dict[str, Any]] = field(default_factory=list)
    total: Optional[int] = None
    page: Optional[PactPage] = None


@dataclass
class PactTableEnvelope:
    """Table-layout PACT response envelope."""
    pact_version: str
    schema: str
    timestamp: int
    layout: str = "table"
    ttl: Optional[int] = None
    cols: List[str] = field(default_factory=list)
    rows: List[List[Any]] = field(default_factory=list)
    total: Optional[int] = None
    page: Optional[PactPage] = None


@dataclass
class ValidationResult:
    """Result of a validation operation."""
    valid: bool = True
    errors: List[Dict[str, str]] = field(default_factory=list)
    warnings: List[Dict[str, str]] = field(default_factory=list)
    conformance_level: str = "none"
