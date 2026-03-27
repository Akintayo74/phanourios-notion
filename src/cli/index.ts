#!/usr/bin/env node
import { Command } from 'commander';
import { runCommand } from './commands/run.js';

const program = new Command();

program
  .name('pan')
  .description('Find connections between your Notion pages using Claude AI')
  .version('1.0.0');

program
  .argument('<url>', 'Notion page URL or ID to analyze')
  .option('--dry-run', 'print the toggle to stdout instead of writing to Notion')
  .option('--replace', 'replace existing toggle without prompting')
  .option('--model <model>', 'Claude model to use for connection finding')
  .action(async (url: string, options: { dryRun?: boolean; replace?: boolean; model?: string }) => {
    try {
      await runCommand(url, options);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program.parse();
