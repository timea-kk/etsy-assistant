// Usage: npm run ready -- <listing.json>
// Checks a listing against the shop rules. Only if it passes, copies it to the
// Mac clipboard so the extension can fill Etsy's form. Exits 1 on any failure.
// Set PMD_NO_CLIPBOARD=1 to skip the copy (used by tests).
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadConfig } from '../src/validate/rules.js';
import { validate, formatReport, hasFailures } from '../src/validate/index.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run ready -- <listing.json>');
  process.exit(1);
}

let doc;
try {
  doc = JSON.parse(readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`Could not read ${file}: ${err.message}`);
  process.exit(1);
}

const { results } = validate(doc, loadConfig(), { type: 'listing' });
console.log(formatReport(results));
if (hasFailures(results)) {
  console.log('Not copied: fix the failures above first.');
  process.exit(1);
}

const { title, description, tags, basketSummary } = doc;
const payload = JSON.stringify({ title, description, tags, basketSummary });
if (process.env.PMD_NO_CLIPBOARD) {
  console.log('Ready (clipboard skipped).');
} else {
  // Without a UTF-8 locale, pbcopy reads the text as Mac Roman and scrambles emojis.
  const copy = spawnSync('pbcopy', { input: payload, env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' } });
  if (copy.status !== 0) {
    console.error('Could not copy to the clipboard.');
    process.exit(1);
  }
  console.log('Copied to the clipboard. Click the extension on the Etsy "Add a listing" page.');
}
