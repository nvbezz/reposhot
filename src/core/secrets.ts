import { SecretMatch } from '../types';

const PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'API_KEY',          re: /api[_-]?key\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{16,}/i },
  { name: 'SECRET',           re: /secret\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{8,}/i },
  { name: 'TOKEN',            re: /token\s*[:=]\s*['"]?[a-zA-Z0-9_\-\.]{16,}/i },
  { name: 'PASSWORD',         re: /(?:password|passwd)\s*[:=]\s*['"]?[^\s'"]{6,}/i },
  { name: 'PRIVATE_KEY',      re: /private[_-]?key\s*[:=]\s*['"]?[a-zA-Z0-9_\-\/\+]{16,}/i },
  { name: 'AWS_KEY',          re: /AKIA[0-9A-Z]{16}/ },
  { name: 'PEM_KEY',          re: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/ },
  { name: 'GITHUB_TOKEN',     re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})/ },
  { name: 'SLACK_TOKEN',      re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/ },
  { name: 'STRIPE_KEY',       re: /\b[sr]k_live_[A-Za-z0-9]{20,}/ },
  { name: 'GOOGLE_API_KEY',   re: /\bAIza[0-9A-Za-z_\-]{35}/ },
  { name: 'AI_API_KEY',       re: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_\-]{32,}/ },
  { name: 'JWT',              re: /\beyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}/ },
];

export function detectSecrets(relPath: string, content: string): SecretMatch | null {
  const findings: string[] = [];
  for (const { name, re } of PATTERNS) {
    if (re.test(content)) findings.push(name);
  }
  return findings.length > 0 ? { relPath, findings } : null;
}
