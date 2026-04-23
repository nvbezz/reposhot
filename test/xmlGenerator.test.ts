import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateXml, XmlGeneratorOptions } from '../src/output/xmlGenerator';
import { PackedFile } from '../src/types';

function makeFile(relPath: string, content: string): PackedFile {
  return { path: `/root/${relPath}`, relPath, content };
}

function makeOptions(overrides: Partial<XmlGeneratorOptions> = {}): XmlGeneratorOptions {
  return {
    files: [],
    rootDir: '/root/my-repo',
    totalTokens: 0,
    showLineNumbers: false,
    removeComments: false,
    ...overrides,
  };
}

// --- structure ---

test('generateXml: contains intro line', () => {
  const xml = generateXml(makeOptions());
  assert.ok(xml.includes('reposhot for AI consumption'));
});

test('generateXml: contains all top-level blocks', () => {
  const xml = generateXml(makeOptions());
  assert.ok(xml.includes('<file_summary>'));
  assert.ok(xml.includes('</file_summary>'));
  assert.ok(xml.includes('<repository_info>'));
  assert.ok(xml.includes('<directory_structure>'));
  assert.ok(xml.includes('<files>'));
  assert.ok(xml.includes('</files>'));
});

test('generateXml: repository name comes from rootDir basename', () => {
  const xml = generateXml(makeOptions({ rootDir: '/projects/cool-app' }));
  assert.ok(xml.includes('<repository>cool-app</repository>'));
  assert.ok(xml.includes('<n>cool-app</n>'));
});

test('generateXml: root_path is the full rootDir', () => {
  const xml = generateXml(makeOptions({ rootDir: '/projects/cool-app' }));
  assert.ok(xml.includes('<root_path>/projects/cool-app</root_path>'));
});

// --- statistics ---

test('generateXml: total_files matches file count', () => {
  const files = [makeFile('a.ts', 'aaa'), makeFile('b.ts', 'bb')];
  const xml = generateXml(makeOptions({ files }));
  assert.ok(xml.includes('<total_files>2</total_files>'));
});

test('generateXml: total_characters is sum of content lengths', () => {
  const files = [makeFile('a.ts', '123'), makeFile('b.ts', '45')];
  const xml = generateXml(makeOptions({ files }));
  assert.ok(xml.includes('<total_characters>5</total_characters>'));
});

test('generateXml: total_tokens comes from options', () => {
  const xml = generateXml(makeOptions({ totalTokens: 999 }));
  assert.ok(xml.includes('<total_tokens>999</total_tokens>'));
});

test('generateXml: generated_at is a valid ISO date', () => {
  const xml = generateXml(makeOptions());
  const match = xml.match(/<generated_at>(.+?)<\/generated_at>/);
  assert.ok(match, 'generated_at tag not found');
  assert.doesNotThrow(() => {
    const d = new Date(match![1]);
    assert.ok(!isNaN(d.getTime()));
  });
});

// --- directory listing ---

test('generateXml: directory_structure lists all relPaths', () => {
  const files = [makeFile('src/index.ts', ''), makeFile('README.md', '')];
  const xml = generateXml(makeOptions({ files }));
  const block = xml.match(/<directory_structure>([\s\S]*?)<\/directory_structure>/);
  assert.ok(block);
  assert.ok(block![1].includes('src/index.ts'));
  assert.ok(block![1].includes('README.md'));
});

// --- file entries ---

test('generateXml: file entry uses relPath as path attribute', () => {
  const files = [makeFile('src/index.ts', 'export {}')];
  const xml = generateXml(makeOptions({ files }));
  assert.ok(xml.includes('<file path="src/index.ts">'));
});

test('generateXml: file content is included inside file tag', () => {
  const files = [makeFile('a.ts', 'const x = 1;')];
  const xml = generateXml(makeOptions({ files }));
  assert.ok(xml.includes('const x = 1;'));
});

// --- XML escaping ---

test('generateXml: escapes & in file content', () => {
  const files = [makeFile('a.ts', 'a && b')];
  const xml = generateXml(makeOptions({ files }));
  assert.ok(xml.includes('a &amp;&amp; b'));
});

test('generateXml: escapes < and > in file content', () => {
  const files = [makeFile('a.ts', 'if (a < b && b > c)')];
  const xml = generateXml(makeOptions({ files }));
  assert.ok(xml.includes('&lt;'));
  assert.ok(xml.includes('&gt;'));
});

test('generateXml: escapes " in file path attribute', () => {
  const files = [makeFile('say "hi".ts', 'hello')];
  const xml = generateXml(makeOptions({ files }));
  assert.ok(xml.includes('path="say &quot;hi&quot;.ts"'));
});

test('generateXml: escapes & in repo name', () => {
  const xml = generateXml(makeOptions({ rootDir: '/projects/foo&bar' }));
  assert.ok(xml.includes('<repository>foo&amp;bar</repository>'));
});

// --- line numbers ---

test('generateXml: showLineNumbers prefixes each line', () => {
  const files = [makeFile('a.ts', 'line one\nline two\nline three')];
  const xml = generateXml(makeOptions({ files, showLineNumbers: true }));
  assert.ok(xml.includes('1  line one'));
  assert.ok(xml.includes('2  line two'));
  assert.ok(xml.includes('3  line three'));
});

test('generateXml: no line numbers when showLineNumbers is false', () => {
  const files = [makeFile('a.ts', 'hello')];
  const xml = generateXml(makeOptions({ files, showLineNumbers: false }));
  assert.ok(!xml.includes('1  hello'));
  assert.ok(xml.includes('hello'));
});

// --- comment removal ---

test('generateXml: removeComments strips // line comments', () => {
  const files = [makeFile('a.ts', '// this is a comment\nconst x = 1;')];
  const xml = generateXml(makeOptions({ files, removeComments: true }));
  assert.ok(!xml.includes('this is a comment'));
  assert.ok(xml.includes('const x = 1;'));
});

test('generateXml: removeComments strips # line comments', () => {
  const files = [makeFile('a.py', '# python comment\nprint("hi")')];
  const xml = generateXml(makeOptions({ files, removeComments: true }));
  assert.ok(!xml.includes('python comment'));
  assert.ok(xml.includes('print'));
});

test('generateXml: removeComments strips /* */ blocks', () => {
  const files = [makeFile('a.ts', '/* SECRET_MULTILINE_COMMENT */\nconst x = 1;')];
  const xml = generateXml(makeOptions({ files, removeComments: true }));
  assert.ok(!xml.includes('SECRET_MULTILINE_COMMENT'));
  assert.ok(xml.includes('const x = 1;'));
});

test('generateXml: removeComments false leaves comments intact', () => {
  const files = [makeFile('a.ts', '// keep me\nconst x = 1;')];
  const xml = generateXml(makeOptions({ files, removeComments: false }));
  assert.ok(xml.includes('keep me'));
});

// --- edge cases ---

test('generateXml: works with empty file list', () => {
  assert.doesNotThrow(() => generateXml(makeOptions({ files: [] })));
});

test('generateXml: works with empty file content', () => {
  const files = [makeFile('empty.ts', '')];
  assert.doesNotThrow(() => generateXml(makeOptions({ files })));
});
