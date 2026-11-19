// Toolbar popup: start a session, or see how the current one is going.
// The 1-second refresh only runs while the popup is open.
import { applyI18n, t, type Key } from '../shared/i18n';
import { spriteKeyframes, spriteStyle } from '../shared/pets';
import { getPet, getSession, getSettings } from '../shared/storage';
import type { Command, Mood, Session, Settings, Status } from '../shared/types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let settings: Settings;
let session: Session | null = null;

function send(cmd: Command): Promise<unknown> {
  return chrome.runtime.sendMessage(cmd);
}

function fmt(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function moodFor(s: Session | null): Mood {
  if (!s) return 'idle';
  if (s.done) return 'celebrate';
  if (s.status === 'distracted') return 'annoyed';
  if (s.status === 'focus') return 'happy';
  return 'idle';
}

let lastMood: Mood | null = null;
async function drawPet(): Promise<void> {
  const mood = moodFor(session);
  if (mood === lastMood) return;
  lastMood = mood;
  const pet = await getPet(settings.petId);
  $('pet').setAttribute('style', spriteStyle(pet.manifest, pet.sheetUrl, mood, 56));
}

function render(): void {
  const lang = settings.lang;
  $('setup').hidden = !!session;
  $('running').hidden = !session || session.done;
  $('done').hidden = !session?.done;

  const status = $('status');
  if (!session) {
    status.textContent = '';
    status.className = 'status';
  } else {
    const st: Status = session.status;
    status.textContent = session.done ? t(lang, 'doneTitle') : t(lang, `status_${st}` as Key);
    status.className = `status ${session.done ? 'focus' : st}`;
  }
  void drawPet();
  if (!session) return;

  if (session.done) {
    $('doneTask').textContent = `${session.task} · ${session.goalMin} min`;
    return;
  }

  // Live time = banked time + time since the last background update (if focused).
  const live = session.focusedMs + (session.status === 'focus' ? Date.now() - session.lastTick : 0);
  const goal = session.goalMin * 60_000;
  const clamped = Math.min(live, goal);
  $('runTask').textContent = session.task;
  $('time').textContent = fmt(clamped);
  $('left').textContent = `${fmt(goal - clamped)} ${t(lang, 'left')}`;
  const arc = $('arc') as unknown as SVGCircleElement;
  arc.style.strokeDashoffset = String(276.46 * (1 - clamped / goal));
  arc.style.stroke = session.status === 'focus' ? 'var(--ok)' : session.status === 'distracted' ? 'var(--bad)' : 'var(--muted)';
  $('pauseBtn').textContent = session.status === 'paused' ? t(lang, 'resume') : t(lang, 'pause');
}

async function hasHostAccess(): Promise<boolean> {
  return chrome.permissions.contains({ origins: ['<all_urls>'] });
}

async function init(): Promise<void> {
  settings = await getSettings();
  session = await getSession();
  applyI18n(document, settings.lang);

  const style = document.createElement('style');
  style.textContent = spriteKeyframes;
  document.head.append(style);

  const select = $<HTMLSelectElement>('preset');
  for (const p of settings.presets) select.add(new Option(`${p.emoji} ${p.name}`, p.id));
  const { lastPreset, lastGoal } = await chrome.storage.local.get(['lastPreset', 'lastGoal']);
  if (lastPreset) select.value = lastPreset;
  if (lastGoal) $<HTMLInputElement>('goal').value = String(lastGoal);

  // Firefox (and sometimes Safari) ask for site access separately.
  if (!(await hasHostAccess())) $('perm').hidden = false;

  $('setup').addEventListener('submit', async (e) => {
    e.preventDefault();
    // Must be the first call in the click handler (no await before it), or
    // Firefox won't show its prompt. If access is already granted it just returns true.
    const granted = await chrome.permissions.request({ origins: ['<all_urls>'] }).catch(() => false);
    if (granted) $('perm').hidden = true;
    const goalMin = Number($<HTMLInputElement>('goal').value) || 25;
    await chrome.storage.local.set({ lastPreset: select.value, lastGoal: goalMin });
    await send({ type: 'start', presetId: select.value, task: $<HTMLInputElement>('task').value, goalMin });
  });

  $('pauseBtn').onclick = () => send(session?.status === 'paused' ? { type: 'resume' } : { type: 'pause', minutes: null });
  $('stopBtn').onclick = () => send({ type: 'stop' });
  $('newBtn').onclick = () => send({ type: 'stop' });
  $('settings').onclick = (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  };

  chrome.storage.onChanged.addListener(async (changes) => {
    if (changes.session) session = changes.session.newValue ?? null;
    if (changes.settings) {
      settings = await getSettings();
      lastMood = null;
    }
    render();
  });

  render();
  setInterval(render, 1000);
}

void init();
