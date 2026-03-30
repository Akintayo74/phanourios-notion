import type { Config } from '../types.js';

export const DEFAULT_MODEL = 'claude-sonnet-4-6';

export function validateConfig(raw: unknown): Config {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid config: expected object');
  const c = raw as Record<string, unknown>;
  if (typeof c.dataSourceUrl !== 'string') throw new Error('Invalid config: missing dataSourceUrl');
  if (c.searchMode !== 'database' && c.searchMode !== 'workspace') {
    throw new Error('Invalid config: searchMode must be "database" or "workspace"');
  }
  return {
    dataSourceUrl: c.dataSourceUrl,
    searchMode: c.searchMode,
    model: typeof c.model === 'string' ? c.model : DEFAULT_MODEL,
    ...(typeof c.anthropicApiKey === 'string' && c.anthropicApiKey
      ? { anthropicApiKey: c.anthropicApiKey }
      : {}),
  };
}
