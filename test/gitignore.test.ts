import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  parseIgnoreFile,
  loadIgnorePatterns,
  matchesPattern,
  ALWAYS_IGNORED,
} from '../src/core/gitignore';

function makeTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'reposhot-'));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// --- parseIgnoreFile ---

test('parseIgnoreFile: returns empty array when file does not exist', () => {
  assert.deepEqual(parseIgnoreFile('/nonexistent/.gitignore'), []);
});

test('parseIgnoreFile: filters comments and blank lines', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, '.gitignore'), '# comment\n\nnode_modules/\ndist/\n');
  assert.deepEqual(parseIgnoreFile(path.join(tmp, '.gitignore')), ['node_modules/', 'dist/']);
  cleanup(tmp);
});

test('parseIgnoreFile: trims whitespace from lines', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, '.gitignore'), '  dist/  \n  *.log  \n');
  assert.deepEqual(parseIgnoreFile(path.join(tmp, '.gitignore')), ['dist/', '*.log']);
  cleanup(tmp);
});

// --- loadIgnorePatterns ---

test('loadIgnorePatterns: merges .gitignore and .reposhotignore', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, '.gitignore'), 'dist/\n');
  fs.writeFileSync(path.join(tmp, '.reposhotignore'), 'secrets/\n');
  assert.deepEqual(loadIgnorePatterns(tmp), ['dist/', 'secrets/']);
  cleanup(tmp);
});

test('loadIgnorePatterns: returns empty array when no ignore files exist', () => {
  const tmp = makeTmp();
  assert.deepEqual(loadIgnorePatterns(tmp), []);
  cleanup(tmp);
});

test('loadIgnorePatterns: works when only .reposhotignore exists', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, '.reposhotignore'), 'private/\n');
  assert.deepEqual(loadIgnorePatterns(tmp), ['private/']);
  cleanup(tmp);
});

// --- matchesPattern ---

test('matchesPattern: matches *.ext wildcard at any depth', () => {
  assert.equal(matchesPattern('src/foo.log', ['*.log']), true);
  assert.equal(matchesPattern('src/deep/foo.log', ['*.log']), true);
  assert.equal(matchesPattern('src/foo.ts', ['*.log']), false);
});

test('matchesPattern: matches ** glob for directory trees', () => {
  assert.equal(matchesPattern('node_modules/lodash/index.js', ['node_modules/**']), true);
  assert.equal(matchesPattern('src/index.ts', ['node_modules/**']), false);
});

test('matchesPattern: trailing slash expands to directory contents', () => {
  assert.equal(matchesPattern('dist/index.js', ['dist/']), true);
  assert.equal(matchesPattern('dist/sub/foo.js', ['dist/']), true);
  assert.equal(matchesPattern('src/index.ts', ['dist/']), false);
});

test('matchesPattern: matches ? single-character wildcard', () => {
  assert.equal(matchesPattern('src/a.ts', ['src/?.ts']), true);
  assert.equal(matchesPattern('src/ab.ts', ['src/?.ts']), false);
});

test('matchesPattern: matches dot files', () => {
  assert.equal(matchesPattern('.env', ['.env']), true);
  assert.equal(matchesPattern('.DS_Store', ['.DS_Store']), true);
});

test('matchesPattern: normalizes Windows backslash paths', () => {
  assert.equal(matchesPattern('src\\core\\gitignore.ts', ['src/**']), true);
  assert.equal(matchesPattern('node_modules\\lodash\\index.js', ['node_modules/**']), true);
});

test('matchesPattern: returns false for empty patterns array', () => {
  assert.equal(matchesPattern('src/index.ts', []), false);
});

// --- ALWAYS_IGNORED ---

test('ALWAYS_IGNORED: contains critical entries', () => {
  const required = ['node_modules', '.git', 'dist', '.env', '*.log'];
  for (const entry of required) {
    assert.ok(ALWAYS_IGNORED.includes(entry), `Missing: ${entry}`);
  }
});

test('ALWAYS_IGNORED: reposhot output files are matched', () => {
  assert.equal(matchesPattern('reposhot-output.xml', ALWAYS_IGNORED), true);
  assert.equal(matchesPattern('reposhot-output-2024.xml', ALWAYS_IGNORED), true);
});
