#!/usr/bin/env node
import http from 'node:http';

// ---------- core helpers (inline fallbacks for standalone use) ----------

let createEnvelope, createTableEnvelope, createDiscovery, compress,
    PACT_VERSION, PACT_MIME_TYPE;

try {
  const core = await import('@pact-protocol/core');
  ({ createEnvelope, createTableEnvelope, createDiscovery, compress,
     PACT_VERSION, PACT_MIME_TYPE } = core);
} catch {
  // Inline fallbacks so the proxy works without @pact-protocol/core installed
  PACT_VERSION  = '1.0';
  PACT_MIME_TYPE = 'application/pact+json';

  createEnvelope = ({ schema, items, total, ttl, page }) => {
    const env = { $pact: PACT_VERSION, $s: schema, $t: Date.now(), items };
    if (ttl   !== undefined) env.$ttl  = ttl;
    if (total !== undefined) env.total = total;
    if (page  !== undefined) env.page  = page;
    return env;
  };

  createTableEnvelope = ({ schema, cols, rows, total, ttl, page }) => {
    const env = { $pact: PACT_VERSION, $s: schema, $t: Date.now(),
                  $layout: 'table', cols, rows };
    if (ttl   !== undefined) env.$ttl  = ttl;
    if (total !== undefined) env.total = total;
    if (page  !== undefined) env.page  = page;
    return env;
  };

  createDiscovery = (opts) => {
    const d = { pact: PACT_VERSION, site: opts.site,
                schemas: opts.schemas, endpoints: opts.endpoints };
    if (opts.description) d.description = opts.description;
    if (opts.platforms)   d.platforms   = opts.platforms;
    if (opts.rateLimit)   d.rate_limit  = opts.rateLimit;
    if (opts.auth)        d.auth        = opts.auth;
    if (opts.license)     d.license     = opts.license;
    return d;
  };

  compress = (obj) => obj;  // no-op fallback
}

// ---------- configuration from environment ----------

const SHOP_DOMAIN      = process.env.SHOP_DOMAIN      || 'myshop.myshopify.com';
const STOREFRONT_TOKEN = process.env.STOREFRONT_TOKEN  || '';
const PORT             = parseInt(process.env.PORT     || '3000', 10);

// ---------- product schema key map (pact:commerce/product@1) ----------

const PRODUCT_SCHEMA = {
  $schema: 'https://pact.dev/meta@1',
  id: 'pact:commerce/product@1',
  description: 'Shopify product',
  keys: {
    n:     { full: 'name',        type: 'string',  required: true },
    p:     { full: 'price',       type: 'number',  required: true },
    cur:   { full: 'currency',    type: 'string',  default: 'USD' },
    img:   { full: 'image',       type: 'url',     layer: 'media' },
    url:   { full: 'buy_url',     type: 'url',     layer: 'action' },
    m:     { full: 'merchant',    type: 'string' },
    r:     { full: 'rating',      type: 'number',  range: [0, 5] },
    rv:    { full: 'reviews',     type: 'integer' },
    stk:   { full: 'in_stock',    type: 'boolean' },
    brand: { full: 'brand',       type: 'string' },
    desc:  { full: 'description', type: 'string' },
    cat:   { full: 'category',    type: 'string' },
    sku:   { full: 'sku',         type: 'string' },
  }
};

// ---------- Shopify Storefront API ----------

async function fetchProducts(query, first = 20) {
  // If no token is configured, return mock data for demo / testing
  if (!STOREFRONT_TOKEN) {
    return getMockProducts(query, first);
  }

  // Use GraphQL variables to prevent injection
  const graphql = `query ProductSearch($first: Int!, $query: String) {
    products(first: $first, query: $query) {
      edges {
        node {
          id
          title
          description
          vendor
          productType
          handle
          priceRange { minVariantPrice { amount currencyCode } }
          images(first: 1) { edges { node { url } } }
          availableForSale
          variants(first: 1) { edges { node { sku } } }
        }
      }
      pageInfo { hasNextPage }
    }
  }`;

  const resp = await fetch(`https://${SHOP_DOMAIN}/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
    },
    body: JSON.stringify({
      query: graphql,
      variables: { first, query: query || null },
    }),
  });

  const data = await resp.json();
  return data.data.products.edges.map(({ node }) => formatProduct(node));
}

async function fetchProductById(id) {
  if (!STOREFRONT_TOKEN) {
    return getMockProducts(null, 50).find(p => p.id === id) || null;
  }

  const graphql = `query GetProduct($id: ID!) {
    node(id: $id) {
      ... on Product {
        id
        title
        description
        vendor
        productType
        handle
        priceRange { minVariantPrice { amount currencyCode } }
        images(first: 1) { edges { node { url } } }
        availableForSale
        variants(first: 1) { edges { node { sku } } }
      }
    }
  }`;

  const resp = await fetch(`https://${SHOP_DOMAIN}/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
    },
    body: JSON.stringify({
      query: graphql,
      variables: { id: `gid://shopify/Product/${id}` },
    }),
  });

  const data = await resp.json();
  if (!data.data?.node) return null;
  return formatProduct(data.data.node);
}

function formatProduct(node) {
  return {
    id:    node.id.split('/').pop(),
    n:     node.title,
    p:     parseFloat(node.priceRange.minVariantPrice.amount),
    cur:   node.priceRange.minVariantPrice.currencyCode,
    img:   node.images.edges[0]?.node.url || null,
    url:   `https://${SHOP_DOMAIN}/products/${node.handle}`,
    m:     SHOP_DOMAIN.replace('.myshopify.com', ''),
    brand: node.vendor || null,
    desc:  node.description?.substring(0, 200) || null,
    cat:   node.productType || null,
    stk:   node.availableForSale,
    sku:   node.variants.edges[0]?.node.sku || null,
  };
}

function getMockProducts(query, first) {
  const products = [
    { id: 'P001', n: 'Classic T-Shirt',    p: 29.99, cur: 'USD', brand: 'MyShop',   cat: 'Apparel',     stk: true,  desc: 'Premium cotton t-shirt' },
    { id: 'P002', n: 'Denim Jacket',       p: 89.99, cur: 'USD', brand: 'MyShop',   cat: 'Apparel',     stk: true,  desc: 'Vintage-style denim jacket' },
    { id: 'P003', n: 'Canvas Sneakers',    p: 59.99, cur: 'USD', brand: 'MyShop',   cat: 'Footwear',    stk: true,  desc: 'Comfortable canvas sneakers' },
    { id: 'P004', n: 'Leather Wallet',     p: 45.00, cur: 'USD', brand: 'MyShop',   cat: 'Accessories', stk: false, desc: 'Genuine leather bifold wallet' },
    { id: 'P005', n: 'Wireless Earbuds',   p: 79.99, cur: 'USD', brand: 'TechShop', cat: 'Electronics', stk: true,  desc: 'Bluetooth 5.3 earbuds' },
  ];

  let filtered = products;
  if (query) {
    const q = query.toLowerCase();
    filtered = products.filter(
      p => p.n.toLowerCase().includes(q) || (p.cat && p.cat.toLowerCase().includes(q))
    );
  }
  return filtered.slice(0, first);
}

// ---------- discovery document ----------

function getDiscovery() {
  return createDiscovery({
    site: SHOP_DOMAIN.replace('.myshopify.com', '.com'),
    description: `AI-optimized product catalog for ${SHOP_DOMAIN}`,
    schemas: ['pact:commerce/product@1'],
    endpoints: {
      'pact:commerce/product@1': {
        list:   '/apps/pact/products',
        item:   '/apps/pact/products/{id}',
        search: '/apps/pact/products?q={query}',
      },
    },
    platforms: {
      web: { base_url: `https://${SHOP_DOMAIN}` },
    },
    rateLimit: { rpm: 60, burst: 10 },
    auth:     { type: 'public' },
    license:  { ai_input: true, ai_train: false, attribution: true },
  });
}

// ---------- HTTP server ----------

const server = http.createServer(async (req, res) => {
  const url  = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Accept, X-Pact-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // --- Discovery ---
    if (path === '/.well-known/pact.json' || path === '/apps/pact') {
      res.writeHead(200, {
        'Content-Type':  'application/json',
        'Cache-Control': 'public, max-age=3600',
      });
      res.end(JSON.stringify(getDiscovery(), null, 2));
      return;
    }

    // --- Schema ---
    if (path === '/apps/pact/schemas/pact:commerce/product@1') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(PRODUCT_SCHEMA, null, 2));
      return;
    }

    // --- Product list / search ---
    if (path === '/apps/pact/products') {
      const query  = url.searchParams.get('q') || '';
      const limit  = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10), 1), 50);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);

      const products = await fetchProducts(query, limit);
      const envelope = createEnvelope({
        schema: 'pact:commerce/product@1',
        items:  products,
        total:  products.length,
        ttl:    300,
      });

      res.writeHead(200, {
        'Content-Type':  PACT_MIME_TYPE,
        'Cache-Control': 'public, max-age=60',
      });
      res.end(JSON.stringify(envelope));
      return;
    }

    // --- Single product ---
    const productMatch = path.match(/^\/apps\/pact\/products\/(.+)$/);
    if (productMatch) {
      const product = await fetchProductById(productMatch[1]);
      if (!product) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'product_not_found' }));
        return;
      }
      const envelope = createEnvelope({
        schema: 'pact:commerce/product@1',
        items:  [product],
        total:  1,
      });
      res.writeHead(200, { 'Content-Type': PACT_MIME_TYPE });
      res.end(JSON.stringify(envelope));
      return;
    }

    // --- 404 ---
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));

  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal_error', message: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`PACT Shopify proxy running on http://localhost:${PORT}`);
  console.log(`Discovery: http://localhost:${PORT}/.well-known/pact.json`);
  console.log(`Products:  http://localhost:${PORT}/apps/pact/products`);
});
