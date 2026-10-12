#!/usr/bin/env node
// Authoritative game server — clean-room snapshot protocol, procedural only.
// Run:  npm i ws   then   node server/game-server.mjs [--port 8080]
// Browser: open index.html?net=ws://localhost:8080&name=joe and click MULTIPLAYER.
// No original Vietcong assets or protocols here.
import { createServer } from 'node:http';
import { createPlayer, stepPlayer, snapshot, WORLD } from '../src/net/sim.js';

const port = +(process.argv.find((a) => a.startsWith('--port='))?.split('=')[1] ?? 8080);

let WsServer;
try {
  ({ WebSocketServer: WsServer } = await import('ws'));
} catch {
  console.error("missing dep: run `npm i ws` first (opt-in multiplayer server).");
  process.exit(1);
}

const players = new Map(); // id -> player
let tick = 0;
let nextId = 1;
const inputs = new Map(); // id -> latest input

const httpServer = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end(`vietcong-web server tick=${tick} players=${players.size}\n`);
});
const wss = new WsServer({ server: httpServer });

wss.on('connection', (ws) => {
  const id = `p${nextId++}`;
  let player = null;
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.t === 'hello') {
      player = createPlayer(id, msg.name, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40);
      players.set(id, player);
      ws.send(JSON.stringify({ t: 'welcome', id, tick }));
    } else if (msg.t === 'input' && player) {
      inputs.set(id, msg);
    } else if (msg.t === 'shoot' && player) {
      // {t:'shoot', target}<— prototype: direct damage, validated coarsely later
      const t = players.get(msg.target);
      if (t && t.alive) {
        t.hp -= 25;
        if (t.hp <= 0) { t.hp = 0; t.alive = false; setTimeout(() => { t.hp = 100; t.alive = true; }, 5000); }
      }
    }
  });
  ws.on('close', () => { players.delete(id); inputs.delete(id); });
});

// 20Hz authoritative tick
setInterval(() => {
  tick++;
  for (const [id, p] of players) {
    const inp = inputs.get(id);
    if (inp) stepPlayer(p, inp);
  }
  const snap = JSON.stringify(snapshot(players, tick));
  for (const c of wss.clients) if (c.readyState === 1) c.send(snap);
}, 1000 / WORLD.tickHz);

httpServer.listen(port, () => console.log(`vietcong-web server on :${port} @${WORLD.tickHz}Hz`));
