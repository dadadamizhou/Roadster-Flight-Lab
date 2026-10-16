import assert from 'node:assert/strict';
import {MAPS,fresh,step,height,score} from '../public/game/physics.js';
const dt=1/120;
let p=fresh(MAPS.city);p.air=20;p.pump=true;p.v=20;const initial=p.battery;for(let i=0;i<120;i++)step(p,{throttle:true,steer:0},dt,MAPS.city);assert(p.s>15);assert(p.air>32&&p.air<34);assert(p.battery<initial-3.4);assert(p.battery>initial-5);
p=fresh(MAPS.city);p.air=99.8;p.pump=true;for(let i=0;i<120;i++)step(p,{},dt,MAPS.city);assert.equal(p.air,100);assert.equal(p.pump,false);
p=fresh(MAPS.city);p.air=0;for(let i=0;i<120;i++)step(p,{boost:true,lift:true},dt,MAPS.city);assert.equal(p.boost,false);assert.equal(p.lift,false);assert.equal(p.air,0);
p=fresh(MAPS.city);p.s=335;p.y=height(p.s,MAPS.city);p.battery=20;for(let i=0;i<120;i++)step(p,{brake:true},dt,MAPS.city);assert(p.battery>42&&p.charging);
const normal=fresh(MAPS.city),sucked=fresh(MAPS.city);for(const q of [normal,sucked]){q.s=120;q.v=60;q.y=height(120,MAPS.city);}for(let i=0;i<90;i++){step(normal,{steer:0},dt,MAPS.city);step(sucked,{steer:0,suction:true},dt,MAPS.city);}assert(Math.abs(sucked.x)<Math.abs(normal.x));assert(sucked.battery<normal.battery);
for(const map of Object.values(MAPS)){
 const q=fresh(map);const visited=new Set();let count=0;
 while(!q.done&&!q.failed&&q.time<280){
  const near=map.stations.find(s=>q.s>s-48&&q.s<s+20&&!visited.has(s));
  let brake=false;if(near!==undefined){brake=q.s>near-24;if(q.charging&&q.battery>97){visited.add(near);brake=false;}}
  const gap=map.gaps.find(([a,b])=>q.s>a-45&&q.s<b+5);
  const lift=!!gap&&(q.y-height(q.s,map)<5.5||q.vy<-.5);
  if(q.air<40&&q.battery>22)q.pump=true;
  step(q,{auto:true,brake,lift,steer:Math.max(-1,Math.min(1,-q.x*.3-q.vx*.3)),suction:!gap&&q.battery>20},dt,map);
  if(++count>40000)break;
 }
 assert(q.done,`${map.id} not completed: ${JSON.stringify(q)}`);assert(q.collisions<3,`${map.id}: too many falls`);assert(q.battery>=0&&q.air>=0);console.log(`${map.id}: complete ${q.time.toFixed(1)}s, battery ${q.battery.toFixed(1)}%, air ${q.air.toFixed(1)}%, recoveries ${q.collisions}`);
}
console.log('Energy, pressure, suction, charging, and all 3 courses passed.');
let a=fresh(MAPS.orbit);a.grounded=false;a.y=15;for(let i=0;i<120;i++)step(a,{side:1},dt,MAPS.orbit);assert(a.x>4&&a.air<92,'lateral jets must translate and consume air');
a=fresh(MAPS.orbit);a.grounded=false;a.y=20;for(let i=0;i<240;i++)step(a,{roll:1,lift:true},dt,MAPS.orbit);assert(a.rolls>=1&&a.air<50,'a full barrel roll must consume pressure');for(let i=0;i<240;i++)step(a,{lift:true},dt,MAPS.orbit);assert(Math.abs(Math.sin(a.roll))<.08,'stabilizer should level the car');
a=fresh(MAPS.city);a.grounded=false;a.y=height(0,MAPS.city)+.01;a.vy=-1;a.roll=Math.PI;step(a,{},dt,MAPS.city);step(a,{},dt,MAPS.city);assert.equal(a.collisions,1,'inverted landing must incur a penalty');
console.log('Lateral thrust, full barrel roll, stabilization, and bad landing checks passed.');
