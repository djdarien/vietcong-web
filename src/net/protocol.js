// Multiplayer hooks — singleplayer first, net second.
// No original game network protocol is reimplemented here (undocumented).
// This is a clean-room snapshot protocol for the procedural prototype:
// - authoritative-server layout, client prediction stub
// - messages are JSON over WebSocket; easy to swap for WebRTC later
// See docs/multiplayer-plan.md

export const MSG = {
  HELLO: 'hello',
  STATE: 'state',
  INPUT: 'input',
  SHOOT: 'shoot',
};

export function makeHello(name) {
  return { t: MSG.HELLO, name: String(name || 'player').slice(0, 24), v: 1 };
}

// Minimal player state: pos + yaw/pitch + hp. All procedural, no game assets.
export function makeState(players, tick) {
  return { t: MSG.STATE, tick, players };
}

export function applyState(local, msg) {
  // Server reconciliation stub: lerp remote players, keep local authoritative until server.
  const out = { ...local };
  if (msg.t !== MSG.STATE) return out;
  out.remotes = msg.players.filter((p) => p.id !== local.id);
  out.tick = msg.tick;
  return out;
}

// Client-side input packet at fixed tick (20Hz suggested).
export function makeInput(id, tick, keys, yaw, pitch, shoot) {
  return { t: MSG.INPUT, id, tick, keys, yaw, pitch, shoot: !!shoot };
}

export class NetClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.onState = null;
    this.tick = 0;
  }
  connect(name) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
      } catch (e) { reject(e); return; }
      this.ws.onopen = () => {
        this.connected = true;
        this.ws.send(JSON.stringify(makeHello(name)));
        resolve(true);
      };
      this.ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.t === MSG.STATE && this.onState) this.onState(msg);
        } catch { /* ignore */ }
      };
      this.ws.onerror = (e) => { if (!this.connected) reject(e); };
      this.ws.onclose = () => { this.connected = false; };
    });
  }
  sendInput(pkt) {
    if (this.connected && this.ws.readyState === 1) this.ws.send(JSON.stringify(pkt));
  }
  close() { try { this.ws?.close(); } catch { /* noop */ } this.connected = false; }
}
