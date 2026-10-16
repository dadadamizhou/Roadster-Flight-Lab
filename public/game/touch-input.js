// Each finger owns its input. Releasing one never releases another finger's key.
export function createTouchInput(enabled = () => true) {
  const pointers = new Map();
  const buttons = new Map();
  function paint() {
    for (const [button, codes] of buttons) {
      const active = [...pointers.values()].some(p => codes.every(code => p.codes.includes(code)));
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
    bind(button, codes, slideTarget) {
      buttons.set(button, codes);
      button.addEventListener('contextmenu', e => e.preventDefault());
      button.addEventListener('pointerdown', e => {
        if (!enabled() || e.button !== 0) return;
        e.preventDefault();
        pointers.set(e.pointerId, { button, codes: [...codes] });
        button.setPointerCapture(e.pointerId);
        paint();
      });
      button.addEventListener('pointermove', e => {
        const held = pointers.get(e.pointerId);
        if (!held || held.button !== button || !slideTarget || e.pointerType === 'mouse') return;
        const target = slideTarget.getBoundingClientRect(), origin = button.getBoundingClientRect();
        // Keep accelerating while the thumb slides upward to the jump circle.
        const jump = e.clientY < (origin.top + target.bottom) / 2
          && e.clientX >= target.left - 24 && e.clientX <= target.right + 24;
        held.codes = jump ? [...codes, 'Space'] : [...codes];
        paint();
      });
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        button.addEventListener(event, e => release(e.pointerId));
      }
    },
  };
}

// A one-axis steering stick: small drags give gentle turns, release recenters.
export function createSteeringInput(pad, enabled = () => true) {
  let active = null, value = 0;
  function move(e) {
    const rect = pad.getBoundingClientRect(), radius = rect.width * .27;
    const raw = Math.max(-1, Math.min(1, (e.clientX - rect.left - rect.width / 2) / radius));
    value = Math.abs(raw) < .1 ? 0 : Math.sign(raw) * (Math.abs(raw) - .1) / .9;
    pad.style.setProperty('--stick-x', (raw * radius).toFixed(1) + 'px');
  }
  function release(e) {
    if (e && e.pointerId !== active) return;
    const id = active; active = null; value = 0;
    pad.style.setProperty('--stick-x', '0px'); pad.classList.toggle('pressed', false);
    if (id !== null && pad.hasPointerCapture(id)) pad.releasePointerCapture(id);
  }
  pad.addEventListener('contextmenu', e => e.preventDefault());
  pad.addEventListener('pointerdown', e => {
    if (!enabled() || active !== null || e.button !== 0) return;
    e.preventDefault(); active = e.pointerId; pad.setPointerCapture(active);
    pad.classList.toggle('pressed', true); move(e);
  });
  pad.addEventListener('pointermove', e => { if (e.pointerId === active) move(e); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(event, release);
  return { get value() { return value; }, clear() { release(); } };
}
