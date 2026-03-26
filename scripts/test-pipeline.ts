#!/usr/bin/env bun
/**
 * Sub-phase 2a validation script.
 * Runs the full AI pipeline: fetch page → generate queries → search → find connections.
 * Prints output at each stage so each step can be inspected independently.
 *
 * Usage:
 *   bun scripts/test-pipeline.ts [page-id-or-url]
 *
 * Defaults to "Philosopher King & Poetry" if no argument is given.
 */

import { createMcpClient, fetchPage } from '../src/mcp/client.js';
import { generateSearchQueries, findConnections } from '../src/ai/client.js';
import { collectSearchResults } from '../src/ai/search.js';
import { DEFAULT_MODEL } from '../src/config/schema.js';
import type { Config } from '../src/types.js';

const PAGE_ID = process.argv[2] ?? '1cdd647f-2d96-80f5-8b25-e855e208b5c5';

const config: Config = {
  dataSourceUrl: 'collection://2b6d647f-2d96-8069-98e4-000b8dd7a911',
  searchMode: 'database',
  model: DEFAULT_MODEL,
};

function section(label: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(label);
  console.log('─'.repeat(60));
}

// ─── Step 0: check env ────────────────────────────────────────

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set. Export it before running this script.');
  process.exit(1);
}

console.log('--- 2a: AI pipeline validation ---\n');
console.log(`Page:  ${PAGE_ID}`);
console.log(`Model: ${config.model}`);

// ─── Step 1: connect + fetch seed page ───────────────────────

section('Step 1 — Connect to Notion MCP and fetch seed page');

const client = await createMcpClient();
console.log('Connected.');

const page = await fetchPage(client, PAGE_ID);
console.log(`Title: "${page.title}"`);
console.log(`URL:   ${page.url}`);
console.log(`Length: ${page.text.length} chars`);
console.log('\n--- first 600 chars of page text ---');
console.log(page.text.slice(0, 600));
console.log('---');

// ─── Step 2: generate search queries ─────────────────────────

section('Step 2 — Generate search queries (Claude)');

const queries = await generateSearchQueries(page.text, config.model);
console.log(`${queries.length} queries generated:`);
queries.forEach((q, i) => console.log(`  [${i + 1}] ${q}`));

// ─── Step 3: search + full page fetch ────────────────────────

section('Step 3 — Search commonplace book and fetch results');

const results = await collectSearchResults(client, queries, config);
console.log(`${results.length} unique results:`);
results.forEach((r, i) => {
  console.log(`  [${i + 1}] "${r.title}" — ${r.content.length} chars (id: ${r.id})`);
});

if (results.length > 0) {
  console.log('\n--- first result content (first 400 chars) ---');
  console.log(results[0].content.slice(0, 400));
  console.log('---');
}

// ─── Step 4: find connections (Claude) ───────────────────────

section('Step 4 — Find connections (Claude)');

const toggleMarkdown = await findConnections(page, results, config.model);
console.log(`Output: ${toggleMarkdown.length} chars`);
console.log('\n--- full Claude output ---');
console.log(toggleMarkdown);
console.log('---');

// ─── Done ─────────────────────────────────────────────────────

section('2a validation complete');
console.log('All steps passed. Review the Claude output above before proceeding to 2b.');

await client.close();
