import { confirm, isCancel } from '@clack/prompts';
import { createMcpClient, fetchPage, writeToggle } from '../../mcp/client.js';
import { generateSearchQueries, findConnections } from '../../ai/client.js';
import { collectSearchResults } from '../../ai/search.js';
import { readConfig } from '../../config/store.js';
import { DEFAULT_MODEL } from '../../config/schema.js';

const QUERY_MODEL = 'claude-haiku-4-5-20251001';
const TOGGLE_MARKER = '<details>\n<summary>**Threads & Constellations**</summary>';

export interface RunOptions {
  dryRun?: boolean;
  model?: string;
  replace?: boolean;
}

export async function runCommand(url: string, options: RunOptions): Promise<void> {
  // 1. Load config
  const config = readConfig();

  // 2. Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set.');
  }

  const model = options.model ?? config.model ?? DEFAULT_MODEL;

  // 3. Connect to Notion MCP
  console.log('Connecting to Notion...');
  const mcpClient = await createMcpClient();

  try {
    // 4. Read target page
    console.log('Reading page...');
    const page = await fetchPage(mcpClient, url);
    console.log(`Page: "${page.title}"`);

    // 5. Detect existing toggle — warn/ask/replace
    const hasExistingToggle = page.text.includes(TOGGLE_MARKER);
    if (hasExistingToggle && !options.dryRun) {
      if (options.replace) {
        console.log('Existing toggle found — replacing.');
      } else {
        const shouldReplace = await confirm({
          message: '"Threads & Constellations" already exists on this page. Replace it?',
        });
        if (isCancel(shouldReplace) || !shouldReplace) {
          console.log('Skipped.');
          return;
        }
      }
    }

    // 6. Generate search queries via Haiku
    console.log('Generating search queries...');
    const queries = await generateSearchQueries(page.text, QUERY_MODEL);
    console.log(`Queries: ${queries.join(' | ')}`);

    // 7. Search commonplace book + fetch page content
    console.log(`Searching notes (${config.searchMode} mode)...`);
    const results = await collectSearchResults(mcpClient, queries, config);
    console.log(`Found ${results.length} relevant note(s).`);

    // 8. Find connections via Sonnet
    console.log(`Finding connections (${model})...`);
    const toggle = await findConnections(page, results, model);

    // 9. Dry-run: print and exit
    if (options.dryRun) {
      console.log('\n--- Dry run output ---\n');
      console.log(toggle);
      console.log('\n--- End dry run ---');
      return;
    }

    // 10. Write toggle to page
    console.log('Writing to Notion...');
    const action = await writeToggle(mcpClient, url, toggle);

    // 11. Post-write verification: re-fetch and confirm toggle is present
    const pageAfter = await fetchPage(mcpClient, url);
    if (!pageAfter.text.includes(TOGGLE_MARKER)) {
      throw new Error('Post-write verification failed: toggle not found in page after write.');
    }

    // 12. Success
    const pageUrl = page.url.startsWith('http')
      ? page.url
      : `https://www.notion.so/${page.url}`;
    console.log(`\nDone! Toggle ${action}:`);
    console.log(pageUrl);
  } finally {
    await mcpClient.close();
  }
}
