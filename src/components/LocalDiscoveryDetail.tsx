import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, MapPin, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { discoveryShare, type LocalDiscovery } from '../data/local-discoveries';
import { GUIDE_IMAGES } from '../data/guide-media';
import { getBayAreaToday, downloadEventCalendar } from '../lib/monthly';
import { EventParticipationActions, EventParticipationProvider } from './EventParticipation';
import { EditorialShareActions } from './EditorialShareActions';
import { translateText } from '../i18n/locale';
import { GuideFigure } from './GuideVisuals';
import { SourceFreshness } from '../features/source-monitor/SourceFreshness';
import { SaveToWeek } from './SaveToWeek';

export function LocalDiscoveryDetail({ item, today = getBayAreaToday() }: { item: LocalDiscovery; today?: string }) {
  if (item.kind === 'event') return <EventParticipationProvider events={[item.event]}><DiscoveryArticle item={item} today={today} /></EventParticipationProvider>;
  return <DiscoveryArticle item={item} today={today} />;
}
function DiscoveryArticle({ item, today }: { item: LocalDiscovery; today: string }) {
  const share = discoveryShare(item);
  const ended = item.kind === 'event' ? item.event.endDate < today : item.kind === 'offer' && !!item.offer.endDate && item.offer.endDate < today;
  const officialUrl = item.kind === 'event' ? item.event.officialUrl : item.kind === 'offer' ? item.offer.sourceUrl : item.shop.officialUrl;
  const sourceUrl = item.kind === 'opening' ? item.shop.sourceUrl : officialUrl;
  const sourceLabel = item.kind === 'event' ? item.event.sourceLabel : item.kind === 'offer' ? item.offer.sourceLabel : item.shop.sourceLabel;
  const imageKey = item.kind === 'event' ? item.event.imageKey : item.kind === 'offer' ? item.offer.imageKey : item.shop.imageKey;
  const image = Object.hasOwn(GUIDE_IMAGES, imageKey) ? GUIDE_IMAGES[imageKey] : undefined;
  return <article className="local-discovery-detail">
    <Link className="discovery-back" to={`/this-month${item.kind === 'offer' ? '#monthly-perks' : item.kind === 'opening' ? '#monthly-openings' : '#monthly-events'}`}><ArrowLeft size={16} />发现更多湾区好去处</Link>
    <header className={`discovery-detail-header discovery-detail-${item.kind}`}>
      <div className="discovery-detail-brand"><span>BAYLINK</span><span>YOUR BAY. YOUR PEOPLE.</span></div>
      <span className="discovery-eyebrow">{share.label}</span><h1>{share.title}</h1><p className="discovery-detail-summary">{share.summary}</p>
      <div className="discovery-detail-facts"><span><CalendarDays size={17} />{share.date}</span><span><MapPin size={17} />{share.area}</span>{item.kind === 'event' && <span><Ticket size={17} />{item.event.costLabel}</span>}</div>
      {ended && <p className="discovery-inline-note">这条信息的日期已过，保留供分享链接回顾。请查看本期月刊中的最新安排。</p>}
      {item.kind === 'opening' && <p className="discovery-inline-note">{item.shop.status === 'open' ? '已开业 · 当天营业与订位请查商家入口。' : '开业预告 · 尚未确认正式营业，请先查商家公告。'}</p>}
      {item.kind === 'event' && <EventParticipationActions event={item.event} today={today} />}
      <EditorialShareActions item={share} />
      {item.kind === 'event' && <SaveToWeek favorite={{ kind: 'event', id: item.event.id }} />}
      {item.kind === 'event' && !ended && <Link className="discovery-primary" to={`/plan?stops=event:${item.event.id}&date=${item.event.startDate < today ? today : item.event.startDate}`}>新建出游计划<ArrowRight size={16} /></Link>}
    </header>
    {image && <div className={`discovery-detail-media${image.kind === 'poster' || image.fullFrame ? ' discovery-detail-media--full' : ''}`}><GuideFigure image={image} variant="cover" /></div>}
    <div className="discovery-detail-body">
      {item.kind === 'event' ? <><h2>出发前，把这三件事安排好</h2><ol className="discovery-plan">{item.event.plan.map((tip, i) => <li key={tip}><span>0{i + 1}</span><p>{tip}</p></li>)}</ol><p><strong>具体地点</strong> · {item.event.venue}</p><p><strong>适合</strong> · {item.event.audience.map(value => translateText(value)).join(' / ')}</p></> : item.kind === 'offer' ? <><h2>先看领取条件</h2><p className="discovery-important">{item.offer.requirement}</p><h2>这份福利怎么用</h2><p>{item.offer.description}</p><p className="discovery-small">免费或优惠资格、名额与参与门店，以官方入口的最新说明为准。</p></> : <><h2>这一趟怎么安排</h2><p>{item.shop.editorTip}</p><h2>地点与开业状态</h2><p>{item.shop.city} · {item.shop.address}</p><p>{item.shop.dateLabel}</p></>}
      <div className="discovery-detail-links"><a className="discovery-primary" href={officialUrl} target="_blank" rel="noopener noreferrer">{item.kind === 'offer' ? '查看领取入口' : item.kind === 'opening' ? '查看商家官网' : '查看主办方详情'}<ArrowUpRight size={17} /></a>{item.kind === 'event' && !ended && <button type="button" onClick={() => downloadEventCalendar(item.event)}><CalendarDays size={17} />存入日历</button>}{item.kind === 'offer' && item.offer.storeUrl && <a href={item.offer.storeUrl} target="_blank" rel="noopener noreferrer">查询本地门店<ArrowUpRight size={17} /></a>}</div>
      <p className="discovery-source"><Check size={14} />{share.checkedAt && <time dateTime={share.checkedAt}>核对 {share.checkedAt} · </time>}<a href={sourceUrl} target="_blank" rel="noopener noreferrer">{sourceLabel}</a></p>
      <SourceFreshness contentId={item.kind === 'event' ? item.event.id : item.kind === 'offer' ? item.offer.id : item.shop.id} />
      {item.kind === 'event' && item.event.relatedGuideSlug && <Link className="discovery-related" to={`/guides/${item.event.relatedGuideSlug}`}>搭配一篇本地攻略<ArrowRight size={17} /></Link>}
    </div>
    <footer className="discovery-return"><span className="discovery-eyebrow">KEEP EXPLORING THE BAY</span><h2>这只是湾区的一小部分。</h2><p>继续看看附近活动、免费福利和新店，把下一次出门也安排好。</p><div><Link to="/this-month?when=october">十月活动日历<ArrowRight size={17} /></Link><Link to="/this-month?view=interested#monthly-events">我的想去<ArrowRight size={17} /></Link><Link to="/guides/bay-area-freebies-deals-2026-10">优惠与 Freebies<ArrowRight size={17} /></Link></div></footer>
  </article>;
}
