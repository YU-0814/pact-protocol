# @pact-protocol/shopify

Shopify integration for the PACT (Protocol for Agent Content Transfer) protocol. Provides two approaches for Shopify stores to serve AI-optimized product data in PACT format.

## Approaches

### 1. App Proxy (Node.js) — `pact-proxy.js`

A standalone Node.js server that acts as a Shopify App Proxy endpoint. It reads products from the Shopify Storefront API and serves them in PACT format.

Best for:
- Shopify App developers building a public or custom app
- Stores that need full control over PACT output
- Stores using Shopify Plus or custom hosting

### 2. Liquid Templates — `*.liquid`

Theme-level Liquid snippets that can be added directly to a Shopify theme. No external server required.

Best for:
- Quick integration without a separate server
- Stores using Shopify's Online Store channel
- Merchants comfortable editing theme code

## Setup: App Proxy

### Prerequisites

- Node.js 18+
- A Shopify store with a [Storefront API access token](https://shopify.dev/docs/api/usage/authentication#getting-started-with-authenticated-access)

### Installation

```bash
cd plugins/shopify
npm install
```

### Environment Variables

| Variable           | Required | Default                   | Description                        |
|--------------------|----------|---------------------------|------------------------------------|
| `SHOP_DOMAIN`      | No       | `myshop.myshopify.com`    | Your `.myshopify.com` domain       |
| `STOREFRONT_TOKEN` | No       | (empty = mock data)       | Storefront API access token        |
| `PORT`             | No       | `3000`                    | HTTP server port                   |

### Running

```bash
# With mock data (no Shopify credentials needed)
node pact-proxy.js

# With a real store
SHOP_DOMAIN=yourstore.myshopify.com \
STOREFRONT_TOKEN=your-token-here \
node pact-proxy.js
```

### Configuring as a Shopify App Proxy

1. In your Shopify Partner Dashboard, go to your app settings.
2. Under **App Proxy**, set:
   - **Sub path prefix:** `apps`
   - **Sub path:** `pact`
   - **Proxy URL:** `https://your-server.com/apps/pact`
3. Requests to `https://yourstore.com/apps/pact/*` will be forwarded to your proxy.

### Endpoints

| Path                                            | Description                |
|-------------------------------------------------|----------------------------|
| `/.well-known/pact.json`                        | PACT discovery document    |
| `/apps/pact`                                    | Discovery (alias)          |
| `/apps/pact/products`                           | Product list               |
| `/apps/pact/products?q=shirt`                   | Product search             |
| `/apps/pact/products/{id}`                      | Single product             |
| `/apps/pact/schemas/pact:commerce/product@1`    | Product schema definition  |

### Testing Locally

```bash
# Start the server (mock mode)
node pact-proxy.js &

# Fetch the discovery document
curl -s http://localhost:3000/.well-known/pact.json | head -20

# Fetch all products
curl -s http://localhost:3000/apps/pact/products

# Search for products
curl -s http://localhost:3000/apps/pact/products?q=shirt

# Fetch a single product
curl -s http://localhost:3000/apps/pact/products/P001

# Stop the server
kill %1
```

## Setup: Liquid Templates

### `pact-discovery.json.liquid`

Generates the PACT discovery document as a Shopify page template.

1. In your Shopify admin, go to **Online Store > Themes > Edit code**.
2. Under **Templates**, create a new template: `page.pact-discovery.json.liquid`.
3. Paste the contents of `pact-discovery.json.liquid`.
4. Go to **Online Store > Pages** and create a new page.
5. Set the page template to `pact-discovery` and the URL handle to `pact-discovery`.
6. The discovery document is now available at `https://yourstore.com/pages/pact-discovery`.

### `pact-extension.liquid`

Adds PACT meta tags to your theme's HTML `<head>`.

1. In your theme editor, open **Snippets** and create `pact-extension.liquid`.
2. Paste the contents of `pact-extension.liquid`.
3. In `theme.liquid`, add inside the `<head>` tag:
   ```liquid
   {% render 'pact-extension' %}
   ```

## Schema

This integration uses the `pact:commerce/product@1` schema with these compressed keys:

| Key     | Full Name     | Type      | Notes                |
|---------|---------------|-----------|----------------------|
| `n`     | `name`        | string    | Required             |
| `p`     | `price`       | number    | Required             |
| `cur`   | `currency`    | string    | Default: `USD`       |
| `img`   | `image`       | url       | Media layer          |
| `url`   | `buy_url`     | url       | Action layer         |
| `m`     | `merchant`    | string    |                      |
| `r`     | `rating`      | number    | Range: 0-5           |
| `rv`    | `reviews`     | integer   |                      |
| `stk`   | `in_stock`    | boolean   |                      |
| `brand` | `brand`       | string    |                      |
| `desc`  | `description` | string    |                      |
| `cat`   | `category`    | string    |                      |
| `sku`   | `sku`         | string    |                      |

## License

Apache-2.0
