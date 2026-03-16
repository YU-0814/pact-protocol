"""PACT Protocol SDK for Python.

Pure-Python implementation of the PACT protocol, mirroring the
TypeScript @pact-protocol/core package. Zero external dependencies.
"""

from .constants import (
    PACT_VERSION,
    PACT_MIME_TYPE,
    PACT_DISCOVERY_PATH,
    PACT_ACCEPT_HEADER,
)

from .types import (
    PactKeyDef,
    PactSchema,
    PactPage,
    PactEnvelope,
    PactTableEnvelope,
    PactPlatformDef,
    PactDiscovery,
    PactEndpointDef,
    PactAction,
    ValidationResult,
)

from .schema_registry import SchemaRegistry

from .key_compressor import (
    compress,
    expand,
    compress_batch,
    expand_batch,
)

from .envelope import (
    create_envelope,
    create_table_envelope,
    to_table,
    from_table,
)

from .discovery import create_discovery

from .client import PactClient, PactClientError, discover_pact

from .validator import (
    validate_discovery,
    validate_schema,
    validate_response,
    validate_conformance,
)

__all__ = [
    # Constants
    "PACT_VERSION",
    "PACT_MIME_TYPE",
    "PACT_DISCOVERY_PATH",
    "PACT_ACCEPT_HEADER",
    # Types
    "PactKeyDef",
    "PactSchema",
    "PactPage",
    "PactEnvelope",
    "PactTableEnvelope",
    "PactPlatformDef",
    "PactDiscovery",
    "PactEndpointDef",
    "PactAction",
    "ValidationResult",
    # Schema registry
    "SchemaRegistry",
    # Key compressor
    "compress",
    "expand",
    "compress_batch",
    "expand_batch",
    # Envelope
    "create_envelope",
    "create_table_envelope",
    "to_table",
    "from_table",
    # Discovery
    "create_discovery",
    # Client
    "PactClient",
    "PactClientError",
    "discover_pact",
    # Validator
    "validate_discovery",
    "validate_schema",
    "validate_response",
    "validate_conformance",
]
