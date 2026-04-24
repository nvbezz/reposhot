import { PackResult } from '../types';

const VERSION = '1.1.0';

const tty  = process.stdout.isTTY === true;
const etty = process.stderr.isTTY === true;

const bold   = (s: string) => tty  ? `\x1b[1m${s}\x1b[0m`  : s;
const green  = (s: string) => tty  ? `\x1b[32m${s}\x1b[0m` : s;
const cyan   = (s: string) => tty  ? `\x1b[36m${s}\x1b[0m` : s;
const dim    = (s: string) => tty  ? `\x1b[2m${s}\x1b[0m`  : s;
const red    = (s: string) => etty ? `\x1b[31m${s}\x1b[0m` : s;
const yellow = (s: string) => etty ? `\x1b[33m${s}\x1b[0m` : s;

export function printBanner(): void {
  process.stdout.write(`${bold('reposhot')} ${dim(`v${VERSION}`)}\n`);
}

export function printSummary(result: PackResult): void {
  process.stdout.write(formatSummary(result) + '\n');
}

export function printError(message: string): void {
  process.stderr.write(`${red('error')} ${message}\n`);
}

export function printWarning(message: string): void {
  process.stderr.write(`${yellow('warning')} ${message}\n`);
}

export function formatSummary(result: PackResult): string {
  const sep = dim(' · ');
  const stats = [
    `${cyan(String(result.fileCount))} files`,
    `${fmt(result.totalChars)} chars`,
    `${fmt(result.totalTokens)} tokens`,
    result.skippedCount > 0 ? `${result.skippedCount} skipped` : null,
    `${result.durationMs}ms`,
  ]
    .filter(Boolean)
    .join(sep);

  return [
    `${green('✓')} ${bold(result.outputPath)}`,
    `  ${stats}`,
  ].join('\n');
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}
