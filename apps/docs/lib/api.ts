/**
 * API reference data, derived from the same OpenAPI document the API serves at
 * /api/v1/openapi.json (generated from convex/publicApi/routes.ts).
 */
import { buildOpenApiDocument } from '@convex/publicApi/openapi';
import { API_BASE_PATH, API_REVISION, ROUTES, TAGS, type RouteDef } from '@convex/publicApi/routes';

export type Schema = {
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  anyOf?: Schema[];
  oneOf?: Schema[];
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  description?: string;
  default?: unknown;
  pattern?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  additionalProperties?: unknown;
  $ref?: string;
};

export type Field = {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  constraints: string[];
  children?: Field[];
};

export type Endpoint = {
  id: string;
  method: RouteDef['method'];
  path: string;
  summary: string;
  description?: string;
  scope: string | null;
  tag: string;
  pathParams: Field[];
  queryParams: Field[];
  body: Field[] | null;
  bodyExample: unknown;
  response: Field[];
  responseExample: unknown;
  status: number;
  list: boolean;
  idempotent: boolean;
};

export const API_EXAMPLE_ORIGIN = 'https://<deployment>.convex.site';

export function openApiDocument() {
  return buildOpenApiDocument({
    apiOrigin: process.env.DOCS_API_ORIGIN ?? API_EXAMPLE_ORIGIN,
    authOrigin: process.env.DOCS_AUTH_ORIGIN ?? 'https://<your-finapp-web>',
  });
}

export function typeLabel(schema: Schema | undefined): string {
  if (!schema) return 'any';
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  const variants = schema.anyOf ?? schema.oneOf;
  if (variants) return [...new Set(variants.map(typeLabel))].join(' | ');
  const type = Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type;
  if (type === 'array') return `${typeLabel(schema.items)}[]`;
  if (type === 'integer') return 'integer';
  if (type === 'object' && !schema.properties) return 'object';
  return type ?? 'any';
}

function constraints(schema: Schema): string[] {
  const out: string[] = [];
  const target = (schema.anyOf ?? []).find((item) => item.type !== 'null') ?? schema;
  if (target.pattern === '^\\d{1,19}$') out.push('integer string (minor units)');
  else if (target.pattern === '^[A-Za-z]{3}$') out.push('ISO 4217 code');
  if (target.format) out.push(target.format);
  if (target.minimum !== undefined && target.maximum !== undefined)
    out.push(`${target.minimum}–${target.maximum}`);
  if (target.maxLength !== undefined) out.push(`max ${target.maxLength} chars`);
  if (target.maxItems !== undefined) out.push(`max ${target.maxItems} items`);
  if (schema.default !== undefined) out.push(`default ${JSON.stringify(schema.default)}`);
  if ((schema.anyOf ?? []).some((item) => item.type === 'null')) out.push('nullable');
  return out;
}

function fields(schema: Schema | undefined, depth = 0): Field[] {
  if (!schema?.properties) return [];
  return Object.entries(schema.properties).map(([name, property]) => {
    const inner =
      property.type === 'array'
        ? property.items
        : (property.anyOf?.find((s) => s.properties) ?? property);
    return {
      name,
      type: typeLabel(property),
      required: (schema.required ?? []).includes(name),
      description: property.description,
      constraints: constraints(property),
      children: depth < 2 && inner?.properties ? fields(inner, depth + 1) : undefined,
    };
  });
}

export function exampleFromSchema(schema: Schema | undefined, name = '', depth = 0): unknown {
  if (!schema || depth > 4) return null;
  if (schema.const !== undefined) return schema.const;
  if (schema.enum) return schema.enum[0];
  if (schema.default !== undefined) return schema.default;
  const variants = schema.anyOf ?? schema.oneOf;
  if (variants)
    return exampleFromSchema(
      variants.find((v) => v.type !== 'null'),
      name,
      depth,
    );
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case 'object':
      return schema.properties
        ? Object.fromEntries(
            Object.entries(schema.properties).map(([key, value]) => [
              key,
              exampleFromSchema(value, key, depth + 1),
            ]),
          )
        : {};
    case 'array':
      return [exampleFromSchema(schema.items, name, depth + 1)];
    case 'integer':
    case 'number':
      return /At$|Date$|nextOccurrence/.test(name) ? 1764288000000 : 1;
    case 'boolean':
      return true;
    case 'string':
      if (/Minor$/.test(name) || schema.pattern?.includes('\\d')) return '12550';
      if (name === 'currency') return 'INR';
      if (name === 'id' || /Id$/.test(name)) return `${name.replace(/Id$/, '') || 'doc'}_id`;
      if (name === 'nextCursor') return null;
      return name || 'string';
    default:
      return null;
  }
}

/** All endpoints grouped by tag, in registry order. */
export function apiReference() {
  const doc = openApiDocument() as unknown as {
    paths: Record<string, Record<string, Record<string, unknown>>>;
  };
  const endpoints: Endpoint[] = ROUTES.map((route) => {
    const operation = doc.paths[route.path]![route.method.toLowerCase()]! as {
      parameters: (Schema & { name?: string; in?: string; required?: boolean; schema?: Schema })[];
      requestBody?: { content: { 'application/json': { schema: Schema; example?: unknown } } };
      responses: Record<string, { content?: { 'application/json': { schema: Schema } } }>;
    };
    const params = (where: string) =>
      operation.parameters
        .filter((param) => param.in === where)
        .map((param) => ({
          name: param.name!,
          type: typeLabel(param.schema),
          required: Boolean(param.required),
          description: param.description,
          constraints: param.schema ? constraints(param.schema) : [],
        }));
    const bodySchema = operation.requestBody?.content['application/json'].schema;
    const responseSchema =
      operation.responses[String(route.status ?? 200)]?.content?.['application/json'].schema;
    const dataSchema = route.list
      ? responseSchema?.properties?.data?.items
      : (responseSchema?.properties?.data ?? responseSchema);
    return {
      id: route.id,
      method: route.method,
      path: route.path,
      summary: route.summary,
      description: route.description,
      scope: route.scope,
      tag: route.tag,
      pathParams: params('path'),
      queryParams: params('query'),
      body: bodySchema ? fields(bodySchema) : null,
      bodyExample:
        operation.requestBody?.content['application/json'].example ??
        (bodySchema ? exampleFromSchema(bodySchema) : null),
      response: fields(dataSchema),
      responseExample: exampleFromSchema(responseSchema),
      status: route.status ?? 200,
      list: Boolean(route.list),
      idempotent: route.method === 'POST' && route.kind === 'mutation',
    };
  });
  return TAGS.map((tag) => ({
    ...tag,
    endpoints: endpoints.filter((endpoint) => endpoint.tag === tag.name),
  })).filter((tag) => tag.endpoints.length);
}

function examplePath(endpoint: Endpoint) {
  return endpoint.path.replace(/\{(\w+)\}/g, (_match, name: string) =>
    name === 'resource' ? 'transactions' : `${name.replace(/Id$/, '')}_id`,
  );
}

/** curl / JavaScript / Python samples for one endpoint. */
export function samples(endpoint: Endpoint) {
  const url = `${API_EXAMPLE_ORIGIN}${API_BASE_PATH}${examplePath(endpoint) === '/' ? '' : examplePath(endpoint)}`;
  const auth = endpoint.scope !== null;
  const body = endpoint.body ? JSON.stringify(endpoint.bodyExample, null, 2) : null;
  const idem = endpoint.idempotent;
  const curl = [
    `curl -X ${endpoint.method} "${url}"`,
    ...(auth ? ['  -H "Authorization: Bearer $FINAPP_TOKEN"'] : []),
    ...(body ? ['  -H "Content-Type: application/json"'] : []),
    ...(idem ? ['  -H "Idempotency-Key: $(uuidgen)"'] : []),
    ...(body ? [`  -d '${body.replace(/'/g, "'\\''")}'`] : []),
  ].join(' \\\n');
  const jsHeaders = [
    ...(auth ? ['    Authorization: `Bearer ${process.env.FINAPP_TOKEN}`,'] : []),
    ...(body ? ["    'Content-Type': 'application/json',"] : []),
    ...(idem ? ["    'Idempotency-Key': crypto.randomUUID(),"] : []),
  ];
  const js = [
    `const response = await fetch('${url}', {`,
    `  method: '${endpoint.method}',`,
    ...(jsHeaders.length ? ['  headers: {', ...jsHeaders, '  },'] : []),
    ...(body ? [`  body: JSON.stringify(${body.replace(/\n/g, '\n  ')}),`] : []),
    '});',
    'if (!response.ok) throw new Error((await response.json()).error.message);',
    'const { data } = await response.json();',
  ].join('\n');
  const pyHeaders = [
    ...(auth ? ['"Authorization": f"Bearer {os.environ[\'FINAPP_TOKEN\']}"'] : []),
    ...(idem ? ['"Idempotency-Key": str(uuid.uuid4())'] : []),
  ];
  const python = [
    `import os${idem ? ', uuid' : ''}`,
    'import requests',
    '',
    `response = requests.${endpoint.method.toLowerCase()}(`,
    `    "${url}",`,
    ...(pyHeaders.length ? [`    headers={${pyHeaders.join(', ')}},`] : []),
    ...(body
      ? [
          `    json=${body
            .replace(/\btrue\b/g, 'True')
            .replace(/\bfalse\b/g, 'False')
            .replace(/\bnull\b/g, 'None')
            .replace(/\n/g, '\n    ')},`,
        ]
      : []),
    ')',
    'response.raise_for_status()',
    'data = response.json()["data"]',
  ].join('\n');
  return [
    { label: 'curl', lang: 'bash', code: curl },
    { label: 'JavaScript', lang: 'javascript', code: js },
    { label: 'Python', lang: 'python', code: python },
  ];
}

export { API_BASE_PATH, API_REVISION };
