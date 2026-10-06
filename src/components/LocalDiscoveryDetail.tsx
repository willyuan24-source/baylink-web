import { recordProductEvent } from '../lib/product-events';
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, MapPin, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { discoveryShare, type LocalDiscovery } from '../data/local-discoveries';
import { MONTHLY_EVENTS } from '../data/monthly-edition';
import type { MonthlyEvent } from '../data/monthly-types';
import { EVENT_DATE_OVERRIDES } from '../data/event-calendar-dates';
import { getListingImage } from '../lib/offer-media';
import { getBayAreaToday, downloadEventCalendar } from '../lib/monthly';
import { EventParticipationActions, EventParticipationProvider } from './EventParticipation';
import { EditorialShareActions } from './EditorialShareActions';
import { translateText, useLocale } from '../i18n/locale';
import { GuideFigure } from './GuideVisuals';
import { SourceFreshness } from '../features/source-monitor/SourceFreshness';
import { SaveToWeek } from './SaveToWeek';
import { OutingInspirationLink } from './OutingInspirationLink';
import { openingStatusNote } from '../lib/opening-status';
import { nextConfirmedEventDate } from '../lib/event-occurrences';
import { eventOccursOn } from '../lib/event-calendar';
import { placeFor } from '../lib/planner';
import { discoveryContentReviewRecord } from '../lib/content-review';
import { ContentReviewNotice } from '../features/source-monitor/ContentReviewNotice';

function confirmedEventDate(event: MonthlyEvent, today: string): string | null {
  const occurrenceDates = Object.hasOwn(EVENT_DATE_OVERRIDES, event.id) ? EVENT_DATE_OVERRIDES[event.id] : event.occurrenceDates;
  const date = nextConfirmedEventDate({ startDate: event.startDate, endDate: event.endDate, occurrenceDates }, today);
  return date && eventOccursOn(event, date) ? date : null;
}

/** Nearby events of the same category, with confirmed sessions on or after the Pacific date. */
export function getRelatedUpcomingEvents(event: MonthlyEvent, today = getBayAreaToday(), events: readonly MonthlyEvent[] = MONTHLY_EVENTS): { event: MonthlyEvent; date: string }[] {
  const city = event.city.trim().toLocaleLowerCase('en-US');
  const sameCity = (candidate: MonthlyEvent) => candidate.city.trim().toLocaleLowerCase('en-US') === city;
  return [...new Map(events.map(candidate => [candidate.id, candidate])).values()]
    .filter(candidate => candidate.id !== event.id && candidate.category === event.category && (sameCity(candidate) || candidate.region === event.region))
    .flatMap(candidate => { const date = confirmedEventDate(candidate, today); return date ? [{ event: candidate, date }] : []; })
    .sort((a, b) => Number(!sameCity(a.event)) - Number(!sameCity(b.event)) || a.date.localeCompare(b.date) || a.event.id.localeCompare(b.event.id))
    .slice(0, 3);
}

export function LocalDiscoveryDetail({ item, today = getBayAreaToday() }: { item: LocalDiscovery; today?: string }) {
  if (item.kind === 'event') return <EventParticipationProvider events={[item.event]}><DiscoveryArticle item={item} today={today} /></EventParticipationProvider>;
  return <DiscoveryArticle item={item} today={today} />;
}
function DiscoveryArticle({ item, today }: { item: LocalDiscovery; today: string }) {
  const english = useLocale() === 'en';
  const share = discoveryShare(item);
  const planDate = item.kind === 'event' ? confirmedEventDate(item.event, today) : null;
  const relatedEvents = item.kind === 'event' ? getRelatedUpcomingEvents(item.event, today) : [];
  const openingPlace = item.kind === 'opening' ? placeFor(`opening-${item.shop.id}`) : undefined;
  const ended = item.kind === 'event' ? planDate === null : item.kind === 'offer' && !!item.offer.endDate && item.offer.endDate < today;
  const unconfirmed = item.kind === 'event' && (Object.hasOwn(EVENT_DATE_OVERRIDES, item.event.id) ? EVENT_DATE_OVERRIDES[item.event.id] : item.event.occurrenceDates)?.length === 0;
  const unconfirmedOffer = item.kind === 'offer' && item.offer.verificationStatus === 'needs-confirmation';
  const officialUrl = item.kind === 'event' ? item.event.officialUrl : item.kind === 'offer' ? item.offer.sourceUrl : item.shop.officialUrl;
  const sourceUrl = item.kind === 'opening' ? item.shop.sourceUrl : officialUrl;
  const sourceLabel = item.kind === 'event' ? item.event.sourceLabel : item.kind === 'offer' ? item.offer.sourceLabel : item.shop.sourceLabel;
  const imageKey = item.kind === 'event' ? item.event.imageKey : item.kind === 'offer' ? item.offer.imageKey : item.shop.imageKey;
  const image = getListingImage(imageKey);
  return <article className="local-discovery-detail">
    <Link className="discovery-back" to={`/this-month${item.kind === 'offer' ? '#monthly-perks' : item.kind === 'opening' ? '#monthly-openings' : '#monthly-events'}`}><ArrowLeft size={16} />发现更多湾区好去处</Link>
    <header className={`discovery-detail-header discovery-detail-${item.kind}`}>
      <div className="discovery-detail-brand"><span>BAYLINK</span><span>YOUR BAY. YOUR PEOPLE.</span></div>
      <span className="discovery-eyebrow">{share.label}</span><h1>{share.title}</h1><p className="discovery-detail-summary">{share.summary}</p>
      <div className="discovery-detail-facts"><span><CalendarDays size={17} />{share.date}</span><span><MapPin size={17} />{share.area}</span>{item.kind === 'event' && <span><Ticket size={17} />{item.event.costLabel}</span>}</div>
      <ContentReviewNotice record={discoveryContentReviewRecord(item)} today={today} />
      {ended && <p className="discovery-inline-note">{unconfirmed ? '暂无已确认场次，请查看主办方最新安排。' : '这条信息的日期已过，保留供分享链接回顾。请查看本期月刊中的最新安排。'}</p>}
      {unconfirmedOffer && <p className="discovery-inline-note">当前优惠待确认；请先联系官方，确认后再安排行程。</p>}
      {item.kind === 'opening' && <p className="discovery-inline-note">{openingStatusNote(item.shop.status)}</p>}
      {item.kind === 'event' ? <>
        <div className="discovery-detail-main-actions discovery-detail-links" role="group" aria-label="活动主要操作"><a className="discovery-primary" onClick={() => recordProductEvent('official_source_click')} href={officialUrl} target="_blank" rel="noopener noreferrer">查看主办方详情<ArrowUpRight size={17} /></a>{planDate && <Link className="discovery-secondary" to={`/plan?stops=event:${item.event.id}&date=${planDate}`}>新建出游计划<ArrowRight size={16} /></Link>}</div>
        <div id="event-participation" className="discovery-participation-anchor"><EventParticipationActions event={item.event} today={today} available={!ended} /></div>
        <details className="discovery-detail-more-actions"><summary>{ended ? (english ? 'Archive and sharing' : '历史资料与分享') : '收藏、日历与分享'}</summary>{!ended && <><SaveToWeek favorite={{ kind: 'event', id: item.event.id }} /><button type="button" className="discovery-secondary" onClick={() => downloadEventCalendar(item.event)}><CalendarDays size={17} />存入日历</button></>}<EditorialShareActions item={share} /></details>
      </> : <EditorialShareActions item={share} />}
      {openingPlace && <><SaveToWeek favorite={{ kind: 'place', id: openingPlace.id }} /><Link className="discovery-primary" to={`/plan?stops=place:${openingPlace.id}`}>用这家店开始出游计划<ArrowRight size={16} /></Link></>}
    </header>
    {item.kind !== 'event' && !ended && !unconfirmedOffer && <OutingInspirationLink kind={item.kind} id={share.id} />}
    {image && <div className={`discovery-detail-media${image.kind === 'poster' || image.fullFrame ? ' discovery-detail-media--full' : ''}`}><GuideFigure image={image} variant="cover" /></div>}
    <div className="discovery-detail-body">
      {item.kind === 'event' ? <><h2>出发前，做好这些安排</h2><ol className="discovery-plan">{item.event.plan.map((tip, i) => <li key={tip}><span>0{i + 1}</span><p>{tip}</p></li>)}</ol><p><strong>具体地点</strong> · {item.event.venue}</p><p><strong>适合</strong> · {item.event.audience.map(value => translateText(value)).join(' / ')}</p></> : item.kind === 'offer' ? <><h2>先看领取条件</h2><p className="discovery-important">{item.offer.requirement}</p><h2>这份福利怎么用</h2><p>{item.offer.description}</p><p className="discovery-small">免费或优惠资格、名额与参与门店，以官方入口的最新说明为准。</p></> : <><h2>这一趟怎么安排</h2><p>{item.shop.editorTip}</p><h2>地点与开业状态</h2><p>{item.shop.city} · {item.shop.address}</p><p>{item.shop.dateLabel}</p></>}
      {item.kind !== 'event' && <div className="discovery-detail-links"><a className="discovery-primary" onClick={() => recordProductEvent('official_source_click')} href={officialUrl} target="_blank" rel="noopener noreferrer">{item.kind === 'offer' ? '查看领取入口' : '查看商家官网'}<ArrowUpRight size={17} /></a>{item.kind === 'offer' && item.offer.storeUrl && <a href={item.offer.storeUrl} target="_blank" rel="noopener noreferrer">查询本地门店<ArrowUpRight size={17} /></a>}</div>}
      <p className="discovery-source"><Check size={14} />{share.checkedAt && <time dateTime={share.checkedAt}>核对 {share.checkedAt} · </time>}<a href={sourceUrl} target="_blank" rel="noopener noreferrer">{sourceLabel}</a></p>
      <SourceFreshness contentId={item.kind === 'event' ? item.event.id : item.kind === 'offer' ? item.offer.id : item.shop.id} />
      {item.kind === 'event' && item.event.relatedGuideSlug && <Link className="discovery-related" to={`/guides/${item.event.relatedGuideSlug}`}>搭配一篇本地攻略<ArrowRight size={17} /></Link>}
      {item.kind === 'event' && <section className="discovery-next-events" aria-labelledby="discovery-next-events-title"><h2 id="discovery-next-events-title">{english ? 'More upcoming events nearby' : '附近同类活动的下一场'}</h2><p>{english ? 'Confirmed sessions in the same city first, then the same region. Check the organizer before going.' : '先看同城，再看同区域的已确认场次；出发前请核对主办方安排。'}</p>{relatedEvents.length > 0 ? <div className="discovery-next-event-grid">{relatedEvents.map(({ event, date }) => <article key={event.id} className="discovery-next-event"><h3><Link to={`/events/${event.id}`}>{event.title}<ArrowRight size={16} aria-hidden="true" /></Link></h3><p>{english ? 'Next session: ' : '下一场：'}<time dateTime={date}>{date}</time></p><p>{event.city} · {event.venue}</p><p>{english ? 'Cost: ' : '费用：'}{event.costLabel}</p><a href={event.officialUrl} target="_blank" rel="noopener noreferrer" onClick={() => recordProductEvent('official_source_click')}>{english ? 'Source: ' : '来源：'}{event.sourceLabel}<ArrowUpRight size={15} aria-hidden="true" /></a><small>{english ? 'Checked ' : '核对 '}<time dateTime={event.verifiedAt}>{event.verifiedAt}</time></small></article>)}</div> : <p className="discovery-inline-note">{english ? 'No further confirmed sessions in this city or region yet. Check this week’s events for other options.' : '同城或同区域暂未收录下一场已确认的同类活动，可以到本周活动看看其他选择。'}</p>}</section>}
    </div>
    <footer className="discovery-return"><span className="discovery-eyebrow">KEEP EXPLORING THE BAY</span><h2>这只是湾区的一小部分。</h2><p>继续看看附近活动、免费福利和新店，把下一次出门也安排好。</p><div><Link to="/this-week">{english ? 'This week’s events' : '本周活动'}<ArrowRight size={17} /></Link><Link to="/this-month?view=interested#monthly-events">我的想去<ArrowRight size={17} /></Link><Link to="/this-month#monthly-perks">{english ? 'Current edition’s offers' : '当期月刊优惠'}<ArrowRight size={17} /></Link></div></footer>
  </article>;
}
