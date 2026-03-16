#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { parseLlmsTxt } from './parser.js';
import { generateDiscovery } from './generator.js';

interface CliOptions {
  input: string;
  domain?: string;
  output?: string;
  pretty: boolean;
}

function printUsage(): void {
  console.log(`Usage:
  llmstxt2pact <input>                         Read file, output discovery JSON
  llmstxt2pact <input> --domain example.com    Specify domain
  llmstxt2pact <input> --output pact.json      Write to file
  llmstxt2pact https://example.com/llms.txt    Fetch from URL

Options:
  --domain <domain>   Site domain (default: inferred from URLs in llms.txt)
  --output <file>     Write to file instead of stdout
  --pretty            Pretty-print JSON (default: true)
  --no-pretty         Disable pretty-printing
  --help              Show this help message`);
}

function parseArgs(argv: string[]): CliOptions | null {
  const args = argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    return null;
  }

  const options: CliOptions = {
    input: '',
    pretty: true,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '--domain' && i + 1 < args.length) {
      options.domain = args[++i];
    } else if (arg === '--output' && i + 1 < args.length) {
      options.output = args[++i];
    } else if (arg === '--pretty') {
      options.pretty = true;
    } else if (arg === '--no-pretty') {
      options.pretty = false;
    } else if (!arg.startsWith('--')) {
      options.input = arg;
    } else {
      console.error(`Unknown option: ${arg}`);
      return null;
    }
    i++;
  }

  if (!options.input) {
    console.error('Error: No input file specified.');
    return null;
  }

  return options;
}

async function fetchUrl(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to fetch ${url}: ${resp.status} ${resp.statusText}`);
  }
  return resp.text();
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  if (!options) {
    printUsage();
    process.exit(options === null && process.argv.length > 2 ? 1 : 0);
  }

  // Read input content
  let content: string;
  if (options.input.startsWith('http://') || options.input.startsWith('https://')) {
    try {
      content = await fetchUrl(options.input);
    } catch (err) {
      console.error(`Error fetching URL: ${(err as Error).message}`);
      process.exit(1);
    }
  } else {
    try {
      content = readFileSync(options.input, 'utf-8');
    } catch (err) {
      console.error(`Error reading file: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  // Parse llms.txt content
  const parsed = parseLlmsTxt(content);

  // Generate PACT discovery document
  const discovery = generateDiscovery(parsed, options.domain);

  // Serialize
  const indent = options.pretty ? 2 : undefined;
  const json = JSON.stringify(discovery, null, indent);

  // Output
  if (options.output) {
    try {
      writeFileSync(options.output, json + '\n', 'utf-8');
      console.log(`Discovery document written to ${options.output}`);
    } catch (err) {
      console.error(`Error writing file: ${(err as Error).message}`);
      process.exit(1);
    }
  } else {
    console.log(json);
  }
}

main().catch((err) => {
  console.error(`Unexpected error: ${(err as Error).message}`);
  process.exit(1);
});
