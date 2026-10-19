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
export function stats(p){return {distance:p.distance,time:p.time,rings:p.rings,collisions:p.collisions,landings:p.landings,driftMeters:p.driftMeters,drifts:p.drifts,rolls:p.rolls,nearMisses:p.nearMisses,gripSections:p.gripSections,comboBonus:p.comboBonus};}
export function score(p){return calculateScore(stats(p));}
export function fresh(m){return {s:0,distance:0,heading:Math.atan(slope(0,m)),travelHeading:Math.atan(slope(0,m)),steerSmooth:0,steer:0,throttle:0,flight:null,airBank:0,recovering:false,completedGrips:new Set(),driftSettle:0,x:0,v:0,vx:0,y:height(0,m),vy:0,health:100,air:100,time:0,rings:0,landings:0,collisions:0,suction:false,boost:false,lift:false,grounded:true,airtime:0,invuln:0,failed:false,reason:'',side:0,roll:0,rollRate:0,rolls:0,pendingRolls:0,rollMark:0,rolling:false,autoRoll:0,autoRollTime:0,autoRollFrom:0,drifting:false,driftTime:0,driftRun:0,driftTier:-1,driftMeters:0,drifts:0,miniTurbo:0,combo:0,comboTime:0,comboBonus:0,nearMisses:0,gripSections:0,gripRun:null,gripClean:false,event:null,eventId:0};}
export const TAP_ROLL={duration:1.25,air:10};
export function rollAvailability(p,m){
 if(p.failed||p.grounded)return 'ground';
 if(p.suction||gripSection(p.s))return 'grip';
 if(p.autoRoll||Math.abs(Math.atan2(Math.sin(p.roll),Math.cos(p.roll)))>.15||Math.abs(p.rollRate)>.5)return 'busy';
 if(p.air<TAP_ROLL.air)return 'air';
 const alt=Math.max(0,p.y-height(p.s,m));
 const flightTime=(p.vy+Math.sqrt(p.vy*p.vy+2*m.gravity*alt))/m.gravity;
 return flightTime<TAP_ROLL.duration+.15?'low':null;
}
export function requestRoll(p,direction,m){
 if(![-1,1].includes(direction)||rollAvailability(p,m))return false;
 p.air-=TAP_ROLL.air;p.autoRoll=direction;p.autoRollTime=0;p.autoRollFrom=p.roll;p.rolling=true;return true;
}
function award(p,message){p.combo=p.comboTime>0?Math.min(5,p.combo+1):1;p.comboTime=5;p.comboBonus+=(p.combo-1)*100;p.event={id:++p.eventId,message};}
export function collectRing(p){if(p.failed)return;p.rings++;p.air=clamp(p.air+AIR.ring,0,100);award(p,'穿环 +150 · 气压 +25%');}
export function nearMiss(p){p.nearMisses++;award(p,'极限擦身 +250');}
function resetDrift(p){p.drifting=false;p.driftTime=0;p.driftRun=0;p.driftTier=-1;}
export function damage(p,amount=25){if(p.failed||p.invuln>0)return false;p.health=Math.max(0,p.health-amount);p.collisions++;p.v*=.55;if(p.flight){p.flight.velocity.x*=.55;p.flight.velocity.z*=.55;}p.invuln=1.15;p.combo=0;p.comboTime=0;p.pendingRolls=0;if(p.autoRoll){p.roll=Math.atan2(Math.sin(p.roll),Math.cos(p.roll));p.rollMark=0;}p.autoRoll=0;p.rolling=false;p.gripClean=false;resetDrift(p);if(p.health===0){p.failed=true;p.reason='health';}return true;}
function endDrift(p,clean){if(clean)p.driftSettle=.35;if(clean&&p.driftTier>=0){const tier=DRIFT_TIERS[p.driftTier];p.driftMeters+=p.driftRun;p.drifts++;p.air=clamp(p.air+tier.air,0,100);p.miniTurbo=tier.turbo;award(p,tier.name+' +'+Math.floor(p.driftRun*4)+' · 气压 +'+tier.air+'%');}resetDrift(p);}
export const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const approach=(value,target,amount)=>value<target?Math.min(target,value+amount):Math.max(target,value-amount);
export function roadFrame(s,m){
 const a=Math.atan(slope(s,m)),b=bank(s),ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
 return {forward:{x:sa,y:0,z:-ca},right:{x:ca*cb,y:sb,z:sa*cb},up:{x:-ca*sb,y:cb,z:-sa*sb}};
}
export function roadPoint(s,x,alt,m){const f=roadFrame(s,m);return {x:center(s,m)+f.right.x*x+f.up.x*alt,y:height(s,m)+f.right.y*x+f.up.y*alt,z:-s+f.right.z*x+f.up.z*alt};}
export function projectToRoad(pos,guess,m){
 let s=guess;
 for(let i=0;i<5;i++){const k=slope(s,m);s+=clamp(((pos.x-center(s,m))*k-(pos.z+s))/(1+k*k),-80,80);}
 const a=Math.atan(slope(s,m)),b=bank(s),side=(pos.x-center(s,m))*Math.cos(a)+(pos.z+s)*Math.sin(a),up=pos.y-height(s,m);
 return {s,x:side*Math.cos(b)+up*Math.sin(b),alt:-side*Math.sin(b)+up*Math.cos(b)};
}
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const addScaled=(v,n,amount)=>{v.x+=n.x*amount;v.y+=n.y*amount;v.z+=n.z*amount;};
export const RECOVERY={reach:15,floor: -14,orbitFloor:-60};
export function canReattach(p,m){const alt=p.y-height(p.s,m);return !p.grounded&&p.s>=-80&&!gapAt(p.s,m)&&Math.abs(p.x)<m.width+.45&&alt>=-.25&&alt<RECOVERY.reach;}
function beginFlight(p,m,velocity){
 p.grounded=false;p.airBank=bank(p.s);
 p.flight={position:roadPoint(p.s,p.x,p.y-height(p.s,m),m),velocity:velocity||{x:0,y:0,z:0}};
}
function land(p,m,impact){
 const angle=Math.abs(angleDelta(p.roll,0));
 if(angle>1||impact>21){damage(p,20);p.pendingRolls=0;}
 else if(p.airtime>.65&&p.invuln===0){p.landings++;p.rolls+=p.pendingRolls;award(p,p.pendingRolls?'翻滚 ×'+p.pendingRolls+' · 平稳落地 +'+(200+600*p.pendingRolls):'平稳落地 +200');}
 const f=roadFrame(p.s,m),v=p.flight.velocity,rel=angleDelta(p.heading,Math.atan(slope(p.s,m)));
 p.v=clamp(dot(v,f.forward)*Math.cos(rel)+dot(v,f.right)*Math.sin(rel),-14,82);
 p.travelHeading=p.heading;
 p.flight=null;p.grounded=true;p.y=height(p.s,m);p.vy=0;p.airtime=0;p.recovering=false;
 p.roll=0;p.rollRate=0;p.rollMark=0;p.pendingRolls=0;p.autoRoll=0;
}
export function step(p,input,dt,m){
 if(p.failed)return;
 p.time+=dt;p.invuln=Math.max(0,p.invuln-dt);p.comboTime=Math.max(0,p.comboTime-dt);if(!p.comboTime)p.combo=0;
 p.miniTurbo=Math.max(0,p.miniTurbo-dt);p.driftSettle=Math.max(0,p.driftSettle-dt);
 const previousS=p.s,previousBest=p.distance,section=gripSection(p.s),throttle=clamp(input.throttle||0,-1,1),steer=clamp(input.steer||0,-1,1),brake=!!input.brake;
 p.throttle=throttle;p.steer=steer;p.suction=!!input.suction&&p.air>AIR.grip*dt;
 p.boost=!!input.boost&&!brake&&throttle>=0&&p.v>=-.1&&p.air>.001;
 p.lift=!!input.lift&&!p.suction&&!section&&p.air>.001;
 p.side=p.air>.001?clamp(input.side||(!p.grounded?steer:0),-1,1):0;
 p.rolling=!!p.autoRoll||(!p.grounded&&!section&&!!input.roll&&p.air>.001);
 const driftAllowed=p.grounded&&!p.suction&&!section&&p.v>9&&p.invuln===0;
 if(!p.drifting&&driftAllowed&&brake&&Math.abs(steer)>.18&&p.v>13)p.drifting=true;
 if(p.drifting){
  if(!driftAllowed)endDrift(p,false);
  else if(!brake)endDrift(p,true);
 }
 p.air=clamp(p.air-((p.boost?AIR.boost:0)+(p.lift?AIR.lift:0)+Math.abs(p.side)*AIR.side+(p.rolling&&!p.autoRoll?AIR.roll:0)+(p.suction?AIR.grip:0))*dt,0,100);
 // Small corrections are gentle. Releasing/countersteering responds faster
 // than winding on lock, with no reference to the road's chosen direction.
 const shaped=steer*(p.drifting?.65+.35*Math.abs(steer):.3+.7*Math.abs(steer));
 const releasing=Math.abs(shaped)<Math.abs(p.steerSmooth)||shaped*p.steerSmooth<0;
 p.steerSmooth+=(shaped-p.steerSmooth)*(1-Math.exp(-dt*(releasing?18:p.drifting?9:5.5)));
 const speed=Math.abs(p.v),yawRate=p.grounded?Math.sign(p.v)*Math.min(speed/10,1)*(p.drifting?.94:clamp(1.04-speed*.01,.40,.95)):.65;
 p.heading=angleDelta(p.heading+p.steerSmooth*yawRate*dt,0);
 if(p.grounded){
  if(throttle*p.v<-.2)p.v=approach(p.v,0,34*Math.abs(throttle)*dt);
  else if((!brake||p.drifting)&&Math.abs(throttle)>.05&&Math.abs(p.v)<(throttle>0?36:14)*Math.abs(throttle))p.v+=throttle*(throttle>0?28:20)*(p.drifting?.65:1)*dt;
  p.v=approach(p.v,0,(.8+.045*Math.abs(p.v)+.006*p.v*p.v)*dt);
  if(brake)p.v=approach(p.v,0,(p.drifting?4:44)*dt);
  if(p.boost)p.v+=29*dt;
  if(p.miniTurbo>0&&throttle>.1&&!brake)p.v+=22*dt;
  p.v=clamp(p.v,-14,82);if(Math.abs(p.v)<.03)p.v=0;
  const traction=p.drifting?2.1:p.driftSettle>0?8+14*(1-p.driftSettle/.35):p.suction?26:Math.abs(steer)<.05?28:22;
  p.travelHeading=angleDelta(p.travelHeading+angleDelta(p.heading,p.travelHeading)*(1-Math.exp(-traction*dt)),0);
  const rel=angleDelta(p.travelHeading,Math.atan(slope(p.s,m))),before=roadPoint(p.s,p.x,0,m);
  p.vx=p.v*Math.sin(rel);p.s+=p.v*Math.cos(rel)*dt/Math.sqrt(1+slope(p.s,m)**2);p.x+=p.vx*dt;p.y=height(p.s,m);
  const after=roadPoint(p.s,p.x,0,m),velocity={x:(after.x-before.x)/dt,y:(after.y-before.y)/dt,z:(after.z-before.z)/dt};
  if(p.lift||p.s< -80||gapAt(p.s,m)||Math.abs(p.x)>m.width+.45||(needsGrip(p.s)&&!p.suction)){
   // Preserve actual world momentum; the road no longer carries an airborne car.
   if(p.lift)addScaled(velocity,roadFrame(p.s,m).up,5.5);
   beginFlight(p,m,velocity);p.flight.position=roadPoint(p.s,p.x,.025,m);
  }
 }else if(!p.flight){
  const f=roadFrame(p.s,m),rel=angleDelta(p.travelHeading,Math.atan(slope(p.s,m)));
  const velocity={x:0,y:0,z:0};addScaled(velocity,f.forward,p.v*Math.cos(rel));addScaled(velocity,f.right,p.v*Math.sin(rel));addScaled(velocity,f.up,p.vy);beginFlight(p,m,velocity);
 }
 if(!p.grounded){
  const f=roadFrame(p.s,m),pos=p.flight.position,vel=p.flight.velocity,previousAlt=p.y-height(p.s,m);
  if(p.autoRoll){p.autoRollTime+=dt;const t=clamp(p.autoRollTime/TAP_ROLL.duration,0,1);p.roll=p.autoRollFrom+p.autoRoll*Math.PI*2*smooth(t);p.rollRate=0;if(t===1){p.pendingRolls++;p.roll=0;p.rollMark=0;p.autoRoll=0;}}
  else {const target=Math.round(p.roll/(Math.PI*2))*Math.PI*2,torque=p.rolling?input.roll*16:clamp((target-p.roll)*18-p.rollRate*6,-18,18);p.rollRate=clamp(p.rollRate+torque*dt,-4.8,4.8);p.roll+=p.rollRate*dt;const turns=Math.floor(Math.abs(p.roll)/(Math.PI*2));if(turns>p.rollMark){p.pendingRolls+=turns-p.rollMark;p.rollMark=turns;}}
  vel.y-=m.gravity*dt;
  if(p.lift)addScaled(vel,f.up,(m.id==='orbit'?11:27)*(1-clamp((previousAlt-18)/10,0,1))*dt);
  if(p.side)addScaled(vel,f.right,p.side*22*dt);
  if(p.boost){const rel=angleDelta(p.heading,Math.atan(slope(p.s,m)));addScaled(vel,f.forward,Math.cos(rel)*29*dt);addScaled(vel,f.right,Math.sin(rel)*29*dt);}
  p.recovering=p.suction&&canReattach(p,m);
  if(p.recovering){const normalSpeed=dot(vel,f.up),pull=clamp(previousAlt*28+normalSpeed*10+18,0,110);addScaled(vel,f.up,-pull*dt);}
  // Lateral damping reduces twitchy air corrections without steering to the road.
  addScaled(vel,f.right,-dot(vel,f.right)*.5*dt);
  const total=Math.hypot(vel.x,vel.y,vel.z);if(total>82){vel.x*=82/total;vel.y*=82/total;vel.z*=82/total;}
  pos.x+=vel.x*dt;pos.y+=vel.y*dt;pos.z+=vel.z*dt;
  const projection=projectToRoad(pos,p.s,m);p.s=projection.s;p.x=projection.x;p.y=height(p.s,m)+projection.alt;
  const nextFrame=roadFrame(p.s,m);p.vy=dot(vel,nextFrame.up);p.vx=dot(vel,nextFrame.right);p.airtime+=dt;
  const onRoad=p.s>=-80&&!gapAt(p.s,m)&&Math.abs(p.x)<m.width+.45;
  if(onRoad&&previousAlt<-.2&&projection.alt>=-.2&&p.vy>0){damage(p,20);addScaled(vel,nextFrame.up,-p.vy*1.25);Object.assign(pos,roadPoint(p.s,p.x,-.25,m));p.y=height(p.s,m)-.25;}
  if(onRoad&&previousAlt>=-.2&&projection.alt<=.06&&p.vy<=0&&(!needsGrip(p.s)||p.suction))land(p,m,Math.max(0,-p.vy));
  else if(pos.y<(m.id==='orbit'?RECOVERY.orbitFloor:RECOVERY.floor)+.5){p.failed=true;p.reason='fall';}
 }
 p.distance=Math.max(p.distance,p.s,0);
 if(p.drifting){
  if(!p.grounded)endDrift(p,false);
  else if(Math.abs(angleDelta(p.heading,p.travelHeading))>.055){p.driftTime+=dt;p.driftRun+=Math.max(0,p.distance-previousBest);DRIFT_TIERS.forEach((t,i)=>{if(p.driftTime>=t.seconds&&p.driftRun>=t.distance)p.driftTier=i;});}
 }
 const activeSection=gripSection(p.s);
 if(activeSection&&p.gripRun?.id!==activeSection.id){p.gripRun=activeSection;p.gripClean=p.grounded&&previousS<=activeSection.a+1;}
 if(activeSection&&!p.grounded)p.gripClean=false;
 if(!activeSection&&p.gripRun){if(p.gripClean&&p.grounded&&p.s>=p.gripRun.b&&!p.completedGrips.has(p.gripRun.id)){p.completedGrips.add(p.gripRun.id);p.gripSections++;award(p,'反重力路段 +500');}p.gripRun=null;p.gripClean=false;}
 if(p.failed){p.autoRoll=0;p.boost=false;p.lift=false;p.side=0;p.rolling=false;resetDrift(p);}
}
export function obstacles(m,from=0,to=640){const out=[];for(let i=Math.max(0,Math.ceil((from-155)/145));155+i*145<to;i++){const s=155+i*145;if(gripSection(s)||gapsInRange(m,s-60,s+60).length)continue;out.push({id:'o'+i,s,x:i%3===0?0:i%3===1?-4.6:4.6,w:i%4===0?9:4.5,h:i%4===0?1.25:2.1,d:2.6,hit:false,passed:false});}return out;}
export function rings(m,from=0,to=640){const out=[];for(let i=Math.max(0,Math.ceil((from-75)/80));75+i*80<to;i++){const s=75+i*80;if(gapsInRange(m,s-35,s+50).length)continue;out.push({id:'r'+i,s,x:gripSection(s)?0:[0,-3,3][i%3],y:1.5,collected:false});}for(const [a,b]of gapsInRange(m,from-70,to+70))for(const [s,y]of [[a-42,1.5],[(a+b)/2,4.5]])if(s>=from&&s<to)out.push({id:'g'+s,s,x:0,y,collected:false});return out.sort((a,b)=>a.s-b.s);}
