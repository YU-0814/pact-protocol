/**
 * Generate a Claude Desktop MCP configuration object for a PACT site.
 *
 * Usage:
 *   const config = generateMcpConfig('https://example.com');
 *   // Write to ~/Library/Application Support/Claude/claude_desktop_config.json
 */
export function generateMcpConfig(siteUrl: string, name?: string): object {
  return {
    mcpServers: {
      [name || 'pact-bridge']: {
        command: 'npx',
        args: ['@pact-protocol/mcp-bridge', siteUrl],
      },
    },
  };
}
