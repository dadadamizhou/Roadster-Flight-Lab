import * as T from './vendor/three.module.js';
export function createCar(){
 const root=new T.Group(),wheels=[],jets=[],liftJets=[],sideJets=[];
 const white=new T.MeshPhysicalMaterial({color:0xe8ecee,metalness:.5,roughness:.24,clearcoat:1,clearcoatRoughness:.15});
 const carbon=new T.MeshStandardMaterial({color:0x10151a,metalness:.45,roughness:.4});
 const rubber=new T.MeshStandardMaterial({color:0x0a0d10,roughness:.92});
 const silver=new T.MeshStandardMaterial({color:0x9fa9ae,metalness:.88,roughness:.22});
 const glass=new T.MeshPhysicalMaterial({color:0x73563b,metalness:.65,roughness:.14,clearcoat:1});
 const led=new T.MeshBasicMaterial({color:0xebfff8}),red=new T.MeshBasicMaterial({color:0xff2944});
 function mesh(g,m,x=0,y=0,z=0,p=root){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;}
 const box=(w,h,d,m,x,y,z,p)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z,p);
 function panel(points,m,p=root){const g=new T.BufferGeometry(),a=[];for(let i=1;i<points.length-1;i++)a.push(...points[0],...points[i],...points[i+1]);g.setAttribute('position',new T.Float32BufferAttribute(a,3));g.computeVertexNormals();m.side=T.DoubleSide;return mesh(g,m,0,0,0,p);}
 function tube(points,r,m,p=root){const c=new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v)));return mesh(new T.TubeGeometry(c,Math.max(3,points.length*3),r,5,false),m,0,0,0,p);}
 function loft(sections,m){const a=[],idx=[];for(const [z,w,y,c] of sections)a.push(-w,y,z,-w*.62,y+c,z,w*.62,y+c,z,w,y,z);for(let j=0;j<sections.length-1;j++)for(let k=0;k<3;k++){let i=j*4+k;idx.push(i,i+4,i+1,i+1,i+4,i+5);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(a,3));g.setIndex(idx);g.computeVertexNormals();return mesh(g,m);}
 box(1.9,.13,4.68,carbon,0,.25,0);
 loft([[-2.48,.94,.56,.01],[-2.05,1.04,.77,.04],[-1.52,1.09,.92,.03],[-.85,1.05,.94,.03],[.4,1.06,.91,.04],[1.5,1.12,1.01,.01],[2.36,1.05,.92,.01]],white);
 for(const side of [-1,1]){
  const shape=new T.Shape();shape.moveTo(-2.48,.28);shape.lineTo(-2.48,.56);shape.lineTo(-2.05,.77);shape.lineTo(-1.52,.92);shape.lineTo(-.85,.94);shape.lineTo(.4,.91);shape.lineTo(1.5,1.01);shape.lineTo(2.36,.92);shape.lineTo(2.36,.32);shape.lineTo(2.05,.3);shape.absarc(1.5,.43,.56,-.235,Math.PI+.235,false);shape.lineTo(-.94,.3);shape.absarc(-1.5,.43,.56,-.235,Math.PI+.235,false);shape.lineTo(-2.48,.28);
  const g=new T.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:false,curveSegments:18});const p=g.attributes.position;for(let i=0;i<p.count;i++){const z=p.getX(i),y=p.getY(i),d=p.getZ(i);const sections=[[-2.48,.94],[-2.05,1.04],[-1.52,1.09],[-.85,1.05],[.4,1.06],[1.5,1.12],[2.36,1.05]];let w=1.05;for(let k=0;k<sections.length-1;k++){if(z>=sections[k][0]&&z<=sections[k+1][0]){const t=(z-sections[k][0])/(sections[k+1][0]-sections[k][0]);w=sections[k][1]*(1-t)+sections[k+1][1]*t;break;}}p.setXYZ(i,side*(w+d-.045),y,z);}g.computeVertexNormals();mesh(g,white);
  tube([[side*1.10,.3,-.88],[side*1.11,.31,.8]],.055,carbon);
  panel([[side*.87,.97,-.87],[side*.74,1.36,-.06],[side*.72,1.40,.61],[side*.83,1.17,1.31],[side*.98,1.02,1.65]],glass);
  tube([[side*.87,.97,-.87],[side*.74,1.36,-.06],[side*.72,1.40,.61],[side*.83,1.17,1.31],[side*.98,1.02,1.65]],.023,white);
  tube([[side*.96,.97,-.87],[side*1.086,.8,-.76],[side*1.09,.35,-.61]],.006,carbon);
  tube([[side*.78,1.34,.65],[side*1.087,.94,.72],[side*1.089,.35,.66]],.006,carbon);
  box(.012,.026,.17,carbon,side*1.096,.86,.55);box(.23,.065,.12,carbon,side*1.13,1.03,-.69);box(.15,.02,.12,white,side*1.13,1.07,-.69);box(.012,.035,.18,red,side*1.092,.77,-1.0);
 }
 loft([[-.9,.87,.97,.014],[-.06,.74,1.36,.035],[.61,.72,1.40,.035],[1.4,.85,1.12,.015],[1.65,.96,1.02,0]],glass);
 tube([[-.87,.975,-.9],[0,1.0,-.92],[.87,.975,-.9]],.018,white);
 panel([[-.94,.56,-2.485],[.94,.56,-2.485],[.95,.28,-2.47],[-.95,.28,-2.47]],carbon);
 box(1.88,.023,.021,led,0,.579,-2.49);box(1.99,.045,.17,carbon,0,.25,-2.45);
 for(const s of [-1,1])tube([[s*.91,.59,-2.48],[s*1.02,.70,-2.13]],.012,led);
 box(2.08,.39,.14,carbon,0,.50,2.34);box(2.06,.03,.04,red,0,.86,2.40);box(2.00,.012,.04,red,0,.81,2.40);
 for(let i=-4;i<=4;i++)box(.026,.18,.4,carbon,i*.22,.23,2.22);
 for(const s of [-1,1])for(const z of [-1.5,1.5]){
  const wheel=new T.Group();wheel.position.set(s*1.08,.43,z);root.add(wheel);wheels.push(wheel);
  const tire=mesh(new T.CylinderGeometry(.43,.43,.23,32),rubber,0,0,0,wheel);tire.rotation.z=Math.PI/2;
  const disc=mesh(new T.CylinderGeometry(.365,.365,.012,32),carbon,s*.126,0,0,wheel);disc.rotation.z=Math.PI/2;
  const rim=mesh(new T.TorusGeometry(.36,.017,5,32),silver,s*.139,0,0,wheel);rim.rotation.y=Math.PI/2;
  for(let j=0;j<5;j++){const a=j*Math.PI*2/5,verts=[];for(const [r,da] of [[.07,-.25],[.34,-.20],[.35,.20],[.2,.29]])verts.push([s*.145,Math.cos(a+da)*r,Math.sin(a+da)*r]);panel(verts,white,wheel);tube([[s*.15,Math.cos(a)*.07,Math.sin(a)*.07],[s*.15,Math.cos(a+.18)*.34,Math.sin(a+.18)*.34]],.01,silver,wheel);}
  const hub=mesh(new T.CylinderGeometry(.07,.07,.02,12),silver,s*.15,0,0,wheel);hub.rotation.z=Math.PI/2;
 }
 const wing=new T.Group();root.add(wing);wing.position.set(0,.96,1.98);
 for(const s of [-1,1]){box(.05,.24,.11,carbon,s*.65,.1,0,wing);box(.055,.15,.57,white,s*1.1,.27,.03,wing);}box(2.22,.065,.49,white,0,.24,.025,wing);box(2.2,.015,.07,carbon,0,.20,.25,wing);
 const plumeMaterial=new T.MeshBasicMaterial({color:0xc4f5ff,transparent:true,opacity:.65,depthWrite:false,blending:T.AdditiveBlending});
 function jet(x,y,z,down){const port=mesh(new T.CylinderGeometry(.075,.11,.15,12),silver,x,y,z);port.rotation.x=down?0:Math.PI/2;const inner=mesh(new T.CylinderGeometry(.061,.061,.16,12),carbon,x,y,z);inner.rotation.copy(port.rotation);const group=new T.Group();group.position.set(x,y,z);if(!down)group.rotation.x=-Math.PI/2;root.add(group);const plume=mesh(new T.ConeGeometry(.17,1.45,10,1,true),plumeMaterial.clone(),0,-.80,0,group);plume.rotation.z=Math.PI;const core=mesh(new T.ConeGeometry(.075,1,8),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.85,blending:T.AdditiveBlending}),0,-.56,0,group);core.rotation.z=Math.PI;group.visible=false;(down?liftJets:jets).push(group);}
 for(const x of [-.66,-.22,.22,.66]){jet(x,.55,2.44,false);mesh(new T.TorusGeometry(.054,.009,5,12),silver,x,.72,2.42);}
 for(const x of [-.83,.83])for(const z of [-1.1,1.1])jet(x,.22,z,true);
 const suction=mesh(new T.RingGeometry(.8,1.5,48),new T.MeshBasicMaterial({color:0x7cfad6,transparent:true,opacity:.3,side:T.DoubleSide,depthWrite:false}),0,.025,0);suction.rotation.x=-Math.PI/2;suction.scale.y=1.6;suction.visible=false;
 for(const side of [-1,1])for(const z of [-1.05,1.05]){
  const port=mesh(new T.CylinderGeometry(.045,.065,.09,10),silver,side*1.105,.61,z);port.rotation.z=Math.PI/2;
  const g=new T.Group();g.position.set(side*1.15,.61,z);g.rotation.z=side*Math.PI/2;root.add(g);
  const plume=mesh(new T.ConeGeometry(.10,.8,8,1,true),plumeMaterial.clone(),0,-.43,0,g);plume.rotation.z=Math.PI;g.visible=false;g.userData.side=side;sideJets.push(g);
 }
 root.userData={wheels,jets,liftJets,sideJets,wing,suction};return root;
}
