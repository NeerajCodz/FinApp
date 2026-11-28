/** Generates the OpenAPI 3.1 document from the route registry (pure; used by the API and docs). */
import { z } from 'zod';
import { API_BASE_PATH, API_REVISION, ROUTES, TAGS, type RouteDef } from './routes';
import { API_SCOPES, SCOPE_DESCRIPTIONS } from './scopes';
import { WEBHOOK_EVENT_DESCRIPTIONS } from './webhookEvents';

type JsonSchema = Record<string, unknown>;

function schemaOf(type: z.ZodType, io: 'input' | 'output'): JsonSchema {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(type, {
    io,
    unrepresentable: 'any',
    target: 'draft-2020-12',
  }) as JsonSchema;
  return schema;
}

function parametersOf(route: RouteDef) {
  const parameters: JsonSchema[] = [];
  for (const [location, shape] of [
    ['path', route.params],
    ['query', route.query],
  ] as const) {
    if (!shape) continue;
    const schema = schemaOf(shape, 'input') as {
      properties?: Record<string, JsonSchema>;
      required?: string[];
    };
    for (const [name, property] of Object.entries(schema.properties ?? {})) {
      const { description, ...rest } = property;
      parameters.push({
        name,
        in: location,
        required: location === 'path' || (schema.required ?? []).includes(name),
        ...(typeof description === 'string' ? { description } : {}),
        schema: rest,
      });
    }
  }
  if (route.method === 'POST' && route.kind === 'mutation')
    parameters.push({ $ref: '#/components/parameters/IdempotencyKey' });
  return parameters;
}

function responseSchema(route: RouteDef): JsonSchema {
  const data = schemaOf(route.response, 'output');
  if (route.id === 'getOpenApi' || route.id === 'getApiInfo') return data;
  return route.list
    ? {
        type: 'object',
        required: ['data', 'hasMore', 'nextCursor'],
        properties: {
          data: { type: 'array', items: data },
          hasMore: { type: 'boolean' },
          nextCursor: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
            description: 'Pass as `cursor` to fetch the next page; null on the last page.',
          },
        },
      }
    : { type: 'object', required: ['data'], properties: { data } };
}

function operationOf(route: RouteDef) {
  const errors = route.scope
    ? ['400', '401', '403', '404', '409', '422', '429', '500']
    : ['429', '500'];
  return {
    operationId: route.id,
    summary: route.summary,
    ...(route.description ? { description: route.description } : {}),
    tags: [route.tag],
    security: route.scope ? [{ bearerAuth: [] }, { oauth2: [route.scope] }] : [],
    ...(route.scope ? { 'x-required-scope': route.scope } : {}),
    parameters: parametersOf(route),
    ...(route.body
      ? {
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: schemaOf(route.body, 'input'),
                ...(route.example ? { example: route.example } : {}),
              },
            },
          },
        }
      : {}),
    responses: {
      [String(route.status ?? 200)]: {
        description: route.status === 201 ? 'Created' : 'OK',
        headers: route.scope
          ? {
              'X-Request-Id': { $ref: '#/components/headers/X-Request-Id' },
              'X-RateLimit-Limit': { $ref: '#/components/headers/X-RateLimit-Limit' },
              'X-RateLimit-Remaining': { $ref: '#/components/headers/X-RateLimit-Remaining' },
              'X-RateLimit-Reset': { $ref: '#/components/headers/X-RateLimit-Reset' },
            }
          : undefined,
        content: { 'application/json': { schema: responseSchema(route) } },
      },
      ...Object.fromEntries(
        errors.map((status) => [status, { $ref: `#/components/responses/Error${status}` }]),
      ),
    },
  };
}

const ERROR_DESCRIPTIONS: Record<string, string> = {
  '400': 'Invalid request (validation failed, malformed cursor or JSON).',
  '401': 'Missing, invalid, expired or revoked credentials.',
  '403': 'The token lacks the required scope, or the resource is not accessible.',
  '404': 'Resource not found.',
  '409': 'Conflict (the resource changed, or a limit was reached).',
  '422': 'The request was understood but rejected by a business rule.',
  '429': 'Rate limited. Wait `Retry-After` seconds.',
  '500': 'Unexpected server error.',
};

export type OpenApiOptions = { apiOrigin?: string; authOrigin?: string };

export function buildOpenApiDocument(options: OpenApiOptions = {}) {
  const apiOrigin = (options.apiOrigin ?? 'https://api.finapp.example').replace(/\/$/, '');
  const authOrigin = (options.authOrigin ?? apiOrigin).replace(/\/$/, '');
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of ROUTES) {
    (paths[route.path] ??= {})[route.method.toLowerCase()] = operationOf(route);
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'FinApp API',
      version: `v1 (${API_REVISION})`,
      description:
        'The public FinApp REST API. Authenticate with a personal access token (`fa_pat_…`) or an OAuth access token (`fa_oat_…`) in the `Authorization: Bearer` header. Amounts are integer strings in minor units.',
    },
    servers: [{ url: `${apiOrigin}${API_BASE_PATH}` }],
    tags: TAGS,
    paths,
    webhooks: Object.fromEntries(
      Object.entries(WEBHOOK_EVENT_DESCRIPTIONS).map(([type, description]) => [
        type,
        {
          post: {
            summary: type,
            description,
            parameters: [
              {
                name: 'FinApp-Signature',
                in: 'header',
                required: true,
                schema: { type: 'string' },
                description: '`t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">`',
              },
            ],
            requestBody: {
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } },
            },
            responses: { '200': { description: 'Any 2xx acknowledges the event.' } },
          },
        },
      ]),
    ),
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'A personal access token (`fa_pat_…`) created in Settings → Developer.',
        },
        oauth2: {
          type: 'oauth2',
          description: 'OAuth 2.1 authorization code flow with PKCE (S256) for third-party apps.',
          flows: {
            authorizationCode: {
              authorizationUrl: `${authOrigin}/oauth/authorize`,
              tokenUrl: `${authOrigin}/oauth/token`,
              refreshUrl: `${authOrigin}/oauth/token`,
              scopes: Object.fromEntries(
                API_SCOPES.map((scope) => [scope, SCOPE_DESCRIPTIONS[scope]]),
              ),
            },
          },
        },
      },
      parameters: {
        IdempotencyKey: {
          name: 'Idempotency-Key',
          in: 'header',
          required: false,
          description:
            'Up to 255 printable ASCII characters. Retrying with the same key within 24 hours returns the original response instead of applying the change again.',
          schema: { type: 'string', maxLength: 255 },
        },
      },
      headers: {
        'X-Request-Id': { schema: { type: 'string' }, description: 'Unique id for this request.' },
        'X-RateLimit-Limit': { schema: { type: 'integer' }, description: 'Bucket capacity.' },
        'X-RateLimit-Remaining': { schema: { type: 'integer' }, description: 'Requests left now.' },
        'X-RateLimit-Reset': {
          schema: { type: 'integer' },
          description: 'Seconds until the bucket is full again.',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message', 'requestId'],
              properties: {
                code: { type: 'string', examples: ['invalid_request'] },
                message: { type: 'string' },
                requestId: { type: 'string' },
                details: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { path: { type: 'string' }, message: { type: 'string' } },
                  },
                },
                requiredScope: { type: 'string' },
              },
            },
          },
        },
        Event: {
          type: 'object',
          required: ['id', 'type', 'apiVersion', 'createdAt', 'data'],
          properties: {
            id: { type: 'string', examples: ['evt_3ZbC…'] },
            type: { type: 'string' },
            apiVersion: { type: 'string', const: 'v1' },
            createdAt: { type: 'integer' },
            data: { type: 'object' },
          },
        },
      },
      responses: Object.fromEntries(
        Object.entries(ERROR_DESCRIPTIONS).map(([status, description]) => [
          `Error${status}`,
          {
            description,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        ]),
      ),
    },
  };
}
