import { GitService } from '../services/gitService';
import { AnalyzerService } from '../services/analyzerService';
import { prompt } from '../utils/prompt';
import { MessageSuggestion } from '../types';

export interface GenerateOptions {
  commit?: boolean;
  interactive?: boolean;
  messageOnly?: boolean;
  single?: boolean;  // Use single message mode (no multiple suggestions)
}

export async function generateCommand(options: GenerateOptions = {}) {
  try {
    // Check if in a git repository
    if (!GitService.isGitRepository()) {
      console.error('Error: Not a git repository');
      console.log('Please run this command inside a git repository.');
      process.exit(1);
    }

    // Get git status
    const status = GitService.getStatus();

    // Check if there are staged changes
    if (!status.hasStagedChanges) {
      console.error('Error: No staged changes found');
      console.log('\nPlease stage your changes first using:');
      console.log('  git add <files>');
      console.log('\nOr stage all changes:');
      console.log('  git add .');
      process.exit(1);
    }

    // Generate suggestions
    const suggestions = AnalyzerService.generateMultipleSuggestions();
    const defaultMessage = suggestions[0].message;

    // Message-only mode for scripts and hooks (silent, just output the message)
    if (options.messageOnly) {
      console.log(defaultMessage.full);
      return;
    }

    // Show what files are being analyzed
    console.log('\nAnalyzing staged changes...\n');
    console.log('Staged files:');
    for (const file of status.staged) {
      const statusSymbol = getStatusSymbol(file.status);
      console.log(`  ${statusSymbol} ${file.path}`);
    }

    // Get diff statistics
    const stats = GitService.getDiffStats();
    console.log(
      `\n${stats.filesChanged} file(s) changed, ${stats.insertions} insertion(s)(+), ${stats.deletions} deletion(s)(-)\n`
    );

    // Show suggestions
    if (suggestions.length > 1 && !options.single) {
      // Multiple suggestions mode
      console.log('Suggested commit messages:');
      console.log('─'.repeat(50));

      for (const suggestion of suggestions) {
        console.log(`\n  [${suggestion.id}] ${suggestion.label}`);
        displayMessage(suggestion.message, '      ');
      }

      console.log('\n' + '─'.repeat(50));

      // Handle commit based on options
      if (options.commit) {
        // Auto-commit with first suggestion
        await commitWithMessage(defaultMessage.full);
      } else if (options.interactive !== false) {
        // Interactive mode with selection
        console.log('\nOptions:');
        console.log(`  [1-${suggestions.length}] Select a message`);
        console.log('  [e] Edit and write your own');
        console.log('  [n] Cancel\n');

        const choice = await prompt('Your choice: ');
        await handleMultipleChoice(choice, suggestions);
      } else {
        // Non-interactive mode
        console.log('\nTo commit with the recommended message, run:');
        console.log(`  git commit -m "${escapeForShell(defaultMessage.full)}"`);
      }
    } else {
      // Single suggestion mode
      console.log('Suggested commit message:');
      console.log('─'.repeat(50));
      displayMessage(defaultMessage, '');
      console.log('─'.repeat(50));

      console.log('\nBreakdown:');
      console.log(`  Type: ${defaultMessage.type}`);
      if (defaultMessage.scope) {
        console.log(`  Scope: ${defaultMessage.scope}`);
      }
      console.log(`  Description: ${defaultMessage.description}`);
      if (defaultMessage.body) {
        console.log('  Body: (see above)');
      }

      // Handle commit based on options
      if (options.commit) {
        await commitWithMessage(defaultMessage.full);
      } else if (options.interactive !== false) {
        // Interactive mode (default)
        console.log('\nWhat would you like to do?');
        console.log('  [c] Commit with this message');
        console.log('  [e] Edit the message');
        console.log('  [n] Cancel\n');

        const choice = await prompt('Your choice (c/e/n): ');
        await handleSingleChoice(choice, defaultMessage.full);
      } else {
        // Non-interactive mode (just show the message)
        console.log('\nTo commit with this message, run:');
        console.log(`  git commit -m "${escapeForShell(defaultMessage.full)}"`);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}

function getStatusSymbol(status: string): string {
  switch (status) {
    case 'A':
      return '+';
    case 'M':
      return '~';
    case 'D':
      return '-';
    case 'R':
      return '→';
    default:
      return '?';
  }
}

function displayMessage(message: { full: string; body?: string }, indent: string): void {
  const lines = message.full.split('\n');
  const subject = lines[0];

  console.log(`${indent}${subject}`);

  // If there's a body, display it with proper indentation
  if (message.body) {
    console.log('');
    const bodyLines = message.body.split('\n');
    for (const line of bodyLines) {
      console.log(`${indent}${line}`);
    }
  }
}

function escapeForShell(message: string): string {
  // For multi-line messages, suggest using -F flag
  if (message.includes('\n')) {
    return message.split('\n')[0] + '" (use -F for full body)';
  }
  return message.replace(/"/g, '\\"');
}

async function commitWithMessage(message: string): Promise<void> {
  try {
    GitService.commit(message);
    console.log('\n✓ Changes committed successfully!');
  } catch (err) {
    console.error(`\nFailed to commit: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

async function handleSingleChoice(choice: string, message: string): Promise<void> {
  switch (choice.toLowerCase()) {
    case 'c':
    case 'commit':
      await commitWithMessage(message);
      break;

    case 'e':
    case 'edit':
      const editedMessage = await prompt('\nEnter your commit message: ');
      if (editedMessage) {
        await commitWithMessage(editedMessage);
      } else {
        console.log('\nCommit cancelled - empty message provided.');
      }
      break;

    case 'n':
    case 'no':
    case 'cancel':
      console.log('\nCommit cancelled.');
      break;

    default:
      console.log('\nNo action taken. To commit manually, run:');
      console.log(`  git commit -m "${escapeForShell(message)}"`);
  }
}

async function handleMultipleChoice(choice: string, suggestions: MessageSuggestion[]): Promise<void> {
  const choiceLower = choice.toLowerCase();

  // Check if it's a number selection
  const num = parseInt(choice, 10);
  if (!isNaN(num) && num >= 1 && num <= suggestions.length) {
    const selected = suggestions[num - 1];
    console.log(`\nSelected: ${selected.label}`);
    await commitWithMessage(selected.message.full);
    return;
  }

  // Handle other choices
  switch (choiceLower) {
    case 'e':
    case 'edit':
      const editedMessage = await prompt('\nEnter your commit message: ');
      if (editedMessage) {
        await commitWithMessage(editedMessage);
      } else {
        console.log('\nCommit cancelled - empty message provided.');
      }
      break;

    case 'n':
    case 'no':
    case 'cancel':
      console.log('\nCommit cancelled.');
      break;

    default:
      console.log('\nInvalid choice. No action taken.');
      console.log('\nTo commit with the recommended message, run:');
      console.log(`  git commit -m "${escapeForShell(suggestions[0].message.full)}"`);
  }
}
