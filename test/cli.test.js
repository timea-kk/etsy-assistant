import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { REPO_ROOT } from '../src/validate/rules.js';

const cli = resolve(REPO_ROOT, 'src/cli/validate.js');
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
const samplePath = (name) => resolve(REPO_ROOT, 'data/samples', name);

test('valid listing exits 0 and prints one line per rule', () => {
  const r = run(samplePath('cozy-christmas-listing.json'));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /PASS\s+listing\.title\.maxChars\s+74\/140 chars/);
  assert.match(r.stdout, /0 failed/);
});

test('valid pin exits 0', () => {
  assert.equal(run(samplePath('cozy-christmas-pin-1.json')).status, 0);
});

test('invalid listing exits 1 and shows failures', () => {
  const r = run(samplePath('invalid-listing.json'));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL\s+listing\.title\.maxChars\s+178\/140 chars/);
});

test('missing file, bad JSON, and no argument exit 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pmd-cli-'));
  const bad = join(dir, 'bad.json');
  writeFileSync(bad, '{ not json');
  assert.equal(run(join(dir, 'nope.json')).status, 1);
  assert.equal(run(bad).status, 1);
  assert.equal(run().status, 1);
});

test('pin imagePath is read relative to the JSON file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pmd-cli-'));
  const png = new Uint8Array(33);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(png.buffer).setUint32(16, 1000);
  new DataView(png.buffer).setUint32(20, 1000);
  writeFileSync(join(dir, 'square.png'), png);
  const pin = JSON.parse(readFileSync(samplePath('cozy-christmas-pin-1.json'), 'utf8'));
  writeFileSync(join(dir, 'pin.json'), JSON.stringify({ ...pin, imagePath: 'square.png' }));
  writeFileSync(join(dir, 'pin-missing.json'), JSON.stringify({ ...pin, imagePath: 'gone.png' }));

  const r = run(join(dir, 'pin.json'));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL\s+pin\.image\.dimensions\s+1000 x 1000 png/);

  const missing = run(join(dir, 'pin-missing.json'));
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /image not found: gone\.png/);
});
