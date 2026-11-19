import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostOf, isNeutralUrl, matchesAny, matchesPattern, normalizePattern } from '../src/shared/match.ts';

test('normalizePattern cleans what users type', () => {
  assert.equal(normalizePattern(' https://www.GitHub.com/ '), 'github.com');
  assert.equal(normalizePattern('docs.google.com/document?x=1'), 'docs.google.com/document');
  assert.equal(normalizePattern(''), '');
});

test('domain matches itself and subdomains, not look-alikes', () => {
  assert.ok(matchesPattern('https://github.com/adnanbkz', 'github.com'));
  assert.ok(matchesPattern('https://gist.github.com/x', 'github.com'));
  assert.ok(matchesPattern('https://www.github.com/', 'github.com'));
  assert.ok(!matchesPattern('https://notgithub.com/', 'github.com'));
  assert.ok(!matchesPattern('https://github.com.evil.io/', 'github.com'));
});

test('path patterns require the path prefix', () => {
  assert.ok(matchesPattern('https://docs.google.com/document/d/1', 'docs.google.com/document'));
  assert.ok(!matchesPattern('https://docs.google.com/spreadsheets/d/1', 'docs.google.com/document'));
});

test('localhost and ports work', () => {
  assert.ok(matchesAny('http://localhost:5173/', ['localhost']));
  assert.ok(!matchesAny('https://youtube.com/watch?v=1', ['github.com', 'localhost']));
});

test('browser pages are neutral', () => {
  assert.ok(isNeutralUrl('chrome://newtab/'));
  assert.ok(isNeutralUrl('about:blank'));
  assert.ok(isNeutralUrl(''));
  assert.ok(!isNeutralUrl('https://youtube.com'));
  assert.equal(hostOf('https://www.YouTube.com/watch'), 'youtube.com');
});
