# vietcong-web

Procedural Vietcong-style FPS prototype (Three.js / WebGL).

**Non-commercial fan project. Abandonware-style homage, NOT for resale.**
**This repo contains NO original Vietcong game files** — no CBF archives, BES models,
textures, audio, maps, or executables. All visuals are procedural (generated jungle,
capsule bots). OpenVietcong links below are public format documentation only.

- Specs: https://github.com/OpenVietcong/vc-spec (`doc/cbf.md`, `bes.md`, `ctr.md`, `way.md`, `sco.md`, `manm.md`)
- References: https://github.com/OpenVietcong/libvc, https://github.com/OpenVietcong/blender-plugin-vietcong

## Run
Open `index.html` in a modern browser, or:
```bash
npx serve .
```

Singleplayer: `index.html` — menu → DEPLOY. WASD move | Click shoot | Esc unlock.
Menu music is an original WebAudio theme (`src/audio/theme.js`), never the Vietcong theme.
Multiplayer (Phase 3 server):
```bash
npm i ws
node server/game-server.mjs --port=8080
# then open index.html?net=ws://localhost:8080&name=joe → MULTIPLAYER
```

## Parsers
Clean-room JS in `src/parsers/` (CBF, BES, CTR, WAY, SCO-partial, MANM-partial).
Details + spec citations: `docs/formats.md`.

```bash
npm test   # synthetic-data tests only, no game files needed
```

## Your own legal copy (optional, private only)
If you own Vietcong, you may point the local-only inspector at files **outside** this repo:
```bash
node tools/inspect-local.mjs --format cbf --file /absolute/path/outside/repo/file.cbf
```
Never commit those files. No scrapers, no “download on play”, no archive.org fetching —
see HARD RULES in project brief.

## Layout
- `index.html`, `js/main.js` — WebGL singleplayer + menu + net hooks
- `src/audio/theme.js` — original procedural menu theme
- `assets-local/` — git-ignored private audio slot (never committed)
- `src/parsers/` — format parsers
- `src/net/protocol.js` — multiplayer stub protocol
- `test/` — synthetic tests
- `tools/inspect-local.mjs` — private local-file inspector
- `docs/` — format + multiplayer notes

MIT License.
