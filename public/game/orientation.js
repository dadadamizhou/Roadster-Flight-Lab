export async function enterLandscape() {
  // Fullscreen requires the user's Start tap. CSS in the parent provides an
  // immediate landscape fallback before this call and when either API fails.
  if (!matchMedia('(pointer:coarse)').matches && navigator.maxTouchPoints === 0) return;
  const host = window.parent;
  try {
    if (!host.document.fullscreenElement && host.document.documentElement.requestFullscreen) {
      await host.document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch { /* Browser-managed fullscreen is optional. */ }
  try { await host.screen.orientation?.lock?.('landscape'); }
  catch { /* The game remains landscape through its rotated frame. */ }
}
