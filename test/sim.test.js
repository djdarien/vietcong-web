import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, stepPlayer, applyShoot, snapshot, WORLD } from '../src/net/sim.js';

test('stepPlayer moves and clamps to world', () => {
  const p = createPlayer('a', 'joe', WORLD.half - 0.01, 0);
  stepPlayer(p, { keys: { d: true }, tick: 1 });
  assert.ok(p.x <= WORLD.half);
  assert.equal(p.lastTick, 1);
});

test('applyShoot reduces hp and kills', () => {
  const m = new Map([['s', createPlayer('s', 's')], ['t', createPlayer('t', 't')]]);
  assert.equal(applyShoot(m, 's', 't', 25), true);
  assert.equal(m.get('t').hp, 75);
  applyShoot(m, 's', 't', 100);
  assert.equal(m.get('t').alive, false);
});

test('snapshot serializes players', () => {
  const m = new Map([['a', createPlayer('a', 'ann', 1, 2)]]);
  const s = snapshot(m, 7);
  assert.equal(s.tick, 7);
  assert.deepEqual(s.players[0], { id: 'a', name: 'ann', x: 1, z: 2, yaw: 0, hp: 100 });
});
