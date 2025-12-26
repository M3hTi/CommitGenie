import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from './configService';
import { GitService } from './gitService';

// Mock dependencies
jest.mock('fs');
jest.mock('./gitService');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedGitService = GitService as jest.Mocked<typeof GitService>;

describe('ConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ConfigService.clearCache();
  });

  describe('loadConfig', () => {
    it('should return default config when no config file exists', () => {
      mockedGitService.getGitRoot.mockReturnValue('/project');
      mockedFs.existsSync.mockReturnValue(false);

      const config = ConfigService.loadConfig();

      expect(config.defaultType).toBe('feat');
      expect(config.maxMessageLength).toBe(72);
      expect(config.includeEmoji).toBe(true);
      expect(config.scopes).toEqual([]);
    });

    it('should load config from .commitgenierc.json', () => {
      mockedGitService.getGitRoot.mockReturnValue('/project');
      mockedFs.existsSync.mockImplementation((filePath) => {
        return String(filePath).includes('.commitgenierc.json');
      });
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({
        scopes: [{ pattern: 'src/api', scope: 'api' }],
        defaultType: 'fix',
      }));

      const config = ConfigService.loadConfig();

      expect(config.defaultType).toBe('fix');
      expect(config.scopes).toHaveLength(1);
      expect(config.scopes![0].scope).toBe('api');
    });

    it('should merge user config with defaults', () => {
      mockedGitService.getGitRoot.mockReturnValue('/project');
      mockedFs.existsSync.mockImplementation((filePath) => {
        return String(filePath).includes('.commitgenierc.json');
      });
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({
        defaultType: 'chore',
      }));

      const config = ConfigService.loadConfig();

      expect(config.defaultType).toBe('chore');
      expect(config.maxMessageLength).toBe(72); // Default preserved
    });

    it('should cache config after first load', () => {
      mockedGitService.getGitRoot.mockReturnValue('/project');
      mockedFs.existsSync.mockReturnValue(false);

      ConfigService.loadConfig();
      ConfigService.loadConfig();
      ConfigService.loadConfig();

      // getGitRoot should only be called once due to caching
      expect(mockedGitService.getGitRoot).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid JSON gracefully', () => {
      mockedGitService.getGitRoot.mockReturnValue('/project');
      mockedFs.existsSync.mockImplementation((filePath) => {
        return String(filePath).includes('.commitgenierc.json');
      });
      mockedFs.readFileSync.mockReturnValue('{ invalid json }');

      // Should not throw, should return defaults
      const config = ConfigService.loadConfig();

      expect(config.defaultType).toBe('feat');
    });

    it('should fallback to cwd when not in git repo', () => {
      mockedGitService.getGitRoot.mockImplementation(() => {
        throw new Error('Not a git repo');
      });
      mockedFs.existsSync.mockReturnValue(false);

      const config = ConfigService.loadConfig();

      expect(config).toBeDefined();
    });
  });

  describe('getConfig', () => {
    it('should return loaded config', () => {
      mockedGitService.getGitRoot.mockReturnValue('/project');
      mockedFs.existsSync.mockReturnValue(false);

      const config = ConfigService.getConfig();

      expect(config).toBeDefined();
      expect(config.defaultType).toBe('feat');
    });
  });

  describe('clearCache', () => {
    it('should clear the cached config', () => {
      mockedGitService.getGitRoot.mockReturnValue('/project');
      mockedFs.existsSync.mockReturnValue(false);

      ConfigService.loadConfig();
      ConfigService.clearCache();
      ConfigService.loadConfig();

      expect(mockedGitService.getGitRoot).toHaveBeenCalledTimes(2);
    });
  });

  describe('initConfig', () => {
    it('should create config file successfully', () => {
      mockedGitService.getGitRoot.mockReturnValue('/project');
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.writeFileSync.mockImplementation(() => {});

      const result = ConfigService.initConfig();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Config file created');
      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });

    it('should fail if config already exists', () => {
      mockedGitService.getGitRoot.mockReturnValue('/project');
      mockedFs.existsSync.mockReturnValue(true);

      const result = ConfigService.initConfig();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Config file already exists');
    });

    it('should handle write errors', () => {
      mockedGitService.getGitRoot.mockReturnValue('/project');
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = ConfigService.initConfig();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to create config');
    });
  });
});
