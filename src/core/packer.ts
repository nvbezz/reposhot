import * as fs from 'fs';
import * as path from 'path';
import { get_encoding } from 'tiktoken';
import { walkDirectory } from './walker';
import { generateXml } from '../output/xmlGenerator';
import { ReposhotConfig, PackResult, PackedFile } from '../types';

const BINARY_CHECK_BYTES = 8192;

export async function runPack(config: ReposhotConfig): Promise<PackResult> {
  const start = Date.now();

  const { included, skipped: walkerSkipped } = walkDirectory(config);

  const files: PackedFile[] = [];
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

function countTokens(text: string): number {
  const enc = get_encoding('cl100k_base');
  const tokens = enc.encode(text);
  enc.free();
  return tokens.length;
}
