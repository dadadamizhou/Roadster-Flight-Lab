export const MAPS={
 city:{id:'city',name:'霓虹都市',en:'NEON DISTRICT',length:1800,gravity:16,width:10,amplitude:35,period:125,gaps:[[520,542],[1160,1184]],stations:[335,925,1510],accent:0x8bf7d0,fog:0x111f2d},
 canyon:{id:'canyon',name:'赤岩峡谷',en:'RED CANYON',length:2000,gravity:16,width:9,amplitude:62,period:105,gaps:[[300,325],[735,765],[1230,1262],[1680,1708]],stations:[470,1030,1535],accent:0xffbb76,fog:0xb98f72},
 orbit:{id:'orbit',name:'近地轨道',en:'LOW EARTH ORBIT',length:2200,gravity:5,width:9,amplitude:45,period:145,gaps:[[280,328],[680,735],[1100,1165],[1570,1638],[1950,2010]],stations:[455,935,1445,1840],accent:0xb3a1ff,fog:0x060817}
};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function center(s,m){return m.amplitude*(Math.sin(s/m.period)-.3*Math.sin(s/(m.period*.52)));}
export function slope(s,m){return (center(s+1,m)-center(s-1,m))/2;}
export function height(s,m){return m.id==='canyon'?5+4*Math.sin(s/150)+1.5*Math.sin(s/53):m.id==='orbit'?5+3*Math.sin(s/170):3;}
export function gapAt(s,m){return m.gaps.some(([a,b])=>s>a&&s<b);}
export function score(s){return Math.max(0,Math.round(15000-s.time*35+s.rings*800+Math.min(12,s.landings)*250-s.collisions*650));}
export function fresh(m){return {s:0,x:0,v:0,vx:0,y:height(0,m),vy:0,battery:100,air:100,time:0,rings:0,landings:0,collisions:0,pump:false,suction:false,boost:false,lift:false,grounded:true,charging:false,airtime:0,invuln:0,check:0,done:false,failed:false,energyUse:0,side:0,roll:0,rollRate:0,rolls:0,rollMark:0,rolling:false};}
export function step(p,input,dt,m){
 if(p.done||p.failed)return;
 p.time+=dt;p.invuln=Math.max(0,p.invuln-dt);
 const station=m.stations.some(s=>Math.abs(p.s-s)<20);
 p.charging=station&&p.v<7&&p.grounded;
 p.suction=!!input.suction&&p.battery>.15&&!input.lift;
 p.boost=!!input.boost&&p.air>1&&!p.charging;
 p.lift=!!input.lift&&p.air>1&&!p.suction;
 p.side=p.air>1?clamp(input.side||(!p.grounded?(input.steer||0):0),-1,1):0;
 p.rolling=!p.grounded&&!!input.roll&&p.air>1;
 if(!p.grounded){
  const target=Math.round(p.roll/(Math.PI*2))*Math.PI*2;
  const torque=p.rolling?input.roll*16:clamp((target-p.roll)*18-p.rollRate*6,-18,18);
  p.rollRate=clamp(p.rollRate+torque*dt,-4.8,4.8);p.roll+=p.rollRate*dt;
  const completed=Math.floor(Math.abs(p.roll)/(Math.PI*2));if(completed>p.rollMark){p.rolls+=completed-p.rollMark;p.rollMark=completed;}
 }
 if(p.air>=99.99||p.battery<=.05)p.pump=false;
 const gas=(input.throttle||input.auto)&&!input.brake&&p.battery>.05;
 const motor=gas?(.25+p.v*.004):.035;
 p.energyUse=motor+(p.pump?3.4:0)+(p.suction?1.8:0);
 const canPump=p.pump&&p.battery>.05;
 p.battery=clamp(p.battery+(p.charging?23:0)*dt-p.energyUse*dt+(input.brake&&p.v>8?.45*dt:0),0,100);
 p.air=clamp(p.air+(canPump?13*dt:0)-(p.boost?21*dt:0)-(p.lift?18*dt:0)-(Math.abs(p.side)*9*dt)-(p.rolling?10*dt:0),0,100);
 p.v=clamp(p.v+((gas?17:0)+(p.boost?30:0)-(input.brake?39:0)-1.8-p.v*.25-(p.suction?1.5:0))*dt,0,82);
 const lastS=p.s;p.s+=p.v*dt/Math.sqrt(1+slope(p.s,m)**2);
 const curvature=(slope(p.s+2,m)-slope(p.s-2,m))/4;
 const drift=-curvature*p.v*p.v*(p.suction?.08:.46);
 p.vx+=((p.grounded?(input.steer||0)*25:0)+p.side*32+(p.grounded?drift:0)-p.vx*(p.grounded?(p.suction?7:3.5):2.2))*dt;
 p.x+=p.vx*dt;
 const ground=height(p.s,m),onRoad=!gapAt(p.s,m)&&Math.abs(p.x)<m.width+1.1;
 if(p.grounded&&p.lift){p.grounded=false;p.vy=5.5;}
 if(p.grounded&&!onRoad)p.grounded=false;
 if(!p.grounded){p.vy+=((p.lift?(m.id==='orbit'?11:27):0)-m.gravity-(p.suction?m.gravity*1.2:0))*dt;p.vy=clamp(p.vy,-24,13);p.y+=p.vy*dt;p.airtime+=dt;
  if(onRoad&&p.y<=ground&&p.vy<=0){const angle=Math.abs(Math.atan2(Math.sin(p.roll),Math.cos(p.roll)));
   if(angle>1.0&&p.invuln<=0){p.collisions++;p.v*=.45;p.invuln=1.5;}else if(p.airtime>.65&&Math.abs(p.vy)<17)p.landings=Math.min(12,p.landings+1);
   p.roll=0;p.rollRate=0;p.rollMark=0;p.y=ground;p.vy=0;p.grounded=true;p.airtime=0;}
 }else{p.y=ground;p.vy=0;}
 if(p.y>ground+22){p.y=ground+22;p.vy=Math.min(p.vy,0);}
 if(p.s-lastS>0&&p.grounded&&onRoad&&p.s-p.check>90)p.check=p.s;
 if(p.y<ground-12||Math.abs(p.x)>m.width+14){p.collisions++;p.s=Math.max(0,p.check-8);p.x=0;p.v=5;p.vx=0;p.y=height(p.s,m);p.vy=0;p.grounded=true;p.airtime=0;p.roll=0;p.rollRate=0;p.rollMark=0;p.invuln=1.8;}
 if(p.battery<=0&&p.air<=1&&p.v<.2&&!station)p.failed=true;
 if(p.s>=m.length)p.done=true;
}
export function obstacles(m){const out=[];for(let s=145,i=0;s<m.length-65;s+=155,i++){if(m.gaps.some(([a,b])=>s>a-35&&s<b+35)||m.stations.some(x=>Math.abs(x-s)<35))continue;out.push({s,x:i%3===0?0:i%3===1?-4.6:4.6,w:i%4===0?11:5,h:i%4===0?1.25:2.1,d:2.6});}return out;}
export function rings(m){const out=[];for(let i=0;i<12;i++){let s=110+i*(m.length-220)/11;const g=m.gaps.find(([a,b])=>Math.abs(s-a)<65);if(g)s=(g[0]+g[1])/2;out.push({s,x:i%3===0?-4:i%3===1?4:0,y:g?5:i%2?4.5:2.7});}return out;}
