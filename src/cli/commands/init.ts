import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createProvider, ensureAuthenticated } from '../../mcp/oauth.js';
import { createMcpClient, fetchPage } from '../../mcp/client.js';
import { writeConfig } from '../../config/store.js';
import { DEFAULT_MODEL } from '../../config/schema.js';
import { spinner, intro, outro, confirm, select, text, isCancel } from '../ui.js';

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

  // 1. Search mode selection
  const searchMode = await select({
    message: 'How should Phanourios search for related notes?',
    options: [
      { value: 'database', label: 'Search within a specific database (recommended)' },
      { value: 'workspace', label: 'Search my entire workspace' },
    ],
  });
  if (isCancel(searchMode)) {
    outro('Setup cancelled.');
    return;
  }

  // 2. Database URL (if database mode)
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

  // 3. Auth spinner
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

  // 4. Connect spinner
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

  // 5. Fetch database and extract data-source URL (database mode only)
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
    await mcpClient!.close();
  }

  // 6. Save config
  writeConfig({
    dataSourceUrl,
    searchMode: searchMode as 'database' | 'workspace',
    model: DEFAULT_MODEL,
  });

  outro('Setup complete! Run `pan <url>` to analyse a page.');
}
