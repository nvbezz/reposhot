import * as fs from 'fs';
import * as path from 'path';
import { get_encoding } from 'tiktoken';
import { walkDirectory } from './walker';
import { generateXml } from '../output/xmlGenerator';
import { detectSecrets } from './secrets';
import { printWarning } from '../cli/reporter';
import { ReposhotConfig, PackResult, PackedFile, SecretMatch } from '../types';

const BINARY_CHECK_BYTES = 8192;

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
  const totalTokens = countTokens(files.map((f) => f.content).join(''));

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
  const sample = buffer.slice(0, BINARY_CHECK_BYTES);
  return sample.includes(0);
}

const BLOCKED_OUTPUT_PATHS = [
  '/etc', '/usr', '/bin', '/sbin', '/boot', '/proc', '/sys', '/dev',
  'C:\\Windows', 'C:\\System32', 'C:\\Program Files',
];

function validateOutputPath(outputPath: string, rootDir: string): void {
  if (outputPath === '-') return;
  const resolved = path.resolve(rootDir, outputPath);
  for (const blocked of BLOCKED_OUTPUT_PATHS) {
    if (resolved.toLowerCase().startsWith(blocked.toLowerCase())) {
      throw new Error(`output path resolves to a system directory: ${resolved}`);
    }
  }
}

function countTokens(text: string): number {
  const enc = get_encoding('cl100k_base');
  const tokens = enc.encode(text);
  enc.free();
  return tokens.length;
}
