import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runPack, writeOutput, isBinary } from '../src/core/packer';
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
    output: path.join(rootDir, 'out.xml'),
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

// --- isBinary ---

test('isBinary: returns false for plain text', () => {
  assert.equal(isBinary(Buffer.from('hello world\nsome code\n')), false);
});

test('isBinary: returns true when null byte present', () => {
  const buf = Buffer.alloc(100, 'a'.charCodeAt(0));
  buf[50] = 0;
  assert.equal(isBinary(buf), true);
});

test('isBinary: only checks first 8KB', () => {
  // null byte beyond 8192 → not detected
  const buf = Buffer.alloc(8193, 'a'.charCodeAt(0));
  buf[8192] = 0;
  assert.equal(isBinary(buf), false);
});

test('isBinary: returns false for empty buffer', () => {
  assert.equal(isBinary(Buffer.alloc(0)), false);
});

// --- writeOutput ---

test('writeOutput: writes content to file', () => {
  const tmp = makeTmp();
  const outPath = path.join(tmp, 'result.xml');
  writeOutput(outPath, '<root>hello</root>');
  assert.equal(fs.readFileSync(outPath, 'utf8'), '<root>hello</root>');
  cleanup(tmp);
});

test('writeOutput: overwrites existing file', () => {
  const tmp = makeTmp();
  const outPath = path.join(tmp, 'result.xml');
  fs.writeFileSync(outPath, 'old content');
  writeOutput(outPath, 'new content');
  assert.equal(fs.readFileSync(outPath, 'utf8'), 'new content');
  cleanup(tmp);
});

// --- runPack ---

test('runPack: returns correct fileCount', async () => {
  const tmp = makeTmp();
  write(tmp, 'a.ts', 'const a = 1;');
  write(tmp, 'b.ts', 'const b = 2;');

  const result = await runPack(makeConfig(tmp));
  assert.equal(result.fileCount, 2);
  cleanup(tmp);
});

test('runPack: skips binary files', async () => {
  const tmp = makeTmp();
  write(tmp, 'a.ts', 'const a = 1;');
  const binPath = path.join(tmp, 'image.png');
  const buf = Buffer.alloc(100, 0); // all null bytes
  fs.writeFileSync(binPath, buf);

  const result = await runPack(makeConfig(tmp));
  assert.equal(result.fileCount, 1);
  assert.equal(result.skippedCount, 1);
  cleanup(tmp);
});

test('runPack: writes XML output file', async () => {
  const tmp = makeTmp();
  write(tmp, 'hello.ts', 'export const x = 1;');

  const outPath = path.join(tmp, 'snap.xml');
  await runPack(makeConfig(tmp, { output: outPath }));

  assert.ok(fs.existsSync(outPath));
  const content = fs.readFileSync(outPath, 'utf8');
  assert.ok(content.includes('reposhot for AI consumption'));
  cleanup(tmp);
});

test('runPack: output contains file content', async () => {
  const tmp = makeTmp();
  write(tmp, 'greet.ts', 'export function hello() {}');

  const outPath = path.join(tmp, 'snap.xml');
  await runPack(makeConfig(tmp, { output: outPath }));

  const content = fs.readFileSync(outPath, 'utf8');
  assert.ok(content.includes('hello()'));
  cleanup(tmp);
});

test('runPack: totalTokens is greater than 0 for non-empty files', async () => {
  const tmp = makeTmp();
  write(tmp, 'a.ts', 'const message = "hello world";');

  const result = await runPack(makeConfig(tmp));
  assert.ok(result.totalTokens > 0);
  cleanup(tmp);
});

test('runPack: totalChars matches sum of file content lengths', async () => {
  const tmp = makeTmp();
  const content = 'export const x = 42;';
  write(tmp, 'a.ts', content);

  const result = await runPack(makeConfig(tmp));
  assert.equal(result.totalChars, content.length);
  cleanup(tmp);
});

test('runPack: durationMs is a non-negative number', async () => {
  const tmp = makeTmp();
  write(tmp, 'a.ts', 'hello');

  const result = await runPack(makeConfig(tmp));
  assert.ok(result.durationMs >= 0);
  cleanup(tmp);
});

test('runPack: empty directory produces fileCount 0', async () => {
  const tmp = makeTmp();
  const result = await runPack(makeConfig(tmp));
  assert.equal(result.fileCount, 0);
  cleanup(tmp);
});

// --- path traversal ---

test('runPack: throws on output path targeting system directory', async () => {
  const tmp = makeTmp();
  const systemPath = process.platform === 'win32'
    ? 'C:\\Windows\\evil.xml'
    : '/etc/evil.xml';
  const config = makeConfig(tmp, { output: systemPath });
  await assert.rejects(
    () => runPack(config),
    /system directory/,
  );
  cleanup(tmp);
});
