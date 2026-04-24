import * as fs from 'fs';
import * as path from 'path';
import { parseArgs as nodeParseArgs } from 'util';
import { ReposhotConfig } from '../types';

const VERSION = '1.1.1';

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

export function loadConfigFile(cwd: string): ConfigFile {
  try {
    const raw = fs.readFileSync(path.join(cwd, 'reposhot.config.json'), 'utf8');
    return JSON.parse(raw) as ConfigFile;
  } catch {
    return {};
  }
}
