// Injected into the current tab only when the pet needs to pop out.
// It draws inside a closed Shadow DOM so the page's CSS can't break it
// (and it can't break the page). When the bubble closes, it removes itself.
import { t } from './shared/i18n';
import { spriteKeyframes, spriteStyle } from './shared/pets';
import type { Command, PopMessage } from './shared/types';

declare global {
  interface Window {
    __popOutReady?: boolean;
  }
}

const CSS = `
:host { all: initial; }
.wrap {
  position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
  display: flex; align-items: flex-end; gap: 8px;
  font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  animation: pop-in .35s cubic-bezier(.2,1.4,.4,1) both;
}
.wrap.out { animation: pop-out .25s ease-in both; }
.bubble {
  max-width: 260px; background: #fff; color: #111; border-radius: 16px 16px 4px 16px;
  padding: 12px 14px; box-shadow: 0 8px 30px rgba(0,0,0,.25);
}
.bubble p { margin: 0 0 10px; }
.row { display: flex; gap: 6px; flex-wrap: wrap; }
button {
  font: inherit; font-size: 13px; border: 0; border-radius: 999px; padding: 6px 12px; cursor: pointer;
  background: #111; color: #fff;
}
button.ghost { background: #eee; color: #111; }
.pet { flex: none; filter: drop-shadow(0 6px 10px rgba(0,0,0,.25)); cursor: pointer; }
@keyframes pop-in { from { transform: translateY(140%) scale(.6); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes pop-out { to { transform: translateY(140%); opacity: 0 } }
@media (prefers-color-scheme: dark) {
  .bubble { background: #1f2937; color: #f9fafb; }
  button { background: #f9fafb; color: #111; }
  button.ghost { background: #374151; color: #f9fafb; }
}
@media (prefers-reduced-motion: reduce) { .wrap, .wrap.out { animation: none; } }
${spriteKeyframes}
`;

let host: HTMLElement | null = null;
let wrapEl: HTMLElement | null = null;
let hideTimer: number | undefined;
let frameTimer: number | undefined;

function close(): void {
  clearInterval(frameTimer);
  if (!host) return;
  const el = host;
  host = null;
  wrapEl?.classList.add('out');
  setTimeout(() => el.remove(), 260);
}

/** Built-in pets: extension URLs are allowed on every page, so plain CSS animation works. */
function cssPet(msg: PopMessage, size: number): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('style', spriteStyle(msg.pet.manifest, msg.pet.sheetUrl, msg.mood, size));
  return el;
}

/**
 * Imported pets are stored as data: URLs, and some pages forbid loading those
 * images (a strict "img-src" Content Security Policy). So we turn the data into
 * bytes ourselves and draw the frames on a <canvas>: no URL is ever loaded, so
 * the page's rules don't apply. The 6 fps timer only runs while the pet is visible.
 */
function canvasPet(msg: PopMessage, size: number): HTMLElement {
  const m = msg.pet.manifest;
  const ratio = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = size * ratio;
  canvas.height = size * ratio;
  canvas.style.width = canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d')!;
  const [, b64] = msg.pet.sheetUrl.split(',', 2);
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const row = m.rows[msg.mood] ?? 0;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  createImageBitmap(new Blob([bytes], { type: 'image/png' })).then((sheet) => {
    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(sheet, frame * m.frameWidth, row * m.frameHeight, m.frameWidth, m.frameHeight, 0, 0, canvas.width, canvas.height);
      frame = (frame + 1) % m.frames;
    };
    draw();
    if (!still) frameTimer = window.setInterval(draw, 1000 / m.fps);
  });
  return canvas;
}

function show(msg: PopMessage): void {
  if (host) host.remove();
  clearTimeout(hideTimer);
  clearInterval(frameTimer);

  host = document.createElement('pop-out-pet');
  const root = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = CSS;

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrapEl = wrap;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const p = document.createElement('p');
  p.textContent = msg.text; // textContent: never inject HTML
  const row = document.createElement('div');
  row.className = 'row';

  const ok = document.createElement('button');
  ok.textContent = msg.offerBreak ? t(msg.lang, 'backToWork') : t(msg.lang, 'ok');
  ok.onclick = close;
  row.append(ok);

  if (msg.offerBreak) {
    const brk = document.createElement('button');
    brk.className = 'ghost';
    brk.textContent = t(msg.lang, 'break5');
    brk.onclick = () => {
      const cmd: Command = { type: 'pause', minutes: 5 };
      chrome.runtime.sendMessage(cmd);
      close();
    };
    row.append(brk);
  }
  bubble.append(p, row);

  const pet = msg.pet.sheetUrl.startsWith('data:') ? canvasPet(msg, 96) : cssPet(msg, 96);
  pet.className = 'pet';
  pet.title = 'pop_OUT';
  pet.onclick = close;

  wrap.append(bubble, pet);
  root.append(style, wrap);
  document.documentElement.append(host);

  if (msg.autoHide > 0) hideTimer = window.setTimeout(close, msg.autoHide * 1000);
}

if (!window.__popOutReady) {
  window.__popOutReady = true;
  chrome.runtime.onMessage.addListener((msg: PopMessage) => {
    if (msg?.type === 'pop') show(msg);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}
