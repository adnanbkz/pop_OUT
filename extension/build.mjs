// Builds dist/chrome and dist/firefox from the same source.
// The only difference between them is how the background script is declared:
// Chrome wants a "service_worker", Firefox wants "scripts".
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const targets = ['chrome', 'firefox'];
const base = JSON.parse(readFileSync('src/manifest.base.json', 'utf8'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
base.version = pkg.version;

const manifests = {
  chrome: { ...base, background: { service_worker: 'background.js' }, minimum_chrome_version: '116' },
  firefox: {
    ...base,
    background: { scripts: ['background.js'] },
    browser_specific_settings: { gecko: { id: 'pop-out@adnanbkz.github.io', strict_min_version: '121.0' } },
  },
};

function copyStatic(dir) {
  cpSync('src/popup/popup.html', `${dir}/popup/popup.html`);
  cpSync('src/popup/popup.css', `${dir}/popup/popup.css`);
  cpSync('src/options/options.html', `${dir}/options/options.html`);
  cpSync('src/options/options.css', `${dir}/options/options.css`);
  cpSync('icons', `${dir}/icons`, { recursive: true });
  cpSync('pets', `${dir}/pets`, { recursive: true });
  writeFileSync(`${dir}/manifest.json`, JSON.stringify(manifests[dir.split('/').pop()], null, 2));
}

for (const target of targets) {
  const dir = `dist/${target}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  copyStatic(dir);
  const opts = {
    entryPoints: {
      background: 'src/background.ts',
      overlay: 'src/overlay.ts',
      'popup/popup': 'src/popup/popup.ts',
      'options/options': 'src/options/options.ts',
    },
    outdir: dir,
    bundle: true,
    format: 'iife',
    target: ['chrome116', 'firefox121', 'safari16'],
    minify: !watch,
    legalComments: 'none',
    logLevel: 'info',
  };
  if (watch) await (await esbuild.context(opts)).watch();
  else await esbuild.build(opts);
}
