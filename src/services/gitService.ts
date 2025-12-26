import { execSync } from 'child_process';
import { GitStatus, FileChange, DiffStats } from '../types';

export class GitService {
  /**
   * Check if current directory is a git repository
   */
  static isGitRepository(): boolean {
    try {
      execSync('git rev-parse --git-dir', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current git status with staged and unstaged files
   */
  static getStatus(): GitStatus {
    try {
      const output = execSync('git status --porcelain', {
        encoding: 'utf-8',
      });

      const staged: FileChange[] = [];
      const unstaged: FileChange[] = [];

      const lines = output.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        if (line.length < 3) continue;

        const stagedStatus = line[0];
        const unstagedStatus = line[1];
        const path = line.substring(3).trim();

        // Staged changes (first character)
        if (stagedStatus !== ' ' && stagedStatus !== '?') {
          staged.push({ status: stagedStatus, path });
        }

        // Unstaged changes (second character)
        if (unstagedStatus !== ' ' && stagedStatus === ' ') {
          unstaged.push({ status: unstagedStatus, path });
        }
      }

      return {
        staged,
        unstaged,
        hasStagedChanges: staged.length > 0,
      };
    } catch (error) {
      throw new Error(`Failed to get git status: ${error}`);
    }
  }

  /**
   * Get diff statistics for staged changes
   */
  static getDiffStats(): DiffStats {
    try {
      const output = execSync('git diff --cached --shortstat', {
        encoding: 'utf-8',
      });

      let filesChanged = 0;
      let insertions = 0;
      let deletions = 0;

      if (output.trim()) {
        const filesMatch = output.match(/(\d+) files? changed/);
        const insertionsMatch = output.match(/(\d+) insertions?/);
        const deletionsMatch = output.match(/(\d+) deletions?/);

        if (filesMatch) filesChanged = parseInt(filesMatch[1], 10);
        if (insertionsMatch) insertions = parseInt(insertionsMatch[1], 10);
        if (deletionsMatch) deletions = parseInt(deletionsMatch[1], 10);
      }

      return { filesChanged, insertions, deletions };
    } catch (error) {
      throw new Error(`Failed to get diff stats: ${error}`);
    }
  }

  /**
   * Get the actual diff content for staged changes
   */
  static getDiff(): string {
    try {
      const output = execSync('git diff --cached', {
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      });
      return output;
    } catch (error) {
      throw new Error(`Failed to get diff: ${error}`);
    }
  }

  /**
   * Get list of staged files with their status
   */
  static getStagedFiles(): FileChange[] {
    const status = this.getStatus();
    return status.staged;
  }

  /**
   * Commit staged changes with the given message
   */
  static commit(message: string): void {
    try {
      execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (error: any) {
      if (error.stderr) {
        throw new Error(`Failed to commit: ${error.stderr}`);
      }
      throw new Error(`Failed to commit: ${error.message}`);
    }
  }

  /**
   * Get the root directory of the git repository
   */
  static getGitRoot(): string {
    try {
      const output = execSync('git rev-parse --show-toplevel', {
        encoding: 'utf-8',
      });
      return output.trim();
    } catch (error) {
      throw new Error('Failed to get git root directory');
    }
  }

  /**
   * Get the .git directory path (works reliably on Windows)
   */
  static getGitDir(): string {
    try {
      const output = execSync('git rev-parse --git-dir', {
        encoding: 'utf-8',
      });
      const gitDir = output.trim();
      // If relative path, resolve from cwd
      if (gitDir === '.git' || !gitDir.startsWith('/')) {
        return require('path').resolve(process.cwd(), gitDir);
      }
      // Handle Unix-style absolute paths on Windows (from Git Bash)
      if (process.platform === 'win32' && gitDir.match(/^\/[a-zA-Z]\//)) {
        // Convert /d/path to D:/path
        return gitDir.replace(/^\/([a-zA-Z])\//, '$1:/').replace(/\//g, '\\');
      }
      return gitDir;
    } catch (error) {
      throw new Error('Failed to get git directory');
    }
  }
}
