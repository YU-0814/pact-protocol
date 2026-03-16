import type { PactSchema } from './types.js';

export class SchemaRegistry {
  private schemas: Map<string, PactSchema> = new Map();

  register(schema: PactSchema): void {
    this.schemas.set(schema.id, schema);
  }

  get(id: string): PactSchema | undefined {
    return this.schemas.get(id);
  }

  list(): string[] {
    return Array.from(this.schemas.keys());
  }

  getKeyMap(schemaId: string): Map<string, string> {
    const schema = this.schemas.get(schemaId);
    if (!schema) {
      return new Map();
    }
    const map = new Map<string, string>();
    for (const [abbr, def] of Object.entries(schema.keys)) {
      map.set(abbr, def.full);
    }
    return map;
  }

  getReverseKeyMap(schemaId: string): Map<string, string> {
    const schema = this.schemas.get(schemaId);
    if (!schema) {
      return new Map();
    }
    const map = new Map<string, string>();
    for (const [abbr, def] of Object.entries(schema.keys)) {
      map.set(def.full, abbr);
    }
    return map;
  }
}
