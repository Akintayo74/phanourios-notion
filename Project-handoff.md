# Phanourios — Project Handoff Document

## What this is

A hackathon submission for the DEV.to / Notion MCP Challenge (deadline: March 29, 2026, 11:59 PM PST). Three winners each receive $500 + a DEV++ subscription + an exclusive badge. Judged on originality & creativity, technical complexity, and practical implementation.

Submission requires: a DEV.to blog post (using their template), a video demo, a code repo, and an explanation of how Notion MCP is used.

Challenge page: https://dev.to/challenges/notion-2026-03-04

---

## The name

**Phanourios** (CLI command: `pan`)

Phanourios is a character from Philip Pullman's *Book of Dust* trilogy. The Greek name means "the revealer" or "he who brings to light." The short form `pan` is both a substring of Phanourios and the name of Lyra's dæmon in *His Dark Materials*. The name captures what the tool does — it reveals the hidden connections between fragments — and it's rooted in a body of literature that matters to the person who built it.

---

## The problem

People who think by collecting fragments — quotes, lyrics, ideas, passages, reflections — accumulate them in tools like Notion over months and years. Each entry exists as its own page. But the *web between them* — the fact that a Hozier lyric saved in January and an Eliot passage saved in June and something you wrote yourself last week are all circling the same question — that web lives only in your head. It's never written down. You discover it by accident, if you discover it at all.

Notion shows you pages. It doesn't show you connections.

## What Phanourios does

You give it a Notion page URL. It reads the page, searches your notes collection (a commonplace book, a reading list, a bookmarks database — whatever you've configured) for related entries, uses literary and cultural knowledge to identify echoes and allusions you may not have noticed, and appends a toggle list called "Threads & Constellations" to the bottom of your page.

The toggle is closed by default. Your original writing is never touched. The connections sit below it like footnotes in a good edition — there if you want them, invisible if you don't.

## What it is NOT

- Not a web app with a dashboard
- Not a generic "AI summarizer" or "AI writing assistant"
- Not a tool that interprets or critiques the user's writing
- Not a tool that gives advice ("you should read X" or "consider adding Y")

---

## The story for the submission

This is important context for whoever writes the DEV.to post and records the demo video.

The story is NOT "I built a poetry analysis tool" or "I'm a writer who needs literary analysis." The story is:

> I keep a commonplace book in Notion — a place where I save quotes, lyrics, ideas, things that resonate with me. Over time I noticed that entries I saved months apart often turn out to be about the same thing, but I only discover that by accident. I built a tool that reads any page in my workspace, searches my notes for echoes and connections, and writes them back as a quiet toggle list at the bottom of the page. Like footnotes in a good book — there if you want them, invisible if you don't.

This framing is honest. It doesn't require claiming an identity as a "writer" or "poet." It describes someone who thinks by collecting fragments and wants to see the shape they form.

---

## Architecture

### The flow

1. User runs `pan <notion-page-url>` from the terminal
2. Tool reads the page content via Notion's hosted MCP server
3. Tool searches the user's configured notes collection via Notion MCP (multiple searches with different query angles to cast a wide net — see "Search scope" below)
4. Tool sends the seed text + search results + system prompt to Claude API (Sonnet 4.6 by default)
5. Claude produces the "Threads & Constellations" toggle list as Notion-flavored markdown — Claude has NO access to MCP or Notion; it only receives text and returns text
6. Tool code takes Claude's output and uses the Notion MCP `notion-update-page` append operation to write the toggle list to the bottom of the original page — the code never uses replace or delete operations on existing content

### Search scope (configurable, not hardcoded)

The tool is not hardcoded to a "commonplace book." During first-run setup (`pan init`), the user configures which Notion database or page to search. This could be a commonplace book, a reading notes database, a bookmarks collection, or any other accumulation of notes. Config is stored in `~/.pan/config.json`.

Two modes are supported:
- **Configured database** (precise): search within a specific database the user has designated. This is the intended path for users who have a dedicated collection.
- **Workspace-wide search** (broad): fall back to `notion-search` across the entire workspace. This is the "I just want to try it" path for users who don't have a single dedicated database.

The developer's own commonplace book database ID (`2b6d647f-2d96-80ae-8c15-c58780a47bac`) is used for testing and demos, but it is NOT hardcoded into the tool itself.

### Safety: why the AI can never modify existing content

This is an architectural guarantee, not just a prompt instruction. Claude never has access to the Notion MCP server. The safety chain:

1. **Claude only sees text.** Your code reads the page via MCP, extracts the text, and sends it to the Claude API as a string. Claude receives text in, returns text out. It has no MCP credentials, no Notion access, no ability to read or write anything.
2. **Your code only appends.** The code takes Claude's text output and writes it to the page using the MCP `notion-update-page` tool's append operation. The code never calls replace or delete on existing page content.
3. **Optional sanity check.** As an extra guardrail, the code could read the page content before and after the write and verify nothing above the toggle was changed. This shouldn't be needed if the code is correct, but it's a cheap safety net.

### Tech stack

- **Runtime:** Node.js with TypeScript
  - *Why Node over Bun:* The `@modelcontextprotocol/sdk` and `mcp-oauth-provider` packages are built and tested against Node. On a 5-day deadline, MCP library compatibility matters more than startup speed. The MCP ecosystem is young — don't introduce runtime risk.
  - *Why TypeScript over JavaScript:* The MCP SDK, Anthropic SDK, and Notion MCP tools all have TypeScript types. When wiring together three different APIs, type checking catches mismatches at write-time instead of runtime. This is the kind of project where TypeScript earns its keep.
- **AI:** Anthropic API only. Claude Sonnet 4.6 (`claude-sonnet-4-6`) as the default model.
  - *Why single provider:* The system prompt was tuned across three rounds of testing using Claude. Different models (GPT-4o, Gemini, etc.) have different tendencies — GPT-4o is chattier, more prone to the advisory voice the prompt explicitly forbids. Supporting multiple providers means tuning the prompt separately for each, which isn't feasible on this timeline. Multi-provider is a v2 feature.
  - *Why Sonnet as default:* Right balance of quality and cost for this task. Catches direct textual echoes, identifies well-known allusions, follows the prompt's tone instructions well.
  - *Opus as optional upgrade:* Opus 4.6 (`claude-opus-4-6`) genuinely outperforms Sonnet on the hardest cases — multi-step inferential chains like the Britomart connection (Britomart → Spenser → epigraph in The Secret Commonwealth → Pullman → Lyra). But it's slower and significantly more expensive. Available via `pan --model claude-opus-4-6 <url>` for pages that warrant deeper analysis, but not the default. Do not test against Opus or demo with Opus — tune for Sonnet.
  - *Model is configurable via flag and config:* `pan --model <model-string> <url>` overrides the default. Can also be set in `~/.pan/config.json`. The code should pass the model as a variable to the API call from Day 1 — this makes configurability nearly free architecturally.
- **Notion access:** Notion's hosted MCP server at `https://mcp.notion.com/mcp` (the recommended approach — NOT the local open-source server which Notion may sunset)
- **MCP client:** `@modelcontextprotocol/sdk` for MCP protocol communication
- **OAuth handling:** `mcp-oauth-provider` npm package — handles the full OAuth 2.0 + PKCE flow automatically (browser opens, user approves, tokens are managed). This is the "Supabase for auth" layer — no need to implement OAuth from scratch.
- **CLI UX:** Minimal — clean console output with progress indicators (chalk, ora or similar)
- **No frontend UI.** The output lives in Notion. Notion IS the UI.

### Key technical decisions

- **Use the hosted Notion MCP server**, not the local open-source one. Notion recommends it. It has better, AI-optimized tools (Notion-flavored Markdown, `notion-search` that can search across connected apps). The local server is flagged as potentially being sunset.
- **Use `mcp-oauth-provider`** to handle OAuth. It implements the full MCP OAuth client flow: PKCE, dynamic client registration, callback server, token storage and refresh. The Notion MCP docs show an 8-step manual OAuth implementation — this library handles all of it.
- **Single AI provider (Anthropic), configurable model.** Sonnet 4.6 is default, Opus 4.6 available via flag. No multi-provider support in MVP — the prompt is tuned for Claude's sensibility.
- **Configurable search scope.** The tool is not hardcoded to a specific database. Users configure their notes collection during `pan init`. Workspace-wide search is the fallback.
- **Claude never touches Notion.** Architectural separation: Claude receives text and returns text. Only the tool's code interacts with Notion MCP. Claude has no credentials, no MCP access, no ability to read or modify the workspace.
- **Terminal-first.** No web trigger. Notion is the UI.
- **The toggle list is appended**, never replacing or modifying existing content. The user's original writing is sacred.

---

## The system prompt

This was iterated through three rounds of live testing against real Notion content. The full prompt is in `system-prompt-v1.md` (included alongside this document).

### Core principles baked into the prompt

1. **Show connections, don't interpret.** The agent surfaces what echoes what — specific words, lines, structures. It never explains what the user "is doing" or what their writing "means."

2. **Distinguish internal vs external connections.** Connections found in the user's own notes: "From your notes:" with a Notion link. Connections from the wider tradition: "Beyond your notes:" with full source citation (Author — Work, location). This distinction respects the integrity of the commonplace book.

3. **External connections must be specifically relevant.** Valid: strong textual parallels (shared structure, near-direct echoes) or etymological/historical discoveries about the user's own word choices. Invalid: "this theme also appears in [famous poem]." The Milton "sable stole" connection was a reach — this rule prevents that class of error.

4. **No advice, no recommendations.** The agent never suggests reading something or adding something. Information is present; what the user does with it is theirs.

5. **Silence over noise.** Three strong connections beat five where two are stretches.

6. **Trace names fully before writing.** Names carry webs — characters, authors, adaptations, actors, epigraphs linking works to each other. Exhaust connections before declaring anything an outlier. (Added after the agent missed that Britomart connects back to Pullman via a Spenser epigraph in *The Secret Commonwealth*.)

7. **Check for chains.** A → B and B → C might reveal that A and C are connected through B. These chain connections are often the most valuable. (Added after the Britomart miss.)

### Tone

Concise. Observational. Like a well-written footnote in a good edition. No enthusiasm, no praise, no encouragement. Not cold, just steady.

### Output format

A Notion toggle list. Outer toggle titled "Threads & Constellations." Each connection is a sub-toggle with a short descriptive title, a 2-5 sentence paragraph showing the connection, and a source line.

### The hardest boundary in the prompt

The line between "discovery" and "commentary." The rule: observations about the *material* are fine ("the word 'Lethean' contains Lethe"). Observations about the *user's intent* are not ("you replaced 'neighbour' with 'dæmon' to turn the commandment inward"). The prompt tries to prevent intent-reading but the model will sometimes blur this line. Watch for it during testing.

---

## What was tested (and what broke)

The system prompt was tested against three real pages from the user's Notion workspace in a previous conversation with Claude:

### Test 1: "The Secret Commonwealth" (a piece of writing)
- **Found:** Eliot/Waste Land water imagery echo (in commonplace book), Auden "crooked neighbour" allusion (in Alaska Young Reading List), Pullman roots, Hozier "Would That I" structural parallel (in commonplace book), Poe and Tennyson quotes (on Quotes page), Philosopher King & Poetry thematic connection
- **Iterated on:** reducing commentary, removing interpretations of creative choices, adjusting "Beyond your notes" to include full source citation instead of just a period

### Test 2: "Poetry attempt" (a piece of writing)
- **Found:** Naomi Shihab Nye's "Kindness" echo (via Philosopher King & Poetry page), Ethics/motorcycle dilemma structural parallel
- **Caught:** Milton "sable stole" connection was a reach — led to tightening the external connection rules

### Test 3: "Katniss, Aza, Lyra, Britomart" (a prose fragment)
- **Found:** Purpose page connection, Letter to Suzanne Collins connection, Temporary Chat archetypal affirmations connection
- **Missed:** Shailene Woodley as the actress who played Hazel Grace (should have traced the name through its adaptation web)
- **Missed:** Britomart connecting back to Pullman via a Spenser epigraph at the end of The Secret Commonwealth (should have traced the chain Lyra → Secret Commonwealth → Spenser → Britomart instead of declaring Britomart an outlier)
- These misses led to adding the "Before you write" section with pre-flight checks

---

## User's Notion workspace — key pages and databases

### Commonplace Book
- **Database ID:** `2b6d647f-2d96-80ae-8c15-c58780a47bac`
- **Data source URL:** `collection://2b6d647f-2d96-8069-98e4-000b8dd7a911`
- **Schema:** Name (title), Source (url), Keywords (text), Tags (multi_select: Objects & Gear, Source, Inspiration, Travel, Tool, Resource, Poetry), Status (status: To Peruse, Inbox, Rabbit Hole, Distilled), Added (date)
- **Parent page:** "Commonplace Book — Everything is Inspiration" (`2b6d647f-2d96-80fa-9690-f3e3ed9ae68d`)

### Personal Dashboard
- **Page ID:** `2a6d647f-2d96-81a0-9157-f5ed092ea630`

### Key pages that surfaced during testing
- The Waste Land (commonplace book, tagged Poetry): `d393750c-e0ad-4fc3-92d7-b4bb834cae8b`
- Would That I — Hozier (commonplace book, tagged Poetry): `301d647f-2d96-80aa-baa2-ccc4478180b6`
- Alaska Young Reading List: `18dd647f-2d96-808d-bd5a-e3e75e486a4e`
- Quotes (on Personal Dashboard): `2a6d647f-2d96-814b-8c7b-d9f31416a28b`
- Philosopher King & Poetry: `1cdd647f-2d96-80f5-8b25-e855e208b5c5`
- Purpose: `21ad647f-2d96-8063-9aa4-eec685e2e3b6`
- Letter to Suzanne Collins: `295d647f-2d96-80a0-8f69-f07e91481e45`
- Ethics: `1dcd647f-2d96-807f-be5b-fa2403d7892f`

---

## Build plan (~5 days, deadline March 29)

### Day 1: Foundation
- Set up Node.js/TypeScript project, install dependencies (`@modelcontextprotocol/sdk`, `mcp-oauth-provider`, `@anthropic-ai/sdk`)
- Get OAuth flow working with Notion's hosted MCP server (using `mcp-oauth-provider` to handle the PKCE dance)
- Verify: can read a page and search the commonplace book via MCP

### Day 2: Core loop
- Wire up the full flow: read page → generate search queries → search commonplace book → build prompt → call Claude → parse response
- Get a working end-to-end run, even if output quality isn't perfect

### Day 3: Iteration and write-back
- Write the toggle list back to the Notion page via MCP
- Run against multiple real pages, refine system prompt if needed
- Handle edge cases (short pages, pages with no clear connections, etc.)
- Verify the toggle list renders correctly in Notion

### Day 4: Polish
- CLI UX: clean terminal output, progress indicators, error handling
- README with clear setup instructions
- Clean up the codebase for the GitHub repo

### Day 5: Ship
- Record demo video (show `pan` running against a real page, toggle list appearing in Notion)
- Write and publish the DEV.to submission post
- Final review of everything

---

## Resolved decisions (from comment review)

These were open questions that have been resolved through discussion:

1. **Search scope:** NOT hardcoded to one database. Configurable via `pan init`. Two modes: configured database (precise) or workspace-wide search (broad fallback). See "Search scope" section above.
2. **AI provider:** Anthropic only. No multi-provider support in MVP. The system prompt is tuned for Claude's sensibility; other models would need separate tuning.
3. **AI model:** Sonnet 4.6 default, Opus 4.6 as configurable upgrade via `--model` flag. Tune and test for Sonnet only.
4. **Content safety:** Claude never has MCP access. Architectural guarantee, not just a prompt instruction. See "Safety" section above.
5. **Runtime:** Node.js over Bun (MCP library compatibility). TypeScript over JavaScript (three APIs with types).

---

## Open questions to resolve during build

1. **Notion-flavored Markdown for toggles:** The hosted MCP server uses Notion-flavored Markdown. Need to verify the exact syntax for toggle blocks that the `notion-update-page` tool accepts. The `<details><summary>` HTML approach may or may not work — test early.

2. **Search strategy:** How many searches per seed text? What queries to generate? Current thinking: use Claude to extract key words/phrases/names from the seed text, run 3-5 searches with different query angles, deduplicate results. The more varied the search queries, the wider the net.

3. **Token budget:** How much of the search results to include in the Claude API call? Need to balance comprehensiveness against cost and context window limits.

4. **First-run OAuth UX:** The first time a user runs `pan`, they'll need to authorize via browser. How smooth can this be? The `mcp-oauth-provider` library handles the flow, but test the actual experience on Linux.

5. **`pan init` flow:** What does first-run setup look like? At minimum: authenticate with Notion, choose a database to search. Store in `~/.pan/config.json`. Keep it simple — don't over-engineer this.

---

## Files included

- `PROJECT-HANDOFF.md` — this document
- `system-prompt-v1.md` — the full system prompt, ready to use in API calls