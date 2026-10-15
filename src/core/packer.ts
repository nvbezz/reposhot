import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { get_encoding } from 'tiktoken';
import { walkDirectory } from './walker';
import { generateXml } from '../output/xmlGenerator';
import { detectSecrets } from './secrets';
import { printWarning } from '../cli/reporter';
import { ReposhotConfig, PackResult, PackedFile, SecretMatch } from '../types';

const BINARY_CHECK_BYTES = 8192;
// raw pixel or audio data often has no NUL bytes, but is mostly invalid UTF-8 or control chars
const BINARY_SUSPICIOUS_RATIO = 0.1;
// below this size the cost of spawning workers outweighs the parallel speedup
const PARALLEL_TOKENIZE_MIN_CHARS = 2 * 1024 * 1024;
const MAX_TOKEN_WORKERS = 8;

// eval'd as CommonJS so the bundle stays a single file; tiktoken is resolved by the parent
const TOKEN_WORKER_SOURCE = `
const { parentPort, workerData } = require('worker_threads');
const { get_encoding } = require(workerData.tiktokenPath);
const enc = get_encoding('cl100k_base');
let total = 0;
try {
  for (const text of workerData.texts) total += enc.encode_ordinary(text).length;
} finally {
  enc.free();
}
parentPort.postMessage(total);
`;

export async function runPack(config: ReposhotConfig): Promise<PackResult> {
  validateOutputPath(config.output, config.rootDir);

  const start = Date.now();

  const { included, skipped: walkerSkipped } = walkDirectory(config);

  const files: PackedFile[] = [];
  const secretMatches: SecretMatch[] = [];
  let extraSkipped = 0;

  for (const absPath of included) {
    let buffer: Buffer;
    try {
      buffer = fs.readFileSync(absPath);
    } catch {
      extraSkipped++;
      continue;
    }

    if (isBinary(buffer)) {
      extraSkipped++;
      continue;
    }

    const content = buffer.toString('utf8');
    const relPath = path.relative(config.rootDir, absPath).replace(/\\/g, '/');
    files.push({ path: absPath, relPath, content });

    if (config.checkSecrets) {
      const match = detectSecrets(relPath, content);
      if (match) secretMatches.push(match);
    }
  }

  const totalChars = files.reduce((sum, f) => sum + f.content.length, 0);
  const totalTokens = await countTokens(files.map((f) => f.content));

  const xml = generateXml({
    files,
    rootDir: config.rootDir,
    totalTokens,
    showLineNumbers: config.showLineNumbers,
    removeComments: config.removeComments,
  });

  writeOutput(config.output, xml);

  for (const match of secretMatches) {
    printWarning(`potential secrets in ${match.relPath} (${match.findings.join(', ')})`);
  }

  return {
    outputPath: config.output,
    fileCount: files.length,
    totalChars,
    totalTokens,
    skippedCount: walkerSkipped + extraSkipped,
    durationMs: Date.now() - start,
  };
}

export function writeOutput(outputPath: string, content: string): void {
  if (outputPath === '-') {
    process.stdout.write(content);
    return;
  }
  fs.writeFileSync(outputPath, content, 'utf8');
}

export function isBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, BINARY_CHECK_BYTES);
  if (sample.includes(0)) return true;
  if (sample.length === 0) return false;

  // stream mode keeps a multi-byte char cut off at the sample boundary from counting as invalid
  const text = new TextDecoder('utf-8').decode(sample, { stream: true });
  let suspicious = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const isControl = code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d
      && code !== 0x0c && code !== 0x1b;
    if (code === 0xfffd || isControl) suspicious++;
  }
  return suspicious / text.length > BINARY_SUSPICIOUS_RATIO;
}

const BLOCKED_OUTPUT_PATHS = [
  '/etc', '/usr', '/bin', '/sbin', '/boot', '/proc', '/sys', '/dev',
  'C:\\Windows', 'C:\\System32', 'C:\\Program Files',
];

function validateOutputPath(outputPath: string, rootDir: string): void {
  if (outputPath === '-') return;
  const resolved = path.resolve(rootDir, outputPath);
  const lower = resolved.toLowerCase();
  for (const blocked of BLOCKED_OUTPUT_PATHS) {
    const dir = blocked.toLowerCase();
    // compare on a separator boundary so /devel or /usrdata are not rejected
    if (lower === dir || lower.startsWith(`${dir}/`) || lower.startsWith(`${dir}\\`)) {
      throw new Error(`output path resolves to a system directory: ${resolved}`);
    }
  }
}

export async function countTokens(contents: string[]): Promise<number> {
  const totalChars = contents.reduce((sum, c) => sum + c.length, 0);
  const workerCount = Math.min(availableCores(), MAX_TOKEN_WORKERS, contents.length);
  if (totalChars < PARALLEL_TOKENIZE_MIN_CHARS || workerCount < 2) {
    return countTokensSync(contents);
  }
  try {
    const chunks = partitionBySize(contents, workerCount);
    const counts = await Promise.all(chunks.map(runTokenWorker));
    return counts.reduce((sum, n) => sum + n, 0);
  } catch {
    return countTokensSync(contents);
  }
}

function countTokensSync(contents: string[]): number {
  const enc = get_encoding('cl100k_base');
  try {
    // encode_ordinary treats "<|endoftext|>" and friends as plain text instead of throwing
    return contents.reduce((sum, c) => sum + enc.encode_ordinary(c).length, 0);
  } finally {
    enc.free();
  }
}

function runTokenWorker(texts: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(TOKEN_WORKER_SOURCE, {
      eval: true,
      workerData: { texts, tiktokenPath: require.resolve('tiktoken') },
    });
    worker.once('message', (count: number) => resolve(count));
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`token worker exited with code ${code}`));
    });
  });
}

function partitionBySize(contents: string[], parts: number): string[][] {
  const chunks: string[][] = Array.from({ length: parts }, () => []);
  const loads = new Array<number>(parts).fill(0);
  const bySizeDesc = [...contents].sort((a, b) => b.length - a.length);
  for (const text of bySizeDesc) {
    let target = 0;
    for (let i = 1; i < parts; i++) {
      if (loads[i] < loads[target]) target = i;
    }
    chunks[target].push(text);
    loads[target] += text.length;
  }
  return chunks.filter((c) => c.length > 0);
}

function availableCores(): number {
  return typeof os.availableParallelism === 'function'
    ? os.availableParallelism()
    : os.cpus().length;
}
