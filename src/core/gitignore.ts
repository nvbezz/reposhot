import * as fs from 'fs';
import * as path from 'path';
import { minimatch } from 'minimatch';

export const ALWAYS_IGNORED: string[] = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.cache',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
  '.env',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  'reposhot-output*.xml',
];

export function parseIgnoreFile(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
  } catch {
    return [];
  }
}

export function loadIgnorePatterns(rootDir: string): string[] {
  const gitignore = parseIgnoreFile(path.join(rootDir, '.gitignore'));
  const reposhotignore = parseIgnoreFile(path.join(rootDir, '.reposhotignore'));
  return [...gitignore, ...reposhotignore];
}

export function matchesPattern(relPath: string, patterns: string[]): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  return patterns.some((pattern) => {
    // trailing slash means directory — expand to glob
    const p = pattern.endsWith('/') ? `${pattern}**` : pattern;
    return minimatch(normalized, p, { dot: true, matchBase: true });
  });
}
