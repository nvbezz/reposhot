import * as fs from 'fs';
import * as path from 'path';
import { ALWAYS_IGNORED, createMatcher, loadIgnorePatterns, PathMatcher } from './gitignore';
import { ReposhotConfig } from '../types';

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

// skipped by name so large media never has to be read just to be rejected
const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'icns', 'webp', 'tif', 'tiff', 'psd', 'avif',
  'heic', 'raw', 'cr2', 'nef', 'exr', 'hdr', 'kra', 'xcf',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'mp3', 'mp4', 'm4a', 'wav', 'ogg', 'oga', 'flac', 'aac', 'opus', 'avi', 'mov', 'mkv', 'webm',
  'zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'zst', '7z', 'rar', 'jar', 'war', 'apk', 'aab',
  'exe', 'dll', 'so', 'dylib', 'o', 'obj', 'a', 'lib', 'class', 'pyc', 'pyo', 'wasm', 'node',
  'rlib', 'pdb', 'bin', 'dat', 'iso', 'dmg', 'deb', 'rpm',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
  'sqlite', 'sqlite3', 'db', 'glb', 'fbx', 'blend', 'npy', 'npz', 'pt', 'onnx', 'safetensors',
]);

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
    if (hasBinaryExtension(relPath)) {
      skipped++;
      return;
    }
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

function hasBinaryExtension(relPath: string): boolean {
  const name = relPath.slice(relPath.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 && BINARY_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

function safeRealpath(p: string): string | null {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}
