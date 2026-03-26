import Anthropic from '@anthropic-ai/sdk';
import type { PageContent, SearchResult } from '../types.js';
import {
  SYSTEM_PROMPT,
  QUERY_GENERATION_SYSTEM,
  buildQueriesUserMessage,
  buildConnectionsUserMessage,
} from './prompt.js';

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
  return callClaude(SYSTEM_PROMPT, user, model, 4096);
}
