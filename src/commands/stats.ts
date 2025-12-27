import { GitService } from '../services/gitService';
import { StatsService } from '../services/statsService';

export interface StatsOptions {
  count?: number;
  json?: boolean;
}

export function statsCommand(options: StatsOptions = {}) {
  try {
    // Check if in a git repository
    if (!GitService.isGitRepository()) {
      console.error('Error: Not a git repository');
      console.log('Please run this command inside a git repository.');
      process.exit(1);
    }

    const commitCount = options.count || 100;

    console.log(`\nAnalyzing last ${commitCount} commits...`);

    const stats = StatsService.getCommitStats(commitCount);

    if (stats.totalCommits === 0) {
      console.log('\nNo commits found in this repository.');
      console.log('Make some commits first to see statistics.');
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(stats, null, 2));
    } else {
      console.log(StatsService.formatStats(stats));
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
