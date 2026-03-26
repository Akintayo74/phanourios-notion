import { join } from 'path';
import { homedir } from 'os';
import { MCPOAuthClientProvider, FileStorage } from 'mcp-oauth-provider';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { createCallbackServer } from 'mcp-oauth-provider/server';

export const NOTION_MCP_URL = 'https://mcp.notion.com/mcp';
const CALLBACK_PORT = 8080;
const TOKEN_STORAGE_PATH = join(homedir(), '.pan', 'oauth');

// Fixed session ID so the same token file is found on every run.
// Without this, every createProvider() call generates a new random session ID
// and can never find previously stored tokens.
const SESSION_ID = 'pan';

// Subclass to override redirectToAuthorization for Linux (xdg-open instead of open)
class PanOAuthProvider extends MCPOAuthClientProvider {
  async redirectToAuthorization(url: URL): Promise<void> {
    try {
      await Bun.$`xdg-open ${url.toString()}`.quiet();
    } catch {
      console.log(`\nOpen this URL to authorize Phanourios:\n${url.toString()}\n`);
    }
  }
}

export function createProvider(): PanOAuthProvider {
  return new PanOAuthProvider({
    redirectUri: `http://localhost:${CALLBACK_PORT}/callback`,
    storage: new FileStorage(TOKEN_STORAGE_PATH),
    sessionId: SESSION_ID,
  });
}

export async function ensureAuthenticated(provider: PanOAuthProvider): Promise<void> {
  const existingTokens = await provider.getStoredTokens();

  if (existingTokens?.access_token) {
    // Valid tokens on disk — the transport calls provider.tokens() automatically,
    // which handles refresh. No need to call auth() here.
    return;
  }

  // No tokens — start callback server before auth() opens the browser,
  // then do the full OAuth code-exchange flow.
  const server = await createCallbackServer({ port: CALLBACK_PORT });
  try {
    const result = await auth(provider, { serverUrl: NOTION_MCP_URL });
    if (result === 'REDIRECT') {
      console.log('Waiting for Notion authorization (120s timeout)...');
      const callback = await server.waitForCallback('/callback', 120_000);
      await auth(provider, { serverUrl: NOTION_MCP_URL, authorizationCode: callback.code });
      console.log('Authorized.');
    }
  } finally {
    await server.stop();
  }
}
