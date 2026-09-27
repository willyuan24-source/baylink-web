import type { Bilingual } from '../core/types';

/**
 * 足迹 (lane G1 owns this file from wave 2; plan G1-11): the Journal tab with discovered landmarks / places /
 * neighbourhoods. Lane G2's ui/Journal.tsx shows the tab when FOOTPRINTS_TAB is set and renders <Footprints /> in it.
 * Day-0 stub: no tab.
 */
export const FOOTPRINTS_TAB: { label: Bilingual; count?: () => string } | null = null;

export function Footprints() {
  return null;
}
