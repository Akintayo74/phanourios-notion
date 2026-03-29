#!/usr/bin/env node
import { Command } from 'commander';
import { runCommand } from './commands/run.js';
import { initCommand } from './commands/init.js';

const program = new Command();

program
  .name('pan')
  .description('Find connections between your Notion pages using Claude AI')
  .version('1.0.0');

const init = new Command('init')
  .description('Set up Phanourios: authenticate with Notion and configure your notes database')
  .action(async () => {
    try {
      await initCommand();
    } catch {
      process.exit(1);
    }
  });

const run = new Command('run')
  .description('Analyse a Notion page and append a Threads & Constellations toggle')
  .argument('<url>', 'Notion page URL or ID to analyse')
  .option('--dry-run', 'print the toggle to stdout instead of writing to Notion')
  .option('--replace', 'replace existing toggle without prompting')
  .option('--model <model>', 'Claude model to use for connection finding')
  .action(async (url: string, options: { dryRun?: boolean; replace?: boolean; model?: string }) => {
    try {
      await runCommand(url, options);
    } catch {
      process.exit(1);
    }
  });

program.addCommand(init);
program.addCommand(run, { isDefault: true });

program.parseAsync();
