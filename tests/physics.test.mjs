import assert from 'node:assert/strict';
import {MAPS,fresh,step,height,slope,angleDelta,roadPoint,projectToRoad,canReattach,score,stats,clamp,rings,obstacles,gapsInRange,gapAt,gripSection,bank,collectRing,damage} from '../public/game/physics.js';
import {calculateScore} from '../public/game/rules.js';
const dt=1/120,m=MAPS.city,wide={...m,amplitude:0,width:150};
const run=(p,input,seconds,map=m)=>{for(let i=0;i<seconds*120;i++)step(p,input,dt,map);return p;};
const place=(s,map=m)=>{const p=fresh(map);p.s=p.distance=s;p.y=height(s,map);p.heading=p.travelHeading=Math.atan(slope(s,map));return p;};
let p=fresh(m);p.air=0;run(p,{},5);assert.equal(p.s,0);assert.equal(p.v,0,'no automatic motor');
run(p,{throttle:1},2);assert(p.s>40&&p.v>30&&!p.failed);assert(!('battery'in p)&&!('pump'in p));assert.equal(p.air,0);
const coast=structuredClone(p),slow=structuredClone(p);run(coast,{},1);run(slow,{brake:true},1);assert(coast.v<p.v&&coast.v>slow.v);run(slow,{brake:true},2);assert.equal(slow.v,0,'brake can stop completely');
run(slow,{boost:true,lift:true},.5);assert(!slow.boost&&!slow.lift);assert.equal(slow.air,0);
p=fresh(wide);run(p,{throttle:1},1,wide);run(p,{throttle:-1},.3,wide);assert(p.v>=0,'opposite throttle brakes before reversing');run(p,{throttle:-1},2,wide);assert(p.v< -10);const best=p.distance;run(p,{throttle:-1},1,wide);assert.equal(p.distance,best,'reverse never erases or farms distance score');
p=fresh(m);const initialHeading=p.heading;run(p,{throttle:1},3);assert.equal(p.heading,initialHeading,'curves cannot turn the car automatically');const point=roadPoint(p.s,p.x,0,m);assert(Math.abs(point.x-Math.tan(initialHeading)*p.s)<.4,'straight input holds a world trajectory, not a road-centre trajectory');
const turning=fresh(m);run(turning,{throttle:1,steer:.25},2);assert(turning.heading>initialHeading+.2,'diagonal input actually rotates the car');
for(const [seconds,air] of [[1,8],[1.7,16],[2.5,24]]){p=fresh(wide);p.v=38;p.air=40;run(p,{throttle:1,brake:true,steer:.25},seconds,wide);assert.equal(p.air,40,'drift pays only on exit');run(p,{throttle:1},.25,wide);assert.equal(p.air,40+air);assert.equal(p.drifts,1);assert(p.miniTurbo>0&&p.driftMeters>10&&p.driftSettle>0);}
p=fresh(wide);p.v=38;p.air=40;run(p,{throttle:1,brake:true,steer:.25},.2,wide);run(p,{throttle:1,steer:.25},.8,wide);assert(p.drifting,'a tap starts drift; throttle and steering sustain it without holding brake');run(p,{throttle:1},.3,wide);assert(!p.drifting&&p.drifts===1);
p=fresh(wide);p.v=38;p.air=50;run(p,{throttle:1,brake:true,steer:.3},1,wide);damage(p);step(p,{},dt,wide);assert.equal(p.drifts,0);assert.equal(p.air,50,'collision cancels pending drift reward');
p=fresh(wide);p.v=38;p.air=40;p.distance=1000;run(p,{throttle:1,brake:true,steer:.25},2.5,wide);run(p,{},.3,wide);assert.equal(p.drifts,0,'revisiting an old stretch cannot farm drift air or distance');
p=fresh(m);p.air=30;run(p,{suction:true,brake:true,steer:.5},1);assert(!p.drifting);assert(Math.abs(p.air-25)<.001);collectRing(p);assert(Math.abs(p.air-50)<.001);
p=fresh(m);for(let n=0;n<4;n++){p.invuln=0;assert(damage(p));assert(!damage(p));}assert.equal(p.health,0);assert(p.failed&&p.reason==='health');
p=fresh(m);p.x=15;run(p,{},.7);assert(!p.failed&&!p.grounded,'leaving the road offers a rescue window');run(p,{},3);assert(p.failed&&p.reason==='fall');const frozen=p.s;run(p,{},3);assert.equal(p.s,frozen);
p=fresh(m);p.grounded=false;p.x=m.width+1;p.y+=3;run(p,{side:-1},.4);run(p,{},1);assert(p.grounded&&!p.failed,'air control can recover a near-edge fall');
p=fresh(m);p.grounded=false;p.y-=4;p.vy=13;run(p,{lift:true},.5);assert(!p.grounded&&p.health<100,'the underside cannot teleport the car through the bridge');
p=place(510);p.v=44;run(p,{throttle:1},3);assert(p.failed&&p.reason==='fall','a missed jump eventually hits the lower ground');
for(const [s,expected]of [[880,Math.PI/2],[1700,Math.PI],[2630,Math.PI]]){
 assert(Math.abs(bank(s)-expected)<.001);
 p=place(s);run(p,{},.8);assert(!p.failed&&!p.grounded&&p.health===100,'grip loss beyond the former .65s deadline is recoverable');assert(canReattach(p,m));
 run(p,{suction:true},1.4);assert(p.grounded&&!p.failed&&p.health===100&&p.air<100,'nearby grip pulls back smoothly without damage');
 p=place(s);run(p,{},4);assert(p.failed&&p.reason==='fall','unrecovered car ends on actual lower-ground impact, not a grip timer');
 p=place(s);run(p,{suction:true},1);assert(!p.failed&&p.grounded);
}
p=place(1700);p.air=.2;run(p,{suction:true},.8);assert(!p.failed&&!p.grounded,'empty pressure is not instant defeat');collectRing(p);run(p,{suction:true},1.4);assert(p.grounded&&!p.failed,'restored pressure can rescue the same fall');
p=place(1700);p.grounded=false;p.y+=20;assert(!canReattach(p,m));run(p,{suction:true},.1);assert(!p.grounded,'suction has a finite reach and cannot teleport from far away');
for(const s of [855,1670,2600]){
 p=place(s);p.v=30;
 for(let i=0;i<360;i++){const steer=clamp(angleDelta(Math.atan(slope(p.s+10,m))+Math.atan(-p.x/15),p.heading)*3,-1,1);step(p,{throttle:.6,steer,suction:i>=90},dt,m);}
 assert(p.grounded&&!p.failed&&p.health===100&&p.s>s+50,'moving wall/ceiling/helix recovery preserves the run');
}
for(const map of Object.values(MAPS))for(const s of [0,90,880,1700,2630]){const point=roadPoint(s,3,4,map),projection=projectToRoad(point,s+2,map);assert(Math.abs(projection.s-s)<.001&&Math.abs(projection.x-3)<.001&&Math.abs(projection.alt-4)<.001,'world/road projection matches all bank angles');}
// Test-driver controller is deliberately outside production: gameplay has no
// path-following. Exercise every map, gap and three full track cycles manually.
for(const map of Object.values(MAPS)){
 const q=fresh(map),rs=rings(map,0,10000);let minAir=100;
 while(!q.failed&&q.s<9600&&q.time<800){
  const gap=gapsInRange(map,q.s-5,q.s+55)[0],jump=gap&&q.s>gap[0]-35&&q.s<gap[1]+5;
  const ring=rs.find(r=>!r.collected&&r.s>q.s&&r.s-q.s<75),target=jump?0:ring?ring.x:0;
  const targetHeading=Math.atan(slope(q.s+10,map))+Math.atan((target-q.x)/15);
  const steer=q.grounded?clamp(angleDelta(targetHeading,q.heading)*3,-1,1):clamp((target-q.x)*.15-q.vx*.18,-1,1);
  step(q,{throttle:.65,steer,lift:jump&&(q.y-height(q.s,map)<4.5||q.vy<-.5),suction:!!gripSection(q.s)},dt,map);
  for(const r of rs)if(!r.collected&&Math.abs(q.s-r.s)<2.8&&Math.hypot(q.x-r.x,q.y-height(q.s,map)+.7-r.y)<2.5){r.collected=true;collectRing(q);}
  minAir=Math.min(minAir,q.air);
 }
 assert(q.s>=9600&&!q.failed,`${map.id}: ${JSON.stringify(q)}`);assert(q.gripSections>=8);assert(q.rings>12);assert.equal(score(q),calculateScore(stats(q)));
 for(let s=0;s<9600;s+=3)if(gapAt(s,map))assert(gapsInRange(map,s,s+1).length);
 const whole=rings(map,0,9600),parts=Array.from({length:15},(_,i)=>rings(map,i*640,(i+1)*640)).flat();assert.deepEqual(parts,whole);assert.equal(new Set(whole.map(r=>r.id)).size,whole.length);
 assert(obstacles(map,0,9600).every(o=>!gripSection(o.s)&&!gapsInRange(map,o.s-60,o.s+60).length));
 console.log(`${map.id}: ${Math.floor(q.s)} m, ${q.gripSections} anti-gravity sections, health ${q.health}, minimum air ${minAir.toFixed(1)}%`);
}
console.log('Manual throttle/reverse, independent heading, sustained drift, spatial grip recovery, actual ground impacts and endless routes passed.');
