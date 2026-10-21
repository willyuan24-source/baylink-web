// The BayBay panel's chunk (OverlayHost's BayBayAssistantEntry): one loader for the lazy dialog and for the warm-up that
// every 问 BayBay trigger in the chrome starts on pointerenter / pointerdown / focus (BB launcher item d), so the panel is
// usually loaded by the time the tap lands. A failed warm-up is forgotten and tried again on the next hover.
export const loadBayBayPanel = () => import('../components/BayBayAssistantEntry');

let warm: Promise<unknown> | null = null;
export function preloadBayBay(): void {
  if (warm) return;
  warm = loadBayBayPanel().catch(() => { warm = null; });
}
/** Whether a warm-up has started (tests). */
export const isBayBayWarm = (): boolean => warm !== null;
