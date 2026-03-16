<?php
/**
 * PACT Schema
 *
 * Serves schema definitions at /wp-json/pact/v1/schemas/{id} so that
 * AI agents can discover the field mappings for each content type.
 */
class PACT_Schema {

    /**
     * Built-in PACT schema definitions.
     * Each schema describes its compressed key mappings and field types.
     *
     * @var array
     */
    private $schemas = [];

    public function __construct() {
        $this->schemas = [
            'pact:news/article@1' => [
                '$schema'     => 'https://pact-protocol.dev/schemas/news/article/1.json',
                'id'          => 'pact:news/article@1',
                'description' => 'News article or blog post with metadata, suitable for AI consumption.',
                'keys'        => [
                    't'    => ['full' => 'title',        'type' => 'string',  'required' => true],
                    'auth' => ['full' => 'author',       'type' => 'string',  'required' => false],
                    'pub'  => ['full' => 'published',    'type' => 'string',  'required' => true],
                    'upd'  => ['full' => 'updated',      'type' => 'string',  'required' => false],
                    'sum'  => ['full' => 'summary',      'type' => 'string',  'required' => false],
                    'body' => ['full' => 'body',         'type' => 'string',  'required' => false],
                    'cat'  => ['full' => 'category',     'type' => 'string',  'required' => false],
                    'tags' => ['full' => 'tags',         'type' => 'array',   'required' => false],
                    'img'  => ['full' => 'image',        'type' => 'url',     'required' => false, 'layer' => 'media'],
                    'src'  => ['full' => 'source',       'type' => 'string',  'required' => false],
                    'url'  => ['full' => 'url',          'type' => 'url',     'required' => true],
                    'lang' => ['full' => 'language',     'type' => 'string',  'required' => false],
                    'rt'   => ['full' => 'reading_time', 'type' => 'integer', 'required' => false],
                ],
            ],
            'pact:commerce/product@1' => [
                '$schema'     => 'https://pact-protocol.dev/schemas/commerce/product/1.json',
                'id'          => 'pact:commerce/product@1',
                'description' => 'E-commerce product listing with pricing, availability, and reviews.',
                'keys'        => [
                    'n'     => ['full' => 'name',        'type' => 'string',  'required' => true],
                    'p'     => ['full' => 'price',       'type' => 'number',  'required' => true],
                    'cur'   => ['full' => 'currency',    'type' => 'string',  'required' => true],
                    'img'   => ['full' => 'image',       'type' => 'url',     'required' => false, 'layer' => 'media'],
                    'url'   => ['full' => 'buy_url',     'type' => 'url',     'required' => true],
                    'm'     => ['full' => 'merchant',    'type' => 'string',  'required' => false],
                    'r'     => ['full' => 'rating',      'type' => 'number',  'required' => false, 'range' => [0, 5]],
                    'rv'    => ['full' => 'reviews',     'type' => 'integer', 'required' => false],
                    's'     => ['full' => 'shipping',    'type' => 'string',  'required' => false],
                    'stk'   => ['full' => 'in_stock',    'type' => 'boolean', 'required' => false],
                    'disc'  => ['full' => 'discount',    'type' => 'number',  'required' => false],
                    'brand' => ['full' => 'brand',       'type' => 'string',  'required' => false],
                    'cat'   => ['full' => 'category',    'type' => 'string',  'required' => false],
                    'desc'  => ['full' => 'description', 'type' => 'string',  'required' => false],
                    'sku'   => ['full' => 'sku',         'type' => 'string',  'required' => false],
                ],
            ],
            'pact:local/business@1' => [
                '$schema'     => 'https://pact-protocol.dev/schemas/local/business/1.json',
                'id'          => 'pact:local/business@1',
                'description' => 'Local business or site page with structured content.',
                'keys'        => [
                    't'      => ['full' => 'title',   'type' => 'string',  'required' => true],
                    'body'   => ['full' => 'content', 'type' => 'string',  'required' => false],
                    'url'    => ['full' => 'url',     'type' => 'url',     'required' => true],
                    'upd'    => ['full' => 'updated', 'type' => 'string',  'required' => false],
                    'sum'    => ['full' => 'excerpt', 'type' => 'string',  'required' => false],
                    'img'    => ['full' => 'image',   'type' => 'url',     'required' => false, 'layer' => 'media'],
                    'slug'   => ['full' => 'slug',    'type' => 'string',  'required' => false],
                    'parent' => ['full' => 'parent',  'type' => 'string',  'required' => false],
                    'ord'    => ['full' => 'order',   'type' => 'integer', 'required' => false],
                ],
            ],
        ];
    }

    /**
     * Register the schema REST API route.
     */
    public function register() {
        register_rest_route('pact/v1', '/schemas/(?P<id>.+)', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_schema'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route('pact/v1', '/schemas', [
            'methods'             => 'GET',
            'callback'            => [$this, 'list_schemas'],
            'permission_callback' => '__return_true',
        ]);
    }

    /**
     * Handle GET /pact/v1/schemas/{id} -- return a single schema definition.
     *
     * @param WP_REST_Request $request The incoming request.
     * @return WP_REST_Response|WP_Error
     */
    public function get_schema($request) {
        $raw_id = $request->get_param('id');

        // Support both "pact:news/article@1" and URL-encoded forms
        $schema_id = urldecode($raw_id);

        // Also accept short-form like "news/article@1" and expand it
        if (strpos($schema_id, 'pact:') !== 0) {
            $schema_id = 'pact:' . $schema_id;
        }

        // Check built-in schemas
        if (isset($this->schemas[$schema_id])) {
            $response = new WP_REST_Response($this->schemas[$schema_id], 200);
            $response->set_headers([
                'Content-Type'                 => 'application/json',
                'Cache-Control'                => 'public, max-age=86400',
                'Access-Control-Allow-Origin'  => '*',
                'Access-Control-Allow-Methods' => 'GET, OPTIONS',
                'Access-Control-Allow-Headers' => 'Accept, Content-Type',
            ]);
            return $response;
        }

        // Check for dynamically registered custom post type schemas
        $custom_schema = $this->get_custom_schema($schema_id);
        if ($custom_schema) {
            $response = new WP_REST_Response($custom_schema, 200);
            $response->set_headers([
                'Content-Type'                 => 'application/json',
                'Cache-Control'                => 'public, max-age=86400',
                'Access-Control-Allow-Origin'  => '*',
                'Access-Control-Allow-Methods' => 'GET, OPTIONS',
                'Access-Control-Allow-Headers' => 'Accept, Content-Type',
            ]);
            return $response;
        }

        return new WP_Error(
            'schema_not_found',
            'Schema not found: ' . $schema_id,
            ['status' => 404]
        );
    }

    /**
     * Handle GET /pact/v1/schemas -- list all available schema IDs.
     *
     * @param WP_REST_Request $request The incoming request.
     * @return WP_REST_Response
     */
    public function list_schemas($request) {
        $schema_ids = array_keys($this->schemas);

        // Add custom post type schemas
        $custom_types = get_post_types(['public' => true, '_builtin' => false], 'objects');
        foreach ($custom_types as $type) {
            if ($type->name === 'product') continue;
            $schema_ids[] = 'pact:custom/' . $type->name . '@1';
        }

        $response = new WP_REST_Response([
            'schemas' => array_values(array_unique($schema_ids)),
        ], 200);
        $response->set_headers([
            'Content-Type'                 => 'application/json',
            'Cache-Control'                => 'public, max-age=3600',
            'Access-Control-Allow-Origin'  => '*',
            'Access-Control-Allow-Methods' => 'GET, OPTIONS',
            'Access-Control-Allow-Headers' => 'Accept, Content-Type',
        ]);

        return $response;
    }

    /**
     * Generate a schema definition for a custom post type.
     *
     * @param string $schema_id The full schema identifier (e.g. "pact:custom/event@1").
     * @return array|null Schema definition or null if not a valid custom post type.
     */
    private function get_custom_schema($schema_id) {
        // Parse schema ID: pact:custom/{type}@{version}
        if (!preg_match('/^pact:custom\/([a-z0-9_-]+)@(\d+)$/', $schema_id, $matches)) {
            return null;
        }

        $type_name = $matches[1];
        $post_type = get_post_type_object($type_name);

        if (!$post_type || !$post_type->public) {
            return null;
        }

        // Build a generic schema for the custom post type
        $schema = [
            '$schema'     => 'https://pact-protocol.dev/schemas/custom/' . $type_name . '/1.json',
            'id'          => $schema_id,
            'description' => $post_type->description ?: 'Custom content type: ' . $post_type->labels->singular_name,
            'keys'        => [
                't'    => ['full' => 'title',     'type' => 'string',  'required' => true],
                'auth' => ['full' => 'author',    'type' => 'string',  'required' => false],
                'pub'  => ['full' => 'published', 'type' => 'string',  'required' => true],
                'upd'  => ['full' => 'updated',   'type' => 'string',  'required' => false],
                'sum'  => ['full' => 'summary',   'type' => 'string',  'required' => false],
                'body' => ['full' => 'body',      'type' => 'string',  'required' => false],
                'img'  => ['full' => 'image',     'type' => 'url',     'required' => false, 'layer' => 'media'],
                'url'  => ['full' => 'url',       'type' => 'url',     'required' => true],
            ],
        ];

        // Add taxonomy fields
        $taxonomies = get_object_taxonomies($type_name, 'objects');
        foreach ($taxonomies as $tax) {
            if (!$tax->public) continue;
            $key = substr($tax->name, 0, 4);
            // Avoid collisions with existing keys
            while (isset($schema['keys'][$key])) {
                $key .= '_';
            }
            $schema['keys'][$key] = [
                'full'     => $tax->label,
                'type'     => 'array',
                'required' => false,
            ];
        }

        return $schema;
    }

    /**
     * Get a built-in schema by ID.
     *
     * @param string $schema_id The schema identifier.
     * @return array|null The schema definition or null.
     */
    public function get_builtin_schema($schema_id) {
        return $this->schemas[$schema_id] ?? null;
    }
}
