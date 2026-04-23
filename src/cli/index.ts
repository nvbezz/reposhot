#!/usr/bin/env node
import * as fs from 'fs';
import { parseArgs } from './args';
import { runPack } from '../core/packer';
import { printBanner, printSummary, printError } from './reporter';

async function main(): Promise<void> {
  let config;
  try {
    config = parseArgs(process.argv.slice(2));
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  try {
    fs.accessSync(config.rootDir, fs.constants.R_OK);
  } catch {
    printError(`directory not found or not readable: ${config.rootDir}`);
    process.exit(1);
  }

  const toStdout = config.output === '-';

  if (!toStdout) printBanner();

  try {
    const result = await runPack(config);
    if (!toStdout) printSummary(result);
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
