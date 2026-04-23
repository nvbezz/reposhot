import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseArgs, loadConfigFile } from '../src/cli/args';

function makeTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'reposhot-'));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// --- defaults ---

test('parseArgs: applies all defaults when no flags', () => {
  const tmp = makeTmp();
  const config = parseArgs([], tmp);
  assert.equal(config.rootDir, tmp);
  assert.equal(config.output, 'reposhot-output.xml');
  assert.deepEqual(config.include, []);
  assert.deepEqual(config.ignore, []);
  assert.equal(config.respectGitignore, true);
  assert.equal(config.showLineNumbers, false);
  assert.equal(config.removeComments, false);
  cleanup(tmp);
});

// --- output flag ---

test('parseArgs: --output sets output path', () => {
  const tmp = makeTmp();
  const config = parseArgs(['--output', 'snap.xml'], tmp);
  assert.equal(config.output, 'snap.xml');
  cleanup(tmp);
});

test('parseArgs: -o is alias for --output', () => {
  const tmp = makeTmp();
  const config = parseArgs(['-o', 'snap.xml'], tmp);
  assert.equal(config.output, 'snap.xml');
  cleanup(tmp);
});

// --- include flag ---

test('parseArgs: --include sets include array', () => {
  const tmp = makeTmp();
  const config = parseArgs(['--include', 'src/**'], tmp);
  assert.deepEqual(config.include, ['src/**']);
  cleanup(tmp);
});

test('parseArgs: -i is alias for --include', () => {
  const tmp = makeTmp();
  const config = parseArgs(['-i', 'src/**'], tmp);
  assert.deepEqual(config.include, ['src/**']);
  cleanup(tmp);
});

test('parseArgs: --include repeatable', () => {
  const tmp = makeTmp();
  const config = parseArgs(['--include', 'src/**', '--include', 'lib/**'], tmp);
  assert.deepEqual(config.include, ['src/**', 'lib/**']);
  cleanup(tmp);
});

// --- ignore flag ---

test('parseArgs: --ignore sets ignore array', () => {
  const tmp = makeTmp();
  const config = parseArgs(['--ignore', '**/*.test.ts'], tmp);
  assert.deepEqual(config.ignore, ['**/*.test.ts']);
  cleanup(tmp);
});

test('parseArgs: --ignore repeatable', () => {
  const tmp = makeTmp();
  const config = parseArgs(['--ignore', '*.test.ts', '--ignore', '*.spec.ts'], tmp);
  assert.deepEqual(config.ignore, ['*.test.ts', '*.spec.ts']);
  cleanup(tmp);
});

// --- boolean flags ---

test('parseArgs: --no-gitignore sets respectGitignore to false', () => {
  const tmp = makeTmp();
  const config = parseArgs(['--no-gitignore'], tmp);
  assert.equal(config.respectGitignore, false);
  cleanup(tmp);
});

test('parseArgs: --line-numbers sets showLineNumbers to true', () => {
  const tmp = makeTmp();
  const config = parseArgs(['--line-numbers'], tmp);
  assert.equal(config.showLineNumbers, true);
  cleanup(tmp);
});

test('parseArgs: --remove-comments sets removeComments to true', () => {
  const tmp = makeTmp();
  const config = parseArgs(['--remove-comments'], tmp);
  assert.equal(config.removeComments, true);
  cleanup(tmp);
});

// --- loadConfigFile ---

test('loadConfigFile: returns empty object when no config file', () => {
  const tmp = makeTmp();
  assert.deepEqual(loadConfigFile(tmp), {});
  cleanup(tmp);
});

test('loadConfigFile: reads and parses reposhot.config.json', () => {
  const tmp = makeTmp();
  fs.writeFileSync(
    path.join(tmp, 'reposhot.config.json'),
    JSON.stringify({ output: 'snap.xml', showLineNumbers: true }),
  );
  const cfg = loadConfigFile(tmp);
  assert.equal(cfg.output, 'snap.xml');
  assert.equal(cfg.showLineNumbers, true);
  cleanup(tmp);
});

test('loadConfigFile: returns empty object on invalid JSON', () => {
  const tmp = makeTmp();
  fs.writeFileSync(path.join(tmp, 'reposhot.config.json'), 'not json {{');
  assert.deepEqual(loadConfigFile(tmp), {});
  cleanup(tmp);
});

// --- config file priority ---

test('parseArgs: config file values are used when no flags', () => {
  const tmp = makeTmp();
  fs.writeFileSync(
    path.join(tmp, 'reposhot.config.json'),
    JSON.stringify({ output: 'from-file.xml', respectGitignore: false }),
  );
  const config = parseArgs([], tmp);
  assert.equal(config.output, 'from-file.xml');
  assert.equal(config.respectGitignore, false);
  cleanup(tmp);
});

test('parseArgs: argv flags override config file', () => {
  const tmp = makeTmp();
  fs.writeFileSync(
    path.join(tmp, 'reposhot.config.json'),
    JSON.stringify({ output: 'from-file.xml' }),
  );
  const config = parseArgs(['--output', 'from-argv.xml'], tmp);
  assert.equal(config.output, 'from-argv.xml');
  cleanup(tmp);
});

test('parseArgs: argv include overrides config file include', () => {
  const tmp = makeTmp();
  fs.writeFileSync(
    path.join(tmp, 'reposhot.config.json'),
    JSON.stringify({ include: ['lib/**'] }),
  );
  const config = parseArgs(['--include', 'src/**'], tmp);
  assert.deepEqual(config.include, ['src/**']);
  cleanup(tmp);
});

test('parseArgs: config file include used when no --include flag', () => {
  const tmp = makeTmp();
  fs.writeFileSync(
    path.join(tmp, 'reposhot.config.json'),
    JSON.stringify({ include: ['lib/**'] }),
  );
  const config = parseArgs([], tmp);
  assert.deepEqual(config.include, ['lib/**']);
  cleanup(tmp);
});

// --- invalid flags ---

test('parseArgs: throws on unknown flag', () => {
  const tmp = makeTmp();
  assert.throws(() => parseArgs(['--unknown-flag'], tmp));
  cleanup(tmp);
});
