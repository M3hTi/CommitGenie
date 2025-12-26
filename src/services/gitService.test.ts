import { execSync, spawnSync } from 'child_process';
import { GitService } from './gitService';

// Mock child_process
jest.mock('child_process', () => ({
  execSync: jest.fn(),
  spawnSync: jest.fn(),
}));

const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockedSpawnSync = spawnSync as jest.MockedFunction<typeof spawnSync>;

describe('GitService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isGitRepository', () => {
    it('should return true when in a git repository', () => {
      mockedExecSync.mockReturnValueOnce(Buffer.from('.git'));
      expect(GitService.isGitRepository()).toBe(true);
    });

    it('should return false when not in a git repository', () => {
      mockedExecSync.mockImplementationOnce(() => {
        throw new Error('Not a git repository');
      });
      expect(GitService.isGitRepository()).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should parse staged files correctly', () => {
      mockedExecSync.mockReturnValueOnce(
        'A  src/newFile.ts\nM  src/modified.ts\nD  src/deleted.ts\n'
      );

      const status = GitService.getStatus();

      expect(status.hasStagedChanges).toBe(true);
      expect(status.staged).toHaveLength(3);
      expect(status.staged[0]).toEqual({ status: 'A', path: 'src/newFile.ts' });
      expect(status.staged[1]).toEqual({ status: 'M', path: 'src/modified.ts' });
      expect(status.staged[2]).toEqual({ status: 'D', path: 'src/deleted.ts' });
    });

    it('should return empty arrays when no changes', () => {
      mockedExecSync.mockReturnValueOnce('');

      const status = GitService.getStatus();

      expect(status.hasStagedChanges).toBe(false);
      expect(status.staged).toHaveLength(0);
      expect(status.unstaged).toHaveLength(0);
    });

    it('should handle renamed files', () => {
      mockedExecSync.mockReturnValueOnce('R  old.ts -> new.ts\n');

      const status = GitService.getStatus();

      expect(status.staged[0].status).toBe('R');
    });
  });

  describe('getDiffStats', () => {
    it('should parse diff stats correctly', () => {
      mockedExecSync.mockReturnValueOnce(
        ' 3 files changed, 45 insertions(+), 10 deletions(-)\n'
      );

      const stats = GitService.getDiffStats();

      expect(stats.filesChanged).toBe(3);
      expect(stats.insertions).toBe(45);
      expect(stats.deletions).toBe(10);
    });

    it('should handle empty diff', () => {
      mockedExecSync.mockReturnValueOnce('');

      const stats = GitService.getDiffStats();

      expect(stats.filesChanged).toBe(0);
      expect(stats.insertions).toBe(0);
      expect(stats.deletions).toBe(0);
    });

    it('should handle single file change', () => {
      mockedExecSync.mockReturnValueOnce(' 1 file changed, 5 insertions(+)\n');

      const stats = GitService.getDiffStats();

      expect(stats.filesChanged).toBe(1);
      expect(stats.insertions).toBe(5);
      expect(stats.deletions).toBe(0);
    });
  });

  describe('getDiff', () => {
    it('should return diff content', () => {
      const mockDiff = `diff --git a/file.ts b/file.ts
+++ b/file.ts
+const newLine = true;`;
      mockedExecSync.mockReturnValueOnce(mockDiff);

      const diff = GitService.getDiff();

      expect(diff).toBe(mockDiff);
    });
  });

  describe('commit', () => {
    it('should execute git commit with message', () => {
      mockedSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: '',
        stderr: '',
        pid: 123,
        output: [],
        signal: null,
      });

      expect(() => GitService.commit('feat: add new feature')).not.toThrow();
      expect(mockedSpawnSync).toHaveBeenCalledWith(
        'git',
        ['commit', '-F', '-'],
        expect.objectContaining({
          input: 'feat: add new feature',
        })
      );
    });

    it('should handle multi-line commit messages', () => {
      mockedSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: '',
        stderr: '',
        pid: 123,
        output: [],
        signal: null,
      });

      const multiLineMessage = 'feat: add new feature\n\nThis is the body\nwith multiple lines';
      GitService.commit(multiLineMessage);

      expect(mockedSpawnSync).toHaveBeenCalledWith(
        'git',
        ['commit', '-F', '-'],
        expect.objectContaining({
          input: multiLineMessage,
        })
      );
    });

    it('should throw error when commit fails', () => {
      mockedSpawnSync.mockReturnValueOnce({
        status: 1,
        stdout: '',
        stderr: 'nothing to commit',
        pid: 123,
        output: [],
        signal: null,
      });

      expect(() => GitService.commit('test')).toThrow('Failed to commit');
    });
  });

  describe('getGitDir', () => {
    it('should resolve relative .git path', () => {
      mockedExecSync.mockReturnValueOnce('.git\n');

      const result = GitService.getGitDir();

      // Should resolve to absolute path ending with .git
      expect(result.endsWith('.git')).toBe(true);
    });

    it('should handle absolute paths', () => {
      mockedExecSync.mockReturnValueOnce('/home/user/project/.git\n');

      const result = GitService.getGitDir();

      expect(result).toBe('/home/user/project/.git');
    });
  });
});
