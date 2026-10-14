import type { LocalDiscovery } from '../data/local-discoveries';
import { discoveryShare } from '../data/local-discoveries';
import type { Guide } from '../data/guides';
import type { GuideImage } from '../data/guide-media';
import { guideShare } from './editorial-share';
import { getImageProvenance, typeCoverProvenance } from './image-provenance';
import { captureYear, getCover, isAiIllustration, rightsBasisOf, type CoverAsset } from './cover';
import { GUIDE_TOPICS, guideTopicOf } from '../data/guide-topics';
import {
  brandCase, eventDateChip, eventPriceChip, eventTimeLabel, eventTone, formatDateChip, offerDeadline, offerKindLabel, offerTone, offerValue,
  openingChip, toneLabel, type Copy,
} from './event-facts';
import { DEFAULT_TAGLINE, type CardTone, type HubCardModel, type ShareCardModel } from './share-card-svg';

/**
 * What a share card says, per language (I18N-SEO-05): the listing's own TypeCover facts (category, the next date, the
 * price or value, the opening chip) and its title, date line and place, through the site's translation (`tr`: the
 * dictionary for English, the 繁體 conversion for zh-Hant). Pure: scripts/generate-share-cards.ts draws it.
 */
export type CardLocale = 'zh-Hans' | 'zh-Hant' | 'en';
export type Translate = (text: string) => string;
const pick = (copy: Copy, english: boolean, tr: Translate) => english ? copy.en : tr(copy.zh);
/** Normal case for an all-caps brand, unless it carries a symbol or a number whose letters are units ("85°C"). */
const brand = (name: string) => /[°\d]/.test(name) ? name : brandCase(name);

/**
 * A photo may front a share card only when its rights record allows promotion (`rights.promoAllowed`) — a share card is
 * promotion, not coverage beside the item — and it is not AI art. BAYLINK's own photographs are BAYLINK's to promote.
 */
export function promoPhoto(image: GuideImage | undefined): GuideImage | undefined {
  if (!image || isAiIllustration(image as CoverAsset)) return undefined;
  const rights = typeof image.rights === 'object' && image.rights ? image.rights : undefined;
  if (rights?.basis === 'ai') return undefined;
  return rights?.promoAllowed === true || image.ownShot === true ? image : undefined;
}

/**
 * H45 (owner rule 10-08): an organiser's own official image may be shown on that same event's coverage, labelled 官方图
 * with its source. An event's own share card is the link preview of that coverage, so it carries the image the event
 * page shows as its official cover (getCover's 'official' tier: the organiser's image of this event, not a venue or
 * theme photo) — never a press kit, never a record that says no promotion, never AI art, and never on a hub or weekly
 * card, which promote BAYLINK and keep promoPhoto's rule. Turning this off leaves promotion-cleared photos only.
 */
export const OFFICIAL_IMAGE_ON_OWN_EVENT_CARD: boolean = false;
export function cardPhoto(item: LocalDiscovery, image: GuideImage | undefined, today: string): GuideImage | undefined {
  const cleared = promoPhoto(image);
  if (cleared || !OFFICIAL_IMAGE_ON_OWN_EVENT_CARD || !image || item.kind !== 'event') return cleared;
  const rights = typeof image.rights === 'object' && image.rights ? image.rights : undefined;
  if (rights?.promoAllowed === false || rightsBasisOf(image as CoverAsset) === 'press-kit') return undefined;
  const { id, imageKey } = item.event;
  return getCover({ kind: 'event', id, imageKey }, { images: { [imageKey]: image }, today }).tier === 'official' ? image : undefined;
}
/** The source a card names beside an official image's label: the image's own page, else the listing's official page. */
const sourceHost = (...urls: (string | undefined)[]) => {
  for (const url of urls) { try { if (url) return new URL(url).hostname.replace(/^www\./, ''); } catch { /* the next one */ } }
  return undefined;
};
const OFFICIAL_LABEL = /^(?:官方图|Official image)/;
/**
 * A card has no caption, so an official image says on its badge what the page's caption says: an earlier edition's
 * photo carries its year, and every official image its source (官方图 · 2025 · borp.org).
 */
function photoLabel(item: LocalDiscovery, photo: GuideImage, english: boolean, today: string): string {
  const label = getImageProvenance(photo, english, today);
  if (!OFFICIAL_LABEL.test(label)) return label;
  const year = captureYear(photo as CoverAsset);
  const earlier = year && item.kind === 'event' && year < Number(item.event.startDate.slice(0, 4)) ? year : undefined;
  const host = sourceHost(photo.creditUrl, item.kind === 'event' ? item.event.officialUrl : undefined);
  return [label, earlier, host].filter(Boolean).join(' · ');
}

/** The brand line's tagline: Chinese cards say what BAYLINK is (H45); hub cards have room for its first half. */
export const BAYLINK_TAGLINE = { zh: '湾区去哪、怎么办 · 有来源的中文答案', short: '湾区去哪、怎么办' } as const;
const tagline = (locale: CardLocale, tr: Translate, short = false) => locale === 'en' ? DEFAULT_TAGLINE : tr(short ? BAYLINK_TAGLINE.short : BAYLINK_TAGLINE.zh);

const COPY = {
  scan: { zh: '扫码查看这条详情', en: 'Scan for details, dates and the official source' },
  footnote: { zh: '日期、领取条件与开放状态，请以详情页和官方入口为准。', en: 'Dates, terms and opening status: check the page and the official source.' },
  guide: { zh: '办事指南', en: 'Guide' },
};

export function discoveryCardModel(item: LocalDiscovery, locale: CardLocale, today: string, tr: Translate, photo?: GuideImage): ShareCardModel {
  const english = locale === 'en';
  const share = discoveryShare(item);
  const common = {
    kindLabel: tr(share.label), title: tr(share.title), summary: tr(share.summary),
    scan: pick(COPY.scan, english, tr), footnote: pick(COPY.footnote, english, tr),
    provenance: photo ? (english ? photoLabel(item, photo, true, today) : tr(photoLabel(item, photo, false, today))) : typeCoverProvenance(english), tagline: tagline(locale, tr),
  };
  if (item.kind === 'event') {
    const { event } = item;
    const tone = eventTone(event);
    const chip = eventDateChip(event, today);
    const date = formatDateChip(chip, english);
    const price = eventPriceChip(event);
    const time = chip.kind === 'day' ? eventTimeLabel(event, chip.date, english) : undefined;
    return {
      ...common, tone, coverLabel: pick(toneLabel(tone), english, tr),
      big: date.big || (english ? date.label : tr(date.label)), small: date.big ? (english ? date.small : tr(date.small)) : undefined, note: time ? (english ? time : tr(time)) : undefined,
      sticker: price ? pick(price.text, english, tr) : undefined,
      meta: [tr(share.date), tr(event.venueShort ? `${event.city} · ${event.venueShort}` : event.city)],
    };
  }
  if (item.kind === 'offer') {
    const { offer } = item;
    const value = offerValue(offer);
    const deadline = offerDeadline(offer, today);
    return {
      ...common, tone: offerTone(offer), coverLabel: pick(offerKindLabel(offer), english, tr),
      big: value ? pick(value, english, tr) : brand(tr(offer.brand)), small: value ? brand(tr(offer.brand)) : undefined,
      sticker: deadline ? pick(deadline.text, english, tr) : undefined,
      meta: [tr(share.date), tr(share.area)],
    };
  }
  const { shop } = item;
  const restaurant = shop.openingType === 'new-restaurant';
  return {
    ...common, tone: restaurant ? 'food' : 'family', coverLabel: english ? (restaurant ? 'New restaurant' : 'New shop') : tr(restaurant ? '新开餐厅' : '新店'),
    big: pick(openingChip(shop, today), english, tr), small: tr(shop.city),
    meta: [tr(share.date), tr(share.area)],
  };
}

const TOPIC_TONES: Record<string, CardTone> = { elders: 'seniors', health: 'culture', documents: 'culture', housing: 'family', transport: 'outdoors', savings: 'free', outings: 'outdoors' };
export function guideCardModel(guide: Guide, locale: CardLocale, tr: Translate, photo?: GuideImage, today?: string): ShareCardModel {
  const english = locale === 'en';
  const share = guideShare(guide);
  const topic = GUIDE_TOPICS.find(item => item.id === guideTopicOf(guide));
  const sources = guide.sources.length;
  return {
    tone: TOPIC_TONES[topic?.id ?? ''] ?? 'culture',
    coverLabel: topic ? pick(topic, english, tr) : tr(guide.categoryLabel),
    big: pick(COPY.guide, english, tr),
    small: sources ? (english ? `${sources} official source${sources === 1 ? '' : 's'}` : tr(`${sources} 个官方来源`)) : undefined,
    note: english ? `Checked ${Number(guide.updatedAt.slice(5, 7))}/${Number(guide.updatedAt.slice(8, 10))}/${guide.updatedAt.slice(0, 4)}` : tr(`核对 ${guide.updatedAt}`),
    provenance: photo ? (english ? getImageProvenance(photo, true, today) : tr(getImageProvenance(photo, false, today))) : typeCoverProvenance(english),
    kindLabel: tr(share.label), title: tr(share.title), summary: tr(share.summary),
    meta: [tr(guide.categoryLabel)],
    scan: pick(COPY.scan, english, tr), footnote: pick(COPY.footnote, english, tr), tagline: tagline(locale, tr),
  };
}

/** The hubs that have a card of their own; the rest share `brand`. */
export const HUB_CARD_NAMES = ['home', 'events', 'guides', 'explore', 'plan', 'tools', 'brand'] as const;
export type HubCardName = typeof HUB_CARD_NAMES[number];
export const HUB_PATHS: Readonly<Record<HubCardName, string>> = { home: '/', events: '/events', guides: '/guides', explore: '/explore', plan: '/plan', tools: '/tools', brand: '/about' };
export type WeekendRow = { date: string; title: string; city: string };
/**
 * The hub cards' copy. `weekend` is the build's weekend picks (the same the home page and the weekly card show) and
 * `range` its dates; `tools` the tool titles; `guideCount` the published guides.
 */
export function hubCardModel(name: HubCardName, locale: CardLocale, tr: Translate, data: { weekend: WeekendRow[]; range: string; tools: string[]; guideCount: number }): HubCardModel {
  const english = locale === 'en';
  const t = (zh: string, en: string) => english ? en : tr(zh);
  const scan = t('扫码打开 BAYLINK', 'Scan to open BAYLINK');
  const brandLine = { tagline: tagline(locale, tr, true) };
  const footnote = t('湾区去哪、怎么办 · 有来源的中文答案', 'Where to go and how to get things done in the Bay Area, with sources');
  const weekendRows = data.weekend.slice(0, 3).map(row => ({ badge: row.date, text: english ? `${row.title} · ${row.city}` : `${row.title} · ${row.city}` }));
  switch (name) {
    case 'home': return { eyebrow: t('BAYLINK · 本周末', 'BAYLINK · This weekend'), title: t('这个周末，湾区去哪？', 'Where to go in the Bay Area this weekend'), subtitle: t(`${data.range} · 每条附官方来源`, `${data.range} · every listing links its official source`), rows: weekendRows, scan, footnote, ...brandLine };
    case 'events': return { eyebrow: t('活动', 'Events'), title: t('本周末湾区活动', 'Bay Area events this weekend'), subtitle: t(`${data.range} · 日期、费用与主办方来源`, `${data.range} · dates, costs and organizer sources`), rows: weekendRows, scan, footnote, ...brandLine };
    case 'guides': return { eyebrow: t('办事指南', 'Guides'), title: t('湾区怎么办：有来源的中文指南', 'Getting things done in the Bay Area'), subtitle: t(`${data.guideCount} 篇指南，每篇附官方来源与核对日期`, `${data.guideCount} guides, each with official sources and a check date`),
      rows: GUIDE_TOPICS.slice(0, 4).map(topic => ({ text: english ? topic.en : tr(topic.zh) })), scan, footnote, ...brandLine };
    case 'explore': return { eyebrow: t('去哪玩', 'Places'), title: t('湾区好去处', 'Places to go in the Bay Area'), subtitle: t('旧金山、东湾、半岛、南湾与北湾，免费的去处和出游路线', 'San Francisco, the East Bay, the Peninsula, the South Bay and the North Bay: free places and day plans'),
      rows: [t('旧金山 · 东湾 · 半岛', 'San Francisco · East Bay · Peninsula'), t('南湾 · 北湾', 'South Bay · North Bay'), t('收藏地点，排进你的一天', 'Save places and plan your day')].map(text => ({ text })), scan, footnote, ...brandLine };
    case 'plan': return { eyebrow: 'BayBay', title: t('一句话，排好湾区的一天', 'Plan a Bay Area day out in one sentence'), subtitle: t('活动、餐厅与景点，附来源、时间和预算', 'Events, restaurants and places, with sources, times and a budget'),
      rows: [t('说出日期、地区和同行的人', 'Say the date, the area and who is coming'), t('BayBay 排出时间和路线', 'BayBay lays out the times and the route'), t('改一句、保存、分享给家人', 'Adjust it, save it, share it with family')].map(text => ({ text })), scan, footnote, ...brandLine };
    case 'tools': return { eyebrow: t('工具箱', 'Tools'), title: t('湾区生活工具箱', 'Bay Area everyday tools'), subtitle: t('在浏览器里算清楚，不用登录', 'Work it out in your browser, no sign-in'), rows: data.tools.slice(0, 4).map(text => ({ text: tr(text) })), scan, footnote, ...brandLine };
    default: return { eyebrow: 'BAYLINK', title: t('湾区去哪、怎么办', 'Where to go, and how to get things done, in the Bay Area'), subtitle: t('有来源的中文答案', 'Answers with sources, in Chinese and English'),
      rows: [t('本周末活动 · 每条附官方来源', 'This weekend’s events, each with its official source'), t(`${data.guideCount} 篇办事指南`, `${data.guideCount} practical guides`), t('问 BayBay：有来源的答案', 'Ask BayBay: answers with sources')].map(text => ({ text })), scan, footnote, ...brandLine };
  }
}
