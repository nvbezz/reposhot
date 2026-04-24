import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectSecrets } from '../src/core/secrets';

test('detectSecrets: returns null for clean content', () => {
  assert.equal(detectSecrets('file.ts', 'const x = 1;'), null);
});

test('detectSecrets: detects API_KEY pattern', () => {
  const result = detectSecrets('config.ts', 'api_key = "abcdefghijklmnopqrst"');
  assert.ok(result !== null);
  assert.ok(result.findings.includes('API_KEY'));
  assert.equal(result.relPath, 'config.ts');
});

test('detectSecrets: detects TOKEN pattern', () => {
  const result = detectSecrets('.env', 'TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
  assert.ok(result !== null);
  assert.ok(result.findings.includes('TOKEN'));
});

test('detectSecrets: detects PASSWORD pattern', () => {
  const result = detectSecrets('.env', 'PASSWORD=supersecret123');
  assert.ok(result !== null);
  assert.ok(result.findings.includes('PASSWORD'));
});

test('detectSecrets: detects AWS access key', () => {
  const result = detectSecrets('config.json', '"accessKey": "AKIAIOSFODNN7EXAMPLE"');
  assert.ok(result !== null);
  assert.ok(result.findings.includes('AWS_KEY'));
});

test('detectSecrets: detects PEM private key', () => {
  const result = detectSecrets('key.pem', '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAK');
  assert.ok(result !== null);
  assert.ok(result.findings.includes('PEM_KEY'));
});

test('detectSecrets: ignores short placeholder values', () => {
  // TOKEN value too short (<16 chars), API_KEY value too short (<16 chars)
  const result = detectSecrets('.env.example', 'TOKEN=abc\nAPI_KEY=placeholder');
  assert.equal(result, null);
});

test('detectSecrets: detects multiple patterns in same file', () => {
  const content = 'api_key = "abcdefghijklmnop12345"\nPASSWORD=supersecret123';
  const result = detectSecrets('config.ts', content);
  assert.ok(result !== null);
  assert.ok(result.findings.length >= 2);
});

test('detectSecrets: returns correct relPath in result', () => {
  const result = detectSecrets('src/config/keys.ts', 'api_key = "abcdef1234567890xyz"');
  assert.ok(result !== null);
  assert.equal(result.relPath, 'src/config/keys.ts');
});
