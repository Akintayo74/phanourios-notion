import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createProvider, ensureAuthenticated, NOTION_MCP_URL } from './oauth.js';
import type { PageContent, SearchHit } from '../types.js';

const TOGGLE_MARKER = '<details>\n<summary>**Threads & Constellations**</summary>';

function stripPageTag(text: string): string {
  return text.replace(/^<page>\n?/, '').replace(/\n?<\/page>$/, '');
}

/**
 * Walk forward from startIndex counting <details>/<\/details> depth.
 * Returns the index immediately after the matching </details>, or null if
 * the toggle is malformed (no matching close found).
 */
function findToggleEnd(content: string, startIndex: number): number | null {
  let depth = 0;
  let i = startIndex;
  while (i < content.length) {
    if (content.startsWith('<details>', i)) {
      depth++;
      i += 9;
    } else if (content.startsWith('</details>', i)) {
      depth--;
      i += 10;
      if (depth === 0) return i;
    } else {
      i++;
    }
  }
  return null;
}

/**
 * Extract a bare page UUID from either a full Notion URL or a UUID string
 * (with or without dashes). notion-update-page requires a UUID — it rejects URLs.
 */
function extractPageId(idOrUrl: string): string {
  const match = idOrUrl.match(/[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/i);
  if (!match) throw new Error(`Cannot extract page UUID from: ${idOrUrl}`);
  return match[0];
}

/**
 * Return the substring of content that begins at the first of the last N
 * non-empty lines and runs to the end, preserving any blank lines in between.
 * Returns empty string if content has no non-empty lines.
 */
function getAnchor(content: string, n: number): string {
  const lines = content.split('\n');
  let count = 0;
  let startIndex = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim().length > 0) {
      count++;
      startIndex = i;
      if (count >= n) break;
    }
  }
  if (count === 0) return '';
  return lines.slice(startIndex).join('\n');
}

async function _connect(provider: ReturnType<typeof createProvider>): Promise<Client> {
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

export async function createMcpClient(): Promise<Client> {
  const provider = createProvider();
  await ensureAuthenticated(provider);
  try {
    return await _connect(provider);
  } catch (err) {
    // Safety net: token expired between the expiry check and the first connect.
    // Re-run ensureAuthenticated (attempts silent refresh, then browser if needed)
    // and retry the connection once.
    if (err instanceof Error && err.message === 'Unauthorized') {
      await ensureAuthenticated(provider);
      return await _connect(provider);
    }
    throw err;
  }
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
    max_highlight_length: 500,
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

/**
 * Append or replace the "Threads & Constellations" toggle on a Notion page.
 *
 * - If no existing toggle is found: appends after the last 3 non-empty lines.
 * - If a well-formed toggle is found: replaces it in place.
 * - If a malformed toggle is found (no matching </details>): appends rather
 *   than risk overwriting content the user may have added after the broken toggle.
 *
 * Returns 'appended' or 'replaced' for CLI feedback.
 * See docs/write-back-strategy.md for full decision rationale.
 */
export async function writeToggle(
  client: Client,
  pageId: string,
  toggleMarkdown: string,
): Promise<'appended' | 'replaced'> {
  const page = await fetchPage(client, pageId);
  const content = stripPageTag(page.text);
  const uuid = extractPageId(pageId);

  if (content.includes('<blank-page>')) {
    throw new Error('Page is blank — add some content before running Phanourios.');
  }

  const markerIndex = content.indexOf(TOGGLE_MARKER);

  let old_str: string;
  let new_str: string;
  let action: 'appended' | 'replaced';

  if (markerIndex !== -1) {
    const toggleEnd = findToggleEnd(content, markerIndex);
    if (toggleEnd !== null) {
      // Well-formed existing toggle — replace it in place
      old_str = content.slice(markerIndex, toggleEnd);
      new_str = toggleMarkdown;
      action = 'replaced';
    } else {
      // Malformed toggle — append rather than overwrite
      const anchor = getAnchor(content, 3);
      if (!anchor) throw new Error('Page is empty — nothing to anchor the write to.');
      old_str = anchor;
      new_str = anchor + '\n\n' + toggleMarkdown;
      action = 'appended';
    }
  } else {
    // No existing toggle — append
    const anchor = getAnchor(content, 3);
    if (!anchor) throw new Error('Page is empty — nothing to anchor the write to.');
    old_str = anchor;
    new_str = anchor + '\n\n' + toggleMarkdown;
    action = 'appended';
  }

  const result = await client.callTool({
    name: 'notion-update-page',
    arguments: {
      page_id: uuid,
      command: 'update_content',
      properties: {},
      content_updates: [{ old_str, new_str }],
    },
  });

  const rawContent = Array.isArray(result.content)
    ? result.content.map((c: { type: string; text?: string }) => (c.type === 'text' ? c.text ?? '' : '')).join('\n')
    : '';
  if (result.isError) throw new Error(`notion-update-page failed: ${rawContent}`);

  return action;
}
