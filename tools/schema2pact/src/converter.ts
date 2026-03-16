import { abbreviateAll } from './abbreviator.js';

// Types matching @pact-protocol/core PactSchema and PactKeyDef
export interface PactKeyDef {
  full: string;
  type: 'string' | 'number' | 'boolean' | 'url' | 'object' | 'array' | 'integer';
  required?: boolean;
  layer?: 'media' | 'action';
  default?: unknown;
  range?: [number, number];
}

export interface PactSchema {
  $schema: string;
  id: string;
  description: string;
  keys: Record<string, PactKeyDef>;
}

// Schema.org property type to PACT type mapping
const TYPE_MAP: Record<string, PactKeyDef['type']> = {
  'Text': 'string',
  'Number': 'number',
  'Integer': 'integer',
  'Boolean': 'boolean',
  'URL': 'url',
  'Date': 'string',
  'DateTime': 'string',
  'Time': 'string',
  'ImageObject': 'url',
  'MonetaryAmount': 'number',
};

export interface SchemaOrgInput {
  type: string;           // e.g., "Product", "Article", "Restaurant"
  properties: Record<string, {
    type?: string;
    description?: string;
    required?: boolean;
  }>;
}

// Infer a PACT domain from a Schema.org type name
function inferDomain(typeName: string): string {
  const domainMap: Record<string, string> = {
    Product: 'commerce',
    Article: 'news',
    Restaurant: 'food',
    Event: 'events',
    JobPosting: 'jobs',
    LocalBusiness: 'local',
    Recipe: 'food',
    Course: 'education',
    Movie: 'media',
    Book: 'media',
    MusicRecording: 'media',
    SoftwareApplication: 'software',
    Place: 'travel',
    Hotel: 'travel',
    RealEstateListing: 'realestate',
  };
  return domainMap[typeName] ?? 'general';
}

// Convert a Schema.org-style type definition to a PACT schema
export function convertToPact(input: SchemaOrgInput, domain?: string, version?: number): PactSchema {
  const resolvedDomain = domain ?? inferDomain(input.type);
  const ver = version ?? 1;
  const typeLower = input.type.toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  const schemaId = `pact:${resolvedDomain}/${typeLower}@${ver}`;

  const fieldNames = Object.keys(input.properties);
  const abbreviations = abbreviateAll(fieldNames);

  const keys: Record<string, PactKeyDef> = {};

  for (const [fieldName, fieldDef] of Object.entries(input.properties)) {
    const abbrev = abbreviations[fieldName];
    const pactType = fieldDef.type ? (TYPE_MAP[fieldDef.type] ?? 'string') : 'string';

    const keyDef: PactKeyDef = {
      full: fieldName,
      type: pactType,
    };

    if (fieldDef.required) {
      keyDef.required = true;
    }

    keys[abbrev] = keyDef;
  }

  return {
    $schema: 'https://pact-protocol.org/schema/v1',
    id: schemaId,
    description: `PACT schema for ${input.type} (converted from Schema.org)`,
    keys,
  };
}

// Well-known Schema.org types with their common properties
export const KNOWN_TYPES: Record<string, SchemaOrgInput> = {
  Product: {
    type: 'Product',
    properties: {
      name: { type: 'Text', required: true },
      price: { type: 'Number', required: true },
      currency: { type: 'Text' },
      image: { type: 'URL' },
      url: { type: 'URL' },
      brand: { type: 'Text' },
      description: { type: 'Text' },
      sku: { type: 'Text' },
      rating: { type: 'Number' },
      reviewCount: { type: 'Integer' },
      availability: { type: 'Text' },
      category: { type: 'Text' },
    }
  },
  Article: {
    type: 'Article',
    properties: {
      title: { type: 'Text', required: true },
      author: { type: 'Text' },
      datePublished: { type: 'DateTime', required: true },
      dateModified: { type: 'DateTime' },
      description: { type: 'Text' },
      articleBody: { type: 'Text' },
      image: { type: 'URL' },
      url: { type: 'URL' },
      publisher: { type: 'Text' },
      category: { type: 'Text' },
      language: { type: 'Text' },
    }
  },
  Restaurant: {
    type: 'Restaurant',
    properties: {
      name: { type: 'Text', required: true },
      cuisine: { type: 'Text' },
      priceRange: { type: 'Text' },
      rating: { type: 'Number' },
      reviewCount: { type: 'Integer' },
      address: { type: 'Text' },
      telephone: { type: 'Text' },
      openingHours: { type: 'Text' },
      image: { type: 'URL' },
      url: { type: 'URL' },
      latitude: { type: 'Number' },
      longitude: { type: 'Number' },
      servesCuisine: { type: 'Text' },
    }
  },
  Event: {
    type: 'Event',
    properties: {
      name: { type: 'Text', required: true },
      startDate: { type: 'DateTime', required: true },
      endDate: { type: 'DateTime' },
      location: { type: 'Text' },
      description: { type: 'Text' },
      image: { type: 'URL' },
      url: { type: 'URL' },
      organizer: { type: 'Text' },
      price: { type: 'Number' },
      currency: { type: 'Text' },
    }
  },
  JobPosting: {
    type: 'JobPosting',
    properties: {
      title: { type: 'Text', required: true },
      hiringOrganization: { type: 'Text', required: true },
      jobLocation: { type: 'Text' },
      description: { type: 'Text' },
      datePosted: { type: 'DateTime' },
      validThrough: { type: 'DateTime' },
      baseSalary: { type: 'Number' },
      employmentType: { type: 'Text' },
      url: { type: 'URL' },
      remote: { type: 'Boolean' },
    }
  },
};
