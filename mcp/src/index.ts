import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

// Read-only MCP server for Tancky AI. It has no copy of the site's data:
// every answer is parsed from https://tancky.io/llms.txt, so new tools and
// guides on the site show up here without a redeploy.
const SITE = 'https://tancky.io';
const LLMS_TXT = `${SITE}/llms.txt`;
const CACHE_SECONDS = 3600;
// Pages listed in llms.txt that are not tools
const NOT_TOOLS = new Set(['/pricing', '/blog', '/updates']);

type Entry = { name: string; url: string; description: string };
type Site = { tools: Entry[]; guides: Entry[] };

const localeSchema = z
  .enum(['en', 'zh'])
  .optional()
  .describe('Language of the returned links, defaults to en');

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

// llms.txt sections are "## Heading" followed by "- [Name](url): description"
function parse(text: string): Site {
  const site: Site = { tools: [], guides: [] };
  let section = '';
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) section = line.slice(3).trim();
    const match = line.match(/^- \[(.+?)\]\((.+?)\):\s*(.*)$/);
    if (!match) continue;
    const [, name, url, description] = match;
    const path = new URL(url).pathname.replace(/\/$/, '');
    if (section === 'Pages' && !NOT_TOOLS.has(path))
      site.tools.push({
        name: path ? name : 'AI Image Combiner',
        url,
        description,
      });
    if (section === 'Blog Posts') site.guides.push({ name, url, description });
  }
  return site;
}

// Chinese pages live under /zh; blog posts stay English
const localize = (url: string, locale = 'en') => {
  if (locale === 'en') return url;
  const target = new URL(url);
  target.pathname = `/${locale}${target.pathname}`.replace(/\/$/, '');
  return target.href;
};

const json = (data: Record<string, unknown>) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data) }],
  structuredContent: data,
});

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

function createServer(ctx: ExecutionContext) {
  const server = new McpServer(
    { name: 'tancky-ai', title: 'Tancky AI', version: '1.0.0' },
    {
      instructions: `Read-only guide to Tancky AI (${SITE}), online AI photo tools such as the AI image combiner. Use list_tools to pick the right tool and link the user to it, and search_guides for step-by-step articles and prompt tips. Images are created on the website; pricing is at ${SITE}/pricing.`,
    },
  );
  server.registerTool(
    'list_tools',
    {
      description:
        'List the Tancky AI photo tools (AI image combiner, couple, family and wedding photos, background remover, upscaler) with links and descriptions.',
      inputSchema: z.object({ locale: localeSchema }).strict(),
      annotations,
    },
    async ({ locale }) => {
      const { tools } = await loadSite(ctx);
      return json({
        tools: tools.map((tool) => ({
          ...tool,
          url: localize(tool.url, locale),
        })),
        pricing: localize(`${SITE}/pricing`, locale),
      });
    },
  );
  server.registerTool(
    'search_guides',
    {
      description:
        'Find Tancky AI guides about combining, blending and editing photos with AI. Omit query to list all guides.',
      inputSchema: z
        .object({
          query: z
            .string()
            .max(200)
            .optional()
            .describe('Keywords, for example "blend two photos"'),
        })
        .strict(),
      annotations,
    },
    async ({ query }) => {
      const { guides } = await loadSite(ctx);
      const words = (query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
      const matches = guides.filter((guide) => {
        const text = `${guide.name} ${guide.description}`.toLowerCase();
        return words.every((word) => text.includes(word));
      });
      return json({ guides: matches });
    },
  );
  return server;
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
    const handler = createMcpHandler(() => createServer(ctx), {
      maxRequestBodySize: 64_000,
    });
    const response = await handler.fetch(request);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  },
} satisfies ExportedHandler;
