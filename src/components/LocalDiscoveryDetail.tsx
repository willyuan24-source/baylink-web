import { CalendarDays, Check, ChevronLeft, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { getBayAreaToday } from '../lib/monthly';
import { downloadEventCalendar } from '../lib/event-ics';
import { EventParticipationActions, EventParticipationProvider } from './EventParticipation';
import { useEventParticipation } from '../lib/event-participation-context';
import { EditorialShareActions } from './EditorialShareActions';
import { SourceFreshness } from '../features/source-monitor/SourceFreshness';
import { CheckedLine, TrustRow } from '../features/source-monitor/TrustRow';
import { ContentReviewNotice } from '../features/source-monitor/ContentReviewNotice';
import { LazyReportErrorLink } from '../features/feedback/LazyEntryLinks';
import { SegmentedTitle } from './SegmentedTitle';
import { StatusChip, type StatusTone } from './ui';
import { Button } from './ui/Button';
import { MoreLink } from './ui/TextLink';
import { useUiCopy } from './ui/ui-copy';
import { translateText } from '../i18n/locale';
import { discoveryContentReviewRecord } from '../lib/content-review';
import { createCoverPage, type ImageCover } from '../lib/cover';
import type { MonthlyEvent } from '../data/monthly-types';
import { eventTone, isPublicBenefit, offerDeadline, offerKindLabel, offerTone, openingChip, readerMonthDay, toneLabel, type Copy } from '../lib/event-facts';
import { DETAIL_BACK, detailShare, nextEventDay, railEvents, unconfirmedEvent, type DetailRecord } from '../features/detail/detail-record';
import { DetailHero, DetailPlacePhoto } from '../features/detail/DetailHero';
import { HeroCaption, PageCredits } from '../features/detail/PageCredits';
import { heroCover, placePhoto, railCovers } from '../features/detail/hero-cover';
import { EventFacts, OfferFacts, OpeningFacts } from '../features/detail/FactsGrid';
import { AskCell, DetailActionBar, FamilyCell, PrimaryAction, SaveCell, type DetailPrimary } from '../features/detail/DetailActionBar';
import { DetailRail } from '../features/detail/DetailRail';
import { DetailBack } from '../features/detail/DetailSkeleton';
import { BenefitSteps } from '../features/detail/BenefitSteps';
import { SquadTeaser } from '../features/detail/SquadTeaser';
import { ReaderText } from '../features/detail/ReaderText';
import { offerBrand, readerPlanLines, readerProse } from '../features/detail/reader-text';

/**
 * Event, offer and opening detail (T6; UI9-DETAIL content arrangement 10-19). Phone order: "‹ 活动" → the 16:9 hero and its
 * credit line → the category chip and at most two status chips → H1 → the dek / the brand / the city → (ended: one notice,
 * then 接下来可以去) → the facts card ending "✓ 官网核对 M/D" → the body (summary, the venue's archive photo when it is too old
 * to be the cover, 出发前 / 领取条件 + 怎么领 / 这一趟怎么安排) → 来源与核对 → 想约人一起去？ with the share row → 附近同类活动 →
 * 继续发现湾区. The action bar (收藏 · 发家人 · 问 BayBay + one primary) replaces the tab bar on a phone and is the second card
 * of the sticky aside on a desktop (8 + 4 columns). 简洁显示 subtracts the blocks marked data-simple="hide".
 *
 * The page renders one generated record (features/detail: ENGSEC-01), never the whole catalog. Every catalog string goes
 * through the reader filters (editor notes out, templated date/price lines out; CNT-1011-05/06) and tap-to-call (CW-01).
 */
export function LocalDiscoveryDetail({ record, today = getBayAreaToday() }: { record: DetailRecord; today?: string }) {
  if (record.item.kind === 'event') return <EventParticipationProvider events={[record.item.event]}><DiscoveryArticle record={record} today={today} /></EventParticipationProvider>;
  return <DiscoveryArticle record={record} today={today} />;
}

const STATUS: Record<'postponed' | 'cancelled' | 'sold_out', { tone: StatusTone; text: Copy }> = {
  postponed: { tone: 'neutral', text: { zh: '延期 · 日期待定', en: 'Postponed · new date TBA' } },
  cancelled: { tone: 'urgent', text: { zh: '已取消', en: 'Cancelled' } },
  sold_out: { tone: 'urgent', text: { zh: '已售罄', en: 'Sold out' } },
};
const DEADLINE_TONE: Record<string, StatusTone> = { danger: 'urgent', warning: 'soon', success: 'open', neutral: 'neutral' };
const monthDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
/** "21+ · Napa Harvest After Dark" → "Napa Harvest After Dark" when the age chip is 21+. */
const withoutAgePrefix = (title: string, ageChip: string) => {
  const chip = ageChip.trim();
  if (!chip || !title.startsWith(chip)) return title;
  const rest = title.slice(chip.length).replace(/^\s*[·•:：|｜–—-]\s*/u, '');
  return rest && rest.length < title.length - chip.length ? rest : title;
};
/** "Marufuku Ramen · Burlingame" → "Marufuku Ramen" when the tail is the shop's own city (P26: the city is the sub line). */
const withoutCityTail = (name: string, city: string) => {
  const at = name.lastIndexOf(' · ');
  return at > 0 && name.slice(at + 3).trim().toLocaleLowerCase('en-US') === city.trim().toLocaleLowerCase('en-US') ? name.slice(0, at) : name;
};
/** What "nearby" means for an offer's or an opening's rows (railEvents): the shop's city; an offer has none (its region's
 *  events came with the record, build-detail.ts). */
const nearPage = (item: DetailRecord['item']) => ({ category: '' as MonthlyEvent['category'], city: item.kind === 'opening' ? item.shop.city : '' });

function DiscoveryArticle({ record, today }: { record: DetailRecord; today: string }) {
  const { t, pick, locale, english } = useUiCopy();
  const { item } = record;
  const share = detailShare(item);
  const event = item.kind === 'event' ? item.event : undefined;
  const planDate = event ? nextEventDay(event, today) : null;
  // H56 / EVT13-05: "no confirmed day" is waiting only while the run has not ended (or the event is postponed); a past one is
  // over: 已结束 · 9/26 and 接下来可以去, never 日期待定 beside the archive notice.
  const unconfirmed = !!event && unconfirmedEvent(event) && (event.endDate >= today || event.status === 'postponed');
  const ended = event ? planDate === null : item.kind === 'offer' && !!item.offer.endDate && item.offer.endDate < today;
  // An event with no confirmed day is waiting for one, not over: it gets no "接下来可以去" in place of the page.
  const eventOver = !!event && ended && !unconfirmed;
  const offerOver = item.kind === 'offer' && ended;
  // H07: 想约人一起去？ needs the API to know the event; until the API-SYNC after a content merge it may not. A reader who
  // followed a link to the block (Little Bay's 想去 · 找搭子 → #event-participation) keeps its heading and a one-line note,
  // so the jump lands on an explanation instead of the next section.
  const participation = useEventParticipation();
  const { hash } = useLocation();
  const unknownToApi = !!event && !!participation?.unknown.includes(event.id);
  const unconfirmedOffer = item.kind === 'offer' && item.offer.verificationStatus === 'needs-confirmation';
  // "想约人一起去？" fits a place to go, not a public benefit you apply for (free Muni for seniors).
  const together = event ? !eventOver && (!unknownToApi || hash === '#event-participation')
    : !ended && !unconfirmedOffer && !(item.kind === 'offer' && isPublicBenefit(item.offer));
  const officialUrl = item.kind === 'event' ? item.event.officialUrl : item.kind === 'offer' ? item.offer.sourceUrl : item.shop.officialUrl;
  const sourceUrl = item.kind === 'opening' ? item.shop.sourceUrl : officialUrl;
  const sourceLabel = item.kind === 'event' ? item.event.sourceLabel : item.kind === 'offer' ? item.offer.sourceLabel : item.shop.sourceLabel;
  const review = discoveryContentReviewRecord(item);
  // Source prompts keep to the live window (WEB-FRESH2): an event with no confirmed session left says so itself (nextDate null);
  // one still waiting for a date (unconfirmed) is live, so it passes no nextDate and a material change can still prompt.
  const liveReview = { ...review, nextDate: unconfirmed ? undefined : planDate };
  const cover = heroCover(record, today);
  // The hero's photo is never repeated in the page's rails (VISUAL-10).
  const coverPage = createCoverPage();
  if (cover.tier !== 'type') coverPage.claims.set(cover.image.src, `${item.kind}:${share.id}`);
  const venuePhoto = placePhoto(record, today);
  if (venuePhoto) coverPage.claims.set(venuePhoto.image.src, `${item.kind}:${share.id}`);
  const title = item.kind === 'offer' ? item.offer.title : share.title;
  // H57: the age chip already says 21+; the H1 drops the same prefix ("21+ · Napa Harvest After Dark"). The prefix comes off
  // the translated title: the dictionary keys whole titles, so a shortened Chinese title would stay Chinese on /en.
  const shownTitle = translateText(title, locale);
  const stripped = event?.ageChip ? withoutAgePrefix(shownTitle, translateText(event.ageChip, locale)) : item.kind === 'opening' ? withoutCityTail(shownTitle, item.shop.city) : shownTitle;
  const heading = stripped !== shownTitle ? stripped : title;
  // H57: sold out or cancelled — the official page (waitlist, refunds) is the primary action, not a day plan.
  const closed = event?.status === 'sold_out' || event?.status === 'cancelled';
  const back = DETAIL_BACK[item.kind];
  // Catalog prose blocks render only when reader text is left after the note filter (no heading or paragraph over nothing).
  const dek = event ? readerProse(event.dek, locale) : '';
  const summary = event ? readerProse(event.summary, locale) : item.kind === 'opening' ? readerProse(item.shop.summary, locale) : '';
  const visitTip = item.kind === 'opening' ? readerProse(item.shop.editorTip, locale) : '';
  const sub = item.kind === 'offer' ? offerBrand(item.offer.brand, locale) : item.kind === 'opening' ? translateText(item.shop.city, locale) : '';

  // The category chip (F's one category map: the cover's hue), then at most two status chips (C's one status map). N08: a
  // shop's own offer (商家活动) is not one of the map's categories, so it takes its own look instead of 亲子's coral
  // (offerTone gives it 'family' for the share cards); a public benefit keeps the free tone.
  const category = event ? { tone: eventTone(event), text: pick(toneLabel(eventTone(event))) }
    : item.kind === 'offer' ? { tone: isPublicBenefit(item.offer) ? offerTone(item.offer) : 'merchant', text: pick(offerKindLabel(item.offer)) } : null;
  const chips: { key: string; tone: StatusTone; text: string }[] = [];
  if (event) {
    if (event.status) chips.push({ key: 'status', tone: STATUS[event.status].tone, text: pick(STATUS[event.status].text) });
    if (eventOver) chips.push({ key: 'ended', tone: 'ended', text: t(`已结束 · ${monthDay(event.endDate)}`, `Ended · ${readerMonthDay(event.endDate, true)}`) });
    else if (unconfirmed && !event.status) chips.push({ key: 'tba', tone: 'neutral', text: t('日期待定', 'Date TBA') });
    if (event.ageChip) chips.push({ key: 'age', tone: 'neutral', text: translateText(event.ageChip, locale) });
    if (event.cost === 'free') chips.push({ key: 'free', tone: 'free', text: t('免费', 'Free') });
  } else if (item.kind === 'offer') {
    const deadline = offerDeadline(item.offer, today);
    if (deadline) chips.push({ key: 'deadline', tone: ended ? 'ended' : DEADLINE_TONE[deadline.tone], text: pick(deadline.text) });
    if (unconfirmedOffer) chips.push({ key: 'check', tone: 'neutral', text: t('待确认', 'To be confirmed') });
  } else if (item.kind === 'opening') {
    chips.push({ key: 'opening', tone: item.shop.status === 'announced' ? 'neutral' : 'open', text: pick(openingChip(item.shop, today)) });
  }

  // One primary, always last: 加入这天计划 (a live dated event), 加入计划 (an opening with a place), else the official link
  // (领取入口 on a live offer, 官方页 on sold-out, cancelled, ended and every other page). When the primary is not the official
  // link, a quiet 官方页 ↗ / 商家官网 ↗ sits on the 何时 / 开业 label line of the facts card instead.
  const officialName = item.kind === 'opening' ? t('商家官网', 'Official site') : t('官方页', 'Official page');
  const primary: DetailPrimary = event && planDate && !closed ? { kind: 'day', stop: { kind: 'event', id: event.id }, date: planDate, today }
    : item.kind === 'opening' && record.placeId ? { kind: 'plan', to: `/plan?stops=place:${record.placeId}` }
    : item.kind === 'offer' && !ended ? { kind: 'official', href: officialUrl, label: t('领取入口', 'How to claim'), short: t('领取入口', 'Claim') }
    : { kind: 'official', href: officialUrl, label: officialName, short: item.kind === 'opening' ? t('商家官网', 'Official') : t('官方页', 'Official') };
  const factsLink = primary.kind === 'official' ? undefined : { href: officialUrl, label: officialName };
  const live = !ended && !unconfirmed;
  const favorite = item.kind === 'event' ? { kind: 'event' as const, id: item.event.id } : item.kind === 'offer' ? { kind: 'offer' as const, id: item.offer.id } : { kind: 'opening' as const, id: item.shop.id };
  const cells = <>
    {live && <SaveCell favorite={favorite} title={title} />}
    {/* H33 / HOMEIA13-08: the large-text family link, not for an ended event or offer (a parent would open something past). */}
    {!eventOver && !offerOver && <FamilyCell path={share.path} title={translateText(heading, locale)} />}
    <AskCell />
  </>;
  const facts = item.kind === 'event' ? <EventFacts event={item.event} today={today} official={factsLink} />
    : item.kind === 'offer' ? <OfferFacts offer={item.offer} official={factsLink} /> : <OpeningFacts shop={item.shop} today={today} official={factsLink} />;
  // The share row: under 想约人一起去's rule, or the source section's last line where there is no 一起去 (an ended page).
  // 简洁显示 hides it either way.
  const shareRow = <div className="detail-share" data-simple="hide"><EditorialShareActions item={share} card={!eventOver && !offerOver}>
    {event && planDate && <Button variant="quiet" className="detail-calendar" onClick={() => downloadEventCalendar(event, planDate)} icon={<CalendarDays aria-hidden="true" strokeWidth={1.75} />}>{t('存入日历', 'Add to calendar')}</Button>}
  </EditorialShareActions></div>;
  const planLines = event ? readerPlanLines(event).filter(line => readerProse(line, locale)) : [];
  const nextCards = event && eventOver ? railEvents(event, record.rail, today, { sameCategory: false, limit: 4 }) : [];
  // B P21: every detail ends with a photo row. An event's is 附近同类活动的下一场 (three); an offer's or an opening's, the
  // upcoming events near it (four; Bay-wide for an offer valid everywhere).
  const relatedCards = event ? eventOver ? [] : railEvents(event, record.rail, today, { sameCategory: true, limit: 3 })
    : railEvents(nearPage(item), record.rail, today, { sameCategory: false, limit: 4 });
  // B P04 / C P17: the desktop column under the action card ends beside the body with up to three more nearby rows (none the
  // page shows already), then 本页图片来源.
  const shown = new Set([...nextCards, ...relatedCards].map(card => card.event.id));
  const sideCards = railEvents(event ?? nearPage(item), record.rail, today, { sameCategory: false, limit: 8 }).filter(card => !shown.has(card.event.id))
    // An ended page's body is short (no plan, no 一起去): two rows, so the column ends with the body (≤ 200 px apart).
    .slice(0, eventOver || offerOver ? 2 : 3);
  const nextCovers = railCovers(nextCards, today, coverPage);
  const relatedCovers = railCovers(relatedCards, today, coverPage);
  const sideCovers = railCovers(sideCards, today, coverPage);
  const endedOn = eventOver ? event.endDate : item.kind === 'offer' && offerOver ? item.offer.endDate : undefined;
  // 本页图片来源: the hero, the venue photo and the rail covers, in page order.
  const photos: { title: string; cover: ImageCover }[] = [
    ...(cover.tier !== 'type' ? [{ title: t('题图', 'Main photo'), cover }] : []),
    ...(venuePhoto ? [{ title: t('场地照片', 'Venue photo'), cover: venuePhoto }] : []),
    ...[...nextCards.map((card, index) => ({ card, cover: nextCovers[index] })), ...relatedCards.map((card, index) => ({ card, cover: relatedCovers[index] })),
      ...sideCards.map((card, index) => ({ card, cover: sideCovers[index] }))]
      .flatMap(({ card, cover: railCover }) => railCover.tier !== 'type' ? [{ title: translateText(card.event.title, locale), cover: railCover }] : []),
  ];

  return <article className="local-discovery-detail detail-page" data-kind={item.kind} data-ended={ended ? '' : undefined}>
    <DetailBack kind={item.kind} />
    <div className="detail-layout">
      <div className="detail-main detail-main--top">
        <DetailHero record={record} cover={cover} today={today} ended={eventOver} />
        <header className="detail-head">
          <p className="detail-chips">
            {category && <span className="ui-status detail-cat" data-cat={category.tone}>{category.text}</span>}
            {chips.slice(0, 2).map(chip => <StatusChip key={chip.key} tone={chip.tone}>{chip.text}</StatusChip>)}
          </p>
          <h1><SegmentedTitle text={heading} /></h1>
          {/* The offer's brand stays in 简洁显示 (the H1 drops it); an opening's city is in its address too. */}
          {sub && (item.kind === 'offer' ? <p className="detail-sub detail-brand">{sub}</p> : <p className="detail-sub" data-simple="hide">{sub}</p>)}
          {dek && <p className="detail-dek" data-simple="hide"><ReaderText text={event?.dek} /></p>}
        </header>
        {/* Ended: one notice under the head (the date, the archive sentence and the official link), then what is on next. */}
        {endedOn && <ContentReviewNotice record={liveReview} today={today} ended={t(`已结束（${monthDay(endedOn)}）`, `Ended ${readerMonthDay(endedOn, true)}.`)} />}
        {eventOver && !nextCards.length && <MoreLink className="detail-next-link" to="/events">{t('看看接下来的活动', 'See upcoming events')}</MoreLink>}
        {eventOver && <DetailRail id="detail-next-title" title={t('接下来可以去', 'Up next nearby')} cards={nextCards} covers={nextCovers} today={today} />}
        {unconfirmed && <p className="detail-note">{t('暂无已确认场次，请查看主办方最新安排。', 'No date is confirmed yet. Check the organizer’s latest schedule.')}</p>}
        {unconfirmedOffer && <p className="detail-note">{t('当前优惠待确认；请先联系官方，确认后再安排行程。', 'This offer is not confirmed yet. Check with the provider before you plan around it.')}</p>}
      </div>
      {/* The facts and the actions: in the flow under the H1 on a phone (the bar itself is fixed), the sticky aside on a
          desktop. One copy, so the reading order is the same everywhere. */}
      <aside className="detail-aside"><div className="detail-aside__stick">
        <div className="detail-facts-card">{facts}<CheckedLine verifiedAt={review.verifiedAt} sourceLabel={sourceLabel} today={today} /></div>
        <DetailActionBar cells={cells} primary={<PrimaryAction primary={primary} title={title} />} />
      </div></aside>
      <div className="detail-main detail-main--body">
        {!endedOn && <ContentReviewNotice record={liveReview} today={today} />}
        <div className="detail-body">
          {summary && <p className="detail-summary"><ReaderText text={event ? event.summary : item.kind === 'opening' ? item.shop.summary : undefined} /></p>}
          {venuePhoto && <DetailPlacePhoto photo={venuePhoto} />}
          {event && !eventOver && planLines.length > 0 && <section aria-labelledby="detail-plan-title">
            <h2 id="detail-plan-title">{t('出发前，做好这些安排', 'Before you go')}</h2>
            <ul className="detail-plan">{planLines.map(line => <li key={line}><Check aria-hidden="true" strokeWidth={1.75} /><p><ReaderText text={line} /></p></li>)}</ul>
          </section>}
          {item.kind === 'offer' && <BenefitSteps offer={item.offer} />}
          {visitTip && item.kind === 'opening' && <section aria-labelledby="detail-visit-title"><h2 id="detail-visit-title">{t('这一趟怎么安排', 'Planning the visit')}</h2><p className="detail-prose"><ReaderText text={item.shop.editorTip} name={item.shop.name} /></p></section>}

          <section className="detail-source" aria-labelledby="detail-source-title">
            <h2 id="detail-source-title">{t('来源与核对', 'Source and checks')}</h2>
            <TrustRow contentId={review.id} item={liveReview} sourceUrl={sourceUrl} sourceLabel={sourceLabel} official={sourceUrl === officialUrl} today={today} />
            <MoreLink className="detail-method" to="/about#about-method-title">{t('我们怎么核对', 'How we check')}</MoreLink>
            <SourceFreshness contentId={review.id} item={liveReview} officialUrl={officialUrl} include={['soft']} today={today} />
            <HeroCaption cover={cover} />
            {event?.relatedGuideSlug && <MoreLink className="discovery-related" to={`/guides/${event.relatedGuideSlug}`}>{t('搭配一篇本地攻略', 'Read a related local guide')}</MoreLink>}
            <LazyReportErrorLink entity={{ kind: item.kind, id: share.id }} title={share.title} />
            {!together && shareRow}
          </section>

          {/* 想约人一起去？: one shell on every page with 一起去; the share row (分享 · 分享卡片 · 存入日历) under its rule. No
              primary here. An ended page has no 一起去, so its lone 分享 is the source section's last line instead. */}
          {together && <section className="detail-together" data-simple="hide" aria-labelledby="detail-together-title">
            {/* Flat children, no nested fragments: LocalizedHost clones a fragment child, and a cloned fragment inside another
                one loses its key validation (the SSR "unique key" warning). */}
            <h2 id="detail-together-title">{t('想约人一起去？', 'Going with others?')}</h2>
            {event && <div id="event-participation" className="discovery-participation-anchor">{unknownToApi
              ? <p className="event-participation-note">{t('这场活动暂时还不能公开想去或约人一起去，请稍后再来看看。', 'Sharing interest and finding people to go with are not open for this event yet. Please check back later.')}</p>
              : <EventParticipationActions event={event} today={today} available={!ended} />}</div>}
            {event && !unknownToApi && <SquadTeaser eventId={event.id} />}
            {!event && <Button variant="secondary" className="detail-together__go" to={`/together?${new URLSearchParams({ coverKind: item.kind, coverId: share.id })}`} icon={<Users aria-hidden="true" strokeWidth={1.75} />}>{t('一起去', 'Go together')}</Button>}
            {shareRow}
          </section>}
          {event && !eventOver && <DetailRail id="detail-related-title" hideInSimple title={english ? 'More upcoming events nearby' : translateText('附近同类活动的下一场', locale)}
            note={english ? 'Confirmed sessions in the same city first, then the same region. Check the organizer before going.' : translateText('先看同城，再看同区域的已确认场次；出发前请核对主办方安排。', locale)}
            cards={relatedCards} covers={relatedCovers} today={today} />}
          {!event && <DetailRail id="detail-related-title" hideInSimple title={nearPage(item).city || (item.kind === 'offer' && item.offer.region) ? t('附近接下来的活动', 'Coming up nearby') : t('湾区接下来的活动', 'Coming up around the Bay')}
            cards={relatedCards} covers={relatedCovers} today={today} />}
        </div>
      </div>
      {/* The column's end (desktop: beside the body's last screen, under the sticky actions) and the page's photo credits,
          last on a phone like every other page's (#page-credits). */}
      <div className="detail-aside-end">
        <DetailRail id="detail-side-title" side hideInSimple title={t('附近还有', 'Also nearby')} cards={sideCards} covers={sideCovers} today={today} />
        <PageCredits photos={photos} />
      </div>
    </div>
    <footer className="discovery-return" data-simple="hide">
      <h2>{t('继续发现湾区', 'Keep exploring the Bay')}</h2>
      <div>
        <MoreLink to="/events">{t('本周末活动', 'This weekend’s events')}</MoreLink>
        <MoreLink to="/my-week#saved">{t('我的收藏', 'My saved items')}</MoreLink>
        <MoreLink to="/events?view=perks">{t('免费与优惠', 'Free & deals')}</MoreLink>
      </div>
    </footer>
    {/* 简洁显示 hides 继续发现湾区 and the tab bar is hidden on a detail page: one way back stays at the end. */}
    <nav className="detail-back detail-back--end" aria-label={t('回到列表', 'Back to the list')}><Link to={back.to}><ChevronLeft aria-hidden="true" strokeWidth={1.75} />{t(`回到${pick(back.label)}`, `Back to ${pick(back.label)}`)}</Link></nav>
  </article>;
}
