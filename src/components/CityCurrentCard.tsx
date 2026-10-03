import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CityCurrentUpdate } from '../data/city-current-types';
import { GUIDE_IMAGES } from '../data/guide-media';
import { MONTHLY_EVENTS } from '../data/monthly-edition';
import { translateText, useLocale } from '../i18n/locale';
import { getBayAreaToday } from '../lib/monthly';
import { nextConfirmedEventDate } from '../lib/event-occurrences';
import { GuideFigure } from './GuideVisuals';

const cityKey = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();

export function CityCurrentCard({ update, today = getBayAreaToday() }: { update: CityCurrentUpdate; today?: string }) {
  const locale = useLocale(), t = (value: string) => translateText(value, locale);
  const image = Object.hasOwn(GUIDE_IMAGES, update.imageKey) ? GUIDE_IMAGES[update.imageKey] : undefined;
  const events = MONTHLY_EVENTS.filter(event => cityKey(event.city) === cityKey(update.city))
    .map(event => ({ event, date: nextConfirmedEventDate(event, today) }))
    .filter((item): item is typeof item & {date: string} => item.date !== null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.event.id.localeCompare(b.event.id));
  const lang = locale === 'zh-Hans' ? '' : `&lang=${locale}`;
  return <section className="city-current-card" aria-label={`${update.city} ${t('近期资讯与活动')}`}>
    <span className="city-current-kind">{t(update.kind === 'dated' ? '本轮核对的具体资讯' : '官方日历 · 持续查询入口')}</span>
    <h4>{t(update.headline)}</h4><p className="city-current-date">{t(update.dateLabel)}</p>
    {image && <GuideFigure image={image} variant="inline" />}
    <p>{t(update.summary)}</p>
    <a href={update.sourceUrl} target="_blank" rel="noopener noreferrer">{t(update.sourceLabel)} <ArrowUpRight size={13} aria-hidden="true" /></a>
    <p className="city-current-date">{t('资讯核对日期')}：<time dateTime={update.checkedAt}>{update.checkedAt}</time></p>
    {events.length > 0 && <><h5>{t('本市接下来可查的活动')}</h5><ul>{events.slice(0, 3).map(({ event, date }) => <li key={event.id}><time dateTime={date}>{date}</time><Link to={`/events/${event.id}${locale === 'zh-Hans' ? '' : `?lang=${locale}`}`}>{t(event.title)}</Link><span>{t(event.costLabel)}</span></li>)}</ul>
      <Link to={`/this-month?q=${encodeURIComponent(update.city)}${lang}#monthly-events`}>{t('继续查看这个城市的活动')} →</Link></>}
  </section>;
}
