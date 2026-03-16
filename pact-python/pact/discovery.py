"""PACT discovery document creation."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .constants import PACT_VERSION


def create_discovery(
    site: str,
    schemas: List[str],
    endpoints: Dict[str, Any],
    description: Optional[str] = None,
    platforms: Optional[Dict[str, Any]] = None,
    rate_limit: Optional[Dict[str, Any]] = None,
    auth: Optional[Dict[str, Any]] = None,
    license: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create a PACT discovery document for ``/.well-known/pact.json``."""
    discovery: Dict[str, Any] = {
        "pact": PACT_VERSION,
        "site": site,
        "schemas": schemas,
        "endpoints": endpoints,
    }
    if description is not None:
        discovery["description"] = description
    if platforms is not None:
        discovery["platforms"] = platforms
    if rate_limit is not None:
        discovery["rate_limit"] = rate_limit
    if auth is not None:
        discovery["auth"] = auth
    if license is not None:
        discovery["license"] = license
    return discovery
