# Pending Verification

Items that could not be verified due to the Anthropic API key not yet being configured.
Remove each entry once verified and clean up any associated hardcoded values.

---

## Sub-phase 2a — AI pipeline (`scripts/test-pipeline.ts`)

**Blocked by:** Anthropic API key not set up.

**To verify:** Once `ANTHROPIC_API_KEY` is exported, run:

```
bun scripts/test-pipeline.ts
```

**What to check:**
1. **Step 2 (query generation)** — are the queries varied and sensible, or repetitive/generic?
2. **Step 3 (search results)** — do result `content` fields have real text? This confirms `fetchPage` works with a bare UUID (no dashes) from search results — untested path as of Day 1.
3. **Step 4 (Claude output)** — is the toggle structure valid Notion-flavored markdown?

**Hardcoded values to remove after verification:**

| File | Value | Notes |
|---|---|---|
| `scripts/test-pipeline.ts` | Default page ID `1cdd647f-2d96-80f5-8b25-e855e208b5c5` (Philosopher King & Poetry) | Fine to keep as a default for ongoing testing |
| `scripts/test-pipeline.ts` | Hardcoded commonplace book `dataSourceUrl` and `searchMode` | Fine to keep — this is a test script, not production code |

These values are appropriate for a test script and do not need to be removed — they just need to be confirmed to produce correct output.

---

## Sub-phase 2c — Empty search result content (fix in 3a)

**Discovered:** 2026-03-27, first end-to-end dry-run.

**Problem:** `collectSearchResults` fetches the full body text of each matched page via `notion-fetch`. For database entries in the commonplace book, content lives in *properties* (title, quote text, tags), not in Notion body blocks. `notion-fetch` returns blank/empty body text for these pages, so Claude receives titles and URLs but no actual content to connect against.

**Evidence:** 8 search results returned, Claude reported "no content was returned for any of them." Output still produced 4 connections — all from wider tradition knowledge, none from the commonplace book notes.

**Fix (sub-phase 3a):** In `ai/search.ts` → `collectSearchResults`, preserve the `highlight` field from each `SearchHit` (already returned by `notion-search`). When a fetched page's body text is blank or contains only `<blank-page>`, fall back to the search highlight as the `content` field in `SearchResult`. The `highlight` is a text snippet of matching content extracted by the search engine itself — it will contain the relevant fragment even when the body is empty.

**File to change:** `src/ai/search.ts` — `collectSearchResults` function. Also update `src/types.ts` `SearchResult` if needed.

---

## Sub-phase 2b — Write-back (`scripts/test-2b.ts`)

**Automated tests: passed (2026-03-26).** All 7 assertions passed:
- Blank page throws the expected error
- First write on content page returns `'appended'`
- Second write on same page returns `'replaced'`
- V1 toggle text absent after replace, V2 present, exactly 1 toggle in page

**Remaining manual check:** confirm the toggle renders correctly as a closed toggle in Notion's UI. The test script creates scratch pages and prints their URL — open the content page and verify.

**To re-run at any time:**
```
bun scripts/test-2b.ts
```
(No args — the script creates its own scratch pages under a new workspace-level parent.)
