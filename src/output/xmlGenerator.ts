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
      let content = removeComments ? stripComments(f.content) : f.content;
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

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function addLineNumbers(content: string): string {
  const lines = content.split('\n');
  const width = String(lines.length).length;
  return lines.map((line, i) => `${String(i + 1).padStart(width, ' ')}  ${line}`).join('\n');
}

// Best-effort comment removal. Handles // and # line comments and /* */ blocks.
// Not language-aware — inline comments inside strings may be incorrectly removed.
function stripComments(content: string): string {
  // Remove /* ... */ blocks first
  const noBlock = content.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('//') || trimmed.startsWith('#')) return '';
      return line;
    })
    .join('\n');
}
