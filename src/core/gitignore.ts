import * as fs from 'fs';
import * as path from 'path';
import { Minimatch } from 'minimatch';

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
  // .env.local / .env.production usually hold real credentials; templates are safe to share
  '.env.!(example|sample|template)',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  'reposhot-output*.xml',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
];

export function parseIgnoreFile(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith('!'));
  } catch {
    return [];
  }
}

export function loadIgnorePatterns(rootDir: string): string[] {
  const gitignore = parseIgnoreFile(path.join(rootDir, '.gitignore'));
  const reposhotignore = parseIgnoreFile(path.join(rootDir, '.reposhotignore'));
  return [...gitignore, ...reposhotignore];
}

interface CompiledPattern {
  literal: string | null;
  matcher: Minimatch;
  anchored: boolean;
  dirOnly: boolean;
}

export interface PathMatcher {
  // Checks a single walker entry; its ancestors are assumed to be checked already
  matchesEntry(relPath: string, isDir: boolean): boolean;
  // Checks a file path, including every ancestor directory
  matchesPath(relPath: string): boolean;
}

const GLOB_CHARS = /[*?[\]{}()!+@\\]/;

function compilePattern(raw: string): CompiledPattern {
  let pattern = raw;
  const dirOnly = pattern.endsWith('/');
  if (dirOnly) pattern = pattern.slice(0, -1);
  // gitignore semantics: a slash anywhere but the end anchors the pattern to the root
  const anchored = pattern.includes('/');
  if (pattern.startsWith('/')) pattern = pattern.slice(1);
  return {
    literal: GLOB_CHARS.test(pattern) ? null : pattern,
    matcher: new Minimatch(pattern, { dot: true }),
    anchored,
    dirOnly,
  };
}

function testSegment(
  cp: CompiledPattern,
  prefix: string,
  name: string,
  isDir: boolean,
): boolean {
  if (cp.dirOnly && !isDir) return false;
  const target = cp.anchored ? prefix : name;
  return cp.literal !== null ? cp.literal === target : cp.matcher.match(target);
}

export function createMatcher(patterns: string[]): PathMatcher {
  // negated patterns would make minimatch match everything else, so they are dropped
  const compiled = patterns
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !p.startsWith('!') && p !== '/')
    .map(compilePattern);

  const matchesEntry = (relPath: string, isDir: boolean): boolean => {
    const name = relPath.slice(relPath.lastIndexOf('/') + 1);
    return compiled.some((cp) => testSegment(cp, relPath, name, isDir));
  };

  const matchesPath = (relPath: string): boolean => {
    if (compiled.length === 0) return false;
    const segments = relPath.replace(/\\/g, '/').split('/');
    let prefix = '';
    for (let i = 0; i < segments.length; i++) {
      prefix = i === 0 ? segments[0] : `${prefix}/${segments[i]}`;
      const isDir = i < segments.length - 1;
      if (compiled.some((cp) => testSegment(cp, prefix, segments[i], isDir))) return true;
    }
    return false;
  };

  return { matchesEntry, matchesPath };
}

const matcherCache = new Map<string, PathMatcher>();

export function matchesPattern(relPath: string, patterns: string[]): boolean {
  const key = patterns.join('\0');
  let matcher = matcherCache.get(key);
  if (!matcher) {
    matcher = createMatcher(patterns);
    matcherCache.set(key, matcher);
  }
  return matcher.matchesPath(relPath);
}
