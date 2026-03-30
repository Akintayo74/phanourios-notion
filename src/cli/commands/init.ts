import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createProvider, ensureAuthenticated } from '../../mcp/oauth.js';
import { createMcpClient, fetchPage } from '../../mcp/client.js';
import { writeConfig } from '../../config/store.js';
import { DEFAULT_MODEL } from '../../config/schema.js';
import { spinner, intro, outro, log, confirm, select, text, isCancel } from '../ui.js';

const CONFIG_PATH = join(homedir(), '.pan', 'config.json');

export async function initCommand(): Promise<void> {
  intro('Phanourios › Setup');

  // 0. Check for existing config
  if (existsSync(CONFIG_PATH)) {
    const shouldReconfigure = await confirm({
      message: 'Config already exists. Reconfigure?',
    });
    if (isCancel(shouldReconfigure) || !shouldReconfigure) {
      outro('Setup cancelled.');
      return;
    }
  }

  // 1. API key
  let anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!anthropicApiKey) {
    const keyInput = await text({
      message: 'Anthropic API key (starts with sk-ant-):',
      validate: (value) => {
        if (!value || value.trim().length === 0) return 'API key is required.';
        if (!value.trim().startsWith('sk-ant-')) return 'That doesn\'t look like an Anthropic API key.';
      },
    });
    if (isCancel(keyInput)) {
      outro('Setup cancelled.');
      return;
    }
    anthropicApiKey = (keyInput as string).trim();
  } else {
    log.info('Using ANTHROPIC_API_KEY from environment.');
  }

  // 2. Search mode selection
  const searchMode = await select({
    message: 'How should Phanourios search for related notes?',
    options: [
      { value: 'workspace', label: 'Search my entire workspace (recommended)' },
      { value: 'database', label: 'Search within a specific database' },
    ],
  });
  if (isCancel(searchMode)) {
    outro('Setup cancelled.');
    return;
  }

  // 3. Database URL (if database mode)
  let rawDatabaseInput = '';
  if (searchMode === 'database') {
    const input = await text({
      message: 'Paste the URL or ID of your Notion database:',
      validate: (value) => {
        if (!value || value.trim().length === 0) return 'Database URL or ID is required.';
        if (!value.includes('notion.so') && !/[0-9a-f]{8}/i.test(value)) {
          return 'That does not look like a Notion URL or ID.';
        }
      },
    });
    if (isCancel(input)) {
      outro('Setup cancelled.');
      return;
    }
    rawDatabaseInput = input as string;
  }

  // 4. Auth spinner
  const s1 = spinner();
  s1.start('Authenticating with Notion...');
  try {
    const provider = createProvider();
    await ensureAuthenticated(provider);
    s1.stop('Authorised');
  } catch (err) {
    s1.error(err instanceof Error ? err.message : String(err));
    outro('Setup failed.');
    process.exit(1);
  }

  // 5. Connect spinner
  const s2 = spinner();
  s2.start('Connecting to Notion...');
  let mcpClient: Awaited<ReturnType<typeof createMcpClient>>;
  try {
    mcpClient = await createMcpClient();
    s2.stop('Connected');
  } catch (err) {
    s2.error(err instanceof Error ? err.message : String(err));
    outro('Setup failed.');
    process.exit(1);
  }

  // 6. Fetch database and extract data-source URL (database mode only)
  let dataSourceUrl = '';
  if (searchMode === 'database') {
    const s3 = spinner();
    s3.start('Fetching database...');
    try {
      const page = await fetchPage(mcpClient!, rawDatabaseInput.trim());
      const match = page.text.match(/<data-source[^>]+url="([^"]+)"/);
      if (!match) {
        throw new Error(
          'Could not find a data-source URL. Make sure you pasted a database URL, not a regular page.',
        );
      }
      dataSourceUrl = match[1];
      s3.stop(`Found: "${page.title}"`);
    } catch (err) {
      s3.error(err instanceof Error ? err.message : String(err));
      await mcpClient!.close();
      outro('Setup failed.');
      process.exit(1);
    }
  }

  await mcpClient!.close();

  // 7. Save config
  writeConfig({
    dataSourceUrl,
    searchMode: searchMode as 'database' | 'workspace',
    model: DEFAULT_MODEL,
    anthropicApiKey,
  });

  outro('Setup complete! Run `pan <url>` to analyse a page.');
  process.exit(0);
}
