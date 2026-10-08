// Editor-owned weekend picks for the home page and the /weekly share card.
//
// Weekly routine (Thursday 18:00 PT): add next weekend under its Saturday date
// and delete weekends that have passed. A merge plus a production deploy is
// required; the home snapshot and the share card are both built at deploy time.
//
// - Array order is the rank. Ranks 1–3 show on the home page and the card;
//   up to two more are standbys that move up when a pick does not occur that
//   day (for example a Saturday-only pick on Sunday).
// - Each id must be an event in the catalog that occurs on that Saturday or
//   Sunday. Picks that do not are skipped at runtime, never shown as stale.
// - reason.zh is at most 20 characters; zh-Hant is converted automatically.
//   reason.en is plain English. Only state facts the event entry supports
//   (do not write 免费 unless the cost line confirms it).
// - Weekends without an entry use the automatic ranking in
//   src/lib/weekend-ranking.ts.
// Keep this file free of event data imports: the home page bundles it.

export type WeekendPickEntry = { id: string; reason: { zh: string; en: string } };

export const WEEKEND_PICKS: Readonly<Record<string, readonly WeekendPickEntry[]>> = {
  '2026-10-10': [
    { id: 'san-francisco-fleet-week-2026', reason: { zh: '蓝天使飞越海湾，岸边免费看', en: 'Blue Angels over the Bay, free from the shore' } },
    { id: 'burlingame-mandarin-storytime-2026', reason: { zh: '普通话+英语讲故事，0–6岁', en: 'Mandarin and English stories for ages 0–6' } },
    { id: 'fremont-ardenwood-harvest-2026', reason: { zh: '收玉米、榨苹果汁，东湾农场一日', en: 'Pick corn and press cider on an East Bay farm' } },
    { id: 'sf-italian-heritage-parade-2026', reason: { zh: '从渔人码头走进 North Beach', en: "From Fisherman's Wharf into North Beach" } },
  ],
};

// Large annual events the automatic ranking should favour on weekends nobody
// has picked. No event field signals scale, so editors list them here.
// Remove an id when its event leaves the catalog.
export const WEEKEND_FLAGSHIP_IDS: ReadonlySet<string> = new Set([
  'san-francisco-fleet-week-2026',
  'half-moon-bay-pumpkin-festival-2026',
]);
