#!/usr/bin/env node
// Usage: npm run validate -- <file.json> [--type listing|pin]
// Prints one line per rule. Exits 1 on any failure or unreadable input.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadConfig } from '../validate/rules.js';
import { validate, formatReport, hasFailures, readImageInfo, detectType } from '../validate/index.js';

const args = process.argv.slice(2);
const typeIndex = args.indexOf('--type');
const type = typeIndex >= 0 ? args.splice(typeIndex, 2)[1] : undefined;
const [file] = args;

if (!file || (type && type !== 'listing' && type !== 'pin')) {
  console.error('Usage: npm run validate -- <file.json> [--type listing|pin]');
  process.exit(1);
}

let doc;
try {
  doc = JSON.parse(readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`Could not read ${file}: ${err.message}`);
  process.exit(1);
}

const options = { type };
if ((type || detectType(doc)) === 'pin' && doc.imagePath) {
  // imagePath is relative to the JSON file's folder.
  const imageFile = resolve(dirname(file), doc.imagePath);
  try {
    options.image = readImageInfo(readFileSync(imageFile));
  } catch {
    options.image = { error: `image not found: ${doc.imagePath}` };
  }
}

const { type: detected, results } = validate(doc, loadConfig(), options);
console.log(`${file} (${detected ?? 'unknown type'})`);
console.log(formatReport(results));
process.exit(hasFailures(results) ? 1 : 0);
