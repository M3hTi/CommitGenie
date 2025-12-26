import { GitService } from './gitService';
import { ConfigService } from './configService';
import { TicketInfo, CommitHistoryAnalysis, HistoricalCommit, CommitType } from '../types';

// Common ticket patterns for various issue trackers
const DEFAULT_TICKET_PATTERNS = [
  /([A-Z]{2,10}-\d+)/g,           // JIRA-style: ABC-123, PROJ-1234
  /#(\d+)/g,                       // GitHub/GitLab: #123
  /([A-Z]{2,10}_\d+)/g,           // Underscore style: ABC_123
];

// Common emojis used in commit messages
const EMOJI_PATTERN = /^[\u{1F300}-\u{1F9FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]|^:[\w+-]+:/u;

// Conventional commit pattern
const CONVENTIONAL_COMMIT_PATTERN = /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?!?:/i;

export class HistoryService {
  private static cachedAnalysis: CommitHistoryAnalysis | null = null;
  private static cacheTimestamp: number = 0;
  private static CACHE_TTL = 60000; // 1 minute cache

  /**
   * Detect ticket/issue reference from branch name
   */
  static detectTicketFromBranch(): TicketInfo | null {
    const config = ConfigService.getConfig();
    const ticketConfig = config.ticketLinking;

    // Check if ticket linking is disabled
    if (ticketConfig?.enabled === false) {
      return null;
    }

    const branch = GitService.getCurrentBranch();
    if (!branch) return null;

    // Use custom patterns if provided, otherwise use defaults
    const patterns = ticketConfig?.patterns?.map(p => new RegExp(p, 'g')) || DEFAULT_TICKET_PATTERNS;

    for (const pattern of patterns) {
      pattern.lastIndex = 0; // Reset regex state
      const match = pattern.exec(branch);
      if (match) {
        return {
          id: match[1] || match[0],
          source: 'branch',
          prefix: ticketConfig?.prefix || 'Refs:',
        };
      }
    }

    return null;
  }

  /**
   * Analyze commit history to learn project patterns
   */
  static analyzeCommitHistory(): CommitHistoryAnalysis {
    const config = ConfigService.getConfig();
    const historyConfig = config.learnFromHistory;

    // Check if history learning is disabled
    if (historyConfig?.enabled === false) {
      return this.getDefaultAnalysis();
    }

    // Return cached analysis if still valid
    const now = Date.now();
    if (this.cachedAnalysis && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.cachedAnalysis;
    }

    const commitCount = historyConfig?.commitCount || 50;
    const commits = GitService.getCommitHistory(commitCount);

    if (commits.length === 0) {
      return this.getDefaultAnalysis();
    }

    const analysis = this.performAnalysis(commits);

    // Cache the result
    this.cachedAnalysis = analysis;
    this.cacheTimestamp = now;

    return analysis;
  }

  /**
   * Perform the actual analysis on commits
   */
  private static performAnalysis(commits: HistoricalCommit[]): CommitHistoryAnalysis {
    let emojiCount = 0;
    let conventionalCount = 0;
    let totalLength = 0;
    const scopeCount: Record<string, number> = {};
    const verbCount: Record<string, number> = {};
    const emojiFrequency: Record<string, number> = {};
    const typeFrequency: Record<string, number> = {};

    for (const commit of commits) {
      const subject = commit.subject;
      totalLength += subject.length;

      // Check for emojis
      const emojiMatch = subject.match(EMOJI_PATTERN);
      if (emojiMatch) {
        emojiCount++;
        const emoji = emojiMatch[0];
        emojiFrequency[emoji] = (emojiFrequency[emoji] || 0) + 1;
      }

      // Check for conventional commits
      const conventionalMatch = subject.match(CONVENTIONAL_COMMIT_PATTERN);
      if (conventionalMatch) {
        conventionalCount++;
        const type = conventionalMatch[1].toLowerCase();
        typeFrequency[type] = (typeFrequency[type] || 0) + 1;

        // Extract scope if present
        if (conventionalMatch[2]) {
          const scope = conventionalMatch[2].replace(/[()]/g, '');
          scopeCount[scope] = (scopeCount[scope] || 0) + 1;
        }
      }

      // Extract common verbs (first word after type or emoji)
      const cleanSubject = subject
        .replace(EMOJI_PATTERN, '')
        .replace(CONVENTIONAL_COMMIT_PATTERN, '')
        .trim();

      const firstWord = cleanSubject.split(/\s+/)[0]?.toLowerCase();
      if (firstWord && firstWord.length > 2 && /^[a-z]+$/.test(firstWord)) {
        verbCount[firstWord] = (verbCount[firstWord] || 0) + 1;
      }
    }

    // Sort and get top items
    const sortedScopes = Object.entries(scopeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([scope]) => scope);

    const sortedVerbs = Object.entries(verbCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([verb]) => verb);

    return {
      usesEmojis: emojiCount > commits.length * 0.3, // 30% threshold
      usesConventionalCommits: conventionalCount > commits.length * 0.5, // 50% threshold
      commonScopes: sortedScopes,
      commonVerbs: sortedVerbs,
      averageLength: Math.round(totalLength / commits.length),
      emojiFrequency,
      typeFrequency,
    };
  }

  /**
   * Get default analysis when no history is available
   */
  private static getDefaultAnalysis(): CommitHistoryAnalysis {
    return {
      usesEmojis: true, // Default to current behavior
      usesConventionalCommits: true,
      commonScopes: [],
      commonVerbs: ['add', 'update', 'fix', 'remove', 'refactor'],
      averageLength: 50,
      emojiFrequency: {},
      typeFrequency: {},
    };
  }

  /**
   * Get the most common commit type from history
   */
  static getMostCommonType(): CommitType | null {
    const analysis = this.analyzeCommitHistory();
    const types = Object.entries(analysis.typeFrequency);

    if (types.length === 0) return null;

    types.sort((a, b) => b[1] - a[1]);
    return types[0][0] as CommitType;
  }

  /**
   * Check if project historically uses emojis
   */
  static projectUsesEmojis(): boolean {
    const analysis = this.analyzeCommitHistory();
    return analysis.usesEmojis;
  }

  /**
   * Get suggested scope based on history
   */
  static getSuggestedScope(filePaths: string[]): string | undefined {
    const analysis = this.analyzeCommitHistory();

    if (analysis.commonScopes.length === 0) return undefined;

    // Try to match file paths with common scopes
    for (const scope of analysis.commonScopes) {
      const scopeLower = scope.toLowerCase();
      for (const filePath of filePaths) {
        if (filePath.toLowerCase().includes(scopeLower)) {
          return scope;
        }
      }
    }

    return undefined;
  }

  /**
   * Clear the cached analysis
   */
  static clearCache(): void {
    this.cachedAnalysis = null;
    this.cacheTimestamp = 0;
  }
}
