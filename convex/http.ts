import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { APP_VERSION } from './shared/version';
import { auth } from './auth';

const http = httpRouter();
auth.addHttpRoutes(http);
http.route({
  path: '/version',
  method: 'GET',
  handler: httpAction(
    async () =>
      new Response(JSON.stringify({ version: APP_VERSION }), {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json; charset=utf-8',
        },
      }),
  ),
});

export default http;
