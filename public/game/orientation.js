// Fullscreen belongs to the outer document, including the landscape iframe.
export function createFullscreenController(host = window.parent) {
  const doc = host.document, root = doc.documentElement;
  const displays = ['standalone', 'fullscreen'].map(mode => host.matchMedia(`(display-mode: ${mode})`));
  let pending = false;
  const mobile = () => host.matchMedia('(pointer:coarse)').matches || host.navigator.maxTouchPoints > 0;
  function state() {
    return {
      active: !!(doc.fullscreenElement || doc.webkitFullscreenElement),
      standalone: displays.some(query => query.matches) || host.navigator.standalone === true,
      supported: !!((root.requestFullscreen && doc.fullscreenEnabled !== false)
        || (root.webkitRequestFullscreen && doc.webkitFullscreenEnabled !== false)),
      pending,
    };
  }
  async function lockLandscape() {
    if (!mobile()) return;
    try { await host.screen.orientation?.lock?.('landscape'); }
    catch { /* CSS rotation remains available if orientation locking is denied. */ }
  }
  async function enter() {
    if (pending) return 'busy';
    const current = state();
    if (current.active || current.standalone) { void lockLandscape(); return current.active ? 'entered' : 'standalone'; }
    if (!current.supported) return 'unsupported';
    pending = true;
    try {
      if (root.requestFullscreen && doc.fullscreenEnabled !== false) await root.requestFullscreen({ navigationUI: 'hide' });
      else await root.webkitRequestFullscreen();
      if (!state().active) return 'denied';
      void lockLandscape();
      return 'entered';
    } catch { return 'denied'; }
    finally { pending = false; }
  }
  return {
    state,
    enter,
    async enterLandscape() {
      if (!mobile()) return 'windowed';
      const result = await enter();
      if (result === 'unsupported' || result === 'denied') void lockLandscape();
      return result;
    },
    async toggle() {
      if (pending) return 'busy';
      if (!state().active) return enter();
      pending = true;
      try {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
        return state().active ? 'denied' : 'exited';
      } catch { return 'denied'; }
      finally { pending = false; }
    },
    subscribe(listener) {
      const changed = () => listener(state());
      for (const name of ['fullscreenchange', 'webkitfullscreenchange']) doc.addEventListener(name, changed);
      for (const query of displays) query.addEventListener?.('change', changed);
      return () => {
        for (const name of ['fullscreenchange', 'webkitfullscreenchange']) doc.removeEventListener(name, changed);
        for (const query of displays) query.removeEventListener?.('change', changed);
      };
    },
  };
}
