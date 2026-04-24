import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { walkDirectory } from '../src/core/walker';
import { ReposhotConfig } from '../src/types';

function makeTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'reposhot-'));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function makeConfig(rootDir: string, overrides: Partial<ReposhotConfig> = {}): ReposhotConfig {
  return {
    rootDir,
    output: 'reposhot-output.xml',
    include: [],
    ignore: [],
    respectGitignore: false,
    showLineNumbers: false,
    removeComments: false,
    checkSecrets: false,
    ...overrides,
  };
}

function write(dir: string, relPath: string, content = 'hello'): string {
  const abs = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

// --- basic walking ---

test('walkDirectory: returns files sorted alphabetically', () => {
  const tmp = makeTmp();
  write(tmp, 'b.ts');
  write(tmp, 'a.ts');
  write(tmp, 'src/c.ts');

  const { included } = walkDirectory(makeConfig(tmp));
  const names = included.map((p) => path.relative(tmp, p).replace(/\\/g, '/'));
  assert.deepEqual(names, ['a.ts', 'b.ts', 'src/c.ts']);
  cleanup(tmp);
});

test('walkDirectory: walks nested directories', () => {
  const tmp = makeTmp();
  write(tmp, 'src/core/foo.ts');
  write(tmp, 'src/cli/bar.ts');

  const { included } = walkDirectory(makeConfig(tmp));
  assert.equal(included.length, 2);
  cleanup(tmp);
});

test('walkDirectory: skipped is 0 when all files are included', () => {
  const tmp = makeTmp();
  write(tmp, 'a.ts');
  write(tmp, 'b.ts');

  const { skipped } = walkDirectory(makeConfig(tmp));
  assert.equal(skipped, 0);
  cleanup(tmp);
});

// --- ALWAYS_IGNORED ---

test('walkDirectory: ignores node_modules directory', () => {
  const tmp = makeTmp();
  write(tmp, 'src/index.ts');
  write(tmp, 'node_modules/lodash/index.js');

  const { included } = walkDirectory(makeConfig(tmp));
  const names = included.map((p) => path.relative(tmp, p).replace(/\\/g, '/'));
  assert.deepEqual(names, ['src/index.ts']);
  cleanup(tmp);
});

test('walkDirectory: ignores .git directory', () => {
  const tmp = makeTmp();
  write(tmp, 'README.md');
  write(tmp, '.git/HEAD', 'ref: refs/heads/main');

  const { included } = walkDirectory(makeConfig(tmp));
  const names = included.map((p) => path.relative(tmp, p).replace(/\\/g, '/'));
  assert.deepEqual(names, ['README.md']);
  cleanup(tmp);
});

test('walkDirectory: ignores dist directory', () => {
  const tmp = makeTmp();
  write(tmp, 'src/index.ts');
  write(tmp, 'dist/index.js');

  const { included } = walkDirectory(makeConfig(tmp));
  const names = included.map((p) => path.relative(tmp, p).replace(/\\/g, '/'));
  assert.deepEqual(names, ['src/index.ts']);
  cleanup(tmp);
});

test('walkDirectory: ignores *.log files', () => {
  const tmp = makeTmp();
  write(tmp, 'app.ts');
  write(tmp, 'error.log');
  write(tmp, 'logs/debug.log');

  const { included, skipped } = walkDirectory(makeConfig(tmp));
  assert.equal(included.length, 1);
  assert.equal(skipped, 2);
  cleanup(tmp);
});

test('walkDirectory: ignores reposhot-output*.xml files', () => {
  const tmp = makeTmp();
  write(tmp, 'app.ts');
  write(tmp, 'reposhot-output.xml');
  write(tmp, 'reposhot-output-2024.xml');

  const { included } = walkDirectory(makeConfig(tmp));
  const names = included.map((p) => path.relative(tmp, p).replace(/\\/g, '/'));
  assert.deepEqual(names, ['app.ts']);
  cleanup(tmp);
});

// --- user ignore patterns ---

test('walkDirectory: respects config.ignore patterns', () => {
  const tmp = makeTmp();
  write(tmp, 'src/index.ts');
  write(tmp, 'src/index.test.ts');

  const { included } = walkDirectory(makeConfig(tmp, { ignore: ['*.test.ts'] }));
  const names = included.map((p) => path.relative(tmp, p).replace(/\\/g, '/'));
  assert.deepEqual(names, ['src/index.ts']);
  cleanup(tmp);
});

// --- include patterns ---

test('walkDirectory: config.include filters to matching files only', () => {
  const tmp = makeTmp();
  write(tmp, 'src/index.ts');
  write(tmp, 'src/styles.css');
  write(tmp, 'README.md');

  const { included } = walkDirectory(makeConfig(tmp, { include: ['**/*.ts'] }));
  const names = included.map((p) => path.relative(tmp, p).replace(/\\/g, '/'));
  assert.deepEqual(names, ['src/index.ts']);
  cleanup(tmp);
});

test('walkDirectory: empty include means include all', () => {
  const tmp = makeTmp();
  write(tmp, 'a.ts');
  write(tmp, 'b.md');

  const { included } = walkDirectory(makeConfig(tmp, { include: [] }));
  assert.equal(included.length, 2);
  cleanup(tmp);
});

// --- gitignore ---

test('walkDirectory: respects .gitignore when respectGitignore is true', () => {
  const tmp = makeTmp();
  write(tmp, 'src/index.ts');
  write(tmp, 'secret.key');
  fs.writeFileSync(path.join(tmp, '.gitignore'), '*.key\n');

  const { included } = walkDirectory(makeConfig(tmp, { respectGitignore: true }));
  const names = included.map((p) => path.relative(tmp, p).replace(/\\/g, '/'));
  assert.ok(!names.includes('secret.key'));
  cleanup(tmp);
});

test('walkDirectory: ignores .gitignore when respectGitignore is false', () => {
  const tmp = makeTmp();
  write(tmp, 'src/index.ts');
  write(tmp, 'secret.key');
  fs.writeFileSync(path.join(tmp, '.gitignore'), '*.key\n');

  const { included } = walkDirectory(makeConfig(tmp, { respectGitignore: false }));
  assert.equal(included.length, 3); // src/index.ts + secret.key + .gitignore
  cleanup(tmp);
});

// --- size limit ---

test('walkDirectory: skips files over 1MB', () => {
  const tmp = makeTmp();
  write(tmp, 'small.ts', 'hello');
  const bigPath = path.join(tmp, 'big.bin');
  fs.writeFileSync(bigPath, Buffer.alloc(1024 * 1024 + 1));

  const { included, skipped } = walkDirectory(makeConfig(tmp));
  const names = included.map((p) => path.relative(tmp, p).replace(/\\/g, '/'));
  assert.deepEqual(names, ['small.ts']);
  assert.equal(skipped, 1);
  cleanup(tmp);
});
