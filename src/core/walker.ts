import * as fs from 'fs';
import * as path from 'path';
import { ALWAYS_IGNORED, createMatcher, loadIgnorePatterns, PathMatcher } from './gitignore';
import { ReposhotConfig } from '../types';

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

export interface WalkResult {
  included: string[];
  skipped: number;
}

export function walkDirectory(config: ReposhotConfig): WalkResult {
  const ignoreMatcher = createMatcher(buildIgnorePatterns(config));
  const includeMatcher: PathMatcher | null =
    config.include.length > 0 ? createMatcher(config.include) : null;
  // a custom output name inside the repo would otherwise be packed into the next snapshot
  const outputAbs = config.output === '-' ? null : path.resolve(config.rootDir, config.output);
  const included: string[] = [];
  const visitedDirs = new Set<string>();
  let skipped = 0;

  const rootReal = safeRealpath(config.rootDir) ?? config.rootDir;
  const rootRealPrefix = rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep;

  const isInsideRoot = (real: string): boolean =>
    real === rootReal || real.startsWith(rootRealPrefix);

  const considerFile = (absPath: string, relPath: string, size: number): void => {
    if (absPath === outputAbs) return;
    if (includeMatcher && !includeMatcher.matchesPath(relPath)) {
      skipped++;
      return;
    }
    if (size > MAX_FILE_SIZE) {
      skipped++;
      return;
    }
    included.push(absPath);
  };

  function walk(dir: string, relDir: string): void {
    // symlinked directories can point back to an ancestor and recurse forever
    const real = safeRealpath(dir);
    if (real === null || visitedDirs.has(real)) return;
    visitedDirs.add(real);

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      skipped++;
      return;
    }

    for (const entry of entries) {
      const absPath = path.join(dir, entry.name);
      const relPath = relDir === '' ? entry.name : `${relDir}/${entry.name}`;

      let isDir = entry.isDirectory();
      let isFile = entry.isFile();
      let size = -1;

      if (entry.isSymbolicLink()) {
        const target = safeRealpath(absPath);
        if (target === null || !isInsideRoot(target)) {
          skipped++;
          continue;
        }
        try {
          const stat = fs.statSync(absPath);
          isDir = stat.isDirectory();
          isFile = stat.isFile();
          size = stat.size;
        } catch {
          skipped++;
          continue;
        }
      }

      if (ignoreMatcher.matchesEntry(relPath, isDir)) {
        if (isFile) skipped++;
        continue;
      }

      if (isDir) {
        walk(absPath, relPath);
        continue;
      }

      if (!isFile) continue;

      if (size < 0) {
        try {
          size = fs.statSync(absPath).size;
        } catch {
          skipped++;
          continue;
        }
      }

      considerFile(absPath, relPath, size);
    }
  }

  walk(config.rootDir, '');
  included.sort();
  return { included, skipped };
}

function buildIgnorePatterns(config: ReposhotConfig): string[] {
  const patterns = [...ALWAYS_IGNORED, ...config.ignore];
  if (config.respectGitignore) {
    patterns.push(...loadIgnorePatterns(config.rootDir));
  }
  return patterns;
}

function safeRealpath(p: string): string | null {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}
