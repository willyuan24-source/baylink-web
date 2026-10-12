import { useSavedCount } from '../../lib/saves';
import type { Library } from '../../lib/planner';

/**
 * The My Week count: the one save model's count (src/lib/saves.ts), so /me and My Week always agree.
 * null while the account library is still loading, so the tile never shows a wrong 0.
 * The library argument is kept for callers; the save model reads the same planner library itself.
 */
export function useMyWeekSavedCount(userId: string | undefined, _library?: { ready: boolean; data: Library }): number | null {
  return useSavedCount(userId);
}
