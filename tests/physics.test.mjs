import assert from 'node:assert/strict';
import {MAPS,fresh,step,height,score,stats,clamp,rings,obstacles,gapsInRange,gapAt,gripSection,bank,collectRing,damage} from '../public/game/physics.js';
import {calculateScore} from '../public/game/rules.js';
const dt=1/120,m=MAPS.city;
const run=(p,input,seconds,map=m)=>{for(let i=0;i<seconds*120;i++)step(p,input,dt,map);return p;};
let p=fresh(m);p.air=0;run(p,{},2);assert(p.s>40&&p.v>30&&!p.failed);assert(!('battery'in p)&&!('pump'in p));assert.equal(p.air,0);
const slow=structuredClone(p);run(slow,{brake:true},1);run(p,{},1);assert(slow.v<p.v/2&&slow.v>=6);
run(slow,{boost:true,lift:true},.5);assert(!slow.boost&&!slow.lift);assert.equal(slow.air,0);
for(const [seconds,air] of [[.8,8],[1.5,16],[2.3,24]]){p=fresh(m);p.s=80;p.y=height(80,m);p.v=40;p.air=40;run(p,{brake:true,steer:.25},seconds);assert.equal(p.air,40,'drift pays only on release');step(p,{},dt,m);assert.equal(p.air,40+air);assert.equal(p.drifts,1);assert(p.miniTurbo>0&&p.driftMeters>10);}
p=fresh(m);p.v=40;p.air=50;run(p,{brake:true,steer:.3},1);damage(p);step(p,{},dt,m);assert.equal(p.drifts,0);assert.equal(p.air,50,'collision cancels pending drift reward');
p=fresh(m);p.air=30;run(p,{suction:true,brake:true,steer:.5},1);assert(!p.drifting);assert(Math.abs(p.air-25)<.001,'grip costs 5 air/s');collectRing(p);assert(Math.abs(p.air-50)<.001);
p=fresh(m);for(let n=0;n<4;n++){p.invuln=0;assert(damage(p));assert(!damage(p),'invulnerability prevents repeat damage');}assert.equal(p.health,0);assert(p.failed&&p.reason==='health');
p=fresh(m);p.x=15;run(p,{},1);assert(p.failed&&p.reason==='fall');const frozen=p.s;run(p,{},3);assert.equal(p.s,frozen,'fall never respawns');
p=fresh(m);p.s=510;p.y=height(p.s,m);p.v=44;run(p,{},2);assert(p.failed&&p.reason==='fall','driving into a gap cannot snap up onto the far platform');
for(const [s,expected]of [[880,Math.PI/2],[1700,Math.PI],[2630,Math.PI]]){assert(Math.abs(bank(s)-expected)<.001);p=fresh(m);p.s=s;p.y=height(s,m);p.v=40;run(p,{},1);assert(p.failed,'wall, ceiling and helix require grip');p=fresh(m);p.s=s;p.y=height(s,m);p.v=40;run(p,{suction:true},1);assert(!p.failed&&p.grounded&&p.air<96);}
p=fresh(m);p.s=850;p.y=height(p.s,m);p.air=.2;p.v=40;run(p,{suction:true},1);assert(p.failed,'running out of grip pressure detaches the car');
p=fresh(MAPS.orbit);p.grounded=false;p.y=20;run(p,{side:1},.6,MAPS.orbit);assert(p.x>1&&p.air<96);
p=fresh(MAPS.orbit);p.grounded=false;p.y=20;run(p,{roll:1,lift:true},1.8,MAPS.orbit);assert(p.pendingRolls>=1&&p.rolls===0,'airborne rolls are not banked');run(p,{},5,MAPS.orbit);assert(p.grounded&&p.rolls>=1&&p.landings===1,'clean landing banks the roll');
p=fresh(m);p.grounded=false;p.y=height(0,m)+.01;p.vy=-1;p.roll=Math.PI;p.pendingRolls=1;run(p,{},.1);assert.equal(p.health,80);assert.equal(p.rolls,0);
// Run over three full special-section cycles, beyond every former finish line.
for(const map of Object.values(MAPS)){
 const q=fresh(map),rs=rings(map,0,10000);let minAir=100;
 while(!q.failed&&q.s<9600&&q.time<500){
  const gap=gapsInRange(map,q.s-5,q.s+50)[0],jump=gap&&q.s>gap[0]-45&&q.s<gap[1]+5;
  const ring=rs.find(r=>!r.collected&&r.s>q.s&&r.s-q.s<75),target=jump?0:ring?ring.x:0;
  step(q,{steer:clamp((target-q.x)*.65-q.vx*.5,-1,1),lift:jump&&(q.y-height(q.s,map)<4.5||q.vy<-.5),suction:!!gripSection(q.s)},dt,map);
  for(const r of rs)if(!r.collected&&Math.abs(q.s-r.s)<2.8&&Math.hypot(q.x-r.x,q.y-height(q.s,map)+.7-r.y)<2.5){r.collected=true;collectRing(q);}
  minAir=Math.min(minAir,q.air);
 }
 assert(q.s>=9600&&!q.failed,`${map.id}: ${JSON.stringify(q)}`);assert(q.gripSections>=8);assert(q.rings>12);assert.equal(score(q),calculateScore(stats(q)));
 for(let s=0;s<9600;s+=3)if(gapAt(s,map))assert(gapsInRange(map,s,s+1).length,'collision gaps must match world geometry');
 const whole=rings(map,0,9600),parts=Array.from({length:15},(_,i)=>rings(map,i*640,(i+1)*640)).flat();assert.deepEqual(parts,whole,'chunk boundaries neither duplicate nor omit rings');assert.equal(new Set(whole.map(r=>r.id)).size,whole.length);
 assert(obstacles(map,0,9600).every(o=>!gripSection(o.s)&&!gapsInRange(map,o.s-60,o.s+60).length));
 console.log(`${map.id}: ${Math.floor(q.s)} m, ${q.gripSections} anti-gravity sections, health ${q.health}, minimum air ${minAir.toFixed(1)}%`);
}
console.log('Automatic driving, brake/drift tiers, pressure, health, falls, adhesion, rolls and endless route checks passed.');
