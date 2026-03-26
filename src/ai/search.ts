import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Config, SearchResult } from '../types.js';
import { searchNotion, fetchPage } from '../mcp/client.js';

/**
 * Run each query through Notion MCP search, deduplicate results by page ID,
 * fetch the full content of every matched page, and return up to maxResults
 * unique results.
 *
 * See docs/search-content-strategy.md for the reasoning behind full fetches.
 */
export async function collectSearchResults(
  mcpClient: Client,
  queries: string[],
  config: Config,
  maxResults = 8,
): Promise<SearchResult[]> {
  const seen = new Set<string>();
  const hits: Array<{ id: string; title: string; url: string }> = [];

  const searchOptions =
    config.searchMode === 'database'
      ? { dataSourceUrl: config.dataSourceUrl, pageSize: 10 }
      : { pageSize: 10 };

  // Collect unique search hits across all queries
  for (const query of queries) {
    if (hits.length >= maxResults) break;

    let results;
    try {
      results = await searchNotion(mcpClient, query, searchOptions);
    } catch {
      // A single failed search should not abort the whole run
      continue;
    }

    for (const hit of results) {
      if (hits.length >= maxResults) break;
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);
      hits.push({ id: hit.id, title: hit.title, url: hit.url });
    }
  }

  // Fetch full content for every hit in parallel
  const settled = await Promise.allSettled(
    hits.map(async (hit) => {
      const page = await fetchPage(mcpClient, hit.id);
      return {
        id: hit.id,
        title: hit.title,
        url: hit.url,
        content: page.text,
      } satisfies SearchResult;
    }),
  );

  return settled
    .filter((r): r is PromiseFulfilledResult<SearchResult> => r.status === 'fulfilled')
    .map(r => r.value);
}
