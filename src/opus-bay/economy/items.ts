import type { Bilingual } from '../core/types';
import type { WearSlot } from '../data/playSave';

/**
 * Wave 5 · lane E · W5-E6 / W5-E7: the 小铺's items (plan sf-w5-plan.md §3.4). Pure data, no game imports.
 *
 * APPEND-ONLY. `ITEMS[i]` is bit i of the play save's `own` bitset and the number a wear slot stores (`play.w[slot] = i`):
 * an item's index never moves; an item that has to go stays in the list with `retired: true`.
 *
 * Nothing here changes speed, access or places (DESIGN §8, plan D21): wearables are looks, the conveniences point the
 * way (they never unlock anything), and the 飞行券 is one 飞过去 before the pelican — flying and fast travel stay free
 * after it. No real money, no loot boxes: every item has a fixed price shown on its tile.
 *
 * Kinds:
 *   wear   a look in a wear slot (the BAYBAY scarf / hat, the player's hat / backpack colour, a bike / toy-car paint,
 *          the pelican's ribbon, a photo frame). Bought once, worn or taken off any time.
 *   use    a convenience held until used: one at a time (寻宝罗盘, 明信片放大镜: bought = on for one outing; 飞行券:
 *          held until flown). The own bit is "one held"; using it clears the bit.
 *   earned an item the shop never sells: a full notebook page gives it (`earn`), shown locked with how to get it.
 */

export type Shelf = 'baybay' | 'me' | 'rides' | 'photos' | 'helpers';
export type HatKind = 'beanie' | 'sun' | 'sailor';
export type FrameKind = 'fog' | 'golden' | 'night' | 'postmark' | 'sounds';
export type UseKind = 'compass' | 'magnifier' | 'fly-ticket' | 'fly-gift';
/** the notebook pages (economy/stamps.ts PAGE_IDS) */
export type PageId = 'stamps' | 'finds' | 'views' | 'sounds';

export interface ItemDef {
  /** append-only id `[a-z0-9-]` (the `shop` event's item, the `coins` source `shop:<id>`) */
  id: string;
  shelf: Shelf;
  /** the wear slot, or 'use' for a convenience */
  slot: WearSlot | 'use';
  name: Bilingual;
  /** the tile's label (zh ≤ 5 characters, en ≤ 13) */
  short: Bilingual;
  /** coins; 0 for an item that is not sold (earned, or the hidden gift marker) */
  price: number;
  /** tint (scarf, player hat, backpack): 0xrrggbb */
  color?: number;
  /** actors/vehicles/models.ts PAINTS id (bike, car, pelican ribbon) */
  paint?: string;
  /** the swatch colour for a paint tile (the paint's main colour) */
  swatch?: string;
  hat?: HatKind;
  frame?: FrameKind;
  use?: UseKind;
  /** a full notebook page gives it (never sold) */
  earn?: PageId;
  /** one short line under the name (zh ≤ 24) */
  note?: Bilingual;
  /** the note's fact, checked on the web */
  source?: { url: string; verifiedAt: string };
  /** hidden from the shop (a marker the ledger keeps) */
  hidden?: true;
  retired?: true;
}

const bi = (zh: string, en: string): Bilingual => ({ zh, en });

/** The Golden Gate Bridge's colour is called International Orange (goldengate.org, checked 2026-09-28). */
const GGB_ORANGE = { url: 'https://www.goldengate.org/bridge/history-research/bridge-features/color-art-deco-styling/', verifiedAt: '2026-09-28' };
/** The dahlia became San Francisco's official flower in 1926 (the Dahlia Society of California, checked 2026-09-28). */
const CITY_FLOWER = { url: 'https://www.dahliadell.org/history', verifiedAt: '2026-09-28' };

export const ITEMS: readonly ItemDef[] = [
  // --- BAYBAY's scarves (a tint of her scarf) · 70 (W5-E8) ----------------------------------------------------------
  { id: 'scarf-fog', shelf: 'baybay', slot: 'baybay-scarf', name: bi('雾灰围巾', 'Karl-grey scarf'), short: bi('雾灰', 'Karl grey'), price: 70, color: 0xa9b2b7, note: bi('和 Karl 一个颜色', 'The colour of Karl the Fog') },
  { id: 'scarf-maroon', shelf: 'baybay', slot: 'baybay-scarf', name: bi('缆车栗红围巾', 'Cable-car maroon scarf'), short: bi('缆车栗红', 'Maroon'), price: 70, color: 0x8e2f3c },
  { id: 'scarf-orange', shelf: 'baybay', slot: 'baybay-scarf', name: bi('国际橘围巾', 'International Orange scarf'), short: bi('国际橘', 'Int’l Orange'), price: 70, color: 0xc44a31, note: bi('金门大桥的颜色就叫国际橘', 'The Golden Gate’s own colour'), source: GGB_ORANGE },
  { id: 'scarf-cream', shelf: 'baybay', slot: 'baybay-scarf', name: bi('酸面包奶油围巾', 'Sourdough-cream scarf'), short: bi('酸面包奶油', 'Sourdough'), price: 70, color: 0xe9d6ae },
  { id: 'scarf-dahlia', shelf: 'baybay', slot: 'baybay-scarf', name: bi('大丽花粉围巾', 'Dahlia-pink scarf'), short: bi('大丽花粉', 'Dahlia pink'), price: 70, color: 0xd8668f, note: bi('大丽花是旧金山的市花', 'The dahlia is the city’s flower'), source: CITY_FLOWER },
  // --- BAYBAY's hats (on her head) · 150 (W5-E8) -------------------------------------------------------------------
  { id: 'hat-beanie', shelf: 'baybay', slot: 'baybay-hat', name: bi('毛线帽', 'Beanie'), short: bi('毛线帽', 'Beanie'), price: 150, hat: 'beanie', note: bi('起雾的早上戴正好', 'For foggy mornings') },
  { id: 'hat-sun', shelf: 'baybay', slot: 'baybay-hat', name: bi('遮阳帽', 'Sun hat'), short: bi('遮阳帽', 'Sun hat'), price: 150, hat: 'sun', note: bi('去海滩晒太阳', 'For a sunny beach day') },
  { id: 'hat-sailor', shelf: 'baybay', slot: 'baybay-hat', name: bi('水手帽', 'Sailor cap'), short: bi('水手帽', 'Sailor cap'), price: 150, hat: 'sailor', note: bi('坐渡轮的时候戴', 'For ferry days') },
  // --- you: the bucket hat and the backpack · 50 (W5-E8) ----------------------------------------------------------
  { id: 'my-hat-fog', shelf: 'me', slot: 'player-hat', name: bi('雾灰帽子', 'Fog-grey hat'), short: bi('雾灰', 'Fog grey'), price: 50, color: 0xa9b2b7 },
  { id: 'my-hat-maroon', shelf: 'me', slot: 'player-hat', name: bi('栗红帽子', 'Maroon hat'), short: bi('栗红', 'Maroon'), price: 50, color: 0x8e2f3c },
  { id: 'my-hat-cream', shelf: 'me', slot: 'player-hat', name: bi('奶油帽子', 'Cream hat'), short: bi('奶油', 'Cream'), price: 50, color: 0xe9d6ae },
  { id: 'my-pack-orange', shelf: 'me', slot: 'player-pack', name: bi('国际橘背包', 'Orange backpack'), short: bi('国际橘', 'Orange'), price: 50, color: 0xc44a31 },
  { id: 'my-pack-gold', shelf: 'me', slot: 'player-pack', name: bi('暖金背包', 'Warm-gold backpack'), short: bi('暖金', 'Warm gold'), price: 50, color: 0xe0a94a },
  { id: 'my-pack-dahlia', shelf: 'me', slot: 'player-pack', name: bi('大丽花背包', 'Dahlia backpack'), short: bi('大丽花', 'Dahlia'), price: 50, color: 0xd8668f },
  // --- rides: bike liveries, toy-car paints, the pelican's ribbon · 110 / 90 (W5-E8) ---------------------------------
  { id: 'bike-maroon', shelf: 'rides', slot: 'bike', name: bi('栗红单车', 'Maroon bike'), short: bi('栗红', 'Maroon'), price: 110, paint: 'maroon', swatch: '#8e2f3c' },
  { id: 'bike-orange', shelf: 'rides', slot: 'bike', name: bi('国际橘单车', 'Orange bike'), short: bi('国际橘', 'Orange'), price: 110, paint: 'orange', swatch: '#c44a31' },
  { id: 'bike-dahlia', shelf: 'rides', slot: 'bike', name: bi('大丽花单车', 'Dahlia bike'), short: bi('大丽花', 'Dahlia'), price: 110, paint: 'dahlia', swatch: '#d8668f' },
  { id: 'car-teal', shelf: 'rides', slot: 'car', name: bi('海湾青小车', 'Bay-teal toy car'), short: bi('海湾青', 'Bay teal'), price: 110, paint: 'teal', swatch: '#2f8f88' },
  { id: 'car-gold', shelf: 'rides', slot: 'car', name: bi('暖金小车', 'Warm-gold toy car'), short: bi('暖金', 'Warm gold'), price: 110, paint: 'gold', swatch: '#e0a94a' },
  { id: 'car-fog', shelf: 'rides', slot: 'car', name: bi('雾灰小车', 'Fog-grey toy car'), short: bi('雾灰', 'Fog grey'), price: 110, paint: 'fog', swatch: '#a9b2b7' },
  { id: 'ribbon-orange', shelf: 'rides', slot: 'pelican', name: bi('鹈鹕丝带', 'Pelican ribbon'), short: bi('鹈鹕丝带', 'Ribbon'), price: 90, paint: 'orange', swatch: '#c44a31', note: bi('系在鹈鹕脖子上', 'Tied round the pelican’s neck') },
  // --- photo frames (the polaroid's border; lane C's decorator) · 60 (W5-E8) ---------------------------------------
  { id: 'frame-fog', shelf: 'photos', slot: 'frame', name: bi('雾相框', 'Fog frame'), short: bi('雾', 'Fog'), price: 60, frame: 'fog' },
  { id: 'frame-night', shelf: 'photos', slot: 'frame', name: bi('夜相框', 'Night frame'), short: bi('夜', 'Night'), price: 60, frame: 'night' },
  { id: 'frame-golden', shelf: 'photos', slot: 'frame', name: bi('金色时刻相框', 'Golden-hour frame'), short: bi('金色时刻', 'Golden hour'), price: 0, frame: 'golden', earn: 'views' },
  { id: 'frame-postmark', shelf: 'photos', slot: 'frame', name: bi('邮戳相框', 'Postmark frame'), short: bi('邮戳', 'Postmark'), price: 0, frame: 'postmark', earn: 'stamps' },
  // --- earned: the 小发现 page's scarf ----------------------------------------------------------------------------
  { id: 'scarf-treasure', shelf: 'baybay', slot: 'baybay-scarf', name: bi('寻宝金围巾', 'Treasure-gold scarf'), short: bi('寻宝金', 'Treasure gold'), price: 0, color: 0xd9a431, earn: 'finds' },
  // --- helpers: one outing each; the 飞行券 before the pelican ----------------------------------------------------
  { id: 'compass', shelf: 'helpers', slot: 'use', name: bi('寻宝罗盘', 'Treasure compass'), short: bi('寻宝罗盘', 'Compass'), price: 20, use: 'compass', note: bi('指向最近的小发现', 'Points to the nearest find') },
  { id: 'magnifier', shelf: 'helpers', slot: 'use', name: bi('明信片放大镜', 'Postcard magnifier'), short: bi('放大镜', 'Magnifier'), price: 20, use: 'magnifier', note: bi('附近的明信片插上小旗', 'Flags the nearest postcards') },
  { id: 'fly-ticket', shelf: 'helpers', slot: 'use', name: bi('飞行券', 'Flight ticket'), short: bi('飞行券', 'Ticket'), price: 10, use: 'fly-ticket', note: bi('还没有鹈鹕时飞一次', 'One flight before the pelican') },
  // the first 飞行券 is BAYBAY's gift: this bit remembers it was given (never shown, never sold)
  { id: 'fly-gift', shelf: 'helpers', slot: 'use', name: bi('BAYBAY 送的飞行券', 'BAYBAY’s gift ticket'), short: bi('送的飞行券', 'Gift ticket'), price: 0, use: 'fly-gift', hidden: true },
  // W5-E9: the 城市之声 page (lane D's twelve city sounds) gives it
  { id: 'frame-sounds', shelf: 'photos', slot: 'frame', name: bi('城市之声相框', 'City-sounds frame'), short: bi('城市之声', 'City sounds'), price: 0, frame: 'sounds', earn: 'sounds' },
];

export const ITEM_IDS: readonly string[] = ITEMS.map(i => i.id);
const BY_ID = new Map(ITEMS.map((it, i) => [it.id, i]));
export const itemIndex = (id: string): number => BY_ID.get(id) ?? -1;
export const itemById = (id: string): ItemDef | undefined => { const i = BY_ID.get(id); return i === undefined ? undefined : ITEMS[i]; };
export const itemAt = (i: number): ItemDef | undefined => (Number.isInteger(i) && i >= 0 ? ITEMS[i] : undefined);

/** What a 飞行券 left over after the pelican unlock gives back (plan §3.4, VOICE.md). */
export const TICKET_REFUND = 10;

/** The shelves in the sheet's order, with their names. */
export const SHELVES: readonly { id: Shelf; name: Bilingual }[] = [
  { id: 'baybay', name: bi('BAYBAY', 'BAYBAY') },
  { id: 'me', name: bi('我', 'Me') },
  { id: 'rides', name: bi('坐骑', 'Rides') },
  { id: 'photos', name: bi('相框', 'Frames') },
  { id: 'helpers', name: bi('小帮手', 'Helpers') },
];

/** Group names inside a shelf (one per wear slot, and the helpers). */
export const SLOT_NAMES: Readonly<Record<WearSlot | 'use', Bilingual>> = {
  'baybay-scarf': bi('围巾', 'Scarves'),
  'baybay-hat': bi('帽子', 'Hats'),
  'player-hat': bi('我的帽子', 'My hat'),
  'player-pack': bi('我的背包', 'My backpack'),
  bike: bi('单车', 'Bike'),
  car: bi('小车', 'Toy car'),
  pelican: bi('鹈鹕', 'Pelican'),
  frame: bi('相框', 'Frames'),
  use: bi('一次一趟', 'One outing each'),
};

/** Which notebook page gives an earned item, in words (the locked tile). */
export const EARN_NAMES: Readonly<Record<PageId, Bilingual>> = {
  stamps: bi('集满手帐「印章」页', 'Fill the notebook’s Stamps page'),
  finds: bi('集满手帐「小发现」页', 'Fill the notebook’s Finds page'),
  views: bi('集满手帐「看风景」页', 'Fill the notebook’s Views page'),
  sounds: bi('集满手帐「城市之声」页', 'Fill the notebook’s City sounds page'),
};

/** The item a full page gives. */
export const PAGE_ITEM: Readonly<Record<PageId, string>> = { stamps: 'frame-postmark', finds: 'scarf-treasure', views: 'frame-golden', sounds: 'frame-sounds' };

/** Items the shop sells (wearables and conveniences with a price; not earned, hidden or retired). */
export const forSale = (it: ItemDef): boolean => it.price > 0 && !it.earn && !it.hidden && !it.retired;

/** Items on a shelf now (the ticket only before the pelican; hidden and retired never). */
export function shelfItems(shelf: Shelf, pelican: boolean): ItemDef[] {
  return ITEMS.filter(it => it.shelf === shelf && !it.hidden && !it.retired && !(it.use === 'fly-ticket' && pelican));
}
