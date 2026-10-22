import type { ReactNode } from 'react';
import { translateText } from '../../i18n/locale';
import { EventCover, EventWhen, FeedCard, HeroCard, RowCard, COVER_SIZES, useRowCredit } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import type { ResolvedCover } from '../../lib/cover';
import { eventPlace, eventPriceChip, eventWhenLine, type EventFactsInput } from '../../lib/event-facts';
import type { IndexEvent } from './events-index-types';
import { monthDay, regionLabel } from './events-model';
import { dayWhenLine } from './event-lines';
import { SaveToWeek } from '../../components/SaveToWeek';
import type { Favorite } from '../../lib/planner';

const facts = (event: IndexEvent) => event as unknown as EventFactsInput;

/**
 * A phone-wide cover (a 4:5 pick, the calendar's lead) takes the 800w rung at most: 266px × DPR 3 = 798. At DPR 3 the
 * 1200w rung is about twice the bytes (autumn-ardenwood: 135 KB vs 72 KB) for a 358px slot, and on the cold profile
 * (1.6 Mbps) those bytes delay the page's largest image (RC-33); 800w is still 2.2 device pixels per CSS pixel there.
 */
export const PHONE_COVER_CAP = '(max-width: 767px) 266px';
const HERO_SIZES = `${PHONE_COVER_CAP}, 380px`;
/** The /events lead: the phone width (capped as above), the 8-column span on desktop (803px at 1440), full width between. */
const LEAD_SIZES = `${PHONE_COVER_CAP}, (max-width: 1023px) calc(100vw - 48px), 803px`;

/**
 * "官网核对 10/2" / "Source checked Oct 2": the record's own check date, never a bumped one (D12). `press` (the source is a
 * press report, not the organiser's page: IndexEvent.press, or isPressSource(sourceLabel) for offers and openings) reads
 * 「媒体报道 · 10/2 核对」 / "News report · checked Oct 2" instead (UI-9 DECISIONS 17, owner confirmed 10-19).
 */
export function TrustLine({ day, press }: { day?: string; press?: boolean }) {
  const { t, english } = useUiCopy();
  if (!day) return null;
  const date = monthDay(day, english);
  return <>{press ? t(`媒体报道 · ${date} 核对`, `News report · checked ${date}`) : `${t('官网核对', 'Source checked')} ${date}`}</>;
}

/**
 * The older place · price line ("Berkeley · 免费", the free price in <strong>). No card uses it since UI9-EVENTS (they print
 * EventStatusLine); it stays only for tests/prod-w3-fixes.test.tsx (UI9-DETAIL's), which asserts this shape. UI9-INT
 * deletes it once that assertion reads EventStatusLine (PR.md request).
 */
export function EventMeta({ event }: { event: IndexEvent }) {
  const { pick, locale } = useUiCopy();
  const price = eventPriceChip(facts(event));
  const place = translateText(eventPlace(event), locale);
  return <><span className="ui-meta-place">{place}</span>{price && <span className="ui-meta-price"><span className="ui-meta-sep"> · </span>{price.tone === 'free' ? <strong>{pick(price.text)}</strong> : pick(price.text)}</span>}</>;
}

/**
 * Line 2 of an event card (G18): the status, then the place — "免费 · UCSF Mission Bay". 免费 and 部分免费 are C's one
 * status map (StatusChip: one look each, 14px, wraps); a price reads as plain text ("$8–12 · Fremont"); an unknown cost
 * leaves the place alone. The line wraps and is never cut, and never starts with "·".
 */
export function EventStatusLine({ event }: { event: IndexEvent }) {
  const { pick, locale } = useUiCopy();
  const price = eventPriceChip(facts(event));
  const place = translateText(eventPlace(event), locale);
  const status = !price ? null : price.tone === 'free' || price.tone === 'mixed'
    // C's one status map, as StatusChip renders it (免费 → free, 部分免费 → partial): the markup, not the module, so the events
    // routes do not load the status map's chunk for two fixed tones.
    ? <span className="ui-status" data-tone={price.tone === 'free' ? 'free' : 'partial'}>{pick(price.text)}</span>
    : <span className="ui-meta-price">{pick(price.text)}</span>;
  // A no-break space before "·": the dot stays with the status, so a wrapped line never starts with it (N06).
  return <>{status}{status && place && <span className="ui-meta-sep">{'\u00a0· '}</span>}{place && <span className="ui-meta-place">{place}</span>}</>;
}

/** Line 1: the date and time in one pattern, or in a one-day list (`oneDay`) the time window alone (event-lines.ts). */
function WhenLine({ event, today, days, oneDay }: { event: IndexEvent; today: string; days?: readonly string[]; oneDay?: string }) {
  const { pick } = useUiCopy();
  return oneDay ? <>{pick(dayWhenLine(event, today, oneDay))}</> : <EventWhen event={facts(event)} today={today} days={days} />;
}

/**
 * ♡ on a card's cover (H31, EVT13-10 / FCC-04 / SV13-10): the one save control, in the card's save slot over the cover's
 * top-right corner, the same heart as the home feed (saves.css styles it as a 44px circle). The lazy
 * `SaveToWeek` keeps the save store off the route graph; its name reads "收藏：<title>".
 */
const CoverSave = ({ favorite, title }: { favorite: Favorite; title: string }) => <SaveToWeek favorite={favorite} compact title={title} />;

/**
 * Feed card: the cover from `resolveCovers` (no stickers: the date and status are in the caption), the title, line 1 (when),
 * line 2 (status · place), the source check and ♡ on the cover. `day` (the calendar's chosen day) goes into the link, so the
 * detail page opens on it; `oneDay` makes line 1 the time window (a one-day list). `action` (the calendar's 加入这天计划,
 * WEB-SAVES) takes the save slot instead, as a sibling of the card link under the meta lines. `save={false}` drops ♡
 * (简洁显示 rows save on the detail page, DECISIONS 16).
 */
export function EventFeedCard({ event, cover, today, days, day, oneDay, priority, sizes, ratio, heading = 'h3', action, save = true, className }: { event: IndexEvent; cover: ResolvedCover; today: string; days?: readonly string[]; day?: string; oneDay?: string; priority?: boolean; sizes?: string; ratio?: '3:2' | '16:9'; heading?: 'h2' | 'h3' | 'h4'; action?: ReactNode; save?: boolean; className?: string }) {
  return <FeedCard title={event.title} to={day ? `/events/${event.id}?date=${day}` : `/events/${event.id}`} heading={heading} className={[action ? 'ev-card--action' : '', className ?? ''].filter(Boolean).join(' ') || undefined}
    cover={<EventCover event={facts(event)} cover={cover} today={today} days={days} priority={priority} sizes={sizes} ratio={ratio} ratioLock={!!ratio} decorative />}
    when={<WhenLine event={event} today={today} days={day ? [day] : days} oneDay={oneDay} />} meta={<EventStatusLine event={event} />} trust={<TrustLine day={event.verifiedAt} press={event.press} />}
    save={action ?? (save ? <CoverSave favorite={{ kind: 'event', id: event.id }} title={event.title} /> : undefined)} />;
}

/**
 * The /events lead (G15, content arrangement §2 A): HeroCard without the photo overlay, so the caption sits under the
 * picture in this order — 编辑推荐 · reason (or 本周末先看) → title → line 1 → line 2 → ✓ 官网核对 (events.css orders the
 * HeroCard parts; HeroCard's own default rendering, used on home, is unchanged). Two overlays at most: ♡ and the cover's
 * provenance chip. 2:1 inset on phones (3:2 at 特大 / 简洁), 16:9 in the 8-column span on desktop; it is the page's one
 * fetchpriority="high" image.
 */
export function EventLeadCard({ event, cover, today, days, kicker, reason, save = true }: { event: IndexEvent; cover: ResolvedCover; today: string; days: readonly string[]; kicker: string; reason?: string; save?: boolean }) {
  const { locale } = useUiCopy();
  return <HeroCard title={translateText(event.title, locale)} to={`/events/${event.id}`} heading="h3" overlay={false} className="ev-lead"
    cover={<EventCover event={facts(event)} cover={cover} today={today} days={days} ratio="16:9" ratioLock priority sizes={LEAD_SIZES} decorative />}
    when={<EventWhen event={facts(event)} today={today} days={days} />} meta={<EventStatusLine event={event} />}
    reason={{ label: reason ? `${kicker} ·` : kicker, text: reason ?? '' }}
    trust={<TrustLine day={event.verifiedAt} press={event.press} />} save={save ? <CoverSave favorite={{ kind: 'event', id: event.id }} title={event.title} /> : undefined} />;
}

/** 4:5 editor's pick: the picture with the title on the scrim; ♡ on the cover. (Kept as an export; /events leads with
 *  EventLeadCard since UI9-EVENTS.) */
export function EventHeroCard({ event, cover, today, date, reason, priority }: { event: IndexEvent; cover: ResolvedCover; today: string; date: string; reason?: { zh: string; en: string }; priority?: boolean }) {
  const { pick, t, locale } = useUiCopy();
  const price = eventPriceChip(facts(event));
  const photo = cover.tier !== 'type';
  const region = pick(regionLabel(event.region));
  const city = translateText(eventPlace(event), locale);
  return <HeroCard title={translateText(event.title, locale)} to={`/events/${event.id}`} heading="h3" overlay={photo}
    cover={<EventCover event={facts(event)} cover={cover} today={today} days={[date]} ratio="4:5" ratioLock priority={priority} sizes={HERO_SIZES} decorative />}
    kicker={city === region || (event.city === 'San Francisco' && event.region === 'sf') ? region : `${city} · ${region}`}
    facts={[pick(eventWhenLine(facts(event), today, [date])), ...(price ? [pick(price.text)] : [])]} when={<EventWhen event={facts(event)} today={today} days={[date]} />} meta={<EventMeta event={event} />}
    reason={reason ? { label: t('编辑推荐', 'Editor’s pick'), text: pick(reason) } : undefined}
    trust={<TrustLine day={event.verifiedAt} press={event.press} />} save={<CoverSave favorite={{ kind: 'event', id: event.id }} title={event.title} />} />;
}

/**
 * Row (a 112px 4:3 thumbnail in events.css): line 1, the title, line 2 and ✓ 官网核对 — the calendar, the share strip, the
 * desktop pick rows and every events feed at 大 / 特大 and in 简洁显示. The thumbnail is a picture (DECISIONS 21) whose ①②
 * badge words sit in the row's 13 px line (a ③④ badge stays on it). `oneDay` prints line 1 as the time window alone; the share strip keeps the card's own day. The one
 * trailing control: `action` (the calendar's 加入这天计划, WEB-SAVES), else ♡ when `save`.
 */
export function EventRowCard({ event, cover, today, day, oneDay, action, save = false }: { event: IndexEvent; cover: ResolvedCover; today: string; day: string; oneDay?: boolean; action?: ReactNode; save?: boolean }) {
  const credit = useRowCredit();
  const thumb = <EventCover event={facts(event)} cover={cover} today={today} days={[day]} ratio="1:1" sizes={COVER_SIZES.thumb} decorative />;
  return <RowCard title={event.title} to={`/events/${event.id}?date=${day}`} thumb={thumb} className={action ? 'ev-row ev-card--action' : 'ev-row'}
    when={<WhenLine event={event} today={today} days={[day]} oneDay={oneDay ? day : undefined} />} meta={<EventStatusLine event={event} />}
    trust={<TrustLine day={event.verifiedAt} press={event.press} />} credit={credit(cover)}
    trailing={action ?? (save ? <CoverSave favorite={{ kind: 'event', id: event.id }} title={event.title} /> : undefined)} />;
}

// The offer and new-shop cards (OfferFeedCard, OpeningFeedCard) are in BoardCards.tsx (UI9-PREP).
