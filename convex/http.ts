import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { BACKEND_INFO, PRODUCT_VERSION } from './shared/version';
import { auth } from './auth';
import { registerPublicApi } from './publicApi/gateway';

const http = httpRouter();
auth.addHttpRoutes(http);
registerPublicApi(http);
http.route({
  path: '/version',
  method: 'GET',
  handler: httpAction(
    async () =>
      new Response(JSON.stringify({ productVersion: PRODUCT_VERSION, ...BACKEND_INFO }), {
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
