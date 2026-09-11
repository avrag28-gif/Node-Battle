import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

// Faithful port of the original Battle-Tank empty-slot visual system.
// Four fixed slots only: pedestal + glowing ring + wireframe hologram + rotating core.
const SLOT_POSITIONS = [
  { x: -4.2, z: 4.2, slotIndex: 0 },
  { x: 4.2, z: -4.2, slotIndex: 1 },
  { x: -4.2, z: -4.2, slotIndex: 2 },
  { x: 4.2, z: 4.2, slotIndex: 3 }
];
const SLOT_COLORS = [0xff2d55, 0x00ff66, 0x00e5ff, 0xff9900];

const canvas = document.createElement('canvas');
canvas.id = 'slot-hologram-canvas';
canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:5;pointer-events:none;';
document.body.appendChild(canvas);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 22.5, 9.5);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

scene.add(new THREE.AmbientLight(0xffffff, 1.5));
const key = new THREE.DirectionalLight(0xffffff, 1.8);
key.position.set(12, 22, 12);
key.castShadow = true;
scene.add(key);
scene.add(new THREE.DirectionalLight(0x88ccff, 0.9));

const holograms = new Map();

for (const slot of SLOT_POSITIONS) {
  const color = SLOT_COLORS[slot.slotIndex];

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.5, 0.15, 24),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 })
  );
  pedestal.position.set(slot.x, 0.07, slot.z);
  pedestal.receiveShadow = true;
  scene.add(pedestal);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.42, 1.52, 32),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(slot.x, 0.16, slot.z);
  scene.add(ring);

  const holoGroup = new THREE.Group();
  holoGroup.position.set(slot.x, 0.2, slot.z);

  const holoCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 1.5, 16, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, wireframe: true })
  );
  holoCyl.position.y = 0.75;
  holoGroup.add(holoCyl);

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.35, 0),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, wireframe: true })
  );
  core.name = 'holoCore';
  core.position.y = 1.2;
  holoGroup.add(core);

  scene.add(holoGroup);
  holograms.set(slot.slotIndex, holoGroup);
}

let occupied = new Set();
async function syncSlots() {
  try {
    const response = await fetch('/api/status', { cache: 'no-store' });
    const data = await response.json();
    occupied = new Set((data.players || []).map(p => Number(p.slotIndex)));
    for (const [idx, group] of holograms) group.visible = !occupied.has(idx);
  } catch (_) {}
}
syncSlots();
setInterval(syncSlots, 250);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  for (const group of holograms) {
    const core = group.getObjectByName('holoCore');
    if (core) core.rotation.y += dt * 1.9;
  }
  renderer.render(scene, camera);
}
animate();
