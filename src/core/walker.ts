import * as fs from 'fs';
import * as path from 'path';
import { ALWAYS_IGNORED, loadIgnorePatterns, matchesPattern } from './gitignore';
import { ReposhotConfig } from '../types';

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

export interface WalkResult {
  included: string[];
  skipped: number;
}

export function walkDirectory(config: ReposhotConfig): WalkResult {
  const ignorePatterns = buildIgnorePatterns(config);
  const included: string[] = [];
  let skipped = 0;

  let rootReal: string;
  try {
    rootReal = fs.realpathSync(config.rootDir);
  } catch {
    rootReal = config.rootDir;
  }

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      skipped++;
      return;
    }

    for (const entry of entries) {
      const absPath = path.join(dir, entry.name);
      const relPath = path.relative(config.rootDir, absPath).replace(/\\/g, '/');

      if (isIgnored(relPath, entry.name, ignorePatterns)) {
        if (entry.isFile()) skipped++;
        continue;
      }

      if (entry.isSymbolicLink()) {
        try {
          const real = fs.realpathSync(absPath);
          const rootRealNorm = rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep;
          if (!real.startsWith(rootRealNorm) && real !== rootReal) {
            skipped++;
            continue;
          }
          const stat = fs.statSync(absPath);
          if (stat.isDirectory()) {
            walk(absPath);
          } else if (stat.isFile()) {
            if (!isReadable(absPath)) { skipped++; }
            else if (!isSizeOk(absPath)) { skipped++; }
            else if (config.include.length > 0 && !matchesPattern(relPath, config.include)) { skipped++; }
            else { included.push(absPath); }
          } else {
            skipped++;
          }
        } catch {
          skipped++;
        }
        continue;
      }

      if (entry.isDirectory()) {
        walk(absPath);
        continue;
      }

      if (!entry.isFile()) continue;

      if (!isReadable(absPath)) {
        skipped++;
        continue;
      }

      if (!isSizeOk(absPath)) {
        skipped++;
        continue;
      }

      if (config.include.length > 0 && !matchesPattern(relPath, config.include)) {
        skipped++;
        continue;
      }

      included.push(absPath);
    }
  }

  walk(config.rootDir);
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

function isIgnored(relPath: string, name: string, patterns: string[]): boolean {
  return matchesPattern(relPath, patterns) || matchesPattern(name, patterns);
}

function isReadable(absPath: string): boolean {
  try {
    fs.accessSync(absPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function isSizeOk(absPath: string): boolean {
  try {
    return fs.statSync(absPath).size <= MAX_FILE_SIZE;
  } catch {
    return false;
  }
}
