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

function close(): void {
  if (!host) return;
  const el = host;
  host = null;
  wrapEl?.classList.add('out');
  setTimeout(() => el.remove(), 260);
}

function show(msg: PopMessage): void {
  if (host) host.remove();
  clearTimeout(hideTimer);

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

  const pet = document.createElement('div');
  pet.className = 'pet';
  pet.setAttribute('style', spriteStyle(msg.pet.manifest, msg.pet.sheetUrl, msg.mood, 96));
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
