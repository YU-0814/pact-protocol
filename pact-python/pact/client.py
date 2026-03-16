"""PACT HTTP client using only Python stdlib (urllib)."""

from __future__ import annotations

import json
import urllib.request
import urllib.parse
import urllib.error
from typing import Any, Dict, List, Optional

from .constants import PACT_MIME_TYPE, PACT_DISCOVERY_PATH
from .key_compressor import expand as _expand_item


class PactClientError(Exception):
    """Raised when a PACT HTTP request fails."""

    def __init__(self, message: str, status: int = 0, body: str = "") -> None:
        super().__init__(message)
        self.status = status
        self.body = body


class PactClient:
    """AI-agent client SDK for consuming PACT protocol endpoints.

    Uses :mod:`urllib.request` (stdlib). Sets ``Accept: application/pact+json``
    on every request to signal PACT support.
    """

    def __init__(
        self,
        base_url: str,
        api_key: Optional[str] = None,
        user_agent: str = "PactPython/1.0",
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.user_agent = user_agent
        self._cached_discovery: Optional[Dict[str, Any]] = None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_headers(self) -> Dict[str, str]:
        headers: Dict[str, str] = {
            "Accept": PACT_MIME_TYPE,
            "User-Agent": self.user_agent,
        }
        if self.api_key:
            headers["Authorization"] = "Bearer " + self.api_key
        return headers

    def _request(self, url: str) -> Dict[str, Any]:
        """Perform a GET request and return parsed JSON."""
        req = urllib.request.Request(url, headers=self._build_headers())
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read().decode("utf-8")
                return json.loads(data)
        except urllib.error.HTTPError as exc:
            body = ""
            try:
                body = exc.read().decode("utf-8")
            except Exception:
                pass
            raise PactClientError(
                "PACT request failed: {} {}".format(exc.code, exc.reason),
                status=exc.code,
                body=body,
            ) from exc
        except urllib.error.URLError as exc:
            raise PactClientError(
                "PACT request failed: {}".format(exc.reason)
            ) from exc

    def _resolve_url(self, path: str) -> str:
        if path.startswith("http://") or path.startswith("https://"):
            return path
        return self.base_url + path

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def discover(self) -> Dict[str, Any]:
        """Fetch ``/.well-known/pact.json`` (cached after first call)."""
        if self._cached_discovery is not None:
            return self._cached_discovery
        discovery = self._request(self.base_url + PACT_DISCOVERY_PATH)
        self._cached_discovery = discovery
        return discovery

    def list_items(
        self,
        schema_id: str,
        offset: int = 0,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """Fetch a paginated list of items for *schema_id*."""
        discovery = self.discover()
        endpoint = discovery.get("endpoints", {}).get(schema_id, {})
        path = endpoint.get("list", "/pact/{}".format(schema_id))
        url = self._resolve_url(path)

        params = urllib.parse.urlencode({"offset": offset, "limit": limit})
        sep = "&" if "?" in url else "?"
        url = url + sep + params
        return self._request(url)

    def get_item(
        self,
        schema_id: str,
        item_id: str,
        layers: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Fetch a single item by ID."""
        discovery = self.discover()
        endpoint = discovery.get("endpoints", {}).get(schema_id, {})
        path = endpoint.get("item", "/pact/{}/{{id}}".format(schema_id))
        path = path.replace("{id}", urllib.parse.quote(str(item_id), safe=""))
        url = self._resolve_url(path)

        if layers:
            params = urllib.parse.urlencode({"layers": ",".join(layers)})
            sep = "&" if "?" in url else "?"
            url = url + sep + params
        return self._request(url)

    def search(
        self,
        schema_id: str,
        query: str,
        offset: int = 0,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """Search items matching *query*."""
        discovery = self.discover()
        endpoint = discovery.get("endpoints", {}).get(schema_id, {})
        path = endpoint.get("search", "/pact/{}/search".format(schema_id))
        url = self._resolve_url(path)

        params = urllib.parse.urlencode({
            "q": query,
            "offset": offset,
            "limit": limit,
        })
        sep = "&" if "?" in url else "?"
        url = url + sep + params
        return self._request(url)

    def expand(self, data: Dict[str, Any], schema: dict) -> Dict[str, Any]:
        """Expand abbreviated keys in a PACT envelope using a schema."""
        expanded_items = [
            _expand_item(item, schema) for item in data.get("items", [])
        ]
        result = dict(data)
        result["items"] = expanded_items
        return result


# ------------------------------------------------------------------
# Standalone discovery helper
# ------------------------------------------------------------------

def discover_pact(domain: str) -> Optional[Dict[str, Any]]:
    """Attempt to discover PACT support on *domain*.

    Returns the discovery document or ``None`` if the domain does not
    support PACT.
    """
    if domain.startswith("http://") or domain.startswith("https://"):
        base_url = domain.rstrip("/")
    else:
        base_url = "https://" + domain

    url = base_url + PACT_DISCOVERY_PATH
    req = urllib.request.Request(url, headers={
        "Accept": PACT_MIME_TYPE,
        "User-Agent": "PactAutoDiscover/1.0",
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if not data.get("pact") or not isinstance(data.get("schemas"), list):
                return None
            return data
    except Exception:
        return None
