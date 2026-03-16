=== PACT Protocol ===
Contributors: pactprotocol
Tags: ai, api, structured-data, pact
Requires at least: 6.0
Tested up to: 6.7
Stable tag: 1.0.0
Requires PHP: 7.4
License: Apache-2.0
License URI: https://www.apache.org/licenses/LICENSE-2.0

Serve structured, AI-optimized content via the PACT protocol.

== Description ==

PACT Protocol automatically generates AI-friendly endpoints for your WordPress content. It exposes posts, pages, WooCommerce products, and custom post types in the standardized PACT format, making your site's content easily consumable by AI agents and language models.

**What it does:**

* Auto-generates a `/.well-known/pact.json` discovery document
* Serves posts as `pact:news/article@1` with compressed keys
* Serves pages as `pact:local/business@1`
* Serves WooCommerce products as `pact:commerce/product@1` (when WooCommerce is active)
* Auto-detects custom post types and exposes them as `pact:custom/{type}@1`
* Provides schema definitions at `/wp-json/pact/v1/schemas/{id}`
* Includes pagination, search, and CORS support

**Key features:**

* Zero configuration required -- activate and go
* Compressed JSON keys to minimize bandwidth
* Standards-compliant PACT v1.0 output
* Full WooCommerce integration with product details, pricing, ratings, and stock info
* Proper caching headers for optimal performance
* CORS headers for cross-origin AI agent access

== Installation ==

1. Upload the `pact-protocol` folder to `/wp-content/plugins/`
2. Activate the plugin through the "Plugins" menu in WordPress
3. Visit `/.well-known/pact.json` to verify the discovery document is served
4. Access content at `/wp-json/pact/v1/posts`, `/wp-json/pact/v1/pages`, etc.

If you have WooCommerce active, product endpoints will be available automatically at `/wp-json/pact/v1/products`.

== Frequently Asked Questions ==

= Do I need to configure anything? =

No. The plugin works out of the box. It auto-detects your content types, including WooCommerce products and custom post types, and generates appropriate endpoints.

= What is the PACT protocol? =

PACT (Protocol for AI Content Transmission) is an open standard for serving structured, AI-optimized content. It defines a discovery mechanism, schema system, and compact JSON format designed for efficient consumption by AI agents and language models.

= Does this work with WooCommerce? =

Yes. When WooCommerce is active, the plugin automatically exposes product data including name, price, currency, stock status, ratings, reviews, brand, category, SKU, and images.

= What about custom post types? =

Custom post types registered as public are automatically discovered and exposed with their taxonomies and custom fields.

= Is my content public? =

The plugin only exposes content that is already publicly published. It does not expose drafts, private posts, or password-protected content.

= Can I control the rate limit? =

The discovery document advertises a default rate limit of 60 requests per minute. Server-side rate limiting should be configured separately via your hosting environment or a security plugin.

== Changelog ==

= 1.0.0 =
* Initial release
* Discovery document at /.well-known/pact.json
* Posts endpoint with news/article schema
* Pages endpoint with local/business schema
* WooCommerce products endpoint with commerce/product schema
* Custom post type auto-detection
* Schema definitions endpoint
* Pagination, search, and CORS support
