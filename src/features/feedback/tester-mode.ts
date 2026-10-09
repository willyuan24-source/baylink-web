/**
 * Tester mode for the R1 study. A link with ?tester=T07 asks the reader for consent first (TesterConsentSheet); only
 * after "agree" does this browser remember the code for 30 days and show the floating 反馈 button on every page. The
 * code is shown in the feedback form's contact field, where the tester can see, edit or clear it, and nowhere else:
 * page counters and error beacons never carry it. Storage may be blocked; every access is guarded and tester mode then
 * simply lasts for the page.
 */
export const TESTER_STORAGE_KEY = 'baylink.tester.v1';
export const TESTER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TESTER_CODE = /^T\d{2,3}$/;

export type TesterRecord = { id: string; until: number };
let memory: TesterRecord | null = null;

/** 'T07' from '?tester=t07', or null for anything that is not a tester code. */
export const testerCode = (value: string | null | undefined): string | null => {
  const code = (value || '').trim().toUpperCase();
  return TESTER_CODE.test(code) ? code : null;
};

export function activeTester(now = Date.now()): TesterRecord | null {
  if (memory && memory.until > now) return memory;
  try {
    const stored = JSON.parse(localStorage.getItem(TESTER_STORAGE_KEY) || 'null') as Partial<TesterRecord> | null;
    const id = testerCode(stored?.id);
    if (id && typeof stored?.until === 'number' && stored.until > now) return (memory = { id, until: stored.until });
    if (stored) localStorage.removeItem(TESTER_STORAGE_KEY);
  } catch { /* Blocked storage: no remembered tester. */ }
  return null;
}

export function startTesterMode(id: string, now = Date.now()): TesterRecord {
  memory = { id, until: now + TESTER_TTL_MS };
  try { localStorage.setItem(TESTER_STORAGE_KEY, JSON.stringify(memory)); } catch { /* Lasts for this page only. */ }
  return memory;
}

export function endTesterMode(): void {
  memory = null;
  try { localStorage.removeItem(TESTER_STORAGE_KEY); } catch { /* Nothing stored. */ }
}

/**
 * Boot step (product-observer): take ?tester= out of the address bar before the router reads it, so a shared link never
 * carries the code, then load the consent sheet; a remembered tester gets the floating button. The 3D world is skipped.
 */
export function bootTesterMode(bare: boolean): void {
  if (typeof window === 'undefined' || bare) return;
  const url = new URL(window.location.href);
  const requested = url.searchParams.has('tester') ? testerCode(url.searchParams.get('tester')) : null;
  if (url.searchParams.has('tester')) {
    url.searchParams.delete('tester');
    try { window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash); } catch { /* Keep the URL. */ }
  }
  const remembered = activeTester();
  if (!requested && !remembered) return;
  void import('./feedback-host').then(host => {
    if (requested && requested !== remembered?.id) host.showTesterConsent(requested);
    else host.showTesterButton();
  }).catch(() => { /* Tester extras are optional; the site works without them. */ });
}
