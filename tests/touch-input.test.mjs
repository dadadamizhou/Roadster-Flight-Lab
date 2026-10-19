import assert from 'node:assert/strict';
import { createTouchInput, createSteeringInput, steeringResponse, stickAxes } from '../public/game/touch-input.js';
import { fresh, step, MAPS } from '../public/game/physics.js';

class Button extends EventTarget {
  constructor(top) {
    super(); this.top = top; this.captured = new Set(); this.classes = new Set();
    this.classList = { toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name) };
    this.properties = new Map(); this.style = { setProperty: (name, value) => this.properties.set(name, value) };
  }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); this.send('lostpointercapture', id); }
  getBoundingClientRect() { return { left: 280, right: 372, width: 92, height: 76, top: this.top, bottom: this.top + 76 }; }
  send(type, pointerId, extra = {}) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId, pointerType: 'touch', button: 0, clientX: 320, clientY: 780 }, extra);
    this.dispatchEvent(event);
  }
}
let enabled = true;
const input = createTouchInput(() => enabled), boost = new Button(730), jump = new Button(640), left = new Button(760);
input.bind(boost, ['ShiftLeft', 'KeyW'], jump); input.bind(jump, ['Space']); input.bind(left, ['ArrowLeft']);
boost.send('pointerdown', 1); jump.send('pointerdown', 2); left.send('pointerdown', 3);
assert.ok(input.pressed('ShiftLeft') && input.pressed('Space') && input.pressed('ArrowLeft'));
jump.send('pointerup', 2);
assert.ok(input.pressed('ShiftLeft') && input.pressed('ArrowLeft')); assert.equal(input.pressed('Space'), false);
boost.send('pointermove', 1, { clientY: 680 });
assert.ok(input.pressed('Space') && input.pressed('ShiftLeft'));
assert.ok(jump.classes.has('pressed'), 'Slide gesture lights the jump button immediately');
jump.send('pointerdown', 4); jump.send('pointerup', 4);
assert.ok(input.pressed('Space'), 'Releasing a second finger must not cancel the slide combo');
boost.send('pointermove', 1, { clientY: 770 });
assert.equal(input.pressed('Space'), false); assert.ok(input.pressed('ShiftLeft'));
boost.send('pointercancel', 1);
assert.equal(input.pressed('ShiftLeft'), false); assert.ok(input.pressed('ArrowLeft'));
left.send('lostpointercapture', 3); assert.equal(input.pressed('ArrowLeft'), false);
boost.send('pointerdown', 5); jump.send('pointerdown', 6); input.clear();
assert.equal(input.pressed('KeyW'), false); assert.equal(input.pressed('Space'), false);
assert.equal(boost.classes.size, 0); assert.equal(jump.classes.size, 0);
enabled = false; boost.send('pointerdown', 7); assert.equal(input.pressed('ShiftLeft'), false);
enabled = true; boost.send('pointerdown', 8, { button: 2 }); assert.equal(input.pressed('ShiftLeft'), false);
boost.send('pointerdown', 9, { pointerType: 'mouse' }); boost.send('pointermove', 9, { pointerType: 'mouse', clientY: 680 });
assert.equal(input.pressed('Space'), false, 'Mouse clicks do not accidentally trigger a slide gesture');
const car = fresh(MAPS.city); car.air = 0;
for (let i = 0; i < 120; i++) step(car, { throttle: input.pressed('KeyW') ? 1 : 0, boost: input.pressed('ShiftLeft') }, 1 / 120, MAPS.city);
assert.ok(car.v > 10 && !("battery" in car) && car.air === 0, 'Manual motor drive still works when air is empty');
input.clear();
const pad = new Button(240);
const sendPad=pad.send.bind(pad);pad.send=(type,id,extra={})=>sendPad(type,id,{clientY:278,...extra});
const steering = createSteeringInput(pad, () => enabled);
pad.send('pointerdown', 11, { clientX: 326 }); assert.equal(steering.value, 0);
pad.send('pointermove', 11, { clientX: 338 }); assert.ok(steering.value > .2 && steering.value < .4);
pad.send('pointerdown', 12, { clientX: 280 }); assert.ok(steering.value > 0, 'A second finger must not hijack the steering stick');
pad.send('pointermove', 11, { clientX: 1000 }); assert.equal(steering.value, 1);
pad.send('pointermove', 11, { clientX: 0 }); assert.equal(steering.value, -1);
pad.send('pointerup', 12); assert.equal(steering.value, -1);
pad.send('pointercancel', 11); assert.equal(steering.value, 0); assert.equal(pad.properties.get('--stick-x'), '0px');
pad.send('pointerdown', 13, { clientX: 350 }); steering.clear(); assert.equal(steering.value, 0); assert.equal(pad.classes.size, 0);
enabled = false; pad.send('pointerdown', 14, { clientX: 350 }); assert.equal(steering.value, 0);
enabled = true;
pad.send('pointerdown', 15, {clientX:326, clientY:250});assert.equal(steering.value,0);assert.equal(steering.throttle,1);
pad.send('pointermove',15,{clientX:329,clientY:250});assert.equal(steering.value,0,'small thumb wobble on full throttle stays inside steering dead zone');assert.equal(steering.throttle,1);
pad.send('pointermove', 15, {clientX:326, clientY:310});assert.equal(steering.throttle,-1);
pad.send('pointermove', 15, {clientX:350, clientY:254});assert(steering.value>.7&&steering.value<.8&&steering.throttle===1,'diagonal keeps full throttle with independent steering');
pad.send('pointermove', 15, {clientX:302, clientY:302});assert(steering.value<0&&steering.throttle<0);
pad.send('pointercancel',15);assert.equal(steering.throttle,0);assert.equal(pad.properties.get('--stick-y'),'0px');
// Keep the first finger steering throughout: secondary touches intentionally
// have no click event, as on phones with an ongoing primary touch.
enabled = true;
let suction = false, toggles = 0, rolls = 0;
const grip = new Button(640), roll = new Button(550), pause = new Button(20), brake = new Button(730);
input.bind(brake,['KeyB']);
input.bindAction(grip, () => { suction = !suction; toggles++; });
input.bindAction(roll, () => { rolls++; });
input.bindAction(pause, () => { enabled = false; input.clear(); steering.clear(); });
pad.send('pointerdown', 20, { isPrimary: true, clientX: 350, clientY: 254 });
const heldSteering = steering.value, heldThrottle = steering.throttle;assert(heldThrottle > .5);
boost.send('pointerdown', 21, { isPrimary: false });
brake.send('pointerdown',30,{isPrimary:false});
assert(input.pressed('KeyB')&&steering.throttle===heldThrottle,'drift brake can be held while steering and giving throttle');
assert(!grip.classes.has('pressed'), 'Holding acceleration must not light action buttons');
grip.send('pointerdown', 22, { isPrimary: false });
assert(suction && toggles === 1, 'Secondary finger switches grip immediately without a click');
assert.equal(steering.value, heldSteering); assert.equal(steering.throttle, heldThrottle); assert(input.pressed('ShiftLeft'));
assert(input.pressed('KeyB'),'grip toggle cannot release the held drift brake');
brake.send('pointerup',30,{isPrimary:false});
assert(!input.pressed('KeyB')&&steering.value===heldSteering&&input.pressed('ShiftLeft'),'ending drift releases only the brake finger');
assert(grip.classes.has('pressed'));
grip.send('pointerdown', 22, { isPrimary: false });
assert.equal(toggles, 1, 'Repeated down for the same held pointer must not toggle again');
grip.send('pointerup', 22, { isPrimary: false });
assert(!grip.classes.has('pressed'));
grip.send('pointerdown', 23, { isPrimary: false });
grip.send('pointerup', 23, { isPrimary: false });
assert(!suction && toggles === 2, 'Grip can also be switched off without releasing steering');
for (const pointerType of ['touch', 'mouse', 'pen']) {
  grip.send('pointerdown', 24, { pointerType });
  grip.send('pointerup', 24, { pointerType });
  const count = toggles;
  grip.send('click', 24, { pointerType, detail: 1 });
  grip.send('click', 24, { pointerType: '', detail: 1 });
  assert.equal(toggles, count, 'Compatibility clicks must not undo the toggle');
}
const count = toggles;
grip.send('click', -1, { pointerType: '', detail: 0 });
assert.equal(toggles, count + 1, 'Keyboard/assistive click remains supported');
roll.disabled = true; roll.send('pointerdown', 25, { isPrimary: false });
assert.equal(rolls, 0, 'Unavailable stunts ignore pointer input');
roll.disabled = false; roll.send('pointerdown', 25, { isPrimary: false });
roll.send('pointercancel', 25); roll.send('click', 25, { detail: 1 });
assert.equal(rolls, 1); assert(!roll.classes.has('pressed'));
grip.send('pointerdown', 26, { isPrimary: false });
grip.send('lostpointercapture', 26); assert(!grip.classes.has('pressed'));
assert.equal(steering.value, heldSteering); assert.equal(steering.throttle, heldThrottle); assert(input.pressed('ShiftLeft'));
pause.send('pointerdown', 27, { isPrimary: false });
assert(!enabled && steering.value === 0 && !input.pressed('ShiftLeft'));
assert(!pause.hasPointerCapture(27) && !pause.classes.has('pressed'));
const pausedCount = toggles;
grip.send('pointerdown', 28); grip.send('click', -1, { pointerType: '', detail: 0 });
assert.equal(toggles, pausedCount, 'Paused controls cannot activate');
enabled = true;
grip.send('pointerup', 26); grip.send('click', 26, { detail: 1 });
assert.equal(toggles, pausedCount, 'Late events after resume cannot retrigger an action');
grip.send('pointerdown', 29, { button: 2 }); assert.equal(toggles, pausedCount);
console.log('Touch controls: simultaneous steering/boost/grip/stunts, single activation, keyboard access, cancellation, pause cleanup and empty-air driving passed.');

// Browser chrome moves the pad, but the active finger keeps its input origin.
pad.send('pointerdown',40,{clientX:350,clientY:254});
const beforeResize={x:steering.value,y:steering.throttle};pad.top+=50;
pad.send('pointermove',40,{clientX:350,clientY:254});
assert.equal(steering.value,beforeResize.x);assert.equal(steering.throttle,beforeResize.y);
pad.send('pointerup',40);pad.send('pointerdown',41,{clientX:326,clientY:328});assert.equal(steering.value,0);assert.equal(Math.abs(steering.throttle),0,'next gesture uses the new layout');steering.clear();pad.top-=50;
// Hysteresis prevents jump flicker around the border between two circles.
boost.send('pointerdown',42);boost.send('pointermove',42,{clientY:720});assert(!input.pressed('Space'));
boost.send('pointermove',42,{clientY:700});assert(input.pressed('Space'));
for(const y of [711,718,726,720]){boost.send('pointermove',42,{clientY:y});assert(input.pressed('Space'),'small boundary wobble preserves jump');}
boost.send('pointermove',42,{clientY:735});assert(!input.pressed('Space'));input.clear();
// Fullscreen activates on touch release, including non-primary fingers.
const display=new Button(0),uiInput=createTouchInput();let requests=0;
uiInput.bindAction(display,()=>requests++,{onRelease:true});
display.send('pointerdown',50,{isPrimary:false});assert.equal(requests,0);
display.send('pointerup',50,{isPrimary:false});assert.equal(requests,1);
display.send('click',50,{detail:1});assert.equal(requests,1);
display.send('pointerdown',51);display.send('pointercancel',51);display.send('pointerup',51);assert.equal(requests,1);
display.send('pointerdown',52);uiInput.clear();display.send('pointerup',52);assert.equal(requests,1);
display.send('click',-1,{pointerType:'',detail:0});assert.equal(requests,2,'keyboard activation works');
for(const preset of ['soft','balanced','direct']){
 for(const value of [-1,-.7,-.2,0,.2,.7,1])assert(Math.abs(steeringResponse(value,preset))<=1);
 assert.equal(steeringResponse(1,preset),1);assert.equal(steeringResponse(-1,preset),-1);assert.equal(steeringResponse(0,preset),0);
}
assert(steeringResponse(.3,'soft')<steeringResponse(.3,'balanced'));assert(steeringResponse(.3,'direct')>steeringResponse(.3,'balanced'));
assert.equal(steeringResponse(.4,'unknown'),.4);assert.equal(steeringResponse(NaN),0);
console.log('Stable joystick during resize, jump gesture hysteresis, release-activated UI and steering presets passed.');

// Independent motor/steering axes keep the pedal steady across the whole arc.
for(const dx of [-150,-45,-20,0,20,45,150]) {
 assert.equal(stickAxes(dx,-32,40).throttle,1);
 assert.equal(stickAxes(dx,32,40).throttle,-1);
}
assert.equal(stickAxes(120,-32,40).steer,1);
assert.equal(stickAxes(0,0,40).steer,0);
const floatingPad=new Button(240),zone=new Button(220);
let placement='floating';
const floating=createSteeringInput(floatingPad,()=>true,{zone,placement:()=>placement});
zone.send('pointerdown',70,{clientX:306,clientY:270});
assert.equal(floating.value,0);assert.equal(Math.abs(floating.throttle),0,'touch anywhere starts neutral instead of jumping the steering');
zone.send('pointermove',70,{clientX:306,clientY:244});assert.equal(floating.value,0);assert.equal(floating.throttle,1);
zone.send('pointermove',70,{clientX:354,clientY:244});assert.equal(floating.value,1);assert.equal(floating.throttle,1);
zone.send('pointermove',71,{clientX:280,clientY:300});assert.equal(floating.value,1,'another finger cannot move the origin');
zone.send('pointerup',70);assert(!floating.active&&floating.value===0&&floating.throttle===0);
zone.send('pointerdown',72,{clientX:350,clientY:290});assert.equal(floating.value,0);assert.equal(Math.abs(floating.throttle),0,'new thumb placement gets a fresh origin');
zone.send('pointermove',72,{clientX:350,clientY:320});assert.equal(floating.throttle,-1);
floating.clear();assert(!zone.hasPointerCapture(72));
placement='fixed';zone.send('pointerdown',73,{clientX:326,clientY:250});assert.equal(floating.throttle,1,'fixed control remains available');floating.clear();
console.log('Floating thumb origin, neutral touchdown, independent diagonal throttle, reverse and multi-touch ownership passed.');
