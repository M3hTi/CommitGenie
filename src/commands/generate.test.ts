import { GitService } from '../services/gitService';
import { AnalyzerService } from '../services/analyzerService';
import { GenerateOptions } from './generate';

// Mock dependencies
jest.mock('../services/gitService');
jest.mock('../services/analyzerService');
jest.mock('../utils/prompt', () => ({
  prompt: jest.fn(),
}));

const mockedGitService = GitService as jest.Mocked<typeof GitService>;
const mockedAnalyzerService = AnalyzerService as jest.Mocked<typeof AnalyzerService>;

describe('generate command', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Default mocks
    mockedGitService.isGitRepository.mockReturnValue(true);
    mockedGitService.getStatus.mockReturnValue({
      hasStagedChanges: true,
      staged: [{ status: 'A', path: 'src/newFile.ts' }],
      unstaged: [],
    });
    mockedGitService.getDiffStats.mockReturnValue({
      filesChanged: 1,
      insertions: 10,
      deletions: 0,
    });
    mockedAnalyzerService.generateMultipleSuggestions.mockReturnValue([
      {
        id: 1,
        label: 'Recommended',
        message: {
          type: 'feat',
          description: 'add newFile.ts',
          full: '✨ feat: add newFile.ts',
        },
      },
    ]);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('GenerateOptions interface', () => {
    it('should have dryRun as optional property', () => {
      const options: GenerateOptions = {
        dryRun: true,
      };
      expect(options.dryRun).toBe(true);
    });

    it('should have all optional properties', () => {
      const options: GenerateOptions = {};
      expect(options.commit).toBeUndefined();
      expect(options.dryRun).toBeUndefined();
      expect(options.interactive).toBeUndefined();
      expect(options.messageOnly).toBeUndefined();
      expect(options.single).toBeUndefined();
    });
  });

  describe('dry run mode', () => {
    it('should display DRY RUN header', async () => {
      const { generateCommand } = await import('./generate');

      await generateCommand({ dryRun: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('DRY RUN'));
    });

    it('should display files to be committed', async () => {
      const { generateCommand } = await import('./generate');

      await generateCommand({ dryRun: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Files to be committed'));
    });

    it('should display commit message', async () => {
      const { generateCommand } = await import('./generate');

      await generateCommand({ dryRun: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Commit message'));
    });

    it('should not call GitService.commit in dry run mode', async () => {
      const { generateCommand } = await import('./generate');

      await generateCommand({ dryRun: true });

      expect(mockedGitService.commit).not.toHaveBeenCalled();
    });

    it('should display next steps after dry run', async () => {
      const { generateCommand } = await import('./generate');

      await generateCommand({ dryRun: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('commit-genie -c'));
    });

    it('should show message breakdown in dry run', async () => {
      const { generateCommand } = await import('./generate');

      await generateCommand({ dryRun: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Breakdown'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Type:'));
    });

    it('should show command that would be executed', async () => {
      const { generateCommand } = await import('./generate');

      await generateCommand({ dryRun: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Command that would be executed'));
    });
  });

  describe('error handling', () => {
    it('should exit when not in git repository', async () => {
      mockedGitService.isGitRepository.mockReturnValue(false);
      const { generateCommand } = await import('./generate');

      await generateCommand({});

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Not a git repository');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit when no staged changes', async () => {
      mockedGitService.getStatus.mockReturnValue({
        hasStagedChanges: false,
        staged: [],
        unstaged: [],
      });
      const { generateCommand } = await import('./generate');

      await generateCommand({});

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: No staged changes found');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('message-only mode', () => {
    it('should output only the commit message', async () => {
      const { generateCommand } = await import('./generate');

      await generateCommand({ messageOnly: true });

      expect(consoleLogSpy).toHaveBeenCalledWith('✨ feat: add newFile.ts');
      // Should only be called once with just the message
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });
  });
});
