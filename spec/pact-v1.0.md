# PACT v1.0 Specification

**Protocol for Agent Content Transfer**

| Field        | Value                            |
|--------------|----------------------------------|
| Version      | 1.0                              |
| Status       | Draft                            |
| Date         | 2026-03-16                       |
| MIME Type    | `application/pact+json`          |
| Authors      | PACT Working Group               |

---

## Table of Contents

1. [Abstract](#1-abstract)
2. [Introduction](#2-introduction)
3. [Terminology](#3-terminology)
4. [Architecture Overview](#4-architecture-overview)
5. [Discovery Layer](#5-discovery-layer)
6. [Schema System](#6-schema-system)
7. [Data Layer](#7-data-layer)
8. [Media Layer](#8-media-layer)
9. [Actions Layer](#9-actions-layer)
10. [HTTP Transport](#10-http-transport)
11. [Conformance Levels](#11-conformance-levels)
12. [Cross-Platform Transport](#12-cross-platform-transport)
13. [Relationship to Existing Standards](#13-relationship-to-existing-standards)
14. [Security Considerations](#14-security-considerations)
15. [IANA Considerations](#15-iana-considerations)
16. [References](#16-references)
[Appendix A: Complete Examples](#appendix-a-complete-examples)

---

## 1. Abstract

PACT (Protocol for Agent Content Transfer) defines a standard mechanism for websites to serve structured, token-efficient content to AI agents. As large language models increasingly mediate access to web content on behalf of users, existing web standards -- designed for human-rendered browsers -- impose unnecessary overhead: verbose HTML markup, duplicated navigation chrome, ambiguous semantics, and unpredictable page structures.

PACT addresses this by providing a layered protocol that lets websites expose machine-optimized representations of their content through a well-defined discovery mechanism, a compact schema system, and a structured wire format. The protocol is designed to complement, not replace, existing web infrastructure. A PACT-enabled website continues to serve HTML to browsers while offering a parallel, token-efficient channel for AI agents.

This document specifies PACT version 1.0.

## 2. Introduction

### 2.1. Problem Statement

When an AI agent retrieves a typical web page to answer a user question, it receives kilobytes of HTML containing navigation bars, footers, advertisements, tracking scripts, and layout markup. The actual information content may occupy less than 5% of the transferred tokens. This inefficiency has real costs:

- **Token waste.** LLM context windows are finite. Every navigation link and CSS class name consumed is a token unavailable for reasoning.
- **Ambiguous structure.** HTML semantics are loose. Extracting a product price from a page requires heuristics that break across sites.
- **No action semantics.** A human can click "Add to Cart." An agent must reverse-engineer form submissions.
- **No bulk access.** Fetching 50 product listings means 50 HTTP requests for 50 full pages, when a single structured response would suffice.

### 2.2. Design Goals

PACT is designed around the following principles:

1. **Token efficiency.** Minimize the number of tokens required to convey structured information.
2. **Progressive complexity.** Sites can adopt PACT incrementally, from a simple discovery file to full schema-typed, compressed responses.
3. **Platform-agnostic.** Use standard HTTP and JSON. Works identically on websites, native apps, IoT devices, and any HTTP-capable endpoint.
4. **Layered content.** Separate data, media, and actions so agents can request only what they need.
5. **Schema interoperability.** Provide a schema system that maps cleanly to Schema.org and domain-specific vocabularies.
6. **Security by default.** Support rate limiting, authentication, and explicit capability declarations.

### 2.3. Scope

This specification defines:

- A discovery mechanism for PACT capabilities
- A schema identification and key compression system
- A wire format for structured data, media references, and actionable operations
- Content negotiation and HTTP transport conventions
- Conformance levels for incremental adoption

This specification does not define:

- Agent identity standards (deferred to future work)
- Domain-specific schemas (published separately)
- Client-side rendering or display behavior

## 3. Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119].

**Agent.** A software system, typically powered by a large language model, that retrieves and processes web content on behalf of a user.

**Provider.** A website, native application, IoT device, or any HTTP-capable service that implements the PACT protocol to serve structured content.

**Discovery Document.** The JSON file at `/.well-known/pact.json` that declares a provider's PACT capabilities.

**Schema.** A named, versioned definition of a content type's structure, defined via a `keys` object that maps compressed keys to their full names, types, and metadata.

**Envelope.** The top-level JSON structure of every PACT response, identified by the `$pact` key.

**Key Compression.** The practice of using abbreviated field names in PACT responses, mapped to full names in the associated schema.

**Layer.** One of the five architectural layers (Discovery, Schema, Data, Media, Actions) that compose the PACT protocol.

**Wire Format.** The JSON encoding used in PACT HTTP responses.

**Table Layout.** A columnar encoding for bulk data that separates column headers from row values to eliminate key repetition.

**Conformance Level.** One of four progressive tiers (L1 through L4) that define the depth of a provider's PACT implementation.

## 4. Architecture Overview

PACT is organized into five layers. Each layer builds on the ones below it, but providers MAY implement only the layers appropriate to their conformance level.

```
+-------------------------------------------------------+
|                  Layer 5: Actions                      |
|          (verb-URL-body patterns for mutations)        |
+-------------------------------------------------------+
|                  Layer 4: Media                        |
|          (URL pointers for images, video, etc.)        |
+-------------------------------------------------------+
|                  Layer 3: Data                         |
|          (structured JSON with key compression)        |
+-------------------------------------------------------+
|                  Layer 2: Schema                       |
|          (type definitions, key compression)            |
+-------------------------------------------------------+
|                  Layer 1: Discovery                    |
|          (/.well-known/pact.json)                      |
+-------------------------------------------------------+
```

### 4.1. Layer 1: Discovery

The foundation. A static JSON file at a well-known URL that declares a site's PACT capabilities, endpoints, rate limits, and authentication requirements. Every PACT-conformant provider MUST implement this layer.

### 4.2. Layer 2: Schema

A naming and typing system for content. Schemas define what fields a content type has, what their types are, and how they map to compressed keys. Schemas are identified by a URI of the form `pact:domain/type@version`.

### 4.3. Layer 3: Data

The wire format for structured content. Data is transmitted as JSON within a PACT envelope. For bulk responses, a table layout eliminates key repetition. Key compression reduces token count.

### 4.4. Layer 4: Media

Media assets (images, video, audio, documents) are not inlined. Instead, PACT responses include URL pointers that agents can selectively fetch. This keeps the primary data layer lightweight and lets agents decide which media to retrieve based on context.

### 4.5. Layer 5: Actions

Actionable operations that agents can perform, expressed as verb-URL-body patterns. Actions enable add-to-cart, booking, form submissions, and other mutations without requiring the agent to reverse-engineer HTML forms.

### 4.6. Layer Selection

Clients request specific layers using the `layers` query parameter:

```
GET /pact/products/123?layers=data,media
GET /pact/products/123?layers=data,actions
GET /pact/products/123?layers=data,media,actions
```

If the `layers` parameter is omitted, the provider SHOULD return all layers it supports for the requested resource.

## 5. Discovery Layer

### 5.1. Discovery Document Location

Every PACT-conformant provider MUST serve a discovery document at:

```
https://{host}/.well-known/pact.json
```

The document MUST be served with `Content-Type: application/json` and SHOULD be cacheable.

### 5.2. Discovery Document Structure

```json
{
  "pact": "1.0",
  "provider": {
    "name": "Acme Marketplace",
    "url": "https://acme.example.com",
    "contact": "api-support@acme.example.com"
  },
  "endpoints": [
    {
      "path": "/pact/products",
      "schema": "pact:commerce/product@1",
      "description": "Product catalog search and listing",
      "methods": ["GET"],
      "params": {
        "q": { "type": "string", "description": "Search query" },
        "category": { "type": "string", "description": "Category filter" },
        "sort": { "type": "string", "enum": ["price_asc", "price_desc", "relevance"] },
        "offset": { "type": "integer", "default": 0 },
        "limit": { "type": "integer", "default": 20, "max": 100 }
      }
    },
    {
      "path": "/pact/products/{id}",
      "schema": "pact:commerce/product@1",
      "description": "Single product detail",
      "methods": ["GET"],
      "layers": ["data", "media", "actions"]
    },
    {
      "path": "/pact/categories",
      "schema": "pact:commerce/category@1",
      "description": "Category tree",
      "methods": ["GET"]
    }
  ],
  "schemas": {
    "pact:commerce/product@1": {
      "url": "https://acme.example.com/pact/schemas/product-v1.json"
    },
    "pact:commerce/category@1": {
      "url": "https://acme.example.com/pact/schemas/category-v1.json"
    }
  },
  "auth": {
    "type": "api_key",
    "header": "X-Pact-Key",
    "registration": "https://acme.example.com/developer/register"
  },
  "rate_limit": {
    "requests_per_minute": 60,
    "requests_per_day": 10000,
    "burst": 10
  },
  "conformance": "L3"
}
```

### 5.3. Discovery Document Fields

#### 5.3.1. Top-Level Fields

| Field         | Type   | Required | Description                                          |
|---------------|--------|----------|------------------------------------------------------|
| `pact`        | string | REQUIRED | Protocol version. MUST be `"1.0"` for this spec.    |
| `provider`    | object | REQUIRED | Provider identification.                             |
| `endpoints`   | array  | REQUIRED | List of available PACT endpoints.                    |
| `schemas`     | object | OPTIONAL | Schema references, keyed by schema ID.               |
| `auth`        | object | OPTIONAL | Authentication requirements.                         |
| `rate_limit`  | object | OPTIONAL | Rate limiting parameters.                            |
| `conformance` | string | OPTIONAL | Declared conformance level (`L1`, `L2`, `L3`, `L4`).|

#### 5.3.2. Provider Object

| Field     | Type   | Required | Description                 |
|-----------|--------|----------|-----------------------------|
| `name`    | string | REQUIRED | Human-readable provider name. |
| `url`     | string | REQUIRED | Provider base URL.          |
| `contact` | string | OPTIONAL | Contact email or URL.       |

#### 5.3.3. Endpoint Object

| Field         | Type     | Required | Description                                      |
|---------------|----------|----------|--------------------------------------------------|
| `path`        | string   | REQUIRED | URL path, MAY include `{param}` templates.       |
| `schema`      | string   | OPTIONAL | Schema ID for response type.                     |
| `description` | string   | RECOMMENDED | Human-readable endpoint description.          |
| `methods`     | array    | OPTIONAL | Allowed HTTP methods. Default: `["GET"]`.        |
| `params`      | object   | OPTIONAL | Query parameter definitions.                     |
| `layers`      | array    | OPTIONAL | Supported layers: `"data"`, `"media"`, `"actions"`. |

#### 5.3.4. Auth Object

| Field          | Type   | Required | Description                                           |
|----------------|--------|----------|-------------------------------------------------------|
| `type`         | string | REQUIRED | One of: `"public"`, `"api_key"`, `"oauth2"`, `"agent_identity"`. |
| `header`       | string | OPTIONAL | Header name for API key auth.                         |
| `registration` | string | OPTIONAL | URL where agents can register for credentials.        |
| `oauth`        | object | OPTIONAL | OAuth 2.1 configuration (see Section 10.5).           |

#### 5.3.5. Rate Limit Object

| Field                 | Type    | Required | Description                          |
|-----------------------|---------|----------|--------------------------------------|
| `requests_per_minute` | integer | OPTIONAL | Maximum requests per minute.         |
| `requests_per_day`    | integer | OPTIONAL | Maximum requests per day.            |
| `burst`               | integer | OPTIONAL | Maximum burst request count.         |

## 6. Schema System

### 6.1. Schema Identification

Every PACT schema is identified by a URI of the form:

```
pact:{domain}/{type}@{version}
```

**Components:**

- `domain` -- A namespace grouping related types (e.g., `commerce`, `content`, `local`, `travel`).
- `type` -- The specific content type within the domain (e.g., `product`, `article`, `restaurant`).
- `version` -- An integer version number. Versions are monotonically increasing; higher versions supersede lower ones.

**Examples:**

```
pact:commerce/product@1
pact:commerce/offer@1
pact:content/article@2
pact:local/restaurant@1
pact:travel/flight@1
```

### 6.2. Schema Document Structure

A schema document defines the structure, types, and key compression for a content type. The `keys` object is the central element: each entry maps a compressed key to its full name, type, and metadata.

```json
{
  "$schema": "https://pact-protocol.org/schema/v1",
  "id": "pact:commerce/product@1",
  "description": "A product listing for e-commerce and marketplace contexts.",
  "keys": {
    "n":     { "full": "name",        "type": "string",  "required": true },
    "p":     { "full": "price",       "type": "number",  "required": true },
    "cur":   { "full": "currency",    "type": "string",  "default": "USD" },
    "img":   { "full": "image",       "type": "url",     "layer": "media" },
    "url":   { "full": "buy_url",     "type": "url",     "layer": "action" },
    "m":     { "full": "merchant",    "type": "string" },
    "r":     { "full": "rating",      "type": "number",  "range": [0, 5] },
    "rv":    { "full": "reviews",     "type": "integer" },
    "s":     { "full": "shipping",    "type": "string" },
    "stk":   { "full": "in_stock",    "type": "boolean" },
    "disc":  { "full": "discount",    "type": "number" },
    "brand": { "full": "brand",       "type": "string" },
    "spec":  { "full": "specs",       "type": "object" },
    "cat":   { "full": "category",    "type": "string" },
    "desc":  { "full": "description", "type": "string" },
    "sku":   { "full": "sku",         "type": "string" }
  }
}
```

Each key entry in the `keys` object has the following properties:

| Property   | Type     | Required | Description                                      |
|------------|----------|----------|--------------------------------------------------|
| `full`     | string   | REQUIRED | The canonical (uncompressed) field name.          |
| `type`     | string   | REQUIRED | Data type: `string`, `number`, `integer`, `boolean`, `url`, `object`, `array`. |
| `required` | boolean  | OPTIONAL | Whether the field is required. Default: `false`.  |
| `layer`    | string   | OPTIONAL | Associated layer: `"media"` or `"action"`.        |
| `default`  | any      | OPTIONAL | Default value when omitted.                       |
| `range`    | array    | OPTIONAL | `[min, max]` for numeric types.                   |

### 6.3. Key Compression

Key compression is the primary mechanism for reducing token count in PACT responses. Instead of transmitting full field names, providers use abbreviated keys defined in the schema's `keys` object.

**Rules:**

1. The `keys` object maps compressed keys (short) to key definitions that include the canonical field name (`full`), type, and metadata.
2. Compressed keys SHOULD be 1-4 characters.
3. Compressed keys MUST be unique within a schema.
4. The mapping between compressed keys and `full` names MUST be invertible (one-to-one).
5. Agents dereference compressed keys using the schema. If an agent has not fetched the schema, it MAY request uncompressed responses (see Section 10.2).

**Compression example:**

Uncompressed (162 tokens approx.):
```json
{
  "name": "Wireless Headphones",
  "price": 49900,
  "currency": "KRW",
  "availability": "in_stock",
  "rating": 4.5,
  "review_count": 2847
}
```

Compressed (118 tokens approx.):
```json
{
  "n": "Wireless Headphones",
  "p": 49900,
  "cur": "KRW",
  "avail": "in_stock",
  "rat": 4.5,
  "rev": 2847
}
```

### 6.4. Reserved Keys

The following key prefixes and names are reserved by the PACT protocol and MUST NOT be used as field names in schemas:

| Key        | Purpose                                                     |
|------------|-------------------------------------------------------------|
| `$pact`    | Protocol version identifier in the response envelope.       |
| `$s`       | Schema ID reference.                                        |
| `$t`       | Content type hint (when schema is not used).                |
| `$ttl`     | Cache time-to-live in seconds.                              |
| `$layers`  | Declares which layers are present in the response.          |
| `$layout`  | Declares the data layout format (`"object"` or `"table"`).  |

Any key beginning with `$` (U+0024 DOLLAR SIGN) is reserved for protocol use. Providers MUST NOT define schema fields with names beginning with `$`.

### 6.5. Schema Versioning

Schemas are versioned with integer version numbers appended after `@`. Version changes follow these rules:

- **Additive changes** (new optional fields) -- SHOULD increment the version.
- **Breaking changes** (removed fields, type changes, renamed required fields) -- MUST increment the version.
- Providers SHOULD support at least the current and immediately previous version simultaneously.
- Agents SHOULD specify the desired schema version; if omitted, the provider SHOULD respond with the latest version.

### 6.6. Standard Domains

The following domains are defined in PACT v1.0. Additional custom domains MAY be used; providers are not limited to this list.

| Domain       | Description                          | Example Types                    |
|--------------|--------------------------------------|----------------------------------|
| `commerce`   | Products, prices, offers, orders     | `product`, `offer`, `cart`       |
| `news`       | Articles, blog posts, breaking news  | `article`, `headline`, `feed`    |
| `food`       | Restaurants, menus, recipes          | `restaurant`, `menu`, `recipe`   |
| `realestate` | Property listings, agents            | `listing`, `agent`, `building`   |
| `travel`     | Flights, hotels, itineraries         | `hotel`, `flight`, `booking`     |
| `events`     | Concerts, conferences, meetups       | `event`, `ticket`, `venue`       |
| `local`      | Local businesses, services           | `business`, `service`, `review`  |
| `media`      | Videos, podcasts, streams            | `video`, `podcast`, `channel`    |
| `education`  | Courses, programs, certifications    | `course`, `program`, `cert`      |
| `jobs`       | Job postings, career listings        | `posting`, `company`, `salary`   |
| `finance`    | Market data, exchange rates          | `stock`, `rate`, `ticker`        |
| `health`     | Provider directories, facility info  | `provider`, `facility`           |

## 7. Data Layer

### 7.1. Wire Format

All PACT responses MUST be valid JSON. The top-level structure is the PACT envelope.

### 7.2. Envelope Structure

Every PACT response is wrapped in an envelope that provides protocol metadata.

#### 7.2.1. Single-Object Response

```json
{
  "$pact": "1.0",
  "$s": "pact:commerce/product@1",
  "$ttl": 300,
  "$layers": ["data", "media"],
  "data": {
    "id": "prod-8834",
    "n": "Samsung Galaxy Buds3 Pro",
    "p": 259000,
    "cur": "KRW",
    "desc": "AI-powered noise cancellation with adaptive EQ.",
    "cat": "Electronics > Audio > Earbuds",
    "brand": "Samsung",
    "avail": "in_stock",
    "rat": 4.6,
    "rev": 3241,
    "url": "https://acme.example.com/products/prod-8834"
  },
  "media": {
    "img": "https://cdn.acme.example.com/products/8834/main.webp",
    "imgs": [
      "https://cdn.acme.example.com/products/8834/side.webp",
      "https://cdn.acme.example.com/products/8834/case.webp"
    ]
  }
}
```

#### 7.2.2. Envelope Fields

| Field      | Type   | Required | Description                                            |
|------------|--------|----------|--------------------------------------------------------|
| `$pact`    | string | REQUIRED | Protocol version. MUST be `"1.0"`.                    |
| `$s`       | string | OPTIONAL | Schema ID for the response data.                       |
| `$t`       | string | OPTIONAL | Content type hint if no schema is used.                |
| `$ttl`     | integer| OPTIONAL | Suggested cache duration in seconds.                   |
| `$layers`  | array  | OPTIONAL | Layers present in this response.                       |
| `$layout`  | string | OPTIONAL | Data layout: `"object"` (default) or `"table"`.       |
| `data`     | object or array | REQUIRED | The primary content payload.                  |
| `media`    | object | OPTIONAL | Media references (see Section 8).                      |
| `actions`  | array  | OPTIONAL | Available actions (see Section 9).                     |
| `pagination` | object | OPTIONAL | Pagination metadata for list responses.              |
| `meta`     | object | OPTIONAL | Additional provider metadata.                          |

### 7.3. List Response

When an endpoint returns multiple items, the `data` field contains an array:

```json
{
  "$pact": "1.0",
  "$s": "pact:commerce/product@1",
  "$ttl": 60,
  "$layers": ["data"],
  "$layout": "object",
  "data": [
    {
      "id": "prod-8834",
      "n": "Samsung Galaxy Buds3 Pro",
      "p": 259000,
      "cur": "KRW",
      "avail": "in_stock",
      "rat": 4.6
    },
    {
      "id": "prod-9921",
      "n": "Sony WF-1000XM6",
      "p": 289000,
      "cur": "KRW",
      "avail": "in_stock",
      "rat": 4.7
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 20,
    "total": 147,
    "next": "/pact/products?q=earbuds&offset=20&limit=20"
  }
}
```

### 7.4. Table Layout

For bulk data responses, the table layout eliminates key repetition by separating column headers from row values. This provides significant token savings when returning many items with the same fields.

#### 7.4.1. Table Structure

```json
{
  "$pact": "1.0",
  "$s": "pact:commerce/product@1",
  "$ttl": 60,
  "$layers": ["data"],
  "$layout": "table",
  "data": {
    "cols": ["id", "n", "p", "cur", "avail", "rat", "rev"],
    "rows": [
      ["prod-8834", "Samsung Galaxy Buds3 Pro", 259000, "KRW", "in_stock", 4.6, 3241],
      ["prod-9921", "Sony WF-1000XM6", 289000, "KRW", "in_stock", 4.7, 5102],
      ["prod-7710", "Apple AirPods Pro 3", 329000, "KRW", "in_stock", 4.8, 8744],
      ["prod-6628", "Jabra Elite 10 Gen 2", 279000, "KRW", "limited", 4.4, 1893],
      ["prod-5501", "Bose QC Ultra Earbuds", 299000, "KRW", "in_stock", 4.5, 4210]
    ]
  },
  "pagination": {
    "offset": 0,
    "limit": 20,
    "total": 147,
    "next": "/pact/products?q=earbuds&offset=20&limit=20"
  }
}
```

#### 7.4.2. Table Layout Rules

1. `$layout` MUST be set to `"table"` when table layout is used.
2. `data.cols` MUST be an array of strings, each being a field key (compressed or uncompressed).
3. `data.rows` MUST be an array of arrays. Each inner array MUST have the same length as `cols`.
4. Values in each row are positionally mapped to the column at the same index.
5. A `null` value in a row indicates that the field is absent for that item.
6. Providers SHOULD use table layout when returning 5 or more items with a uniform schema.

#### 7.4.3. Token Efficiency Comparison

For 50 products with 7 fields each:

| Layout  | Approximate Keys Transmitted | Savings |
|---------|------------------------------|---------|
| Object  | 350 (7 keys x 50 objects)    | --      |
| Table   | 7 (column headers only)      | ~98%    |

### 7.5. Pagination

List endpoints MUST support pagination using the following parameters:

#### 7.5.1. Request Parameters

| Parameter | Type    | Default | Description                        |
|-----------|---------|---------|------------------------------------|
| `offset`  | integer | 0       | Number of items to skip.           |
| `limit`   | integer | 20      | Maximum number of items to return. |

#### 7.5.2. Response Object

The `pagination` object in the response envelope:

| Field    | Type    | Required | Description                                       |
|----------|---------|----------|---------------------------------------------------|
| `offset` | integer | REQUIRED | Current offset.                                   |
| `limit`  | integer | REQUIRED | Current limit.                                    |
| `total`  | integer | OPTIONAL | Total number of items available.                  |
| `next`   | string  | OPTIONAL | Relative URL for the next page. Null if last page.|

Agents SHOULD follow the `next` URL rather than computing offsets manually, as providers MAY use cursor-based pagination internally while exposing the offset/limit interface.

## 8. Media Layer

### 8.1. Design Principle

PACT treats media as a separate layer from structured data. Media assets are never inlined (no base64, no data URIs). Instead, PACT responses include URL pointers that agents can selectively dereference.

This separation exists because:

1. Most agent interactions do not require media at all.
2. When media is needed, the agent (or its host application) can fetch it through a separate channel optimized for binary transfer.
3. Token budgets are preserved for structured data and reasoning.

### 8.2. Media Object Structure

The `media` object in a PACT envelope contains keyed URL references:

```json
{
  "media": {
    "img": "https://cdn.example.com/products/8834/main.webp",
    "imgs": [
      "https://cdn.example.com/products/8834/angle1.webp",
      "https://cdn.example.com/products/8834/angle2.webp",
      "https://cdn.example.com/products/8834/detail.webp"
    ],
    "video": "https://cdn.example.com/products/8834/demo.mp4",
    "docs": [
      {
        "url": "https://cdn.example.com/products/8834/manual.pdf",
        "type": "application/pdf",
        "title": "User Manual",
        "size": 2048576
      }
    ]
  }
}
```

### 8.3. Media Reference Formats

Media references may take two forms:

**Simple URL string:**
```json
"img": "https://cdn.example.com/photo.webp"
```

**Annotated media object:**
```json
"img": {
  "url": "https://cdn.example.com/photo.webp",
  "type": "image/webp",
  "width": 800,
  "height": 600,
  "size": 45200,
  "alt": "Product front view"
}
```

Providers SHOULD use simple URL strings when media metadata is not important. Annotated objects SHOULD be used when the agent needs to make informed decisions about which media to fetch (e.g., selecting an appropriate image size).

### 8.4. Media in Table Layout

When table layout is used and the `media` layer is requested, media references are included in a parallel structure:

```json
{
  "$pact": "1.0",
  "$s": "pact:commerce/product@1",
  "$layout": "table",
  "$layers": ["data", "media"],
  "data": {
    "cols": ["id", "n", "p", "cur"],
    "rows": [
      ["prod-8834", "Samsung Galaxy Buds3 Pro", 259000, "KRW"],
      ["prod-9921", "Sony WF-1000XM6", 289000, "KRW"]
    ]
  },
  "media": [
    { "img": "https://cdn.example.com/8834/main.webp" },
    { "img": "https://cdn.example.com/9921/main.webp" }
  ]
}
```

When `media` is an array, each element corresponds positionally to the row at the same index in `data.rows`.

## 9. Actions Layer

### 9.1. Purpose

The Actions layer enables agents to perform operations on behalf of users without reverse-engineering HTML forms, JavaScript event handlers, or API endpoints. Actions are declared as structured verb-URL-body patterns.

### 9.2. Action Object Structure

```json
{
  "actions": [
    {
      "verb": "POST",
      "name": "add_to_cart",
      "description": "Add this product to the shopping cart",
      "url": "/pact/cart/items",
      "body": {
        "product_id": "{id}",
        "quantity": 1
      },
      "auth_required": true
    },
    {
      "verb": "POST",
      "name": "set_price_alert",
      "description": "Receive notification when price drops below target",
      "url": "/pact/alerts",
      "body": {
        "product_id": "{id}",
        "target_price": null,
        "channel": "email"
      },
      "auth_required": true
    },
    {
      "verb": "GET",
      "name": "check_store_stock",
      "description": "Check availability at a specific store location",
      "url": "/pact/products/{id}/stock?store={store_id}",
      "auth_required": false
    }
  ]
}
```

### 9.3. Action Object Fields

| Field            | Type    | Required | Description                                       |
|------------------|---------|----------|---------------------------------------------------|
| `verb`           | string  | REQUIRED | HTTP method: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. |
| `name`           | string  | REQUIRED | Machine-readable action identifier.               |
| `description`    | string  | REQUIRED | Human-readable description for the agent.         |
| `url`            | string  | REQUIRED | Target URL. MAY include `{param}` placeholders.   |
| `body`           | object  | OPTIONAL | Request body template. Required for POST/PUT/PATCH.|
| `auth_required`  | boolean | OPTIONAL | Whether authentication is needed. Default: `false`.|
| `params`         | object  | OPTIONAL | Parameter definitions for URL placeholders.       |
| `confirmation`   | string  | OPTIONAL | Message to present to user before executing.      |

### 9.4. Action Body Templates

Body templates use `{field}` placeholders that reference fields from the data layer:

```json
{
  "body": {
    "product_id": "{id}",
    "quantity": 1
  }
}
```

- `{id}` is resolved from the `data` object's `id` field.
- Literal values (like `1`) are used as-is.
- `null` values indicate fields the agent must fill based on user intent.

### 9.5. Action Response

When an agent invokes an action, the provider SHOULD respond with a PACT envelope:

```json
{
  "$pact": "1.0",
  "$t": "action_result",
  "data": {
    "status": "success",
    "message": "Product added to cart.",
    "cart": {
      "item_count": 3,
      "total": 827000,
      "cur": "KRW"
    }
  },
  "actions": [
    {
      "verb": "GET",
      "name": "view_cart",
      "description": "View current cart contents",
      "url": "/pact/cart"
    },
    {
      "verb": "POST",
      "name": "checkout",
      "description": "Proceed to checkout",
      "url": "/pact/checkout",
      "auth_required": true
    }
  ]
}
```

Action responses MAY include follow-up actions, enabling multi-step workflows.

### 9.6. Safety Requirements

1. Actions that modify state (POST, PUT, PATCH, DELETE) SHOULD include a `confirmation` field.
2. Actions involving financial transactions MUST require authentication.
3. Providers MUST NOT define actions that circumvent their own security controls.
4. Agents SHOULD present the `confirmation` message to users before executing state-modifying actions.

## 10. HTTP Transport

### 10.1. Content Negotiation

PACT uses standard HTTP content negotiation. Agents request PACT responses using the `Accept` header:

```http
GET /products/8834 HTTP/1.1
Host: acme.example.com
Accept: application/pact+json
```

If the provider supports PACT for the requested resource, it responds with:

```http
HTTP/1.1 200 OK
Content-Type: application/pact+json; charset=utf-8
```

If the provider does not support PACT for the requested resource, it SHOULD respond with standard HTML (or its default format) rather than an error, enabling graceful fallback.

### 10.2. Dedicated Endpoints

Providers MAY offer dedicated PACT endpoints under a `/pact/` path prefix. This approach avoids content negotiation complexity and makes PACT endpoints independently cacheable.

```
/pact/products          -- product listing
/pact/products/{id}     -- single product
/pact/categories        -- category tree
/pact/cart              -- current cart
```

When both content negotiation and dedicated endpoints are available, they MUST return equivalent data.

### 10.3. Query Parameters

#### 10.3.1. Layer Selection

The `layers` parameter controls which layers are included in the response:

```
GET /pact/products/8834?layers=data
GET /pact/products/8834?layers=data,media
GET /pact/products/8834?layers=data,media,actions
```

Valid layer values: `data`, `media`, `actions`.

If `layers` is omitted, the provider SHOULD return all supported layers.

#### 10.3.2. Key Compression Control

The `compress` parameter controls key compression:

```
GET /pact/products/8834?compress=true     -- compressed keys (default)
GET /pact/products/8834?compress=false    -- full field names
```

Default behavior when `compress` is omitted is provider-defined. Providers declaring L3 conformance SHOULD default to compressed keys.

### 10.4. Caching

#### 10.4.1. Response Caching

Providers SHOULD set appropriate HTTP cache headers:

```http
HTTP/1.1 200 OK
Content-Type: application/pact+json
Cache-Control: public, max-age=300
ETag: "a1b2c3d4"
Vary: Accept
```

The `$ttl` field in the envelope is a hint to agent-level caches that MAY differ from HTTP cache headers. When both are present, agents SHOULD use the shorter duration.

#### 10.4.2. Schema Caching

Schema documents are typically stable and SHOULD be aggressively cached:

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: public, max-age=86400
```

Agents SHOULD cache schema documents and refresh them no more than once per day unless a response references an unknown schema version.

### 10.5. Authentication

PACT defines four authentication levels, in increasing order of trust:

#### 10.5.1. Level 0: Public

No authentication required. The provider serves PACT responses to any agent.

```json
{
  "auth": {
    "type": "public"
  }
}
```

#### 10.5.2. Level 1: API Key

The agent presents a static API key via a designated header:

```http
GET /pact/products HTTP/1.1
X-Pact-Key: pk_live_abc123def456
```

Discovery document declaration:

```json
{
  "auth": {
    "type": "api_key",
    "header": "X-Pact-Key",
    "registration": "https://acme.example.com/developer/register"
  }
}
```

#### 10.5.3. Level 2: OAuth 2.1

For actions that operate on user data (e.g., adding to a user's cart), providers SHOULD use OAuth 2.1 with PKCE.

```json
{
  "auth": {
    "type": "oauth2",
    "oauth": {
      "authorization_endpoint": "https://auth.acme.example.com/authorize",
      "token_endpoint": "https://auth.acme.example.com/token",
      "scopes": ["read:products", "write:cart", "read:orders"],
      "grant_types": ["authorization_code"],
      "pkce_required": true
    }
  }
}
```

#### 10.5.4. Level 3: Agent Identity

A future mechanism for cryptographically verified agent identity. Reserved for PACT v1.1 and beyond. Providers declaring this auth type indicate readiness for agent identity verification when standards emerge.

```json
{
  "auth": {
    "type": "agent_identity",
    "identity_spec": "https://pact-protocol.org/identity/v1"
  }
}
```

### 10.6. Rate Limiting

#### 10.6.1. Discovery Declaration

Rate limits are declared in the discovery document (see Section 5.3.5).

#### 10.6.2. Response Headers

Providers MUST communicate rate limit state via response headers, following the IETF RateLimit header fields draft:

```http
HTTP/1.1 200 OK
RateLimit-Limit: 60
RateLimit-Remaining: 42
RateLimit-Reset: 18
```

| Header              | Description                                         |
|---------------------|-----------------------------------------------------|
| `RateLimit-Limit`   | Maximum requests in the current window.             |
| `RateLimit-Remaining` | Remaining requests in the current window.         |
| `RateLimit-Reset`   | Seconds until the window resets.                    |

#### 10.6.3. Rate Limit Exceeded

When rate limits are exceeded, the provider MUST respond with `429 Too Many Requests` and SHOULD include a PACT envelope:

```json
{
  "$pact": "1.0",
  "$t": "error",
  "data": {
    "status": 429,
    "message": "Rate limit exceeded. Try again in 18 seconds.",
    "retry_after": 18
  }
}
```

### 10.7. Error Responses

PACT error responses use standard HTTP status codes and a PACT envelope:

```json
{
  "$pact": "1.0",
  "$t": "error",
  "data": {
    "status": 404,
    "message": "Product not found.",
    "code": "PRODUCT_NOT_FOUND"
  }
}
```

Error response fields:

| Field     | Type    | Required | Description                            |
|-----------|---------|----------|----------------------------------------|
| `status`  | integer | REQUIRED | HTTP status code.                      |
| `message` | string  | REQUIRED | Human-readable error description.      |
| `code`    | string  | OPTIONAL | Machine-readable error code.           |
| `detail`  | string  | OPTIONAL | Additional error context.              |

## 11. Conformance Levels

PACT defines four conformance levels that allow providers to adopt the protocol incrementally. Each level subsumes all requirements of the levels below it.

### 11.1. Level 1: Discoverable (L1)

**Requirements:**

- MUST serve a valid discovery document at `/.well-known/pact.json`.
- MUST declare at least one endpoint.
- MUST specify the PACT version as `"1.0"`.

**Purpose:** Lets agents discover that a site supports PACT and learn what endpoints are available. Even without structured responses, discovery enables agent tool registries to catalog PACT-ready sites.

**Minimal example:**

```json
{
  "pact": "1.0",
  "provider": {
    "name": "Acme Blog",
    "url": "https://blog.acme.example.com"
  },
  "endpoints": [
    {
      "path": "/pact/posts",
      "description": "Blog post listing"
    }
  ]
}
```

### 11.2. Level 2: Typed (L2)

**Requirements (in addition to L1):**

- MUST reference at least one schema (standard or custom) in the discovery document.
- MUST return PACT envelope responses with `$pact` and `$s` fields.
- MUST serve schema documents at the declared URLs.
- Data MUST conform to the referenced schema.

**Purpose:** Enables agents to understand the structure and semantics of response data without heuristics.

### 11.3. Level 3: Efficient (L3)

**Requirements (in addition to L2):**

- MUST support key compression via schema `keys` definitions.
- MUST support table layout for list endpoints returning 5 or more items.
- MUST support the `layers` query parameter.
- MUST support pagination with `offset`/`limit` parameters.
- SHOULD set `$ttl` and HTTP cache headers.
- MUST return `Content-Type: application/pact+json`.

**Purpose:** Maximizes token efficiency. This is the target level for most production deployments.

### 11.4. Level 4: Trusted (L4)

**Requirements (in addition to L3):**

- MUST support at least API Key authentication.
- MUST implement rate limiting with RateLimit response headers.
- MUST support the Actions layer with at least one state-modifying action.
- MUST support HTTPS exclusively (no plain HTTP).
- SHOULD support OAuth 2.1 for user-scoped operations.

**Purpose:** Enables full transactional interaction between agents and providers.

### 11.5. Conformance Declaration

Providers declare their conformance level in the discovery document:

```json
{
  "conformance": "L3"
}
```

Agents MAY use the conformance level to set expectations about provider capabilities without probing each feature individually.

## 12. Cross-Platform Transport

PACT is not web-only. Any platform that speaks HTTP and JSON can be a PACT provider. This section defines how PACT applies beyond traditional websites.

### 12.1. Native Mobile Applications

Native iOS and Android applications MAY serve PACT endpoints through embedded HTTP servers or through their backend APIs.

**Discovery via App Links.** Applications declare PACT support in their associated domain's `/.well-known/pact.json`. The discovery document includes a `platforms` field:

```json
{
  "pact": "1.0",
  "provider": {
    "name": "Seoul Eats",
    "url": "https://seoleats.example.com"
  },
  "platforms": {
    "web": {
      "base_url": "https://seoleats.example.com"
    },
    "ios": {
      "bundle_id": "com.seoleats.app",
      "universal_link": "https://seoleats.example.com",
      "app_store": "https://apps.apple.com/app/id123456789",
      "min_version": "3.0"
    },
    "android": {
      "package": "com.seoleats.app",
      "app_link": "https://seoleats.example.com",
      "play_store": "https://play.google.com/store/apps/details?id=com.seoleats.app",
      "min_version": "3.0"
    }
  },
  "endpoints": [...]
}
```

**How it works:**

1. The PACT data endpoints live on the backend server — the same API that the native app already uses.
2. The `platforms` field tells agents how to direct users to the native app when an action requires user interaction (e.g., payment, login).
3. Actions in the Actions layer include platform-specific URLs:

```json
{
  "verb": "GET",
  "name": "purchase",
  "url": "https://seoleats.example.com/order/rest-4420",
  "platforms": {
    "ios": "https://seoleats.example.com/order/rest-4420",
    "android": "https://seoleats.example.com/order/rest-4420",
    "ios_fallback": "seoleats://order/rest-4420",
    "android_fallback": "intent://order/rest-4420#Intent;scheme=seoleats;package=com.seoleats.app;end"
  }
}
```

4. When the agent's host environment is a mobile app, it SHOULD prefer the platform-specific URL. When the host is a web browser or headless agent, it SHOULD use the standard `url`.

**Rationale:** The user's experience stays native. The AI agent fetches structured data via PACT (same endpoint, same format regardless of platform), but when the user needs to take action (buy, book, sign in), they are directed to the appropriate native interface.

### 12.2. Backend-to-Backend PACT

PACT endpoints do not require a user-facing frontend. A pure API service MAY implement PACT:

```json
{
  "pact": "1.0",
  "provider": {
    "name": "National Weather Service",
    "url": "https://api.weather.example.gov"
  },
  "platforms": {
    "api": {
      "base_url": "https://api.weather.example.gov",
      "docs": "https://api.weather.example.gov/docs"
    }
  },
  "endpoints": [...]
}
```

This enables AI agents to discover and consume structured data from services that have no traditional web presence.

### 12.3. IoT and Edge Devices

IoT devices with HTTP capability MAY serve PACT locally on the network:

- **Discovery:** Devices advertise via mDNS as `_pact._tcp` and serve `/.well-known/pact.json` on their local HTTP endpoint.
- **Schemas:** Devices use standard or custom schemas to expose state (e.g., `pact:iot/sensor@1`, `pact:iot/actuator@1`).
- **Actions:** Device control exposed through the Actions layer (e.g., turn on/off, set temperature).
- **Security:** Local devices SHOULD use mTLS or shared-secret authentication. Devices exposed to the internet MUST use HTTPS.

```json
{
  "pact": "1.0",
  "provider": {
    "name": "Living Room Thermostat",
    "url": "https://thermostat.local"
  },
  "platforms": {
    "iot": {
      "protocol": "http",
      "mdns": "_pact._tcp",
      "local_ip": "192.168.1.42",
      "port": 8080
    }
  },
  "endpoints": [
    {
      "path": "/pact/status",
      "schema": "pact:iot/thermostat@1",
      "methods": ["GET"],
      "layers": ["data", "actions"]
    }
  ]
}
```

### 12.4. Offline and Static PACT

PACT data can be served without a live server:

- **Static files:** A `.pact.json` file following the PACT envelope format can be hosted on any static file server, CDN, or included in application bundles.
- **QR codes:** Small PACT payloads (under 2KB) MAY be encoded as QR codes for offline scanning. The QR content is a URL pointing to a static PACT file, or for very small payloads, the PACT JSON itself with the prefix `pact:`.
- **App bundles:** Mobile apps MAY include `.pact.json` files in their assets for offline access to cached PACT data.

### 12.5. Platform-Agnostic Actions

When an action URL needs to work across platforms, providers SHOULD use the `platforms` extension on individual actions:

```json
{
  "verb": "POST",
  "name": "book",
  "url": "https://api.example.com/pact/reservations",
  "body": {"restaurant_id": "string", "date": "string", "party_size": "integer"},
  "platforms": {
    "web": "https://example.com/book?id={restaurant_id}",
    "ios": "https://example.com/book?id={restaurant_id}",
    "android": "https://example.com/book?id={restaurant_id}",
    "ios_fallback": "exampleapp://book/{restaurant_id}",
    "android_fallback": "intent://book/{restaurant_id}#Intent;scheme=exampleapp;package=com.example.app;end"
  }
}
```

**Resolution rules:**

1. For API-level actions (add to cart, create reservation), the agent calls the standard `url` directly — no platform difference.
2. For user-facing actions (payment confirmation, login), the agent uses the `platforms` field matching the current host environment.
3. If no `platforms` field exists, the agent uses the standard `url` for all platforms.
4. The `platforms` field is OPTIONAL. It only matters for actions that open a user interface.

### 12.6. The `platforms` Discovery Field

The `platforms` field in the discovery document is OPTIONAL. Its presence indicates that the provider has platform-specific considerations. Structure:

| Key | Description |
|-----|-------------|
| `web` | Standard website access point |
| `ios` | iOS app with Universal Links (HTTPS URLs intercepted by the app) |
| `android` | Android app with App Links (HTTPS URLs verified via Digital Asset Links) |
| `desktop` | Desktop app (Electron, native macOS/Windows/Linux) |
| `api` | Headless API (no frontend) |
| `iot` | IoT device endpoint |
| `{platform}_fallback` | Custom URI scheme fallback when Universal/App Links are unavailable |

Each platform object MAY contain:

| Field | Type | Description |
|-------|------|-------------|
| `base_url` | string | Primary access URL for this platform |
| `bundle_id` / `package` | string | App identifier |
| `universal_link` / `app_link` | string | Deep link domain |
| `app_store` / `play_store` | string | Store listing URL |
| `min_version` | string | Minimum app version for PACT support |
| `docs` | string | Platform-specific documentation |
| `protocol` | string | Transport protocol (http, https) |

**Key principle:** PACT data is platform-agnostic. The same `GET /pact/restaurants?q=korean` returns identical JSON whether called from a web agent, a mobile app agent, or an IoT hub. The `platforms` field only affects how users are directed to take action.

## 13. Relationship to Existing Standards

PACT is designed to complement, not replace, existing web and AI standards. This section clarifies how PACT relates to each.

### 13.1. robots.txt

`robots.txt` controls crawler access at the path level. PACT respects `robots.txt`:

- Agents MUST honor `robots.txt` directives for the user-agent `PACTAgent` (or `*` if no specific directive exists).
- A `Disallow` in `robots.txt` takes precedence over PACT endpoint declarations.
- Providers SHOULD add a `PACTAgent` directive to `robots.txt` if they want differentiated access control.

```
User-agent: PACTAgent
Allow: /pact/
Disallow: /admin/
```

### 13.2. Schema.org

PACT schemas can map to Schema.org types via the `schemaOrg` field in schema documents:

```json
{
  "$id": "pact:commerce/product@1",
  "schemaOrg": "https://schema.org/Product"
}
```

This mapping enables agents to bridge PACT data with Schema.org-annotated HTML on the same site. PACT does not require Schema.org but encourages interoperability.

### 13.3. Model Context Protocol (MCP)

MCP defines how an AI model interacts with tool servers via a client-server protocol. PACT and MCP operate at different layers:

- **MCP** defines the interface between an agent and its tool runtime.
- **PACT** defines the interface between a website and any agent (or tool) that fetches content from it.

A PACT client can be implemented as an MCP tool, bridging the two protocols. The `packages/mcp-bridge` component in this project demonstrates this pattern.

### 13.4. Agent-to-Agent Protocol (A2A)

Google's A2A protocol defines inter-agent communication. PACT is not an agent-to-agent protocol; it is an agent-to-website protocol. The two are complementary: an agent might use A2A to delegate a task to another agent, which then uses PACT to fetch content from a website.

### 13.5. llms.txt

`llms.txt` (proposed by various parties) provides a plain-text summary of a site's content for LLM consumption. PACT supersedes `llms.txt` for structured data use cases but acknowledges that `llms.txt` may be simpler for sites offering primarily unstructured prose content.

Providers MAY offer both `llms.txt` (for general site description) and PACT (for structured data endpoints).

### 13.6. OpenAPI / Swagger

OpenAPI describes REST API structure. PACT discovery documents serve a similar role for PACT endpoints but are simpler and purpose-built for agent consumption. Providers with existing OpenAPI specs MAY generate PACT discovery documents from them using the `tools/schema2pact` converter.

### 13.7. JSON-LD / Linked Data

JSON-LD embeds structured data in HTML. PACT is a separate channel optimized for machine consumption. Providers can maintain JSON-LD in their HTML (for search engines) alongside PACT endpoints (for agents) without conflict.

## 14. Security Considerations

### 14.1. Transport Security

All PACT endpoints at L4 conformance MUST use HTTPS. Providers at lower conformance levels SHOULD use HTTPS. Agents SHOULD refuse plaintext HTTP connections to PACT endpoints unless explicitly configured otherwise.

### 14.2. Agent Authentication

Providers SHOULD authenticate agents to:

1. Enforce rate limits per agent.
2. Audit access patterns.
3. Revoke access to misbehaving agents.

API keys provide basic identification. OAuth 2.1 provides user-scoped access control. Future agent identity standards will enable cryptographic verification.

### 14.3. Data Exposure

PACT endpoints make structured data easily extractable. Providers MUST ensure that PACT endpoints do not expose data beyond what is available on the public website. Sensitive data (user PII, internal pricing, wholesale costs) MUST NOT appear in public PACT responses.

### 14.4. Action Safety

Actions that modify state carry inherent risk. Providers MUST:

1. Validate all action inputs server-side.
2. Apply the same authorization checks as their web/API interfaces.
3. Rate-limit state-modifying actions separately from read operations.
4. Include `confirmation` messages for irreversible operations.

### 14.5. Injection Attacks

Agents process PACT data and may incorporate it into LLM prompts. Providers MUST NOT include prompt injection attempts in PACT response data. Agents SHOULD sanitize PACT data before incorporating it into prompts, treating it as untrusted input.

### 14.6. Denial of Service

The table layout and bulk data features could be used to generate very large responses. Providers SHOULD:

1. Enforce maximum `limit` values (declared in endpoint params).
2. Set maximum response sizes.
3. Use pagination for large datasets.

### 14.7. Schema Integrity

Agents cache schemas and use them to interpret responses. Compromised schema URLs could lead to data misinterpretation. Providers SHOULD:

1. Serve schemas from the same origin as the discovery document.
2. Use HTTPS for schema URLs.
3. Consider signing schema documents in high-security environments.

## 15. IANA Considerations

### 15.1. MIME Type Registration

This specification requests registration of the following media type:

**Type name:** application

**Subtype name:** pact+json

**Required parameters:** None

**Optional parameters:**

- `charset` -- If specified, MUST be `utf-8`. JSON text in PACT MUST be encoded in UTF-8.
- `version` -- The PACT protocol version (e.g., `1.0`).
- `schema` -- The PACT schema ID of the response content (e.g., `pact:commerce/product@1`).

**Encoding considerations:** 8bit. PACT documents are JSON text encoded in UTF-8.

**Security considerations:** See Section 14 of this specification.

**Interoperability considerations:** PACT documents are valid JSON. Any JSON parser can parse a PACT document. The `$pact` key in the root object distinguishes PACT documents from generic JSON.

**Fragment identifier considerations:** None.

**Published specification:** This document.

### 15.2. Well-Known URI Registration

This specification requests registration of the following well-known URI:

**URI suffix:** pact.json

**Change controller:** PACT Working Group

**Specification document:** This document.

**Related information:** The well-known URI `/.well-known/pact.json` is used for PACT protocol discovery as defined in Section 5.

## 16. References

### 16.1. Normative References

- [RFC 2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC 8259] Bray, T., Ed., "The JavaScript Object Notation (JSON) Data Interchange Format", STI 90, RFC 8259, December 2017.
- [RFC 8615] Nottingham, M., "Well-Known Uniform Resource Identifiers (URIs)", RFC 8615, May 2019.
- [RFC 6749] Hardt, D., Ed., "The OAuth 2.0 Authorization Framework", RFC 6749, October 2012.
- [RFC 9110] Fielding, R., Ed., Nottingham, M., Ed., and J. Reschke, Ed., "HTTP Semantics", STD 97, RFC 9110, June 2022.

### 16.2. Informative References

- Schema.org, https://schema.org/
- Model Context Protocol (MCP), Anthropic, https://modelcontextprotocol.io/
- Agent-to-Agent Protocol (A2A), Google, https://github.com/google/A2A
- OpenAPI Specification, https://spec.openapis.org/oas/latest.html
- JSON-LD 1.1, https://www.w3.org/TR/json-ld11/
- IETF RateLimit Header Fields (draft), https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/

---

## Appendix A: Complete Examples

### A.1. Restaurant Discovery and Query

**Discovery Document** (`/.well-known/pact.json`):

```json
{
  "pact": "1.0",
  "provider": {
    "name": "Seoul Eats",
    "url": "https://seoleats.example.com"
  },
  "endpoints": [
    {
      "path": "/pact/restaurants",
      "schema": "pact:local/restaurant@1",
      "description": "Search restaurants by area, cuisine, or keyword",
      "methods": ["GET"],
      "params": {
        "q": { "type": "string", "description": "Search query" },
        "cuisine": { "type": "string", "description": "Cuisine type filter" },
        "area": { "type": "string", "description": "Neighborhood or district" },
        "price_range": { "type": "string", "enum": ["$", "$$", "$$$", "$$$$"] },
        "offset": { "type": "integer", "default": 0 },
        "limit": { "type": "integer", "default": 20, "max": 50 }
      },
      "layers": ["data", "media", "actions"]
    },
    {
      "path": "/pact/restaurants/{id}",
      "schema": "pact:local/restaurant@1",
      "description": "Single restaurant detail with menu",
      "methods": ["GET"],
      "layers": ["data", "media", "actions"]
    }
  ],
  "schemas": {
    "pact:local/restaurant@1": {
      "url": "https://seoleats.example.com/pact/schemas/restaurant-v1.json"
    }
  },
  "auth": { "type": "public" },
  "rate_limit": {
    "requests_per_minute": 30,
    "requests_per_day": 5000
  },
  "conformance": "L3"
}
```

**Agent Request:**

```http
GET /pact/restaurants?area=gangnam&cuisine=korean&limit=3&layers=data,actions HTTP/1.1
Host: seoleats.example.com
Accept: application/pact+json
```

**Provider Response:**

```json
{
  "$pact": "1.0",
  "$s": "pact:local/restaurant@1",
  "$ttl": 600,
  "$layers": ["data", "actions"],
  "$layout": "object",
  "data": [
    {
      "id": "rest-4420",
      "n": "Gwangjang Hansang",
      "cuisine": "korean_traditional",
      "area": "Gangnam-gu",
      "rat": 4.7,
      "rev": 892,
      "price": "$$",
      "hours": "11:00-22:00"
    },
    {
      "id": "rest-3318",
      "n": "Yukjeon Hoekwan",
      "cuisine": "korean_bbq",
      "area": "Gangnam-gu",
      "rat": 4.5,
      "rev": 2104,
      "price": "$$$",
      "hours": "11:30-23:00"
    },
    {
      "id": "rest-5577",
      "n": "Jungsik",
      "cuisine": "korean_modern",
      "area": "Gangnam-gu",
      "rat": 4.9,
      "rev": 3421,
      "price": "$$$$",
      "hours": "12:00-15:00, 18:00-22:00"
    }
  ],
  "actions": [
    {
      "verb": "POST",
      "name": "reserve",
      "description": "Make a reservation at the restaurant",
      "url": "/pact/restaurants/{id}/reservations",
      "body": {
        "restaurant_id": "{id}",
        "date": null,
        "time": null,
        "party_size": null,
        "name": null,
        "phone": null
      },
      "confirmation": "Confirm reservation at {n} for {party_size} on {date} at {time}?"
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 3,
    "total": 47,
    "next": "/pact/restaurants?area=gangnam&cuisine=korean&offset=3&limit=3&layers=data,actions"
  }
}
```

### A.2. Product Search with Table Layout

**Agent Request:**

```http
GET /pact/products?q=earbuds&sort=price_asc&limit=5&layers=data HTTP/1.1
Host: acme.example.com
Accept: application/pact+json
X-Pact-Key: pk_live_abc123def456
```

**Provider Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/pact+json; charset=utf-8
Cache-Control: public, max-age=60
RateLimit-Limit: 60
RateLimit-Remaining: 54
RateLimit-Reset: 42
```

```json
{
  "$pact": "1.0",
  "$s": "pact:commerce/product@1",
  "$ttl": 60,
  "$layers": ["data"],
  "$layout": "table",
  "data": {
    "cols": ["id", "n", "p", "cur", "brand", "avail", "rat", "rev"],
    "rows": [
      ["prod-3310", "JBL Tune Beam", 89000, "KRW", "JBL", "in_stock", 4.2, 1547],
      ["prod-4422", "Samsung Galaxy Buds FE", 69000, "KRW", "Samsung", "in_stock", 4.3, 4892],
      ["prod-8834", "Samsung Galaxy Buds3 Pro", 259000, "KRW", "Samsung", "in_stock", 4.6, 3241],
      ["prod-7710", "Apple AirPods Pro 3", 329000, "KRW", "Apple", "in_stock", 4.8, 8744],
      ["prod-9921", "Sony WF-1000XM6", 289000, "KRW", "Sony", "in_stock", 4.7, 5102]
    ]
  },
  "pagination": {
    "offset": 0,
    "limit": 5,
    "total": 23,
    "next": "/pact/products?q=earbuds&sort=price_asc&offset=5&limit=5&layers=data"
  }
}
```

### A.3. Action Execution Flow

**Step 1: Agent reads product with actions layer.**

```http
GET /pact/products/prod-8834?layers=data,actions HTTP/1.1
Host: acme.example.com
Accept: application/pact+json
X-Pact-Key: pk_live_abc123def456
Authorization: Bearer eyJ...user_token
```

Response includes `add_to_cart` action (see Section 9.2).

**Step 2: Agent executes the action.**

```http
POST /pact/cart/items HTTP/1.1
Host: acme.example.com
Content-Type: application/json
X-Pact-Key: pk_live_abc123def456
Authorization: Bearer eyJ...user_token

{
  "product_id": "prod-8834",
  "quantity": 1
}
```

**Step 3: Provider responds with result and follow-up actions.**

```json
{
  "$pact": "1.0",
  "$t": "action_result",
  "data": {
    "status": "success",
    "message": "Samsung Galaxy Buds3 Pro added to cart.",
    "cart": {
      "item_count": 2,
      "total": 548000,
      "cur": "KRW"
    }
  },
  "actions": [
    {
      "verb": "GET",
      "name": "view_cart",
      "description": "View full cart contents",
      "url": "/pact/cart"
    },
    {
      "verb": "DELETE",
      "name": "remove_from_cart",
      "description": "Remove this item from cart",
      "url": "/pact/cart/items/prod-8834",
      "confirmation": "Remove Samsung Galaxy Buds3 Pro from cart?"
    },
    {
      "verb": "POST",
      "name": "checkout",
      "description": "Proceed to checkout",
      "url": "/pact/checkout",
      "auth_required": true,
      "confirmation": "Proceed to checkout? Total: 548,000 KRW"
    }
  ]
}
```

---

*End of PACT v1.0 Specification*
