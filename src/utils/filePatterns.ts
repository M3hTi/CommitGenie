import { FilePattern } from '../types';

export const filePatterns: FilePattern[] = [
  // Test files
  {
    pattern: /\.(test|spec)\.(ts|js|tsx|jsx)$/,
    type: 'test',
    commitType: 'test',
  },
  {
    pattern: /\/__tests__\//,
    type: 'test',
    commitType: 'test',
  },
  {
    pattern: /\/tests?\//,
    type: 'test',
    commitType: 'test',
  },

  // Documentation
  {
    pattern: /\.(md|mdx)$/,
    type: 'docs',
    commitType: 'docs',
  },
  {
    pattern: /\/docs?\//,
    type: 'docs',
    commitType: 'docs',
  },
  {
    pattern: /^README/i,
    type: 'docs',
    commitType: 'docs',
  },

  // Configuration files
  {
    pattern: /\.(json|ya?ml|toml|ini|config\.js)$/,
    type: 'config',
    commitType: 'chore',
  },
  {
    pattern: /\.(eslintrc|prettierrc|babelrc|gitignore|dockerignore)/,
    type: 'config',
    commitType: 'chore',
  },
  {
    pattern: /^(package\.json|tsconfig\.json|webpack\.config|vite\.config)/,
    type: 'config',
    commitType: 'chore',
  },
  {
    pattern: /Dockerfile/,
    type: 'config',
    commitType: 'chore',
  },
];

export function detectFileType(
  filePath: string
): 'test' | 'docs' | 'config' | 'source' {
  for (const pattern of filePatterns) {
    if (pattern.pattern.test(filePath)) {
      return pattern.type;
    }
  }
  return 'source';
}

export function getCommitTypeForFile(filePath: string): string {
  for (const pattern of filePatterns) {
    if (pattern.pattern.test(filePath)) {
      return pattern.commitType;
    }
  }
  return 'feat'; // Default for source files
}
