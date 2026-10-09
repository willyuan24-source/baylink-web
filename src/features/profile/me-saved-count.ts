import { getGuideBySlug } from '../../data/guides';
import { useReaderLibrary } from '../../lib/reader-library';
import { useSavedPosts } from '../../lib/savedPosts';
import type { Library } from '../../lib/planner';

/**
 * The My Week count: the same set the My Week shelf lists (planner favorites, saved guides and saved listings). A saved
 * guide that no longer exists is skipped there, so it is skipped here too.
 * null while the account library is still loading, so the tile never shows a wrong 0.
 * TODO(WEB-SAVES): replace with useSavedCount() from src/lib/saves.ts once it is on main.
 */
export function useMyWeekSavedCount(userId: string | undefined, library: { ready: boolean; data: Library }): number | null {
  const reader = useReaderLibrary();
  const posts = useSavedPosts(userId);
  if (!library.ready) return null;
  const keys = new Set(library.data.favorites.map(favorite => `${favorite.kind}:${favorite.id}`));
  for (const slug of reader.saved) if (getGuideBySlug(slug)) keys.add(`guide:${slug}`);
  for (const post of posts) keys.add(`post:${post.id}`);
  return keys.size;
}
