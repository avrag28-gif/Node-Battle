import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { createArenaPerimeter } from './arena-perimeter.js';
import { createTankMeshGroup } from './tank-model.js';

const app = document.getElementById('app');
const labels = document.getElementById('labels');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 22.5, 9.5);
camera.lookAt(0, 0, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const SLOT_POSITIONS = [
  { x: -4.2, z: 4.2, slotIndex: 0 },
  { x: 4.2, z: -4.2, slotIndex: 1 },
  { x: -4.2, z: -4.2, slotIndex: 2 },
  { x: 4.2, z: 4.2, slotIndex: 3 }
];
const SLOT_COLORS = ['#FF2D55', '#00FF66', '#00E5FF', '#FF9900'];
const SLOT_COLOR_HEX = [0xff2d55, 0x00ff66, 0x00e5ff, 0xff9900];
const THEMES = {
  DESERT: { bg: '#f7d08a', plate: '#4a3522', groove: '#d4a359', accent: '#ff8c00', text: '#fbbf24', particles: 'DUST' },
  FROZEN_ICE: { bg: '#071e3d', plate: '#1e3d59', groove: '#00f2fe', accent: '#00c6ff', text: '#38bdf8', particles: 'SNOW' },
  VOLCANIC: { bg: '#1a0003', plate: '#18181b', groove: '#ff2e63', accent: '#ff0033', text: '#f43f5e', particles: 'EMBERS' }
};

const tankMeshes = new Map();
const labelMap = new Map();
const projectileMeshes = new Map();
const fxMap = new Map();
let groundMesh = null;
let groundTheme = null;
let perimeter = null;
let particles = null;
let centerCrystal = null;
let state = null;
let prevEffectIds = new Set();
let audioCtx = null;
let bgmTimer = null;
let clock = 0;

scene.background = new THREE.Color('#0b0e14');
scene.fog = new THREE.Fog('#0b0e14', 45, 120);
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
dirLight.position.set(12, 22, 12);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 1;
dirLight.shadow.camera.far = 50;
dirLight.shadow.camera.left = -14;
dirLight.shadow.camera.right = 14;
dirLight.shadow.camera.top = 14;
dirLight.shadow.camera.bottom = -14;
scene.add(dirLight);
const fillLight = new THREE.DirectionalLight(0x88ccff, 0.9);
fillLight.position.set(-12, 18, -10);
scene.add(fillLight);

function createGroundTexture(themeId) {
  const theme = THEMES[themeId] || THEMES.DESERT;
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const w = 1024, h = 1024;
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  if (themeId === 'FROZEN_ICE') { gradient.addColorStop(0, '#0f172a'); gradient.addColorStop(.5, '#1e3d59'); gradient.addColorStop(1, '#071e3d'); }
  else if (themeId === 'VOLCANIC') { gradient.addColorStop(0, '#110003'); gradient.addColorStop(.5, '#2a0a10'); gradient.addColorStop(1, '#090002'); }
  else { gradient.addColorStop(0, '#3a2712'); gradient.addColorStop(.5, '#5c4028'); gradient.addColorStop(1, '#3a2712'); }
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  const cols = 10, rows = 8, cellW = w / cols, cellH = h / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c * cellW, y = r * cellH;
    ctx.fillStyle = theme.plate; ctx.fillRect(x + 3, y + 3, cellW - 6, cellH - 6);
    ctx.strokeStyle = theme.groove; ctx.lineWidth = 1.5; ctx.globalAlpha = .4; ctx.strokeRect(x + 3, y + 3, cellW - 6, cellH - 6);
    ctx.fillStyle = theme.accent; ctx.globalAlpha = .7;
    for (const [dx, dy] of [[8,8],[cellW-8,8],[8,cellH-8],[cellW-8,cellH-8]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 2.5, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  const border = 24;
  ctx.fillStyle = theme.accent; ctx.globalAlpha = .85;
  for (let x = 0; x < w; x += 30) {
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x+15,0); ctx.lineTo(x,border); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x,h); ctx.lineTo(x+15,h); ctx.lineTo(x,h-border); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.strokeStyle = theme.accent; ctx.lineWidth = 4; ctx.strokeRect(border,border,w-border*2,h-border*2);
  const cx=w/2, cy=h/2, radius=180;
  ctx.globalAlpha=.85; ctx.strokeStyle=theme.accent; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(cx,cy,radius,0,Math.PI*2); ctx.stroke();
  ctx.setLineDash([12,8]); ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx,cy,radius-20,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(cx-radius-30,cy); ctx.lineTo(cx+radius+30,cy); ctx.moveTo(cx,cy-radius-30); ctx.lineTo(cx,cy+radius+30); ctx.stroke();
  ctx.fillStyle=theme.text; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.globalAlpha=.9; ctx.font='900 24px sans-serif'; ctx.fillText('TIKTOK TANK ARENA',cx,cy-12); ctx.font='700 14px sans-serif'; ctx.fillText('⚡ COMBAT ZONE ⚡',cx,cy+16); ctx.font='800 13px monospace'; ctx.globalAlpha=.65; ctx.fillText('[SECTOR A - NORTH]',cx,border+22); ctx.fillText('[SECTOR B - SOUTH]',cx,h-border-14);
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate=true; return tex;
}

function buildArena(themeId) {
  const theme = THEMES[themeId] || THEMES.DESERT;
  if (groundMesh) { scene.remove(groundMesh); groundMesh.geometry.dispose(); groundMesh.material.map?.dispose(); groundMesh.material.dispose(); }
  const tex = createGroundTexture(themeId);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: .4, metalness: .5 });
  groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(16.4,16.4), mat);
  groundMesh.rotation.x = -Math.PI/2; groundMesh.receiveShadow=true; scene.add(groundMesh); groundTheme=themeId;
  if (perimeter) { scene.remove(perimeter.group); perimeter.dispose(); }
  perimeter = createArenaPerimeter(16.8); scene.add(perimeter.group);
  if (particles) { scene.remove(particles); particles.geometry.dispose(); particles.material.dispose(); particles=null; }
  const geo = new THREE.BufferGeometry(); const count=120; const pos=new Float32Array(count*3);
  for(let i=0;i<count*3;i+=3){pos[i]=(Math.random()-.5)*22;pos[i+1]=Math.random()*8+.5;pos[i+2]=(Math.random()-.5)*18;}
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const pMat = new THREE.PointsMaterial({size:.11,color:theme.particles==='SNOW'?0xe0f7fa:theme.particles==='EMBERS'?0xff6b35:0xffd08a,transparent:true,opacity:.7});
  particles=new THREE.Points(geo,pMat); scene.add(particles);
  centerCrystal = perimeter.group.getObjectByName('centerCrystal') || null;
  scene.background = new THREE.Color(theme.bg); scene.fog.color.set(theme.bg);
}

function makeProjectile(proj) {
  const group = new THREE.Group();
  const high = (proj.evolution || 1) >= 3;
  const legendary = (proj.evolution || 1) >= 4;
  const core = proj.boosted ? new THREE.Color('#ffe600') : legendary ? new THREE.Color('#ff00ff') : high ? new THREE.Color('#00ffff') : new THREE.Color('#ffaa00');
  const glow = proj.boosted ? new THREE.Color('#ff9900') : high ? new THREE.Color('#00f0ff') : new THREE.Color('#ff3300');
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.1,.12,.65,12),new THREE.MeshStandardMaterial({color:proj.boosted?0xffea00:0x222831,metalness:.9,roughness:.2,emissive:proj.boosted?0xff9900:0,emissiveIntensity:proj.boosted?.6:0})); body.rotation.x=Math.PI/2; group.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(.12,.35,12),new THREE.MeshStandardMaterial({color:core,emissive:core,emissiveIntensity:proj.boosted?1.5:.95,metalness:.7})); nose.rotation.x=Math.PI/2; nose.position.z=.45; group.add(nose);
  const finMat=new THREE.MeshStandardMaterial({color:0x393e46,metalness:.8}); const finGeo=new THREE.BoxGeometry(.04,.28,.22);
  for(let i=0;i<4;i++){const fin=new THREE.Mesh(finGeo,finMat);fin.rotation.z=i*Math.PI/2;fin.position.z=-.2;group.add(fin);}
  const jet=new THREE.Mesh(new THREE.SphereGeometry(proj.boosted?.22:.14,12,12),new THREE.MeshBasicMaterial({color:glow}));jet.position.z=-.36;group.add(jet);
  if(proj.boosted||high){const ring=new THREE.Mesh(new THREE.TorusGeometry(proj.boosted?.28:.22,.05,8,16),new THREE.MeshBasicMaterial({color:core}));ring.rotation.x=Math.PI/2;ring.position.z=.1;group.add(ring);}
  group.scale.setScalar(legendary?1.4:high?1.2:1); return group;
}

function createFx(type, x, z, color) {
  const g = new THREE.Group(); g.position.set(x, type==='EVOLUTION'?0:0.4, z);
  const c = new THREE.Color(color || '#ffffff'); let life=0, max= type==='MUZZLE'?.2:type==='HIT'?.4:type==='HEAL'?.95:type==='EVOLUTION'?1.2:.65;
  if(type==='EXPLOSION'||type==='HIT'){
    const sphere=new THREE.Mesh(new THREE.SphereGeometry(type==='EXPLOSION'?.45:.3,16,16),new THREE.MeshBasicMaterial({color:type==='EXPLOSION'?0xff4500:0xffffff,transparent:true,opacity:1}));g.add(sphere);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(type==='EXPLOSION'?.7:.45,.08,8,24),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.95}));ring.rotation.x=Math.PI/2;g.add(ring);
    const sparks=[];const geo=new THREE.SphereGeometry(.1,7,7);for(let i=0;i<(type==='EXPLOSION'?32:20);i++){const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:i%2?c:0xffea00,transparent:true,opacity:1}));g.add(m);sparks.push({m,vx:(Math.random()-.5)*10,vy:2+Math.random()*6,vz:(Math.random()-.5)*10});}
    scene.add(g);return {g,update(dt){life+=dt;const p=life/max;sphere.scale.setScalar(1+p*(type==='EXPLOSION'?4.8:3));sphere.material.opacity=Math.max(0,1-p);ring.scale.setScalar(1+p*6);ring.material.opacity=Math.max(0,1-p);for(const s of sparks){s.vy-=16*dt;s.m.position.x+=s.vx*dt;s.m.position.y+=s.vy*dt;s.m.position.z+=s.vz*dt;s.m.material.opacity=Math.max(0,1-p);}return life<max;}};
  }
  if(type==='HEAL'){
    const ring=new THREE.Mesh(new THREE.RingGeometry(.4,1.6,32),new THREE.MeshBasicMaterial({color:0x00ff88,side:THREE.DoubleSide,transparent:true,opacity:.9}));ring.rotation.x=-Math.PI/2;g.position.y=.1;g.add(ring);const orbs=[];for(let i=0;i<14;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.14,8,8),new THREE.MeshBasicMaterial({color:i%3===0?0xffea00:0x00ff88,transparent:true,opacity:1}));g.add(m);orbs.push({m,a:i/14*Math.PI*2,r:.5+Math.random()*.8,v:3+Math.random()*3.5});}scene.add(g);return {g,update(dt){life+=dt;const p=life/max;ring.scale.setScalar(1+p*.8);ring.material.opacity=1-p;orbs.forEach(o=>{o.a+=dt*6;o.m.position.y+=o.v*dt;o.m.position.x=Math.cos(o.a)*o.r;o.m.position.z=Math.sin(o.a)*o.r;o.m.material.opacity=1-p});return life<max;}};
  }
  if(type==='EVOLUTION'||type==='SPAWN'){
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.6,16,24,1,true),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.85,side:THREE.DoubleSide}));beam.position.y=8;g.add(beam);const core=new THREE.Mesh(new THREE.CylinderGeometry(.45,.6,16,16,1,true),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.95,side:THREE.DoubleSide}));core.position.y=8;g.add(core);const rings=[];for(let i=0;i<4;i++){const r=new THREE.Mesh(new THREE.TorusGeometry(1.4,.1,8,24),new THREE.MeshBasicMaterial({color:0xffea00,transparent:true,opacity:.95}));r.rotation.x=Math.PI/2;r.position.y=i*2.8;g.add(r);rings.push(r);}scene.add(g);return {g,update(dt){life+=dt;const p=life/max;beam.material.opacity=Math.sin(p*Math.PI)*.9;core.material.opacity=Math.sin(p*Math.PI)*.98;beam.rotation.y+=dt*4.5;rings.forEach((r,i)=>{r.position.y+=dt*11;if(r.position.y>15)r.position.y=0;r.rotation.z+=dt*(i%2? -3:3)});return life<max;}};
  }
  const flash=new THREE.Mesh(new THREE.SphereGeometry(.48,12,12),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:1}));g.add(flash);const ring=new THREE.Mesh(new THREE.TorusGeometry(.45,.12,8,16),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.95}));g.add(ring);scene.add(g);return {g,update(dt){life+=dt;const p=life/max;flash.scale.setScalar(1+p*2.5);flash.material.opacity=1-p;ring.scale.setScalar(1+p*2.5);ring.material.opacity=1-p;return life<max;}};
}

function ensureTank(p) {
  let g=tankMeshes.get(p.id);
  if(!g || g.userData.evolutionLevel !== (p.evolution||1)) { if(g)scene.remove(g); g=createTankMeshGroup(p); tankMeshes.set(p.id,g); scene.add(g); }
  g.position.set(p.x,0,p.z);
  g.rotation.y=-THREE.MathUtils.degToRad(p.angle||0);
  const evoScale=[1,1.25,1.45,1.7][Math.max(1,Math.min(4,p.evolution||1))-1]||1;
  g.scale.setScalar(evoScale*1.35);
  const turret=g.getObjectByName('turretGroup'); if(turret) turret.rotation.y=THREE.MathUtils.degToRad(p.angle||0);
  const hit=p.isHitFlashing;
  g.traverse(o=>{if(!(o instanceof THREE.Mesh)||!o.material||!('emissive' in o.material))return;const m=o.material;if(hit){m.emissive.set('#ffffff');m.emissiveIntensity=1;}else if(o.name==='glowAccent'){m.emissive.set(p.color);m.emissiveIntensity=1.5;}else if(o.name==='armorPlate'){m.emissive.set(p.color);m.emissiveIntensity=.12;}else if(o.name==='headlight'){m.emissive.set('#ffffff');m.emissiveIntensity=2;}else if(o.name==='taillight'){m.emissive.set('#ff1122');m.emissiveIntensity=1.8;}else{m.emissive.set('#000000');m.emissiveIntensity=0;}});
  if(p.status==='DEAD'){g.traverse(o=>{if(o instanceof THREE.Mesh&&o.material&&'emissive' in o.material){o.material.emissive.set('#1e293b');o.material.emissiveIntensity=.1;}});}
  updateLabel(p,g);
}
function updateLabel(p,g){let l=labelMap.get(p.id);if(!l){l=document.createElement('div');l.className='tank-label';l.innerHTML='<span class="name"></span><span class="hearts"></span>';labels.appendChild(l);labelMap.set(p.id,l);}l.querySelector('.name').textContent=`@${p.username} • LV${p.evolution||1}`;l.querySelector('.hearts').textContent=p.status==='DEAD'?'💀 DEFEATED':`${'❤️'.repeat(Math.max(0,p.hearts))}${'🖤'.repeat(Math.max(0,p.maxHearts-p.hearts))}`;l.style.display='block';}
function project(world){const v=new THREE.Vector3(world.x,world.y??2.8,world.z);v.project(camera);return{x:((v.x+1)/2)*innerWidth,y:((-v.y+1)/2)*innerHeight};}
function removeTank(id){const g=tankMeshes.get(id);if(g){scene.remove(g);tankMeshes.delete(id);}const l=labelMap.get(id);if(l){l.remove();labelMap.delete(id);}}
function syncProjectiles(list){const seen=new Set();for(const p of list){seen.add(p.id);let m=projectileMeshes.get(p.id);if(!m){m=makeProjectile(p);projectileMeshes.set(p.id,m);scene.add(m);shot(p.evolution||1);}m.position.set(p.x,.5,p.z);if(p.vx||p.vz)m.rotation.y=Math.atan2(p.vx,p.vz);}for(const [id,m] of projectileMeshes)if(!seen.has(id)){scene.remove(m);projectileMeshes.delete(id);}}
function spawnEffect(e){const pos=e.position||{x:0,z:0};const world={x:pos.x,z:pos.z};const visual=createFx(e.type,world.x,world.z,e.color);if(visual)fxMap.set(e.id,{...visual,e,start:performance.now()});if(e.type==='HIT')hitSound();else if(e.type==='EXPLOSION')explosionSound();else if(e.type==='HEAL')healSound();else if(e.type==='EVOLUTION'||e.type==='SPAWN')evolutionSound();}

function updateUI(s){
  const themeId=typeof s.theme==='string'?s.theme:s.theme?.id||'DESERT'; const theme=THEMES[themeId]||THEMES.DESERT;
  document.getElementById('theme').textContent=s.theme?.name||({DESERT:'Gobi Desert Battlefield',FROZEN_ICE:'Glacial Ice Outpost',VOLCANIC:'Alien Obsidian Arena'}[themeId]||'ARENA');
  document.getElementById('count').textContent=`${s.players.length}/${s.maxPlayers||4} TANKS`;
  const sec=Math.max(0,s.remaining||0); document.getElementById('timer').textContent=`${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,'0')}`;
  if(groundTheme!==themeId) buildArena(themeId);
  const active=new Set(s.players.map(p=>p.id)); for(const id of tankMeshes.keys()) if(!active.has(id)) removeTank(id);
  for(const p of s.players) ensureTank(p);
  syncProjectiles(s.projectiles||[]);
  const ids=new Set((s.effects||[]).map(e=>e.id)); for(const e of s.effects||[]) if(!prevEffectIds.has(e.id)) spawnEffect(e); prevEffectIds=ids;
  const result=document.getElementById('result'); result.innerHTML=(s.phase==='MATCH_END'||s.phase==='RESULT')&&s.winner?`<div class="result"><div class="card"><h1>🏆 @${s.winner.username}</h1><p>VICTORY • ${s.winner.kills} KILLS • ${s.winner.hearts} ❤️ • LV${s.winner.evolution}</p></div></div>`:'';
  state=s;
}

function updateOverlayPositions(){
  for(const [id,l] of labelMap){const g=tankMeshes.get(id);if(!g||!g.visible)continue;const p=project({x:g.position.x,y:2.8,z:g.position.z});l.style.left=`${p.x}px`;l.style.top=`${p.y}px`;}
  for(const [id,o] of fxMap){const age=(performance.now()-o.start)/1000;const p=project({x:o.e.position.x,y:1.2,z:o.e.position.z});o.el?.remove?.();if(age>2){fxMap.delete(id);} }
}

function tone(freq,d=.15,type='sawtooth',v=.08,end=null){if(!audioCtx)return;const n=audioCtx.currentTime,o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.setValueAtTime(freq,n);if(end)o.frequency.exponentialRampToValueAtTime(end,n+d);g.gain.setValueAtTime(v,n);g.gain.exponentialRampToValueAtTime(.001,n+d);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(n+d)}
function noise(d=.15,v=.12,low=1200){if(!audioCtx)return;const n=audioCtx.createBufferSource(),b=audioCtx.createBuffer(1,Math.max(1,audioCtx.sampleRate*d),audioCtx.sampleRate),a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;n.buffer=b;const f=b?audioCtx.createBiquadFilter():null;f.type='lowpass';f.frequency.value=low;const g=audioCtx.createGain();g.gain.setValueAtTime(v,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+d);n.connect(f);f.connect(g);g.connect(audioCtx.destination);n.start()}
function shot(l=1){tone(700+l*250,.18,l>=3?'sawtooth':'square',.11,90);tone(160,.12,'sine',.13,35)}
function hitSound(){tone(2200,.14,'triangle',.16,450);tone(240,.18,'sawtooth',.16,40);noise(.08,.1,2200)}
function explosionSound(){tone(200,.55,'sawtooth',.22,20);noise(.5,.22,1400)}
function healSound(){[523,659,784,1047].forEach((n,i)=>setTimeout(()=>tone(n,.18,'sine',.08),i*60))}
function evolutionSound(){[440,554,659,880,1108,1318].forEach((n,i)=>setTimeout(()=>tone(n,.28,'sawtooth',.08),i*80))}
function initAudio(){if(audioCtx){audioCtx.resume();return;}const C=window.AudioContext||window.webkitAudioContext;if(!C)return;audioCtx=new C;let s=0;bgmTimer=setInterval(()=>{if(audioCtx.state==='suspended')return;const b=[82,82,98,82,110,82,123,110];if(s%2===0)tone(b[(s/2)%b.length],.14,'sawtooth',.035,140);s++;},117)}
addEventListener('pointerdown',initAudio,{once:true}); addEventListener('keydown',initAudio,{once:true});

const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);
ws.onmessage=e=>{try{const msg=JSON.parse(e.data);if(msg.type==='STATE')updateUI(msg.data);}catch(err){console.error(err);}};
fetch('/api/status').then(r=>r.json()).then(updateUI).catch(()=>{});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
function animate(){requestAnimationFrame(animate);const dt=.016;clock+=dt;if(perimeter)perimeter.update(dt,clock);if(particles){const a=particles.geometry.attributes.position.array;for(let i=1;i<a.length;i+=3){a[i]-=.015;if(a[i]<0)a[i]=8;}particles.geometry.attributes.position.needsUpdate=true;}updateOverlayPositions();renderer.render(scene,camera);}animate();
