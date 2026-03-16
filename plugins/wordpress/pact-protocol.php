<?php
/**
 * Plugin Name: PACT Protocol
 * Plugin URI: https://pact-protocol.dev
 * Description: Serve structured, AI-optimized content via the PACT protocol. Auto-generates /.well-known/pact.json and PACT data endpoints.
 * Version: 1.0.0
 * Author: PACT Working Group
 * License: Apache-2.0
 * Text Domain: pact-protocol
 */

if (!defined('ABSPATH')) exit;

define('PACT_VERSION', '1.0');
define('PACT_MIME_TYPE', 'application/pact+json');
define('PACT_PLUGIN_DIR', plugin_dir_path(__FILE__));

// Include classes
require_once PACT_PLUGIN_DIR . 'includes/class-pact-discovery.php';
require_once PACT_PLUGIN_DIR . 'includes/class-pact-endpoint.php';
require_once PACT_PLUGIN_DIR . 'includes/class-pact-schema.php';

// Initialize
add_action('init', 'pact_init');
add_action('rest_api_init', 'pact_register_routes');

function pact_init() {
    // Register rewrite rule for /.well-known/pact.json
    add_rewrite_rule(
        '\.well-known/pact\.json$',
        'index.php?pact_discovery=1',
        'top'
    );
    add_filter('query_vars', function($vars) {
        $vars[] = 'pact_discovery';
        return $vars;
    });
    add_action('template_redirect', function() {
        if (get_query_var('pact_discovery')) {
            $discovery = new PACT_Discovery();
            header('Content-Type: application/json');
            header('Cache-Control: public, max-age=3600');
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: GET, OPTIONS');
            header('Access-Control-Allow-Headers: Accept, Content-Type');
            echo json_encode($discovery->generate(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            exit;
        }
    });
}

function pact_register_routes() {
    $endpoint = new PACT_Endpoint();
    $endpoint->register();

    $schema = new PACT_Schema();
    $schema->register();
}

// Flush rewrite rules on activation
register_activation_hook(__FILE__, function() {
    pact_init();
    flush_rewrite_rules();
});

register_deactivation_hook(__FILE__, function() {
    flush_rewrite_rules();
});
