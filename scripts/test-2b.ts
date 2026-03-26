#!/usr/bin/env bun
/**
 * Sub-phase 2b validation script.
 *
 * Creates scratch pages under a new parent page, then validates writeToggle:
 *   1. Blank page      → must throw "Page is blank" error
 *   2. Content page    → first write returns 'appended'
 *   3. Same page again → second write returns 'replaced'
 *
 * No CLI args needed. Pages are left for manual inspection (URLs printed at end).
 */

import { createMcpClient, fetchPage, writeToggle } from '../src/mcp/client.js';

// ── Mock toggles ───────────────────────────────────────────────────────────

const MOCK_TOGGLE_V1 = `<details>
<summary>**Threads & Constellations**</summary>
\t<details>
\t<summary>**Test connection — first write**</summary>
\tThis is a mock connection written by the 2b validation script (first run).
\t*Beyond your notes:* Mock Author — Mock Work, Chapter 1.
\t</details>
</details>`;

const MOCK_TOGGLE_V2 = `<details>
<summary>**Threads & Constellations**</summary>
\t<details>
\t<summary>**Test connection — second write (replace)**</summary>
\tThis is a mock connection written by the 2b validation script (second run).
\tIf you see this and not the first-write version, replace is working correctly.
\t*Beyond your notes:* Mock Author — Mock Work, Chapter 2.
\t</details>
</details>`;

const CONTENT_PAGE_BODY = `These are reading notes for a test passage.

The second thought extends the first in an interesting way.

This is the final line — the anchor will latch onto these last three lines.`;

// ── Helpers ────────────────────────────────────────────────────────────────

function section(label: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(label);
  console.log('─'.repeat(60));
}

function parseToolResult(result: { content: unknown; isError?: boolean }): string {
  const content = result.content;
  if (!Array.isArray(content)) throw new Error('Unexpected tool response shape');
  const raw = content
    .map((c: { type: string; text?: string }) => (c.type === 'text' ? c.text ?? '' : ''))
    .join('\n');
  if (result.isError) throw new Error(`Tool call failed: ${raw}`);
  return raw;
}

function parseCreatedPages(raw: string): Array<{ id: string; url: string }> {
  const parsed = JSON.parse(raw) as
    | { results?: Array<{ id: string; url: string }>; pages?: Array<{ id: string; url: string }> }
    | Array<{ id: string; url: string }>;
  const items = Array.isArray(parsed)
    ? parsed
    : (parsed.results ?? parsed.pages ?? []);
  return items.map(r => ({ id: r.id, url: r.url }));
}

// ── Setup ──────────────────────────────────────────────────────────────────

console.log('--- 2b: write-back validation ---\n');

const client = await createMcpClient();
console.log('Connected to Notion MCP.');

section('Creating scratch pages');

// Scratch parent at workspace level
const parentRaw = parseToolResult(await client.callTool({
  name: 'notion-create-pages',
  arguments: {
    pages: [{ properties: { title: 'Phanourios 2b Test Scratch' } }],
  },
}));
const [scratchParent] = parseCreatedPages(parentRaw);
console.log(`Scratch parent: ${scratchParent.url}`);

// Test pages under the parent
const pagesRaw = parseToolResult(await client.callTool({
  name: 'notion-create-pages',
  arguments: {
    parent: { type: 'page_id', page_id: scratchParent.id },
    pages: [
      { properties: { title: 'Test: Blank page' } },
      { properties: { title: 'Test: Content page' }, content: CONTENT_PAGE_BODY },
    ],
  },
}));
const [blankPage, contentPage] = parseCreatedPages(pagesRaw);
console.log(`Blank page:   ${blankPage.url}`);
console.log(`Content page: ${contentPage.url}`);

// ── Tests ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function pass(msg: string) { console.log(`✓ ${msg}`); passed++; }
function fail(msg: string) { console.log(`✗ ${msg}`); failed++; }

// Test 1: blank page → error
section('Test 1 — blank page should throw');
try {
  await writeToggle(client, blankPage.id, MOCK_TOGGLE_V1);
  fail('Expected error but writeToggle returned without throwing');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.toLowerCase().includes('blank')) {
    pass(`Threw expected error: "${msg}"`);
  } else {
    fail(`Threw wrong error: "${msg}"`);
  }
}

// Test 2: content page, first write → 'appended'
section('Test 2 — first write on content page (expect: appended)');
const result1 = await writeToggle(client, contentPage.id, MOCK_TOGGLE_V1);
result1 === 'appended'
  ? pass(`writeToggle returned '${result1}'`)
  : fail(`Expected 'appended', got '${result1}'`);

const after1 = await fetchPage(client, contentPage.id);
after1.text.includes('first write')
  ? pass('V1 toggle text present in page')
  : fail('V1 toggle text missing from page');

// Test 3: same page, second write → 'replaced'
section('Test 3 — second write on same page (expect: replaced)');
const result2 = await writeToggle(client, contentPage.id, MOCK_TOGGLE_V2);
result2 === 'replaced'
  ? pass(`writeToggle returned '${result2}'`)
  : fail(`Expected 'replaced', got '${result2}'`);

const after2 = await fetchPage(client, contentPage.id);
const toggleCount = (after2.text.match(/Threads & Constellations/g) ?? []).length;

!after2.text.includes('first write')
  ? pass('V1 toggle text removed')
  : fail('V1 toggle text still present (replace failed)');
after2.text.includes('second write (replace)')
  ? pass('V2 toggle text present')
  : fail('V2 toggle text missing');
toggleCount === 1
  ? pass(`Exactly 1 toggle in page (count: ${toggleCount})`)
  : fail(`Expected 1 toggle, found ${toggleCount}`);

// ── Summary ────────────────────────────────────────────────────────────────

section('Summary');
console.log(`${passed} passed, ${failed} failed`);
console.log(`\nScratch parent for manual inspection:\n  ${scratchParent.url}`);

await client.close();
