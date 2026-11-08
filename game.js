import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const canvas = document.querySelector('#world');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .1, 180);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const materials = {
  grass: new THREE.MeshStandardMaterial({ color: 0x86bd70, roughness: 1 }),
  dirt: new THREE.MeshStandardMaterial({ color: 0x9b805b, roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x9ba9a4, roughness: 1 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x9a704a, roughness: 1 }),
  leaves: new THREE.MeshStandardMaterial({ color: 0x5d9b68, roughness: 1 }),
  sand: new THREE.MeshStandardMaterial({ color: 0xd8c48d, roughness: 1 }),
  roof: new THREE.MeshStandardMaterial({ color: 0xc98e69, roughness: 1 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xe9d9b9, roughness: 1 }),
  water: new THREE.MeshStandardMaterial({ color: 0x74c9c4, roughness: .34, metalness: .02, transparent: true, opacity: .9 }),
  flowerPink: new THREE.MeshStandardMaterial({ color: 0xf0a8a2, roughness: .8 }),
  flowerYellow: new THREE.MeshStandardMaterial({ color: 0xf3d079, roughness: .8 }),
  flowerBlue: new THREE.MeshStandardMaterial({ color: 0x9eb7e0, roughness: .8 }),
  white: new THREE.MeshStandardMaterial({ color: 0xfff4df, roughness: .8 }),
};
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const sphereGeo = new THREE.SphereGeometry(1, 18, 14);
const blockMap = new Map();
const blocks = [];
const key = (x,y,z) => `${x},${y},${z}`;
const addBlock = (x,y,z,type,collectible=true) => {
  const id=key(x,y,z); if(blockMap.has(id)) return null;
  const mesh=new THREE.Mesh(boxGeo, materials[type] || materials.grass);
  mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true;
  mesh.userData={x,y,z,type,collectible}; scene.add(mesh); blockMap.set(id,mesh); blocks.push(mesh); return mesh;
};
const removeBlock = mesh => { if(!mesh || !mesh.userData) return; const {x,y,z}=mesh.userData; blockMap.delete(key(x,y,z)); scene.remove(mesh); const i=blocks.indexOf(mesh); if(i>=0) blocks.splice(i,1); };

// A little floating island, built one block at a time.
for(let x=-12;x<=12;x++) for(let z=-12;z<=12;z++) {
  const r=Math.sqrt((x/1.03)**2+(z/0.93)**2);
  if(r>10.9) continue;
  const edge=r>8.6;
  const top=(Math.sin(x*.55+z*.23)*.27 + Math.cos(z*.47-x*.21)*.25 + (r<3? .38:0) > .27) ? 2 : 1;
  if(r<1.6) { /* soft central rise */ }
  addBlock(x,top,z,edge?'sand':'grass',false);
  const depth = Math.max(1, Math.ceil((10.8-r)*.64));
  for(let d=1;d<=depth;d++) addBlock(x,top-d,z,d>=depth-1?'stone':'dirt',true);
}
// Floating underside layers to give the island a chunky silhouette.
for(let y=-6;y<=-3;y++){
  const rad= y===-3?7.3:y===-4?5.8:y===-5?3.8:1.9;
  for(let x=-9;x<=9;x++) for(let z=-9;z<=9;z++) if(Math.hypot(x,z)<rad && !blockMap.has(key(x,y,z))) addBlock(x,y,z,y===-3?'dirt':'stone',true);
}

// Water and the soft, distant horizon.
const water=new THREE.Mesh(new THREE.PlaneGeometry(220,220),materials.water); water.rotation.x=-Math.PI/2; water.position.y=-7.25; water.receiveShadow=true; scene.add(water);
const waterLine=new THREE.Mesh(new THREE.TorusGeometry(16.2,.12,5,80),new THREE.MeshBasicMaterial({color:0xb8ece0,transparent:true,opacity:.48})); waterLine.rotation.x=Math.PI/2; waterLine.position.y=-7.12; scene.add(waterLine);

function tree(x,z,scale=1){
  const ground=2; const trunkH=3;
  for(let y=0;y<trunkH;y++) addBlock(x,ground+y,z,'wood',true);
  const crown=[ [0,3,0],[-1,2,0],[1,2,0],[0,2,1],[0,2,-1],[-1,1,0],[1,1,0],[0,1,1],[0,1,-1],[0,0,0],[-1,0,0],[1,0,0],[0,0,1],[0,0,-1] ];
  crown.forEach(([dx,dy,dz])=>{if(Math.random()>.13)addBlock(x+dx,ground+trunkH+dy,z+dz,'leaves',true)});
  // Little square fruit-like highlights.
  if(Math.random()>.3){const f=new THREE.Mesh(boxGeo,materials.flowerYellow);f.scale.set(.18,.18,.18);f.position.set(x+1.06,ground+4,z);scene.add(f)}
}
[[ -7,-3,1],[-5,5,1], [6,-6,1],[8,2,1],[-1,-8,.9],[3,7,.9]].forEach(p=>tree(...p));

// A welcoming little cabin, with a porch and a chimney.
for(let x=3;x<=6;x++) for(let z=2;z<=5;z++) addBlock(x,2,z,'wood',false);
for(let x=3;x<=6;x++) for(let z=2;z<=5;z++) {
  if((x===3||x===6||z===2||z===5) && !(x===4&&z===2)) addBlock(x,3,z,'cream',false);
  if((x===3||x===6||z===2||z===5) && !(x===3&&z===3)) addBlock(x,4,z,'cream',false);
}
// Simple pitched roof across the complete cabin footprint.
for(let x=2;x<=7;x++) for(let z=1;z<=6;z++){
  const ridge=5-Math.abs(x-4.5);
  addBlock(x,4+Math.max(0,Math.floor(ridge*.5)),z,'roof',false);
}
for(let y=3;y<=5;y++) addBlock(6,y,5,'stone',false);
// Door and windows are simple inset colored cubes.
const doorMat=new THREE.MeshStandardMaterial({color:0x7d6146,roughness:1});
const door=new THREE.Mesh(boxGeo,doorMat);door.position.set(4,3,1.48);door.scale.set(.72,1.65,.12);scene.add(door);
const windowMat=new THREE.MeshStandardMaterial({color:0x9bd5d3,emissive:0x28413b,roughness:.2});
for(const x of [3.05,5.95]){const w=new THREE.Mesh(boxGeo,windowMat);w.position.set(x,3.55,1.47);w.scale.set(.56,.55,.09);scene.add(w)}
for(let x=3;x<=6;x++) addBlock(x,2,1,'wood',false);

// Pebbles around the grass, stepping stones, and tiny flowers.
for(let i=0;i<22;i++){
  const a=Math.random()*Math.PI*2, r=3+Math.random()*6, x=Math.round(Math.cos(a)*r), z=Math.round(Math.sin(a)*r);
  if(Math.hypot(x,z)>9 || (x>2&&x<7&&z>1&&z<6)) continue;
  const type=Math.random()>.48?'stone':'sand'; addBlock(x,2,z,type,true);
}
for(let i=0;i<24;i++){
  const x=Math.floor(Math.random()*16-8),z=Math.floor(Math.random()*16-8);
  if(Math.hypot(x,z)>8 || blockMap.has(key(x,2,z))) continue;
  const stem=new THREE.Mesh(boxGeo,materials.leaves); stem.position.set(x,2.22,z);stem.scale.set(.10,.44,.10);scene.add(stem);
  const petal=new THREE.Mesh(boxGeo,[materials.flowerPink,materials.flowerYellow,materials.flowerBlue][i%3]);petal.position.set(x,2.5,z);petal.scale.set(.25,.2,.25);scene.add(petal);
}

// Player: a cheerful, blocky little explorer.
const player=new THREE.Group(); scene.add(player);
const skin=new THREE.MeshStandardMaterial({color:0xe9b58e,roughness:.9});
const shirt=new THREE.MeshStandardMaterial({color:0x5e9f83,roughness:.95});
const pants=new THREE.MeshStandardMaterial({color:0x587b75,roughness:.95});
const dark=new THREE.MeshStandardMaterial({color:0x34574c,roughness:.9});
const face=new THREE.Mesh(boxGeo,skin); face.position.y=1.48;face.scale.set(.59,.59,.56);face.castShadow=true;player.add(face);
const body=new THREE.Mesh(boxGeo,shirt);body.position.y=.87;body.scale.set(.62,.67,.38);body.castShadow=true;player.add(body);
const legs=[];
for(const x of [-.17,.17]){const leg=new THREE.Mesh(boxGeo,pants);leg.position.set(x,.31,0);leg.scale.set(.25,.52,.3);leg.castShadow=true;player.add(leg);legs.push(leg)}
for(const x of [-.13,.13]){const eye=new THREE.Mesh(boxGeo,dark);eye.position.set(x,1.52,.286);eye.scale.set(.055,.075,.025);player.add(eye)}
const hair=new THREE.Mesh(boxGeo,dark);hair.position.set(0,1.79,-.025);hair.scale.set(.62,.18,.58);player.add(hair);
const scarf=new THREE.Mesh(boxGeo,new THREE.MeshStandardMaterial({color:0xe3bd72}));scarf.position.set(0,1.12,.205);scarf.scale.set(.25,.12,.035);player.add(scarf);
player.position.set(-1,2.5,1);

// Sun, moon, lighting, and tiny stars.
const hemi=new THREE.HemisphereLight(0xe4f7ed,0x718264,1.8); scene.add(hemi);
const sunLight=new THREE.DirectionalLight(0xffedc4,2.4);sunLight.position.set(-12,20,8);sunLight.castShadow=true;sunLight.shadow.mapSize.set(1024,1024);sunLight.shadow.camera.left=-22;sunLight.shadow.camera.right=22;sunLight.shadow.camera.top=22;sunLight.shadow.camera.bottom=-22;sunLight.shadow.bias=-.0006;scene.add(sunLight);
const sun=new THREE.Mesh(sphereGeo,new THREE.MeshBasicMaterial({color:0xffe6a2}));sun.scale.setScalar(1.45);scene.add(sun);
const moon=new THREE.Mesh(sphereGeo,new THREE.MeshBasicMaterial({color:0xe4ecff}));moon.scale.setScalar(.9);scene.add(moon);
const starGeo=new THREE.BufferGeometry(), starPos=[];
for(let i=0;i<150;i++){const a=Math.random()*Math.PI*2, y=12+Math.random()*45, r=45+Math.random()*25;starPos.push(Math.cos(a)*r,y,Math.sin(a)*r)}
starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3));
const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xf7f4df,size:.22,transparent:true,opacity:0}));scene.add(stars);

// Fluffy voxel clouds drift across the far horizon.
const clouds=[];
for(let i=0;i<7;i++){
  const g=new THREE.Group(); const cloudMat=new THREE.MeshStandardMaterial({color:0xf4fff3,roughness:1,transparent:true,opacity:.78});
  for(const [x,y,z,s] of [[0,0,0,1.7],[1.2,.12,0,1.25],[-1.2,.05,0,1.25],[.5,.65,0,1.05],[-.5,.5,0,1]]){const c=new THREE.Mesh(boxGeo,cloudMat);c.position.set(x,y,z);c.scale.set(s,s*.56,s*.72);g.add(c)}
  g.position.set((i-3)*18,14+Math.random()*6,-20-Math.random()*13);scene.add(g);clouds.push(g);
}

const raycaster=new THREE.Raycaster();raycaster.far=9;
let yaw=-.72, pitch=.66, dragging=false, movedPointer=false, lastX=0,lastY=0;
let toastTimer, started=false, muted=false, audioCtx=null;
const inventory={grass:20,dirt:16,stone:16,wood:12,leaves:12};
const gathered={wood:0,stone:0};
const selectedType=()=>document.querySelector('.slot.selected')?.dataset.item||'grass';
const showToast=text=>{const el=document.querySelector('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1900)};
function blip(freq=540){if(muted)return;try{audioCtx ||= new AudioContext();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=freq;o.type='sine';g.gain.setValueAtTime(.035,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.12);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+.12)}catch{}}
function refreshQuest(){const total=gathered.wood+gathered.stone;document.querySelector('#woodCount').textContent=gathered.wood;document.querySelector('#stoneCount').textContent=gathered.stone;document.querySelector('#questCount').textContent=`${Math.min(total,12)} / 12`;document.querySelector('#questProgress').style.width=`${Math.min(100,total/12*100)}%`;if(total>=12)document.querySelector('.quest-status').textContent='COMPLETE'}
function getGroundY(x,z){for(let yy=5;yy>=-5;yy--){const block=blockMap.get(key(Math.round(x),yy,Math.round(z)));if(block&&['grass','sand','dirt','stone'].includes(block.userData.type))return yy+.5}return 2.5}
const keys={};
addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&jump<=0)jump=.38;keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();const n=Number(e.key);if(n>=1&&n<=5)selectSlot(n-1);if(e.code==='KeyE')gather();if(e.code==='Escape')document.querySelector('#helpModal').classList.remove('open')});
addEventListener('keyup',e=>keys[e.code]=false);
function selectSlot(index){document.querySelectorAll('.slot').forEach((s,i)=>s.classList.toggle('selected',i===index));}
document.querySelectorAll('.slot').forEach((slot,i)=>slot.addEventListener('click',()=>selectSlot(i)));
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragging=true;movedPointer=false;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture?.(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;if(Math.abs(dx)+Math.abs(dy)>2)movedPointer=true;yaw-=dx*.006;pitch=Math.max(.2,Math.min(.85,pitch+dy*.004));lastX=e.clientX;lastY=e.clientY});
canvas.addEventListener('pointerup',e=>{dragging=false;if(!movedPointer&&e.button===0)gather()});
canvas.addEventListener('contextmenu',e=>{e.preventDefault();placeBlock()});
function centerHit(){raycaster.setFromCamera(new THREE.Vector2(0,0),camera);return raycaster.intersectObjects(blocks,false)[0]}
function gather(){const hit=centerHit();if(!hit)return showToast('Try looking a little closer ✦');const m=hit.object;const type=m.userData.type;if(type==='grass'||type==='sand')return showToast('Soft earth and sand are island things 🌱');removeBlock(m);inventory[type]=(inventory[type]||0)+1;if(type==='wood')gathered.wood++;if(type==='stone')gathered.stone++;refreshQuest();blip(type==='stone'?350:640);showToast(type==='wood'?'✦ +1 wood':type==='stone'?'✦ +1 stone':`✦ +1 ${type}`);}
function placeBlock(){const hit=centerHit();if(!hit)return showToast('Aim at a nearby block to build');const type=selectedType();if((inventory[type]||0)<=0)return showToast(`Out of ${type} blocks!`);const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);const p=hit.object.position.clone().add(normal);const x=Math.round(p.x),y=Math.round(p.y),z=Math.round(p.z);if(y<2||Math.hypot(x,z)>10.4|| (Math.abs(x-player.position.x)<.65&&Math.abs(z-player.position.z)<.65&&y<4))return showToast('There is no room right there');if(blockMap.has(key(x,y,z)))return;addBlock(x,y,z,type,true);inventory[type]--;blip(430);showToast(`A little ${type} block, just for you`)}

// Mouse / touch helpers and game UI.
document.querySelector('#startBtn').addEventListener('click',()=>{started=true;document.querySelector('#startBtn span:first-child').textContent='HAVE A LOVELY TIME';showToast('Welcome to your island ✦');blip(720)});
document.querySelector('#helpBtn').addEventListener('click',()=>document.querySelector('#helpModal').classList.add('open'));
document.querySelector('#closeHelp').addEventListener('click',()=>document.querySelector('#helpModal').classList.remove('open'));
document.querySelector('#modalPlay').addEventListener('click',()=>{document.querySelector('#helpModal').classList.remove('open');document.querySelector('#startBtn').click()});
document.querySelector('#soundBtn').addEventListener('click',e=>{muted=!muted;e.currentTarget.textContent=muted?'♪':'♫';showToast(muted?'Sound off':'Sound on')});
document.querySelector('#mobileGather').addEventListener('click',gather);document.querySelector('#mobileBuild').addEventListener('click',placeBlock);
const moveButtons=document.querySelectorAll('[data-move]');moveButtons.forEach(b=>{const k={forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD'}[b.dataset.move];b.addEventListener('pointerdown',e=>{e.preventDefault();keys[k]=true;b.setPointerCapture(e.pointerId)});['pointerup','pointercancel','lostpointercapture'].forEach(evt=>b.addEventListener(evt,()=>keys[k]=false))});

let elapsed=0, previous=performance.now(), walking=0, jump=0;
function updateWorldLighting(dt){elapsed+=dt;const cycle=(elapsed/150+.27)%1;const daylight=(Math.sin(cycle*Math.PI*2-Math.PI/2)+1)/2;const warm=Math.max(0,1-Math.abs(daylight-.42)*3.2);
  const dayColor=new THREE.Color(0x9ddbd8), duskColor=new THREE.Color(0xf0b58a), nightColor=new THREE.Color(0x283959);
  let sky=dayColor.clone().lerp(duskColor,warm*.76).lerp(nightColor,Math.max(0,(.34-daylight)*1.5));scene.background=sky;scene.fog=new THREE.Fog(sky,34,88);
  hemi.intensity=.55+daylight*1.35;hemi.color.set(daylight>.35?0xe4f7ed:0x9baed9);hemi.groundColor.set(daylight>.35?0x718264:0x45496a);
  sunLight.intensity=.24+daylight*2.35;sunLight.color.set(warm>.35?0xffc991:0xffedc4);sunLight.position.set(Math.cos(cycle*Math.PI*2)*28,4+daylight*22,Math.sin(cycle*Math.PI*2)*24);
  const orbit=cycle*Math.PI*2;sun.position.set(Math.cos(orbit)*34,Math.sin(orbit)*25+7,-25);moon.position.set(-Math.cos(orbit)*32,-Math.sin(orbit)*23+8,-22);
  stars.material.opacity=Math.max(0,(.32-daylight)*2.1);stars.visible=stars.material.opacity>.01;
  const night=daylight<.24;document.querySelector('#weatherIcon').textContent=night?'☾':warm>.45?'☼':'☀';document.querySelector('#weatherName').textContent=night?'Starlit night':warm>.45?'Golden hour':'Clear skies';document.querySelector('#weatherTemp').textContent=night?'16° · All is quiet':warm>.45?'22° · Clear skies':'24° · Clear skies';document.querySelector('#dayIndicator').style.left=`${Math.max(4,Math.min(96,cycle*100))}%`;
  clouds.forEach((c,i)=>{c.position.x+=dt*(.18+i*.018);if(c.position.x>48)c.position.x=-48});water.position.y=-7.25+Math.sin(elapsed*.35)*.045;
}
function animate(now){requestAnimationFrame(animate);const dt=Math.min(.04,(now-previous)/1000);previous=now;updateWorldLighting(dt);
  let forward=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0), side=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);
  if(forward||side){const len=Math.hypot(forward,side);forward/=len;side/=len;const speed=4.2;const dx=(Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed*dt,dz=(Math.cos(yaw)*forward-Math.sin(yaw)*side)*speed*dt;const nx=player.position.x+dx,nz=player.position.z+dz;if(Math.hypot(nx,nz)<9.15){player.position.x=nx;player.position.z=nz;player.rotation.y=Math.atan2(dx,dz);walking+=dt*10;legs[0].rotation.x=Math.sin(walking)*.52;legs[1].rotation.x=-Math.sin(walking)*.52}else{showToast('The little island ends just over there 🌊')}}else{legs.forEach(l=>l.rotation.x*=.8)}
  const floorY=getGroundY(player.position.x,player.position.z);let hop=0;if(jump>0){const t=1-jump/.38;hop=Math.sin(t*Math.PI)*.72;jump=Math.max(0,jump-dt)}player.position.y=floorY+hop;
  const target=new THREE.Vector3(player.position.x,player.position.y+2.25,player.position.z);
  const dist=24;const desired=new THREE.Vector3(target.x+Math.sin(yaw)*Math.cos(pitch)*dist,target.y+Math.sin(pitch)*dist,target.z+Math.cos(yaw)*Math.cos(pitch)*dist);
  camera.position.lerp(desired,.09);camera.lookAt(target);
  sunLight.target.position.set(player.position.x,0,player.position.z);sunLight.target.updateMatrixWorld();
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.65))});
