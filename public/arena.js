import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const app = document.getElementById('app');
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-14,14,10,-10,0.1,100);
camera.position.set(0,18,14); camera.lookAt(0,0,0);
const renderer = new THREE.WebGLRenderer({ antialias:true }); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(innerWidth,innerHeight); renderer.shadowMap.enabled=true; app.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff,0x222222,2)); const sun=new THREE.DirectionalLight(0xffffff,3); sun.position.set(5,15,5); sun.castShadow=true; scene.add(sun);
const arena=new THREE.Mesh(new THREE.BoxGeometry(24,.4,18),new THREE.MeshStandardMaterial({color:0x59614a,roughness:1})); arena.position.y=-.25; arena.receiveShadow=true; scene.add(arena);
const grid=new THREE.GridHelper(24,12,0x999999,0x555555); grid.position.y=.01; scene.add(grid);
const tankMeshes=new Map(); let state=null;
function materialFor(slot){const colors=[0xd94b4b,0x4b78d9,0x49b96b,0xe0c64c,0xa65ad9];return new THREE.MeshStandardMaterial({color:colors[slot%colors.length],roughness:.7});}
function makeTank(p){const g=new THREE.Group(); const body=new THREE.Mesh(new THREE.BoxGeometry(1.35,.5,1.8),materialFor(p.slot)); body.position.y=.35; body.castShadow=true; g.add(body); const turret=new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,.25,12),materialFor(p.slot)); turret.rotation.x=Math.PI/2; turret.position.y=.7; g.add(turret); const barrel=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,1.15),materialFor(p.slot)); barrel.position.set(0,.72,.65); g.add(barrel); const label=document.createElement('div'); label.style.cssText='position:absolute;transform:translate(-50%,-50%);color:white;font-weight:800;font-size:13px;text-shadow:0 2px 4px #000'; label.textContent=p.username; g.userData.label=label; g.userData.playerId=p.id; scene.add(g); tankMeshes.set(p.id,g); return g;}
function update(s){state=s; document.getElementById('theme').textContent=`${s.theme.name} • ${s.players.length}/5 TANKS`; const m=Math.floor(s.remaining/60),sec=s.remaining%60; document.getElementById('timer').textContent=`${m}:${String(sec).padStart(2,'0')}`; const seen=new Set(); for(const p of s.players){let g=tankMeshes.get(p.id)||makeTank(p); seen.add(p.id); g.position.set(p.x,0,p.z); g.rotation.y=-THREE.MathUtils.degToRad(p.angle); g.scale.setScalar(1+(p.evolution-1)*.12); g.visible=p.status==='ALIVE';} for(const [id,g] of tankMeshes) if(!seen.has(id)){scene.remove(g);tankMeshes.delete(id);} const r=document.getElementById('result'); r.innerHTML=s.phase==='RESULT'&&s.winner?`<div class="result"><div class="card"><h1>🏆 ${s.winner.username}</h1><p>WINNER • ${s.winner.kills} KILLS</p></div></div>`:'';}
const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`); ws.onmessage=e=>{const x=JSON.parse(e.data);if(x.type==='STATE')update(x.data)}; fetch('/api/status').then(r=>r.json()).then(update);
addEventListener('resize',()=>{camera.left=-14;camera.right=14;camera.top=10;camera.bottom=-10;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
function animate(){requestAnimationFrame(animate);renderer.render(scene,camera)} animate();
