import { test } from 'node:test';
import assert from 'node:assert/strict';
import { react } from '../src/shared/brain.ts';

const base = { kind: 'distracted', site: 'youtube.com', task: 'Essay', streakNudges: 0, visits: 1, focusedMin: 10 } as const;

test('first distraction is gentle and names the task', () => {
  const r = react(base, 'en', () => 0);
  assert.equal(r.mood, 'alert');
  assert.match(r.text, /Essay/);
  assert.ok(r.offerBreak);
});

test('staying distracted gets firmer', () => {
  assert.equal(react({ ...base, streakNudges: 2 }, 'es', () => 0).mood, 'annoyed');
});

test('a site you keep returning to is called out with its count', () => {
  const r = react({ ...base, visits: 4 }, 'es', () => 0);
  assert.equal(r.mood, 'annoyed');
  assert.match(r.text, /4/);
  assert.match(r.text, /youtube\.com/);
});

test('long focus suggests a real break', () => {
  assert.match(react({ ...base, focusedMin: 55 }, 'en', () => 0).text, /55 min/);
});

test('goal reached celebrates in Spanish', () => {
  const r = react({ kind: 'done', task: 'Tema 3', goalMin: 25 }, 'es', () => 0);
  assert.equal(r.mood, 'celebrate');
  assert.match(r.text, /25/);
});
