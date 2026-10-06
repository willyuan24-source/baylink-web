import { Link } from 'react-router-dom';
import { discoveryShare, localDiscoveries, type LocalDiscovery } from '../data/local-discoveries';
import { translateText, useLocale, type Locale } from '../i18n/locale';
import { getBayAreaToday, getEventStatus } from '../lib/monthly';
import { SLUG_TO_CATEGORY } from '../routing';

type DirectoryRow = { path: string; title: string; date: string; start?: string; end?: string; checkedAt: string; status: string; archived: boolean };
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
    const state = getEventStatus(item.event, today);
    const labels = { upcoming: ['尚有后续日期', 'Upcoming dates'], ongoing: ['列明日期内', 'Within listed dates'], ended: ['已结束 · 往期记录', 'Ended · past record'] } as const;
    return { ...base, start: item.event.startDate, end: item.event.endDate, status: label(locale, labels[state][0], labels[state][1]), archived: state === 'ended' };
  }
  if (item.kind === 'opening') {
    const labels = { open: ['已报道开业', 'Reported open'], soft_open: ['试营业记录', 'Soft opening record'], announced: ['预告与庆典记录', 'Announcement or celebration record'] } as const;
    return { ...base, start: item.shop.openedOn, status: label(locale, labels[item.shop.status][0], labels[item.shop.status][1]), archived: false };
  }
  const offer = item.offer;
  const start = offer.startDate || offer.endDate;
  const end = offer.endDate || (offer.availability === 'dated' ? offer.startDate : undefined);
  const ended = validDay(end) && end < today;
  let status: string;
  if (ended) status = label(locale, '已结束 · 往期记录', 'Ended · past record');
  else if (offer.verificationStatus === 'needs-confirmation') status = label(locale, '当前优惠待确认', 'Current offer unconfirmed');
  else if (offer.availability === 'ongoing') status = label(locale, '常设福利 · 先查条件', 'Recurring offer · check conditions');
  else if (offer.availability === 'check-local') status = label(locale, '查询本店场次与供应', 'Check local sessions and availability');
  else if (!validDay(start) || !validDay(end) || start > end) status = label(locale, '日期待核对', 'Dates unconfirmed');
  else status = start > today ? label(locale, '尚未开始', 'Upcoming') : label(locale, '列明日期内', 'Within listed dates');
  return { ...base, start: offer.startDate, end: offer.endDate, status, archived: ended };
}

function DirectoryList({ rows, today, locale }: { rows: DirectoryRow[]; today: string; locale: Locale }) {
  return <ul className="divide-y divide-baylink-border">
    {rows.map(row => <li key={row.path} className="space-y-2 py-4">
      <Link to={row.path} className="break-words font-semibold text-baylink-green underline underline-offset-4">{row.title}</Link>
      <p className="text-sm">{row.date}</p>
      {validDay(row.start) && <p className="text-xs text-baylink-muted"><time dateTime={row.start}>{row.start}</time>{validDay(row.end) && row.end !== row.start && <> — <time dateTime={row.end}>{row.end}</time></>}</p>}
      <p className="text-sm"><span>{row.status}</span><span className="text-baylink-muted"> · {validDay(row.checkedAt) && row.checkedAt <= today ? <>{label(locale, '来源核对：', 'Source checked: ')}<time dateTime={row.checkedAt}>{row.checkedAt}</time></> : label(locale, '来源核对日期待确认', 'Source check date unconfirmed')}</span></p>
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
  const sections = [
    ['/', '首页', 'Home'], ['/guides', '全部指南', 'Guide library'], ['/this-month', '当期发现', 'Current edition'],
    ['/calendar', '活动日历', 'Event calendar'], ['/explore', '景点探索', 'Explore places'], ['/plan', '出游计划', 'Plan an outing'],
    ['/opus-bay', '3D 旧金山', '3D San Francisco'], ['/ai-in-the-bay', '湾区 AI 现场', 'AI in the Bay'],
    ['/tools', '生活工具', 'Life tools'], ['/recommend', '编辑推荐', 'Editorial collections'], ['/about', '关于与核验方法', 'About and sources'],
  ];
  return <div className="public-content-directory mx-auto max-w-4xl space-y-8 px-5 py-8">
    <header className="space-y-4">
      <h1 className="text-3xl font-bold">{label(locale, '内容目录与往期记录', 'Content directory and archives')}</h1>
      <p>{label(locale, '按原始日期查看全部活动、优惠与新店记录。展开目录可打开每条详情；往期记录不表示当前仍能参与或领取，新店状态是来源核对时的记录。', 'Browse every event, offer and opening by its published dates. Expand a directory to open any record. Past records do not indicate current availability; opening status reflects the source check date.')}</p>
      <p className="text-sm text-baylink-muted">{label(locale, '日期状态按湾区当地日期：', 'Date status uses the Bay Area date: ')}<time dateTime={today}>{today}</time></p>
      <nav aria-label={label(locale, '内容目录分组', 'Directory groups')} className="flex flex-wrap gap-4">{groups.map(group => <a key={group.kind} className="text-baylink-green underline" href={`#${group.id}`}>{group.title}</a>)}</nav>
    </header>
    {groups.map(group => {
      const rows = items.filter(item => item.kind === group.kind).map(item => directoryRow(item, today, locale));
      const current = rows.filter(row => !row.archived);
      const archived = rows.filter(row => row.archived);
      return <section key={group.kind} id={group.id} aria-labelledby={`${group.id}-heading`} className="space-y-3">
        <h2 id={`${group.id}-heading`} className="text-xl font-bold">{group.title} · {rows.length}</h2>
        <details className="rounded-xl border border-baylink-border p-4"><summary className="cursor-pointer font-semibold">{group.kind === 'opening' ? label(locale, '全部新店消息', 'All opening reports') : label(locale, '后续日期、常设与待确认记录', 'Upcoming, recurring and unconfirmed records')} · {current.length}</summary><DirectoryList rows={current} today={today} locale={locale} /></details>
        {archived.length > 0 && <details className="rounded-xl border border-baylink-border p-4"><summary className="cursor-pointer font-semibold">{label(locale, '已结束的往期记录', 'Ended records')} · {archived.length}</summary><DirectoryList rows={archived} today={today} locale={locale} /></details>}
      </section>;
    })}
    <section className="space-y-4" aria-labelledby="directory-more-heading"><h2 id="directory-more-heading" className="text-xl font-bold">{label(locale, '继续浏览', 'Keep browsing')}</h2><nav aria-label={label(locale, '网站内容栏目', 'Site sections')} className="flex flex-wrap gap-x-5 gap-y-3">{sections.map(([path, zh, en]) => <Link key={path} to={path} className="text-baylink-green underline">{label(locale, zh, en)}</Link>)}</nav><nav aria-label={label(locale, '邻里信息分类', 'Neighborhood categories')} className="flex flex-wrap gap-x-5 gap-y-3">{Object.entries(SLUG_TO_CATEGORY).map(([slug, title]) => <Link key={slug} to={`/category/${slug}`} className="text-baylink-green underline">{translateText(title, locale)}</Link>)}</nav></section>
  </div>;
}
