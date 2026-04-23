import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSummary, printError } from '../src/cli/reporter';
import { PackResult } from '../src/types';

function makeResult(overrides: Partial<PackResult> = {}): PackResult {
  return {
    outputPath: 'reposhot-output.xml',
    fileCount: 10,
    totalChars: 42800,
    totalTokens: 10700,
    skippedCount: 0,
    durationMs: 120,
    ...overrides,
  };
}

// --- formatSummary ---

test('formatSummary: contains output path', () => {
  const out = formatSummary(makeResult({ outputPath: 'snap.xml' }));
  assert.ok(out.includes('snap.xml'));
});

test('formatSummary: contains file count', () => {
  const out = formatSummary(makeResult({ fileCount: 14 }));
  assert.ok(out.includes('14'));
});

test('formatSummary: contains token count', () => {
  const out = formatSummary(makeResult({ totalTokens: 10700 }));
  assert.ok(out.includes('10,700'));
});

test('formatSummary: contains char count', () => {
  const out = formatSummary(makeResult({ totalChars: 42800 }));
  assert.ok(out.includes('42,800'));
});

test('formatSummary: contains duration', () => {
  const out = formatSummary(makeResult({ durationMs: 250 }));
  assert.ok(out.includes('250ms'));
});

test('formatSummary: shows skipped count when > 0', () => {
  const out = formatSummary(makeResult({ skippedCount: 3 }));
  assert.ok(out.includes('3 skipped'));
});

test('formatSummary: hides skipped when 0', () => {
  const out = formatSummary(makeResult({ skippedCount: 0 }));
  assert.ok(!out.includes('skipped'));
});

// --- printError ---

test('printError: writes to stderr, not stdout', () => {
  const stderrChunks: string[] = [];
  const stdoutChunks: string[] = [];

  const origStderr = process.stderr.write.bind(process.stderr);
  const origStdout = process.stdout.write.bind(process.stdout);

  process.stderr.write = (chunk: unknown) => {
    stderrChunks.push(String(chunk));
    return true;
  };
  process.stdout.write = (chunk: unknown) => {
    stdoutChunks.push(String(chunk));
    return true;
  };

  try {
    printError('something went wrong');
  } finally {
    process.stderr.write = origStderr;
    process.stdout.write = origStdout;
  }

  assert.equal(stdoutChunks.length, 0);
  assert.ok(stderrChunks.some((c) => c.includes('something went wrong')));
});
