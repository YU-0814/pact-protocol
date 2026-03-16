<?php
/**
 * PACT Endpoint
 *
 * Registers WP REST API routes that serve WordPress content in PACT format
 * with compressed keys matching the PACT schema specifications.
 */
class PACT_Endpoint {

    /**
     * Key compression map for news/article schema.
     * Maps full key names to their abbreviated PACT equivalents.
     */
    private $article_keys = [
        'title'        => 't',
        'author'       => 'auth',
        'published'    => 'pub',
        'updated'      => 'upd',
        'summary'      => 'sum',
        'body'         => 'body',
        'category'     => 'cat',
        'tags'         => 'tags',
        'image'        => 'img',
        'source'       => 'src',
        'url'          => 'url',
        'language'     => 'lang',
        'reading_time' => 'rt',
    ];

    /**
     * Key compression map for commerce/product schema.
     */
    private $product_keys = [
        'name'        => 'n',
        'price'       => 'p',
        'currency'    => 'cur',
        'image'       => 'img',
        'buy_url'     => 'url',
        'merchant'    => 'm',
        'rating'      => 'r',
        'reviews'     => 'rv',
        'shipping'    => 's',
        'in_stock'    => 'stk',
        'discount'    => 'disc',
        'brand'       => 'brand',
        'category'    => 'cat',
        'description' => 'desc',
        'sku'         => 'sku',
    ];

    /**
     * Key compression map for local/business schema (pages).
     */
    private $page_keys = [
        'title'    => 't',
        'content'  => 'body',
        'url'      => 'url',
        'updated'  => 'upd',
        'excerpt'  => 'sum',
        'image'    => 'img',
        'slug'     => 'slug',
        'parent'   => 'parent',
        'order'    => 'ord',
    ];

    /**
     * Register all PACT REST API routes.
     */
    public function register() {
        // Posts endpoints
        register_rest_route('pact/v1', '/posts', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_posts'],
            'permission_callback' => '__return_true',
            'args'                => $this->get_collection_args(),
        ]);
        register_rest_route('pact/v1', '/posts/(?P<id>\d+)', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_post'],
            'permission_callback' => '__return_true',
        ]);

        // Pages endpoints
        register_rest_route('pact/v1', '/pages', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_pages'],
            'permission_callback' => '__return_true',
            'args'                => $this->get_collection_args(),
        ]);
        register_rest_route('pact/v1', '/pages/(?P<id>\d+)', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_page'],
            'permission_callback' => '__return_true',
        ]);

        // WooCommerce product endpoints
        if (class_exists('WooCommerce')) {
            register_rest_route('pact/v1', '/products', [
                'methods'             => 'GET',
                'callback'            => [$this, 'get_products'],
                'permission_callback' => '__return_true',
                'args'                => $this->get_collection_args(),
            ]);
            register_rest_route('pact/v1', '/products/(?P<id>\d+)', [
                'methods'             => 'GET',
                'callback'            => [$this, 'get_product'],
                'permission_callback' => '__return_true',
            ]);
        }

        // Dynamic endpoints for custom post types
        $custom_types = get_post_types(['public' => true, '_builtin' => false], 'objects');
        foreach ($custom_types as $type) {
            if ($type->name === 'product') continue;

            register_rest_route('pact/v1', '/' . $type->name, [
                'methods'             => 'GET',
                'callback'            => function ($request) use ($type) {
                    return $this->get_custom_posts($request, $type->name);
                },
                'permission_callback' => '__return_true',
                'args'                => $this->get_collection_args(),
            ]);
            register_rest_route('pact/v1', '/' . $type->name . '/(?P<id>\d+)', [
                'methods'             => 'GET',
                'callback'            => function ($request) use ($type) {
                    return $this->get_custom_post($request, $type->name);
                },
                'permission_callback' => '__return_true',
            ]);
        }
    }

    /**
     * Define shared collection query parameters.
     *
     * @return array Argument definitions for REST route registration.
     */
    private function get_collection_args() {
        return [
            'limit' => [
                'type'              => 'integer',
                'default'           => 20,
                'minimum'           => 1,
                'maximum'           => 50,
                'sanitize_callback' => 'absint',
            ],
            'offset' => [
                'type'              => 'integer',
                'default'           => 0,
                'minimum'           => 0,
                'sanitize_callback' => 'absint',
            ],
            'q' => [
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
        ];
    }

    // =========================================================================
    // Posts (news/article)
    // =========================================================================

    /**
     * Handle GET /pact/v1/posts -- list published posts.
     *
     * @param WP_REST_Request $request The incoming request.
     * @return WP_REST_Response|WP_Error
     */
    public function get_posts($request) {
        $query_params = [
            'post_type'      => 'post',
            'post_status'    => 'publish',
            'posts_per_page' => min((int)($request->get_param('limit') ?: 20), 50),
            'offset'         => max((int)($request->get_param('offset') ?: 0), 0),
            'orderby'        => 'date',
            'order'          => 'DESC',
        ];

        if ($q = $request->get_param('q')) {
            $query_params['s'] = sanitize_text_field($q);
        }

        $query = new WP_Query($query_params);
        $items = [];

        foreach ($query->posts as $post) {
            $items[] = $this->format_post($post);
        }

        return $this->pact_response('pact:news/article@1', $items, $query->found_posts, $request);
    }

    /**
     * Handle GET /pact/v1/posts/{id} -- single post.
     *
     * @param WP_REST_Request $request The incoming request.
     * @return WP_REST_Response|WP_Error
     */
    public function get_post($request) {
        $post = get_post((int)$request['id']);
        if (!$post || $post->post_status !== 'publish' || $post->post_type !== 'post') {
            return new WP_Error('not_found', 'Post not found', ['status' => 404]);
        }
        return $this->pact_response('pact:news/article@1', [$this->format_post($post, true)], 1, $request);
    }

    /**
     * Format a WP_Post into a compressed PACT article item.
     *
     * @param WP_Post $post     The post object.
     * @param bool    $full     Whether to include the full body content.
     * @return array Compressed PACT item.
     */
    private function format_post($post, $full = false) {
        $author     = get_the_author_meta('display_name', $post->post_author);
        $categories = wp_get_post_categories($post->ID, ['fields' => 'names']);
        $tags       = wp_get_post_tags($post->ID, ['fields' => 'names']);
        $thumb      = get_the_post_thumbnail_url($post->ID, 'large');
        $content    = apply_filters('the_content', $post->post_content);
        $plain_text = wp_strip_all_tags($content);
        $word_count = str_word_count($plain_text);

        $item = [
            'id'   => (string)$post->ID,
            't'    => $post->post_title,
            'auth' => $author,
            'pub'  => $post->post_date_gmt,
            'upd'  => $post->post_modified_gmt,
            'sum'  => wp_trim_words($plain_text, 30, '...'),
            'cat'  => !empty($categories) ? $categories[0] : null,
            'tags' => $tags,
            'url'  => get_permalink($post->ID),
            'src'  => get_bloginfo('name'),
            'lang' => get_locale(),
            'rt'   => max(1, (int)ceil($word_count / 200)),
        ];

        if ($thumb) {
            $item['img'] = $thumb;
        }

        if ($full) {
            $item['body'] = $plain_text;
        }

        return array_filter($item, function ($v) {
            return $v !== null && $v !== '' && $v !== [];
        });
    }

    // =========================================================================
    // Products (commerce/product) -- WooCommerce
    // =========================================================================

    /**
     * Handle GET /pact/v1/products -- list WooCommerce products.
     *
     * @param WP_REST_Request $request The incoming request.
     * @return WP_REST_Response|WP_Error
     */
    public function get_products($request) {
        $query_params = [
            'post_type'      => 'product',
            'post_status'    => 'publish',
            'posts_per_page' => min((int)($request->get_param('limit') ?: 20), 50),
            'offset'         => max((int)($request->get_param('offset') ?: 0), 0),
            'orderby'        => 'date',
            'order'          => 'DESC',
        ];

        if ($q = $request->get_param('q')) {
            $query_params['s'] = sanitize_text_field($q);
        }

        $query = new WP_Query($query_params);
        $items = [];

        foreach ($query->posts as $post) {
            $product = wc_get_product($post->ID);
            if ($product) {
                $items[] = $this->format_product($product);
            }
        }

        return $this->pact_response('pact:commerce/product@1', $items, $query->found_posts, $request);
    }

    /**
     * Handle GET /pact/v1/products/{id} -- single WooCommerce product.
     *
     * @param WP_REST_Request $request The incoming request.
     * @return WP_REST_Response|WP_Error
     */
    public function get_product($request) {
        $product = wc_get_product((int)$request['id']);

        if (!$product || $product->get_status() !== 'publish') {
            return new WP_Error('not_found', 'Product not found', ['status' => 404]);
        }

        return $this->pact_response(
            'pact:commerce/product@1',
            [$this->format_product($product, true)],
            1,
            $request
        );
    }

    /**
     * Format a WooCommerce product into a compressed PACT product item.
     *
     * @param WC_Product $product  The WooCommerce product object.
     * @param bool       $full     Whether to include the full description.
     * @return array Compressed PACT item.
     */
    private function format_product($product, $full = false) {
        $image_id  = $product->get_image_id();
        $image_url = $image_id ? wp_get_attachment_image_url($image_id, 'large') : null;

        $categories   = wc_get_product_category_list($product->get_id(), ', ');
        $category_raw = wp_strip_all_tags($categories);

        // Determine price values
        $regular_price = (float)$product->get_regular_price();
        $sale_price    = $product->get_sale_price();
        $active_price  = (float)$product->get_price();

        // Calculate discount percentage
        $discount = null;
        if ($sale_price !== '' && $regular_price > 0) {
            $discount = round((1 - (float)$sale_price / $regular_price) * 100);
        }

        // Extract brand from product attributes or a custom taxonomy
        $brand = null;
        $brand_attr = $product->get_attribute('brand');
        if ($brand_attr) {
            $brand = $brand_attr;
        } else {
            $brand_terms = get_the_terms($product->get_id(), 'product_brand');
            if ($brand_terms && !is_wp_error($brand_terms)) {
                $brand = $brand_terms[0]->name;
            }
        }

        // Average rating and review count
        $rating       = (float)$product->get_average_rating();
        $review_count = (int)$product->get_review_count();

        $item = [
            'id'   => (string)$product->get_id(),
            'n'    => $product->get_name(),
            'p'    => $active_price,
            'cur'  => get_woocommerce_currency(),
            'url'  => get_permalink($product->get_id()),
            'stk'  => $product->is_in_stock(),
            'cat'  => $category_raw ?: null,
            'desc' => $product->get_short_description()
                ? wp_strip_all_tags($product->get_short_description())
                : null,
            'sku'  => $product->get_sku() ?: null,
        ];

        if ($image_url) {
            $item['img'] = $image_url;
        }

        if ($brand) {
            $item['brand'] = $brand;
        }

        if ($rating > 0) {
            $item['r'] = round($rating, 1);
        }

        if ($review_count > 0) {
            $item['rv'] = $review_count;
        }

        if ($discount !== null && $discount > 0) {
            $item['disc'] = $discount;
        }

        // Shipping info: use flat-rate or free-shipping label if determinable
        $item['m'] = get_bloginfo('name');

        if ($full) {
            $full_desc = $product->get_description();
            if ($full_desc) {
                $item['desc'] = wp_strip_all_tags($full_desc);
            }

            // Include gallery images in full mode
            $gallery_ids = $product->get_gallery_image_ids();
            if (!empty($gallery_ids)) {
                $gallery = [];
                foreach ($gallery_ids as $gid) {
                    $gurl = wp_get_attachment_image_url($gid, 'large');
                    if ($gurl) {
                        $gallery[] = $gurl;
                    }
                }
                if (!empty($gallery)) {
                    $item['gallery'] = $gallery;
                }
            }

            // Include product attributes
            $attributes = $product->get_attributes();
            if (!empty($attributes)) {
                $attrs = [];
                foreach ($attributes as $attr) {
                    if ($attr->get_visible()) {
                        $name = wc_attribute_label($attr->get_name());
                        $values = $attr->is_taxonomy()
                            ? wc_get_product_terms($product->get_id(), $attr->get_name(), ['fields' => 'names'])
                            : $attr->get_options();
                        $attrs[$name] = implode(', ', $values);
                    }
                }
                if (!empty($attrs)) {
                    $item['attrs'] = $attrs;
                }
            }
        }

        return array_filter($item, function ($v) {
            return $v !== null && $v !== '' && $v !== [];
        });
    }

    // =========================================================================
    // Pages (local/business)
    // =========================================================================

    /**
     * Handle GET /pact/v1/pages -- list published pages.
     *
     * @param WP_REST_Request $request The incoming request.
     * @return WP_REST_Response|WP_Error
     */
    public function get_pages($request) {
        $query_params = [
            'post_type'      => 'page',
            'post_status'    => 'publish',
            'posts_per_page' => min((int)($request->get_param('limit') ?: 20), 50),
            'offset'         => max((int)($request->get_param('offset') ?: 0), 0),
            'orderby'        => 'menu_order title',
            'order'          => 'ASC',
        ];

        if ($q = $request->get_param('q')) {
            $query_params['s'] = sanitize_text_field($q);
        }

        $query = new WP_Query($query_params);
        $items = [];

        foreach ($query->posts as $post) {
            $items[] = $this->format_page($post);
        }

        return $this->pact_response('pact:local/business@1', $items, $query->found_posts, $request);
    }

    /**
     * Handle GET /pact/v1/pages/{id} -- single page.
     *
     * @param WP_REST_Request $request The incoming request.
     * @return WP_REST_Response|WP_Error
     */
    public function get_page($request) {
        $post = get_post((int)$request['id']);
        if (!$post || $post->post_status !== 'publish' || $post->post_type !== 'page') {
            return new WP_Error('not_found', 'Page not found', ['status' => 404]);
        }
        return $this->pact_response('pact:local/business@1', [$this->format_page($post, true)], 1, $request);
    }

    /**
     * Format a WP_Post (page) into a compressed PACT page item.
     *
     * @param WP_Post $post  The page post object.
     * @param bool    $full  Whether to include the full body content.
     * @return array Compressed PACT item.
     */
    private function format_page($post, $full = false) {
        $content    = apply_filters('the_content', $post->post_content);
        $plain_text = wp_strip_all_tags($content);
        $thumb      = get_the_post_thumbnail_url($post->ID, 'large');

        $item = [
            'id'     => (string)$post->ID,
            't'      => $post->post_title,
            'slug'   => $post->post_name,
            'url'    => get_permalink($post->ID),
            'upd'    => $post->post_modified_gmt,
            'sum'    => wp_trim_words($plain_text, 30, '...'),
        ];

        if ($post->post_parent > 0) {
            $item['parent'] = (string)$post->post_parent;
        }

        if ($post->menu_order > 0) {
            $item['ord'] = $post->menu_order;
        }

        if ($thumb) {
            $item['img'] = $thumb;
        }

        if ($full) {
            $item['body'] = $plain_text;
        }

        return array_filter($item, function ($v) {
            return $v !== null && $v !== '' && $v !== [];
        });
    }

    // =========================================================================
    // Custom post types
    // =========================================================================

    /**
     * Handle GET /pact/v1/{type} -- list custom post type items.
     *
     * @param WP_REST_Request $request   The incoming request.
     * @param string          $post_type The custom post type slug.
     * @return WP_REST_Response|WP_Error
     */
    public function get_custom_posts($request, $post_type) {
        $query_params = [
            'post_type'      => sanitize_key($post_type),
            'post_status'    => 'publish',
            'posts_per_page' => min((int)($request->get_param('limit') ?: 20), 50),
            'offset'         => max((int)($request->get_param('offset') ?: 0), 0),
            'orderby'        => 'date',
            'order'          => 'DESC',
        ];

        if ($q = $request->get_param('q')) {
            $query_params['s'] = sanitize_text_field($q);
        }

        $query = new WP_Query($query_params);
        $items = [];

        foreach ($query->posts as $post) {
            $items[] = $this->format_custom_post($post);
        }

        $schema_id = 'pact:custom/' . $post_type . '@1';
        return $this->pact_response($schema_id, $items, $query->found_posts, $request);
    }

    /**
     * Handle GET /pact/v1/{type}/{id} -- single custom post type item.
     *
     * @param WP_REST_Request $request   The incoming request.
     * @param string          $post_type The custom post type slug.
     * @return WP_REST_Response|WP_Error
     */
    public function get_custom_post($request, $post_type) {
        $post = get_post((int)$request['id']);
        if (!$post || $post->post_status !== 'publish' || $post->post_type !== $post_type) {
            return new WP_Error('not_found', ucfirst($post_type) . ' not found', ['status' => 404]);
        }

        $schema_id = 'pact:custom/' . $post_type . '@1';
        return $this->pact_response($schema_id, [$this->format_custom_post($post, true)], 1, $request);
    }

    /**
     * Format a custom post type into a generic PACT item.
     *
     * @param WP_Post $post  The post object.
     * @param bool    $full  Whether to include the full body content.
     * @return array Compressed PACT item.
     */
    private function format_custom_post($post, $full = false) {
        $content    = apply_filters('the_content', $post->post_content);
        $plain_text = wp_strip_all_tags($content);
        $thumb      = get_the_post_thumbnail_url($post->ID, 'large');
        $author     = get_the_author_meta('display_name', $post->post_author);

        $taxonomies = get_object_taxonomies($post->post_type, 'objects');
        $tax_data   = [];
        foreach ($taxonomies as $tax) {
            $terms = get_the_terms($post->ID, $tax->name);
            if ($terms && !is_wp_error($terms)) {
                $tax_data[$tax->label] = array_map(function ($term) {
                    return $term->name;
                }, $terms);
            }
        }

        $item = [
            'id'   => (string)$post->ID,
            't'    => $post->post_title,
            'auth' => $author,
            'pub'  => $post->post_date_gmt,
            'upd'  => $post->post_modified_gmt,
            'sum'  => wp_trim_words($plain_text, 30, '...'),
            'url'  => get_permalink($post->ID),
        ];

        if ($thumb) {
            $item['img'] = $thumb;
        }

        if (!empty($tax_data)) {
            $item['taxonomies'] = $tax_data;
        }

        // Include all custom fields (post meta), excluding internal WP meta
        $meta = get_post_meta($post->ID);
        if (!empty($meta)) {
            $custom_meta = [];
            foreach ($meta as $key => $values) {
                if (strpos($key, '_') === 0) continue;
                $custom_meta[$key] = count($values) === 1 ? $values[0] : $values;
            }
            if (!empty($custom_meta)) {
                $item['meta'] = $custom_meta;
            }
        }

        if ($full) {
            $item['body'] = $plain_text;
        }

        return array_filter($item, function ($v) {
            return $v !== null && $v !== '' && $v !== [];
        });
    }

    // =========================================================================
    // PACT envelope builder
    // =========================================================================

    /**
     * Build a standard PACT envelope response.
     *
     * @param string          $schema  The PACT schema identifier.
     * @param array           $items   Array of compressed PACT items.
     * @param int             $total   Total number of matching items.
     * @param WP_REST_Request $request The originating request.
     * @return WP_REST_Response
     */
    private function pact_response($schema, $items, $total, $request) {
        $offset = max((int)($request->get_param('offset') ?: 0), 0);
        $limit  = min((int)($request->get_param('limit') ?: 20), 50);

        $envelope = [
            '$pact' => PACT_VERSION,
            '$s'    => $schema,
            '$t'    => time(),
            '$ttl'  => 300,
            'items' => $items,
            'total' => (int)$total,
        ];

        if ($total > $offset + $limit) {
            $base_url = rest_url($request->get_route());
            $next_offset = $offset + $limit;

            // Preserve existing query parameters
            $query_args = $request->get_query_params();
            $query_args['offset'] = $next_offset;
            $query_args['limit'] = $limit;

            $envelope['page'] = [
                'offset' => $offset,
                'limit'  => $limit,
                'next'   => add_query_arg($query_args, $base_url),
            ];
        }

        $response = new WP_REST_Response($envelope, 200);
        $response->set_headers([
            'Content-Type'                 => PACT_MIME_TYPE,
            'Cache-Control'                => 'public, max-age=60',
            'Vary'                         => 'Accept',
            'X-PACT'                       => '1',
            'Access-Control-Allow-Origin'  => '*',
            'Access-Control-Allow-Methods' => 'GET, OPTIONS',
            'Access-Control-Allow-Headers' => 'Accept, Content-Type',
        ]);

        return $response;
    }
}
