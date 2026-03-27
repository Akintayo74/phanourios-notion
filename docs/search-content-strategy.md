# Search Content Strategy

## The decision

`collectSearchResults` fetches **full page content** for every matched result via `notion-fetch`, in parallel. No content is truncated before being passed to the prompt builder.

## Why full fetches for all results

Commonplace book entries are typically short — a quote, a lyric, a passage, a brief reflection. The concern about long pages eating the token budget is probably overblown for this data type, but we don't have real measurements yet. Getting the full text of every result gives Claude the best possible input without any ordering or truncation assumptions.

## Why not highlights

`notion-search` returns a highlight — a short snippet of the most query-relevant text. Highlights are useful for detecting that a match exists, but they represent a search engine's view of relevance, not the full entry. A connection that matters might live outside the snippet window.

## Why not a content cap

Capping content at N chars truncates everything above the threshold silently. That's only acceptable if you know the relevant content is near the top of every page — which we don't. A cap set before seeing real data is a guess dressed up as a decision.

## Open question: token budget

We don't yet know the actual lengths of entries in the configured database. If any pages are long enough to push the Claude prompt into expensive territory, the right response depends on what we observe:

- If pages are long but relevant content is consistently near the top → add a per-page char cap
- If pages are long and relevant content is scattered → consider using the highlight as a supplement rather than a replacement
- If token cost is the main concern → reduce `maxResults`

This should be revisited after testing against real pages.

## Parameters

| Parameter | Default | Meaning |
|---|---|---|
| `maxResults` | 8 | Total unique results to collect across all queries |

## Fetch strategy

Hits are deduplicated by page ID across all queries, then all fetched in parallel via `Promise.allSettled`. A single failed fetch does not abort the run — that result is simply dropped.
