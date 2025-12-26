import { AnalyzerService } from './analyzerService';
import { GitService } from './gitService';
import { ConfigService } from './configService';
import { HistoryService } from './historyService';

// Mock dependencies
jest.mock('./gitService');
jest.mock('./configService');
jest.mock('./historyService');

const mockedGitService = GitService as jest.Mocked<typeof GitService>;
const mockedConfigService = ConfigService as jest.Mocked<typeof ConfigService>;
const mockedHistoryService = HistoryService as jest.Mocked<typeof HistoryService>;

describe('AnalyzerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default config mock
    mockedConfigService.getConfig.mockReturnValue({
      scopes: [],
      defaultType: 'feat',
      maxMessageLength: 72,
    });
    // Default diff stats mock
    mockedGitService.getDiffStats.mockReturnValue({
      filesChanged: 1,
      insertions: 10,
      deletions: 0,
    });
    // Default history service mocks
    mockedHistoryService.projectUsesEmojis.mockReturnValue(true);
    mockedHistoryService.detectTicketFromBranch.mockReturnValue(null);
    mockedHistoryService.getSuggestedScope.mockReturnValue(undefined);
  });

  describe('generateCommitMessage', () => {
    it('should generate feat commit for new source files with emoji', () => {
      mockedGitService.getStagedFiles.mockReturnValue([
        { status: 'A', path: 'src/services/newService.ts' },
      ]);
      mockedGitService.getDiff.mockReturnValue('');

      const result = AnalyzerService.generateCommitMessage();

      expect(result.type).toBe('feat');
      expect(result.description).toBe('add newService.ts');
      expect(result.full).toBe('✨ feat: add newService.ts');
    });

    it('should exclude emoji when includeEmoji is false', () => {
      mockedConfigService.getConfig.mockReturnValue({
        scopes: [],
        defaultType: 'feat',
        maxMessageLength: 72,
        includeEmoji: false,
      });
      mockedGitService.getStagedFiles.mockReturnValue([
        { status: 'A', path: 'src/services/newService.ts' },
      ]);
      mockedGitService.getDiff.mockReturnValue('');

      const result = AnalyzerService.generateCommitMessage();

      expect(result.full).toBe('feat: add newService.ts');
    });

    it('should generate docs commit for markdown files', () => {
      mockedGitService.getStagedFiles.mockReturnValue([
        { status: 'M', path: 'README.md' },
      ]);
      mockedGitService.getDiff.mockReturnValue('');

      const result = AnalyzerService.generateCommitMessage();

      expect(result.type).toBe('docs');
      expect(result.description).toBe('update README.md');
    });

    it('should generate test commit for test files', () => {
      mockedGitService.getStagedFiles.mockReturnValue([
        { status: 'A', path: 'src/utils/helper.test.ts' },
      ]);
      mockedGitService.getDiff.mockReturnValue('');

      const result = AnalyzerService.generateCommitMessage();

      expect(result.type).toBe('test');
    });

    it('should generate chore commit for config files', () => {
      mockedGitService.getStagedFiles.mockReturnValue([
        { status: 'M', path: 'package.json' },
      ]);
      mockedGitService.getDiff.mockReturnValue('');

      const result = AnalyzerService.generateCommitMessage();

      expect(result.type).toBe('chore');
    });

    it('should detect fix from diff content', () => {
      mockedGitService.getStagedFiles.mockReturnValue([
        { status: 'M', path: 'src/services/api.ts' },
      ]);
      mockedGitService.getDiff.mockReturnValue('- // BUG: this was broken\n+ // Fixed the issue');

      const result = AnalyzerService.generateCommitMessage();

      expect(result.type).toBe('fix');
    });

    it('should detect refactor from diff content', () => {
      mockedGitService.getStagedFiles.mockReturnValue([
        { status: 'M', path: 'src/services/api.ts' },
      ]);
      mockedGitService.getDiff.mockReturnValue('// Refactored for better readability');

      const result = AnalyzerService.generateCommitMessage();

      expect(result.type).toBe('refactor');
    });

    it('should detect perf from diff content', () => {
      mockedGitService.getStagedFiles.mockReturnValue([
        { status: 'M', path: 'src/services/api.ts' },
      ]);
      mockedGitService.getDiff.mockReturnValue('// Optimized for better performance');

      const result = AnalyzerService.generateCommitMessage();

      expect(result.type).toBe('perf');
    });

    it('should handle deleted files', () => {
      mockedGitService.getStagedFiles.mockReturnValue([
        { status: 'D', path: 'src/deprecated/oldFile.ts' },
      ]);
      mockedGitService.getDiff.mockReturnValue('');

      const result = AnalyzerService.generateCommitMessage();

      expect(result.description).toBe('remove oldFile.ts');
    });

    it('should handle multiple files', () => {
      mockedGitService.getStagedFiles.mockReturnValue([
        { status: 'A', path: 'src/file1.ts' },
        { status: 'A', path: 'src/file2.ts' },
        { status: 'M', path: 'src/file3.ts' },
      ]);
      mockedGitService.getDiff.mockReturnValue('');

      const result = AnalyzerService.generateCommitMessage();

      expect(result.description).toContain('add');
      expect(result.description).toContain('file');
    });

    it('should use scope from config when matching', () => {
      mockedConfigService.getConfig.mockReturnValue({
        scopes: [
          { pattern: 'src/api', scope: 'api' },
        ],
        defaultType: 'feat',
        maxMessageLength: 72,
      });
      mockedGitService.getStagedFiles.mockReturnValue([
        { status: 'A', path: 'src/api/endpoints.ts' },
      ]);
      mockedGitService.getDiff.mockReturnValue('');

      const result = AnalyzerService.generateCommitMessage();

      expect(result.scope).toBe('api');
      expect(result.full).toContain('(api)');
    });
  });

  describe('analyzeChanges', () => {
    it('should count file types correctly', () => {
      mockedGitService.getStagedFiles.mockReturnValue([
        { status: 'A', path: 'src/index.ts' },
        { status: 'A', path: 'src/helper.test.ts' },
        { status: 'M', path: 'README.md' },
        { status: 'M', path: 'package.json' },
      ]);
      mockedGitService.getDiff.mockReturnValue('');

      const analysis = AnalyzerService.analyzeChanges();

      expect(analysis.filesAffected.source).toBe(1);
      expect(analysis.filesAffected.test).toBe(1);
      expect(analysis.filesAffected.docs).toBe(1);
      expect(analysis.filesAffected.config).toBe(1);
    });
  });

  describe('ticket linking', () => {
    it('should include ticket reference from branch', () => {
      mockedGitService.getStagedFiles.mockReturnValue([
        { status: 'A', path: 'src/newFeature.ts' },
      ]);
      mockedGitService.getDiff.mockReturnValue('');
      mockedHistoryService.detectTicketFromBranch.mockReturnValue({
        id: 'ABC-123',
        source: 'branch',
        prefix: 'Refs:',
      });

      const result = AnalyzerService.generateCommitMessage();

      expect(result.full).toContain('Refs: ABC-123');
    });

    it('should not include ticket when none detected', () => {
      mockedGitService.getStagedFiles.mockReturnValue([
        { status: 'A', path: 'src/newFeature.ts' },
      ]);
      mockedGitService.getDiff.mockReturnValue('');
      mockedHistoryService.detectTicketFromBranch.mockReturnValue(null);

      const result = AnalyzerService.generateCommitMessage();

      expect(result.full).not.toContain('Refs:');
    });
  });

  describe('history learning', () => {
    it('should use history to determine emoji usage', () => {
      mockedConfigService.getConfig.mockReturnValue({
        scopes: [],
        defaultType: 'feat',
        maxMessageLength: 72,
        includeEmoji: undefined, // Let history decide
      });
      mockedGitService.getStagedFiles.mockReturnValue([
        { status: 'A', path: 'src/newFeature.ts' },
      ]);
      mockedGitService.getDiff.mockReturnValue('');
      mockedHistoryService.projectUsesEmojis.mockReturnValue(false);

      const result = AnalyzerService.generateCommitMessage();

      expect(result.full).not.toMatch(/^[✨🐛📚💄♻️🧪🔧⚡]/);
    });

    it('should use config emoji setting over history', () => {
      mockedConfigService.getConfig.mockReturnValue({
        scopes: [],
        defaultType: 'feat',
        maxMessageLength: 72,
        includeEmoji: true, // Explicitly set
      });
      mockedGitService.getStagedFiles.mockReturnValue([
        { status: 'A', path: 'src/newFeature.ts' },
      ]);
      mockedGitService.getDiff.mockReturnValue('');
      mockedHistoryService.projectUsesEmojis.mockReturnValue(false); // Would suggest no emoji

      const result = AnalyzerService.generateCommitMessage();

      expect(result.full).toMatch(/^✨/);
    });
  });
});
