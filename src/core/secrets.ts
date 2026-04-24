import { SecretMatch } from '../types';

const PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'API_KEY',     re: /api[_-]?key\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{16,}/i },
  { name: 'SECRET',      re: /secret\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{8,}/i },
  { name: 'TOKEN',       re: /token\s*[:=]\s*['"]?[a-zA-Z0-9_\-\.]{16,}/i },
  { name: 'PASSWORD',    re: /(?:password|passwd)\s*[:=]\s*['"]?[^\s'"]{6,}/i },
  { name: 'PRIVATE_KEY', re: /private[_-]?key\s*[:=]\s*['"]?[a-zA-Z0-9_\-\/\+]{16,}/i },
  { name: 'AWS_KEY',     re: /AKIA[0-9A-Z]{16}/ },
  { name: 'PEM_KEY',     re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

export function detectSecrets(relPath: string, content: string): SecretMatch | null {
  const findings: string[] = [];
  for (const { name, re } of PATTERNS) {
    if (re.test(content)) findings.push(name);
  }
  return findings.length > 0 ? { relPath, findings } : null;
}
