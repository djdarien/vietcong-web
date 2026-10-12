import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEME, stepDuration, patternFreq } from '../src/audio/theme.js';

test('theme scale/pattern are original generated data (no Vietcong melody)', () => {
  assert.equal(THEME.bpm, 72);
  assert.ok(THEME.scale.length >= 8);
  assert.equal(THEME.pattern.length, 16);
  assert.ok(Math.abs(stepDuration() - 60 / 72 / 2) < 1e-9);
});

test('patternFreq maps rests to null, notes to scale Hz', () => {
  assert.equal(patternFreq(1), null); // rest in default pattern
  assert.equal(patternFreq(0), THEME.scale[0]);
});
