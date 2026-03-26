# Phanourios — Implementation Plan

## Context

Phanourios (`pan`) is a CLI tool for the DEV.to / Notion MCP Challenge (deadline: March 29, 2026). It reads a Notion page, searches the user's notes collection for related entries, uses Claude to identify connections and allusions, and appends a "Threads & Constellations" toggle list to the bottom of the page. The output lives in Notion — Notion IS the UI.

The project handoff (`Project-handoff.md`) and system prompt (`system-prompt-v1.md`) are fully written. No code exists yet. This plan covers the complete build from zero to submission.

---

## Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Runtime | Node.js + npm | MCP SDK compatibility on a 5-day deadline |
| Language | TypeScript | Three APIs with types (MCP, Anthropic, Notion) |
| Structure | Feature modules | Clear domain boundaries (mcp/, ai/, cli/, config/) |
| CLI UX | @clack/prompts | Beautiful defaults, handles prompts + spinners. Colors TBD during prototyping |
| CLI args | commander | Battle-tested, auto --help, zero surprises |
| Dev loop | tsx (dev), tsup (build) | Instant TypeScript execution, no build step during development |
| Testing | Integration test script | One smoke test against a real Notion page; unit tests only if time allows |
| Workflow | Branches + lightweight Claude review | Branch per chunk, `gh pr diff main \| claude` before merge, no formal PRs |
| AI provider | Anthropic only, Sonnet 4.6 default | Prompt tuned for Claude; Opus 4.6 via `--model` flag |
| Search | Claude generates 3-5 queries | Literary knowledge matters for query diversity |
| Error handling | Fail fast + retry transient | One retry on timeouts/rate limits; clear messages for permanent failures |
| Toggle format | `<details><summary>` with tab-indented children | Confirmed via Notion MCP enhanced-markdown-spec |
| Append strategy | `update_content` search-and-replace | Find last chunk of page, expand to include toggle |
| Re-runs | Detect existing toggle, warn, ask to replace or skip | `--replace` flag to skip the prompt |
| Init flow | Minimal: auth + pick database | Store in `~/.pan/config.json` |
| API key | `ANTHROPIC_API_KEY` env var | SDK reads it automatically; no secrets in config files |

---

## Project Structure

```
src/
  cli/
    index.ts            # Entry point, commander setup, arg parsing
    commands/
      run.ts            # pan <url> — main analysis flow orchestration
      init.ts           # pan init — OAuth + database selection
    ui.ts               # Spinners, styled output, progress display
  mcp/
    client.ts           # MCP connection lifecycle + tool calls (read page, search, update page)
    oauth.ts            # OAuth flow via mcp-oauth-provider, token management
  ai/
    client.ts           # Claude API calls (query generation + connection finding)
    prompt.ts           # System prompt builder (loads system-prompt-v1.md, assembles context)
    search.ts           # Query generation — sends seed text to Claude, returns search terms
  config/
    store.ts            # Read/write ~/.pan/config.json
    schema.ts           # Config shape, validation, defaults
  types.ts              # Shared types across modules
package.json
tsconfig.json
system-prompt-v1.md     # The system prompt (already exists)
Project-handoff.md      # Reference document (already exists)
```

### Module boundaries

- `cli/commands/run.ts` orchestrates the full flow by calling into `mcp/` and `ai/` modules
- `mcp/` owns all Notion MCP interaction (connect, read, search, write)
- `ai/` owns all Claude API interaction (query generation, connection finding)
- `config/` owns `~/.pan/config.json` read/write
- Modules communicate through `types.ts`, not through direct imports of each other's internals

---

## Dependencies

### Runtime
- `@modelcontextprotocol/sdk` — MCP client protocol
- `mcp-oauth-provider` — OAuth 2.0 + PKCE for Notion hosted MCP
- `@anthropic-ai/sdk` — Claude API client
- `@clack/prompts` — Interactive prompts, spinners, styled CLI output
- `chalk` — Text coloring for custom output
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
6. Save to ~/.pan/config.json: { databaseId, searchMode }
7. Confirm success
```

### `pan <url>`

```
1. Load config from ~/.pan/config.json → fail if missing ("Run `pan init` first")
2. Check ANTHROPIC_API_KEY → fail if missing
3. Connect to Notion MCP server (OAuth tokens handled by mcp-oauth-provider)
4. Read the target page via MCP notion-fetch → extract page content as text (the "seed text")
5. Check for existing "Threads & Constellations" toggle in page content
   → If found and --replace not set: warn + ask to replace or skip
   → If found and --replace set: proceed (will replace)
6. QUERY GENERATION: Send seed text to Claude (lightweight call)
   → System: "Extract 3-5 diverse search queries from this text. Include names, phrases, thematic angles."
   → Returns: array of search strings
7. SEARCH: For each query, call MCP notion-search (scoped to configured database or workspace-wide)
   → Deduplicate results by page ID
   → For each unique result, fetch page content via MCP notion-fetch
   → Truncate long pages to ~500 words
   → Cap total search result text at ~8-10K tokens
8. CONNECTION FINDING: Send to Claude (main call)
   → System prompt: system-prompt-v1.md content
   → User message: seed text + all search results with page titles and URLs
   → Returns: Notion-flavored Markdown toggle structure
9. FORMAT: Ensure output uses correct Notion markdown:
   → <details><summary> with tab-indented children
   → <mention-page> for internal links
   → **bold** not <strong>
10. WRITE: Append toggle to page via MCP notion-update-page
    → Use update_content: old_str = last chunk of page, new_str = last chunk + toggle
    → If replacing: old_str = existing toggle, new_str = new toggle
11. Display success with link to page
```

### Config shape (`~/.pan/config.json`)

```json
{
  "databaseId": "2b6d647f-...",
  "searchMode": "database",
  "model": "claude-sonnet-4-6"
}
```

- `databaseId`: The Notion database to search (null if workspace-wide)
- `searchMode`: `"database"` or `"workspace"`
- `model`: Default Claude model (overridable via `--model` flag)

---

## System Prompt Adjustments

The existing `system-prompt-v1.md` needs minor updates based on Notion markdown spec findings:

1. **Toggle example**: Update to use tab-indented children (currently flat)
2. **Bold syntax**: Use `**text**` not `<strong>text</strong>`
3. **Page links**: Instruct Claude to output `<mention-page url="URL">Title</mention-page>` for internal links (rendered as native Notion page chips)
4. **Note on format**: Add instruction that output must use Notion-flavored Markdown, not standard HTML

---

## Safety Guarantees

These are architectural, not just prompt-level:

1. **Claude never has MCP access.** The code reads pages via MCP, sends text to Claude, writes Claude's output via MCP. Claude receives text in, returns text out. No credentials, no tools, no Notion access.
2. **Code only appends.** Uses `update_content` with search-and-replace to add content after existing content. Never calls `replace_content` on the full page. Never deletes.
3. **Existing toggle detection.** Before writing, checks if "Threads & Constellations" already exists. If so, warns the user.

---

## Execution Workflow

### How we work through each phase

Each "day" is a branch. Within each branch, work is divided into **sub-phases** — small groups of related tasks that produce a verifiable result.

```
For each branch:

  Sub-phase A → Implement → Verify → Commit
  Sub-phase B → Implement → Verify → Commit
  ...

  Branch complete:
    → /clear (fresh context)
    → Review full branch diff against main
    → Fix any review issues → Commit
    → Merge to main
    → /clear before next branch
```

**Why sub-phases?**
- Each has a concrete "it works" checkpoint — if something breaks, you've only lost one sub-phase
- The branch-level review catches cross-cutting issues (naming, patterns, dead code) in fresh context
- `/clear` between branches prevents context degradation (per Claude Code best practices)

---

### Day 1: Foundation (branch: `day1-foundation`)

**Sub-phase 1a: Project scaffolding**
- [ ] Initialize Node.js/TypeScript project (`npm init`, `tsconfig.json`)
- [ ] Install all dependencies
- [ ] Set up project structure (directories, empty module files with type stubs)
- Verify: `npx tsx src/cli/index.ts` runs without errors (even if it does nothing)
- Commit: "scaffold project structure and install dependencies"

**Sub-phase 1b: MCP connection + page read**
- [ ] Get OAuth flow working with Notion's hosted MCP server via `mcp-oauth-provider`
- [ ] Read a known page via MCP `notion-fetch` — confirm we get content back
- [ ] Run a search via MCP `notion-search` — confirm results come back
- Verify: script successfully reads a real Notion page and returns search results
- Commit: "establish MCP connection with OAuth and validate page read + search"

**Sub-phase 1c: Toggle write validation**
- [ ] Write a test toggle to a scratch page via MCP `notion-update-page`
- [ ] Confirm the `<details><summary>` format with tab indentation renders correctly in Notion
- Verify: toggle list appears correctly in the Notion UI (visual check)
- Commit: "validate toggle write format against Notion rendering"

**Branch review**: `/clear` → review full diff → fix issues → merge to main

---

### Day 2: Core Loop (branch: `core-loop`)

**Sub-phase 2a: Config + AI modules**
- [ ] Implement `config/store.ts` + `config/schema.ts` — read/write `~/.pan/config.json`
- [ ] Implement `ai/search.ts` — query generation (Claude call to extract search terms)
- [ ] Implement `ai/prompt.ts` — system prompt builder (loads system-prompt-v1.md, assembles context)
- [ ] Implement `ai/client.ts` — Claude API wrapper (both calls)
- Verify: can generate search queries from sample text, can call Claude with assembled prompt
- Commit: "implement config management and AI client modules"

**Sub-phase 2b: MCP client + orchestration**
- [ ] Implement `mcp/client.ts` — MCP client wrapper (connect, read page, search, update page)
- [ ] Implement `cli/commands/run.ts` — wire up the full flow: read → search → connect → write
- Verify: working end-to-end run against a real Notion page (quality doesn't matter, pipeline works)
- Commit: "wire up full analysis pipeline — first end-to-end run"

**Branch review**: `/clear` → review full diff → fix issues → merge to main

---

### Day 3: Iteration + Polish (branch: `iteration`)

**Sub-phase 3a: System prompt + quality iteration**
- [ ] Update `system-prompt-v1.md` with Notion markdown adjustments (tab indentation, bold, mention-page)
- [ ] Run against multiple real pages from the test set in the handoff
- [ ] Refine system prompt if Claude's output quality needs adjustment
- [ ] Implement existing toggle detection + warn/ask/replace flow
- [ ] Handle edge cases: very short pages, pages with no connections found, very long seed text
- Verify: run against all 3 test pages, check output quality and Notion rendering
- Commit: "refine system prompt and handle edge cases"

**Sub-phase 3b: CLI commands + UX**
- [ ] Implement `cli/commands/init.ts` — OAuth + database selection via @clack
- [ ] Implement `cli/ui.ts` — spinners, progress, styled output via @clack
- [ ] Wire up `cli/index.ts` — commander setup, subcommands, flags
- Verify: `pan init` completes setup flow, `pan <url>` shows progress and writes to Notion
- Commit: "implement CLI interface with init flow and styled output"

**Branch review**: `/clear` → review full diff → fix issues → merge to main

---

### Day 4: CLI UX + Ship Prep (branch: `cli-polish`)

**Sub-phase 4a: Visual polish**
- [ ] Prototype and finalize CLI colors (with real terminal output)
- [ ] Error messages: clear, actionable, one line each
- Verify: run through all error scenarios, check terminal output looks intentional
- Commit: "finalize CLI visual design and error messages"

**Sub-phase 4b: Distribution + docs**
- [ ] Write integration test script (runs `pan` against a known page, verifies output)
- [ ] README with setup instructions (npm install, ANTHROPIC_API_KEY, pan init, pan <url>)
- [ ] Clean up codebase, remove dead code
- [ ] tsup build, verify the built CLI works
- Verify: integration test passes, README instructions work from scratch
- Commit: "add integration test, README, and build configuration"

**Branch review**: `/clear` → review full diff → fix issues → merge to main

---

### Day 5: Ship

- [ ] Record demo video (show `pan init`, then `pan` against a real page, toggle appearing in Notion)
- [ ] Write DEV.to submission post using the story framing from the handoff
- [ ] Final repo review, push to GitHub
- [ ] Submit

---

## Verification

### During development (manual)
- Run `pan init` → verify OAuth flow completes, config file created
- Run `pan <test-page-url>` → verify toggle appears correctly in Notion
- Run `pan <same-url>` again → verify warning about existing toggle
- Run `pan <same-url> --replace` → verify toggle is replaced without prompt
- Run `pan <url> --model claude-opus-4-6` → verify Opus is used
- Run without ANTHROPIC_API_KEY → verify clear error message
- Run without config → verify "run pan init first" message

### Integration test script
- Runs `pan` against the test page "The Secret Commonwealth"
- Verifies the page now contains a "Threads & Constellations" toggle
- Checks that the toggle contains at least one sub-toggle with a connection
- Cleans up by removing the toggle after verification

### Test pages (from handoff)
- "The Secret Commonwealth" — expected connections: Eliot/Waste Land, Auden, Hozier, Pullman
- "Poetry attempt" — expected connections: Naomi Shihab Nye, Ethics
- "Katniss, Aza, Lyra, Britomart" — expected connections: Purpose, Letter to Suzanne Collins

---

## Open risks

1. **mcp-oauth-provider on Linux**: The OAuth callback flow opens a browser. Need to verify it works on the user's Linux setup on Day 1.
2. **Notion MCP rate limits**: Multiple searches per run could hit rate limits. Monitor during Day 2 testing.
3. **Toggle rendering**: The `<details><summary>` format with tab indentation needs Day 1 validation against actual Notion rendering.
4. **Search result quality**: The effectiveness of Claude-generated queries determines connection quality. May need prompt iteration on Day 3.
