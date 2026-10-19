import * as T from './vendor/three.module.js';
import {center,slope,height,gapAt,gapsInRange,bank,gripSection,nextGrip,obstacles,rings,roadPoint} from './physics.js';
export function pose(s,x,y,m){const p=roadPoint(s,x,y,m);return new T.Vector3(p.x,p.y,p.z);}
function sceneryPose(s,x,y,m){const a=Math.atan(slope(s,m));return new T.Vector3(center(s,m)+x*Math.cos(a),height(s,m)+y,-s+x*Math.sin(a));}
export function trackUp(s,m){const a=Math.atan(slope(s,m)),b=bank(s);return new T.Vector3(-Math.sin(b)*Math.cos(a),Math.cos(b),-Math.sin(b)*Math.sin(a));}
const CHUNK=640;
export function makeWorld(m){
 const root=new T.Group(),chunks=new Map(),collected=new Set(),passed=new Set();let current=-1;
 const view={root,ringData:[],ringMeshes:[],obstacles:[],chunkCount:0,update,collectRing(id){if(collected.has(id))return false;collected.add(id);return true;},passObstacle(id){if(passed.has(id))return false;passed.add(id);return true;}};
 function update(s){const index=Math.max(0,Math.floor(s/CHUNK));if(index===current)return;current=index;
  for(const [i,c]of chunks)if(i<index-1||i>index+2){root.remove(c.root);disposeWorld(c.root);chunks.delete(i);}
  for(let i=Math.max(0,index-1);i<=index+2;i++)if(!chunks.has(i)){const c=makeChunk(m,i);c.ringData.forEach((r,n)=>{if(collected.has(r.id)){r.collected=true;c.ringMeshes[n].visible=false;}});c.obstacles.forEach(o=>o.passed=passed.has(o.id));chunks.set(i,c);root.add(c.root);}
  const live=[...chunks.values()];view.ringData=live.flatMap(c=>c.ringData);view.ringMeshes=live.flatMap(c=>c.ringMeshes);view.obstacles=live.flatMap(c=>c.obstacles);view.chunkCount=chunks.size;
 }
 update(0);return view;
}
function makeChunk(m,index){
 const from=index===0?-80:index*CHUNK,to=(index+1)*CHUNK;
 const root=new T.Group(),batches=new Map(),dummy=new T.Object3D();
 const roadmat=new T.MeshStandardMaterial({color:m.id==='canyon'?0x383d3c:0x1b2633,roughness:.87,metalness:.12,side:T.DoubleSide,emissive:0x182433,emissiveIntensity:.25});
 function batch(key,color,emissive=0){if(!batches.has(key))batches.set(key,{entries:[],mat:new T.MeshStandardMaterial({color,roughness:.8,metalness:.15,emissive,emissiveIntensity:emissive?.65:0})});return batches.get(key);}
 function block(key,color,w,h,d,x,y,z,rot=0,emissive=0,roll=0){batch(key,color,emissive).entries.push({w,h,d,x,y,z,rot,roll});}
 function at(key,color,w,h,d,s,x,y,emissive=0){const p=pose(s,x,y,m);block(key,color,w,h,d,p.x,p.y,p.z,-Math.atan(slope(s,m)),emissive,bank(s));}
 const vertices=[],indices=[];
 for(let s=from;s<to;s+=4){if(gapAt(s+2,m))continue;const p=[pose(s,-m.width,0,m),pose(s,m.width,0,m),pose(s+4,-m.width,0,m),pose(s+4,m.width,0,m)],n=vertices.length/3;for(const v of p)vertices.push(v.x,v.y,v.z);indices.push(n,n+2,n+1,n+1,n+2,n+3);
  for(const x of [-m.width,m.width])at('edge',0x62777c,.16,.12,4.05,s+2,x,.04);
  if(gripSection(s)&&s%16===0)at('gripstripe',0xb6a3ff,m.width*2,.035,.18,s,0,.05,0xb6a3ff);
  if(s%16===0){for(const x of [-m.width+.45,m.width-.45])at('stripe',m.accent,.12,.03,9,s,x,.035,m.accent);for(const x of [-m.width/3,m.width/3])at('lane',0x62747c,.08,.02,5,s,x,.03);}
  if(s%40===0)for(const x of [-m.width-1,m.width+1]){at('post',0x57636a,.18,1.1,.18,s,x,.55);at('postlight',m.accent,.22,.08,.22,s,x,1.12,m.accent);}
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();const road=new T.Mesh(geo,roadmat);road.receiveShadow=true;root.add(road);
 const floor=new T.Mesh(new T.PlaneGeometry(700,to-from),new T.MeshStandardMaterial({color:m.id==='city'?0x101c22:m.id==='canyon'?0xa67c5b:0x050711,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.set(0,m.id==='orbit'?-60:-14,-(from+to)/2);floor.receiveShadow=true;root.add(floor);
 let seed=(42+index*7919)>>>0;function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
 if(m.id==='city'){
  for(let i=0;i<90;i++){const s=from+rnd()*(to-from),side=rnd()<.5?-1:1,x=side*(25+rnd()*140),w=7+rnd()*16,h=12+rnd()*80,d=9+rnd()*18;const p=sceneryPose(s,x,-14,m);block('building'+i%4,[0x162b36,0x203744,0x253f4a,0x122633][i%4],w,h,d,p.x,h/2-14,p.z);for(let yy=4;yy<h;yy+=5)for(let xx=-w/2+2;xx<w/2;xx+=3.5)if(rnd()>.35)block('windows'+i%2,i%2?0x83c9c6:0xe7b988,.8,1.2,.06,p.x+xx,yy-14,p.z+d/2+.02,0,i%2?0x83c9c6:0xe7b988);}
  for(let s=Math.ceil(from/64)*64;s<to;s+=64)for(const x of [-12,12]){at('lamppost',0x33434c,.2,9,.2,s,x,4.5);at('lamparm',0x33434c,3,.15,.15,s,x+(x<0?1.5:-1.5),9);at('lamp',0xd6fff1,2,.08,.3,s,x+(x<0?1.5:-1.5),8.9,0xd6fff1);}
 }else if(m.id==='canyon'){
  const rockGeom=new T.DodecahedronGeometry(1,0),rockMat=new T.MeshStandardMaterial({color:0xb97a55,roughness:1,flatShading:true}),rocks=new T.InstancedMesh(rockGeom,rockMat,160);
  for(let i=0;i<50;i++){const s=from+rnd()*(to-from),side=rnd()<.5?-1:1,p=sceneryPose(s,side*(80+rnd()*135),0,m),h=12+rnd()*70;dummy.position.set(p.x,h*.1-8,p.z);dummy.scale.set(10+rnd()*26,h,12+rnd()*40);dummy.rotation.set(rnd()*.2,rnd()*6,rnd()*.25);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);rocks.setColorAt(i,new T.Color().setHSL(.045+rnd()*.025,.31,.34+rnd()*.2));}root.add(rocks);
  for(let i=0;i<55;i++){const s=from+rnd()*(to-from),x=(rnd()<.5?-1:1)*(15+rnd()*30),p=sceneryPose(s,x,0,m);block('cactus',0x3e6655,.5,2+rnd()*3,.5,p.x,-10,p.z);}
  const sun=new T.Mesh(new T.SphereGeometry(45,16,16),new T.MeshBasicMaterial({color:0xffdbc0}));sun.position.set(-350,220,-to-350);root.add(sun);
 }else{
  const positions=[];for(let i=0;i<700;i++)positions.push((rnd()-.5)*3500,(rnd()-.3)*1600,-from-rnd()*(to-from));const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));root.add(new T.Points(g,new T.PointsMaterial({color:0xdce7ff,size:1.4,sizeAttenuation:true})));
  const planet=new T.Mesh(new T.SphereGeometry(110,24,16),new T.MeshStandardMaterial({color:0x38528c,roughness:1,metalness:.1}));planet.position.set(450,170,-to-200);root.add(planet);const halo=new T.Mesh(new T.SphereGeometry(113,24,16),new T.MeshBasicMaterial({color:0x4674b1,transparent:true,opacity:.1,side:T.BackSide}));halo.position.copy(planet.position);root.add(halo);
  const asteroid=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshStandardMaterial({color:0x6c617b,flatShading:true,roughness:1}),45);for(let i=0;i<45;i++){const s=from+rnd()*(to-from),p=sceneryPose(s,(rnd()<.5?-1:1)*(40+rnd()*120),rnd()*60-20,m),r=2+rnd()*9;dummy.position.copy(p);dummy.scale.set(r,r*.8,r*1.2);dummy.rotation.set(rnd()*6,rnd()*6,0);dummy.updateMatrix();asteroid.setMatrixAt(i,dummy.matrix);}root.add(asteroid);
  for(let s=Math.ceil(from/80)*80;s<to;s+=80)at('support',0x353448,1.5,18,2,s,0,-9);
 }
 const obstaclesData=obstacles(m,Math.max(0,from),to);
 for(const o of obstaclesData){at('obstacle',m.id==='canyon'?0x755445:0x314455,o.w,o.h,o.d,o.s,o.x,o.h/2);at('danger',0xff9a62,o.w,.12,o.d+.03,o.s,o.x,o.h-.1,0xff9a62);for(let x=-o.w/2+.5;x<o.w/2;x+=1.3)at('reflector',0xffcb7e,.38,.55,.03,o.s-o.d/2-.03,o.x+x,o.h/2,0xffcb7e);}
 const ringData=rings(m,Math.max(0,from),to),ringMeshes=[];const ringGeo=new T.TorusGeometry(2.45,.085,6,36),ringMat=new T.MeshBasicMaterial({color:m.accent});
 for(const r of ringData){const group=new T.Group(),o=new T.Mesh(ringGeo,ringMat);group.add(o);group.position.copy(pose(r.s,r.x,r.y,m));group.rotation.set(0,-Math.atan(slope(r.s,m)),bank(r.s),'YXZ');const diamond=new T.Mesh(new T.OctahedronGeometry(.28),ringMat);diamond.position.y=3;group.add(diamond);root.add(group);ringMeshes.push(group);}
 for(const [a,b]of gapsInRange(m,from-20,to+20)){for(const s of [a-12,b+2])if(s>=from&&s<to)at('gapline',0xffc378,m.width*2,.04,.5,s,0,.07,0xffc378);if(a-17>=from&&a-17<to){const sign=label('↑  JUMP / 喷气越桥',0xffc378);sign.position.copy(pose(a-17,0,5,m));root.add(sign);}}
 let next=nextGrip(Math.max(0,from-80));while(next&&next.a-55<to){const s=next.a-55;if(s>=from){const sign=label(next.name+' / 开启吸地',0xc4aeff);sign.position.copy(pose(s,0,5.5,m));root.add(sign);for(const x of [-m.width,m.width])at('gripgate',0xb4a0ff,.2,6,.2,s,x,3,0x9175ff);at('gripgate',0xb4a0ff,m.width*2,.2,.2,s,0,6,0x9175ff);}next=nextGrip(next.b);}
 if(index===0){for(const x of [-m.width,m.width])at('gate',0xa7d7cd,.35,7,.35,5,x,3.5);at('gate',0xa7d7cd,m.width*2,.3,.35,5,0,7);const sign=label('MANUAL / 手动驾驶',m.accent);sign.position.copy(pose(5,0,7.8,m));root.add(sign);}
 for(const {entries,mat}of batches.values()){const mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),mat,entries.length);entries.forEach((e,i)=>{dummy.position.set(e.x,e.y,e.z);dummy.scale.set(e.w,e.h,e.d);dummy.rotation.set(0,e.rot,e.roll,'YXZ');dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.receiveShadow=true;root.add(mesh);}
 return {root,ringData,ringMeshes,obstacles:obstaclesData};
}
function label(text,color){const c=document.createElement('canvas');c.width=768;c.height=96;const ctx=c.getContext('2d');ctx.font='600 34px Arial, sans-serif';ctx.textAlign='center';ctx.fillStyle='#'+new T.Color(color).getHexString();ctx.fillText(text,384,60);const texture=new T.CanvasTexture(c),s=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));s.scale.set(16,2,1);return s;}
export function disposeWorld(root){const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [].concat(o.material)){materials.add(m);if(m.map)textures.add(m.map);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
