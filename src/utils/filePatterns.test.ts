import { detectFileType, getCommitTypeForFile } from './filePatterns';

describe('filePatterns', () => {
  describe('detectFileType', () => {
    it('should detect test files by extension', () => {
      expect(detectFileType('src/utils/helper.test.ts')).toBe('test');
      expect(detectFileType('src/utils/helper.spec.js')).toBe('test');
      expect(detectFileType('components/Button.test.tsx')).toBe('test');
    });

    it('should detect test files by directory', () => {
      expect(detectFileType('src/__tests__/helper.ts')).toBe('test');
      expect(detectFileType('src/__tests__/service.ts')).toBe('test');
      expect(detectFileType('src/tests/integration.ts')).toBe('test');
      expect(detectFileType('src/test/unit.ts')).toBe('test');
    });

    it('should detect documentation files', () => {
      expect(detectFileType('README.md')).toBe('docs');
      expect(detectFileType('docs/guide.md')).toBe('docs');
      expect(detectFileType('CONTRIBUTING.mdx')).toBe('docs');
    });

    it('should detect config files', () => {
      expect(detectFileType('package.json')).toBe('config');
      expect(detectFileType('tsconfig.json')).toBe('config');
      expect(detectFileType('.eslintrc')).toBe('config');
      expect(detectFileType('.prettierrc')).toBe('config');
      expect(detectFileType('webpack.config.js')).toBe('config');
      expect(detectFileType('Dockerfile')).toBe('config');
    });

    it('should detect source files as default', () => {
      expect(detectFileType('src/index.ts')).toBe('source');
      expect(detectFileType('src/services/api.ts')).toBe('source');
      expect(detectFileType('lib/utils.js')).toBe('source');
    });
  });

  describe('getCommitTypeForFile', () => {
    it('should return test for test files', () => {
      expect(getCommitTypeForFile('src/helper.test.ts')).toBe('test');
    });

    it('should return docs for documentation files', () => {
      expect(getCommitTypeForFile('README.md')).toBe('docs');
    });

    it('should return chore for config files', () => {
      expect(getCommitTypeForFile('package.json')).toBe('chore');
    });

    it('should return feat for source files', () => {
      expect(getCommitTypeForFile('src/index.ts')).toBe('feat');
    });
  });
});
