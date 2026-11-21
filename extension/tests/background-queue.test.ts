// Regression for Codex's finding X-001: pressing Stop while a nudge is still
// drawing the pet must not bring the old session back.
//
// We bundle the real background script with esbuild and run it against a
// tiny fake of the browser APIs it uses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

type Listener = (...args: any[]) => unknown;
const ev = () => {
  const ls: Listener[] = [];
  return { addListener: (l: Listener) => ls.push(l), fire: (...a: any[]) => ls.map((l) => l(...a)) };
};

function fakeChrome() {
  const store: Record<string, unknown> = {};
  let badge = '';
  let releaseInjection: () => void = () => {};
  let injectionStarted: () => void = () => {};
  const injectionStartedP = new Promise<void>((r) => (injectionStarted = r));
  const chrome = {
    storage: {
      local: {
        async get(keys: string | string[]) {
          const out: Record<string, unknown> = {};
          for (const k of [keys].flat()) if (k in store) out[k] = structuredClone(store[k]);
          return out;
        },
        async set(obj: Record<string, unknown>) {
          Object.assign(store, structuredClone(obj));
        },
        async remove(k: string) {
          delete store[k];
        },
      },
    },
    alarms: { create: async () => {}, clear: async () => true, onAlarm: ev() },
    tabs: {
      query: async () => [{ id: 1, url: 'https://www.youtube.com/watch?v=1', active: true }],
      sendMessage: async () => {},
      onActivated: ev(),
      onUpdated: ev(),
    },
    windows: { getLastFocused: async () => ({ focused: true }), onFocusChanged: ev() },
    idle: { queryState: async () => 'active', onStateChanged: ev() },
    scripting: {
      // Block here, like a slow page, until the test releases it.
      executeScript: () => {
        injectionStarted();
        return new Promise<void>((r) => (releaseInjection = r));
      },
    },
    notifications: { create: () => {} },
    action: {
      setBadgeText: async ({ text }: { text: string }) => {
        badge = text;
      },
      setBadgeBackgroundColor: async () => {},
    },
    runtime: {
      onMessage: ev(),
      onStartup: ev(),
      onInstalled: ev(),
      getURL: (p: string) => `ext://${p}`,
      openOptionsPage: async () => {},
    },
  };
  return {
    chrome,
    store,
    badge: () => badge,
    injectionStarted: injectionStartedP,
    release: () => releaseInjection(),
  };
}

function send(fake: ReturnType<typeof fakeChrome>, cmd: unknown): Promise<unknown> {
  return new Promise((resolve) => fake.chrome.runtime.onMessage.fire(cmd, {}, resolve));
}

test('Stop during a pending nudge wins', async () => {
  const fake = fakeChrome();
  (globalThis as any).chrome = fake.chrome;
  (globalThis as any).navigator ??= { language: 'en' };
  (globalThis as any).fetch = async (url: string) => ({
    json: async () => JSON.parse(readFileSync(url.replace('ext://', ''), 'utf8')),
  });

  const out = await build({ entryPoints: ['src/background.ts'], bundle: true, format: 'iife', write: false, logLevel: 'silent' });
  new Function(out.outputFiles[0].text)();

  await send(fake, { type: 'start', presetId: 'project', task: 'Essay', goalMin: 25 });
  assert.equal((fake.store.session as any).status, 'distracted');

  fake.chrome.alarms.onAlarm.fire({ name: 'nudge' });
  await fake.injectionStarted; // the pet is being drawn…
  const stopped = send(fake, { type: 'stop' }); // …and the user presses Stop
  fake.release();
  await stopped;

  assert.equal(fake.store.session, undefined, 'session must stay deleted');
  assert.equal(fake.badge(), '', 'badge must be cleared');
});
