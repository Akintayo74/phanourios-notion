#!/usr/bin/env bun
/**
 * Sub-phase 1b validation script.
 * Confirms: OAuth flow works, notion-fetch returns content, notion-search returns results.
 * Run: bun scripts/test-mcp.ts
 */

import { createMcpClient, fetchPage, searchNotion } from '../src/mcp/client.js';

const WASTE_LAND_PAGE_ID = 'd393750c-e0ad-4fc3-92d7-b4bb834cae8b';
const COMMONPLACE_DATA_SOURCE = 'collection://2b6d647f-2d96-8069-98e4-000b8dd7a911';

console.log('--- 1b: MCP connection validation ---\n');

const client = await createMcpClient();
console.log('Connected to Notion MCP.\n');

// Test 1: fetch a known page
console.log(`Fetching page ${WASTE_LAND_PAGE_ID}...`);
const page = await fetchPage(client, WASTE_LAND_PAGE_ID);
console.log(`notion-fetch OK — title: "${page.title}", ${page.text.length} chars`);
console.log('--- first 500 chars of text ---');
console.log(page.text.slice(0, 500));
console.log('---\n');

// Test 2: search the commonplace book
console.log('Searching commonplace book for "water"...');
const hits = await searchNotion(client, 'water', {
  dataSourceUrl: COMMONPLACE_DATA_SOURCE,
  pageSize: 5,
});
console.log(`notion-search OK — ${hits.length} results`);
hits.forEach((h, i) => console.log(`  [${i + 1}] ${h.title} (id: ${h.id})`));
console.log('');

console.log('1b validation complete.');
await client.close();
