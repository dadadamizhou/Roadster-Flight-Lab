// Fullscreen belongs to the outer document, including the landscape iframe.
export function createFullscreenController(host = window.parent, { timeout = 3500 } = {}) {
  const doc = host.document, root = doc.documentElement;
  const displays = ['standalone', 'fullscreen'].map(mode => host.matchMedia(`(display-mode: ${mode})`));
  const events = ['fullscreenchange', 'webkitfullscreenchange'];
  let pending = false, lastError = '';
  const mobile = () => host.matchMedia('(pointer:coarse)').matches || host.navigator.maxTouchPoints > 0;
  function state() {
    const ua = host.navigator.userAgent || '';
    const active = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
    return {
      active,
      standalone: !active && (displays.some(query => query.matches) || host.navigator.standalone === true),
      supported: !!((root.requestFullscreen && doc.fullscreenEnabled !== false)
        || (root.webkitRequestFullscreen && doc.webkitFullscreenEnabled !== false)),
      apple: /iPhone|iPad|iPod/.test(ua) || (host.navigator.platform === 'MacIntel' && host.navigator.maxTouchPoints > 1),
      embedded: /MicroMessenger|QQ\/|QQBrowser.*Mobile.*WebView|Instagram|FBAN|FBAV|; wv\)/i.test(ua),
      pending, lastError,
    };
  }
  async function lockLandscape() {
    if (!mobile()) return;
    try { await host.screen.orientation?.lock?.('landscape'); }
    catch { /* The landscape CSS fallback is independent of fullscreen. */ }
  }
  // Older WebKit returns void, then changes fullscreen asynchronously. Observe
  // the actual transition instead of treating a missing Promise as failure.
  function transition(active, invoke) {
    return new Promise(resolve => {
      let finished = false, timer;
      const clean = result => {
        if (finished) return;
        finished = true; clearTimeout(timer);
        for (const name of events) doc.removeEventListener(name, changed);
        for (const name of ['fullscreenerror','webkitfullscreenerror']) doc.removeEventListener(name, failed);
        resolve(result);
      };
      const changed = () => { if (state().active === active) clean(active ? 'entered' : 'exited'); };
      const failed = () => { if (!finished) { lastError = 'denied'; clean('denied'); } };
      for (const name of events) doc.addEventListener(name, changed);
      for (const name of ['fullscreenerror','webkitfullscreenerror']) doc.addEventListener(name, failed);
      timer = setTimeout(() => { lastError = 'timeout'; clean('denied'); }, timeout);
      try {
        // Invocation stays in the native click's user-activation call stack.
        const result = invoke();
        changed();
        if (result?.then) result.then(changed, failed);
      } catch { failed(); }
    });
  }
  async function enter() {
    if (pending) return 'busy';
    const current = state();
    if (current.active || current.standalone) { void lockLandscape(); return current.active ? 'entered' : 'standalone'; }
    if (!current.supported) return 'unsupported';
    pending = true; lastError = '';
    try {
      const result = await transition(true, () => {
        if (root.requestFullscreen && doc.fullscreenEnabled !== false) {
          try { return root.requestFullscreen({ navigationUI: 'hide' }); }
          catch (error) {
            // Some older implementations reject the options argument synchronously.
            if (error?.name === 'TypeError') return root.requestFullscreen();
            throw error;
          }
        }
        return root.webkitRequestFullscreen();
      });
      if (result === 'entered') void lockLandscape();
      return result;
    } finally { pending = false; }
  }
  return {
    state, enter,
    async enterLandscape() {
      if (!mobile()) return 'windowed';
      const result = await enter();
      if (result === 'unsupported' || result === 'denied') void lockLandscape();
      return result;
    },
    async toggle() {
      if (pending) return 'busy';
      if (!state().active) return enter();
      pending = true; lastError = '';
      try {
        return await transition(false, () => {
          if (doc.exitFullscreen) return doc.exitFullscreen();
          if (doc.webkitExitFullscreen) return doc.webkitExitFullscreen();
          throw Error('No fullscreen exit');
        });
      } finally { pending = false; }
    },
    subscribe(listener) {
      const changed = () => listener(state());
      for (const name of events) doc.addEventListener(name, changed);
      for (const query of displays) query.addEventListener?.('change', changed);
      return () => {
        for (const name of events) doc.removeEventListener(name, changed);
        for (const query of displays) query.removeEventListener?.('change', changed);
      };
    },
  };
}
