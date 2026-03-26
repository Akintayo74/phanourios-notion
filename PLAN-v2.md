# Phanourios — Implementation Plan v2

## Context

Phanourios (`pan`) is a CLI tool for the DEV.to / Notion MCP Challenge (deadline: March 29, 2026, 11:59 PM PST). It reads a Notion page, searches the user's notes collection for related entries, uses Claude to identify connections and allusions, and appends a "Threads & Constellations" toggle list to the bottom of the page. The output lives in Notion — Notion IS the UI.

**Timeline reality:** Starting March 26. Three build days (March 26–28), ship day March 29.

---

## Key changes from v1

| Issue | v1 | v2 |
|---|---|---|
| Timeline | 5-day plan | 3 build days + 1 ship day |
| Package manager | npm (conflicted with global bun setting) | npm, overridden by project CLAUDE.md |
| Append strategy | `update_content` search-and-replace on last chunk | `update_content` always — anchor on last chunk for first write, old toggle for replace (see Write Strategy section) |
| Token budget | ~8-10K, vague | 10 results max, 300 words each, ~8K tokens |
| Query generation model | Sonnet 4.6 | Haiku 4.5 (extraction task, overkill to use Sonnet) |
| Connection model | Sonnet 4.6 | Sonnet 4.6 (system prompt tuned for it) |
| Init ordering | Day 3, undefined workaround | Manually create dev config Day 1, `pan init` Day 3 |
| Dry-run | Not planned | `--dry-run` flag added Day 2 |
| System prompt | Needs toggle + mention-page updates post-Day 1 | Update spec included in this plan |

---

## Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Runtime | Node.js | MCP SDK compatibility — no runtime risk on 3-day deadline |
| Package manager | npm | Overridden via project CLAUDE.md to avoid bun/npm conflict |
| Language | TypeScript | Three APIs with types (MCP, Anthropic, Notion) |
| Structure | Feature modules | Clear domain boundaries (mcp/, ai/, cli/, config/) |
| CLI UX | @clack/prompts | Beautiful defaults, handles prompts + spinners |
| CLI args | commander | Battle-tested, auto --help |
| Dev loop | tsx (dev), tsup (build) | Instant TypeScript execution |
| Testing | Integration test script + --dry-run | --dry-run for Day 3 iteration speed; smoke test for submission |
| Query generation model | claude-haiku-4-5-20251001 | Simple extraction task — Haiku is fast, cheap, sufficient |
| Connection finding model | claude-sonnet-4-6 (default) | System prompt tuned for it; Opus 4.6 via --model flag |
| Search | Claude (Haiku) generates 3-5 queries | Literary knowledge matters; Haiku handles extraction well |
| Token budget | 10 results max, 300 words each | ~8K tokens for search context, leaves room for seed text |
| Write strategy | `update_content` always | Structurally safe — `new_str` always contains `old_str`, so content can only grow. `replace_content` is off the table (can delete child pages, race conditions). See Write Strategy section. |
| Search scoping | `data_source_url` (collection:// URL) | `notion-search` uses `data_source_url` for database-scoped search, not database ID |
| Search filters | `filters: {}` always required | `notion-search` schema requires `filters` param even if empty |
| Re-runs | Detect existing toggle, warn, ask to replace or skip | `--replace` flag to skip prompt |
| Init flow | Minimal: auth + pick database | Store in `~/.pan/config.json` |
| API key | `ANTHROPIC_API_KEY` env var | SDK reads it automatically |
| Dry-run | `--dry-run` flag | Prints toggle to stdout instead of writing to Notion |

---

## Project structure

```
src/
  cli/
    index.ts            # Entry point, commander setup, arg parsing
    commands/
      run.ts            # pan <url> — main analysis flow orchestration
      init.ts           # pan init — OAuth + database selection
    ui.ts               # Spinners, styled output, progress display
  mcp/
    client.ts           # MCP connection lifecycle + tool calls
    oauth.ts            # OAuth flow via mcp-oauth-provider, token management
  ai/
    client.ts           # Claude API calls (query generation + connection finding)
    prompt.ts           # System prompt builder (loads system-prompt-v1.md, assembles context)
    search.ts           # Query generation — sends seed text to Haiku, returns search terms
  config/
    store.ts            # Read/write ~/.pan/config.json
    schema.ts           # Config shape, validation, defaults
  types.ts              # Shared types across modules
package.json
tsconfig.json
CLAUDE.md               # Project-level: "Use npm for this project."
system-prompt-v1.md     # System prompt (update after Day 1 toggle verification)
Project-handoff.md      # Reference document
```

---

## Dependencies

### Runtime
- `@modelcontextprotocol/sdk` — MCP client protocol
- `mcp-oauth-provider` — OAuth 2.0 + PKCE for Notion hosted MCP (verified exists)
- `@anthropic-ai/sdk` — Claude API client
- `@clack/prompts` — Interactive prompts, spinners, styled CLI output
- `chalk` — Text coloring
- `commander` — CLI argument parsing

### Dev
- `typescript`
- `tsx` — Run TypeScript directly during development
- `tsup` — Bundle for distribution
- `@types/node`

---

## Architecture: The Full Flow

### `pan init`

```
1. Check if ~/.pan/config.json exists → if yes, ask to reconfigure or exit
2. Trigger OAuth flow via mcp-oauth-provider → browser opens → user approves Notion access
3. Connect to Notion MCP server
4. List user's databases via MCP (notion-search for databases)
5. Present database list via @clack select prompt + "(search entire workspace)" option
6. Save to ~/.pan/config.json: { dataSourceUrl, searchMode, model }
7. Confirm success
```

### `pan <url>` (and `pan --dry-run <url>`)

```
1. Load config from ~/.pan/config.json → fail if missing ("Run `pan init` first")
2. Check ANTHROPIC_API_KEY → fail if missing
3. Connect to Notion MCP server (OAuth tokens handled by mcp-oauth-provider)
4. Read target page via MCP notion-fetch → extract page content as text (the "seed text")
5. Check for existing "Threads & Constellations" toggle in page content
   → If found and --replace not set: warn + ask to replace or skip
   → If found and --replace set: proceed (will replace the old toggle)
6. QUERY GENERATION: Send seed text to Claude Haiku
   → "Extract 3-5 diverse search queries from this text. Include names, phrases, thematic angles."
   → Returns: array of search strings
7. SEARCH: For each query, call MCP notion-search (with filters: {}, scoped via data_source_url or workspace-wide)
   → Deduplicate results by page ID
   → For each unique result (max 10 total), fetch page content via MCP notion-fetch
   → Truncate each page to ~300 words
   → Total context budget: ~8K tokens
8. CONNECTION FINDING: Send to Claude Sonnet
   → System prompt: system-prompt-v1.md content
   → User message: seed text + all search results with page titles and URLs
   → Returns: Notion-flavored Markdown toggle structure
9. FORMAT: Ensure output uses correct Notion markdown (verified Day 1)
10. If --dry-run: print toggle to stdout and exit
    Otherwise: WRITE via MCP notion-update-page (see Write Strategy section)
    → First write: update_content with last-chunk anchor + toggle
    → Replace: update_content with old toggle as old_str, new toggle as new_str
11. POST-WRITE VERIFICATION: fetch page again, confirm toggle exists at end
12. Display success with link to page
```

### Config shape (`~/.pan/config.json`)

```json
{
  "dataSourceUrl": "collection://2b6d647f-2d96-8069-98e4-...",
  "searchMode": "database",
  "model": "claude-sonnet-4-6"
}
```

- `dataSourceUrl`: The `collection://` URL for the user's notes database. This is what `notion-search` accepts via its `data_source_url` param. Obtained during `pan init` by fetching the selected database and reading its `<data-source url="...">` tag.
- `searchMode`: `"database"` (use `dataSourceUrl`) or `"workspace"` (search entire workspace, `dataSourceUrl` ignored)
- `model`: Default Claude model for connection finding (overridable via `--model` flag)

---

## System Prompt Updates (apply after Day 1 toggle verification)

The following changes are needed to `system-prompt-v1.md` after Day 1 confirms the correct toggle syntax:

### 1. Toggle format (update once syntax is confirmed)

Replace the example structure block with the verified Notion syntax. The current example uses standard HTML `<details>` tags with no indentation. After verification, update to match exactly what `notion-update-page` renders correctly.

### 2. Internal page links — change to `<mention-page>` tags

In the "From your notes:" source line, replace markdown links with Notion-native page chips:

**Current:**
```
*From your notes:* [Page Title](notion-url) — brief context.
```

**Updated:**
```
*From your notes:* <mention-page url="notion-url">Page Title</mention-page> — brief context.
```

Add this instruction to the Output Format section:
> For links to pages in the user's Notion workspace, use `<mention-page url="URL">Title</mention-page>` — this renders as a native Notion page chip, not a raw hyperlink.

### 3. Bold syntax

Confirm `**bold**` is used throughout, not `<strong>`. Update any examples if needed.

### 4. Remove the verification note

Remove the line:
> **Note:** The above is a structural example. The actual Notion-flavored Markdown syntax for toggles may differ from HTML `<details>` tags — verify against what the Notion MCP `notion-update-page` tool accepts and adjust accordingly.

Once Day 1 confirms the syntax, this note is noise.

---

## Write Strategy

The Notion MCP `notion-update-page` tool has NO append command. The available content commands are `update_content` (search-and-replace) and `replace_content` (full page replacement). We use **`update_content` exclusively**. `replace_content` is off the table — it can delete child pages/databases and silently overwrite concurrent edits.

### Why `update_content` is structurally safe

When `new_str` always contains `old_str` (i.e., we only add content, never remove), the operation is **incapable of deleting page content**. The worst-case failure modes:

| Scenario | What happens | Content lost? |
|---|---|---|
| Anchor unique, at end of page | Toggle appended at end. Correct. | No |
| Anchor not found | Operation fails. Page unchanged. | No |
| Anchor not unique (multiple matches) | Toggle inserted at first match. Wrong spot, but all content preserved. | No |

No scenario produces data loss. The common failure (anchor not found) is completely harmless.

### First write (no existing toggle)

1. Fetch page via `notion-fetch` — save full content as `pageContent`
2. Split `pageContent` into lines, take the last 3-5 non-empty lines as `anchor`
3. Verify `anchor` appears exactly once in `pageContent`. If not unique, widen the anchor (more lines). If zero matches (shouldn't happen), abort.
4. Call `update_content`: `old_str = anchor`, `new_str = anchor + "\n" + toggle`
5. If API rejects (match failure): inform user, no harm done

### Replace (toggle already exists)

1. Fetch page via `notion-fetch`
2. Find the existing "Threads & Constellations" toggle — from opening `<details>` to matching `</details>`
3. Call `update_content`: `old_str = old toggle`, `new_str = new toggle`
4. The old toggle is large and unique (we wrote it) — no anchor ambiguity

### Post-write verification

After every write, fetch the page again and confirm:
- The toggle exists at the end of the page
- The content above the toggle matches the pre-write content

This costs one extra API call and makes the safety guarantee observable, not just theoretical.

### API quirk: required fields

The `notion-update-page` schema marks both `properties` and `content_updates` as required for all commands. When using `update_content`, pass `properties: {}` alongside `content_updates`. Test this on Day 1.

---

## Notion Markdown Notes

Findings from the enhanced-markdown-spec (`notion://docs/enhanced-markdown-spec`):

- **Toggle syntax confirmed**: `<details>` / `<summary>` with tab-indented children. Children MUST be indented or they won't be inside the toggle.
- **Bold**: Use `**bold**`, not `<strong>`.
- **Page mentions**: `<mention-page url="URL">Title</mention-page>` renders as native Notion page chip.
- **Empty lines are stripped**: Empty lines without `<empty-block/>` are removed. Notion handles block spacing automatically, so this is rarely needed — but the system prompt example's blank lines between blocks will disappear. Accept Notion's default spacing.

---

## Safety Guarantees

1. **Claude never has MCP access.** Code reads pages via MCP, sends text to Claude, writes Claude's output via MCP. Claude receives text in, returns text out.
2. **`update_content` only, `new_str ⊇ old_str` always.** Never uses `replace_content`. Every write operation's `new_str` contains `old_str` plus the toggle — structurally incapable of deleting content. See Write Strategy section.
3. **Post-write verification.** After every write, fetches the page again and confirms the toggle exists and original content is intact.
4. **Existing toggle detection.** Before writing, checks if "Threads & Constellations" already exists. If so, warns the user.
5. **`--dry-run` for safe iteration.** Prints toggle to stdout without writing to Notion.

---

## CLAUDE.md setup (do this before Day 1)

Create `/home/akintayo74/code/phanourios-notion/CLAUDE.md`:

```markdown
# Package Manager
Use npm for this project (not bun). Global bun preference does not apply here.
MCP libraries are tested against Node/npm — no runtime risk.
```

This overrides the global `~/.claude/CLAUDE.md` for this project only. Other projects keep bun.

---

## Execution Workflow

Same sub-phase structure as v1: implement → verify → commit per sub-phase. Branch review + merge at end of each day. `/clear` between days.

---

## Day 1: Foundation (March 26 — TODAY)
**Branch: `day1-foundation`**

**Sub-phase 1a: Project scaffolding**
- [ ] Create project CLAUDE.md (npm override)
- [ ] `npm init`, `tsconfig.json`, project directory structure
- [ ] Install all dependencies
- [ ] Verify: `npx tsx src/cli/index.ts` runs without errors
- Commit: "scaffold project structure and install dependencies"

**Sub-phase 1b: MCP connection + page read**
- [ ] Get OAuth flow working with Notion's hosted MCP server via `mcp-oauth-provider`
- [ ] Read a known page via MCP `notion-fetch` — confirm content comes back
- [ ] Run a search via MCP `notion-search` — confirm results come back
- Verify: script reads a real Notion page and returns search results
- Commit: "establish MCP connection with OAuth, validate page read + search"

**Sub-phase 1c: Write validation + toggle format confirmation**
- [ ] Test `update_content` on a scratch page — confirm search-and-replace works with `properties: {}` alongside `content_updates`
- [ ] Test last-chunk anchor strategy: fetch page, grab last lines as anchor, `update_content` with `old_str = anchor`, `new_str = anchor + new content`
- [ ] Write a test toggle to a scratch page — confirm `<details><summary>` with tab-indented children renders correctly in Notion
- [ ] Test nested toggles: outer toggle with inner sub-toggles, verify indentation levels render correctly
- [ ] If toggle syntax differs from spec, find the correct syntax and document it
- Verify: toggle appears correctly in Notion UI (visual check); anchor-based append works; post-write verification confirms content integrity
- Commit: "validate toggle write format and update_content anchor strategy"

**Sub-phase 1d: Dev config**
- [ ] Manually create `~/.pan/config.json` with your own `dataSourceUrl` (`collection://2b6d647f-2d96-8069-98e4-000b8dd7a911`) and `searchMode: "database"`
- [ ] Update `system-prompt-v1.md` with confirmed toggle syntax, `<mention-page>` links, bold syntax fix, remove verification note
- Commit: "update system prompt with confirmed Notion markdown syntax"

**Branch review**: `/clear` → review full diff → fix issues → merge to main

---

## Day 2: Core Loop (March 27)
**Branch: `day2-core-loop`**

**Sub-phase 2a: Config + AI modules**
- [ ] `config/store.ts` + `config/schema.ts` — read/write `~/.pan/config.json`
- [ ] `ai/search.ts` — query generation via Haiku (send seed text, return 3-5 search terms)
- [ ] `ai/prompt.ts` — system prompt builder (loads system-prompt-v1.md, assembles context with search results)
- [ ] `ai/client.ts` — Claude API wrapper (Haiku call for queries, Sonnet call for connections; model from config/flag)
- Verify: can generate search queries from sample text; can call Claude Sonnet with assembled prompt
- Commit: "implement config management and AI client modules"

**Sub-phase 2b: MCP client module**
- [ ] `mcp/client.ts` — MCP client wrapper: connect, read page, search (with `data_source_url` scoping, `filters: {}`, 10-result cap + 300-word truncation), write toggle (anchor-based first write + old-toggle replace), post-write verification
- Verify: can read a page, run searches with `data_source_url`, write toggle via anchor strategy, verify write integrity
- Commit: "implement MCP client wrapper with search and write operations"

**Sub-phase 2c: Orchestration + first end-to-end run**
- [ ] `cli/commands/run.ts` — wire up full flow: read → query gen → search → deduplicate → connection find → write
- [ ] Add `--dry-run` flag: if set, print toggle to stdout instead of writing to Notion
- Verify: end-to-end run against a real Notion page with `--dry-run` (pipeline works; quality doesn't matter yet)
- Commit: "wire up full analysis pipeline — first end-to-end run with --dry-run support"

**Branch review**: `/clear` → review full diff → fix issues → merge to main

---

## Day 3: Polish + Ship Prep (March 28)
**Branch: `day3-polish`**

This is the compressed Days 3+4 from v1. Work top-to-bottom. If time runs short, CLI visual polish is the last priority — the core experience matters more for judging.

**Sub-phase 3a: Quality iteration**
- [ ] Run `pan --dry-run <url>` against all 3 test pages from the handoff
- [ ] Check connection quality and Notion rendering
- [ ] Refine system prompt if output needs adjustment (use --dry-run loop for speed)
- [ ] Handle edge cases: very short pages, pages with no connections, very long seed text
- [ ] Implement existing toggle detection + warn/ask/replace flow
- Verify: all 3 test pages produce good output; edge cases handled
- Commit: "refine system prompt and handle edge cases"

**Sub-phase 3b: CLI commands + UX**
- [ ] `cli/commands/init.ts` — OAuth + database selection via @clack
- [ ] `cli/ui.ts` — spinners, progress, styled output
- [ ] `cli/index.ts` — commander setup, subcommands, flags (`--replace`, `--dry-run`, `--model`)
- Verify: `pan init` completes setup flow; `pan <url>` shows progress and writes to Notion
- Commit: "implement CLI interface with init flow and styled output"

**Sub-phase 3c: Distribution + docs**
- [ ] README with setup instructions (npm install, ANTHROPIC_API_KEY, pan init, pan `<url>`)
- [ ] Integration test script (runs `pan --dry-run` against test page, verifies toggle in output)
- [ ] Clean up codebase, remove dead code
- [ ] `tsup` build, verify built CLI works
- [ ] Error messages: clear, actionable, one line each
- Verify: README instructions work from scratch; integration test passes
- Commit: "add README, integration test, and build configuration"

**Branch review**: `/clear` → review full diff → fix issues → merge to main

---

## Day 4: Ship (March 29 — deadline)

- [ ] Record demo video (`pan init`, then `pan <url>` against a real page, toggle appearing in Notion)
- [ ] Write DEV.to submission post using the story framing from the handoff
- [ ] Final repo review, push to GitHub
- [ ] Submit before 11:59 PM PST

---

## Verification

### During development (manual)
- `pan --dry-run <url>` → verify toggle output in terminal (fast iteration loop)
- `pan <url>` → verify toggle appears correctly in Notion
- `pan <url>` again → verify warning about existing toggle
- `pan <url> --replace` → verify toggle replaced without prompt
- `pan <url> --model claude-opus-4-6` → verify Opus is used
- Without `ANTHROPIC_API_KEY` → verify clear error
- Without config → verify "run pan init first"

### Integration test script
- Runs `pan --dry-run` against "The Secret Commonwealth" test page
- Verifies stdout contains "Threads & Constellations"
- Verifies at least one sub-toggle is present
- No Notion write — no cleanup needed

### Test pages
- "The Secret Commonwealth" — expected: Eliot/Waste Land, Auden, Hozier, Pullman
- "Poetry attempt" — expected: Naomi Shihab Nye, Ethics
- "Katniss, Aza, Lyra, Britomart" — expected: Purpose, Letter to Suzanne Collins

---

## Open risks

1. **Anchor uniqueness on very short pages**: If a page has only a title and one short line, the anchor may be trivially short. Mitigation: for very short pages, the anchor IS the entire content, which is unique by definition. Test this edge case Day 1.
2. **mcp-oauth-provider on Linux**: OAuth callback opens a browser. Verify Day 1 sub-phase 1b.
3. **Notion MCP rate limits**: Multiple searches per run. Monitor during Day 2 testing; add delay between calls if needed.
4. **`properties: {}` required alongside `content_updates`**: The `notion-update-page` schema marks both as required for all commands. Verify this doesn't cause issues Day 1 sub-phase 1c.
5. **Day 3 time compression**: Days 3+4 merged. If 3a (prompt iteration) runs long, trim CLI visual polish (3b) and skip integration test script in 3c — manual smoke test is sufficient for submission.
