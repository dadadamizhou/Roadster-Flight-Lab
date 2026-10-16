import { AIR, DRIFT_TIERS, calculateScore } from './rules.js';
export const MAPS = {
 city:{id:'city',name:'霓虹都市',en:'NEON DISTRICT',length:2400,gravity:16,width:10,amplitude:35,period:125,gaps:[[520,542],[1340,1364]],accent:0x8bf7d0,fog:0x111f2d},
 canyon:{id:'canyon',name:'赤岩峡谷',en:'RED CANYON',length:2400,gravity:16,width:9,amplitude:62,period:105,gaps:[[300,325],[1340,1372],[2180,2208]],accent:0xffbb76,fog:0xb98f72},
 orbit:{id:'orbit',name:'近地轨道',en:'LOW EARTH ORBIT',length:2400,gravity:5,width:9,amplitude:45,period:145,gaps:[[280,328],[1320,1375],[2180,2240]],accent:0xb3a1ff,fog:0x060817}
};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const phase=(s,m)=>(s%m.length+m.length)%m.length;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
// Flat approaches leave time to collect air and engage grip before the road turns.
const BANKS=[{a:760,b:1000,angle:Math.PI/2,name:'90° 侧墙'}, {a:1560,b:1840,angle:Math.PI,name:'180° 倒挂'}, {a:2460,b:2800,angle:Math.PI*2,name:'360° 螺旋'}];
export function gripSection(s){if(s<0)return null;const cycle=Math.floor(s/3200),v=s-cycle*3200;const b=BANKS.find(b=>v>=b.a&&v<b.b);return b?{...b,a:b.a+cycle*3200,b:b.b+cycle*3200,id:cycle+':'+b.a}:null;}
export function nextGrip(s){const cycle=Math.max(0,Math.floor(s/3200));for(let i=cycle;i<=cycle+1;i++)for(const b of BANKS)if(i*3200+b.a>s)return {...b,a:i*3200+b.a,b:i*3200+b.b,id:i+':'+b.a};}
export function bank(s){const b=gripSection(s);if(!b)return 0;const t=(s-b.a)/(b.b-b.a);return b.angle===Math.PI*2?Math.PI*2*smooth(t):b.angle*smooth(Math.min(t,1-t)/.28);}
export function needsGrip(s){return Math.cos(bank(s))<.82;}
export function center(s,m){return m.amplitude*(Math.sin(s/m.period)-.3*Math.sin(s/(m.period*.52)));}
export function slope(s,m){return (center(s+1,m)-center(s-1,m))/2;}
export function height(s,m){const b=gripSection(s),rise=b?14*Math.sin(Math.PI*(s-b.a)/(b.b-b.a))**2:0;return rise+(m.id==='canyon'?5+4*Math.sin(s/150)+1.5*Math.sin(s/53):m.id==='orbit'?5+3*Math.sin(s/170):3);}
function gapAllowed(a,b){return !gripSection(a-40)&&!gripSection(b+40)&&!gripSection((a+b)/2);}
export function gapAt(s,m){if(s<=0)return false;const cycle=Math.floor(s/m.length),v=phase(s,m);return m.gaps.some(([a,b])=>v>a&&v<b&&gapAllowed(a+cycle*m.length,b+cycle*m.length));}
export function gapsInRange(m,from,to){const out=[];for(let k=Math.max(0,Math.floor(from/m.length));k<=Math.floor(to/m.length);k++)for(const [a,b]of m.gaps){const x=a+k*m.length,y=b+k*m.length;if(y>=from&&x<to&&gapAllowed(x,y))out.push([x,y]);}return out;}
export function stats(p){return {distance:p.s,time:p.time,rings:p.rings,collisions:p.collisions,landings:p.landings,driftMeters:p.driftMeters,drifts:p.drifts,rolls:p.rolls,nearMisses:p.nearMisses,gripSections:p.gripSections,comboBonus:p.comboBonus};}
export function score(p){return calculateScore(stats(p));}
export function fresh(m){return {s:0,x:0,v:0,vx:0,y:height(0,m),vy:0,health:100,air:100,time:0,rings:0,landings:0,collisions:0,suction:false,boost:false,lift:false,grounded:true,airtime:0,invuln:0,failed:false,reason:'',side:0,roll:0,rollRate:0,rolls:0,pendingRolls:0,rollMark:0,rolling:false,drifting:false,driftTime:0,driftRun:0,driftTier:-1,driftMeters:0,drifts:0,miniTurbo:0,combo:0,comboTime:0,comboBonus:0,nearMisses:0,gripSections:0,gripRun:null,gripClean:false,detached:0,event:null,eventId:0};}
function award(p,message){p.combo=p.comboTime>0?Math.min(5,p.combo+1):1;p.comboTime=5;p.comboBonus+=(p.combo-1)*100;p.event={id:++p.eventId,message};}
export function collectRing(p){if(p.failed)return;p.rings++;p.air=clamp(p.air+AIR.ring,0,100);award(p,'穿环 +150 · 气压 +25%');}
export function nearMiss(p){p.nearMisses++;award(p,'极限擦身 +250');}
function resetDrift(p){p.drifting=false;p.driftTime=0;p.driftRun=0;p.driftTier=-1;}
export function damage(p,amount=25){if(p.failed||p.invuln>0)return false;p.health=Math.max(0,p.health-amount);p.collisions++;p.v*=.55;p.invuln=1.15;p.combo=0;p.comboTime=0;p.pendingRolls=0;p.gripClean=false;resetDrift(p);if(p.health===0){p.failed=true;p.reason='health';}return true;}
function endDrift(p,clean){if(clean&&p.driftTier>=0){const tier=DRIFT_TIERS[p.driftTier];p.driftMeters+=p.driftRun;p.drifts++;p.air=clamp(p.air+tier.air,0,100);p.miniTurbo=tier.turbo;award(p,tier.name+' +'+Math.floor(p.driftRun*4)+' · 气压 +'+tier.air+'%');}resetDrift(p);}
export function step(p,input,dt,m){
 if(p.failed)return;
 p.time+=dt;p.invuln=Math.max(0,p.invuln-dt);p.comboTime=Math.max(0,p.comboTime-dt);if(!p.comboTime)p.combo=0;p.miniTurbo=Math.max(0,p.miniTurbo-dt);
 const previousClearance=p.y-height(p.s,m),steer=clamp(input.steer||0,-1,1),brake=!!input.brake;
 p.suction=!!input.suction&&p.air>AIR.grip*dt;
 const specialRoad=!!gripSection(p.s);
 p.boost=!!input.boost&&!brake&&p.air>.001;
 p.lift=!!input.lift&&!p.suction&&!specialRoad&&p.air>.001;
 p.side=p.air>.001?clamp(input.side||(!p.grounded?steer:0),-1,1):0;
 p.rolling=!p.grounded&&!specialRoad&&!!input.roll&&p.air>.001;
 const wantDrift=brake&&Math.abs(steer)>.2&&p.v>14&&p.grounded&&!p.suction&&!gripSection(p.s)&&p.invuln===0;
 if(wantDrift){p.drifting=true;p.driftTime+=dt;p.driftRun+=p.v*dt;DRIFT_TIERS.forEach((t,i)=>{if(p.driftTime>=t.seconds&&p.driftRun>=t.distance)p.driftTier=i;});}
 else if(p.drifting)endDrift(p,p.grounded&&!gripSection(p.s)&&p.invuln===0);
 p.air=clamp(p.air-((p.boost?AIR.boost:0)+(p.lift?AIR.lift:0)+Math.abs(p.side)*AIR.side+(p.rolling?AIR.roll:0)+(p.suction?AIR.grip:0))*dt,0,100);
 const cruise=44+Math.min(10,p.s/1800),motor=(cruise-p.v)*.8;
 p.v=clamp(p.v+(motor+(p.boost?29:0)+(p.miniTurbo>0?30:0)-(brake?(p.drifting?14:42):0)-(p.suction?1.2:0))*dt,brake?6:0,82);
 p.s+=p.v*dt/Math.sqrt(1+slope(p.s,m)**2);
 const curvature=(slope(p.s+2,m)-slope(p.s-2,m))/4;
 const centrifugal=-curvature*p.v*p.v*(p.suction?.025:p.drifting?.19:.12);
 p.vx+=((p.grounded?steer*(p.drifting?21:25):0)+p.side*30+(p.grounded?centrifugal:0)-p.vx*(p.grounded?(p.suction?6.5:p.drifting?2.5:4):2.5))*dt;
 p.x+=p.vx*dt;
 const ground=height(p.s,m),onRoad=!gapAt(p.s,m)&&Math.abs(p.x)<m.width+.65;
 if(needsGrip(p.s)&&!p.suction){p.detached+=dt;p.grounded=false;p.y=ground+p.detached*5;p.vy=0;p.gripClean=false;if(p.detached>.65){p.failed=true;p.reason='grip';}}
 else {if(p.detached>0&&p.suction&&onRoad){p.grounded=true;p.y=ground;p.vy=0;}p.detached=0;}
 const section=gripSection(p.s);
 if(section&&p.gripRun!==section.id){p.gripRun=section.id;p.gripClean=p.grounded;}
 if(section&&!p.grounded)p.gripClean=false;
 if(!section&&p.gripRun){if(p.gripClean&&p.grounded){p.gripSections++;award(p,'反重力路段 +500');}p.gripRun=null;p.gripClean=false;}
 if(p.grounded&&p.lift){p.grounded=false;p.vy=5.5;}
 if(p.grounded&&!onRoad)p.grounded=false;
 if(!p.grounded&&!p.detached){
  const target=Math.round(p.roll/(Math.PI*2))*Math.PI*2;
  const torque=p.rolling?input.roll*16:clamp((target-p.roll)*18-p.rollRate*6,-18,18);
  p.rollRate=clamp(p.rollRate+torque*dt,-4.8,4.8);p.roll+=p.rollRate*dt;
  const turns=Math.floor(Math.abs(p.roll)/(Math.PI*2));if(turns>p.rollMark){p.pendingRolls+=turns-p.rollMark;p.rollMark=turns;}
  p.vy+=((p.lift?(m.id==='orbit'?11:27):0)-m.gravity-(p.suction?m.gravity*1.2:0))*dt;p.vy=clamp(p.vy,-24,13);p.y+=p.vy*dt;p.airtime+=dt;
  if(onRoad&&previousClearance>=-.15&&p.y<=ground&&p.vy<=0&&(!needsGrip(p.s)||p.suction)){
   const angle=Math.abs(Math.atan2(Math.sin(p.roll),Math.cos(p.roll)));
   if(angle>1||Math.abs(p.vy)>19){damage(p,20);p.pendingRolls=0;}
   else if(p.airtime>.65&&p.invuln===0){p.landings++;p.rolls+=p.pendingRolls;award(p,p.pendingRolls?'翻滚 ×'+p.pendingRolls+' · 平稳落地 +'+(200+600*p.pendingRolls):'平稳落地 +200');}
   p.roll=0;p.rollRate=0;p.rollMark=0;p.pendingRolls=0;p.y=ground;p.vy=0;p.grounded=true;p.airtime=0;
  }
 }else if(p.grounded){p.y=ground;p.vy=0;}
 if(p.y>ground+22){p.y=ground+22;p.vy=Math.min(p.vy,0);}
 if(p.y<ground-3.2||Math.abs(p.x)>m.width+10){p.failed=true;p.reason='fall';}
 if(p.drifting&&!p.grounded)endDrift(p,false);
 // No finish line, elapsed-time limit, energy failure or checkpoint respawn.
 if(p.failed){p.boost=false;p.lift=false;p.side=0;p.rolling=false;resetDrift(p);}
}
export function obstacles(m,from=0,to=640){const out=[];for(let i=Math.max(0,Math.ceil((from-155)/145));155+i*145<to;i++){const s=155+i*145;if(gripSection(s)||gapsInRange(m,s-60,s+60).length)continue;out.push({id:'o'+i,s,x:i%3===0?0:i%3===1?-4.6:4.6,w:i%4===0?9:4.5,h:i%4===0?1.25:2.1,d:2.6,hit:false,passed:false});}return out;}
export function rings(m,from=0,to=640){const out=[];for(let i=Math.max(0,Math.ceil((from-75)/80));75+i*80<to;i++){const s=75+i*80;if(gapsInRange(m,s-35,s+50).length)continue;out.push({id:'r'+i,s,x:gripSection(s)?0:[0,-3,3][i%3],y:1.5,collected:false});}for(const [a,b]of gapsInRange(m,from-70,to+70))for(const [s,y]of [[a-42,1.5],[(a+b)/2,4.5]])if(s>=from&&s<to)out.push({id:'g'+s,s,x:0,y,collected:false});return out.sort((a,b)=>a.s-b.s);}
