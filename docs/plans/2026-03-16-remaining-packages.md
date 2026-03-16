# PACT Protocol Remaining Packages Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the 7 remaining components of the PACT protocol project: Next.js plugin, Python SDK, two converter tools, website, WordPress plugin, and Shopify app.

**Architecture:** Each component is independent and builds on the existing `@pact-protocol/core` package. The Next.js plugin wraps the server middleware for App Router. The Python SDK is a pure-Python reimplementation of core (no pip available). The tools are standalone Node.js CLI scripts. The website is a static Vite site. WordPress/Shopify plugins integrate PACT discovery into their respective platforms.

**Tech Stack:** TypeScript (Node 22, npm 11 workspaces), Python 3.10 (no pip), Vite (static site), PHP (WordPress), Liquid/JS (Shopify)

**Constraints:** School server — no sudo, no Docker, no pip. Home directory full freedom.

---

## Task 1: @pact-protocol/next — Next.js Plugin

**Files:**
- Create: `packages/next-plugin/package.json`
- Create: `packages/next-plugin/tsconfig.json`
- Create: `packages/next-plugin/src/index.ts`
- Create: `packages/next-plugin/src/plugin.ts`
- Create: `packages/next-plugin/src/route-handler.ts`
- Create: `packages/next-plugin/src/middleware.ts`

**Step 1: Create package.json**

```json
{
  "name": "@pact-protocol/next",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "node --test"
  },
  "dependencies": {
    "@pact-protocol/core": "^1.0.0"
  },
  "peerDependencies": {
    "next": ">=14"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "next": ">=14"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 3: Implement route-handler.ts**

The core of the plugin — a factory that creates Next.js App Router route handlers from PACT config.

```typescript
// Creates GET handler for /pact/[...path]/route.ts
// - Serves /.well-known/pact.json (discovery)
// - Serves /pact/schemas/{id} (schema definitions)
// - Delegates data routes to user-provided handler functions

import { NextRequest, NextResponse } from 'next/server.js';
import {
  type PactDiscovery,
  type PactSchema,
  type PactEnvelope,
  createEnvelope,
  PACT_MIME_TYPE,
  PACT_VERSION,
} from '@pact-protocol/core';

export interface PactRouteConfig {
  discovery: PactDiscovery;
  schemas: PactSchema[];
  handlers?: Record<string, (req: NextRequest, params: Record<string, string>) => Promise<PactEnvelope | object>>;
}

export function createPactRouteHandler(config: PactRouteConfig) {
  const schemaMap = new Map<string, PactSchema>();
  for (const schema of config.schemas) {
    schemaMap.set(schema.id, schema);
  }

  return async function GET(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
    const { path = [] } = await context.params;
    const fullPath = '/' + path.join('/');

    // Discovery
    if (fullPath === '/.well-known/pact.json' || path.length === 0) {
      return NextResponse.json(config.discovery, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Schema endpoint: /pact/schemas/{schemaId}
    if (path[0] === 'schemas' && path.length >= 2) {
      const schemaId = decodeURIComponent(path.slice(1).join('/'));
      const schema = schemaMap.get(schemaId);
      if (!schema) {
        return NextResponse.json({ error: 'schema_not_found' }, { status: 404 });
      }
      return NextResponse.json(schema, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Delegate to user handler
    if (config.handlers) {
      for (const [pattern, handler] of Object.entries(config.handlers)) {
        const match = matchRoute(fullPath, pattern);
        if (match) {
          const result = await handler(req, match);
          return NextResponse.json(result, {
            headers: {
              'Content-Type': PACT_MIME_TYPE,
              'Cache-Control': 'public, max-age=60',
              'Vary': 'Accept',
            },
          });
        }
      }
    }

    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  };
}

function matchRoute(path: string, pattern: string): Record<string, string> | null {
  const pathParts = path.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith('{') && patternParts[i].endsWith('}')) {
      params[patternParts[i].slice(1, -1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}
```

**Step 4: Implement middleware.ts**

Content negotiation middleware for Next.js.

```typescript
import { NextRequest, NextResponse } from 'next/server.js';
import { PACT_MIME_TYPE } from '@pact-protocol/core';

export function pactMiddleware(request: NextRequest): NextResponse | null {
  const accept = request.headers.get('accept') || '';
  if (accept.includes(PACT_MIME_TYPE)) {
    const response = NextResponse.next();
    response.headers.set('X-PACT', '1');
    return response;
  }
  return null;
}
```

**Step 5: Implement plugin.ts**

Next.js config plugin for auto-registering PACT rewrites.

```typescript
import type { PactDiscovery } from '@pact-protocol/core';

export interface PactPluginOptions {
  discovery: PactDiscovery;
  basePath?: string;
}

export function withPact(nextConfig: Record<string, unknown> = {}, options?: PactPluginOptions) {
  const basePath = options?.basePath || '/pact';

  return {
    ...nextConfig,
    async rewrites() {
      const existingRewrites = typeof nextConfig.rewrites === 'function'
        ? await (nextConfig.rewrites as () => Promise<unknown>)()
        : [];
      const pactRewrites = [
        { source: '/.well-known/pact.json', destination: `${basePath}/.well-known/pact.json` },
      ];
      if (Array.isArray(existingRewrites)) {
        return [...existingRewrites, ...pactRewrites];
      }
      return { ...(existingRewrites as object), afterFiles: pactRewrites };
    },
  };
}
```

**Step 6: Create index.ts barrel export**

```typescript
export { createPactRouteHandler } from './route-handler.js';
export type { PactRouteConfig } from './route-handler.js';
export { pactMiddleware } from './middleware.js';
export { withPact } from './plugin.js';
export type { PactPluginOptions } from './plugin.js';
```

**Step 7: Build and verify**

Run: `cd ~/project/pact-protocol && npm install && npx tsc --project packages/next-plugin/tsconfig.json`
Expected: Clean compilation, dist/ populated.

**Step 8: Commit**

```bash
git add packages/next-plugin/
git commit -m "feat(next): add Next.js plugin with route handler, middleware, and config plugin"
```

---

## Task 2: Python SDK (pact-python)

**Note:** No pip available. Pure Python implementation, zero external dependencies.

**Files:**
- Create: `pact-python/pact/__init__.py`
- Create: `pact-python/pact/types.py`
- Create: `pact-python/pact/constants.py`
- Create: `pact-python/pact/schema_registry.py`
- Create: `pact-python/pact/key_compressor.py`
- Create: `pact-python/pact/envelope.py`
- Create: `pact-python/pact/discovery.py`
- Create: `pact-python/pact/client.py`
- Create: `pact-python/pact/validator.py`
- Create: `pact-python/setup.py`
- Create: `pact-python/tests/test_core.py`

**Step 1: Create project structure and setup.py**

```python
# setup.py
from setuptools import setup, find_packages

setup(
    name='pact-protocol',
    version='1.0.0',
    packages=find_packages(),
    python_requires='>=3.8',
    description='PACT - Protocol for Agent Content Transfer (Python SDK)',
    license='Apache-2.0',
    install_requires=[],  # zero dependencies
)
```

**Step 2: Implement types.py**

Python dataclasses mirroring TypeScript types:
- `PactKeyDef`, `PactSchema`, `PactPage`, `PactEnvelope`, `PactTableEnvelope`
- `PactEndpointDef`, `PactPlatformDef`, `PactDiscovery`
- `PactAction`, `PactMediaRef`
- `ValidationResult`, `ValidationError`, `ValidationWarning`

All using `@dataclass` and `TypedDict` for typed dicts.

**Step 3: Implement constants.py**

```python
PACT_VERSION = "1.0"
PACT_MIME_TYPE = "application/pact+json"
PACT_DISCOVERY_PATH = "/.well-known/pact.json"
PACT_ACCEPT_HEADER = "application/pact+json"
```

**Step 4: Implement schema_registry.py**

`SchemaRegistry` class with `register()`, `get()`, `list()`, `get_key_map()`, `get_reverse_key_map()`.

**Step 5: Implement key_compressor.py**

`compress()`, `expand()`, `compress_batch()`, `expand_batch()` — direct port of TypeScript logic.

**Step 6: Implement envelope.py**

`create_envelope()`, `create_table_envelope()`, `to_table()`, `from_table()`.

**Step 7: Implement discovery.py**

`create_discovery()` — builds `/.well-known/pact.json` content.

**Step 8: Implement client.py**

`PactClient` class using `urllib.request` (stdlib, no pip):
- `discover()`, `list_items()`, `get_item()`, `search()`, `execute_action()`, `expand()`
- `discover_pact(domain)` — auto-discovery function.

**Step 9: Implement validator.py**

`validate_discovery()`, `validate_schema()`, `validate_response()`, `validate_conformance()` — port of TypeScript validator.

**Step 10: Implement __init__.py barrel exports**

```python
from .constants import *
from .types import *
from .schema_registry import SchemaRegistry
from .key_compressor import compress, expand, compress_batch, expand_batch
from .envelope import create_envelope, create_table_envelope, to_table, from_table
from .discovery import create_discovery
from .client import PactClient, discover_pact
from .validator import validate_discovery, validate_schema, validate_response, validate_conformance
```

**Step 11: Write and run tests**

```python
# tests/test_core.py — using unittest (stdlib)
import unittest
from pact import (
    SchemaRegistry, compress, expand, create_envelope,
    to_table, from_table, create_discovery, PACT_VERSION,
    validate_discovery, validate_response
)

class TestKeyCompression(unittest.TestCase):
    def setUp(self):
        self.schema = { ... }  # commerce/product schema

    def test_compress_expand_roundtrip(self):
        ...

    def test_batch_operations(self):
        ...

class TestEnvelope(unittest.TestCase):
    def test_create_envelope(self):
        ...

    def test_table_roundtrip(self):
        ...

class TestDiscovery(unittest.TestCase):
    def test_create_with_platforms(self):
        ...

class TestValidator(unittest.TestCase):
    def test_valid_discovery(self):
        ...

    def test_invalid_discovery(self):
        ...
```

Run: `cd ~/project/pact-protocol/pact-python && python3 -m pytest tests/ -v` or `python3 -m unittest discover tests/ -v`
Expected: All tests pass.

**Step 12: Commit**

```bash
git add pact-python/
git commit -m "feat(python): add pure-Python PACT SDK with zero dependencies"
```

---

## Task 3: tools/schema2pact — Schema.org to PACT Converter

**Files:**
- Create: `tools/schema2pact/package.json`
- Create: `tools/schema2pact/src/index.ts`
- Create: `tools/schema2pact/src/converter.ts`
- Create: `tools/schema2pact/src/abbreviator.ts`
- Create: `tools/schema2pact/tsconfig.json`

**Step 1: Create package.json**

```json
{
  "name": "@pact-protocol/schema2pact",
  "version": "1.0.0",
  "type": "module",
  "bin": { "schema2pact": "./dist/index.js" },
  "scripts": { "build": "tsc" },
  "dependencies": { "@pact-protocol/core": "^1.0.0" },
  "devDependencies": { "typescript": "^5.0.0" }
}
```

**Step 2: Implement abbreviator.ts**

Auto-generates abbreviated keys from full field names:
- Common abbreviations map (name→n, price→p, description→desc, etc.)
- Falls back to first 3-4 chars for unknown fields
- Ensures uniqueness within a schema

```typescript
const COMMON_ABBREVS: Record<string, string> = {
  name: 'n', price: 'p', description: 'desc', title: 't',
  image: 'img', url: 'url', rating: 'r', reviews: 'rv',
  address: 'addr', phone: 'ph', latitude: 'lat', longitude: 'lng',
  currency: 'cur', category: 'cat', brand: 'brand',
  // ... more common fields
};

export function abbreviate(fullName: string, existing: Set<string>): string { ... }
```

**Step 3: Implement converter.ts**

Reads Schema.org JSON-LD type definitions and outputs PACT schema:

```typescript
export interface SchemaOrgType {
  '@type': string;
  '@id'?: string;
  properties?: Record<string, SchemaOrgProperty>;
}

export function convertSchemaOrg(input: SchemaOrgType, domain: string): PactSchema { ... }
// Maps Schema.org types to PACT types (Text→string, Number→number, Boolean→boolean, URL→url)
// Auto-generates abbreviated keys
// Sets required based on Schema.org required properties
```

**Step 4: Implement CLI (index.ts)**

```typescript
#!/usr/bin/env node
// Usage: schema2pact <schema.org-type-or-file> [--domain <domain>] [--output <file>]
// Examples:
//   schema2pact Product --domain commerce
//   schema2pact schema.jsonld --domain food --output restaurant.json
//   schema2pact https://schema.org/Product --domain commerce
```

**Step 5: Build and test**

Run: `cd ~/project/pact-protocol && npx tsc --project tools/schema2pact/tsconfig.json`
Expected: Clean build.

**Step 6: Commit**

```bash
git add tools/schema2pact/
git commit -m "feat(tools): add Schema.org to PACT schema converter"
```

---

## Task 4: tools/llmstxt2pact — llms.txt to PACT Converter

**Files:**
- Create: `tools/llmstxt2pact/package.json`
- Create: `tools/llmstxt2pact/src/index.ts`
- Create: `tools/llmstxt2pact/src/parser.ts`
- Create: `tools/llmstxt2pact/src/generator.ts`
- Create: `tools/llmstxt2pact/tsconfig.json`

**Step 1: Create package.json**

```json
{
  "name": "@pact-protocol/llmstxt2pact",
  "version": "1.0.0",
  "type": "module",
  "bin": { "llmstxt2pact": "./dist/index.js" },
  "scripts": { "build": "tsc" },
  "dependencies": { "@pact-protocol/core": "^1.0.0" },
  "devDependencies": { "typescript": "^5.0.0" }
}
```

**Step 2: Implement parser.ts**

Parses llms.txt format (markdown-like) into structured sections:
- Site name, description
- Sections with headings and content
- URL references
- API endpoint mentions

```typescript
export interface LlmsTxtParsed {
  title: string;
  description: string;
  sections: { heading: string; content: string; urls: string[] }[];
}

export function parseLlmsTxt(content: string): LlmsTxtParsed { ... }
```

**Step 3: Implement generator.ts**

Generates a PACT discovery document from parsed llms.txt:

```typescript
export function generateDiscovery(parsed: LlmsTxtParsed, domain: string): PactDiscovery { ... }
// Infers schemas from section content (e.g., "products" section → pact:commerce/product@1)
// Creates basic endpoints from URL references
// Generates L1 conformance discovery document
```

**Step 4: Implement CLI (index.ts)**

```typescript
#!/usr/bin/env node
// Usage: llmstxt2pact <llms.txt-file-or-url> [--domain <domain>] [--output <file>]
// Reads llms.txt and generates a /.well-known/pact.json scaffold
```

**Step 5: Build and test**

Run: `cd ~/project/pact-protocol && npx tsc --project tools/llmstxt2pact/tsconfig.json`

**Step 6: Commit**

```bash
git add tools/llmstxt2pact/
git commit -m "feat(tools): add llms.txt to PACT discovery converter"
```

---

## Task 5: Website — pact-protocol.dev (Static Vite Site)

**Files:**
- Create: `website/package.json`
- Create: `website/index.html`
- Create: `website/vite.config.js`
- Create: `website/src/main.ts`
- Create: `website/src/style.css`
- Create: `website/docs/index.html` (spec docs viewer)
- Create: `website/playground/index.html` (interactive PACT tester)
- Create: `website/score/index.html` (AI Visibility Score tool)

**Step 1: Create package.json and vite config**

```json
{
  "name": "pact-protocol-website",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^6.0.0"
  }
}
```

**Step 2: Create index.html — Landing Page**

Single-page marketing site:
- Hero: "PACT — Protocol for Agent Content Transfer"
- Tagline: "Make a PACT with AI agents. You control the terms."
- Problem/solution diagram (MCP=tools, A2A=agents, PACT=content)
- 5-layer architecture visual
- Token savings comparison (PACT vs HTML: 57x reduction)
- Conformance levels (L1-L4) with "5 minutes to L1"
- Quick start code snippet
- Links to docs, playground, score, GitHub

**Step 3: Create docs page**

Renders the spec document (pact-v1.0.md) with navigation sidebar. Uses a simple markdown renderer (inline JS, no build deps).

**Step 4: Create playground page**

Interactive PACT tester:
- Input: Paste a discovery.json or response.json
- Validates using the validator logic (bundled from @pact-protocol/validator)
- Shows conformance level, errors, warnings
- "Try Example" buttons for each of the 3 example domains

**Step 5: Create score page — AI Visibility Score**

Enter a domain → checks for:
- `/.well-known/pact.json` (via user-entered URL, client-side fetch with CORS)
- `llms.txt` presence
- `robots.txt` AI directives
- Schema.org markup
- Calculates a 0-100 "AI Visibility Score"
- Shows what's missing and how to improve

**Step 6: Build and test locally**

Run: `cd ~/project/pact-protocol/website && npm install && npm run build`
Expected: Static site in website/dist/.

**Step 7: Commit**

```bash
git add website/
git commit -m "feat(website): add pact-protocol.dev static site with docs, playground, and score tool"
```

---

## Task 6: WordPress Plugin

**Files:**
- Create: `plugins/wordpress/pact-protocol.php`
- Create: `plugins/wordpress/includes/class-pact-discovery.php`
- Create: `plugins/wordpress/includes/class-pact-endpoint.php`
- Create: `plugins/wordpress/readme.txt`

**Step 1: Create main plugin file (pact-protocol.php)**

```php
<?php
/*
Plugin Name: PACT Protocol
Description: Serve structured, AI-optimized content via the PACT protocol
Version: 1.0.0
License: Apache-2.0
*/

// Register /.well-known/pact.json endpoint
// Register /pact/ REST API namespace
// Auto-detect post types and generate schemas
// Content negotiation for Accept: application/pact+json
```

**Step 2: Implement discovery class**

Auto-generates `/.well-known/pact.json` from WordPress post types:
- Posts → `pact:news/article@1`
- WooCommerce Products → `pact:commerce/product@1`
- Custom post types → auto-mapped

**Step 3: Implement data endpoint**

REST API endpoints at `/wp-json/pact/v1/`:
- `/discover` → discovery document
- `/posts` → article data in PACT format
- `/posts/{id}` → single article
- Key compression using the news/article schema

**Step 4: Create readme.txt (WordPress plugin format)**

Standard WordPress plugin readme with installation instructions.

**Step 5: Commit**

```bash
git add plugins/wordpress/
git commit -m "feat(wordpress): add WordPress plugin for auto PACT endpoint generation"
```

---

## Task 7: Shopify App

**Files:**
- Create: `plugins/shopify/pact-extension.liquid`
- Create: `plugins/shopify/pact-discovery.json.liquid`
- Create: `plugins/shopify/README.md`
- Create: `plugins/shopify/pact-proxy.js`

**Step 1: Create Shopify App Proxy script (pact-proxy.js)**

Node.js script that acts as a Shopify App Proxy endpoint:
- Reads products from Shopify Storefront API
- Transforms to PACT format using `@pact-protocol/core`
- Serves as `/apps/pact/products`, `/apps/pact/products/{id}`
- Generates discovery document from shop metadata

**Step 2: Create Liquid templates**

For Shopify theme integration (alternative to app proxy):
- `pact-discovery.json.liquid` — generates discovery JSON from shop data
- `pact-extension.liquid` — snippet for adding PACT meta tags to theme

**Step 3: Create README with setup instructions**

**Step 4: Commit**

```bash
git add plugins/shopify/
git commit -m "feat(shopify): add Shopify app proxy and Liquid templates for PACT"
```

---

## Execution Order and Dependencies

```
Task 1 (Next.js plugin)     — Independent, build on core
Task 2 (Python SDK)         — Independent, pure Python
Task 3 (schema2pact)        — Independent, build on core
Task 4 (llmstxt2pact)       — Independent, build on core
Task 5 (Website)            — Depends on validator (bundles it for playground)
Task 6 (WordPress)          — Independent, PHP
Task 7 (Shopify)            — Depends on core (uses it in proxy)
```

Tasks 1-4 and 6 are fully independent and can be parallelized.
Task 5 can start in parallel but playground needs validator.
Task 7 needs core built.

**Recommended parallel groups:**
- Group A: Tasks 1 + 2 + 3 + 4 (all independent)
- Group B: Tasks 5 + 6 + 7 (after Group A verifies core is stable)
