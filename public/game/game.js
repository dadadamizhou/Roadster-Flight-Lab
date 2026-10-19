import * as T from './vendor/three.module.js';
import {createCar} from './model.js';
import {MAPS,clamp,center,slope,height,gapAt,gapsInRange,bank,gripSection,nextGrip,needsGrip,fresh,step,score,stats,collectRing,damage,nearMiss,requestRoll,rollAvailability} from './physics.js';
import {makeWorld,pose,trackUp,disposeWorld} from './world.js';
import {createTouchInput,createSteeringInput} from './touch-input.js';
import {enterLandscape} from './orientation.js';
const $=id=>document.getElementById(id),show=(id,v)=>$(id).classList.toggle('hidden',!v);
const storage={get(k,def){try{return JSON.parse(localStorage.getItem('rfl-'+k))??def;}catch{return def;}},set(k,v){try{localStorage.setItem('rfl-'+k,JSON.stringify(v));}catch{}}};
let player=storage.get('player',null);if(!player){player=crypto.randomUUID();storage.set('player',player);}
let selected=storage.get('map','city');if(!MAPS[selected])selected='city';
let map=MAPS[selected],state=fresh(map),mode='menu',world=null,runId=null,suction=false,quality=storage.get('quality','balanced'),sound=false,cameraMode=0,keys={},countdown=0,elapsed=0,frames=0,fps=60,uiClock=0,toastUntil=0,eventSeen=0,demo=false,drag=false,dragX=0,angle=.05,zoom=1;
const touchInput=createTouchInput(()=>['playing','countdown'].includes(mode));
const steering=createSteeringInput($('steeringPad'),()=>['playing','countdown'].includes(mode));
const pressed=code=>!!keys[code]||touchInput.pressed(code);
function clearInputs(){keys={};touchInput.clear();steering.clear();}
let audio=null,engine=null,engineGain=null,airSound=null,airGain=null;
const canvas=$('scene');let renderer;
try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(e){$('loadStatus').textContent='浏览器未能启用 WebGL，请使用支持硬件加速的浏览器。';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='high'?2:quality==='low'?1:1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=quality!=='low';renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
const scene=new T.Scene();scene.background=new T.Color(0x080e12);
const camera=new T.PerspectiveCamera(38,innerWidth/innerHeight,.1,4500);
const hemi=new T.HemisphereLight(0xc2e6ec,0x23333b,1.5);scene.add(hemi);
const sun=new T.DirectionalLight(0xf3f8f0,3.4);sun.position.set(-8,14,-10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-20;sun.shadow.camera.right=20;sun.shadow.camera.top=20;sun.shadow.camera.bottom=-20;sun.shadow.camera.far=90;sun.shadow.bias=-.001;scene.add(sun,sun.target);
const rim=new T.DirectionalLight(0x82bfc9,2);rim.position.set(6,5,6);scene.add(rim);
// Small procedural light studio provides real reflections without downloaded HDR assets.
const envScene=new T.Scene();envScene.background=new T.Color(0x313c43);
for(const [x,y,z,w,h]of [[0,8,0,14,8],[-6,2,0,4,10],[6,3,0,5,10],[0,3,-9,8,4]]){const p=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:0xe6f0f0,side:T.DoubleSide}));p.position.set(x,y,z);p.lookAt(0,0,0);envScene.add(p);}
const pmrem=new T.PMREMGenerator(renderer);const envTarget=pmrem.fromScene(envScene,.025);scene.environment=envTarget.texture;pmrem.dispose();envScene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
const car=createCar();scene.add(car);
const stage=new T.Group();scene.add(stage);
const stageFloor=new T.Mesh(new T.PlaneGeometry(400,400),new T.MeshStandardMaterial({color:0x080f14,metalness:.12,roughness:.85}));stageFloor.rotation.x=-Math.PI/2;stageFloor.position.y=-.025;stageFloor.receiveShadow=true;stage.add(stageFloor);
const platform=new T.Mesh(new T.CylinderGeometry(4.3,4.5,.1,80),new T.MeshStandardMaterial({color:0x18282d,metalness:.5,roughness:.48}));platform.position.set(1.4,-.01,0);platform.receiveShadow=true;stage.add(platform);
const stageRing=new T.Mesh(new T.TorusGeometry(4.38,.012,5,100),new T.MeshBasicMaterial({color:0x8cf6c7}));stageRing.rotation.x=Math.PI/2;stageRing.position.set(1.4,.05,0);stage.add(stageRing);
const grid=new T.GridHelper(120,80,0x264348,0x182c33);grid.position.y=-.015;grid.material.transparent=true;grid.material.opacity=.45;stage.add(grid);
// A fixed particle pool avoids allocation bursts during thrust.
const particleCount=250,positions=new Float32Array(particleCount*3),velocities=new Float32Array(particleCount*3),life=new Float32Array(particleCount);positions.fill(-9999);let particleIndex=0;
const pg=new T.BufferGeometry();pg.setAttribute('position',new T.BufferAttribute(positions,3));const dots=new T.Points(pg,new T.PointsMaterial({color:0xd9f7ff,size:.16,transparent:true,opacity:.48,depthWrite:false,blending:T.AdditiveBlending}));scene.add(dots);
function particles(dt){for(let i=0;i<particleCount;i++){if(life[i]>0){life[i]-=dt;const j=i*3;positions[j]+=velocities[j]*dt;positions[j+1]+=velocities[j+1]*dt;positions[j+2]+=velocities[j+2]*dt;if(life[i]<=0)positions[j+1]=-9999;}}pg.attributes.position.needsUpdate=true;}
const temp=new T.Vector3(),temp2=new T.Vector3();
function emit(down){for(let j=0;j<3;j++){const i=particleIndex++%particleCount,k=i*3;temp.set((Math.random()-.5)*1.5,down?.12:.52,down?(Math.random()-.5)*2:2.6);car.localToWorld(temp);positions[k]=temp.x;positions[k+1]=temp.y;positions[k+2]=temp.z;life[i]=.25+Math.random()*.35;temp2.set((Math.random()-.5)*1.6,down?-8:(Math.random()-.5),down?0:9);temp2.applyQuaternion(car.quaternion);velocities[k]=temp2.x;velocities[k+1]=temp2.y;velocities[k+2]=temp2.z;}}
function emitDrift(){for(const side of [-1,1]){const i=particleIndex++%particleCount,k=i*3;temp.set(side*.9,.12,1.6);car.localToWorld(temp);positions[k]=temp.x;positions[k+1]=temp.y;positions[k+2]=temp.z;life[i]=.35;velocities[k]=side*1.5;velocities[k+1]=.4;velocities[k+2]=2;}}
function initAudio(){if(audio)return;try{audio=new AudioContext();engine=audio.createOscillator();engine.type='sine';engineGain=audio.createGain();engineGain.gain.value=0;engine.connect(engineGain).connect(audio.destination);engine.start();const buffer=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;airSound=audio.createBufferSource();airSound.buffer=buffer;airSound.loop=true;const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1800;airGain=audio.createGain();airGain.gain.value=0;airSound.connect(filter).connect(airGain).connect(audio.destination);airSound.start();}catch{}}
function audioUpdate(){if(!audio)return;const play=sound&&mode==='playing';engine.frequency.setTargetAtTime(45+state.v*2,audio.currentTime,.1);engineGain.gain.setTargetAtTime(play?.015+state.v*.0003:0,audio.currentTime,.1);airGain.gain.setTargetAtTime(play&&(state.boost||state.lift||state.side||state.rolling)?.07:play&&state.drifting?.04:0,audio.currentTime,.1);}
function toggleSound(){initAudio();audio?.resume();sound=!sound;$('soundBtn').textContent=sound?'♫':'♪';$('soundBtn').setAttribute('aria-label',sound?'关闭音效':'开启音效');toast(sound?'音效已开启':'音效已关闭');}
function toast(s,seconds=2.4){toastUntil=performance.now()+seconds*1000;$('message').textContent=s;$('message').style.opacity='1';}
function timeText(t){return String(Math.floor(t/60)).padStart(2,'0')+':'+(t%60).toFixed(2).padStart(5,'0');}
function selectMap(id){selected=id;map=MAPS[id];storage.set('map',id);document.querySelectorAll('[data-map]').forEach(b=>b.classList.toggle('active',b.dataset.map===id));stageRing.material.color.setHex(map.accent);}
function menu(){mode='menu';clearInputs();suction=false;demo=false;show('modal',false);show('hud',false);show('garage',false);show('menu',true);stage.visible=true;if(world)world.root.visible=false;scene.fog=null;scene.background.setHex(0x080e12);hemi.color.setHex(0xc2e6ec);sun.color.setHex(0xf3f8f0);document.body.classList.remove('racing');sun.position.set(-8,14,-10);sun.target.position.set(0,0,0);rim.position.set(6,5,6);rim.intensity=2;car.visible=true;car.position.set(1.4,.05,0);camera.up.set(0,1,0);camera.fov=38;camera.updateProjectionMatrix();angle=.05;zoom=1;audioUpdate();}
async function start(){
 void enterLandscape();
 show('modal',false);show('garage',false);show('menu',false);show('hud',true);document.body.classList.add('racing');clearInputs();demo=false;suction=false;stage.visible=false;camera.up.set(0,1,0);map=MAPS[selected];state=fresh(map);runId=null;
 if(world){scene.remove(world.root);disposeWorld(world.root);}world=makeWorld(map);scene.add(world.root);scene.background.setHex(map.fog);scene.fog=new T.FogExp2(map.fog,map.id==='orbit'?.0006:map.id==='canyon'?.0028:.0048);sun.color.setHex(map.id==='canyon'?0xffd7b4:0xe6f5ff);hemi.color.setHex(map.id==='orbit'?0xa9b6f3:0xc2e6ec);car.visible=true;mode='countdown';countdown=3;eventSeen=0;toastUntil=0;$('message').textContent='';world.ringData.forEach(r=>r.collected=false);$('mapName').textContent=map.name;$('countdown').textContent='3';updateUI();
 camera.position.copy(pose(0,0,6,map)).add(new T.Vector3(0,0,11));
 const thisState=state;
 fetch('/api/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({map:map.id,player})}).then(r=>r.ok?r.json():Promise.reject()).then(r=>{if(state===thisState)runId=r.id;}).catch(()=>{if(state===thisState)toast('离线计时模式 · 本轮成绩保存在本机',4);});
}
function garage(){mode='garage';show('menu',false);show('garage',true);angle=.05;zoom=1;}
function modal(html){$('modalContent').innerHTML=html;show('modal',true);}
function pause(){if(mode!=='playing'&&mode!=='countdown')return;mode='paused';clearInputs();audioUpdate();settings(true);}
function resume(){show('modal',false);mode=countdown>0?'countdown':'playing';clearInputs();}
function settings(paused=false){modal(`<div class="eyebrow">${paused?'DRIVE PAUSED':'PREFERENCES'}</div><h2>${paused?'稍作停留。':'驾驶设置'}</h2><div class="setting"><span>画面品质</span><select id="quality" aria-label="画面品质"><option value="low">流畅 · 节能</option><option value="balanced">均衡 · 推荐</option><option value="high">高清</option></select></div><div class="setting"><span>引擎与喷气音效</span><button id="settingSound">${sound?'开启':'关闭'}</button></div><p>车辆自动前进。手机左手控制方向，右侧上排吸地、跳跃，下排刹车、加速；按住刹车打方向进入漂移，松开完成。按住加速向上滑，可同时加速腾空。腾空后直接出现左右翻滚键，点一下完成一圈并回正。手机始终使用横屏布局。</p><div class="buttons">${paused?'<button class="outline" id="quit">返回车库</button><button class="outline" id="retry">重试</button>':''}<button class="primary" id="continue">${paused?'继续驾驶 ↗':'完成'}</button></div>`);$('quality').value=quality;$('settingSound').onclick=()=>{toggleSound();$('settingSound').textContent=sound?'开启':'关闭';};$('quality').onchange=e=>{quality=e.target.value;storage.set('quality',quality);renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='high'?2:quality==='low'?1:1.5));renderer.shadowMap.enabled=quality!=='low';};$('continue').onclick=()=>paused?resume():show('modal',false);if(paused){$('quit').onclick=menu;$('retry').onclick=start;}}
function help(){modal(`<div class="eyebrow">ENDLESS / PILOT BRIEFING</div><h2>跑得远，也要跑得漂亮。</h2><p>车辆始终自动前进，没有终点和倒计时。碰撞扣 25 点血，侧翻或重落地扣 20 点；血量归零或掉出赛道，本轮结束。气压用完仍能正常行驶。</p><div class="controls-list"><div><kbd>A D / ← →</kbd> 左右转向</div><div><kbd>S / ↓</kbd> 刹车，配合转向漂移</div><div><kbd>SHIFT</kbd> 喷气加速 · 16% 气 / 秒</div><div><kbd>SPACE</kbd> 按住腾空 · 14% 气 / 秒</div><div><kbd>E</kbd> 吸地开关 · 5% 气 / 秒</div><div><kbd>Q / F</kbd> 左右侧喷 · 7% 气 / 秒</div><div><kbd>Z / X</kbd> 单圈翻滚 · 10% 气 / 次</div><div><kbd>C</kbd> 追尾视角</div><div><kbd>ESC / P</kbd> 暂停</div></div><h3>漂移攒气，喷气出弯</h3><p>关闭吸地，在有速度时按住刹车＋转向。蓝、金、紫三档蓄力，松开刹车或回正方向完成漂移，分别补气 8% / 16% / 24%，并获得短促加速。碰撞、离开路面会打断本次漂移。穿过小光环可补气 25%。气压上限 100%，不会自动恢复。</p><h3>90° 侧墙 / 180° 倒挂 / 360° 螺旋</h3><p>看到紫色路段提示，提前开启吸地。吸地持续消耗气压，特殊路段中松开或耗尽会脱离路面。这里不允许腾空、翻滚和漂移；出弯后关闭吸地，留气给下一段。</p><h3>连续特技，连续加分</h3><p>每米 2 分；穿环 150 分；成功漂移每米 4 分；平稳落地 200 分；安全落地的整周翻滚每圈 600 分；高速擦身 250 分；完成反重力路段 500 分。5 秒内连续完成动作可叠至 CHAIN ×5，每次额外奖励最高 400 分；撞击会打断连续奖励，已得分保留。</p><h3>手机双拇指操作</h3><p>左侧摇杆转向，空中拖动摇杆会侧喷。右侧四颗等大圆键：上排吸地、跳跃，下排刹车、加速。吸地点击开关，其他三键按住生效；加速上滑到跳跃可同时推进和腾空。腾空后两个翻滚键出现在操作区上方，点击一次完成一圈，消耗 10% 气压并自动回正；高度不够或气压不足时按钮会提示，落地后收起。按钮位置固定，路况和得分提示都在左上角。</p><button class="primary" id="gotIt">准备好了 ↗</button>`);$('gotIt').onclick=()=>show('modal',false);}
function localRecords(){return storage.get('endless-v2-scores',[]);}
async function leaderboard(id=selected,local=false){const back=mode;modal(`<div class="eyebrow">FLIGHT RECORDS</div><h2>谁能跑得更远？</h2><div class="board-tabs">${Object.values(MAPS).map(m=>`<button data-board="${m.id}" class="${m.id===id?'active':''}">${m.name}</button>`).join('')}</div><div class="setting" style="padding:0 0 12px"><span id="boardMode">${local?'本机成绩':'在线排行榜'}</span><button id="localToggle">${local?'查看在线':'查看本机'}</button></div><table class="board"><thead><tr><th>#</th><th>驾驶员</th><th>总分</th><th>距离</th></tr></thead><tbody id="boardBody"><tr><td colspan="4" class="empty">正在读取成绩…</td></tr></tbody></table><p class="status" id="boardStatus"></p>`);
 document.querySelectorAll('[data-board]').forEach(b=>b.onclick=()=>leaderboard(b.dataset.board,local));$('localToggle').onclick=()=>leaderboard(id,!local);
 let rows=[];try{if(local)rows=localRecords().filter(r=>r.map===id).sort((a,b)=>b.score-a.score).slice(0,20);else{const r=await fetch('/api/scores?map='+id);if(!r.ok)throw Error();rows=(await r.json()).scores;}}catch{$('boardStatus').textContent='在线排行榜暂不可用；可切换本机成绩。';}
 const tbody=$('boardBody');if(!tbody)return;tbody.replaceChildren();if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.className='empty';td.textContent='暂无成绩。成为这条赛道的第一位驾驶员。';tr.append(td);tbody.append(tr);}rows.forEach((r,i)=>{const tr=document.createElement('tr');for(const v of [String(i+1).padStart(2,'0'),r.name,r.score.toLocaleString(),(r.distance/1000).toFixed(2)+' km']){const td=document.createElement('td');td.textContent=v;tr.append(td);}tbody.append(tr);});}
function finish(){mode='result';clearInputs();updateUI();audioUpdate();const points=score(state),record={map:map.id,name:storage.get('name','PILOT'),score:points,...stats(state)};const records=localRecords();records.push(record);storage.set('endless-v2-scores',records.slice(-100));
 const reason=state.reason==='health'?'车体受损，挑战结束。':state.reason==='grip'?'失去吸附，脱离赛道。':'掉出赛道，挑战结束。';
 modal(`<div class="eyebrow">ENDLESS RUN / ${map.en}</div><h2>${reason}</h2><div class="result-score">${points.toLocaleString()}<small> 本轮得分</small></div><div class="result-stats"><div><small>行驶距离</small><b>${(state.s/1000).toFixed(2)} km</b></div><div><small>驾驶时间</small><b>${timeText(state.time)}</b></div><div><small>穿环 / 漂移</small><b>${state.rings} / ${state.drifts}</b></div></div><p>翻滚 ${state.rolls} 次 · 擦身 ${state.nearMisses} 次 · 反重力路段 ${state.gripSections} 段<br>${state.reason==='grip'?'紫色路段提前开启吸地，记得留足气压。':state.reason==='health'?'提前刹车选线，或用喷气越过路障。':'断桥前按住跳跃；弯道提前刹车，别把方向打过头。'}</p><div class="name-row"><input id="pilotName" aria-label="驾驶员昵称" maxlength="16" placeholder="输入驾驶员昵称"><button class="primary" id="submitScore">提交排行榜 ↗</button></div><p class="status" id="submitStatus">本轮成绩已保存到本机${runId?'':' · 在线未连接，无法上传本轮成绩'}</p><div class="buttons"><button class="outline" id="resultHome">返回车库</button><button class="outline" id="resultBoard">排行榜</button><button class="primary" id="resultRetry">再来一局 ↗</button></div>`);
 $('resultHome').onclick=menu;$('resultBoard').onclick=()=>leaderboard();$('resultRetry').onclick=start;
 $('pilotName').value=storage.get('name','');$('submitScore').disabled=!runId;$('submitScore').onclick=async()=>{const name=$('pilotName').value.trim();if(!name){$('submitStatus').textContent='先输入一个昵称。';return;}const button=$('submitScore'),status=$('submitStatus');button.disabled=true;status.textContent='正在提交…';try{const r=await fetch('/api/scores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...record,name,run:runId,player})}),data=await r.json();if(!r.ok)throw Error(data.error);storage.set('name',name);record.name=name;storage.set('endless-v2-scores',records.slice(-100));status.textContent='成绩已进入无尽排行榜。';button.textContent='已提交 ✓';}catch(e){status.textContent=e.message||'提交失败，请重试';button.disabled=false;}};
}
function toggleSuction(){if(!['playing','countdown'].includes(mode))return;suction=!suction;updateUI();}
function triggerRoll(direction){if(mode==='playing'&&!suction){requestRoll(state,direction,map);updateUI();}}
const controls=['Space','ShiftLeft','ShiftRight','KeyA','KeyS','KeyD','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyF','KeyZ','KeyX'];
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;if(controls.includes(e.code)||['KeyE','Escape','KeyP','KeyC'].includes(e.code))e.preventDefault();keys[e.code]=true;if(e.repeat)return;if(e.code==='Escape'||e.code==='KeyP'){if(mode==='paused')resume();else if(['playing','countdown'].includes(mode))pause();else show('modal',false);}if(['playing','countdown'].includes(mode)){if(e.code==='KeyE')toggleSuction();if(e.code==='KeyZ')triggerRoll(1);if(e.code==='KeyX')triggerRoll(-1);if(e.code==='KeyC'){cameraMode=(cameraMode+1)%2;toast(cameraMode?'近距离追尾视角':'标准追尾视角');}}});
addEventListener('keyup',e=>{keys[e.code]=false;});addEventListener('blur',()=>{clearInputs();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
touchInput.bind($('boostBtn'),['ShiftLeft'],$('liftBtn'));
touchInput.bind($('liftBtn'),['Space']);
touchInput.bindAction($('suctionBtn'),toggleSuction);
touchInput.bindAction($('rollLeft'),()=>triggerRoll(1));touchInput.bindAction($('rollRight'),()=>triggerRoll(-1));
touchInput.bindAction($('pauseBtn'),pause);
document.querySelectorAll('[data-key]').forEach(b=>touchInput.bind(b,[b.dataset.key]));
$('startBtn').onclick=start;$('homeBtn').onclick=()=>{if(['playing','countdown'].includes(mode))pause();else menu();};$('garageBtn').onclick=garage;$('backGarage').onclick=menu;$('demoJets').onclick=()=>{demo=!demo;$('demoJets').textContent=demo?'停止喷气':'测试喷气';};$('leaderBtn').onclick=()=>leaderboard();$('helpBtn').onclick=help;$('settingsBtn').onclick=()=>{if(['playing','countdown'].includes(mode))pause();else settings();};$('soundBtn').onclick=toggleSound;$('closeModal').onclick=()=>{if(mode==='paused')resume();else if(mode==='result')menu();else show('modal',false);};document.querySelectorAll('[data-map]').forEach(b=>b.onclick=()=>selectMap(b.dataset.map));
canvas.addEventListener('pointerdown',e=>{if(mode==='garage'||mode==='menu'){drag=true;dragX=e.clientX;canvas.setPointerCapture(e.pointerId);}});canvas.addEventListener('pointermove',e=>{if(drag){angle+=(e.clientX-dragX)*.007;dragX=e.clientX;}});canvas.addEventListener('pointerup',()=>drag=false);canvas.addEventListener('pointercancel',()=>drag=false);canvas.addEventListener('wheel',e=>{if(mode==='garage'){e.preventDefault();zoom=clamp(zoom+e.deltaY*.001,.7,1.5);}},{passive:false});
addEventListener('resize',()=>{clearInputs();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
function updateUI(){
 const alt=Math.max(0,state.y-height(state.s,map)),section=gripSection(state.s),next=nextGrip(state.s),near=next&&next.a-state.s<160;
 const gap=gapsInRange(map,state.s,state.s+120).find(([a])=>a>state.s);
 $('speed').textContent=Math.round(state.v*3.6);$('timer').textContent=timeText(state.time);$('score').textContent=String(score(state)).padStart(5,'0');$('rings').textContent='◎ '+state.rings+' · ↝ '+state.drifts;
 $('distance').textContent=(state.s/1000).toFixed(2)+' KM / ∞';
 $('healthText').innerHTML=Math.ceil(state.health)+'<span>%</span>';$('airText').innerHTML=Math.ceil(state.air)+'<span>%</span>';$('healthBar').style.width=state.health+'%';$('airBar').style.width=state.air+'%';$('healthBar').style.background=state.health<=25?'#ff645f':'';$('airBar').style.background=state.air<20?'#ffc078':'';
 $('altitude').textContent=alt.toFixed(1);$('driveState').textContent=state.drifting?'DRIFT':state.miniTurbo?'TURBO':!state.grounded?'AIR':state.suction?'GRIP':'AUTO';
 $('suctionBtn').classList.toggle('on',suction);$('suctionBtn').classList.toggle('needed',!!(section||near));$('suctionBtn').setAttribute('aria-pressed',String(suction));
 $('gripHint').textContent=suction?(state.air<1?'气压不足':'−5% 气 / 秒'):'已关闭';
 $('boostBtn').classList.toggle('active',state.boost);$('liftBtn').classList.toggle('active',state.lift);
 $('boostBtn').classList.toggle('unavailable',state.air<.1);$('liftBtn').classList.toggle('unavailable',suction||!!section||state.air<.1);
 $('jumpHint').textContent=suction?'吸地已锁定':section?'路段已锁定':state.air<.1?'气压不足':'按住腾空';
 const airborne=!state.grounded&&alt>.2&&!section&&!state.failed;
 show('airControls',airborne);
 const rollReason=suction?'grip':rollAvailability(state,map),hint={ground:'腾空可用',air:'气压不足',busy:'翻滚中',low:'再升高一点',grip:'吸地已锁定'}[rollReason]||'10% 气 / 次';
 for(const [id,direction]of [['rollLeft',1],['rollRight',-1]]){$(id).disabled=!!rollReason;$(id).classList.toggle('active',state.autoRoll===direction);$(id+'Hint').textContent=hint;}
 $('trackStatus').textContent=section?section.name+' · '+(state.suction?'吸附中':state.air<1?'气压不足':'开启吸地'):near?Math.ceil(next.a-state.s)+'m · '+next.name+' · 吸地':gap?Math.ceil(gap[0]-state.s)+'m · 断桥 · '+(suction?'关闭吸地后跳跃':'按住跳跃'):'';
 $('trackStatus').classList.toggle('warning',!!(section&&!state.suction||near||gap));
 $('trickHud').classList.toggle('visible',state.drifting||state.miniTurbo>0||state.pendingRolls>0||state.combo>1);$('trickHud').dataset.tier=String(state.driftTier);
 $('trickLabel').textContent=state.drifting?['漂移蓄力','漂移 I · +8% 气','漂移 II · +16% 气','漂移 III · +24% 气'][state.driftTier+1]:state.miniTurbo?'出弯加速':state.pendingRolls?'翻滚 ×'+state.pendingRolls+' · 落地结算':state.combo>1?'CHAIN ×'+state.combo:'';
 $('trickFill').style.width=(state.drifting?Math.min(100,state.driftTime/2.2*100):state.comboTime/5*100)+'%';
 const c=$('minimap'),ctx=c.getContext('2d');ctx.clearRect(0,0,150,160);ctx.strokeStyle='#a1cac555';ctx.lineWidth=15;ctx.beginPath();for(let s=state.s-20;s<state.s+400;s+=5){const x=75+(center(s,map)-center(state.s,map))*.45,y=145-(s-state.s)*.32;if(s===state.s-20)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();ctx.fillStyle='#a4f5ce';ctx.beginPath();ctx.moveTo(75+state.x*1.5,136);ctx.lineTo(71+state.x*1.5,149);ctx.lineTo(79+state.x*1.5,149);ctx.closePath();ctx.fill();
}
function simulate(dt){const before=state.collisions,beforeHealth=state.health;step(state,{brake:pressed('KeyS')||pressed('ArrowDown'),steer:((pressed('KeyD')||pressed('ArrowRight')?1:0)-(pressed('KeyA')||pressed('ArrowLeft')?1:0))||steering.value,lift:pressed('Space'),boost:pressed('ShiftLeft')||pressed('ShiftRight'),suction,side:(pressed('KeyF')?1:0)-(pressed('KeyQ')?1:0)},dt,map);
 if(!state.failed){
  for(let i=0;i<world.ringData.length;i++){const r=world.ringData[i];if(!r.collected&&Math.abs(state.s-r.s)<2.8&&Math.hypot(state.x-r.x,state.y-height(state.s,map)+.7-r.y)<2.5){r.collected=true;world.ringMeshes[i].visible=false;collectRing(state);}}
  for(const o of world.obstacles){const lateral=Math.abs(state.x-o.x),alt=state.y-height(state.s,map);if(!o.hit&&Math.abs(state.s-o.s)<o.d/2+1.6&&lateral<o.w/2+.85&&alt<o.h&&state.invuln<=0){o.hit=true;damage(state);state.vx+=(state.x>=o.x?1:-1)*2;break;}if(!o.passed&&state.s>o.s+o.d/2+1.6){o.passed=true;const clearance=lateral-o.w/2-.85;if(!o.hit&&state.invuln===0&&state.v>26&&alt<o.h&&clearance>0&&clearance<1.6)nearMiss(state);}}
 }
 if(state.event&&state.event.id!==eventSeen){eventSeen=state.event.id;toast(state.event.message,1.5);}
 if(state.collisions>before){toast('碰撞 −'+(beforeHealth-state.health)+' 血',2);$('impact').style.opacity='1';setTimeout(()=>$('impact').style.opacity='0',180);}
 if(state.failed)finish();
}
let last=performance.now(),accumulator=0;const camTarget=new T.Vector3(),look=new T.Vector3();
function frame(now){requestAnimationFrame(frame);const raw=(now-last)/1000,dt=Math.min(raw,.05);last=now;elapsed+=dt;frames++;uiClock+=raw;
 if(uiClock>.5){fps=Math.round(frames/uiClock);$('fps').textContent=fps;$('menuFps').textContent=fps;frames=0;uiClock=0;}
 if(mode==='countdown'){countdown-=dt;$('countdown').textContent=countdown>0?String(Math.ceil(countdown)):'GO';if(countdown<=0){mode='playing';$('countdown').textContent='';toast('刹车＋转向漂移 · 穿环补气',2.5);}}
 if(mode==='playing'){world.update(state.s);accumulator+=dt;let n=0;while(accumulator>=1/120&&n++<8){simulate(1/120);accumulator-=1/120;if(mode!=='playing')break;}}else accumulator=0;
 if(mode==='menu'||mode==='garage'){
  if(!drag)angle+=dt*(mode==='garage'?.08:.018);car.position.set(1.4,.052+(demo?Math.sin(elapsed*2)*.03+.14:0),0);car.rotation.set(0,angle,0);const mobile=innerWidth<600;const framing=mobile?1.65:1;camTarget.set((mobile?12.8:8.3)*zoom,3.2*zoom*framing,(-8.8)*zoom*framing);camera.position.lerp(camTarget,Math.min(1,dt*5));look.set(mobile?1.4:4.3,mobile?1.6:.65,0);camera.lookAt(look);rim.intensity=2;
 }else{
  const alt=state.y-height(state.s,map),pos=pose(state.s,state.x,alt,map);car.position.copy(pos);const yaw=-Math.atan(slope(state.s,map));car.rotation.set(clamp((height(state.s+2,map)-height(state.s-2,map))/4,-.2,.2)+(state.lift?.07:0),yaw-state.vx*(state.drifting?.055:.018),bank(state.s)+clamp(-state.vx*.025,-.2,.2)+state.roll,'YXZ');car.visible=!(state.invuln>.1&&Math.floor(now/80)%2===0);
  const behind=cameraMode?6.7:11;camTarget.copy(pose(state.s-behind,state.x*.65,alt+(cameraMode?3.2:5.3),map));camera.position.lerp(camTarget,1-Math.exp(-dt*7));camera.up.lerp(trackUp(state.s,map),1-Math.exp(-dt*8)).normalize();look.copy(pose(state.s+3,state.x*.35,Math.max(alt,0)+.7,map));camera.lookAt(look);const targetFov=50+(state.boost?8:state.miniTurbo?4:0);camera.fov+=(targetFov-camera.fov)*dt*3;camera.updateProjectionMatrix();sun.position.copy(pos).addScaledVector(trackUp(state.s,map),27);sun.position.x-=14;sun.position.z-=12;sun.target.position.copy(pos);rim.position.copy(pos).addScaledVector(trackUp(state.s,map),8);rim.position.z+=12;rim.intensity=map.id==='orbit'?1.4:.8;

 }
 const d=car.userData,boost=mode==='playing'&&state.boost||demo,lift=mode==='playing'&&state.lift;d.jets.forEach(j=>{j.visible=boost;j.scale.y=.8+Math.random()*.45;});d.liftJets.forEach(j=>{j.visible=lift;j.scale.y=.6+Math.random()*.4;});d.wing.position.y+=((mode==='playing'&&state.suction?1.13:lift?1.04:.72)-d.wing.position.y)*dt*5;d.suction.visible=mode==='playing'&&state.suction&&state.grounded;d.sideJets.forEach(j=>{j.visible=mode==='playing'&&(state.side*j.userData.side<0||state.rolling);j.scale.y=.8+Math.random()*.3;});d.suction.material.opacity=.12+.1*Math.sin(elapsed*25);d.wheels.forEach(w=>{if(mode==='playing')w.rotation.x-=state.v*dt/.43;});if(boost||mode==='playing'&&state.miniTurbo)emit(false);if(lift)emit(true);if(mode==='playing'&&state.drifting)emitDrift();particles(dt);audioUpdate();
 if(now>toastUntil)$('message').style.opacity='0';if(mode==='playing'||mode==='countdown'){if(frames%4===0)updateUI();}
 renderer.render(scene,camera);
}
selectMap(selected);menu();camera.position.set(8.3,3.2,-8.8);requestAnimationFrame(frame);show('loading',false);
