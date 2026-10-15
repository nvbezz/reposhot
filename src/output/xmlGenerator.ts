import * as path from 'path';
import { PackedFile } from '../types';

export interface XmlGeneratorOptions {
  files: PackedFile[];
  rootDir: string;
  totalTokens: number;
  showLineNumbers: boolean;
  removeComments: boolean;
}

export function generateXml(options: XmlGeneratorOptions): string {
  const { files, rootDir, totalTokens, showLineNumbers, removeComments } = options;
  const repoName = path.basename(rootDir);
  const generatedAt = new Date().toISOString();
  const totalChars = files.reduce((sum, f) => sum + f.content.length, 0);

  const dirListing = files.map((f) => f.relPath).join('\n');

  const fileEntries = files
    .map((f) => {
      let content = removeComments ? stripComments(f.content, f.relPath) : f.content;
      if (showLineNumbers) content = addLineNumbers(content);
      return `<file path="${escapeAttr(f.relPath)}">\n${escapeXml(content)}\n</file>`;
    })
    .join('\n\n');

  return [
    `This is a snapshot of the repository, packed into a single XML document by`,
    `reposhot for AI consumption.`,
    ``,
    `<file_summary>`,
    ``,
    `<purpose>`,
    `This document holds a full snapshot of the repository at the time reposhot`,
    `was run. Each file's content is included as-is, allowing AI systems to reason`,
    `about the entire codebase in a single context window.`,
    `</purpose>`,
    ``,
    `<file_format>`,
    `The document is structured as follows:`,
    `1. This summary block`,
    `2. Basic repository metadata`,
    `3. A flat directory listing of all included files`,
    `4. One entry per file, each with its relative path and full content`,
    `</file_format>`,
    ``,
    `<usage_guidelines>`,
    `- Treat this file as read-only. Edit the original source files, not this snapshot.`,
    `- Use the file path attribute on each entry to identify which file you are reading.`,
    `- This snapshot may include sensitive data — handle it accordingly.`,
    `</usage_guidelines>`,
    ``,
    `<notes>`,
    `- Files excluded by .gitignore or .reposhotignore are not included.`,
    `- Binary files are automatically detected and skipped.`,
    `- Files larger than 1MB are skipped to keep the snapshot manageable.`,
    `- Default ignore patterns (node_modules, dist, .git, etc.) are always applied.`,
    `</notes>`,
    ``,
    `<statistics>`,
    `  <repository>${escapeXml(repoName)}</repository>`,
    `  <generated_at>${generatedAt}</generated_at>`,
    `  <total_files>${files.length}</total_files>`,
    `  <total_characters>${totalChars}</total_characters>`,
    `  <total_tokens>${totalTokens}</total_tokens>`,
    `</statistics>`,
    ``,
    `</file_summary>`,
    ``,
    `<repository_info>`,
    `  <n>${escapeXml(repoName)}</n>`,
    `  <root_path>${escapeXml(rootDir)}</root_path>`,
    `</repository_info>`,
    ``,
    `<directory_structure>`,
    dirListing,
    `</directory_structure>`,
    ``,
    `<files>`,
    `Each entry below corresponds to one file in the repository.`,
    ``,
    fileEntries,
    ``,
    `</files>`,
  ].join('\n');
}

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

function escapeXml(str: string): string {
  return /[&<>]/.test(str) ? str.replace(/[&<>]/g, (c) => XML_ESCAPES[c]) : str;
}

function escapeAttr(str: string): string {
  return str.replace(/[&<>"]/g, (c) => XML_ESCAPES[c]);
}

function addLineNumbers(content: string): string {
  const lines = content.split('\n');
  const width = String(lines.length).length;
  return lines.map((line, i) => `${String(i + 1).padStart(width, ' ')}  ${line}`).join('\n');
}

const C_STYLE_EXTS = new Set([
  'ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs', 'java', 'kt', 'kts', 'scala', 'groovy',
  'gradle', 'c', 'h', 'cc', 'cpp', 'cxx', 'hpp', 'cs', 'go', 'rs', 'swift', 'dart', 'php',
  'css', 'scss', 'less', 'proto', 'sol', 'zig', 'vue', 'svelte',
]);

const HASH_STYLE_EXTS = new Set([
  'py', 'pyi', 'rb', 'sh', 'bash', 'zsh', 'fish', 'pl', 'pm', 'r', 'ps1', 'yaml', 'yml',
  'toml', 'cfg', 'conf', 'ini', 'properties', 'tf', 'cmake', 'nim', 'ex', 'exs', 'jl',
]);

const HASH_STYLE_NAMES = new Set(['dockerfile', 'makefile', 'gemfile', 'rakefile', '.gitignore']);

// Best-effort and not a parser: only languages with a known comment syntax are touched,
// so Markdown headings or C preprocessor lines are never mistaken for comments.
function stripComments(content: string, relPath: string): string {
  const name = relPath.slice(relPath.lastIndexOf('/') + 1).toLowerCase();
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot + 1) : '';
  if (C_STYLE_EXTS.has(ext)) return stripCStyleComments(content);
  if (HASH_STYLE_EXTS.has(ext) || HASH_STYLE_NAMES.has(name)) return stripHashComments(content);
  return content;
}

// Skips over string literals so that globs like 'src/**/*.ts' or URLs survive. Line comments
// are only removed when they fill the whole line, because a `//` mid-line may sit inside a
// regex literal that this scanner cannot recognise.
function stripCStyleComments(content: string): string {
  let out = '';
  let i = 0;
  let lineStart = true;
  const len = content.length;

  while (i < len) {
    const ch = content[i];
    const next = content[i + 1];

    if (ch === '/' && next === '*') {
      const end = content.indexOf('*/', i + 2);
      i = end === -1 ? len : end + 2;
      continue;
    }

    if (ch === '/' && next === '/' && lineStart) {
      const end = content.indexOf('\n', i);
      i = end === -1 ? len : end;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      const end = findStringEnd(content, i);
      out += content.slice(i, end);
      i = end;
      lineStart = false;
      continue;
    }

    out += ch;
    if (ch === '\n') lineStart = true;
    else if (ch !== ' ' && ch !== '\t' && ch !== '\r') lineStart = false;
    i++;
  }
  return out;
}

function findStringEnd(content: string, start: number): number {
  const quote = content[start];
  let i = start + 1;
  while (i < content.length) {
    const ch = content[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) return i + 1;
    // plain quotes cannot span lines; stopping here limits damage from unrecognised syntax
    if (ch === '\n' && quote !== '`') return i;
    i++;
  }
  return content.length;
}

function stripHashComments(content: string): string {
  return content
    .split('\n')
    .map((line, i) => {
      const trimmed = line.trimStart();
      if (!trimmed.startsWith('#')) return line;
      return i === 0 && trimmed.startsWith('#!') ? line : '';
    })
    .join('\n');
}
