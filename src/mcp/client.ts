import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createProvider, ensureAuthenticated, NOTION_MCP_URL } from './oauth.js';
import type { PageContent, SearchHit } from '../types.js';

export async function createMcpClient(): Promise<Client> {
  const provider = createProvider();
  await ensureAuthenticated(provider);

  const transport = new StreamableHTTPClientTransport(
    new URL(NOTION_MCP_URL),
    { authProvider: provider }
  );

  const client = new Client(
    { name: 'phanourios', version: '1.0.0' },
    { capabilities: {} }
  );

  await client.connect(transport);
  return client;
}

export async function fetchPage(client: Client, id: string): Promise<PageContent> {
  const result = await client.callTool({ name: 'notion-fetch', arguments: { id } });
  const content = result.content;
  if (!Array.isArray(content)) throw new Error('Unexpected notion-fetch response');
  const raw = content.map(c => (c.type === 'text' ? c.text : '')).join('\n');
  if (result.isError) throw new Error(`notion-fetch failed: ${raw}`);
  const parsed = JSON.parse(raw) as { title: string; url: string; text: string };
  if (!parsed?.text) throw new Error('notion-fetch: missing text field in response');
  return { title: parsed.title, url: parsed.url, text: parsed.text };
}

export async function searchNotion(
  client: Client,
  query: string,
  options: { dataSourceUrl?: string; pageSize?: number } = {}
): Promise<SearchHit[]> {
  const args: Record<string, unknown> = {
    query,
    filters: {},
    page_size: options.pageSize ?? 10,
  };
  if (options.dataSourceUrl) args.data_source_url = options.dataSourceUrl;

  const result = await client.callTool({ name: 'notion-search', arguments: args });
  const content = result.content;
  if (!Array.isArray(content)) return [];
  const raw = content.map(c => (c.type === 'text' ? c.text : '')).join('\n');
  if (result.isError) throw new Error(`notion-search failed: ${raw}`);
  const parsed = JSON.parse(raw) as { results: Array<{ id: string; title: string; url: string; highlight: string }> };
  return (parsed.results ?? []).map(r => ({
    id: r.id,
    title: r.title,
    url: r.url,
    highlight: r.highlight ?? '',
  }));
}
