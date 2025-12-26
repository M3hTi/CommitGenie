import { GitService } from './gitService';
import { ConfigService } from './configService';
import { detectFileType } from '../utils/filePatterns';
import { ChangeAnalysis, CommitMessage, CommitType, FileChange } from '../types';

const COMMIT_EMOJIS: Record<CommitType, string> = {
  feat: '✨',
  fix: '🐛',
  docs: '📚',
  style: '💄',
  refactor: '♻️',
  test: '🧪',
  chore: '🔧',
  perf: '⚡',
};

export class AnalyzerService {
  /**
   * Analyze staged changes and return structured analysis
   */
  static analyzeChanges(): ChangeAnalysis {
    const stagedFiles = GitService.getStagedFiles();
    const diff = GitService.getDiff();

    const filesAffected = {
      test: 0,
      docs: 0,
      config: 0,
      source: 0,
    };

    const fileStatuses = {
      added: 0,
      modified: 0,
      deleted: 0,
      renamed: 0,
    };

    // Analyze file types and statuses
    for (const file of stagedFiles) {
      const fileType = detectFileType(file.path);
      filesAffected[fileType]++;

      switch (file.status) {
        case 'A':
          fileStatuses.added++;
          break;
        case 'M':
          fileStatuses.modified++;
          break;
        case 'D':
          fileStatuses.deleted++;
          break;
        case 'R':
          fileStatuses.renamed++;
          break;
      }
    }

    // Determine commit type based on file types and changes
    const commitType = this.determineCommitType(
      filesAffected,
      diff,
      stagedFiles
    );

    // Generate description
    const description = this.generateDescription(
      filesAffected,
      fileStatuses,
      stagedFiles,
      diff
    );

    // Determine scope if applicable
    const scope = this.determineScope(stagedFiles);

    return {
      commitType,
      scope,
      description,
      filesAffected,
    };
  }

  /**
   * Determine the commit type based on analysis
   */
  private static determineCommitType(
    filesAffected: ChangeAnalysis['filesAffected'],
    diff: string,
    stagedFiles: any[]
  ): CommitType {
    // If only test files changed
    if (
      filesAffected.test > 0 &&
      filesAffected.source === 0 &&
      filesAffected.docs === 0
    ) {
      return 'test';
    }

    // If only docs changed
    if (
      filesAffected.docs > 0 &&
      filesAffected.source === 0 &&
      filesAffected.test === 0
    ) {
      return 'docs';
    }

    // If only config files changed
    if (
      filesAffected.config > 0 &&
      filesAffected.source === 0 &&
      filesAffected.test === 0 &&
      filesAffected.docs === 0
    ) {
      return 'chore';
    }

    // Analyze diff content for keywords
    const diffLower = diff.toLowerCase();

    // Check for bug fixes
    if (
      diffLower.includes('fix') ||
      diffLower.includes('bug') ||
      diffLower.includes('issue') ||
      diffLower.includes('error')
    ) {
      return 'fix';
    }

    // Check for performance improvements
    if (
      diffLower.includes('performance') ||
      diffLower.includes('optimize') ||
      diffLower.includes('faster')
    ) {
      return 'perf';
    }

    // Check for refactoring
    if (
      diffLower.includes('refactor') ||
      diffLower.includes('restructure') ||
      diffLower.includes('cleanup')
    ) {
      return 'refactor';
    }

    // Check if files are being added (new feature)
    const hasNewFiles = stagedFiles.some((f) => f.status === 'A');
    if (hasNewFiles) {
      return 'feat';
    }

    // Default to feat for source changes
    if (filesAffected.source > 0) {
      return 'feat';
    }

    return 'chore';
  }

  /**
   * Generate a descriptive commit message
   */
  private static generateDescription(
    filesAffected: ChangeAnalysis['filesAffected'],
    fileStatuses: any,
    stagedFiles: any[],
    diff: string
  ): string {
    // Single file changes
    if (stagedFiles.length === 1) {
      const file = stagedFiles[0];
      const fileName = this.getFileName(file.path);

      if (file.status === 'A') {
        return `add ${fileName}`;
      } else if (file.status === 'D') {
        return `remove ${fileName}`;
      } else if (file.status === 'M') {
        return `update ${fileName}`;
      } else if (file.status === 'R') {
        return `rename ${fileName}`;
      }
    }

    // Multiple files of the same type
    if (filesAffected.test > 0 && filesAffected.source === 0) {
      return `update test files`;
    }

    if (filesAffected.docs > 0 && filesAffected.source === 0) {
      return `update documentation`;
    }

    if (filesAffected.config > 0 && filesAffected.source === 0) {
      return `update configuration`;
    }

    // Mixed changes - try to be descriptive
    const parts: string[] = [];

    if (fileStatuses.added > 0) {
      parts.push(`add ${fileStatuses.added} file${fileStatuses.added > 1 ? 's' : ''}`);
    }

    if (fileStatuses.modified > 0) {
      if (parts.length === 0) {
        parts.push(`update ${fileStatuses.modified} file${fileStatuses.modified > 1 ? 's' : ''}`);
      }
    }

    if (fileStatuses.deleted > 0) {
      parts.push(`remove ${fileStatuses.deleted} file${fileStatuses.deleted > 1 ? 's' : ''}`);
    }

    if (parts.length > 0) {
      return parts.join(' and ');
    }

    // Fallback
    return `update ${stagedFiles.length} file${stagedFiles.length > 1 ? 's' : ''}`;
  }

  /**
   * Determine scope from file paths
   */
  private static determineScope(stagedFiles: FileChange[]): string | undefined {
    if (stagedFiles.length === 0) return undefined;

    const config = ConfigService.getConfig();
    const paths = stagedFiles.map((f) => f.path);

    // Check config-based scope mappings first
    if (config.scopes && config.scopes.length > 0) {
      for (const mapping of config.scopes) {
        const matchingFiles = paths.filter((p) => p.includes(mapping.pattern));
        if (matchingFiles.length === paths.length) {
          return mapping.scope;
        }
      }
      // If most files match a pattern, use that scope
      for (const mapping of config.scopes) {
        const matchingFiles = paths.filter((p) => p.includes(mapping.pattern));
        if (matchingFiles.length > paths.length / 2) {
          return mapping.scope;
        }
      }
    }

    // Fallback to default heuristic
    const firstPath = paths[0];
    const parts = firstPath.split('/');
    if (parts.length > 1) {
      const potentialScope = parts[0];

      // Common scope names to look for
      const validScopes = [
        'api',
        'ui',
        'auth',
        'db',
        'core',
        'utils',
        'components',
        'services',
      ];

      if (validScopes.includes(potentialScope.toLowerCase())) {
        return potentialScope;
      }
    }

    return undefined;
  }

  /**
   * Extract file name from path
   */
  private static getFileName(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Generate the final commit message
   */
  static generateCommitMessage(): CommitMessage {
    const analysis = this.analyzeChanges();
    const config = ConfigService.getConfig();
    const includeEmoji = config.includeEmoji !== false; // Default to true

    let full = '';

    if (includeEmoji) {
      full += `${COMMIT_EMOJIS[analysis.commitType]} `;
    }

    full += analysis.commitType;

    if (analysis.scope) {
      full += `(${analysis.scope})`;
    }

    full += `: ${analysis.description}`;

    return {
      type: analysis.commitType,
      scope: analysis.scope,
      description: analysis.description,
      full,
    };
  }
}
