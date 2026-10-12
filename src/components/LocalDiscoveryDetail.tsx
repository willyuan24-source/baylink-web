import { ArrowRight, CalendarDays, Check, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getBayAreaToday } from '../lib/monthly';
import { downloadEventCalendar } from '../lib/event-ics';
import { EventParticipationActions, EventParticipationProvider } from './EventParticipation';
import { EditorialShareActions } from './EditorialShareActions';
import { SourceFreshness } from '../features/source-monitor/SourceFreshness';
import { TrustRow } from '../features/source-monitor/TrustRow';
import { ContentReviewNotice } from '../features/source-monitor/ContentReviewNotice';
import { LazyReportErrorLink } from '../features/feedback/LazyEntryLinks';
import { OutingInspirationLink } from './OutingInspirationLink';
import { SegmentedTitle } from './SegmentedTitle';
import { StatusChip, type StatusTone } from './ui';
import { useUiCopy } from './ui/ui-copy';
import { translateText } from '../i18n/locale';
import { openingStatusNote } from '../lib/opening-status';
import { discoveryContentReviewRecord } from '../lib/content-review';
import { createCoverPage } from '../lib/cover';
import { brandCase, eventTone, offerDeadline, offerKindLabel, openingChip, toneLabel, type Copy } from '../lib/event-facts';
import { detailShare, nextEventDay, railEvents, unconfirmedEvent, type DetailRecord } from '../features/detail/detail-record';
import { DetailHero, HeroCredit } from '../features/detail/DetailHero';
import { heroCover } from '../features/detail/hero-cover';
import { EventFacts, OfferFacts, OpeningFacts } from '../features/detail/FactsGrid';
import { DetailActionBar, type DetailActions } from '../features/detail/DetailActionBar';
import { DetailRail } from '../features/detail/DetailRail';
import { BenefitSteps } from '../features/detail/BenefitSteps';
import { SquadTeaser } from '../features/detail/SquadTeaser';
import { ReaderText } from '../features/detail/ReaderText';
import { readerPlanLines, readerProse } from '../features/detail/reader-text';

/**
 * Event, offer and opening detail (T6; design.md §4.9 with D10; EVT11-03, SV-05). Phone order: "‹ 活动" → the hero →
 * status chips → H1 → the why-go line → (ended: 接下来可以去) → 一眼看懂 2×2 → the body (出发前 / 领取条件 / 怎么安排) →
 * 一起去 → source and checks → share → 附近同类活动. The action bar (♡ 收藏 · 加入这天计划 · 问 BayBay · 官方页 ↗) replaces
 * the tab bar on a phone and is the sticky aside on a desktop.
 *
 * The page renders one generated record (features/detail: ENGSEC-01), never the whole catalog. Every catalog string goes
 * through the reader filters (editor notes out, templated date/price lines out; CNT-1011-05/06) and tap-to-call (CW-01).
 */
export function LocalDiscoveryDetail({ record, today = getBayAreaToday() }: { record: DetailRecord; today?: string }) {
  if (record.item.kind === 'event') return <EventParticipationProvider events={[record.item.event]}><DiscoveryArticle record={record} today={today} /></EventParticipationProvider>;
  return <DiscoveryArticle record={record} today={today} />;
}

const BACK: Record<DetailRecord['item']['kind'], { to: string; label: Copy }> = {
  event: { to: '/events', label: { zh: '活动', en: 'Events' } },
  offer: { to: '/events?view=perks', label: { zh: '免费与优惠', en: 'Free & deals' } },
  opening: { to: '/events?view=openings', label: { zh: '新店', en: 'New shops' } },
};
const STATUS: Record<'postponed' | 'cancelled' | 'sold_out', { tone: StatusTone; text: Copy }> = {
  postponed: { tone: 'warning', text: { zh: '延期 · 日期待定', en: 'Postponed · new date TBA' } },
  cancelled: { tone: 'danger', text: { zh: '已取消', en: 'Cancelled' } },
  sold_out: { tone: 'warning', text: { zh: '已售罄', en: 'Sold out' } },
};
const DEADLINE_TONE: Record<string, StatusTone> = { danger: 'danger', warning: 'warning', success: 'success', neutral: 'neutral' };
const monthDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

function DiscoveryArticle({ record, today }: { record: DetailRecord; today: string }) {
  const { t, pick, locale, english } = useUiCopy();
  const { item } = record;
  const share = detailShare(item);
  const event = item.kind === 'event' ? item.event : undefined;
  const planDate = event ? nextEventDay(event, today) : null;
  const unconfirmed = !!event && unconfirmedEvent(event);
  const ended = event ? planDate === null : item.kind === 'offer' && !!item.offer.endDate && item.offer.endDate < today;
  // An event with no confirmed day is waiting for one, not over: it gets no "接下来可以去" in place of the page.
  const eventOver = !!event && ended && !unconfirmed;
  const unconfirmedOffer = item.kind === 'offer' && item.offer.verificationStatus === 'needs-confirmation';
  const officialUrl = item.kind === 'event' ? item.event.officialUrl : item.kind === 'offer' ? item.offer.sourceUrl : item.shop.officialUrl;
  const sourceUrl = item.kind === 'opening' ? item.shop.sourceUrl : officialUrl;
  const sourceLabel = item.kind === 'event' ? item.event.sourceLabel : item.kind === 'offer' ? item.offer.sourceLabel : item.shop.sourceLabel;
  const review = discoveryContentReviewRecord(item);
  const cover = heroCover(record, today);
  // The hero's photo is never repeated in the page's rails (VISUAL-10).
  const coverPage = createCoverPage();
  if (cover.tier !== 'type') coverPage.claims.set(cover.image.src, `${item.kind}:${share.id}`);
  const title = item.kind === 'offer' ? item.offer.title : share.title;
  const back = BACK[item.kind];

  const chips: { key: string; tone: StatusTone; text: string }[] = [];
  if (event) {
    chips.push({ key: 'tone', tone: 'neutral', text: pick(toneLabel(eventTone(event))) });
    if (event.status) chips.push({ key: 'status', tone: STATUS[event.status].tone, text: pick(STATUS[event.status].text) });
    if (eventOver) chips.push({ key: 'ended', tone: 'ended', text: t(`已结束 · ${monthDay(event.endDate)}`, `Ended · ${monthDay(event.endDate)}`) });
    else if (unconfirmed && !event.status) chips.push({ key: 'tba', tone: 'warning', text: t('日期待定', 'Date TBA') });
    if (event.cost === 'free') chips.push({ key: 'free', tone: 'success', text: t('免费', 'Free') });
    if (event.ageChip) chips.push({ key: 'age', tone: 'info', text: translateText(event.ageChip, locale) });
  } else if (item.kind === 'offer') {
    chips.push({ key: 'kind', tone: 'neutral', text: pick(offerKindLabel(item.offer)) });
    const deadline = offerDeadline(item.offer, today);
    if (deadline) chips.push({ key: 'deadline', tone: ended ? 'ended' : DEADLINE_TONE[deadline.tone], text: pick(deadline.text) });
    if (unconfirmedOffer) chips.push({ key: 'check', tone: 'warning', text: t('待确认', 'To be confirmed') });
  } else if (item.kind === 'opening') {
    chips.push({ key: 'opening', tone: item.shop.status === 'announced' ? 'info' : 'success', text: pick(openingChip(item.shop, today)) });
  }

  const favorite = item.kind === 'event' ? { kind: 'event' as const, id: item.event.id } : item.kind === 'offer' ? { kind: 'offer' as const, id: item.offer.id } : { kind: 'opening' as const, id: item.shop.id };
  const actions: DetailActions = {
    title,
    official: { href: officialUrl, label: item.kind === 'offer' ? t('领取入口', 'How to claim') : item.kind === 'opening' ? t('商家官网', 'Official site') : t('官方页', 'Official') },
    ...(!ended && !unconfirmed ? { favorite } : {}),
    ...(event && planDate ? { day: { stop: { kind: 'event' as const, id: event.id }, date: planDate, today } } : {}),
    ...(item.kind === 'opening' && record.placeId ? { planPath: `/plan?stops=place:${record.placeId}` } : {}),
  };
  const planLines = event ? readerPlanLines(event).filter(line => readerProse(line, locale)) : [];
  const nextCards = event && eventOver ? railEvents(event, record.rail, today, { sameCategory: false, limit: 4 }) : [];
  const relatedCards = event && !eventOver ? railEvents(event, record.rail, today, { sameCategory: true, limit: 3 }) : [];

  return <article className="local-discovery-detail detail-page" data-kind={item.kind} data-ended={ended ? '' : undefined}>
    <nav className="detail-back" aria-label={t('返回', 'Back')}><Link to={back.to}><ChevronLeft aria-hidden="true" strokeWidth={1.75} />{pick(back.label)}</Link></nav>
    <div className="detail-layout">
      <div className="detail-main">
        <DetailHero record={record} cover={cover} today={today} ended={eventOver} />
        <header className="detail-head">
          <p className="detail-chips">{chips.map(chip => <StatusChip key={chip.key} tone={chip.tone}>{chip.text}</StatusChip>)}</p>
          <h1><SegmentedTitle text={title} /></h1>
          {item.kind === 'offer' && <p className="detail-brand" translate="no">{brandCase(item.offer.brand)}</p>}
          {event?.dek && <p className="detail-dek"><ReaderText text={event.dek} /></p>}
        </header>
        {eventOver && <p className="detail-note">{t('这场活动已结束。下面是附近接下来可以去的活动。', 'This event has ended. Here is what is on next nearby.')}</p>}
        {eventOver && <DetailRail id="detail-next-title" title={t('接下来可以去', 'Up next nearby')} cards={nextCards} today={today} page={coverPage} />}
        {unconfirmed && <p className="detail-note">{t('暂无已确认场次，请查看主办方最新安排。', 'No date is confirmed yet. Check the organizer’s latest schedule.')}</p>}
        {item.kind === 'offer' && ended && <p className="detail-note">{t('这份优惠已过期，保留供分享链接回顾。', 'This offer has expired; the page stays for shared links.')}</p>}
        {unconfirmedOffer && <p className="detail-note">{t('当前优惠待确认；请先联系官方，确认后再安排行程。', 'This offer is not confirmed yet. Check with the provider before you plan around it.')}</p>}
        {item.kind === 'event' ? <EventFacts event={item.event} today={today} /> : item.kind === 'offer' ? <OfferFacts offer={item.offer} /> : <OpeningFacts shop={item.shop} />}
        <ContentReviewNotice record={review} today={today} />
        {item.kind === 'opening' && <p className="detail-note">{translateText(openingStatusNote(item.shop.status), locale)}</p>}

        <div className="detail-body">
          {event && <>
            {event.summary && <p className="detail-summary"><ReaderText text={event.summary} /></p>}
            {!eventOver && planLines.length > 0 && <section aria-labelledby="detail-plan-title">
              <h2 id="detail-plan-title">{t('出发前，做好这些安排', 'Before you go')}</h2>
              <ul className="detail-plan">{planLines.map(line => <li key={line}><Check aria-hidden="true" strokeWidth={2} /><p><ReaderText text={line} /></p></li>)}</ul>
            </section>}
            {!eventOver && <section className="detail-together" aria-labelledby="detail-together-title">
              <h2 id="detail-together-title">{t('想约人一起去？', 'Going with others?')}</h2>
              <div id="event-participation" className="discovery-participation-anchor"><EventParticipationActions event={event} today={today} available={!ended} /></div>
              <SquadTeaser eventId={event.id} />
            </section>}
          </>}
          {item.kind === 'offer' && <BenefitSteps offer={item.offer} />}
          {item.kind === 'opening' && <>
            <p className="detail-summary"><ReaderText text={item.shop.summary} /></p>
            <section aria-labelledby="detail-visit-title"><h2 id="detail-visit-title">{t('这一趟怎么安排', 'Planning the visit')}</h2><p><ReaderText text={item.shop.editorTip} name={item.shop.name} /></p></section>
          </>}
          {item.kind !== 'event' && !ended && !unconfirmedOffer && <OutingInspirationLink kind={item.kind} id={share.id} />}

          <section className="detail-source" aria-labelledby="detail-source-title">
            <h2 id="detail-source-title">{t('来源与核对', 'Source and checks')}</h2>
            <TrustRow contentId={review.id} item={review} sourceUrl={sourceUrl} sourceLabel={sourceLabel} official={sourceUrl === officialUrl} today={today} />
            <SourceFreshness contentId={review.id} item={{ ...review, nextDate: planDate }} officialUrl={officialUrl} include={['soft']} today={today} />
            <HeroCredit cover={cover} />
            {event?.relatedGuideSlug && <Link className="discovery-related" to={`/guides/${event.relatedGuideSlug}`}>{t('搭配一篇本地攻略', 'Read a related local guide')}<ArrowRight size={17} aria-hidden="true" /></Link>}
            <LazyReportErrorLink entity={{ kind: item.kind, id: share.id }} title={share.title} />
          </section>
          <section className="detail-share" aria-label={t('分享与日历', 'Share and calendar')}>
            <EditorialShareActions item={share} />
            {event && planDate && <button type="button" className="detail-calendar" onClick={() => downloadEventCalendar(event, planDate)}><CalendarDays size={17} aria-hidden="true" />{t('存入日历', 'Add to calendar')}</button>}
          </section>
          {event && !eventOver && <DetailRail id="detail-related-title" title={english ? 'More upcoming events nearby' : translateText('附近同类活动的下一场', locale)}
            note={english ? 'Confirmed sessions in the same city first, then the same region. Check the organizer before going.' : translateText('先看同城，再看同区域的已确认场次；出发前请核对主办方安排。', locale)}
            cards={relatedCards} today={today} page={coverPage} />}
        </div>
      </div>
      <aside className="detail-aside"><DetailActionBar actions={actions} /></aside>
    </div>
    <footer className="discovery-return">
      <span className="discovery-eyebrow" translate="no">{t('继续发现湾区', 'Keep exploring the Bay')}</span>
      <h2>{t('这只是湾区的一小部分。', 'This is only a small part of the Bay.')}</h2>
      <div>
        <Link to="/events">{t('本周末活动', 'This weekend’s events')}<ArrowRight size={17} aria-hidden="true" /></Link>
        <Link to="/my-week#saved">{t('我的收藏', 'My saved items')}<ArrowRight size={17} aria-hidden="true" /></Link>
        <Link to="/events?view=perks">{t('免费与优惠', 'Free & deals')}<ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
    </footer>
  </article>;
}

