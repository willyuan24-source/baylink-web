// Editor-owned weekend picks for the home page and the /weekly share card.
//
// Weekly routine (Thursday 18:00 PT): add next weekend under its Saturday date
// and delete weekends that have passed. A merge plus a production deploy is
// required; the home snapshot and the share card are both built at deploy time.
// BayBay reads the picks only from public/weekend-picks.json (npm run export:picks,
// run by the build) through the API's sync-editorial-catalogs copy, so an API sync
// and an API deploy must follow the web deploy, or BayBay has no picks that weekend.
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
  // 10/10 has passed. It stays until the other tests that render 10/9–11 are checked without it (events-shell and the H26
  // label test no longer read it).
  '2026-10-10': [
    { id: 'san-francisco-fleet-week-2026', reason: { zh: '蓝天使飞越海湾，岸边免费看', en: 'Blue Angels over the Bay, free from the shore' } },
    { id: 'burlingame-mandarin-storytime-2026', reason: { zh: '普通话+英语讲故事，0–6岁', en: 'Mandarin and English stories for ages 0–6' } },
    { id: 'fremont-ardenwood-harvest-2026', reason: { zh: '收玉米、榨苹果汁，东湾农场一日', en: 'Pick corn and press cider on an East Bay farm' } },
    { id: 'sf-italian-heritage-parade-2026', reason: { zh: '从渔人码头走进 North Beach', en: "From Fisherman's Wharf into North Beach" } },
  ],
  // 10/17–18 (GPT editor's 10/15 draft, owner approved 10/15; ids and reasons checked against each entry). The 长辈友好 pick
  // (Berkeley, Senior Seating Area) is rank 3 so the home, the /weekly card and /events all show it on Saturday; SoCo is
  // the standby. Only Half Moon Bay runs on Sunday, so its reason holds for both days and the ranking fills the rest then.
  '2026-10-17': [
    { id: 'sf-bay-area-science-festival-2026', reason: { zh: '免费动手实验，亲子一起玩', en: 'Free hands-on science for the whole family' } },
    { id: 'half-moon-bay-pumpkin-festival-2026', reason: { zh: '两天南瓜展，周六有游行', en: 'Pumpkin displays both days, a parade on Saturday' } },
    { id: 'berkeley-harvest-festival-2026', reason: { zh: '设有长者座位区，逛累可歇脚', en: 'A seating area where elders can rest' } },
    { id: 'numu-community-ignition-oct17-2026', reason: { zh: '现场织艺互动，认识多元艺术', en: 'Weave into a shared tapestry at the opening' } },
    { id: 'r2-santarosa-soco-halloween-2026', reason: { zh: '带上宠物，与家人一起逛市集', en: 'A family market where pets are welcome' } },
  ],
  // 10/24–25 (GPT editor's 10/15 draft, owner approved; every pick's official page re-read 10/16, all still on 10/24). The
  // 长辈友好 pick (Chinatown library's self-guided calligraphy afternoon) is rank 3 so the home, the /weekly card and /events
  // show it on Saturday; Cherryland and SJMA are the standbys. All five are Saturday-only, so the ranking fills Sunday 10/25.
  '2026-10-24': [
    { id: 'r2-petaluma-lumafest-20261024', reason: { zh: '免费逛校园，体验亡灵节文化', en: 'A free campus open house with Día de los Muertos' } },
    { id: 'menlo-park-halloween-hoopla-2026', reason: { zh: '装扮游行加公园嘉年华', en: 'A costume parade, then a carnival in the park' } },
    { id: 'sfpl-chinatown-creative-saturdays-fall-2026', reason: { zh: '室内书法桌游，可按节奏参与', en: 'Indoor calligraphy and board games at your own pace' } },
    { id: 'acl-cherryland-chinese-storytimes-oct24-2026', reason: { zh: '粤语国语分场，幼儿一起听故事', en: 'Cantonese and Mandarin storytimes for little ones' } },
    { id: 'san-jose-sjma-dia-muertos-community-2026', reason: { zh: '免费入馆，参加亡灵节艺术活动', en: 'Free museum entry and Día de los Muertos art' } },
  ],
  // 10/31–11/1 (GPT editor's 10/16 draft, owner approved 10/16; every pick's official page re-read 10/16, all unchanged). The
  // 长辈友好 pick (Chinatown library's self-guided calligraphy afternoon) is rank 3 so the home, the /weekly card and /events
  // show it on Saturday. Marin, Chinatown and Avenida de Altares are Saturday-only; Fruitvale and Nidhi Chanani are Sunday-only,
  // so Sunday shows those two and the ranking fills the third place.
  '2026-10-31': [
    { id: 'mcm-halloween-spectacular-20261031', reason: { zh: '白天装扮讨糖，适合带孩子', en: 'Daytime costumes and trick-or-treating for kids' } },
    { id: 'nov2026-fruitvale-dia-muertos', reason: { zh: '看社区祭坛，听现场音乐', en: 'Community altars and live music' } },
    { id: 'sfpl-chinatown-creative-saturdays-fall-2026', reason: { zh: '室内书法桌游，可按节奏参与', en: 'Indoor calligraphy and board games at your own pace' } },
    { id: 'san-jose-avenida-altares-2026', reason: { zh: '逛社区祭坛，体验亡灵节艺术', en: 'Community altars and Día de los Muertos art' } },
    { id: 'smcl-foster-city-nidhi-chanani-2026', reason: { zh: '跟绘本作家听故事、画画', en: 'Stories and drawing with a picture-book artist' } },
  ],
};

// Large annual events the automatic ranking should favour on weekends nobody
// has picked. No event field signals scale, so editors list them here.
// Remove an id when its event leaves the catalog.
export const WEEKEND_FLAGSHIP_IDS: ReadonlySet<string> = new Set([
  'san-francisco-fleet-week-2026',
  'half-moon-bay-pumpkin-festival-2026',
]);
