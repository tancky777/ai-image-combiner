# Tancky AI MCP server

Read-only remote MCP server for [Tancky AI](https://tancky.io), deployed as a standalone Cloudflare Worker at `https://tancky-mcp.tancky777-482.workers.dev/mcp`.

It keeps no copy of the site's data. Tools and guides are parsed from [tancky.io/llms.txt](https://tancky.io/llms.txt) and cached for one hour, so new pages on the site appear without a redeploy.

The tools live in `src/server.ts`. `src/index.ts` serves them from the Worker over Streamable HTTP, and `src/stdio.ts` serves the same tools over stdio for local clients (`node src/stdio.ts`, Node.js 22.18 or later).

## Develop and deploy

```bash
cd mcp
npm install
npm run dev       # http://localhost:8787/mcp
npm run typecheck
npm run deploy    # needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID
```

## Publish to the MCP Registry

Bump `version` in `../server.json`, then run the **Publish to MCP Registry** workflow from the Actions tab.
