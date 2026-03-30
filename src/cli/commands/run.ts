import { createMcpClient, fetchPage, writeToggle } from '../../mcp/client.js';
import { generateSearchQueries, findConnections } from '../../ai/client.js';
import { collectSearchResults } from '../../ai/search.js';
import { readConfig } from '../../config/store.js';
import { DEFAULT_MODEL } from '../../config/schema.js';
import { withSpinner, intro, outro, note, log, confirm, isCancel } from '../ui.js';
import type { Config } from '../../types.js';

const QUERY_MODEL = 'claude-haiku-4-5-20251001';
const TOGGLE_MARKER = '<details>\n<summary>**Threads & Constellations**</summary>';

export interface RunOptions {
  dryRun?: boolean;
  model?: string;
  replace?: boolean;
}

async function spinnerStep<T>(
  startMsg: string,
  fn: () => Promise<T>,
  stopMsg: string | ((r: T) => string),
): Promise<T> {
  try {
    return await withSpinner(startMsg, fn, stopMsg);
  } catch (err) {
    // withSpinner already called s.error() with the message
    outro('Exited.');
    throw err;
  }
}

export async function runCommand(url: string, options: RunOptions): Promise<void> {
  intro('Phanourios');

  // Pre-flight: config
  let config: Config;
  try {
    config = readConfig();
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    outro('Exited.');
    process.exit(1);
  }

  // Pre-flight: API key — prefer env var, fall back to config
  if (!process.env.ANTHROPIC_API_KEY && config.anthropicApiKey) {
    process.env.ANTHROPIC_API_KEY = config.anthropicApiKey;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    log.error('Anthropic API key not found. Set ANTHROPIC_API_KEY or run `pan init` to configure it.');
    outro('Exited.');
    process.exit(1);
  }

  const model = options.model ?? config!.model ?? DEFAULT_MODEL;

  // Connect
  const mcpClient = await spinnerStep(
    'Connecting to Notion...',
    () => createMcpClient(),
    'Connected',
  );

  try {
    // Read page
    const page = await spinnerStep(
      'Reading page...',
      () => fetchPage(mcpClient, url),
      (p) => `"${p.title}"`,
    );

    // Detect existing toggle
    const hasExistingToggle = page.text.includes(TOGGLE_MARKER);
    if (hasExistingToggle && !options.dryRun) {
      if (options.replace) {
        log.info('Existing toggle found — replacing.');
      } else {
        const shouldReplace = await confirm({
          message: '"Threads & Constellations" already exists on this page. Replace it?',
        });
        if (isCancel(shouldReplace) || !shouldReplace) {
          outro('Skipped.');
          return;
        }
      }
    }

    // Generate search queries
    const queries = await spinnerStep(
      'Generating search queries...',
      () => generateSearchQueries(page.text, QUERY_MODEL),
      'Queries generated',
    );
    log.step(queries.join(' · '));

    // Search notes
    const results = await spinnerStep(
      'Searching your notes...',
      () => collectSearchResults(mcpClient, queries, config!),
      (r) => `${r.length} note${r.length === 1 ? '' : 's'} found`,
    );

    // Find connections
    const toggle = await spinnerStep(
      'Finding connections — this takes a moment...',
      () => findConnections(page, results, model),
      (t) => t.includes(TOGGLE_MARKER) ? 'Connections found' : 'Analysis complete',
    );

    const hasConnections = toggle.includes(TOGGLE_MARKER);
    const isWellFormed = toggle.trimEnd().endsWith('</details>');

    // No connections or malformed toggle — show reasoning and exit without writing
    if (!hasConnections || !isWellFormed) {
      log.warn(toggle);
      outro('Done — no connections written.');
      return;
    }

    // Dry-run path
    if (options.dryRun) {
      log.message(toggle);
      outro('Dry run complete.');
      return;
    }

    // Write toggle
    const action = await spinnerStep(
      'Writing to Notion...',
      () => writeToggle(mcpClient, url, toggle),
      (a) => `Toggle ${a}`,
    );

    // Verify write
    await spinnerStep(
      'Verifying write...',
      async () => {
        const pageAfter = await fetchPage(mcpClient, url);
        if (!pageAfter.text.includes(TOGGLE_MARKER)) {
          throw new Error('Post-write verification failed: toggle not found in page after write.');
        }
        return pageAfter;
      },
      'Verified',
    );

    const pageUrl = page.url.startsWith('http')
      ? page.url
      : `https://www.notion.so/${page.url}`;
    note(pageUrl, 'Your page is ready');
    outro('Done.');
  } finally {
    await mcpClient.close();
  }
}
