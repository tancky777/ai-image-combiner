import { createMcpHandler } from '@modelcontextprotocol/server';
import {
  CACHE_SECONDS,
  createServer,
  LLMS_TXT,
  parse,
  type Site,
} from './server.ts';

async function loadSite(ctx: ExecutionContext): Promise<Site> {
  const cache = caches.default;
  let response = await cache.match(LLMS_TXT);
  if (!response) {
    response = await fetch(LLMS_TXT);
    if (!response.ok) throw new Error(`llms.txt returned ${response.status}`);
    response = new Response(response.body, response);
    response.headers.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
    ctx.waitUntil(cache.put(LLMS_TXT, response.clone()));
  }
  return parse(await response.text());
}

export default {
  async fetch(request, _env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname !== '/mcp')
      return Response.redirect(
        'https://github.com/tancky777/ai-image-combiner',
        302,
      );
    if (request.method !== 'POST')
      return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    const handler = createMcpHandler(() => createServer(() => loadSite(ctx)), {
      maxRequestBodySize: 64_000,
    });
    const response = await handler.fetch(request);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  },
} satisfies ExportedHandler;
