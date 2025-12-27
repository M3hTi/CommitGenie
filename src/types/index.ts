export interface FileChange {
  status: string;
  path: string;
}

export interface GitStatus {
  staged: FileChange[];
  unstaged: FileChange[];
  hasStagedChanges: boolean;
}

export interface DiffStats {
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export interface ChangeAnalysis {
  commitType: CommitType;
  scope?: string;
  description: string;
  filesAffected: {
    test: number;
    docs: number;
    config: number;
    source: number;
  };
  fileChanges: {
    added: string[];
    modified: string[];
    deleted: string[];
    renamed: string[];
  };
  isLargeChange: boolean;
  isBreakingChange: boolean;
  breakingChangeReasons: string[];
}

export type CommitType =
  | 'feat'
  | 'fix'
  | 'docs'
  | 'style'
  | 'refactor'
  | 'test'
  | 'chore'
  | 'perf';

export interface CommitMessage {
  type: CommitType;
  scope?: string;
  description: string;
  body?: string;
  full: string;
  isBreaking?: boolean;
}

export interface MessageSuggestion {
  id: number;
  message: CommitMessage;
  label: string;
}

export interface FilePattern {
  pattern: RegExp;
  type: 'test' | 'docs' | 'config' | 'source';
  commitType: CommitType;
}

export interface ScopeMapping {
  pattern: string;
  scope: string;
}

export interface CommitGenieConfig {
  scopes?: ScopeMapping[];
  defaultType?: CommitType;
  includeEmoji?: boolean;
  maxMessageLength?: number;
  customPatterns?: {
    pattern: string;
    type: 'test' | 'docs' | 'config' | 'source';
    commitType: CommitType;
  }[];
  // Ticket linking options
  ticketLinking?: {
    enabled?: boolean;
    patterns?: string[];  // Custom regex patterns for ticket detection
    prefix?: string;      // e.g., "Refs:", "Closes:", "Fixes:"
  };
  // History learning options
  learnFromHistory?: {
    enabled?: boolean;
    commitCount?: number;  // Number of commits to analyze (default: 50)
  };
  // Breaking change detection options
  breakingChangeDetection?: {
    enabled?: boolean;
    keywords?: string[];  // Custom keywords to detect breaking changes
    includeFooter?: boolean;  // Include BREAKING CHANGE: footer (default: true)
  };
  // Custom templates
  templates?: {
    default?: string;  // e.g., "{emoji} {type}({scope}): {description}"
    noScope?: string;  // Template when no scope, e.g., "{emoji} {type}: {description}"
    withBody?: string; // Template for multi-line commits
  };
  // AI integration
  ai?: {
    enabled?: boolean;
    provider?: 'openai' | 'anthropic';
    apiKey?: string;
    model?: string;
  };
}

export interface TicketInfo {
  id: string;
  source: 'branch' | 'custom';
  prefix?: string;
}

export interface CommitHistoryAnalysis {
  usesEmojis: boolean;
  usesConventionalCommits: boolean;
  commonScopes: string[];
  commonVerbs: string[];
  averageLength: number;
  emojiFrequency: Record<string, number>;
  typeFrequency: Record<string, number>;
}

export interface HistoricalCommit {
  hash: string;
  message: string;
  subject: string;
  body?: string;
  author?: string;
  date?: string;
}

export interface CommitStats {
  totalCommits: number;
  commitsByType: Record<string, number>;
  commitsByScope: Record<string, number>;
  commitsByAuthor: Record<string, number>;
  commitsByMonth: Record<string, number>;
  averageMessageLength: number;
  emojiUsagePercent: number;
  conventionalCommitsPercent: number;
  topContributors: { name: string; count: number }[];
  recentActivity: { date: string; count: number }[];
}
