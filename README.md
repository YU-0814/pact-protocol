```
 ____   _    ____ _____
|  _ \ / \  / ___|_   _|
| |_) / _ \| |     | |
|  __/ ___ \ |___  | |
|_| /_/   \_\____| |_|
```

<div align="center">

**Protocol for Agent Content Transfer**

*The standard for delivering structured, token-efficient content to AI agents.*

![Version](https://img.shields.io/badge/version-1.0-00d4aa?style=flat-square)
![License](https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-ESM-3178C6?style=flat-square)
![Python](https://img.shields.io/badge/Python-SDK-3776AB?style=flat-square)
![Node](https://img.shields.io/badge/Node-22+-339933?style=flat-square)
![Tests](https://img.shields.io/badge/tests-127%20passing-00d4aa?style=flat-square)

**57x more efficient** · **8 SDK packages** · **4 conformance levels** · **12 standard domains**

[Website](http://10.125.208.217:8788/) · [Live Demo](http://10.125.208.217:8790/) · [Spec](spec/pact-v1.0.md) · [Playground](http://10.125.208.217:8788/playground/) · [한국어](http://10.125.208.217:8788/ko.html)

</div>

---

## The Problem

When an AI agent fetches a web page, **98% of the tokens are wasted**:

```
HTML page for 1 product: ~2,500 tokens
├── Navigation bar:        800 tokens (32%)
├── Sidebar:               600 tokens (24%)
├── Footer:              1,200 tokens (48%)   ← USELESS TO AI
├── CSS/JS references:     200 tokens (8%)
├── Cookie banners:        150 tokens (6%)
└── Actual product data:   ~170 tokens (7%)   ← THIS IS ALL THE AI NEEDS
```

Multiply this by 20 products, and the agent burns **~40,000 tokens** to extract what could be delivered in **~700 tokens**.

## The Solution

PACT fills the gap between discovery standards and interaction protocols:

```
robots.txt        "Don't go here"         (access control)
llms.txt          "Here's a summary"      (plain text)
Schema.org        "This HTML has data"    (markup)
    ↓
  PACT            "HERE'S THE DATA"       ← direct delivery
    ↓
MCP               "Here are your tools"   (agent tools)
A2A               "Talk to other agents"  (agent-to-agent)
```

**PACT = auto-discoverable + universal schema + AI-optimized data delivery**

## Quick Start

**Step 1:** Add `/.well-known/pact.json` to your site:

```json
{
  "pact": "1.0",
  "site": "example.com",
  "schemas": ["pact:commerce/product@1"],
  "endpoints": {
    "pact:commerce/product@1": {
      "list": "/pact/products",
      "item": "/pact/products/{id}",
      "search": "/pact/products?q={query}"
    }
  }
}
```

**Step 2:** Serve PACT responses:

```json
{
  "$pact": "1.0",
  "$s": "pact:commerce/product@1",
  "$t": 1710590400,
  "items": [
    { "n": "Galaxy S25", "p": 999000, "cur": "KRW", "stk": true }
  ],
  "total": 1
}
```

**Step 3:** AI agents auto-discover and consume:

```bash
# Agent discovers your site
curl -s https://example.com/.well-known/pact.json

# Agent fetches data
curl -s https://example.com/pact/products?q=phone \
  -H "Accept: application/pact+json"
```

## Architecture

```
┌─────────────────────────────────────┐
│  Layer 4: Actions                   │  purchase / reserve / subscribe
├─────────────────────────────────────┤
│  Layer 3: Media                     │  image / video URL pointers
├─────────────────────────────────────┤
│  Layer 2: Data                      │  structured JSON + key compression
├─────────────────────────────────────┤
│  Layer 1: Schema                    │  pact:domain/type@version
├─────────────────────────────────────┤
│  Layer 0: Discovery                 │  /.well-known/pact.json
└─────────────────────────────────────┘
```

### Key Compression

Full keys → abbreviated keys via schema definition:

```
{"name": "Widget", "price": 9.99, "in_stock": true}   →   {"n": "Widget", "p": 9.99, "stk": true}

Token savings: ~37%
```

### Table Layout

For bulk data, eliminate key repetition:

```json
{
  "$layout": "table",
  "cols": ["n", "p", "stk"],
  "rows": [
    ["Widget A", 9.99, true],
    ["Widget B", 19.99, true]
  ]
}
```

50 products × 7 fields: **350 keys → 7 column headers** = 98% key reduction.

## Packages

### Core SDK (TypeScript)

| Package | Description |
|---------|-------------|
| `@pact-protocol/core` | Schema registry, key compression, envelope creation, discovery |
| `@pact-protocol/validator` | JSON validation, conformance level checking, CLI |
| `@pact-protocol/server` | Express middleware, content negotiation, rate limiting |
| `@pact-protocol/client` | AI agent SDK, auto-discovery, SSRF protection, cache TTL |
| `@pact-protocol/mcp-bridge` | MCP (Model Context Protocol) server integration |
| `@pact-protocol/next-plugin` | Next.js framework integration |

### Tools

| Package | Description |
|---------|-------------|
| `@pact-protocol/llmstxt2pact` | Convert llms.txt files to PACT discovery documents |
| `@pact-protocol/schema2pact` | Convert Schema.org types to PACT schemas |

### Plugins

| Plugin | Description |
|--------|-------------|
| `plugins/shopify` | Shopify Storefront API → PACT proxy (GraphQL variables, parameterized queries) |

### Python SDK

```bash
cd pact-python && python3 -m unittest tests/test_core.py -v
# 84 tests passing
```

## Examples

### Commerce — PriceFinder

Korean price comparison marketplace:

```json
{
  "pact": "1.0",
  "site": "pricefinder.kr",
  "schemas": ["pact:commerce/product@1"],
  "endpoints": {
    "pact:commerce/product@1": {
      "list": "/pact/products",
      "search": "/pact/products?q={query}"
    }
  }
}
```

### Biomedical — Clinical Trial Registry

> Synthetic demo data inspired by [ClinicalTrials.gov](https://clinicaltrials.gov) structure.

```json
{
  "$pact": "1.0",
  "$s": "pact:health/clinical-trial@1",
  "items": [{
    "id": "NCT06012345",
    "n": "Phase III Diabetes Prevention Trial",
    "phase": "III",
    "status": "recruiting",
    "condition": "Type 2 Diabetes Mellitus",
    "intervention": "GLP-1 receptor agonist",
    "sponsor": "Seoul National University Hospital",
    "enrollment": 450
  }]
}
```

### Restaurant — Seoul Eats

Korean restaurant discovery with cross-platform support (web, iOS, Android) and reservation actions.

## Live Demo

A comparison server demonstrates PACT vs HTML with clinical trial data:

| Endpoint | Description |
|----------|-------------|
| `GET /` | Side-by-side HTML vs PACT comparison |
| `GET /.well-known/pact.json` | PACT discovery document |
| `GET /pact/trials` | All 8 trials (PACT format) |
| `GET /pact/trials?q=diabetes` | Search trials |
| `GET /pact/trials?layout=table` | Table mode (maximum compression) |
| `GET /trial/NCT06012345` | HTML version (~2,500 tokens) |
| `GET /pact/trials/NCT06012345` | PACT version (~170 tokens) |

## Biomedical Use Case

PACT is particularly valuable for biomedical data, where AI agents need to consume structured medical information precisely and efficiently.

**Applications:**
- **Clinical trial registries** — AI medical assistants auto-match patients to trials
- **Drug interaction databases** — AI pharmacovigilance in real-time
- **Medical device catalogs** — Structured specs for AI-guided recommendations
- **Genomic variant portals** — 142K+ variants via table mode with minimal tokens
- **Hospital API gateways** — AI triage agents accessing appointments and results

**Token efficiency for clinical data:**

| Source | Tokens (5 trials) | Ratio |
|--------|-------------------|-------|
| ClinicalTrials.gov API | ~45,000 | baseline |
| HTML page (per trial) | ~2,500 | - |
| PACT response | ~850 | **53x reduction** |
| PACT table mode | ~600 | **75x reduction** |

## Standard Domains

| Domain | Description | Example Types |
|--------|-------------|---------------|
| `commerce` | Products, prices, offers | product, offer, cart |
| `news` | Articles, blogs, feeds | article, headline, feed |
| `food` | Restaurants, menus | restaurant, menu, recipe |
| `realestate` | Property listings | listing, agent, building |
| `travel` | Hotels, flights | hotel, flight, booking |
| `events` | Concerts, conferences | event, ticket, venue |
| `local` | Local businesses | business, service, review |
| `media` | Videos, podcasts | video, podcast, channel |
| `education` | Courses, programs | course, program, cert |
| `jobs` | Job postings | posting, company, salary |
| `finance` | Market data | stock, rate, ticker |
| `health` | Medical data | clinical-trial, drug, device |

Custom domains are also supported — providers are not limited to this list.

## Conformance Levels

| Level | Name | Requirements | Effort |
|-------|------|-------------|--------|
| **L1** | Discoverable | Valid `pact.json` at `/.well-known/pact.json` | ~5 min |
| **L2** | Typed | L1 + schema IDs, `$pact` and `$s` in responses | ~30 min |
| **L3** | Efficient | L2 + key compression, table layout, pagination | Hours |
| **L4** | Trusted | L3 + authentication, actions, licensing | Days |

## PACT vs Alternatives

| Feature | HTML Scraping | REST API | Schema.org | FHIR | **PACT** |
|---------|:---:|:---:|:---:|:---:|:---:|
| Auto-discovery | No | No | No | No | **Yes** |
| Universal schema | No | No | Partial | Medical only | **Yes** |
| Token-optimized | No | No | No | No | **Yes** |
| AI-first design | No | No | No | No | **Yes** |
| Cross-domain | Yes | Yes | Yes | No | **Yes** |
| Key compression | No | No | No | No | **Yes** |
| Table layout | No | No | No | No | **Yes** |

## Project Structure

```
pact-protocol/
├── spec/                    # PACT v1.0 specification
│   ├── pact-v1.0.md
│   └── schemas/             # 10 standard domain schemas
├── packages/
│   ├── core/                # Schema, compression, envelope
│   ├── validator/           # Validation + conformance
│   ├── server/              # Express middleware
│   ├── client/              # AI agent SDK
│   ├── mcp-bridge/          # MCP integration
│   └── next-plugin/         # Next.js plugin
├── tools/
│   ├── llmstxt2pact/        # llms.txt converter
│   └── schema2pact/         # Schema.org converter
├── plugins/shopify/         # Shopify proxy
├── pact-python/             # Python SDK (84 tests)
├── examples/                # Commerce, restaurant, blog
├── demo/                    # Live comparison server
├── website/                 # Landing page + docs
│   ├── index.html / ko.html
│   ├── docs/ playground/ score/
│   └── .well-known/pact.json
└── docs/
    └── PACT_Project_Report.docx
```

## Security

All packages include security hardening:

- **Prototype pollution protection** — `isSafeKey()` guard in key compressor
- **GraphQL injection prevention** — Parameterized queries in Shopify plugin
- **SSRF protection** — URL protocol validation (http/https only) in client and MCP bridge
- **Cache TTL** — Discovery cache expires after 5 minutes (configurable)
- **Rate limiting** — Token bucket with RateLimit headers and stale entry cleanup

## Contributing

```bash
# Clone and install
git clone https://github.com/pact-protocol/pact
cd pact && npm install

# Build all packages
npm run build

# Run tests
npm test
cd pact-python && python3 -m unittest tests/test_core.py
```

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.

---

<div align="center">

*Created by a Biomedical Convergence Engineering (의생명융합공학부) student.*

*PACT fills the missing layer between web content and AI agents.*

**[Website](http://10.125.208.217:8788/)** · **[Live Demo](http://10.125.208.217:8790/)** · **[Spec](spec/pact-v1.0.md)** · **[한국어](http://10.125.208.217:8788/ko.html)**

</div>
