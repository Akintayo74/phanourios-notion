import Anthropic from '@anthropic-ai/sdk';
import type { PageContent, SearchResult } from '../types.js';
import {
  SYSTEM_PROMPT,
  QUERY_GENERATION_SYSTEM,
  buildQueriesUserMessage,
  buildConnectionsUserMessage,
} from './prompt.js';

/**
 * Extract the outermost <details>...</details> block from a Claude response,
 * discarding any reasoning preamble the model may have emitted before it.
 * Returns the full text unchanged if no <details> tag is found.
 */
function extractToggleBlock(text: string): string {
  const start = text.indexOf('<details>');
  if (start === -1) return text;
  let depth = 0;
  let i = start;
  while (i < text.length) {
    if (text.startsWith('<details>', i)) { depth++; i += 9; }
    else if (text.startsWith('</details>', i)) { depth--; i += 10; if (depth === 0) return text.slice(start, i); }
    else i++;
  }
  // Malformed (no matching close) — return full text so the well-formedness
  // check in the caller can catch it.
  return text;
}

async function callClaude(
  system: string,
  user: string,
  model: string,
  maxTokens: number,
): Promise<string> {
  const client = new Anthropic();
  const msg = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const block = msg.content[0];
  if (!block || block.type !== 'text') {
    throw new Error('Unexpected response structure from Claude API');
  }
  return block.text;
}

/**
 * Ask Claude to generate 3-5 varied search queries from the page text.
 * Uses a lightweight call — small max_tokens, focused system prompt.
 */
export async function generateSearchQueries(
  pageText: string,
  model: string,
): Promise<string[]> {
  const user = buildQueriesUserMessage(pageText);
  const response = await callClaude(QUERY_GENERATION_SYSTEM, user, model, 256);
  const queries = response
    .split('\n')
    .map(q => q.trim())
    .filter(q => q.length > 0)
    .slice(0, 5);

  if (queries.length === 0) {
    // Fallback: return a single generic query using the first line of the text
    const firstLine = pageText.split('\n').find(l => l.trim().length > 0) ?? 'notes';
    return [firstLine.trim().slice(0, 80)];
  }

  return queries;
}

/**
 * Ask Claude to find connections between the seed page and the search results.
 * Returns the raw Notion-flavored markdown toggle output.
 */
export async function findConnections(
  page: PageContent,
  results: SearchResult[],
  model: string,
): Promise<string> {
  const user = buildConnectionsUserMessage(page, results);
  const raw = await callClaude(SYSTEM_PROMPT, user, model, 4096);
  return extractToggleBlock(raw);
}
