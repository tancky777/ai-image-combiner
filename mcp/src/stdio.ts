import { serveStdio } from '@modelcontextprotocol/server/stdio';
import {
  CACHE_SECONDS,
  createServer,
  LLMS_TXT,
  parse,
  type Site,
} from './server.ts';

// 本地 stdio 入口，供 Claude Desktop 等客户端直接运行：node mcp/src/stdio.ts
// 与 Worker 共用同一套工具，llms.txt 在进程内缓存一小时
let cached: { site: Site; expires: number } | undefined;

async function loadSite(): Promise<Site> {
  if (cached && cached.expires > Date.now()) return cached.site;
  const response = await fetch(LLMS_TXT);
  if (!response.ok) throw new Error(`llms.txt returned ${response.status}`);
  const site = parse(await response.text());
  cached = { site, expires: Date.now() + CACHE_SECONDS * 1000 };
  return site;
}

serveStdio(() => createServer(loadSite));
