import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

export function createTankMeshGroup(player) {
  const group = new THREE.Group();
  group.userData.evolutionLevel = player.evolution || 1;
  const teamColor = new THREE.Color(player.color);
  const darkMetalColor = new THREE.Color('#1a1f29');
  const gunmetalColor = new THREE.Color('#2d3644');
  const baseFrameMat = new THREE.MeshStandardMaterial({ color: darkMetalColor, roughness: 0.35, metalness: 0.75 });
  const armorPlateMat = new THREE.MeshStandardMaterial({ color: teamColor, emissive: teamColor, emissiveIntensity: 0.12, roughness: 0.22, metalness: 0.45 });
  const neonAccentMat = new THREE.MeshStandardMaterial({ color: teamColor, emissive: teamColor, emissiveIntensity: 1.5, roughness: 0.05, metalness: 0.2 });
  const treadMat = new THREE.MeshStandardMaterial({ color: 0x101317, roughness: 0.95, metalness: 0.15 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x323b49, roughness: 0.4, metalness: 0.65 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x8898aa, roughness: 0.2, metalness: 0.9 });
  const cannonMat = new THREE.MeshStandardMaterial({ color: gunmetalColor, metalness: 0.85, roughness: 0.25 });
  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.5, roughness: 0.1 });
  const taillightMat = new THREE.MeshStandardMaterial({ color: 0xff1122, emissive: 0xff1122, emissiveIntensity: 2.0, roughness: 0.1 });

  const addRoadWheels = (targetGroup, zPositions, xOffset, radius = 0.16, y = 0.16) => {
    const wheelGeo = new THREE.CylinderGeometry(radius, radius, 0.07, 10);
    const hubGeo = new THREE.CylinderGeometry(radius * 0.45, radius * 0.45, 0.08, 8);
    for (const z of zPositions) {
      const wLeft = new THREE.Mesh(wheelGeo, wheelMat); wLeft.rotation.z = Math.PI / 2; wLeft.position.set(-xOffset, y, z);
      const hLeft = new THREE.Mesh(hubGeo, hubMat); hLeft.rotation.z = Math.PI / 2; hLeft.position.set(-xOffset - 0.01, y, z);
      const wRight = new THREE.Mesh(wheelGeo, wheelMat); wRight.rotation.z = Math.PI / 2; wRight.position.set(xOffset, y, z);
      const hRight = new THREE.Mesh(hubGeo, hubMat); hRight.rotation.z = Math.PI / 2; hRight.position.set(xOffset + 0.01, y, z);
      targetGroup.add(wLeft, hLeft, wRight, hRight);
    }
  };

  const level = player.evolution || 1;
  if (level === 1) {
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.38, 1.8), baseFrameMat); chassis.position.y = 0.26; group.add(chassis);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.12, 0.65), armorPlateMat); hood.name='armorPlate'; hood.rotation.x=-Math.PI/9; hood.position.set(0,0.42,0.62); group.add(hood);
    const chevron = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.04,0.3),neonAccentMat); chevron.name='glowAccent'; chevron.rotation.x=-Math.PI/9; chevron.position.set(0,0.49,0.62); group.add(chevron);
    const stripeGeo = new THREE.BoxGeometry(0.06,0.08,1.4);
    for (const x of [-0.69,0.69]) { const s=new THREE.Mesh(stripeGeo,neonAccentMat); s.name='glowAccent'; s.position.set(x,0.32,0); group.add(s); }
    for (const x of [-0.55,0.55]) { const h=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.08,0.06),headlightMat); h.name='headlight'; h.position.set(x,0.32,0.92); group.add(h); const t=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.06,0.05),taillightMat); t.name='taillight'; t.position.set(x,0.32,-0.91); group.add(t); }
    for (const x of [-0.84,0.84]) { const t=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.36,1.95),treadMat); t.position.set(x,0.19,0); group.add(t); }
    addRoadWheels(group,[-0.65,-0.22,0.22,0.65],0.98,0.15,0.18);
    const turretGroup=new THREE.Group(); turretGroup.name='turretGroup'; turretGroup.position.set(0,0.52,0);
    const collar=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.65,0.1,14),baseFrameMat); collar.position.y=0.06; turretGroup.add(collar);
    const dome=new THREE.Mesh(new THREE.CylinderGeometry(0.52,0.64,0.32,16),armorPlateMat); dome.name='armorPlate'; dome.position.y=0.22; turretGroup.add(dome);
    const hatch=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,0.08,12),baseFrameMat); hatch.position.set(-0.1,0.38,-0.1); turretGroup.add(hatch);
    const cannon=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,1.35,12),cannonMat); cannon.rotation.x=Math.PI/2; cannon.position.set(0,0.22,0.88); turretGroup.add(cannon);
    const muzzle=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.12,12),neonAccentMat); muzzle.name='glowAccent'; muzzle.rotation.x=Math.PI/2; muzzle.position.set(0,0.22,1.56); turretGroup.add(muzzle); group.add(turretGroup);
  } else if (level === 2) {
    const chassis=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.44,2.1),baseFrameMat); chassis.position.y=0.3; group.add(chassis);
    const plow=new THREE.Mesh(new THREE.BoxGeometry(1.35,0.2,0.75),armorPlateMat); plow.name='armorPlate'; plow.rotation.x=-Math.PI/6; plow.position.set(0,0.44,0.88); group.add(plow);
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.04,0.25),neonAccentMat); stripe.name='glowAccent'; stripe.rotation.x=-Math.PI/6; stripe.position.set(0,0.52,0.88); group.add(stripe);
    const skirtGeo=new THREE.BoxGeometry(0.08,0.28,1.95); for(const x of [-1.08,1.08]){const s=new THREE.Mesh(skirtGeo,armorPlateMat);s.name='armorPlate';s.position.set(x,0.28,0);group.add(s)}
    const sStripeGeo=new THREE.BoxGeometry(0.04,0.06,1.85); for(const x of [-1.13,1.13]){const s=new THREE.Mesh(sStripeGeo,neonAccentMat);s.name='glowAccent';s.position.set(x,0.34,0);group.add(s)}
    for(const x of [-0.65,0.65]){const h=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.09,0.06),headlightMat);h.name='headlight';h.position.set(x,0.36,1.06);group.add(h);const t=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.06,0.05),taillightMat);t.name='taillight';t.position.set(x,0.36,-1.06);group.add(t)}
    for(const x of [-0.92,0.92]){const t=new THREE.Mesh(new THREE.BoxGeometry(0.36,0.4,2.2),treadMat);t.position.set(x,0.21,0);group.add(t)} addRoadWheels(group,[-0.75,-0.38,0,0.38,0.75],1.07,0.16,0.2);
    const turretGroup=new THREE.Group();turretGroup.name='turretGroup';turretGroup.position.set(0,0.58,0);const collar=new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.75,0.1,16),baseFrameMat);collar.position.y=0.06;turretGroup.add(collar);const dome=new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.76,0.38,16),armorPlateMat);dome.name='armorPlate';dome.position.y=0.25;turretGroup.add(dome);
    const cGeo=new THREE.CylinderGeometry(0.09,0.09,1.45,12);[-0.24,0.24].forEach(x=>{const c=new THREE.Mesh(cGeo,cannonMat);c.rotation.x=Math.PI/2;c.position.set(x,0.25,0.95);turretGroup.add(c);const m=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.11,12),neonAccentMat);m.name='glowAccent';m.rotation.x=Math.PI/2;m.position.set(x,0.25,1.66);turretGroup.add(m)});
    const podGeo=new THREE.BoxGeometry(0.28,0.28,0.5);[-0.68,0.68].forEach(x=>{const p=new THREE.Mesh(podGeo,baseFrameMat);p.position.set(x,0.32,0.05);turretGroup.add(p);const tip=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.12,8),neonAccentMat);tip.name='glowAccent';tip.rotation.x=Math.PI/2;tip.position.set(x,0.32,0.33);turretGroup.add(tip)});group.add(turretGroup);
  } else if (level === 3) {
    const chassis=new THREE.Mesh(new THREE.BoxGeometry(1.75,0.46,2.3),baseFrameMat);chassis.position.y=0.34;group.add(chassis);
    const wedge=new THREE.Mesh(new THREE.ConeGeometry(0.9,0.85,4),armorPlateMat);wedge.name='armorPlate';wedge.rotation.x=Math.PI/2;wedge.rotation.z=Math.PI/4;wedge.position.set(0,0.42,1.25);group.add(wedge);
    const wingGeo=new THREE.BoxGeometry(0.5,0.1,1.7);for(const [x,r] of [[-1.18,-Math.PI/14],[1.18,Math.PI/14]]){const w=new THREE.Mesh(wingGeo,armorPlateMat);w.name='armorPlate';w.rotation.z=r;w.position.set(x,0.44,-0.1);group.add(w)}
    const edgeGeo=new THREE.BoxGeometry(0.06,0.12,1.72);for(const [x,r] of [[-1.43,-Math.PI/14],[1.43,Math.PI/14]]){const e=new THREE.Mesh(edgeGeo,neonAccentMat);e.name='glowAccent';e.rotation.z=r;e.position.set(x,0.47,-0.1);group.add(e)}
    const turbineGeo=new THREE.CylinderGeometry(0.22,0.26,0.65,14);for(const x of [-0.55,0.55]){const t=new THREE.Mesh(turbineGeo,cannonMat);t.rotation.x=Math.PI/2;t.position.set(x,0.42,-1.15);group.add(t);const n=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,0.1,12),new THREE.MeshBasicMaterial({color:0x00ffff}));n.rotation.x=Math.PI/2;n.position.set(x,0.42,-1.48);group.add(n)}
    for(const x of [-0.98,0.98]){const t=new THREE.Mesh(new THREE.BoxGeometry(0.38,0.42,2.3),treadMat);t.position.set(x,0.22,0);group.add(t)} addRoadWheels(group,[-0.8,-0.4,0,0.4,0.8],1.15,0.17,0.22);
    const turretGroup=new THREE.Group();turretGroup.name='turretGroup';turretGroup.position.set(0,0.64,0);const collar=new THREE.Mesh(new THREE.CylinderGeometry(0.75,0.82,0.12,16),baseFrameMat);collar.position.y=0.06;turretGroup.add(collar);const dome=new THREE.Mesh(new THREE.CylinderGeometry(0.68,0.8,0.42,18),armorPlateMat);dome.name='armorPlate';dome.position.y=0.28;turretGroup.add(dome);const halo=new THREE.Mesh(new THREE.TorusGeometry(0.85,0.04,8,24),neonAccentMat);halo.name='glowAccent';halo.rotation.x=Math.PI/2;halo.position.y=0.35;turretGroup.add(halo);
    const cGeo=new THREE.CylinderGeometry(0.1,0.1,1.7,14);const specs=[[-0.28,0.28,1.05,-0.28,0.28,1.88],[0,0.35,1.15,0,0.35,1.98],[0.28,0.28,1.05,0.28,0.28,1.88]];specs.forEach(v=>{const c=new THREE.Mesh(cGeo,cannonMat);c.rotation.x=Math.PI/2;c.position.set(v[0],v[1],v[2]);turretGroup.add(c);const m=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.13,0.12,12),neonAccentMat);m.name='glowAccent';m.rotation.x=Math.PI/2;m.position.set(v[3],v[4],v[5]);turretGroup.add(m)});
    const core=new THREE.Mesh(new THREE.OctahedronGeometry(0.26),neonAccentMat);core.name='glowAccent';core.position.set(0,0.56,0.08);turretGroup.add(core);group.add(turretGroup);
  } else {
    const chassis=new THREE.Mesh(new THREE.BoxGeometry(2.0,0.54,2.5),baseFrameMat);chassis.position.y=0.38;group.add(chassis);
    const plow=new THREE.Mesh(new THREE.BoxGeometry(1.75,0.26,0.85),armorPlateMat);plow.name='armorPlate';plow.rotation.x=-Math.PI/5;plow.position.set(0,0.5,1.2);group.add(plow);
    const plowStripe=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.04,0.3),neonAccentMat);plowStripe.name='glowAccent';plowStripe.rotation.x=-Math.PI/5;plowStripe.position.set(0,0.58,1.2);group.add(plowStripe);
    const qGeo=new THREE.BoxGeometry(0.42,0.44,1.15);for(const [x,z] of [[-1.15,0.75],[1.15,0.75],[-1.15,-0.75],[1.15,-0.75]]){const t=new THREE.Mesh(qGeo,treadMat);t.position.set(x,0.23,z);group.add(t)}
    const capGeo=new THREE.BoxGeometry(0.46,0.12,1.2);for(const [x,z] of [[-1.15,0.75],[1.15,0.75],[-1.15,-0.75],[1.15,-0.75]]){const c=new THREE.Mesh(capGeo,neonAccentMat);c.name='glowAccent';c.position.set(x,0.48,z);group.add(c)} addRoadWheels(group,[0.55,0.95],1.34,0.16,0.22);addRoadWheels(group,[-0.95,-0.55],1.34,0.16,0.22);
    const turretGroup=new THREE.Group();turretGroup.name='turretGroup';turretGroup.position.set(0,0.72,0);const collar=new THREE.Mesh(new THREE.CylinderGeometry(0.85,0.95,0.14,20),baseFrameMat);collar.position.y=0.08;turretGroup.add(collar);const dome=new THREE.Mesh(new THREE.CylinderGeometry(0.8,0.94,0.48,20),armorPlateMat);dome.name='armorPlate';dome.position.y=0.32;turretGroup.add(dome);
    const cGeo=new THREE.CylinderGeometry(0.1,0.1,1.85,14);[-0.42,-0.14,0.14,0.42].forEach((bx,i)=>{const by=[0.26,0.36,0.36,0.26][i],bz=[1.1,1.25,1.25,1.1][i];const c=new THREE.Mesh(cGeo,cannonMat);c.rotation.x=Math.PI/2;c.position.set(bx,by,bz);turretGroup.add(c);const m=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.13,0.12,12),neonAccentMat);m.name='glowAccent';m.rotation.x=Math.PI/2;m.position.set(bx,by,bz+0.91);turretGroup.add(m)});
    const launcherGeo=new THREE.BoxGeometry(0.38,0.38,0.6);for(const x of [-0.88,0.88]){const l=new THREE.Mesh(launcherGeo,baseFrameMat);l.position.set(x,0.42,0.1);turretGroup.add(l)}
    const crown=new THREE.Mesh(new THREE.TorusGeometry(1.0,0.05,8,32),neonAccentMat);crown.name='glowAccent';crown.rotation.x=Math.PI/2;crown.position.y=0.68;turretGroup.add(crown);group.add(turretGroup);
  }

  const aura=new THREE.Mesh(new THREE.RingGeometry(1.2,1.38,32),new THREE.MeshBasicMaterial({color:teamColor,side:THREE.DoubleSide,transparent:true,opacity:0.65}));aura.rotation.x=-Math.PI/2;aura.position.y=0.02;group.add(aura);
  const tickGeo=new THREE.BoxGeometry(0.06,0.02,0.35),tickMat=new THREE.MeshBasicMaterial({color:teamColor});
  const tickN=new THREE.Mesh(tickGeo,tickMat);tickN.position.set(0,0.02,1.3);const tickS=new THREE.Mesh(tickGeo,tickMat);tickS.position.set(0,0.02,-1.3);const tickW=new THREE.Mesh(tickGeo,tickMat);tickW.rotation.y=Math.PI/2;tickW.position.set(-1.3,0.02,0);const tickE=new THREE.Mesh(tickGeo,tickMat);tickE.rotation.y=Math.PI/2;tickE.position.set(1.3,0.02,0);group.add(tickN,tickS,tickW,tickE);
  return group;
}
