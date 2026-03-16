#!/usr/bin/env node

// Usage:
//   schema2pact Product                    -> outputs pact:commerce/product@1 schema
//   schema2pact Product --domain commerce  -> same with explicit domain
//   schema2pact Article --domain news      -> outputs pact:news/article@1
//   schema2pact custom.json --domain food  -> reads custom JSON input
//   schema2pact --list                     -> lists known Schema.org types
//
// Options:
//   --domain <domain>    PACT domain (default: inferred from type)
//   --version <n>        Schema version (default: 1)
//   --output <file>      Write to file instead of stdout
//   --list               List available built-in types

import { readFileSync, writeFileSync } from 'node:fs';
import { convertToPact, KNOWN_TYPES } from './converter.js';
import type { SchemaOrgInput } from './converter.js';

function parseArgs(argv: string[]): {
  input?: string;
  domain?: string;
  version?: number;
  output?: string;
  list: boolean;
} {
  const result: ReturnType<typeof parseArgs> = { list: false };
  const args = argv.slice(2); // skip node and script path

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--list') {
      result.list = true;
    } else if (arg === '--domain' && i + 1 < args.length) {
      result.domain = args[++i];
    } else if (arg === '--version' && i + 1 < args.length) {
      result.version = parseInt(args[++i], 10);
    } else if (arg === '--output' && i + 1 < args.length) {
      result.output = args[++i];
    } else if (!arg.startsWith('--')) {
      result.input = arg;
    }
  }

  return result;
}

function printUsage(): void {
  console.log(`schema2pact - Convert Schema.org types to PACT schema format

Usage:
  schema2pact <TypeName>                   Convert a known Schema.org type
  schema2pact <file.json> --domain <d>     Convert a custom JSON definition
  schema2pact --list                       List available built-in types

Options:
  --domain <domain>    PACT domain (default: inferred from type)
  --version <n>        Schema version (default: 1)
  --output <file>      Write to file instead of stdout
  --list               List available built-in types

Examples:
  schema2pact Product
  schema2pact Article --domain news
  schema2pact custom.json --domain food --version 2
  schema2pact Event --output event-schema.json`);
}

function listTypes(): void {
  console.log('Available built-in Schema.org types:\n');
  for (const [typeName, def] of Object.entries(KNOWN_TYPES)) {
    const requiredFields = Object.entries(def.properties)
      .filter(([, v]) => v.required)
      .map(([k]) => k);
    const fieldCount = Object.keys(def.properties).length;
    const reqStr = requiredFields.length > 0
      ? ` (required: ${requiredFields.join(', ')})`
      : '';
    console.log(`  ${typeName} — ${fieldCount} fields${reqStr}`);
  }
}

function main(): void {
  const opts = parseArgs(process.argv);

  if (opts.list) {
    listTypes();
    return;
  }

  if (!opts.input) {
    printUsage();
    process.exit(1);
  }

  let schemaInput: SchemaOrgInput;

  // Check if input is a known type name
  if (KNOWN_TYPES[opts.input]) {
    schemaInput = KNOWN_TYPES[opts.input];
  } else if (opts.input.endsWith('.json')) {
    // Try reading as a JSON file
    try {
      const raw = readFileSync(opts.input, 'utf-8');
      schemaInput = JSON.parse(raw) as SchemaOrgInput;
    } catch (err) {
      console.error(`Error reading file "${opts.input}": ${(err as Error).message}`);
      process.exit(1);
    }
  } else {
    console.error(`Unknown type "${opts.input}". Use --list to see available types, or provide a .json file.`);
    process.exit(1);
  }

  const pactSchema = convertToPact(schemaInput, opts.domain, opts.version);
  const jsonOutput = JSON.stringify(pactSchema, null, 2);

  if (opts.output) {
    writeFileSync(opts.output, jsonOutput + '\n', 'utf-8');
    console.log(`Schema written to ${opts.output}`);
  } else {
    console.log(jsonOutput);
  }
}

main();
