/** Where an agreed tester code is remembered (tester-mode.ts reads and writes it). */
export const TESTER_STORAGE_KEY = 'baylink.tester.v1';

/**
 * Boot step (product-observer), small on purpose because every page runs it: take ?tester= out of the address bar before
 * the router reads it, so a shared link never carries the code; then, only for a tester link or a remembered tester,
 * load tester-mode.ts (consent sheet, 反馈 button). Everyone else downloads nothing. The 3D world is skipped.
 */
export function bootTesterMode(bare: boolean): void {
  if (typeof window === 'undefined' || bare) return;
  const url = new URL(window.location.href);
  const requested = url.searchParams.get('tester');
  if (requested !== null) {
    url.searchParams.delete('tester');
    try { window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash); } catch { /* Keep the URL. */ }
  }
  let remembered = false;
  try { remembered = !!localStorage.getItem(TESTER_STORAGE_KEY); } catch { /* Blocked storage: no remembered tester. */ }
  if (requested === null && !remembered) return;
  void import('./tester-mode').then(mode => mode.showTesterUi(requested)).catch(() => { /* Tester extras are optional. */ });
}
