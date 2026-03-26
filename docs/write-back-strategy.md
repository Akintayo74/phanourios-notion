# Write-back Strategy

## The operation

`writeToggle(client, pageId, toggleMarkdown)` appends or replaces the
"Threads & Constellations" toggle at the bottom of a Notion page.
Returns `'appended'` or `'replaced'` so the CLI can tell the user which happened.

## Why not a native append

`notion-update-page` has no `append_content` command. All writes use
`update_content`, which does exact string replacement via `{old_str, new_str}`.
Everything depends on anchoring — using existing page content as the match target.

## Detection: finding the existing toggle

Search the stripped page content for the opening marker:

```
<details>
<summary>**Threads & Constellations**</summary>
```

If found, walk forward through the text counting `<details>` and `</details>`
tags to find the matching close for the outer toggle (depth counter: +1 on open,
-1 on close, done when depth reaches 0).

## Decision table

| State | Action | Reason |
|---|---|---|
| No opening marker | Append | First run |
| Opening marker + matching `</details>` | Replace that exact span | Subsequent run — refresh connections |
| Opening marker but no matching `</details>` | Append | Malformed state — safer to add a second toggle than risk overwriting content the user may have written after the broken one |

## Why "append on malformed" rather than "replace on malformed"

If the toggle is malformed (no matching close), we cannot determine where it ends.
Slicing from the opening marker to the end of the page would silently overwrite
anything the user wrote after the toggle. The tool's core guarantee is that the
user's original writing is never touched. A second toggle is a visible, recoverable
annoyance. Silent data loss is not.

## Append path anchor

Take the last 3 non-empty lines of the page content as the anchor string.
`new_str = anchor + "\n\n" + toggleMarkdown`.

3 lines was validated in sub-phase 1c testing. For a commonplace book entry
(sole author, no concurrent editing), 3 lines of prose will be unique in the
document in virtually all cases.

**Edge case:** if the page has fewer than 3 non-empty lines (very short or nearly
empty page), use however many non-empty lines exist. If the page is completely
empty, surface a clear error — there is nothing to anchor to.

**Blank page detection:** `notion-fetch` returns a `<blank-page>` element in the
`text` field for blank pages. `writeToggle` checks for this before attempting any
anchor logic and throws `"Page is blank — add some content before running Phanourios."`.
Writing connections to a blank page is semantically meaningless (no content to connect
to), so failing fast is the right behaviour. ✅ confirmed sub-phase 2b.

## Replace path

`old_str = content.slice(toggleStart, toggleEnd)` — the exact toggle text.
`new_str = toggleMarkdown` — the new toggle, replacing the old one in place.
Anything before or after the toggle is untouched.

## The `<page>` wrapper

`notion-fetch` returns content wrapped in `<page>...</page>`. Strip this before
any detection or anchor extraction. `old_str` uses the inner content only.
