// Builds the Chrome extension into src/extension/dist (or the folder given as
// the first argument). popup.js is bundled with esbuild, which also pulls in
// the rules files, so the extension carries its own copy of the rules.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { REPO_ROOT } from '../src/validate/rules.js';

export async function buildExtension(outDir = resolve(REPO_ROOT, 'src/extension/dist')) {
  const src = resolve(REPO_ROOT, 'src/extension');
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  for (const file of ['manifest.json', 'popup.html', 'popup.css']) {
    cpSync(resolve(src, file), resolve(outDir, file));
  }

  await build({
    entryPoints: [resolve(src, 'popup.js')],
    outfile: resolve(outDir, 'popup.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'chrome120',
    // Keep names readable: fillEtsyForm is sent to the Etsy tab as source text.
    minify: false,
    loader: { '.txt': 'text' },
    logLevel: 'warning',
  });
  return outDir;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = await buildExtension(process.argv[2] && resolve(process.argv[2]));
  console.log(`Built extension in ${out}`);
}
