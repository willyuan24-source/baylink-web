/**
 * W7-Q-review · where a phone sheet's drag starts (ui/common.tsx Sheet). Pure: node-tested.
 *
 * At rest a phone sheet is at least SHEET_FLOOR_PX tall (opus-bay.css, W7-Q7: the shop's 38 % snap was a sliver on short
 * screens), but that floor is off while dragging (`.ob-sheet.is-dragging` follows `--ob-sheet-h` exactly). A drag that
 * started from the snap's percentage made the sheet drop under the finger before it moved (the shop at 390 × 664:
 * 320 → 252 px). The drag starts from the height the sheet shows instead.
 */

/** The CSS floor of a phone sheet at rest (px): `min(320px, calc(100dvh - var(--ob-st) - 40px))`. */
export const SHEET_FLOOR_PX = 320;

/**
 * The height (% of the viewport) a drag starts from: the snap `heightPct`, or the height the sheet shows when the floor
 * made it taller. `shownPx` / `viewportPx` from the sheet's rect and window.innerHeight (missing or 0: the snap).
 */
export function sheetDragStart(heightPct: number, shownPx: number | undefined, viewportPx: number): number {
  if (!shownPx || !(viewportPx > 0)) return heightPct;
  const shown = (shownPx / viewportPx) * 100;
  // only where the floor holds it clearly above the snap (a rounding pixel keeps the snap exact)
  return shown > heightPct + 0.5 ? Math.min(100, shown) : heightPct;
}
