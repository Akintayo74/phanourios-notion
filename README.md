# Phanourios

Phanourios (`pan`) is a CLI tool that finds the hidden connections between pages in your Notion workspace using Claude AI. Give it a page URL; it reads the page, searches your notes collection for echoes and allusions, and appends a "Threads & Constellations" toggle list to the bottom of the page.

The toggle is closed by default. Your original writing is never touched.

Built for the [DEV.to / Notion MCP Challenge](https://dev.to/challenges/notion-2026-03-04).

---

## Prerequisites

- [Bun](https://bun.sh) v1.0 or later
- A [Notion](https://notion.so) account
- An [Anthropic API key](https://console.anthropic.com)

---

## Installation

```bash
git clone https://github.com/Akintayo74/phanourios-notion.git
cd phanourios-notion
bun install
bun run build
bun link
```

After `bun link`, the `pan` command is available globally in your terminal.

---

## Setup

Run the one-time setup:

```bash
pan init
```

`pan init` will:
1. Ask for your Anthropic API key (or detect it from the `ANTHROPIC_API_KEY` environment variable)
2. Ask whether to search your entire workspace or scope to a specific database
3. Open a browser tab to authorise Phanourios with your Notion account
4. Save your configuration to `~/.pan/config.json`

---

## Usage

Analyse a Notion page and append a "Threads & Constellations" toggle:

```bash
pan <url>
```

**Example:**

```bash
pan https://www.notion.so/My-Page-abc123
```

### Flags

| Flag | Description |
|---|---|
| `--dry-run` | Print the toggle to stdout instead of writing to Notion |
| `--replace` | Replace an existing toggle without prompting |
| `--model <model>` | Override the Claude model (default: `claude-sonnet-4-6`) |

**Examples:**

```bash
# Preview without writing to Notion
pan --dry-run https://www.notion.so/My-Page-abc123

# Use Opus for deeper analysis
pan --model claude-opus-4-6 https://www.notion.so/My-Page-abc123

# Replace an existing toggle without being asked
pan --replace https://www.notion.so/My-Page-abc123
```

---

## How it works

1. **Read** — fetches the target page via the Notion hosted MCP server
2. **Search** — uses Claude Haiku to extract 3–5 search queries from the page, then runs them against your configured notes collection
3. **Connect** — sends the seed text and search results to Claude Sonnet, which identifies echoes, allusions, and chains across your notes and the wider literary tradition
4. **Write** — appends the "Threads & Constellations" toggle to the bottom of your page via `notion-update-page`. Your original content is never modified.
5. **Verify** — re-fetches the page to confirm the toggle was written correctly

Claude never has access to Notion. It only receives text and returns text. All MCP calls are made by your local code.

---

## Notes

- The API key is stored in `~/.pan/config.json` during `pan init`. You can also set `ANTHROPIC_API_KEY` in your environment (takes precedence over config).
- OAuth tokens are stored in `~/.pan/oauth/` and refreshed automatically.
- Config is stored in `~/.pan/config.json`. Run `pan init` again to reconfigure.
- For best results, point `pan init` at a database with a substantial collection of notes — the more entries, the richer the connections.
