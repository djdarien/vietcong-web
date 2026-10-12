import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { NetClient, makeInput } from '../src/net/protocol.js';
import { ProceduralTheme } from '../src/audio/theme.js';

// Procedural singleplayer prototype. No original Vietcong assets.
// Singleplayer first; NetClient hook is opt-in (?net=ws://host:8080).
// Menu theme is original WebAudio — never the Vietcong theme.

const params = new URLSearchParams(location.search);

// --- Menu + audio (Phase 2) ---
let audioCtx = null;
const theme = new ProceduralTheme();
let localAudio = null; // user-supplied file in assets-local/, git-ignored, private only
let muted = false;
const menuEl = document.getElementById('menu');
const muteBtn = document.getElementById('btn-mute');
const audioNote = document.getElementById('audio-note');

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    theme.attach(audioCtx);
    theme.start();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
// Local-only slot: if YOU placed assets-local/menu.mp3 (never committed),
// offer it as an alternative to the procedural theme. Default stays procedural.
fetch('assets-local/menu.mp3', { method: 'HEAD' }).then((r) => {
  if (!r.ok) return;
  localAudio = new Audio('assets-local/menu.mp3');
  localAudio.loop = true;
  if (audioNote) audioNote.textContent += ' — local track found in assets-local/ (private, not committed)';
}).catch(() => {});
function setMuted(m) {
  muted = m;
  theme.setMuted(m);
  if (localAudio) localAudio.muted = m;
  if (muteBtn) muteBtn.textContent = `MUTE: ${m ? 'ON' : 'OFF'}`;
}
muteBtn?.addEventListener('click', (e) => { e.stopPropagation(); ensureAudio(); setMuted(!muted); });
document.getElementById('btn-deploy')?.addEventListener('click', () => {
  ensureAudio();
  if (localAudio && !muted) localAudio.play().catch(() => {});
  menuEl.style.display = 'none';
  controls.lock();
});
document.getElementById('btn-net')?.addEventListener('click', () => {
  ensureAudio();
  menuEl.style.display = 'none';
  controls.lock();
  connectNet();
});
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3d7a4a);
scene.fog = new THREE.FogExp2(0x3d7a4a, 0.01);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());
controls.addEventListener('unlock', () => {
  if (menuEl && menuEl.style.display === 'none' && !netEnabled) menuEl.style.display = 'flex';
});

scene.add(new THREE.HemisphereLight(0x6aa86a, 0x1a3010, 0.6));
const dir = new THREE.DirectionalLight(0xffeecc, 0.8);
dir.position.set(40, 80, 20);
scene.add(dir);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshLambertMaterial({ color: 0x1e3d12 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Procedural jungle: instanced trunks + cones (no textures)
const TREE_COUNT = 60;
const dummy = new THREE.Object3D();
const trunks = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.2, 0.3, 4, 5),
  new THREE.MeshLambertMaterial({ color: 0x2e2014 }),
  TREE_COUNT
);
const leaves = new THREE.InstancedMesh(
  new THREE.ConeGeometry(1.5, 2.5, 5),
  new THREE.MeshLambertMaterial({ color: 0x0f3d0f }),
  TREE_COUNT
);
for (let i = 0; i < TREE_COUNT; i++) {
  const x = (Math.random() - 0.5) * 160;
  const z = (Math.random() - 0.5) * 160;
  dummy.position.set(x, 2, z);
  dummy.updateMatrix();
  trunks.setMatrixAt(i, dummy.matrix);
  dummy.position.y = 5;
  dummy.updateMatrix();
  leaves.setMatrixAt(i, dummy.matrix);
}
trunks.instanceMatrix.needsUpdate = leaves.instanceMatrix.needsUpdate = true;
scene.add(trunks, leaves);

// Simple procedural bots (red capsules wandering waypoints) — singleplayer fill
const bots = [];
const botGeo = new THREE.CapsuleGeometry(0.4, 1.0, 4, 8);
const botMat = new THREE.MeshLambertMaterial({ color: 0x8a1a1a });
for (let i = 0; i < 3; i++) {
  const m = new THREE.Mesh(botGeo, botMat);
  m.position.set((Math.random() - 0.5) * 60, 1.2, (Math.random() - 0.5) * 60);
  m.userData = { hp: 3, t: Math.random() * 10 };
  scene.add(m);
  bots.push(m);
}

// Shooting: raycast on click, flash + bot hp
const ray = new THREE.Raycaster();
let ammo = 30, score = 0;
const hud = document.getElementById('info');
function updateHud(net) {
  hud.innerHTML =
    `WASD move | Mouse look | Click shoot | Esc unlock<br>` +
    `Procedural prototype — no original assets<br>` +
    `HP 100 | AMMO ${ammo} | SCORE ${score} | BOTS ${bots.length}` +
    (net?.connected ? ` | NET connected tick ${net.tick}` : ` | OFFLINE singleplayer`);
}
document.addEventListener('mousedown', () => {
  if (!controls.isLocked) return;
  if (ammo <= 0) { ammo = 30; return; }
  ammo--;
  ray.setFromCamera({ x: 0, y: 0 }, camera);
  const hits = ray.intersectObjects(bots);
  if (hits.length) {
    const b = hits[0].object;
    b.userData.hp--;
    b.material.emissive = new THREE.Color(0xffffff);
    setTimeout(() => (b.material.emissive = new THREE.Color(0x000000)), 80);
    if (b.userData.hp <= 0) {
      scene.remove(b);
      bots.splice(bots.indexOf(b), 1);
      score += 100;
    } else score += 10;
  }
  updateHud(net);
});

// Movement
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const keys = { w: false, a: false, s: false, d: false };
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW') keys.w = true;
  if (e.code === 'KeyA') keys.a = true;
  if (e.code === 'KeyS') keys.s = true;
  if (e.code === 'KeyD') keys.d = true;
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW') keys.w = false;
  if (e.code === 'KeyA') keys.a = false;
  if (e.code === 'KeyS') keys.s = false;
  if (e.code === 'KeyD') keys.d = false;
});

// Multiplayer hook (opt-in): ?net=ws://localhost:8080&name=joe
const net = new NetClient(params.get('net') || 'ws://localhost:8080');
let netEnabled = !!params.get('net');
let tick = 0;
function connectNet() {
  if (net.connected) return;
  netEnabled = true;
  net.onState = (msg) => {
    // Remote players rendered as blue capsules (stub)
    for (const p of msg.players) {
      if (p.id === 'local') continue;
      let m = scene.getObjectByName('remote-' + p.id);
      if (!m) {
        m = new THREE.Mesh(botGeo, new THREE.MeshLambertMaterial({ color: 0x1a4a8a }));
        m.name = 'remote-' + p.id;
        scene.add(m);
      }
      m.position.set(p.x, 1.2, p.z);
    }
  };
  net.connect(params.get('name') || 'player').catch(() => { netEnabled = false; updateHud(net); });
}
if (params.get('net')) {
  menuEl.style.display = 'none';
  connectNet();
}
setInterval(() => {
  if (!netEnabled || !net.connected) return;
  tick++;
  const p = controls.getObject().position;
  net.sendInput(makeInput('local', tick, { ...keys }, 0, 0, false));
}, 50);

const clock = new THREE.Clock();
const player = controls.getObject();
updateHud(net);

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.033);
  if (controls.isLocked) {
    velocity.x *= 1 - 6 * delta;
    velocity.z *= 1 - 6 * delta;
    direction.z = Number(keys.w) - Number(keys.s);
    direction.x = Number(keys.d) - Number(keys.a);
    if (direction.lengthSq() > 0) direction.normalize();
    if (keys.w || keys.s) velocity.z -= direction.z * 28 * delta;
    if (keys.a || keys.d) velocity.x -= direction.x * 28 * delta;
    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);
    player.position.y = 1.6;
    player.position.x = THREE.MathUtils.clamp(player.position.x, -95, 95);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -95, 95);
  }
  // bots wander
  const t = clock.elapsedTime;
  for (const b of bots) {
    b.position.x += Math.sin(t * 0.5 + b.userData.t) * delta * 2;
    b.position.z += Math.cos(t * 0.4 + b.userData.t) * delta * 2;
  }
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
