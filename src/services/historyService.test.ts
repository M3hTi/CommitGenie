import { HistoryService } from './historyService';
import { GitService } from './gitService';
import { ConfigService } from './configService';

// Mock dependencies
jest.mock('./gitService');
jest.mock('./configService');

const mockedGitService = GitService as jest.Mocked<typeof GitService>;
const mockedConfigService = ConfigService as jest.Mocked<typeof ConfigService>;

describe('HistoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    HistoryService.clearCache();
    // Default config mock
    mockedConfigService.getConfig.mockReturnValue({
      scopes: [],
      defaultType: 'feat',
      maxMessageLength: 72,
    });
  });

  describe('detectTicketFromBranch', () => {
    it('should detect JIRA-style tickets from branch name', () => {
      mockedGitService.getCurrentBranch.mockReturnValue('feature/ABC-123-add-login');

      const ticket = HistoryService.detectTicketFromBranch();

      expect(ticket).not.toBeNull();
      expect(ticket?.id).toBe('ABC-123');
      expect(ticket?.source).toBe('branch');
    });

    it('should detect GitHub-style issue numbers from branch name', () => {
      mockedGitService.getCurrentBranch.mockReturnValue('fix/#456-bug-fix');

      const ticket = HistoryService.detectTicketFromBranch();

      expect(ticket).not.toBeNull();
      expect(ticket?.id).toBe('456');
    });

    it('should return null when no ticket found', () => {
      mockedGitService.getCurrentBranch.mockReturnValue('feature/add-new-feature');

      const ticket = HistoryService.detectTicketFromBranch();

      expect(ticket).toBeNull();
    });

    it('should return null when ticket linking is disabled', () => {
      mockedConfigService.getConfig.mockReturnValue({
        scopes: [],
        defaultType: 'feat',
        maxMessageLength: 72,
        ticketLinking: {
          enabled: false,
        },
      });
      mockedGitService.getCurrentBranch.mockReturnValue('feature/ABC-123-add-login');

      const ticket = HistoryService.detectTicketFromBranch();

      expect(ticket).toBeNull();
    });

    it('should use custom patterns when provided', () => {
      mockedConfigService.getConfig.mockReturnValue({
        scopes: [],
        defaultType: 'feat',
        maxMessageLength: 72,
        ticketLinking: {
          enabled: true,
          patterns: ['CUSTOM-(\\d+)'],
          prefix: 'Fixes:',
        },
      });
      mockedGitService.getCurrentBranch.mockReturnValue('feature/CUSTOM-999-task');

      const ticket = HistoryService.detectTicketFromBranch();

      expect(ticket).not.toBeNull();
      expect(ticket?.id).toBe('999');
      expect(ticket?.prefix).toBe('Fixes:');
    });
  });

  describe('analyzeCommitHistory', () => {
    it('should detect emoji usage in history', () => {
      mockedGitService.getCommitHistory.mockReturnValue([
        { hash: '1', subject: '✨ feat: add feature', message: '✨ feat: add feature' },
        { hash: '2', subject: '🐛 fix: fix bug', message: '🐛 fix: fix bug' },
        { hash: '3', subject: '📚 docs: update readme', message: '📚 docs: update readme' },
      ]);

      const analysis = HistoryService.analyzeCommitHistory();

      expect(analysis.usesEmojis).toBe(true);
    });

    it('should detect conventional commits', () => {
      mockedGitService.getCommitHistory.mockReturnValue([
        { hash: '1', subject: 'feat: add feature', message: 'feat: add feature' },
        { hash: '2', subject: 'fix: fix bug', message: 'fix: fix bug' },
        { hash: '3', subject: 'docs: update readme', message: 'docs: update readme' },
      ]);

      const analysis = HistoryService.analyzeCommitHistory();

      expect(analysis.usesConventionalCommits).toBe(true);
    });

    it('should extract common scopes', () => {
      mockedGitService.getCommitHistory.mockReturnValue([
        { hash: '1', subject: 'feat(api): add endpoint', message: 'feat(api): add endpoint' },
        { hash: '2', subject: 'fix(api): fix bug', message: 'fix(api): fix bug' },
        { hash: '3', subject: 'feat(ui): add button', message: 'feat(ui): add button' },
      ]);

      const analysis = HistoryService.analyzeCommitHistory();

      expect(analysis.commonScopes).toContain('api');
      expect(analysis.commonScopes).toContain('ui');
    });

    it('should return default analysis when history is empty', () => {
      mockedGitService.getCommitHistory.mockReturnValue([]);

      const analysis = HistoryService.analyzeCommitHistory();

      expect(analysis.usesEmojis).toBe(true);
      expect(analysis.usesConventionalCommits).toBe(true);
    });

    it('should return default analysis when history learning is disabled', () => {
      mockedConfigService.getConfig.mockReturnValue({
        scopes: [],
        defaultType: 'feat',
        maxMessageLength: 72,
        learnFromHistory: {
          enabled: false,
        },
      });

      const analysis = HistoryService.analyzeCommitHistory();

      expect(analysis.usesEmojis).toBe(true);
      expect(analysis.usesConventionalCommits).toBe(true);
    });

    it('should cache analysis results', () => {
      mockedGitService.getCommitHistory.mockReturnValue([
        { hash: '1', subject: 'feat: add feature', message: 'feat: add feature' },
      ]);

      HistoryService.analyzeCommitHistory();
      HistoryService.analyzeCommitHistory();
      HistoryService.analyzeCommitHistory();

      expect(mockedGitService.getCommitHistory).toHaveBeenCalledTimes(1);
    });
  });

  describe('projectUsesEmojis', () => {
    it('should return true when project uses emojis', () => {
      mockedGitService.getCommitHistory.mockReturnValue([
        { hash: '1', subject: '✨ feat: add feature', message: '✨ feat: add feature' },
        { hash: '2', subject: '🐛 fix: fix bug', message: '🐛 fix: fix bug' },
      ]);

      expect(HistoryService.projectUsesEmojis()).toBe(true);
    });
  });

  describe('getSuggestedScope', () => {
    it('should suggest scope based on file paths matching history', () => {
      mockedGitService.getCommitHistory.mockReturnValue([
        { hash: '1', subject: 'feat(api): add endpoint', message: 'feat(api): add endpoint' },
        { hash: '2', subject: 'feat(api): update endpoint', message: 'feat(api): update endpoint' },
      ]);

      const scope = HistoryService.getSuggestedScope(['src/api/users.ts']);

      expect(scope).toBe('api');
    });

    it('should return undefined when no match found', () => {
      mockedGitService.getCommitHistory.mockReturnValue([
        { hash: '1', subject: 'feat(api): add endpoint', message: 'feat(api): add endpoint' },
      ]);

      const scope = HistoryService.getSuggestedScope(['src/utils/helper.ts']);

      expect(scope).toBeUndefined();
    });
  });
});
