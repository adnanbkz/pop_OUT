// Background script: the only always-available part of pop_OUT.
//
// It does NOT run a loop. The browser wakes it up on events
// (tab switched, URL changed, window focus changed, idle state changed,
// or a once-a-minute alarm), it updates the timer, and it goes back to sleep.
// That is why it costs ~0% CPU.
import { react, type Event } from './shared/brain';
import { hostOf, isNeutralUrl, matchesAny } from './shared/match';
import { getPet, getSession, getSettings, saveSession } from './shared/storage';
import type { Command, PopMessage, Session, Settings, Status } from './shared/types';

const TICK = 'tick';
const NUDGE = 'nudge';
const BREAK_END = 'break-end';

// ---------- what is the user looking at right now? ----------

interface Context {
  url: string;
  tabId: number | undefined;
  windowFocused: boolean;
  idle: boolean;
}

async function readContext(settings: Settings): Promise<Context> {
  const [win, idleState] = await Promise.all([
    chrome.windows.getLastFocused({ populate: false }).catch(() => undefined),
    chrome.idle.queryState(Math.max(15, settings.idleMinutes * 60)),
  ]);
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return {
    url: tab?.url ?? '',
    tabId: tab?.id,
    windowFocused: !!win?.focused,
    idle: idleState !== 'active',
  };
}

function decideStatus(session: Session, settings: Settings, ctx: Context, now: number): Status {
  if (session.pausedUntil !== null && session.pausedUntil > now) return 'paused';
  if (ctx.idle) return 'idle';
  const preset = settings.presets.find((p) => p.id === session.presetId);
  if (!preset) return 'neutral';
  if (!ctx.windowFocused) return preset.countOutsideBrowser ? 'focus' : 'neutral';
  if (isNeutralUrl(ctx.url)) return 'neutral';
  return matchesAny(ctx.url, preset.sites) ? 'focus' : 'distracted';
}

// ---------- the core: called on every event ----------

let queueTail: Promise<unknown> = Promise.resolve();

/**
 * Every piece of work that reads and writes the session goes through this
 * single queue, one at a time. Without it, a nudge that is still drawing the
 * pet could save an old copy of the session after the user pressed Stop.
 * Work inside the queue must call evaluateNow(), never evaluate(), or it
 * would wait for itself.
 */
function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const result = queueTail.then(work, work);
  queueTail = result.catch(() => undefined);
  return result;
}

function evaluate(): Promise<void> {
  return enqueue(evaluateNow);
}

async function evaluateNow(): Promise<void> {
  const session = await getSession();
  if (!session || session.done) return;
  const settings = await getSettings();
  const now = Date.now();

  // 1. Bank the time since the last update if we were focused.
  if (session.status === 'focus') session.focusedMs += Math.max(0, now - session.lastTick);
  session.lastTick = now;

  if (session.pausedUntil !== null && session.pausedUntil <= now) session.pausedUntil = null;

  // 2. Work out the new status.
  const ctx = await readContext(settings);
  const status = decideStatus(session, settings, ctx, now);
  const host = hostOf(ctx.url);
  const prev = session.status;
  const goalMs = session.goalMin * 60_000;

  if (status !== prev || (status === 'distracted' && host !== session.currentHost)) {
    session.since = now;
    if (status === 'distracted') {
      session.distractions[host] = (session.distractions[host] ?? 0) + 1;
      session.streakNudges = 0;
      await chrome.alarms.create(NUDGE, { delayInMinutes: Math.max(0.5, settings.graceSeconds / 60), periodInMinutes: 2 });
    } else {
      await chrome.alarms.clear(NUDGE);
      if (status === 'focus' && prev === 'distracted' && session.streakNudges > 0) {
        await pop(settings, ctx.tabId, {
          kind: 'back',
          task: session.task,
          leftMin: Math.ceil((goalMs - session.focusedMs) / 60_000),
        });
      }
      session.streakNudges = 0;
    }
  }
  session.status = status;
  session.currentHost = host;

  // 3. Milestones and goal.
  if (session.focusedMs >= goalMs) {
    session.done = true;
    session.focusedMs = goalMs;
    await chrome.alarms.clear(NUDGE);
    await chrome.alarms.clear(TICK);
    await pop(settings, ctx.tabId, { kind: 'done', task: session.task, goalMin: session.goalMin });
  } else {
    const milestone = Math.floor((session.focusedMs / goalMs) * 4); // 0..3
    if (milestone > session.lastMilestone && status === 'focus') {
      session.lastMilestone = milestone;
      await pop(settings, ctx.tabId, {
        kind: 'milestone',
        percent: milestone * 25,
        leftMin: Math.ceil((goalMs - session.focusedMs) / 60_000),
        task: session.task,
      });
    }
  }

  await saveSession(session);
  await updateBadge(session);
}

async function nudgeNow(): Promise<void> {
  await evaluateNow();
  const session = await getSession();
  if (!session || session.done || session.status !== 'distracted') {
    await chrome.alarms.clear(NUDGE);
    return;
  }
  const settings = await getSettings();
  const ctx = await readContext(settings);
  await pop(settings, ctx.tabId, {
    kind: 'distracted',
    site: session.currentHost,
    task: session.task,
    streakNudges: session.streakNudges,
    visits: session.distractions[session.currentHost] ?? 1,
    focusedMin: Math.floor(session.focusedMs / 60_000),
  });
  session.streakNudges += 1;
  session.totalNudges += 1;
  await saveSession(session);
}

// ---------- showing the pet ----------

async function pop(settings: Settings, tabId: number | undefined, event: Event): Promise<void> {
  const reaction = react(event, settings.lang);
  const pet = await getPet(settings.petId);
  const msg: PopMessage = { type: 'pop', ...reaction, pet, lang: settings.lang };
  const shown = tabId !== undefined && (await showInTab(tabId, msg));
  if (!shown) {
    // Can't draw on this page (new tab, browser settings, store pages…):
    // fall back to a system notification.
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title: 'pop_OUT',
      message: reaction.text,
      silent: true,
    });
  }
}

async function showInTab(tabId: number, msg: PopMessage): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['overlay.js'] });
    await chrome.tabs.sendMessage(tabId, msg);
    return true;
  } catch {
    return false;
  }
}

// ---------- toolbar badge ----------

async function updateBadge(session: Session | null): Promise<void> {
  if (!session) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  const left = Math.max(0, Math.ceil((session.goalMin * 60_000 - session.focusedMs) / 60_000));
  const colors: Record<Status, string> = {
    focus: '#16a34a',
    distracted: '#dc2626',
    neutral: '#6b7280',
    idle: '#6b7280',
    paused: '#ca8a04',
  };
  await chrome.action.setBadgeText({ text: session.done ? '✓' : String(left) });
  await chrome.action.setBadgeBackgroundColor({ color: session.done ? '#16a34a' : colors[session.status] });
}

// ---------- commands from the popup / overlay ----------

async function handleNow(cmd: Command): Promise<void> {
  const now = Date.now();
  switch (cmd.type) {
    case 'start': {
      const session: Session = {
        presetId: cmd.presetId,
        task: cmd.task.trim() || '…',
        goalMin: Math.max(1, Math.min(600, Math.round(cmd.goalMin))),
        focusedMs: 0,
        status: 'neutral',
        since: now,
        lastTick: now,
        startedAt: now,
        currentHost: '',
        distractions: {},
        streakNudges: 0,
        totalNudges: 0,
        lastMilestone: 0,
        pausedUntil: null,
        done: false,
      };
      await saveSession(session);
      await chrome.alarms.create(TICK, { periodInMinutes: 1 });
      await evaluateNow();
      break;
    }
    case 'stop':
      await Promise.all([chrome.alarms.clear(TICK), chrome.alarms.clear(NUDGE), chrome.alarms.clear(BREAK_END)]);
      await saveSession(null);
      await updateBadge(null);
      break;
    case 'pause': {
      await evaluateNow(); // bank time first
      const s = await getSession();
      if (!s) return;
      s.pausedUntil = cmd.minutes ? now + cmd.minutes * 60_000 : Number.MAX_SAFE_INTEGER;
      await saveSession(s);
      if (cmd.minutes) await chrome.alarms.create(BREAK_END, { delayInMinutes: cmd.minutes });
      await evaluateNow();
      break;
    }
    case 'resume': {
      const s = await getSession();
      if (!s) return;
      s.pausedUntil = null;
      await saveSession(s);
      await chrome.alarms.clear(BREAK_END);
      await evaluateNow();
      break;
    }
    case 'test-pop': {
      const settings = await getSettings();
      const ctx = await readContext(settings);
      const fake = (await getSession()) ?? ({ task: settings.lang === 'es' ? 'tu tarea' : 'your task' } as Session);
      await pop(settings, ctx.tabId, {
        kind: 'distracted',
        site: hostOf(ctx.url) || 'example.com',
        task: fake.task,
        streakNudges: 0,
        visits: 1,
        focusedMin: 0,
      });
      break;
    }
  }
}

// ---------- wiring: every listener is registered at top level ----------

chrome.runtime.onMessage.addListener((cmd: Command, _sender, reply) => {
  enqueue(() => handleNow(cmd)).then(() => reply({ ok: true }), (e) => reply({ ok: false, error: String(e) }));
  return true; // async reply
});

chrome.tabs.onActivated.addListener(() => void evaluate());
chrome.tabs.onUpdated.addListener((_id, info, tab) => {
  if (tab.active && info.url) void evaluate();
});
chrome.windows.onFocusChanged.addListener(() => void evaluate());
chrome.idle.onStateChanged.addListener(() => void evaluate());

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TICK || alarm.name === BREAK_END) void evaluate();
  if (alarm.name === NUDGE) void enqueue(nudgeNow);
});

chrome.runtime.onStartup.addListener(() => void enqueue(startupNow));

async function startupNow(): Promise<void> {
  // Browser restarted: don't count the time it was closed.
  const s = await getSession();
  if (s && !s.done) {
    s.lastTick = Date.now();
    s.status = 'neutral';
    await saveSession(s);
    await chrome.alarms.create(TICK, { periodInMinutes: 1 });
  }
  await updateBadge(s);
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') await chrome.runtime.openOptionsPage();
});
