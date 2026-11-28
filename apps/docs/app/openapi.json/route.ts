import { openApiDocument } from '@/lib/api';

export const dynamic = 'force-static';

/** The OpenAPI 3.1 document (same generator as the API's /api/v1/openapi.json). */
export function GET() {
  return Response.json(openApiDocument());
}
