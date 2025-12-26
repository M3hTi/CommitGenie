import * as fs from 'fs';
import * as path from 'path';
import { GitService } from './gitService';

const HOOK_NAME = 'prepare-commit-msg';

const HOOK_SCRIPT = `#!/bin/sh
# CommitGenie prepare-commit-msg hook
# This hook generates a commit message suggestion

COMMIT_MSG_FILE=$1
COMMIT_SOURCE=$2

# Only run for regular commits (not merges, squashes, etc.)
if [ -z "$COMMIT_SOURCE" ]; then
  # Check if commit-genie is available
  if command -v commit-genie &> /dev/null; then
    # Generate message and write to file
    MESSAGE=$(commit-genie --message-only 2>/dev/null)
    if [ -n "$MESSAGE" ]; then
      echo "$MESSAGE" > "$COMMIT_MSG_FILE"
    fi
  elif command -v npx &> /dev/null; then
    # Fallback to npx if commit-genie is not globally installed
    MESSAGE=$(npx --yes commit-genie --message-only 2>/dev/null)
    if [ -n "$MESSAGE" ]; then
      echo "$MESSAGE" > "$COMMIT_MSG_FILE"
    fi
  fi
fi
`;

export class HookService {
  /**
   * Get the path to the git hooks directory
   */
  static getHooksDir(): string {
    const gitDir = GitService.getGitDir();
    return path.join(gitDir, 'hooks');
  }

  /**
   * Get the path to the prepare-commit-msg hook
   */
  static getHookPath(): string {
    return path.join(this.getHooksDir(), HOOK_NAME);
  }

  /**
   * Check if the hook is already installed
   */
  static isInstalled(): boolean {
    const hookPath = this.getHookPath();
    if (!fs.existsSync(hookPath)) {
      return false;
    }
    const content = fs.readFileSync(hookPath, 'utf-8');
    return content.includes('CommitGenie');
  }

  /**
   * Install the prepare-commit-msg hook
   */
  static install(): { success: boolean; message: string } {
    try {
      const hookPath = this.getHookPath();
      const hooksDir = this.getHooksDir();

      // Ensure hooks directory exists
      if (!fs.existsSync(hooksDir)) {
        fs.mkdirSync(hooksDir, { recursive: true });
      }

      // Check if hook already exists
      if (fs.existsSync(hookPath)) {
        const existingContent = fs.readFileSync(hookPath, 'utf-8');
        if (existingContent.includes('CommitGenie')) {
          return { success: true, message: 'Hook is already installed.' };
        }
        // Backup existing hook
        const backupPath = `${hookPath}.backup`;
        fs.copyFileSync(hookPath, backupPath);
        return {
          success: false,
          message: `Existing hook found. Backed up to ${backupPath}. Please manually integrate or remove the existing hook.`,
        };
      }

      // Write the hook
      fs.writeFileSync(hookPath, HOOK_SCRIPT, { mode: 0o755 });

      return { success: true, message: 'Hook installed successfully!' };
    } catch (error) {
      return {
        success: false,
        message: `Failed to install hook: ${error instanceof Error ? error.message : error}`,
      };
    }
  }

  /**
   * Uninstall the prepare-commit-msg hook
   */
  static uninstall(): { success: boolean; message: string } {
    try {
      const hookPath = this.getHookPath();

      if (!fs.existsSync(hookPath)) {
        return { success: true, message: 'Hook is not installed.' };
      }

      const content = fs.readFileSync(hookPath, 'utf-8');
      if (!content.includes('CommitGenie')) {
        return {
          success: false,
          message: 'Hook exists but was not installed by CommitGenie. Not removing.',
        };
      }

      fs.unlinkSync(hookPath);

      // Restore backup if exists
      const backupPath = `${hookPath}.backup`;
      if (fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, hookPath);
        return {
          success: true,
          message: 'Hook uninstalled and previous hook restored.',
        };
      }

      return { success: true, message: 'Hook uninstalled successfully!' };
    } catch (error) {
      return {
        success: false,
        message: `Failed to uninstall hook: ${error instanceof Error ? error.message : error}`,
      };
    }
  }
}
