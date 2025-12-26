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
  full: string;
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
}
