// Draws the placeholder pet "Pip" as SVG and renders it to the standard
// sprite sheet (4 frames x 5 moods, 256 px cells) plus the toolbar icons.
// Run: npm run pets   (uses Playwright's Chromium only as an SVG -> PNG renderer)
import { createRequire } from 'node:module';
// Playwright is not a project dependency: install it globally (npm i -g playwright) to regenerate Pip.
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync, writeFileSync } from 'node:fs';

const S = 256;
const FRAMES = 4;
const MOODS = ['idle', 'happy', 'alert', 'annoyed', 'celebrate'];
const BODY = '#5eead4';
const SHADE = '#2dd4bf';
const INK = '#0f172a';

function eyes(kind, f) {
  const L = 102, R = 154, Y = 128;
  switch (kind) {
    case 'blink':
      return `<path d="M${L - 9} ${Y} h18 M${R - 9} ${Y} h18" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
    case 'happy':
      return `<path d="M${L - 10} ${Y + 4} q10 -14 20 0 M${R - 10} ${Y + 4} q10 -14 20 0" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    case 'wide':
      return `<circle cx="${L}" cy="${Y}" r="14" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="${R}" cy="${Y}" r="14" fill="#fff" stroke="${INK}" stroke-width="4"/>
        <circle cx="${L}" cy="${Y}" r="6" fill="${INK}"/><circle cx="${R}" cy="${Y}" r="6" fill="${INK}"/>`;
    case 'annoyed': {
      const look = f % 2 ? 3 : -3;
      return `<circle cx="${L + look}" cy="${Y + 3}" r="8" fill="${INK}"/><circle cx="${R + look}" cy="${Y + 3}" r="8" fill="${INK}"/>
        <path d="M${L - 14} ${Y - 6} h28 M${R - 14} ${Y - 6} h28" stroke="${BODY}" stroke-width="10"/>
        <path d="M${L - 14} ${Y - 16} l26 6 M${R + 14} ${Y - 16} l-26 6" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
    }
    default:
      return `<circle cx="${L}" cy="${Y}" r="9" fill="${INK}"/><circle cx="${R}" cy="${Y}" r="9" fill="${INK}"/>
        <circle cx="${L + 3}" cy="${Y - 3}" r="3" fill="#fff"/><circle cx="${R + 3}" cy="${Y - 3}" r="3" fill="#fff"/>`;
  }
}

function mouth(kind) {
  switch (kind) {
    case 'smile': return `<path d="M112 156 q16 18 32 0" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    case 'big': return `<path d="M108 152 q20 30 40 0 z" fill="${INK}"/><path d="M118 162 q10 8 20 0" fill="#fb7185"/>`;
    case 'o': return `<ellipse cx="128" cy="162" rx="9" ry="11" fill="${INK}"/>`;
    case 'frown': return `<path d="M114 166 q14 -12 28 0" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    default: return `<path d="M118 158 q10 6 20 0" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  }
}

function arm(x, y, angle) {
  return `<g transform="translate(${x} ${y}) rotate(${angle})"><rect x="-9" y="-36" width="18" height="40" rx="9" fill="${SHADE}"/></g>`;
}

function frame(mood, f) {
  let dy = 0, sx = 1, sy = 1, rot = 0, eye = 'open', mo = 'soft', arms = [arm(58, 176, -150), arm(198, 176, 150)], extra = '', front = '';
  if (mood === 'idle') {
    sy = [1, 0.98, 0.96, 0.98][f]; sx = 2 - sy;
    eye = f === 2 ? 'blink' : 'open';
  }
  if (mood === 'happy') {
    dy = [0, -10, -16, -10][f]; eye = 'happy'; mo = 'smile';
    arms = [arm(58, 170, -130 + f * 4), arm(198, 170, 130 - f * 4)];
  }
  if (mood === 'alert') {
    eye = 'wide'; mo = 'o'; rot = [-2, 2, -2, 2][f];
    arms = [arm(58, 176, -150), arm(200, 150, 25 + [0, 12, 0, 12][f])];
    extra = `<text x="200" y="${70 + (f % 2) * -6}" font-family="Arial Black, Arial, sans-serif" font-size="64" font-weight="900" fill="#f59e0b" stroke="${INK}" stroke-width="4" text-anchor="middle">!</text>`;
  }
  if (mood === 'annoyed') {
    eye = 'annoyed'; mo = 'frown'; rot = [-3, 0, 3, 0][f];
    arms = [];
    front = `<rect x="84" y="182" width="88" height="18" rx="9" fill="${SHADE}" stroke="${INK}" stroke-width="4"/>`;
    const puff = 0.6 + (f % 2) * 0.25;
    extra = `<g transform="translate(206 70) scale(${puff})" fill="#cbd5e1" stroke="${INK}" stroke-width="4"><circle r="14"/><circle cx="16" cy="-10" r="11"/><circle cx="20" cy="10" r="9"/></g>`;
  }
  if (mood === 'celebrate') {
    dy = [0, -22, -32, -16][f]; eye = 'happy'; mo = 'big';
    arms = [arm(52, 130, -45 - f * 6), arm(204, 130, 45 + f * 6)];
    const sp = (x, y, r) => `<path transform="translate(${x} ${y}) rotate(${f * 22}) scale(${r})" d="M0 -12 L3 -3 L12 0 L3 3 L0 12 L-3 3 L-12 0 L-3 -3 Z" fill="#facc15" stroke="${INK}" stroke-width="2"/>`;
    extra = sp(40, 60 + f * 4, 1.2) + sp(214, 50 + ((f + 2) % 4) * 4, 1) + sp(226, 150, 0.8) + sp(30, 160, 0.7);
  }
  const shadowScale = 1 - Math.abs(dy) / 80;
  return `<g>
    <ellipse cx="128" cy="236" rx="${62 * shadowScale}" ry="${9 * shadowScale}" fill="${INK}" opacity="0.18"/>
    <g transform="translate(0 ${dy}) rotate(${rot} 128 220)">
      <g transform="translate(128 226) scale(${sx} ${sy}) translate(-128 -226)">
        ${arms.join('')}
        <path d="M128 52 C 196 52 214 120 212 168 C 210 214 176 228 128 228 C 80 228 46 214 44 168 C 42 120 60 52 128 52 Z" fill="${BODY}" stroke="${INK}" stroke-width="6"/>
        <path d="M128 36 q8 -12 18 -8 q-10 4 -12 20 z" fill="${SHADE}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
        <ellipse cx="84" cy="152" rx="11" ry="7" fill="#fda4af" opacity="0.8"/><ellipse cx="172" cy="152" rx="11" ry="7" fill="#fda4af" opacity="0.8"/>
        ${eyes(eye, f)}${mouth(mo)}${front}
      </g>
    </g>
    ${extra}
  </g>`;
}

function sheetSvg() {
  const cells = [];
  MOODS.forEach((m, r) => {
    for (let f = 0; f < FRAMES; f++) cells.push(`<g transform="translate(${f * S} ${r * S})">${frame(m, f)}</g>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S * FRAMES}" height="${S * MOODS.length}" viewBox="0 0 ${S * FRAMES} ${S * MOODS.length}">${cells.join('')}</svg>`;
}

function iconSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="20 20 216 216">${frame('idle', 0)}</svg>`;
}

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(svg, w, h, out) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  writeFileSync(out, await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } }));
}
mkdirSync('pets/pip', { recursive: true });
mkdirSync('icons', { recursive: true });
await render(sheetSvg(), S * FRAMES, S * MOODS.length, 'pets/pip/sprites.png');
for (const size of [16, 32, 48, 128]) await render(iconSvg(size), size, size, `icons/icon-${size}.png`);
await browser.close();
writeFileSync(
  'pets/pip/pet.json',
  JSON.stringify(
    {
      format: 1,
      id: 'pip',
      name: 'Pip',
      author: 'pop_OUT',
      sheet: 'sprites.png',
      frameWidth: S,
      frameHeight: S,
      frames: FRAMES,
      fps: 6,
      rows: { idle: 0, happy: 1, alert: 2, annoyed: 3, celebrate: 4 },
    },
    null,
    2,
  ) + '\n',
);
console.log('Pip sprites and icons written.');
