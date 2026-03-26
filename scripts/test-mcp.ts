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
const pageContent = await fetchPage(client, WASTE_LAND_PAGE_ID);
console.log(`notion-fetch OK — ${pageContent.length} chars`);
console.log('--- first 500 chars ---');
console.log(pageContent.slice(0, 500));
console.log('---\n');

// Test 2: search the commonplace book
console.log('Searching commonplace book for "water"...');
const searchResults = await searchNotion(client, 'water', {
  dataSourceUrl: COMMONPLACE_DATA_SOURCE,
  pageSize: 5,
});
console.log(`notion-search OK — ${searchResults.length} chars`);
console.log('--- first 500 chars ---');
console.log(searchResults.slice(0, 500));
console.log('---\n');

console.log('1b validation complete.');
await client.close();
