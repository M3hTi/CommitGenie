import { execSync } from 'child_process';
import { CommitStats, CommitType } from '../types';

const CONVENTIONAL_COMMIT_REGEX = /^(feat|fix|docs|style|refactor|test|chore|perf)(\(.+\))?!?:/;
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/u;

export class StatsService {
  /**
   * Get commit statistics for the repository
   */
  static getCommitStats(commitCount: number = 100): CommitStats {
    const commits = this.getCommits(commitCount);

    if (commits.length === 0) {
      return this.getEmptyStats();
    }

    const commitsByType: Record<string, number> = {};
    const commitsByScope: Record<string, number> = {};
    const commitsByAuthor: Record<string, number> = {};
    const commitsByMonth: Record<string, number> = {};

    let totalLength = 0;
    let emojiCount = 0;
    let conventionalCount = 0;

    for (const commit of commits) {
      // Parse commit type
      const typeMatch = commit.subject.match(CONVENTIONAL_COMMIT_REGEX);
      if (typeMatch) {
        conventionalCount++;
        const type = typeMatch[1];
        commitsByType[type] = (commitsByType[type] || 0) + 1;

        // Extract scope if present
        if (typeMatch[2]) {
          const scope = typeMatch[2].replace(/[()]/g, '');
          commitsByScope[scope] = (commitsByScope[scope] || 0) + 1;
        }
      }

      // Check for emoji
      if (EMOJI_REGEX.test(commit.subject)) {
        emojiCount++;
      }

      // Count by author
      commitsByAuthor[commit.author] = (commitsByAuthor[commit.author] || 0) + 1;

      // Count by month (YYYY-MM format)
      const month = commit.date.substring(0, 7);
      commitsByMonth[month] = (commitsByMonth[month] || 0) + 1;

      // Track message length
      totalLength += commit.subject.length;
    }

    // Calculate top contributors
    const topContributors = Object.entries(commitsByAuthor)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate recent activity (last 7 days)
    const recentActivity = this.getRecentActivity(commits);

    return {
      totalCommits: commits.length,
      commitsByType,
      commitsByScope,
      commitsByAuthor,
      commitsByMonth,
      averageMessageLength: Math.round(totalLength / commits.length),
      emojiUsagePercent: Math.round((emojiCount / commits.length) * 100),
      conventionalCommitsPercent: Math.round((conventionalCount / commits.length) * 100),
      topContributors,
      recentActivity,
    };
  }

  /**
   * Get commits from git history
   */
  private static getCommits(count: number): { subject: string; author: string; date: string }[] {
    try {
      const output = execSync(
        `git log --format="%s|||%an|||%aI" -n ${count}`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      );

      return output
        .trim()
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => {
          const [subject, author, date] = line.split('|||');
          return { subject: subject || '', author: author || 'Unknown', date: date || '' };
        });
    } catch {
      return [];
    }
  }

  /**
   * Get recent activity for the last 7 days
   */
  private static getRecentActivity(
    commits: { subject: string; author: string; date: string }[]
  ): { date: string; count: number }[] {
    const today = new Date();
    const activity: { date: string; count: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().substring(0, 10);

      const count = commits.filter(c => c.date.startsWith(dateStr)).length;
      activity.push({ date: dateStr, count });
    }

    return activity;
  }

  /**
   * Get empty stats object
   */
  private static getEmptyStats(): CommitStats {
    return {
      totalCommits: 0,
      commitsByType: {},
      commitsByScope: {},
      commitsByAuthor: {},
      commitsByMonth: {},
      averageMessageLength: 0,
      emojiUsagePercent: 0,
      conventionalCommitsPercent: 0,
      topContributors: [],
      recentActivity: [],
    };
  }

  /**
   * Format stats for display
   */
  static formatStats(stats: CommitStats): string {
    const lines: string[] = [];

    lines.push('\n' + '═'.repeat(60));
    lines.push('  COMMIT STATISTICS');
    lines.push('═'.repeat(60));

    // Overview
    lines.push('\n📊 Overview:');
    lines.push('─'.repeat(40));
    lines.push(`  Total commits analyzed: ${stats.totalCommits}`);
    lines.push(`  Average message length: ${stats.averageMessageLength} chars`);
    lines.push(`  Conventional commits:   ${stats.conventionalCommitsPercent}%`);
    lines.push(`  Emoji usage:            ${stats.emojiUsagePercent}%`);

    // Commits by type
    if (Object.keys(stats.commitsByType).length > 0) {
      lines.push('\n📝 Commits by Type:');
      lines.push('─'.repeat(40));
      const sortedTypes = Object.entries(stats.commitsByType)
        .sort((a, b) => b[1] - a[1]);
      const maxCount = Math.max(...sortedTypes.map(([, count]) => count));
      for (const [type, count] of sortedTypes) {
        const bar = this.createBar(count, maxCount, 20);
        const percent = Math.round((count / stats.totalCommits) * 100);
        lines.push(`  ${type.padEnd(10)} ${bar} ${count} (${percent}%)`);
      }
    }

    // Top scopes
    if (Object.keys(stats.commitsByScope).length > 0) {
      lines.push('\n🏷️  Top Scopes:');
      lines.push('─'.repeat(40));
      const sortedScopes = Object.entries(stats.commitsByScope)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      for (const [scope, count] of sortedScopes) {
        lines.push(`  ${scope.padEnd(15)} ${count} commits`);
      }
    }

    // Top contributors
    if (stats.topContributors.length > 0) {
      lines.push('\n👥 Top Contributors:');
      lines.push('─'.repeat(40));
      for (let i = 0; i < stats.topContributors.length; i++) {
        const { name, count } = stats.topContributors[i];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
        lines.push(`  ${medal} ${name.padEnd(20)} ${count} commits`);
      }
    }

    // Recent activity
    if (stats.recentActivity.length > 0) {
      lines.push('\n📈 Recent Activity (Last 7 Days):');
      lines.push('─'.repeat(40));
      const maxActivity = Math.max(...stats.recentActivity.map(a => a.count), 1);
      for (const { date, count } of stats.recentActivity) {
        const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
        const bar = this.createBar(count, maxActivity, 15);
        lines.push(`  ${dayName} ${date.substring(5)} ${bar} ${count}`);
      }
    }

    // Monthly trend
    if (Object.keys(stats.commitsByMonth).length > 0) {
      lines.push('\n📅 Monthly Commits:');
      lines.push('─'.repeat(40));
      const sortedMonths = Object.entries(stats.commitsByMonth)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 6);
      const maxMonthly = Math.max(...sortedMonths.map(([, count]) => count));
      for (const [month, count] of sortedMonths) {
        const bar = this.createBar(count, maxMonthly, 15);
        lines.push(`  ${month} ${bar} ${count}`);
      }
    }

    lines.push('\n' + '═'.repeat(60) + '\n');

    return lines.join('\n');
  }

  /**
   * Create a visual bar for charts
   */
  private static createBar(value: number, max: number, width: number): string {
    const filled = Math.round((value / max) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
  }
}
