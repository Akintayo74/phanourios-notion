# Phanourios — API & Spec References

Quick-access reference for verifying implementation details during the build.

---

## Notion Enhanced Markdown Spec

The authoritative spec for Notion-flavored Markdown syntax (toggles, mentions, bold, etc.).

**How to access:**
```
ReadMcpResourceTool
  server: "claude.ai Notion"
  uri: "notion://docs/enhanced-markdown-spec"
```

**Key findings (verified 2026-03-26):**

Toggle syntax:
```
<details>
<summary>Rich text</summary>
	Children (MUST be tab-indented or they won't be inside the toggle)
</details>
```

Bold: `**bold**` (not `<strong>`)

Page mentions: `<mention-page url="URL">Title</mention-page>`

Empty lines: stripped unless `<empty-block/>` is used. Notion handles block spacing automatically.

---

## Notion MCP Tools

Available via `ToolSearch` with `select:<tool-name>`. The tools we use:

| Tool | Purpose | ToolSearch query |
|---|---|---|
| `notion-update-page` | Write toggle to page | `select:mcp__claude_ai_Notion__notion-update-page` |
| `notion-fetch` | Read page content | `select:mcp__claude_ai_Notion__notion-fetch` |
| `notion-search` | Search user's notes | `select:mcp__claude_ai_Notion__notion-search` |

### notion-update-page — key details

Commands: `update_properties`, `update_content`, `replace_content`, `apply_template`, `update_verification`

**There is NO `append_content` command.**

For `update_content`:
- Takes `content_updates: [{old_str, new_str, replace_all_matches?}]`
- `old_str` must exactly match existing page content
- Schema marks both `properties` and `content_updates` as required — pass `properties: {}` when using `update_content`

### notion-search — key details

- `filters` is **required** (pass `filters: {}` if no filters needed)
- Use `data_source_url` (format: `collection://UUID`) for database-scoped search
- `page_size` default 10, max 25
- `max_highlight_length` default 200, set to 0 to omit

### notion-fetch — key details

- Accepts Notion URLs, raw UUIDs, or data source URLs (`collection://...`)
- Returns page content in Notion-flavored Markdown format
- Use this to get `old_str` values for `update_content`

---

## Notion View DSL Spec (not needed for this project)

```
ReadMcpResourceTool
  server: "claude.ai Notion"
  uri: "notion://docs/view-dsl-spec"
```

---

## User's Commonplace Book

- **Database ID:** `2b6d647f-2d96-80ae-8c15-c58780a47bac`
- **Data source URL:** `collection://2b6d647f-2d96-8069-98e4-000b8dd7a911`
- **Parent page:** `2b6d647f-2d96-80fa-9690-f3e3ed9ae68d`

---

## External Links

- Notion MCP server: `https://mcp.notion.com/mcp`
- Challenge page: https://dev.to/challenges/notion-2026-03-04
- `mcp-oauth-provider` npm package: handles OAuth 2.0 + PKCE for Notion hosted MCP
