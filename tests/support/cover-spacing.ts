import assert from 'node:assert/strict';
import { ADJACENT_CARDS } from '../../src/lib/cover';

/**
 * A ③④ pool picture may come back on a page, but only ADJACENT_CARDS or more cards after it last showed (cover.ts).
 * `covers` lists every card's cover in page order: the picture's src, or null for an information card.
 */
export function assertPoolSpacing(covers: readonly (string | null | undefined)[], pool: ReadonlySet<string>, where: string) {
  const last = new Map<string, number>();
  covers.forEach((src, at) => {
    if (!src || !pool.has(src)) return;
    const before = last.get(src);
    if (before !== undefined) assert.ok(at - before >= ADJACENT_CARDS, `${where}: ${src} again ${at - before} cards later (< ${ADJACENT_CARDS})`);
    last.set(src, at);
  });
}

/**
 * Every card's cover on a rendered page, in page order: the picture's src, or null for an information card. A card shown
 * twice for two layouts (the picks as phone cards and as desktop rows, `?date=` on one) is one card: its link's path counts
 * once, where it first shows.
 */
export function coversInPageOrder(root: ParentNode): (string | null)[] {
  const seen = new Set<string>();
  const covers: (string | null)[] = [];
  for (const cover of root.querySelectorAll('[data-cover]')) {
    const href = cover.closest('a[href]')?.getAttribute('href') ?? cover.closest('article, li')?.querySelector('a[href]')?.getAttribute('href');
    const link = href?.split(/[?#]/)[0];
    if (link) {
      if (seen.has(link)) continue;
      seen.add(link);
    }
    covers.push(cover.querySelector('img.ui-cover__img')?.getAttribute('src') ?? null);
  }
  return covers;
}
