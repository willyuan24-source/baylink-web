import { Link } from 'react-router-dom';
import { PageContainer, PageHeader } from './ui/HeroCard';
import { StatusChip, type StatusTone } from './ui/Badges';
import './archive.css';
import { discoveryShare, localDiscoveries, type LocalDiscovery } from '../data/local-discoveries';
import { translateText, useLocale, type Locale } from '../i18n/locale';
import { getBayAreaToday, getEventStatus } from '../lib/monthly';
import { SLUG_TO_CATEGORY } from '../routing';

type DirectoryRow = { path: string; title: string; date: string; start?: string; end?: string; checkedAt: string; status: string; tone: StatusTone; archived: boolean };
const label = (locale: Locale, zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
const validDay = (day: string | undefined): day is string => {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
};

function directoryRow(item: LocalDiscovery, today: string, locale: Locale): DirectoryRow {
  const share = discoveryShare(item);
  const base = { path: share.path, title: translateText(share.title, locale), date: translateText(share.date, locale), checkedAt: share.checkedAt };
  if (item.kind === 'event') {
    // A postponed or cancelled event (status from a dated source read) has no confirmed day, which is not "ended".
    const halted = item.event.status === 'postponed' || item.event.status === 'cancelled' ? item.event.status : undefined;
    const state = halted ?? getEventStatus(item.event, today);
    const labels = {
      upcoming: ['尚有后续日期', 'Upcoming dates'], ongoing: ['列明日期内', 'Within the listed dates'], ended: ['已结束 · 往期记录', 'Ended · past record'],
      postponed: ['已延期 · 新日期待公布', 'Postponed · new date to be announced'], cancelled: ['已取消', 'Cancelled'],
    } as const;
    const tones = { upcoming: 'info', ongoing: 'success', ended: 'ended', postponed: 'warning', cancelled: 'danger' } as const;
    return { ...base, start: item.event.startDate, end: item.event.endDate, status: label(locale, labels[state][0], labels[state][1]), tone: tones[state], archived: state === 'ended' || state === 'cancelled' };
  }
  if (item.kind === 'opening') {
    const labels = { open: ['已报道开业', 'Reported open'], soft_open: ['试营业记录', 'Soft opening record'], announced: ['预告与庆典记录', 'Announcement or celebration record'] } as const;
    return { ...base, start: item.shop.openedOn, status: label(locale, labels[item.shop.status][0], labels[item.shop.status][1]), tone: item.shop.status === 'announced' ? 'info' : 'neutral', archived: false };
  }
  const offer = item.offer;
  const start = offer.startDate || offer.endDate;
  const end = offer.endDate || (offer.availability === 'dated' ? offer.startDate : undefined);
  const ended = validDay(end) && end < today;
  let status: string; let tone: StatusTone = 'neutral';
  if (ended) { status = label(locale, '已结束 · 往期记录', 'Ended · past record'); tone = 'ended'; }
  else if (offer.verificationStatus === 'needs-confirmation') { status = label(locale, '当前优惠待确认', 'Current offer unconfirmed'); tone = 'warning'; }
  else if (offer.availability === 'ongoing') status = label(locale, '常设福利 · 先查条件', 'Recurring offer · check conditions');
  else if (offer.availability === 'check-local') status = label(locale, '查询本店场次与供应', 'Check local sessions and availability');
  else if (!validDay(start) || !validDay(end) || start > end) { status = label(locale, '日期待核对', 'Dates unconfirmed'); tone = 'warning'; }
  else if (start > today) { status = label(locale, '尚未开始', 'Upcoming'); tone = 'info'; }
  else { status = label(locale, '列明日期内', 'Within the listed dates'); tone = 'success'; }
  return { ...base, start: offer.startDate, end: offer.endDate, status, tone, archived: ended };
}

function DirectoryList({ rows, today, locale }: { rows: DirectoryRow[]; today: string; locale: Locale }) {
  return <ul className="archive-list">
    {rows.map(row => <li key={row.path}>
      <Link to={row.path} className="archive-title">{row.title}</Link>
      <p className="archive-date">{row.date}{validDay(row.start) && <span> · <time dateTime={row.start}>{row.start}</time>{validDay(row.end) && row.end !== row.start && <span> — <time dateTime={row.end}>{row.end}</time></span>}</span>}</p>
      <p className="archive-status"><StatusChip tone={row.tone}>{row.status}</StatusChip><span>{validDay(row.checkedAt) && row.checkedAt <= today ? <span>{label(locale, '来源核对：', 'Source checked: ')}<time dateTime={row.checkedAt}>{row.checkedAt}</time></span> : label(locale, '来源核对日期待确认', 'Source check date unconfirmed')}</span></p>
    </li>)}
  </ul>;
}

/** Native disclosures retain every canonical anchor in the first HTML, including past records. */
export function PublicContentDirectory({ today = getBayAreaToday(), items = localDiscoveries }: { today?: string; items?: readonly LocalDiscovery[] }) {
  const locale = useLocale();
  const groups = [
    { kind: 'event', id: 'directory-events', title: label(locale, '活动记录', 'Event records') },
    { kind: 'offer', id: 'directory-offers', title: label(locale, '优惠与福利记录', 'Offer records') },
    { kind: 'opening', id: 'directory-openings', title: label(locale, '新店记录', 'Opening records') },
  ] as const;
  const sections: readonly { path: string; zh: string; en: string }[] = [
    { path: '/', zh: '首页', en: 'Home' }, { path: '/events', zh: '本周末活动', en: 'This weekend' },
    { path: '/calendar', zh: '活动日历', en: 'Event calendar' }, { path: '/guides', zh: '办事指南', en: 'Guides' },
    { path: '/events?when=all', zh: '全部日期活动', en: 'Events on all dates' }, { path: '/explore', zh: '按地区找景点', en: 'Places by area' },
    { path: '/plan', zh: '行程', en: 'Plan' }, { path: '/opus-bay', zh: '3D 旧金山', en: '3D San Francisco' },
    { path: '/ai-in-the-bay', zh: '湾区 AI 现场', en: 'AI in the Bay' }, { path: '/tools', zh: '生活工具箱', en: 'Everyday tools' },
    { path: '/about', zh: '关于与核验方法', en: 'About and sources' },
  ];
  return <PageContainer size="content" className="archive-page">
    <PageHeader title={label(locale, '内容目录与往期记录', 'Content directory and archives')}
      lede={label(locale, '按原始日期查看全部活动、优惠与新店记录。展开目录可打开每条详情；往期记录不表示当前仍能参与或领取，新店状态是来源核对时的记录。', 'Browse every event, offer and opening by its published dates. Expand a directory to open any record. Past records do not indicate current availability; opening status reflects the source check date.')} />
    <p className="archive-today">{label(locale, '日期状态按湾区当地日期：', 'Date status uses the Bay Area date: ')}<time dateTime={today}>{today}</time></p>
    <nav aria-label={label(locale, '内容目录分组', 'Directory groups')} className="archive-jump">{groups.map(group => <a key={group.kind} href={`#${group.id}`}>{group.title}</a>)}</nav>
    {groups.map(group => {
      const rows = items.filter(item => item.kind === group.kind).map(item => directoryRow(item, today, locale));
      const current = rows.filter(row => !row.archived);
      const archived = rows.filter(row => row.archived);
      return <section key={group.kind} id={group.id} aria-labelledby={`${group.id}-heading`} className="archive-group">
        <h2 id={`${group.id}-heading`}>{group.title} · {rows.length}</h2>
        <details><summary>{group.kind === 'opening' ? label(locale, '全部新店消息', 'All opening reports') : label(locale, '后续日期、常设与待确认记录', 'Upcoming, recurring and unconfirmed records')} · {current.length}</summary><DirectoryList rows={current} today={today} locale={locale} /></details>
        {archived.length > 0 && <details><summary>{label(locale, '已结束的往期记录', 'Ended records')} · {archived.length}</summary><DirectoryList rows={archived} today={today} locale={locale} /></details>}
      </section>;
    })}
    <section className="archive-group" aria-labelledby="directory-more-heading"><h2 id="directory-more-heading">{label(locale, '继续浏览', 'Keep browsing')}</h2><nav aria-label={label(locale, '网站内容栏目', 'Site sections')} className="archive-links">{sections.map(({ path, zh, en }) => path === '/opus-bay' ? <Link key={path} to={path} reloadDocument>{label(locale, zh, en)}</Link> : <Link key={path} to={path}>{label(locale, zh, en)}</Link>)}</nav><nav aria-label={label(locale, '邻里信息分类', 'Neighborhood categories')} className="archive-links">{Object.entries(SLUG_TO_CATEGORY).map(([slug, title]) => <Link key={slug} to={`/category/${slug}`}>{translateText(title, locale)}</Link>)}</nav></section>
  </PageContainer>;
}
