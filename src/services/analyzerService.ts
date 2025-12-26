import { GitService } from './gitService';
import { ConfigService } from './configService';
import { HistoryService } from './historyService';
import { detectFileType } from '../utils/filePatterns';
import { ChangeAnalysis, CommitMessage, CommitType, FileChange, MessageSuggestion, TicketInfo } from '../types';

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
    const stats = GitService.getDiffStats();

    const filesAffected = {
      test: 0,
      docs: 0,
      config: 0,
      source: 0,
    };

    const fileChanges: ChangeAnalysis['fileChanges'] = {
      added: [],
      modified: [],
      deleted: [],
      renamed: [],
    };

    // Analyze file types and statuses
    for (const file of stagedFiles) {
      const fileType = detectFileType(file.path);
      filesAffected[fileType]++;
      const fileName = this.getFileName(file.path);

      switch (file.status) {
        case 'A':
          fileChanges.added.push(fileName);
          break;
        case 'M':
          fileChanges.modified.push(fileName);
          break;
        case 'D':
          fileChanges.deleted.push(fileName);
          break;
        case 'R':
          fileChanges.renamed.push(fileName);
          break;
      }
    }

    // Determine if this is a large change (3+ files or 100+ lines changed)
    const totalChanges = stats.insertions + stats.deletions;
    const isLargeChange = stagedFiles.length >= 3 || totalChanges >= 100;

    // Determine commit type based on file types and changes
    const commitType = this.determineCommitType(
      filesAffected,
      diff,
      stagedFiles
    );

    // Generate description
    const description = this.generateDescription(
      filesAffected,
      {
        added: fileChanges.added.length,
        modified: fileChanges.modified.length,
        deleted: fileChanges.deleted.length,
        renamed: fileChanges.renamed.length
      },
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
      fileChanges,
      isLargeChange,
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
   * Generate commit body for larger changes
   */
  private static generateBody(analysis: ChangeAnalysis): string | undefined {
    if (!analysis.isLargeChange) {
      return undefined;
    }

    const lines: string[] = [];

    if (analysis.fileChanges.added.length > 0) {
      lines.push(`- Add ${analysis.fileChanges.added.join(', ')}`);
    }

    if (analysis.fileChanges.modified.length > 0) {
      const files = analysis.fileChanges.modified.slice(0, 5);
      const suffix = analysis.fileChanges.modified.length > 5
        ? ` and ${analysis.fileChanges.modified.length - 5} more`
        : '';
      lines.push(`- Update ${files.join(', ')}${suffix}`);
    }

    if (analysis.fileChanges.deleted.length > 0) {
      lines.push(`- Remove ${analysis.fileChanges.deleted.join(', ')}`);
    }

    if (analysis.fileChanges.renamed.length > 0) {
      lines.push(`- Rename ${analysis.fileChanges.renamed.join(', ')}`);
    }

    return lines.length > 0 ? lines.join('\n') : undefined;
  }

  /**
   * Build full commit message string
   */
  private static buildFullMessage(
    type: CommitType,
    scope: string | undefined,
    description: string,
    body: string | undefined,
    includeEmoji: boolean,
    ticketInfo?: TicketInfo | null
  ): string {
    let full = '';

    if (includeEmoji) {
      full += `${COMMIT_EMOJIS[type]} `;
    }

    full += type;

    if (scope) {
      full += `(${scope})`;
    }

    full += `: ${description}`;

    if (body) {
      full += `\n\n${body}`;
    }

    // Add ticket reference as footer
    if (ticketInfo) {
      const prefix = ticketInfo.prefix || 'Refs:';
      full += `\n\n${prefix} ${ticketInfo.id}`;
    }

    return full;
  }

  /**
   * Generate the final commit message
   */
  static generateCommitMessage(): CommitMessage {
    const analysis = this.analyzeChanges();
    const config = ConfigService.getConfig();

    // Determine emoji usage: config overrides, then history learning
    let includeEmoji = config.includeEmoji;
    if (includeEmoji === undefined) {
      includeEmoji = HistoryService.projectUsesEmojis();
    }

    const body = this.generateBody(analysis);
    const ticketInfo = HistoryService.detectTicketFromBranch();

    const full = this.buildFullMessage(
      analysis.commitType,
      analysis.scope,
      analysis.description,
      body,
      includeEmoji,
      ticketInfo
    );

    return {
      type: analysis.commitType,
      scope: analysis.scope,
      description: analysis.description,
      body,
      full,
    };
  }

  /**
   * Generate multiple message suggestions
   */
  static generateMultipleSuggestions(): MessageSuggestion[] {
    const analysis = this.analyzeChanges();
    const config = ConfigService.getConfig();

    // Determine emoji usage: config overrides, then history learning
    let includeEmoji = config.includeEmoji;
    if (includeEmoji === undefined) {
      includeEmoji = HistoryService.projectUsesEmojis();
    }

    const suggestions: MessageSuggestion[] = [];
    const body = this.generateBody(analysis);
    const ticketInfo = HistoryService.detectTicketFromBranch();

    // Try to get a better scope from history if none detected
    let scope = analysis.scope;
    if (!scope) {
      const stagedFiles = GitService.getStagedFiles();
      const filePaths = stagedFiles.map(f => f.path);
      scope = HistoryService.getSuggestedScope(filePaths);
    }

    // Suggestion 1: Default (with scope if detected, with ticket)
    const defaultFull = this.buildFullMessage(
      analysis.commitType,
      scope,
      analysis.description,
      body,
      includeEmoji,
      ticketInfo
    );
    suggestions.push({
      id: 1,
      label: 'Recommended',
      message: {
        type: analysis.commitType,
        scope: scope,
        description: analysis.description,
        body,
        full: defaultFull,
      },
    });

    // Suggestion 2: Without scope (more concise)
    if (scope) {
      const noScopeFull = this.buildFullMessage(
        analysis.commitType,
        undefined,
        analysis.description,
        body,
        includeEmoji,
        ticketInfo
      );
      suggestions.push({
        id: 2,
        label: 'Concise',
        message: {
          type: analysis.commitType,
          scope: undefined,
          description: analysis.description,
          body,
          full: noScopeFull,
        },
      });
    }

    // Suggestion 3: Alternative description style
    const altDescription = this.generateAlternativeDescription(analysis);
    if (altDescription && altDescription !== analysis.description) {
      const altFull = this.buildFullMessage(
        analysis.commitType,
        scope,
        altDescription,
        body,
        includeEmoji,
        ticketInfo
      );
      suggestions.push({
        id: suggestions.length + 1,
        label: 'Detailed',
        message: {
          type: analysis.commitType,
          scope: scope,
          description: altDescription,
          body,
          full: altFull,
        },
      });
    }

    // Suggestion 4: Without body (compact) - only if body exists
    if (body) {
      const compactFull = this.buildFullMessage(
        analysis.commitType,
        scope,
        analysis.description,
        undefined,
        includeEmoji,
        ticketInfo
      );
      suggestions.push({
        id: suggestions.length + 1,
        label: 'Compact',
        message: {
          type: analysis.commitType,
          scope: scope,
          description: analysis.description,
          body: undefined,
          full: compactFull,
        },
      });
    }

    // Suggestion 5: Without ticket reference (if ticket was detected)
    if (ticketInfo) {
      const noTicketFull = this.buildFullMessage(
        analysis.commitType,
        scope,
        analysis.description,
        body,
        includeEmoji,
        null
      );
      suggestions.push({
        id: suggestions.length + 1,
        label: 'No Ticket',
        message: {
          type: analysis.commitType,
          scope: scope,
          description: analysis.description,
          body,
          full: noTicketFull,
        },
      });
    }

    return suggestions;
  }

  /**
   * Generate an alternative description style
   */
  private static generateAlternativeDescription(analysis: ChangeAnalysis): string {
    const { fileChanges, filesAffected } = analysis;
    const totalFiles = fileChanges.added.length + fileChanges.modified.length +
                       fileChanges.deleted.length + fileChanges.renamed.length;

    // For single file, provide more detail
    if (totalFiles === 1) {
      if (fileChanges.added.length === 1) {
        return `implement ${fileChanges.added[0]}`;
      }
      if (fileChanges.modified.length === 1) {
        return `improve ${fileChanges.modified[0]}`;
      }
    }

    // For multiple files, be more descriptive about categories
    const parts: string[] = [];

    if (filesAffected.source > 0) {
      parts.push(`${filesAffected.source} source file${filesAffected.source > 1 ? 's' : ''}`);
    }
    if (filesAffected.test > 0) {
      parts.push(`${filesAffected.test} test${filesAffected.test > 1 ? 's' : ''}`);
    }
    if (filesAffected.docs > 0) {
      parts.push(`${filesAffected.docs} doc${filesAffected.docs > 1 ? 's' : ''}`);
    }
    if (filesAffected.config > 0) {
      parts.push(`${filesAffected.config} config${filesAffected.config > 1 ? 's' : ''}`);
    }

    if (parts.length > 0) {
      return `update ${parts.join(', ')}`;
    }

    return analysis.description;
  }
}
