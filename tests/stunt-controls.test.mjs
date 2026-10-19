import assert from 'node:assert/strict';
import {MAPS,fresh,step,height,requestRoll,rollAvailability,TAP_ROLL,damage} from '../public/game/physics.js';
const m=MAPS.city,dt=1/120;
const tick=(p,seconds,input={})=>{for(let i=0;i<seconds*120;i++)step(p,input,dt,m);};
let p=fresh(m);assert.equal(rollAvailability(p,m),'ground');assert(!requestRoll(p,1,m));assert.equal(p.air,100);
p.grounded=false;p.y=height(0,m)+.3;p.vy=1;assert.equal(rollAvailability(p,m),'low');assert(!requestRoll(p,1,m));
for(const direction of [-1,1]){
 p=fresh(m);p.grounded=false;p.y=height(0,m)+10;p.vy=5;
 assert(requestRoll(p,direction,m));assert.equal(p.air,90);assert(!requestRoll(p,-direction,m),'rapid taps cannot queue extra flips');
 tick(p,.6);assert(Math.sign(p.roll)===direction&&Math.abs(p.roll)>2);assert.equal(p.rolls,0,'points wait for landing');
 tick(p,.66);assert.equal(p.autoRoll,0);assert.equal(p.pendingRolls,1);assert.equal(p.roll,0,'single tap levels the car');assert.equal(p.air,90,'cost is charged exactly once');
 tick(p,.8);assert(p.grounded&&p.rolls===1&&p.landings===1);assert.equal(p.health,100);
}
p=fresh(m);p.grounded=false;p.y+=12;p.vy=5;p.air=TAP_ROLL.air-.1;assert.equal(rollAvailability(p,m),'air');assert(!requestRoll(p,1,m));
p.air=100;p.suction=true;assert.equal(rollAvailability(p,m),'grip');assert(!requestRoll(p,1,m));
p.suction=false;p.s=880;p.y=height(p.s,m)+12;assert.equal(rollAvailability(p,m),'grip');
p=fresh(m);p.grounded=false;p.y+=12;p.vy=5;assert(requestRoll(p,1,m));tick(p,.3);p.flight=null;p.y=height(p.s,m)+.05;p.vy=-3;tick(p,.1);assert.equal(p.autoRoll,0);assert.equal(p.rolls,0,'interrupted flip must not score');
p=fresh(m);p.grounded=false;p.y+=10;p.vy=5;p.roll=Math.PI;assert.equal(rollAvailability(p,m),'busy','upside-down is not level');
p.roll=0;assert(requestRoll(p,1,m));tick(p,.9);damage(p);tick(p,1.5,{lift:true});assert.equal(p.pendingRolls,0,'collision-cancelled flip cannot score during recovery');
for(const map of Object.values(MAPS)){
 const player=fresh(map);player.v=38;tickMap(player,.6,{lift:true},map);
 assert(requestRoll(player,-1,map),map.id+' enables flips after a normal held jump');
 for(let i=0;i<600&&!player.grounded;i++)step(player,{},dt,map);
 assert(player.grounded&&player.rolls===1&&!player.failed&&player.health===100,map.id+' completes a real jump and flip safely');
}
function tickMap(p,seconds,input,map){for(let i=0;i<seconds*120;i++)step(p,input,dt,map);}
console.log('One-tap left/right flips: one charge, no double activation, auto-level, clean-landing score, altitude/air/grip guards passed.');
