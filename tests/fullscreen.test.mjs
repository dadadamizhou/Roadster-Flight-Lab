import assert from 'node:assert/strict';
import {createFullscreenController} from '../public/game/orientation.js';
function host({mobile=true,supported=true,prefixed=false,standalone=false,denied=false,lockDenied=false}={}){
 const document=new EventTarget(),queries=new Map(),calls=[];
 document.documentElement={};document.fullscreenElement=null;document.webkitFullscreenElement=null;
 const change=()=>document.dispatchEvent(new Event(prefixed?'webkitfullscreenchange':'fullscreenchange'));
 const request=async options=>{calls.push(['enter',options]);if(denied)throw Error('denied');document[prefixed?'webkitFullscreenElement':'fullscreenElement']=document.documentElement;change();};
 const exit=async()=>{calls.push(['exit']);document.fullscreenElement=document.webkitFullscreenElement=null;change();};
 if(supported){document.documentElement[prefixed?'webkitRequestFullscreen':'requestFullscreen']=request;document[prefixed?'webkitExitFullscreen':'exitFullscreen']=exit;}
 return {document,calls,navigator:{maxTouchPoints:mobile?5:0,standalone},screen:{orientation:{lock:async mode=>{calls.push(['lock',mode]);if(lockDenied)throw Error('no lock');}}},matchMedia(query){if(!queries.has(query)){const media=new EventTarget();media.matches=query==='(pointer:coarse)'&&mobile;queries.set(query,media);}return queries.get(query);}};
}
let h=host(),c=createFullscreenController(h),changes=[];
const unsubscribe=c.subscribe(s=>changes.push(s.active));
const entered=c.enter();assert.equal(h.calls[0][0],'enter','request is invoked synchronously in the user gesture');
assert.equal(await c.toggle(),'busy','double taps cannot race entry against exit');
assert.equal(await entered,'entered');assert(c.state().active);assert.deepEqual(h.calls[0][1],{navigationUI:'hide'});assert(h.calls.some(([name,mode])=>name==='lock'&&mode==='landscape'));
assert.equal(await c.toggle(),'exited');assert(!c.state().active);assert.deepEqual(changes,[true,false]);
unsubscribe();await c.enter();assert.equal(changes.length,2,'subscription can be cleaned up');
h=host({prefixed:true});c=createFullscreenController(h);assert.equal(await c.enterLandscape(),'entered');assert.equal(await c.toggle(),'exited');
h=host({supported:false});c=createFullscreenController(h);assert.equal(await c.enter(),'unsupported');assert(!c.state().active);assert(!h.calls.some(([n])=>n==='enter'));
h=host({denied:true});c=createFullscreenController(h);assert.equal(await c.enter(),'denied');assert(!c.state().active&&!c.state().pending);assert.equal(await c.enter(),'denied','failed request can be retried');
h=host({lockDenied:true});c=createFullscreenController(h);assert.equal(await c.enter(),'entered','orientation failure does not undo successful fullscreen');
h=host({standalone:true,supported:false});c=createFullscreenController(h);assert(c.state().standalone);assert.equal(await c.toggle(),'standalone');assert(!h.calls.some(([n])=>n==='enter'));
h=host();h.matchMedia('(display-mode: standalone)').matches=true;c=createFullscreenController(h);assert.equal(await c.enter(),'standalone');
h=host({mobile:false});c=createFullscreenController(h);assert.equal(await c.enterLandscape(),'windowed','desktop Start does not unexpectedly enter fullscreen');assert.equal(h.calls.length,0);assert.equal(await c.toggle(),'entered','desktop explicit fullscreen still works');assert(!h.calls.some(([n])=>n==='lock'));
h=host();h.document.fullscreenEnabled=false;c=createFullscreenController(h);assert.equal(await c.enter(),'unsupported','permissions-policy denial is detected');
h=host();h.document.documentElement.requestFullscreen=async()=>{};c=createFullscreenController(h);assert.equal(await c.enter(),'denied','resolved promise alone is not evidence of fullscreen');
h=host();c=createFullscreenController(h);await c.enter();h.document.exitFullscreen=async()=>{throw Error('exit refused');};assert.equal(await c.toggle(),'denied');assert(c.state().active&&!c.state().pending);
console.log('Fullscreen: enter/exit, gesture timing, duplicate taps, browser refusal, WebKit fallback, orientation failure and home-screen mode passed.');
