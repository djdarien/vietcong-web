import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3d7a4a);
scene.fog = new THREE.FogExp2(0x3d7a4a, 0.01);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());
document.addEventListener('click', () => controls.lock());

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

const TREE_COUNT = 40;
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

const clock = new THREE.Clock();
const player = controls.getObject();

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
  }
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
