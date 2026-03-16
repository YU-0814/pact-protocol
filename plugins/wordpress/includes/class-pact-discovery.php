<?php
/**
 * PACT Discovery
 *
 * Generates the /.well-known/pact.json discovery document that tells
 * AI agents what schemas and endpoints this site exposes.
 */
class PACT_Discovery {

    /**
     * Generate the full PACT discovery document.
     *
     * @return array The discovery document as an associative array.
     */
    public function generate() {
        $site_url = get_site_url();
        $site_name = get_bloginfo('name');
        $description = get_bloginfo('description');

        $schemas = [];
        $endpoints = [];

        // Posts -> news/article
        $schemas[] = 'pact:news/article@1';
        $endpoints['pact:news/article@1'] = [
            'list' => '/wp-json/pact/v1/posts',
            'item' => '/wp-json/pact/v1/posts/{id}',
            'search' => '/wp-json/pact/v1/posts?q={query}',
        ];

        // Pages -> local/business (site info)
        $schemas[] = 'pact:local/business@1';
        $endpoints['pact:local/business@1'] = [
            'list' => '/wp-json/pact/v1/pages',
            'item' => '/wp-json/pact/v1/pages/{id}',
        ];

        // WooCommerce products if active
        if (class_exists('WooCommerce')) {
            $schemas[] = 'pact:commerce/product@1';
            $endpoints['pact:commerce/product@1'] = [
                'list' => '/wp-json/pact/v1/products',
                'item' => '/wp-json/pact/v1/products/{id}',
                'search' => '/wp-json/pact/v1/products?q={query}',
            ];
        }

        // Custom post types
        $custom_types = get_post_types(['public' => true, '_builtin' => false], 'objects');
        foreach ($custom_types as $type) {
            // WooCommerce product is handled above
            if ($type->name === 'product') continue;

            $schema_id = 'pact:custom/' . $type->name . '@1';
            $schemas[] = $schema_id;
            $endpoints[$schema_id] = [
                'list' => '/wp-json/pact/v1/' . $type->name,
                'item' => '/wp-json/pact/v1/' . $type->name . '/{id}',
            ];
        }

        // Schema definitions endpoint
        $endpoints['_schemas'] = [
            'item' => '/wp-json/pact/v1/schemas/{id}',
        ];

        return [
            'pact' => PACT_VERSION,
            'site' => parse_url($site_url, PHP_URL_HOST),
            'description' => $description ?: $site_name,
            'schemas' => array_values(array_unique($schemas)),
            'endpoints' => $endpoints,
            'platforms' => [
                'web' => ['base_url' => $site_url],
            ],
            'rate_limit' => ['rpm' => 60, 'burst' => 10],
            'auth' => ['type' => 'public'],
            'license' => [
                'ai_input' => true,
                'ai_train' => false,
                'attribution' => true,
            ],
            'conformance' => 'L2',
        ];
    }
}
