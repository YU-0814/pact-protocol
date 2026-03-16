#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  validateDiscovery,
  validateSchema,
  validateResponse,
  validateConformance,
} from './validator.js';
import type { PactSchema } from '@pact-protocol/core';
import type { ValidationResult } from './validator.js';

// ANSI color helpers
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function printUsage(): void {
  console.log(`
${BOLD}pact-validate${RESET} - PACT Protocol Validator

${BOLD}Usage:${RESET}
  pact-validate <file-or-url> [options]

${BOLD}Options:${RESET}
  --type <type>       Validation type: discovery, schema, response, conformance
  --schema <file>     Schema file for response validation
  --help              Show this help message

${BOLD}Examples:${RESET}
  pact-validate discovery.json
  pact-validate --type discovery https://example.com/.well-known/pact.json
  pact-validate --type response response.json --schema schema.json
  pact-validate --type conformance discovery.json
`);
}

function parseArgs(argv: string[]): {
  target?: string;
  type?: string;
  schemaFile?: string;
  help: boolean;
} {
  const args = argv.slice(2);
  let target: string | undefined;
  let type: string | undefined;
  let schemaFile: string | undefined;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--type' || arg === '-t') {
      type = args[++i];
    } else if (arg === '--schema' || arg === '-s') {
      schemaFile = args[++i];
    } else if (!arg.startsWith('-')) {
      target = arg;
    }
  }

  return { target, type, schemaFile, help };
}

function autoDetectType(data: unknown): string {
  if (typeof data !== 'object' || data === null) {
    return 'unknown';
  }
  const obj = data as Record<string, unknown>;

  if ('pact' in obj && 'site' in obj && 'endpoints' in obj) {
    return 'discovery';
  }
  if ('$schema' in obj && 'id' in obj && 'keys' in obj) {
    return 'schema';
  }
  if ('$pact' in obj && '$s' in obj) {
    return 'response';
  }
  return 'unknown';
}

async function loadData(target: string): Promise<unknown> {
  if (target.startsWith('http://') || target.startsWith('https://')) {
    const response = await fetch(target);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  const filePath = resolve(target);
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function printResult(result: ValidationResult, type: string): void {
  console.log('');
  console.log(`${BOLD}Validation: ${type}${RESET}`);
  console.log('─'.repeat(50));

  if (result.valid) {
    console.log(`${GREEN}\u2713 Valid${RESET}`);
  } else {
    console.log(`${RED}\u2717 Invalid${RESET}`);
  }

  if (result.errors.length > 0) {
    console.log('');
    console.log(`${RED}${BOLD}Errors (${result.errors.length}):${RESET}`);
    for (const error of result.errors) {
      console.log(`  ${RED}\u2717${RESET} [${error.code}] ${error.path}`);
      console.log(`    ${error.message}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log('');
    console.log(`${YELLOW}${BOLD}Warnings (${result.warnings.length}):${RESET}`);
    for (const warning of result.warnings) {
      console.log(`  ${YELLOW}!${RESET} [${warning.code}] ${warning.path}`);
      console.log(`    ${warning.message}`);
    }
  }

  console.log('');
  const levelColor = result.conformanceLevel === 'none' ? RED : GREEN;
  console.log(
    `${CYAN}Conformance Level:${RESET} ${levelColor}${BOLD}${result.conformanceLevel}${RESET}`
  );
  console.log('');
}

async function main(): Promise<void> {
  const { target, type, schemaFile, help } = parseArgs(process.argv);

  if (help || !target) {
    printUsage();
    process.exit(help ? 0 : 1);
  }

  let data: unknown;
  try {
    data = await loadData(target);
  } catch (err) {
    console.error(
      `${RED}\u2717 Failed to load "${target}": ${(err as Error).message}${RESET}`
    );
    process.exit(1);
  }

  const validationType = type ?? autoDetectType(data);

  let result: ValidationResult;

  switch (validationType) {
    case 'discovery': {
      result = validateDiscovery(data);
      printResult(result, 'Discovery');
      break;
    }
    case 'schema': {
      result = validateSchema(data);
      printResult(result, 'Schema');
      break;
    }
    case 'response': {
      let schema: PactSchema | undefined;
      if (schemaFile) {
        try {
          const schemaData = await loadData(schemaFile);
          schema = schemaData as PactSchema;
        } catch (err) {
          console.error(
            `${RED}\u2717 Failed to load schema "${schemaFile}": ${(err as Error).message}${RESET}`
          );
          process.exit(1);
        }
      }
      result = validateResponse(data, schema);
      printResult(result, 'Response');
      break;
    }
    case 'conformance': {
      result = validateConformance(data);
      printResult(result, 'Conformance');
      break;
    }
    default: {
      console.error(
        `${RED}\u2717 Could not auto-detect type. Use --type to specify: discovery, schema, response, conformance${RESET}`
      );
      process.exit(1);
    }
  }

  process.exit(result!.valid ? 0 : 1);
}

main();
