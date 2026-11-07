import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { REPO_ROOT } from '../src/validate/rules.js';

const run = (file) => spawnSync(process.execPath, [resolve(REPO_ROOT, 'scripts/ready.js'), file], {
  encoding: 'utf8', env: { ...process.env, PMD_NO_CLIPBOARD: '1' },
});

test('a passing listing is marked ready', () => {
  const r = run(resolve(REPO_ROOT, 'data/samples/cozy-christmas-listing.json'));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Ready/);
});

test('a failing listing is not copied and exits 1', () => {
  const r = run(resolve(REPO_ROOT, 'data/samples/invalid-listing.json'));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Not copied/);
  assert.doesNotMatch(r.stdout, /Copied to the clipboard/);
});
