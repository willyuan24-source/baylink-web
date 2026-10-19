import type { ReactNode } from 'react';
import { translateText } from '../../i18n/locale';
import { EventCover, FeedCard, HeroCard, RowCard, TypeCover, Cover, COVER_SIZES } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import type { ResolvedCover } from '../../lib/cover';
import { eventDateChip, eventPlace, eventPriceChip, eventTimeLabel, formatDateChip, type CoverTone, type EventFactsInput } from '../../lib/event-facts';
import type { IndexEvent } from './events-index-types';
import { monthDay, regionLabel } from './events-model';
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

/** "官网核对 10/2" / "Source checked Oct 2": the record's own check date, never a bumped one (D12). */
export function TrustLine({ day }: { day?: string }) {
  const { t, english } = useUiCopy();
  if (!day) return null;
  return <>{t('官网核对', 'Source checked')} {monthDay(day, english)}</>;
}

/** The place and price line under a card: "Berkeley · 免费" (free in brand 600), or the place alone when the cost is unknown. */
export function EventMeta({ event }: { event: IndexEvent }) {
  const { pick, locale } = useUiCopy();
  const price = eventPriceChip(facts(event));
  const place = translateText(eventPlace(event), locale);
  // The place gives way (ellipsis) before the price does: "Old Courthouse Square · 部分免费", never "… · 部…".
  return <><span className="ui-meta-place">{place}</span>{price && <span className="ui-meta-price"><span className="ui-meta-sep"> · </span>{price.tone === 'free' ? <strong>{pick(price.text)}</strong> : pick(price.text)}</span>}</>;
}

/**
 * ♡ on a card's cover (H31, EVT13-10 / FCC-04 / SV13-10): the one save control, in the card's save slot over the cover's
 * top-right corner, the same heart as the home feed (saves.css styles it as a 44px circle). The lazy
 * `SaveToWeek` keeps the save store off the route graph; its name reads "收藏：<title>".
 */
const CoverSave = ({ favorite, title }: { favorite: Favorite; title: string }) => <SaveToWeek favorite={favorite} compact title={title} />;

/**
 * Two-column feed card (3:4): the cover from `resolveCovers`, title, place · price, the source check and ♡ on the cover.
 * `day` (the calendar's chosen day) goes into the link, so the detail page opens on it. `action` (the calendar's
 * 加入这天计划, WEB-SAVES) takes the save slot instead, as a sibling of the card link under the meta lines.
 */
export function EventFeedCard({ event, cover, tone, today, days, day, priority, sizes, heading = 'h3', action }: { event: IndexEvent; cover: ResolvedCover; tone?: CoverTone; today: string; days?: readonly string[]; day?: string; priority?: boolean; sizes?: string; heading?: 'h2' | 'h3'; action?: ReactNode }) {
  return <FeedCard title={event.title} to={day ? `/events/${event.id}?date=${day}` : `/events/${event.id}`} heading={heading} className={action ? 'ev-card--action' : undefined}
    cover={<EventCover event={facts(event)} cover={cover} tone={tone} today={today} days={days} priority={priority} sizes={sizes} decorative />}
    meta={<EventMeta event={event} />} trust={<TrustLine day={event.verifiedAt} />} save={action ?? <CoverSave favorite={{ kind: 'event', id: event.id }} title={event.title} />} />;
}

/** 4:5 editor's pick: photo with the title on the scrim, or the A2 TypeCover with the title below; ♡ on the cover. */
export function EventHeroCard({ event, cover, today, date, reason, priority }: { event: IndexEvent; cover: ResolvedCover; today: string; date: string; reason?: { zh: string; en: string }; priority?: boolean }) {
  const { english, pick, t, locale } = useUiCopy();
  const chip = formatDateChip(eventDateChip(facts(event), today, [date]), english);
  const time = eventTimeLabel(facts(event), date, english);
  const price = eventPriceChip(facts(event));
  const photo = cover.tier !== 'type';
  const region = pick(regionLabel(event.region));
  const city = translateText(eventPlace(event), locale);
  return <HeroCard title={translateText(event.title, locale)} to={`/events/${event.id}`} heading="h3" overlay={photo}
    cover={<EventCover event={facts(event)} cover={cover} today={today} days={[date]} ratio="4:5" ratioLock priority={priority} sizes={HERO_SIZES} decorative />}
    kicker={city === region || (event.city === 'San Francisco' && event.region === 'sf') ? region : `${city} · ${region}`}
    facts={[[chip.label, time].filter(Boolean).join(' · '), ...(price ? [pick(price.text)] : [])]}
    reason={reason ? { label: t('编辑推荐', 'Editor’s pick'), text: pick(reason) } : undefined}
    trust={<TrustLine day={event.verifiedAt} />} save={<CoverSave favorite={{ kind: 'event', id: event.id }} title={event.title} />} />;
}

/**
 * Calendar and share-strip row (88×88 thumbnail): "周六 10/10 · 10:00–18:00", the title, "Fremont · $8–12". `action`
 * (the calendar's 加入这天计划, WEB-SAVES) is the row's one trailing control, under the text.
 */
export function EventRowCard({ event, cover, today, day, action }: { event: IndexEvent; cover: ResolvedCover; today: string; day: string; action?: ReactNode }) {
  const { english } = useUiCopy();
  const chip = formatDateChip(eventDateChip(facts(event), today, [day]), english);
  const time = eventTimeLabel(facts(event), day, english);
  const thumb = <Cover cover={cover} ratio="1:1" sizes={COVER_SIZES.thumb} decorative
    fallback={<TypeCover size="mini" tone={event.category} label="" date={chip} ariaHidden />} />;
  return <RowCard title={event.title} to={`/events/${event.id}?date=${day}`} thumb={thumb} className={action ? 'ev-card--action' : undefined}
    date={[chip.label, time].filter(Boolean).join(' · ')} meta={<EventMeta event={event} />} trailing={action} />;
}

// The offer and new-shop cards (OfferFeedCard, OpeningFeedCard) are in BoardCards.tsx (UI9-PREP).
