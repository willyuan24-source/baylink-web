/** Recover one time from an outdated deployment's missing module, without reload loops. */
export function installChunkRecovery(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('vite:preloadError', event => {
    if (!navigator.onLine) return;
    const key = `baylink.chunk-reload:${location.pathname}`;
    try {
      const previous = Number(sessionStorage.getItem(key));
      if (previous && Date.now() - previous < 5 * 60_000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch { return; }
    event.preventDefault();
    location.reload();
  });
}
