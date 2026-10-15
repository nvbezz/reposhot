import * as fs from 'fs';
import * as path from 'path';
import { parseArgs as nodeParseArgs } from 'util';
import { ReposhotConfig } from '../types';
import { VERSION } from './reporter';

const HELP = `
reposhot — pack a repository into a single XML file for AI consumption

Usage:
  reposhot [options]

Options:
  -o, --output <file>       Output file path  (default: reposhot-output.xml)
  -i, --include <glob>      Include only matching files (repeatable)
      --ignore <glob>       Additional ignore patterns (repeatable)
      --no-gitignore        Disable .gitignore / .reposhotignore processing
      --line-numbers        Add line numbers to file content
      --remove-comments     Strip comments from source files
      --check-secrets       Warn if potential secrets are detected in files
  -v, --version             Show version
  -h, --help                Show this help message
`.trim();

const CONFIG_FILE = 'reposhot.config.json';

interface ConfigFile {
  output?: string;
  include?: string[];
  ignore?: string[];
  respectGitignore?: boolean;
  showLineNumbers?: boolean;
  removeComments?: boolean;
  checkSecrets?: boolean;
}

const DEFAULTS: Omit<ReposhotConfig, 'rootDir'> = {
  output: 'reposhot-output.xml',
  include: [],
  ignore: [],
  respectGitignore: true,
  showLineNumbers: false,
  removeComments: false,
  checkSecrets: false,
};

export function parseArgs(argv: string[], cwd: string = process.cwd()): ReposhotConfig {
  const { values } = nodeParseArgs({
    args: argv,
    options: {
      output:            { type: 'string',  short: 'o' },
      include:           { type: 'string',  short: 'i', multiple: true },
      ignore:            { type: 'string',  multiple: true },
      'no-gitignore':    { type: 'boolean' },
      'line-numbers':    { type: 'boolean' },
      'remove-comments': { type: 'boolean' },
      'check-secrets':   { type: 'boolean' },
      version:           { type: 'boolean', short: 'v' },
      help:              { type: 'boolean', short: 'h' },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.version) {
    process.stdout.write(`reposhot v${VERSION}\n`);
    process.exit(0);
  }

  if (values.help) {
    process.stdout.write(`${HELP}\n`);
    process.exit(0);
  }

  const fileConfig = loadConfigFile(cwd);

  return {
    rootDir:          cwd,
    output:           values.output                   ?? fileConfig.output           ?? DEFAULTS.output,
    include:          values.include?.length           ? values.include               : (fileConfig.include          ?? DEFAULTS.include),
    ignore:           values.ignore?.length            ? values.ignore                : (fileConfig.ignore           ?? DEFAULTS.ignore),
    respectGitignore: values['no-gitignore']           ? false                        : (fileConfig.respectGitignore ?? DEFAULTS.respectGitignore),
    showLineNumbers:  values['line-numbers']           ?? fileConfig.showLineNumbers  ?? DEFAULTS.showLineNumbers,
    removeComments:   values['remove-comments']        ?? fileConfig.removeComments   ?? DEFAULTS.removeComments,
    checkSecrets:     values['check-secrets']          ?? fileConfig.checkSecrets     ?? DEFAULTS.checkSecrets,
  };
}

const STRING_ARRAY_KEYS = ['include', 'ignore'] as const;
const BOOLEAN_KEYS = [
  'respectGitignore',
  'showLineNumbers',
  'removeComments',
  'checkSecrets',
] as const;

export function loadConfigFile(cwd: string): ConfigFile {
  const configPath = path.join(cwd, CONFIG_FILE);
  let raw: string;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`invalid JSON in ${CONFIG_FILE}: ${reason}`);
  }
  return validateConfigFile(parsed);
}

// a typo in the config file should fail loudly instead of silently changing what gets packed
function validateConfigFile(value: unknown): ConfigFile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${CONFIG_FILE} must contain a JSON object`);
  }
  const obj = value as Record<string, unknown>;
  const config: ConfigFile = {};

  if (obj.output !== undefined) {
    if (typeof obj.output !== 'string' || obj.output.length === 0) {
      throw new Error(`${CONFIG_FILE}: "output" must be a non-empty string`);
    }
    config.output = obj.output;
  }

  for (const key of STRING_ARRAY_KEYS) {
    const v = obj[key];
    if (v === undefined) continue;
    if (!Array.isArray(v) || !v.every((item): item is string => typeof item === 'string')) {
      throw new Error(`${CONFIG_FILE}: "${key}" must be an array of strings`);
    }
    config[key] = v;
  }

  for (const key of BOOLEAN_KEYS) {
    const v = obj[key];
    if (v === undefined) continue;
    if (typeof v !== 'boolean') {
      throw new Error(`${CONFIG_FILE}: "${key}" must be a boolean`);
    }
    config[key] = v;
  }

  return config;
}
