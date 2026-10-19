// Save and plan confirmations for screen readers (the visible toast is `SaveToast`). Styles: `.saves-live` in
// src/features/saves/saves.css (visually hidden).
let region: HTMLElement | null = null;

/**
 * The one live region for save and plan confirmations. Controls call this when tapped, before their write, so the
 * region is in the page before its text: some screen readers stay silent for a region inserted with its message.
 */
export function prepareSaveAnnouncer(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (!region?.isConnected) {
    region = document.createElement('div');
    region.className = 'saves-live';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('data-testid', 'save-announcer');
    document.body.appendChild(region);
  }
  return region;
}

/** Say the message in the waiting region (emptied first, so the same words twice are read twice). */
export function announce(message: string): () => void {
  const live = prepareSaveAnnouncer();
  if (!live) return () => {};
  live.textContent = '';
  const timer = window.setTimeout(() => { live.textContent = message; }, 150);
  return () => { window.clearTimeout(timer); if (live.textContent === message) live.textContent = ''; };
}
