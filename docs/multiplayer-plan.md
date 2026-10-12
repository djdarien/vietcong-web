# Multiplayer plan — singleplayer first, hooks now

Status: **singleplayer only** at this commit. `src/net/protocol.js` is an opt-in stub.

## Why not Vietcong netcode?
The original multiplayer protocol is undocumented in vc-spec. We do NOT
disassemble or clone it. We design a new clean-room protocol for the
procedural prototype.

## Stub protocol (JSON over WebSocket)
- `hello {t,name,v}` — client join
- `input {t:'input',id,tick,keys,yaw,pitch,shoot}` — client→server @20Hz
- `state {t:'state',tick,players:[{id,x,z,yaw,hp}]}` — server→clients @20Hz

`NetClient` in `src/net/protocol.js` implements this. Enable with:
`index.html?net=ws://localhost:8080&name=joe`

## Roadmap (ask before building large subsystems)
1. Dedicated `server/` authoritative sim (player pos, hp, respawn) — 20Hz tick.
2. Client prediction + reconciliation in `protocol.js:applyState`.
3. Snapshot interpolation for remotes (blue capsules already stubbed in `js/main.js`).
4. Later: WebRTC data-channel transport, rooms/teams, anti-cheat basics.
5. No game-asset sync — only procedural state + parser-derived custom maps
   the user supplies locally (never committed).

## Singleplayer today
`js/main.js` has WASD + pointer-lock + raycast shooting + 3 wandering bots
(red capsules) + ammo/score HUD. That loop stays playable with net off.
