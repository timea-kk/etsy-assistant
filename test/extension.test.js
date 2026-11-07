import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildExtension } from '../scripts/build-extension.js';

const outDir = await buildExtension(mkdtempSync(join(tmpdir(), 'pmd-ext-')));
const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8'));
const bundle = readFileSync(join(outDir, 'popup.js'), 'utf8');

test('build contains manifest v3, popup, and bundled script', () => {
  assert.deepEqual(readdirSync(outDir).sort(), ['manifest.json', 'popup.css', 'popup.html', 'popup.js']);
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.action.default_popup, 'popup.html');
});

test('extension needs no paid service: no network access, only the clicked tab and the clipboard', () => {
  assert.deepEqual(manifest.permissions, ['activeTab', 'scripting', 'clipboardRead']);
  assert.equal(manifest.host_permissions, undefined);
  assert.doesNotMatch(bundle, /\bfetch\(|XMLHttpRequest|WebSocket|api\.anthropic\.com/);
});

test('bundle carries the current rules and banned words', () => {
  assert.match(bundle, /maxCharsEach/);
  assert.match(bundle, /some might say/);
  assert.match(bundle, /fillEtsyForm/);
});
