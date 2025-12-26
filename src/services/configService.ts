import * as fs from 'fs';
import * as path from 'path';
import { CommitGenieConfig } from '../types';
import { GitService } from './gitService';

const CONFIG_FILES = [
  '.commitgenierc.json',
  '.commitgenierc',
  'commitgenie.config.json',
];

const DEFAULT_CONFIG: CommitGenieConfig = {
  scopes: [],
  defaultType: 'feat',
  includeEmoji: undefined, // Let history learning decide
  maxMessageLength: 72,
  customPatterns: [],
  ticketLinking: {
    enabled: true,
    prefix: 'Refs:',
  },
  learnFromHistory: {
    enabled: true,
    commitCount: 50,
  },
  breakingChangeDetection: {
    enabled: true,
    includeFooter: true,
  },
};

export class ConfigService {
  private static cachedConfig: CommitGenieConfig | null = null;

  /**
   * Find and load the config file
   */
  static loadConfig(): CommitGenieConfig {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    let configPath: string | null = null;

    // Try to find config in git root first
    try {
      const gitRoot = GitService.getGitRoot();
      for (const filename of CONFIG_FILES) {
        const fullPath = path.join(gitRoot, filename);
        if (fs.existsSync(fullPath)) {
          configPath = fullPath;
          break;
        }
      }
    } catch {
      // Not in a git repo, try current directory
    }

    // Fallback to current directory
    if (!configPath) {
      for (const filename of CONFIG_FILES) {
        const fullPath = path.join(process.cwd(), filename);
        if (fs.existsSync(fullPath)) {
          configPath = fullPath;
          break;
        }
      }
    }

    if (!configPath) {
      this.cachedConfig = DEFAULT_CONFIG;
      return DEFAULT_CONFIG;
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const userConfig = JSON.parse(content) as Partial<CommitGenieConfig>;
      this.cachedConfig = { ...DEFAULT_CONFIG, ...userConfig };
      return this.cachedConfig;
    } catch (error) {
      console.warn(`Warning: Failed to parse config file: ${configPath}`);
      this.cachedConfig = DEFAULT_CONFIG;
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Get the current config
   */
  static getConfig(): CommitGenieConfig {
    return this.loadConfig();
  }

  /**
   * Clear the cached config (useful for testing)
   */
  static clearCache(): void {
    this.cachedConfig = null;
  }

  /**
   * Create a default config file
   */
  static initConfig(): { success: boolean; message: string; path?: string } {
    try {
      let targetDir: string;
      try {
        targetDir = GitService.getGitRoot();
      } catch {
        targetDir = process.cwd();
      }

      const configPath = path.join(targetDir, '.commitgenierc.json');

      if (fs.existsSync(configPath)) {
        return {
          success: false,
          message: 'Config file already exists',
          path: configPath,
        };
      }

      const sampleConfig: CommitGenieConfig = {
        scopes: [
          { pattern: 'src/api', scope: 'api' },
          { pattern: 'src/components', scope: 'ui' },
          { pattern: 'src/utils', scope: 'utils' },
        ],
        defaultType: 'feat',
        includeEmoji: true,
        maxMessageLength: 72,
        customPatterns: [],
        ticketLinking: {
          enabled: true,
          patterns: ['[A-Z]{2,10}-\\d+', '#\\d+'],
          prefix: 'Refs:',
        },
        learnFromHistory: {
          enabled: true,
          commitCount: 50,
        },
        breakingChangeDetection: {
          enabled: true,
          keywords: ['breaking', 'removed', 'deleted', 'deprecated'],
          includeFooter: true,
        },
      };

      fs.writeFileSync(configPath, JSON.stringify(sampleConfig, null, 2));

      return {
        success: true,
        message: 'Config file created',
        path: configPath,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create config: ${error instanceof Error ? error.message : error}`,
      };
    }
  }
}
