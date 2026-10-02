import type { Bilingual, CatalogEvent } from '../core/types';
import { gameLink } from '../game/photoCard';

/**
 * Wave 9 · lane S · W9-S4 — the 「约家人」 card's words (review R§5 #8, §8 idea 5: 微信会吞掉链接，图片里的二维码是唯一的回流路径).
 * Pure (node-tested): the card for an event, a place or 我的周末, in the reader's language (the caller's `t`), with the
 * link its QR code carries back into the game at the same spot: `https://www.baylink.us/opus-bay?at=<spot>&from=family`.
 * ui/shareCardDraw.ts lays it out and paints it (a vertical PNG); ui/ShareCard.tsx shows it with 保存 / 分享 (WeChat:
 * long-press the picture); ui/ShareCardButton.tsx is the 约家人 button the event / place cards and 我的周末 carry.
 */

/** The overlay (ui/slots.ts) the city's boot registers (game/album.ts initAlbum) and the buttons open. */
export const SHARE_CARD_ID = 'c-share-card';

export type Tr = (zh: string, en: string) => string;

/** What a share button asks for: an event of the live catalog, a place card's own facts, or the weekend's list. */
export type ShareCardSpec =
  | { kind: 'event'; id: string }
  | { kind: 'place'; name: Bilingual; zone?: Bilingual; hours?: Bilingual; cost?: Bilingual; x: number; z: number; at?: string }
  | { kind: 'weekend'; days: string[]; events: { id: string; on: string[] }[]; places: string[] };

export interface CardRow { label: string; text: string }
export interface FamilyCard {
  kicker: string;
  title: string;
  rows: CardRow[];
  /** the QR code's address */
  url: string;
  scan: string;
  note: string;
  /** the file's name (no "opus-bay": the game's visible name is 湾区小旅) */
  file: string;
}

const WEEK_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** An absolute day (the card is read later, elsewhere: never 今天 / 明天): 10月3日 · 周六 / Sat, Oct 3. */
export function cardDay(day: string, t: Tr): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  const m = d.getUTCMonth(), n = d.getUTCDate(), w = d.getUTCDay();
  return t(`${m + 1}月${n}日 · ${WEEK_ZH[w]}`, `${WEEK_EN[w]}, ${MONTH_EN[m]} ${n}`);
}

/** The card's fixed words (labels, the QR line, the hedge). */
export const cardWords = (t: Tr) => ({
  kicker: t('约家人 · 一起去', 'Plan it together'),
  weekend: t('约家人 · 这个周末', 'Plan it together · this weekend'),
  weekendTitle: t('这个周末，一起去？', 'This weekend, together?'),
  saved: t('想去', 'Saved'),
  scan: t('扫码，先在「湾区小旅」里逛逛这里', 'Scan to see it first in Little Bay Trip'),
  note: t('时间、费用以官网为准', 'Check times and prices on the official site'),
  when: t('日期', 'When'), where: t('地点', 'Where'), cost: t('费用', 'Cost'), hours: t('开放', 'Hours'), how: t('怎么去', 'Getting there'),
});

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'card';
const xz = (x: number, z: number) => `xz:${Math.round(x)},${Math.round(z)}`;
const costText = (e: Pick<CatalogEvent, 'cost' | 'costLabel'>, t: Tr) => e.costLabel ?? (e.cost === 'free' ? t('免费', 'Free') : e.cost ?? '');

/** The nearest real Muni lines (realsf/transitReal.ts nearestRealStops) as the card's 怎么去 lines. */
export function howLines(near: readonly { line: { name: Bilingual }; stop: { name: Bilingual }; walkMin: number }[], t: Tr): string[] {
  return near.slice(0, 2).map(n => t(`${n.line.name.zh} · ${n.stop.name.zh} · 步行约 ${n.walkMin} 分钟`, `${n.line.name.en} · ${n.stop.name.en} · ~${n.walkMin} min walk`));
}

type EventFacts = Pick<CatalogEvent, 'id' | 'title' | 'dateLabel' | 'venue' | 'city' | 'cost' | 'costLabel'>;

/** An event's card: its next date (+ the editors' date line), the venue, the cost, the nearest real lines. */
export function eventCard(event: EventFacts, o: { t: Tr; next: string | null; venue?: string; spot?: { x: number; z: number } | null; how?: readonly string[] }): FamilyCard {
  const w = cardWords(o.t);
  const rows: CardRow[] = [];
  const when = [o.next ? cardDay(o.next, o.t) : '', event.dateLabel ?? ''].filter(Boolean).join(' · ');
  if (when) rows.push({ label: w.when, text: when });
  const where = [o.venue ?? event.venue ?? '', event.city ?? ''].filter(Boolean).join(' · ');
  if (where) rows.push({ label: w.where, text: where });
  const cost = costText(event, o.t);
  if (cost) rows.push({ label: w.cost, text: cost });
  if (o.how?.length) rows.push({ label: w.how, text: o.how.join('\n') });
  // its spot in the game's San Francisco (data/catalog.ts eventSpot); none (another city): the code opens the game's start
  return { kicker: w.kicker, title: event.title, rows, url: gameLink(o.spot ? xz(o.spot.x, o.spot.z) : null, 'family'), scan: w.scan, note: w.note, file: `baylink-${slug(event.id)}.png` };
}

/** A place's card: the area, its hours and cost (the card's own, hedged as written), the nearest real lines. */
export function placeCard(p: Extract<ShareCardSpec, { kind: 'place' }>, o: { t: Tr; how?: readonly string[] }): FamilyCard {
  const w = cardWords(o.t), tb = (b?: Bilingual) => (b ? o.t(b.zh, b.en) : '');
  const rows: CardRow[] = [];
  const zone = tb(p.zone);
  rows.push({ label: w.where, text: zone ? o.t(`${zone} · 旧金山`, `${zone} · San Francisco`) : o.t('旧金山', 'San Francisco') });
  if (p.hours) rows.push({ label: w.hours, text: tb(p.hours) });
  if (p.cost) rows.push({ label: w.cost, text: tb(p.cost) });
  if (o.how?.length) rows.push({ label: w.how, text: o.how.join('\n') });
  return { kicker: w.kicker, title: tb(p.name), rows, url: gameLink(p.at ?? xz(p.x, p.z), 'family'), scan: w.scan, note: w.note, file: `baylink-${slug(p.name.en)}.png` };
}

/** The most rows 我的周末's card lists (the rest: 「还有 n 个」). */
export const WEEKEND_ROWS = 5;

/**
 * 我的周末 as one card: the weekend's days, each saved event on its day(s) with its venue and cost, then the saved
 * places; the code opens the game at the first event's spot (none: the game's start).
 */
export function weekendCard(items: readonly { event: EventFacts; on: readonly string[]; venue?: string; spot?: { x: number; z: number } | null }[], places: readonly string[], o: { t: Tr; days: readonly string[] }): FamilyCard {
  const w = cardWords(o.t);
  const all: CardRow[] = [
    ...items.map(({ event, on, venue }) => ({
      label: on.map(d => cardDay(d, o.t)).join(o.t('、', ' & ')),
      // (the list stays short: the cost only when it is free; each event's own card has the rest)
      text: [event.title, venue ?? event.venue ?? '', event.cost === 'free' ? o.t('免费', 'Free') : ''].filter(Boolean).join(' · '),
    })),
    ...places.map(p => ({ label: w.saved, text: p })),
  ];
  const rows = all.slice(0, WEEKEND_ROWS);
  if (all.length > WEEKEND_ROWS) rows.push({ label: '', text: o.t(`还有 ${all.length - WEEKEND_ROWS} 个`, `${all.length - WEEKEND_ROWS} more`) });
  const first = items.find(i => i.spot)?.spot ?? null;
  const span = o.days.length ? o.days.map(d => cardDay(d, o.t)).join(o.t('、', ' & ')) : '';
  return {
    kicker: w.weekend,
    title: w.weekendTitle,
    rows: span ? [{ label: w.when, text: span }, ...rows] : rows,
    url: gameLink(first ? xz(first.x, first.z) : null, 'family'),
    scan: w.scan,
    note: w.note,
    file: `baylink-weekend-${o.days[0] ?? 'plan'}.png`,
  };
}
