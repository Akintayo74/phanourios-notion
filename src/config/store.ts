import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { Config } from '../types.js';
import { validateConfig } from './schema.js';

const CONFIG_DIR = join(homedir(), '.pan');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

export function readConfig(): Config {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    return validateConfig(raw);
  } catch {
    throw new Error(`Config not found. Run \`pan init\` first.`);
  }
}

export function writeConfig(config: Config): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
