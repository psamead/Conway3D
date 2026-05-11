import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── CONFIG ────────────────────────────────────────────────
const SIDE       = 10;    // grid size (10x10x10)
const CELL_SIZE  = 10;
const STEP_MS    = 3000;  // ms between generations
const TWEEN_MS   = 900;   // fade duration

// ── STATE ─────────────────────────────────────────────────
let cells = [];           // flat array of {status:bool}
let cubes = [];           // THREE.Mesh for each cell
let targets = [];         // target opacity per cube
let current = [];         // current opacity per cube
let paused = false;
let generation = 0;
let lastStep = 0;

// ── SCENE ─────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('container').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 2000);
camera.position.set(0, 60, 130);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.4;

// ── LIGHTS ────────────────────────────────────────────────
const light1 = new THREE.SpotLight(0xff2200, 200, 500, Math.PI/4, 0.5, 1);
light1.position.set(0, 200, 300);
light1.castShadow = true;
scene.add(light1);

const light2 = new THREE.SpotLight(0xffaa00, 150, 500, Math.PI/4, 0.5, 1);
light2.position.set(0, -200, -300);
light2.castShadow = true;
scene.add(light2);

scene.add(new THREE.AmbientLight(0x111111));

// ── BUILD GRID ────────────────────────────────────────────
const geo = new THREE.BoxGeometry(CELL_SIZE * 0.9, CELL_SIZE * 0.9, CELL_SIZE * 0.9);

for (let z = 0; z < SIDE; z++) {
  for (let y = 0; y < SIDE; y++) {
    for (let x = 0; x < SIDE; x++) {
      const alive = Math.random() < 0.1;

      // colour based on position (same as original)
      const r = (x / SIDE);
      const g = (y / SIDE);
      const b = (z / SIDE);
      const col = new THREE.Color(r, g, b);

      const mat = new THREE.MeshLambertMaterial({
        color: col,
        transparent: true,
        opacity: alive ? 1 : 0
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (x - SIDE * 0.5) * CELL_SIZE,
        (y - SIDE * 0.5) * CELL_SIZE,
        (z - SIDE * 0.5) * CELL_SIZE
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      cubes.push(mesh);
      cells.push({ status: alive });
      targets.push(alive ? 1 : 0);
      current.push(alive ? 1 : 0);
    }
  }
}

// ── CONWAY RULES (3D) ─────────────────────────────────────
function evaluateCell(idx) {
  const status = cells[idx].status;
  let count = 0;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        const p = idx + dz * SIDE * SIDE + dy * SIDE + dx;
        if (cells[p] && cells[p].status) count++;
      }
    }
  }
  if (count > 4) return false;
  if (count < 3) return false;
  if (count == 4) return true;
  return status;
}

function nextGeneration() {
  if (paused) return;
  generation++;
  document.getElementById('genNum').textContent = generation;

  const next = cells.map((_, i) => ({ status: evaluateCell(i) }));
  cells = next;

  for (let i = 0; i < cells.length; i++) {
    targets[i] = cells[i].status ? 1 : 0;
  }
}

// ── ANIMATE ───────────────────────────────────────────────
const clock = new THREE.Clock();

function animate(time) {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  // step conway
  if (!paused && time - lastStep > STEP_MS) {
    nextGeneration();
    lastStep = time;
  }

  // smooth tween opacity & scale
  const speed = delta / (TWEEN_MS / 1000);
  for (let i = 0; i < cubes.length; i++) {
    const c = current[i];
    const t = targets[i];
    const next = c + (t - c) * Math.min(speed * 3, 1);
    current[i] = next;
    const op = Math.max(0.001, next);
    cubes[i].material.opacity = op;
    cubes[i].rotation.y = Math.PI * op;
    cubes[i].scale.setScalar(Math.max(0.001, op));
  }

  // orbit lights
  if (!paused) {
    const t1 = Date.now() * 0.0003;
    const t2 = Date.now() * 0.00025;
    light1.position.set(
      camera.position.x,
      camera.position.y + 50,
      camera.position.z
    );
    light2.position.set(
      400 * Math.sin(t2) * Math.cos(t2),
      400 * Math.sin(t2),
      400 * Math.cos(t2)
    );
  }

  controls.update();
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

// ── CONTROLS ──────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); togglePause(); }
});

document.getElementById('pauseBtn').addEventListener('click', togglePause);

function togglePause() {
  paused = !paused;
  controls.autoRotate = !paused;
  document.getElementById('pauseBtn').textContent = paused ? 'RESUME' : 'PAUSE';
  if (!paused) lastStep = performance.now();
}