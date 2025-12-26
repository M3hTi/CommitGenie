import { GitService } from '../services/gitService';
import { AnalyzerService } from '../services/analyzerService';
import { prompt } from '../utils/prompt';

export interface GenerateOptions {
  commit?: boolean;
  interactive?: boolean;
  messageOnly?: boolean;
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

    // Generate commit message
    const commitMessage = AnalyzerService.generateCommitMessage();

    // Message-only mode for scripts and hooks (silent, just output the message)
    if (options.messageOnly) {
      console.log(commitMessage.full);
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

    // Display the suggested commit message
    console.log('Suggested commit message:');
    console.log('─'.repeat(50));
    console.log(`\n${commitMessage.full}\n`);
    console.log('─'.repeat(50));

    console.log('\nBreakdown:');
    console.log(`  Type: ${commitMessage.type}`);
    if (commitMessage.scope) {
      console.log(`  Scope: ${commitMessage.scope}`);
    }
    console.log(`  Description: ${commitMessage.description}`);

    // Handle commit based on options
    if (options.commit) {
      // Auto-commit mode
      try {
        GitService.commit(commitMessage.full);
        console.log('\n✓ Changes committed successfully!');
      } catch (err) {
        console.error(`\nFailed to commit: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    } else if (options.interactive !== false) {
      // Interactive mode (default)
      console.log('\nWhat would you like to do?');
      console.log('  [c] Commit with this message');
      console.log('  [e] Edit the message');
      console.log('  [n] Cancel\n');

      const choice = await prompt('Your choice (c/e/n): ');

      switch (choice.toLowerCase()) {
        case 'c':
        case 'commit':
          try {
            GitService.commit(commitMessage.full);
            console.log('\n✓ Changes committed successfully!');
          } catch (err) {
            console.error(`\nFailed to commit: ${err instanceof Error ? err.message : err}`);
            process.exit(1);
          }
          break;

        case 'e':
        case 'edit':
          const editedMessage = await prompt('\nEnter your commit message: ');
          if (editedMessage) {
            try {
              GitService.commit(editedMessage);
              console.log('\n✓ Changes committed successfully!');
            } catch (err) {
              console.error(`\nFailed to commit: ${err instanceof Error ? err.message : err}`);
              process.exit(1);
            }
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
          console.log(`  git commit -m "${commitMessage.full}"`);
      }
    } else {
      // Non-interactive mode (just show the message)
      console.log('\nTo commit with this message, run:');
      console.log(`  git commit -m "${commitMessage.full}"`);
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
