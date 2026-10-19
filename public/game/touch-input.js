// Each finger owns its input. Releasing one never releases another finger's key.
export function createTouchInput(enabled = () => true) {
  const pointers = new Map();
  const buttons = new Map();
  function paint() {
    for (const [button, codes] of buttons) {
      const active = [...pointers.values()].some(p => codes.length
        ? codes.every(code => p.codes.includes(code)) : p.button === button);
      button.classList.toggle('pressed', active);
    }
  }
  function release(id) { pointers.delete(id); paint(); }
  return {
    pressed(code) { for (const p of pointers.values()) if (p.codes.includes(code)) return true; return false; },
    clear() {
      const held = [...pointers.entries()];
      pointers.clear(); paint();
      for (const [id, p] of held) if (p.button.hasPointerCapture(id)) p.button.releasePointerCapture(id);
    },
    bindAction(button, action, { onRelease = false } = {}) {
      buttons.set(button, []);
      button.addEventListener('contextmenu', e => e.preventDefault());
      button.addEventListener('pointerdown', e => {
        if (!enabled() || button.disabled || e.button !== 0 || pointers.has(e.pointerId)) return;
        // Secondary fingers may never produce a click while the steering finger
        // stays down. Activate on this pointer's down event instead.
        e.preventDefault();
        pointers.set(e.pointerId, { button, codes: [] });
        button.setPointerCapture(e.pointerId);
        paint();
        if (!onRelease) action();
      });
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        button.addEventListener(event, e => {
          const held = pointers.get(e.pointerId);
          release(e.pointerId);
          // Touch fullscreen needs pointerup's user activation.
          if (onRelease && event === 'pointerup' && held?.button === button && enabled() && !button.disabled) action();
        });
      }
      button.addEventListener('click', e => {
        // A physical tap was already handled, even if its click arrives late.
        // Keep keyboard and assistive-technology activation (detail 0) working.
        if (e.detail !== 0 || e.pointerType) { e.preventDefault(); return; }
        if (enabled() && !button.disabled) action();
      });
    },
    bind(button, codes, slideTarget) {
      buttons.set(button, codes);
      button.addEventListener('contextmenu', e => e.preventDefault());
      button.addEventListener('pointerdown', e => {
        if (!enabled() || e.button !== 0) return;
        e.preventDefault();
        pointers.set(e.pointerId, { button, codes: [...codes], jumping: false });
        button.setPointerCapture(e.pointerId);
        paint();
      });
      button.addEventListener('pointermove', e => {
        const held = pointers.get(e.pointerId);
        if (!held || held.button !== button || !slideTarget || e.pointerType === 'mouse') return;
        const target = slideTarget.getBoundingClientRect(), origin = button.getBoundingClientRect();
        // Keep accelerating while the thumb slides upward to the jump circle.
        const boundary = (origin.top + target.bottom) / 2;
        const jump = e.clientY < boundary + (held.jumping ? 9 : -5)
          && e.clientX >= target.left - 24 && e.clientX <= target.right + 24;
        held.jumping = jump;
        held.codes = jump ? [...codes, 'Space'] : [...codes];
        paint();
      });
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        button.addEventListener(event, e => release(e.pointerId));
      }
    },
  };
}

// Independent axes: moving farther sideways must not take away the throttle.
export function stickAxes(dx, dy, radius) {
  const axis = (distance, dead, travel) => Math.sign(distance) * Math.min(1, Math.max(0, (Math.abs(distance) / radius - dead) / travel));
  return { steer: axis(dx, .16, .84), throttle: -axis(dy, .14, .56) };
}

// A floating origin lets the thumb land naturally; fixed placement is optional.
export function createSteeringInput(pad, enabled = () => true, { zone = pad, placement = () => 'fixed' } = {}) {
  let active = null, x = 0, y = 0, origin = null;
  function move(e) {
    const { centerX, centerY, radius } = origin;
    const dx = e.clientX - centerX, dy = e.clientY - centerY;
    ({ steer: x, throttle: y } = stickAxes(dx, dy, radius));
    // Only the picture is circular. Input axes retain their full range diagonally.
    const scale = Math.min(1, radius / (Math.hypot(dx, dy) || 1));
    pad.style.setProperty('--stick-x', (dx * scale).toFixed(1) + 'px');
    pad.style.setProperty('--stick-y', (dy * scale).toFixed(1) + 'px');
  }
  function release(e) {
    if (e && e.pointerId !== active) return;
    const id = active; active = null; origin = null; x = 0; y = 0;
    for (const prop of ['--stick-x','--stick-y','--base-x','--base-y']) pad.style.setProperty(prop, '0px');
    pad.classList.toggle('pressed', false);
    if (id !== null && zone.hasPointerCapture(id)) zone.releasePointerCapture(id);
  }
  zone.addEventListener('contextmenu', e => e.preventDefault());
  zone.addEventListener('pointerdown', e => {
    if (!enabled() || active !== null || e.button !== 0) return;
    e.preventDefault(); active = e.pointerId; zone.setPointerCapture(active);
    const rect = pad.getBoundingClientRect(), baseX = rect.left + rect.width / 2, baseY = rect.top + rect.height / 2;
    const floating = placement() === 'floating';
    origin = { centerX: floating ? e.clientX : baseX, centerY: floating ? e.clientY : baseY, radius: rect.width * .34 };
    pad.style.setProperty('--base-x', (origin.centerX - baseX).toFixed(1) + 'px');
    pad.style.setProperty('--base-y', (origin.centerY - baseY).toFixed(1) + 'px');
    pad.classList.toggle('pressed', true); move(e);
  });
  zone.addEventListener('pointermove', e => { if (e.pointerId === active) move(e); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(event, release);
  return { get value() { return x; }, get throttle() { return y; }, get active() { return active !== null; }, clear() { release(); } };
}

// Softer small corrections, while preserving full lock in every preset.
export function steeringResponse(value, preset = 'balanced') {
  const v = Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
  const power = preset === 'soft' ? 1.4 : preset === 'direct' ? .8 : 1;
  return Math.sign(v) * Math.abs(v) ** power;
}
