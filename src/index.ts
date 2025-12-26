#!/usr/bin/env node

import { Command } from 'commander';
import { generateCommand } from './commands/generate';
import { hookInstallCommand, hookUninstallCommand, hookStatusCommand } from './commands/hook';
import { configInitCommand, configShowCommand } from './commands/config';

const program = new Command();

program
  .name('commit-genie')
  .description('Generate intelligent Git commit messages based on your code changes')
  .version('1.0.0');

program
  .command('generate')
  .alias('gen')
  .description('Analyze staged changes and suggest a commit message')
  .option('-c, --commit', 'Automatically commit with the generated message')
  .option('-d, --dry-run', 'Preview commit without executing (shows what would be committed)')
  .option('--no-interactive', 'Disable interactive mode (just show the message)')
  .option('-m, --message-only', 'Output only the commit message (for scripts/hooks)')
  .option('-s, --single', 'Show only one suggestion (skip multiple options)')
  .action((options) => generateCommand(options));

// Hook commands
const hookCommand = program
  .command('hook')
  .description('Manage git hooks');

hookCommand
  .command('install')
  .description('Install the prepare-commit-msg hook')
  .action(hookInstallCommand);

hookCommand
  .command('uninstall')
  .description('Uninstall the prepare-commit-msg hook')
  .action(hookUninstallCommand);

hookCommand
  .command('status')
  .description('Check if the hook is installed')
  .action(hookStatusCommand);

// Config commands
const configCommand = program
  .command('config')
  .description('Manage configuration');

configCommand
  .command('init')
  .description('Create a default config file')
  .action(configInitCommand);

configCommand
  .command('show')
  .description('Show current configuration')
  .action(configShowCommand);

// Default action (if no command specified, run generate)
program
  .option('-c, --commit', 'Automatically commit with the generated message')
  .option('-d, --dry-run', 'Preview commit without executing (shows what would be committed)')
  .option('--no-interactive', 'Disable interactive mode (just show the message)')
  .option('-m, --message-only', 'Output only the commit message (for scripts/hooks)')
  .option('-s, --single', 'Show only one suggestion (skip multiple options)')
  .action((options) => {
    generateCommand(options);
  });

program.parse(process.argv);
