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
