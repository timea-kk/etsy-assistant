// Node-only loader for rules/listing.rules.json and the banned words file.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBannedWords } from './checks.js';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function loadConfig(root = REPO_ROOT) {
  const rules = JSON.parse(readFileSync(resolve(root, 'rules/listing.rules.json'), 'utf8'));
  const bannedWords = parseBannedWords(readFileSync(resolve(root, rules.copy.bannedWordsFile), 'utf8'));
  return { rules, bannedWords };
}
