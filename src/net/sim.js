// Shared authoritative simulation — pure logic, no sockets, no rendering.
// Used by server/game-server.mjs and testable in Node. Browser client
// uses it only for client-side prediction stubs.

export const WORLD = { half: 95, speed: 14, tickHz: 20 };
export const DT = 1 / WORLD.tickHz;

export function createPlayer(id, name, x = 0, z = 0) {
  return { id, name: String(name || 'player').slice(0, 24), x, z, yaw: 0, hp: 100, alive: true, lastTick: 0 };
}

export function stepPlayer(p, input) {
  // input.keys: {w,a,s,d}. Top-down move on XZ plane, clamped to WORLD.
  const k = input.keys || {};
  let dx = (k.d ? 1 : 0) - (k.a ? 1 : 0);
  let dz = (k.s ? 1 : 0) - (k.w ? 1 : 0);
  // yaw-relative? Keep world-aligned for server simplicity (client rotates view only).
  const len = Math.hypot(dx, dz);
  if (len > 0) { dx /= len; dz /= len; }
  p.x = Math.max(-WORLD.half, Math.min(WORLD.half, p.x + dx * WORLD.speed * DT));
  p.z = Math.max(-WORLD.half, Math.min(WORLD.half, p.z + dz * WORLD.speed * DT));
  if (typeof input.yaw === 'number') p.yaw = input.yaw;
  p.lastTick = input.tick ?? p.lastTick;
  return p;
}

export function applyShoot(players, shooterId, targetId, damage = 25) {
  const t = players.get(targetId);
  if (!t || !t.alive) return false;
  // Simple range check omitted — server trusts client aim for prototype; validate later.
  t.hp -= damage;
  if (t.hp <= 0) { t.hp = 0; t.alive = false; }
  return true;
}

export function snapshot(players, tick) {
  return {
    t: 'state', tick,
    players: [...players.values()].map((p) => ({ id: p.id, name: p.name, x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: p.yaw, hp: p.hp })),
  };
}
