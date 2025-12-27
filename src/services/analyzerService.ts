import { GitService } from './gitService';
import { ConfigService } from './configService';
import { HistoryService } from './historyService';
import { AIService } from './aiService';
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

// Default keywords that indicate breaking changes
const DEFAULT_BREAKING_KEYWORDS = [
  'breaking',
  'breaking change',
  'breaking-change',
  'removed',
  'deprecated',
  'incompatible',
];

// Patterns that indicate breaking changes in code
const BREAKING_PATTERNS = [
  // Removed exports
  /^-\s*export\s+(function|class|const|let|var|interface|type|enum)\s+(\w+)/gm,
  // Removed function parameters
  /^-\s*(public|private|protected)?\s*(async\s+)?function\s+\w+\s*\([^)]+\)/gm,
  // Changed function signatures (removed parameters)
  /^-\s*\w+\s*\([^)]+\)\s*[:{]/gm,
  // Removed class methods
  /^-\s*(public|private|protected)\s+(static\s+)?(async\s+)?\w+\s*\(/gm,
  // Removed interface/type properties
  /^-\s+\w+\s*[?:]?\s*:/gm,
  // Major version bump in package.json
  /^-\s*"version":\s*"\d+/gm,
];

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

    // Detect breaking changes
    const { isBreaking, reasons } = this.detectBreakingChanges(diff, stagedFiles);

    return {
      commitType,
      scope,
      description,
      filesAffected,
      fileChanges,
      isLargeChange,
      isBreakingChange: isBreaking,
      breakingChangeReasons: reasons,
    };
  }

  /**
   * Detect breaking changes from diff content and file changes
   */
  private static detectBreakingChanges(
    diff: string,
    stagedFiles: FileChange[]
  ): { isBreaking: boolean; reasons: string[] } {
    const config = ConfigService.getConfig();
    const breakingConfig = config.breakingChangeDetection;

    // Check if breaking change detection is disabled
    if (breakingConfig?.enabled === false) {
      return { isBreaking: false, reasons: [] };
    }

    const reasons: string[] = [];
    const diffLower = diff.toLowerCase();

    // Check for keyword-based breaking changes
    const keywords = breakingConfig?.keywords || DEFAULT_BREAKING_KEYWORDS;
    for (const keyword of keywords) {
      if (diffLower.includes(keyword.toLowerCase())) {
        reasons.push(`Contains "${keyword}" keyword`);
      }
    }

    // Check for deleted source files (potentially breaking)
    const deletedSourceFiles = stagedFiles.filter(
      f => f.status === 'D' && detectFileType(f.path) === 'source'
    );
    if (deletedSourceFiles.length > 0) {
      const fileNames = deletedSourceFiles.map(f => this.getFileName(f.path)).join(', ');
      reasons.push(`Deleted source files: ${fileNames}`);
    }

    // Check for pattern-based breaking changes in diff
    for (const pattern of BREAKING_PATTERNS) {
      pattern.lastIndex = 0; // Reset regex state
      const matches = diff.match(pattern);
      if (matches && matches.length > 0) {
        // Identify what type of breaking change
        if (pattern.source.includes('export')) {
          reasons.push('Removed exported members');
        } else if (pattern.source.includes('function')) {
          reasons.push('Changed function signatures');
        } else if (pattern.source.includes('public|private|protected')) {
          reasons.push('Removed class methods');
        } else if (pattern.source.includes('version')) {
          reasons.push('Major version change detected');
        }
        break; // Only add one pattern-based reason
      }
    }

    // Check for renamed files that might break imports
    const renamedFiles = stagedFiles.filter(f => f.status === 'R');
    if (renamedFiles.length > 0) {
      const sourceRenames = renamedFiles.filter(
        f => detectFileType(f.path) === 'source'
      );
      if (sourceRenames.length > 0) {
        reasons.push('Renamed source files (may break imports)');
      }
    }

    // Deduplicate reasons
    const uniqueReasons = [...new Set(reasons)];

    return {
      isBreaking: uniqueReasons.length > 0,
      reasons: uniqueReasons,
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
    const diffLower = diff.toLowerCase();
    const filePaths = stagedFiles.map((f: any) => f.path.toLowerCase());

    // === FILE TYPE BASED DETECTION (highest priority) ===

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

    // === STYLE DETECTION ===
    // Check for style/formatting files
    const isStyleChange = filePaths.some(p =>
      p.endsWith('.css') ||
      p.endsWith('.scss') ||
      p.endsWith('.sass') ||
      p.endsWith('.less') ||
      p.endsWith('.styl') ||
      p.includes('.style') ||
      p.includes('styles/')
    );

    // Check for formatting-only changes (whitespace, semicolons, quotes)
    const formattingPatterns = [
      /^[+-]\s*$/gm,  // Only whitespace changes
      /^[+-]\s*['"`];?\s*$/gm,  // Quote changes
      /^[+-].*;\s*$/gm,  // Semicolon additions/removals
    ];
    const isFormattingChange = formattingPatterns.some(p => p.test(diff));

    if (isStyleChange || (isFormattingChange && !this.hasLogicChanges(diff))) {
      return 'style';
    }

    // === PERFORMANCE DETECTION ===
    const perfPatterns = [
      /\bperformance\b/i,
      /\boptimiz(e|ation|ing)\b/i,
      /\bfaster\b/i,
      /\bspeed\s*(up|improvement)\b/i,
      /\bcach(e|ing)\b/i,
      /\bmemoiz(e|ation)\b/i,
      /\blazy\s*load/i,
      /\basync\b.*\bawait\b/i,
      /\bparallel\b/i,
      /\bbatch(ing)?\b/i,
    ];
    if (perfPatterns.some(p => p.test(diffLower))) {
      return 'perf';
    }

    // === FIX DETECTION ===
    const fixPatterns = [
      /\bfix(es|ed|ing)?\s*(the\s*)?(bug|issue|error|problem|crash)/i,
      /\bfix(es|ed|ing)?\b/i,  // Simple "fix" or "fixed" alone
      /\bbug\s*fix/i,
      /\bBUG:/i,  // Bug comment markers
      /\bhotfix\b/i,
      /\bpatch(es|ed|ing)?\b/i,
      /\bresolv(e|es|ed|ing)\s*(the\s*)?(issue|bug|error)/i,
      /\bcorrect(s|ed|ing)?\s*(the\s*)?(bug|issue|error|problem)/i,
      /\brepair(s|ed|ing)?\b/i,
      /\bhandle\s*(error|exception|null|undefined)/i,
      /\bnull\s*check/i,
      /\bundefined\s*check/i,
      /\btry\s*{\s*.*\s*}\s*catch/i,
      /\bif\s*\(\s*!\s*\w+\s*\)/,  // Null/undefined guards
      /\bwas\s*broken\b/i,  // "was broken" indicates fixing
      /\bbroken\b.*\bfix/i,  // broken...fix pattern
    ];
    if (fixPatterns.some(p => p.test(diff))) {
      return 'fix';
    }

    // === REFACTOR DETECTION ===
    const refactorPatterns = [
      /\brefactor(s|ed|ing)?\b/i,
      /\brestructur(e|es|ed|ing)\b/i,
      /\bclean\s*up\b/i,
      /\bsimplif(y|ies|ied|ying)\b/i,
      /\brenam(e|es|ed|ing)\b/i,
      /\bmov(e|es|ed|ing)\s*(to|from|into)\b/i,
      /\bextract(s|ed|ing)?\s*(function|method|class|component)/i,
      /\binline(s|d|ing)?\b/i,
      /\bdedup(licate)?\b/i,
      /\bDRY\b/,
    ];

    // Check if it's mostly modifications without new exports/functions
    const hasOnlyModifications = stagedFiles.every((f: any) => f.status === 'M');
    const hasNewExports = /^\+\s*export\s+(function|class|const|let|var|interface|type)/m.test(diff);
    const hasNewFunctions = /^\+\s*(async\s+)?function\s+\w+/m.test(diff);
    const hasNewClasses = /^\+\s*class\s+\w+/m.test(diff);

    if (refactorPatterns.some(p => p.test(diff))) {
      return 'refactor';
    }

    // If only modifying existing files without adding new exports/functions, likely refactor
    if (hasOnlyModifications && !hasNewExports && !hasNewFunctions && !hasNewClasses) {
      // Check if there are significant logic changes
      const addedLines = (diff.match(/^\+[^+]/gm) || []).length;
      const removedLines = (diff.match(/^-[^-]/gm) || []).length;

      // If roughly equal adds and removes, it's likely refactoring
      if (addedLines > 0 && removedLines > 0) {
        const ratio = Math.min(addedLines, removedLines) / Math.max(addedLines, removedLines);
        if (ratio > 0.3) {
          return 'refactor';
        }
      }
    }

    // === CHORE DETECTION ===
    const chorePatterns = [
      /\bdependenc(y|ies)\b/i,
      /\bupgrade\b/i,
      /\bupdate\s*(version|dep)/i,
      /\bbump\b/i,
      /\bpackage\.json\b/i,
      /\bpackage-lock\.json\b/i,
      /\byarn\.lock\b/i,
      /\b\.gitignore\b/i,
      /\bci\b.*\b(config|setup)\b/i,
      /\blint(er|ing)?\b/i,
    ];
    if (chorePatterns.some(p => p.test(diff)) || chorePatterns.some(p => filePaths.some(f => p.test(f)))) {
      return 'chore';
    }

    // === FEAT DETECTION (new functionality) ===
    const hasNewFiles = stagedFiles.some((f: any) => f.status === 'A');

    // Check for new feature indicators
    if (hasNewFiles || hasNewExports || hasNewFunctions || hasNewClasses) {
      return 'feat';
    }

    // Check for new functionality patterns
    const featPatterns = [
      /\badd(s|ed|ing)?\s+(new|feature|support|ability)/i,
      /\bimplement(s|ed|ing)?\b/i,
      /\bintroduc(e|es|ed|ing)\b/i,
      /\bcreate(s|d|ing)?\b/i,
      /\benable(s|d|ing)?\b/i,
    ];
    if (featPatterns.some(p => p.test(diff))) {
      return 'feat';
    }

    // === FALLBACK ===
    // If source files are modified without clear patterns, default to refactor for mods, feat for adds
    if (filesAffected.source > 0) {
      if (hasOnlyModifications) {
        return 'refactor';
      }
      return 'feat';
    }

    return 'chore';
  }

  /**
   * Check if diff contains actual logic changes (not just formatting)
   */
  private static hasLogicChanges(diff: string): boolean {
    // Remove formatting-only changes and check if there's real code
    const lines = diff.split('\n').filter(line =>
      (line.startsWith('+') || line.startsWith('-')) &&
      !line.startsWith('+++') &&
      !line.startsWith('---')
    );

    for (const line of lines) {
      const content = line.substring(1).trim();
      // Skip empty lines, comments, and whitespace-only
      if (
        content.length === 0 ||
        content.startsWith('//') ||
        content.startsWith('/*') ||
        content.startsWith('*') ||
        content === '{' ||
        content === '}' ||
        content === ';'
      ) {
        continue;
      }
      // Has actual code change
      return true;
    }
    return false;
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
   * Apply a template to build the commit message subject line
   */
  private static applyTemplate(
    template: string,
    type: CommitType,
    scope: string | undefined,
    description: string,
    includeEmoji: boolean,
    isBreaking?: boolean
  ): string {
    const emoji = includeEmoji ? COMMIT_EMOJIS[type] : '';
    const breakingIndicator = isBreaking ? '!' : '';

    let result = template
      .replace('{emoji}', emoji)
      .replace('{type}', type + breakingIndicator)
      .replace('{description}', description);

    // Handle scope - if no scope, use noScope template or remove scope placeholder
    if (scope) {
      result = result.replace('{scope}', scope);
    } else {
      // Remove scope and parentheses if no scope
      result = result.replace('({scope})', '').replace('{scope}', '');
    }

    // Clean up extra spaces
    result = result.replace(/\s+/g, ' ').trim();

    return result;
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
    ticketInfo?: TicketInfo | null,
    isBreaking?: boolean,
    breakingReasons?: string[]
  ): string {
    const config = ConfigService.getConfig();
    const includeBreakingFooter = config.breakingChangeDetection?.includeFooter !== false;
    const templates = config.templates;

    let full = '';

    // Use template if available
    if (templates) {
      const template = scope
        ? (templates.default || '{emoji} {type}({scope}): {description}')
        : (templates.noScope || '{emoji} {type}: {description}');

      full = this.applyTemplate(template, type, scope, description, includeEmoji, isBreaking);
    } else {
      // Fallback to original logic
      if (includeEmoji) {
        full += `${COMMIT_EMOJIS[type]} `;
      }

      full += type;

      if (scope) {
        full += `(${scope})`;
      }

      // Add breaking change indicator
      if (isBreaking) {
        full += '!';
      }

      full += `: ${description}`;
    }

    if (body) {
      full += `\n\n${body}`;
    }

    // Add BREAKING CHANGE footer if enabled and breaking
    if (isBreaking && includeBreakingFooter && breakingReasons && breakingReasons.length > 0) {
      full += '\n\nBREAKING CHANGE: ' + breakingReasons[0];
      if (breakingReasons.length > 1) {
        for (let i = 1; i < breakingReasons.length; i++) {
          full += `\n- ${breakingReasons[i]}`;
        }
      }
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
      ticketInfo,
      analysis.isBreakingChange,
      analysis.breakingChangeReasons
    );

    return {
      type: analysis.commitType,
      scope: analysis.scope,
      description: analysis.description,
      body,
      full,
      isBreaking: analysis.isBreakingChange,
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
    const { isBreakingChange, breakingChangeReasons } = analysis;

    // Try to get a better scope from history if none detected
    let scope = analysis.scope;
    if (!scope) {
      const stagedFiles = GitService.getStagedFiles();
      const filePaths = stagedFiles.map(f => f.path);
      scope = HistoryService.getSuggestedScope(filePaths);
    }

    // Suggestion 1: Default (with scope if detected, with ticket, with breaking change)
    const defaultFull = this.buildFullMessage(
      analysis.commitType,
      scope,
      analysis.description,
      body,
      includeEmoji,
      ticketInfo,
      isBreakingChange,
      breakingChangeReasons
    );
    suggestions.push({
      id: 1,
      label: isBreakingChange ? 'Breaking Change' : 'Recommended',
      message: {
        type: analysis.commitType,
        scope: scope,
        description: analysis.description,
        body,
        full: defaultFull,
        isBreaking: isBreakingChange,
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
        ticketInfo,
        isBreakingChange,
        breakingChangeReasons
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
          isBreaking: isBreakingChange,
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
        ticketInfo,
        isBreakingChange,
        breakingChangeReasons
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
          isBreaking: isBreakingChange,
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
        ticketInfo,
        isBreakingChange,
        breakingChangeReasons
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
          isBreaking: isBreakingChange,
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
        null,
        isBreakingChange,
        breakingChangeReasons
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
          isBreaking: isBreakingChange,
        },
      });
    }

    // Suggestion 6: Without breaking change indicator (if breaking change detected)
    if (isBreakingChange) {
      const noBreakingFull = this.buildFullMessage(
        analysis.commitType,
        scope,
        analysis.description,
        body,
        includeEmoji,
        ticketInfo,
        false,
        []
      );
      suggestions.push({
        id: suggestions.length + 1,
        label: 'No Breaking Flag',
        message: {
          type: analysis.commitType,
          scope: scope,
          description: analysis.description,
          body,
          full: noBreakingFull,
          isBreaking: false,
        },
      });
    }

    return suggestions;
  }

  /**
   * Generate suggestions with optional AI enhancement
   */
  static async generateSuggestionsWithAI(useAI: boolean = false): Promise<MessageSuggestion[]> {
    const suggestions = this.generateMultipleSuggestions();

    // If AI is not requested or not enabled, return regular suggestions
    if (!useAI || !AIService.isEnabled()) {
      return suggestions;
    }

    try {
      const analysis = this.analyzeChanges();
      const diff = GitService.getDiff();
      const config = ConfigService.getConfig();

      // Determine emoji usage
      let includeEmoji = config.includeEmoji;
      if (includeEmoji === undefined) {
        includeEmoji = HistoryService.projectUsesEmojis();
      }

      const body = this.generateBody(analysis);
      const ticketInfo = HistoryService.detectTicketFromBranch();
      const { isBreakingChange, breakingChangeReasons } = analysis;

      // Get scope
      let scope = analysis.scope;
      if (!scope) {
        const stagedFiles = GitService.getStagedFiles();
        const filePaths = stagedFiles.map(f => f.path);
        scope = HistoryService.getSuggestedScope(filePaths);
      }

      // Get AI-enhanced description
      const aiResponse = await AIService.generateDescription(analysis, diff);

      if (aiResponse && aiResponse.description) {
        const aiDescription = aiResponse.description;
        const aiFull = this.buildFullMessage(
          analysis.commitType,
          scope,
          aiDescription,
          body,
          includeEmoji,
          ticketInfo,
          isBreakingChange,
          breakingChangeReasons
        );

        // Insert AI suggestion at the beginning
        suggestions.unshift({
          id: 0,
          label: 'AI Enhanced',
          message: {
            type: analysis.commitType,
            scope: scope,
            description: aiDescription,
            body,
            full: aiFull,
            isBreaking: isBreakingChange,
          },
        });

        // Re-number suggestions
        suggestions.forEach((s, i) => {
          s.id = i + 1;
        });
      }
    } catch (error) {
      // AI failed, just return regular suggestions
      console.warn('AI enhancement failed, using rule-based suggestions');
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
