import { recordProductEvent } from '../lib/product-events';
import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, MapPin, Sparkles, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { aiLocalEvents } from '../data/ai-local-events';
import { aiWeekGuideSlug } from '../data/guides-ai-week';
import { translateText, useLocale } from '../i18n/locale';
import { getBayAreaToday, getEventStatus } from '../lib/monthly';
import { setPageMetadata } from '../lib/seo';
import { GUIDE_IMAGES } from '../data/guide-media';
import { GuideFigure } from '../components/GuideVisuals';

const goals = [
  { id: 'all', label: '所有场次' },
  { id: 'learn', label: '入门与职业交流' },
  { id: 'build', label: '开发与动手实践' },
  { id: 'community', label: '社区与公共议题' },
] as const;
type Goal = typeof goals[number]['id'];
const eventGoals: Record<string, Goal[]> = {
  'ai-conference-sf-2026': ['learn', 'build'],
  'pyladies-snowflake-ai-data-2026': ['learn', 'community'],
  'runtime-modal-sf-2026': ['build'],
  'llmday-san-francisco-q4-2026': ['build'],
  'oakland-civic-ai-design-sprint-2026': ['learn', 'community'],
  'surrealdb-mastra-shared-memory-2026': ['build'],
  'n8n-sf-tech-week-workshop-2026': ['learn', 'build'],
  'oss4ai-agent-day-menlo-park-2026': ['build', 'community'],
};
const statusLabels = { upcoming: '即将开始', ongoing: '活动日期内', ended: '已结束' };

export default function AiLocalPage() {
  const locale = useLocale();
  const t = (text: string) => translateText(text, locale);
  const [goal, setGoal] = useState<Goal>('all');
  const [week, setWeek] = useState('all');
  const [includeEnded, setIncludeEnded] = useState(false);
  const today = getBayAreaToday();
  const events = aiLocalEvents.filter(event =>
    (includeEnded || event.endDate >= today)
    && (goal === 'all' || eventGoals[event.id]?.includes(goal))
    && (week === 'all' || (week === 'ai-week' ? event.startDate <= '2026-10-03' : event.startDate >= '2026-10-05'))
  );
  const reset = () => { setGoal('all'); setWeek('all'); };
  useEffect(() => {
    setPageMetadata({
      title: translateText('湾区 AI 现场｜BAYLINK', locale),
      description: translateText('湾区 AI 活动专题：AI Week SF 与 SF Tech Week 的真实场次、报名要求、费用与第一次参加的实用准备。', locale),
      path: '/ai-in-the-bay',
    });
  }, [locale]);

  return <main className="bl-ai-local">
    <header className="bl-ai-hero">
      <div className="bl-ai-hero-copy">
        <p className="bl-ai-kicker"><Sparkles size={17} aria-hidden="true" /> {t('湾区 AI 现场')}</p>
        <h1>{t('从一个晚上，走进 AI 社区。')}</h1>
        <p className="bl-ai-intro">{t('把公开活动变成能真正参加的一次体验：看清日期、地点、费用与报名条件，再挑适合自己的那一场。')}</p>
        <p className="bl-ai-checked"><CheckCircle2 size={15} aria-hidden="true" /> {t('活动核对：2026-09-23')}</p>
      </div>
      <div className="bl-ai-weeks">
        <a href="https://aiweeksf.com/calendar" target="_blank" rel="noopener noreferrer" aria-label={t('查看 AI Week SF 官方日历')}>
          <span>{t('9 月 27 日—10 月 3 日')}</span><strong>AI Week SF <ArrowUpRight size={19} aria-hidden="true" /></strong><small>{t('系列活动周 · 每场分别报名')}</small>
        </a>
        <a href="https://www.tech-week.com/calendar/sf" target="_blank" rel="noopener noreferrer" aria-label={t('查看 SF Tech Week 官方日历')}>
          <span>{t('10 月 5 日—11 日')}</span><strong>SF Tech Week <ArrowUpRight size={19} aria-hidden="true" /></strong><small>{t('系列活动周 · 每场分别报名')}</small>
        </a>
      </div>
    </header>

    <section className="bl-ai-guide" aria-labelledby="ai-guide-title">
      <div>
        <p className="bl-ai-kicker">{t('第一次参加？从这里开始')}</p>
        <h2 id="ai-guide-title">{t('一份能照着准备的入门指南')}</h2>
        <p>{t('按兴趣选场、识别报名批准、安排跨城交通，再准备一句自然的自我介绍。')}</p>
      </div>
      <Link to={`/guides/${aiWeekGuideSlug}`}>{t('阅读入门指南')} <ArrowRight size={18} aria-hidden="true" /></Link>
    </section>

    <section className="bl-ai-listing" aria-labelledby="ai-events-title">
      <div className="bl-ai-section-heading">
        <div><h2 id="ai-events-title">{t('先选目标，再看场次')}</h2><p>{t('不用赶满整周。选一个能学到东西、认识同行或完成小作品的下午或晚上。')}</p></div>
      </div>
      <div className="bl-ai-filters">
        <div className="bl-ai-goals" role="group" aria-label={t('先选目标，再看场次')}>
          {goals.map(item => <button key={item.id} type="button" aria-pressed={goal === item.id} onClick={() => setGoal(item.id)}>{t(item.label)}</button>)}
        </div>
        <label className="bl-ai-select">{t('活动日期分组')}
          <select value={week} onChange={event => setWeek(event.target.value)}>
            <option value="all">{t('全部日期')}</option>
            <option value="ai-week">{t('9/27—10/3 活动周')}</option>
            <option value="tech-week">{t('10/5—10/11 活动周')}</option>
          </select>
        </label>
      </div>
      <div className="bl-ai-list-meta">
        <p aria-live="polite">{t('符合筛选的场次')} · {events.length}</p>
        <label><input type="checkbox" checked={includeEnded} onChange={event => setIncludeEnded(event.target.checked)} />{t('显示已结束场次')}</label>
      </div>
      <p className="bl-ai-scope">{t('场次按日期分组，不代表主办方合作关系。')} {t('时间均为湾区当地时间。活动周不是连续开放的展会通票。')}</p>
      {events.length === 0 ? <div className="bl-ai-empty"><p>{t('这个筛选下暂时没有尚未结束的场次。')}</p><button type="button" onClick={reset}>{t('重置筛选')}</button></div>
        : <div className="bl-ai-event-grid">{events.map(event => {
          const status = getEventStatus(event, today);
          const image = GUIDE_IMAGES[event.imageKey];
          return <article key={event.id} className={`bl-ai-event bl-ai-event--${status}`}>
            {image && <div className="bl-ai-event-media"><GuideFigure image={image} variant="preview" /></div>}
            <div className="bl-ai-event-top"><span>{event.city}</span><span>{t(statusLabels[status])}</span></div>
            <h3><Link to={`/events/${event.id}`}>{t(event.title)}</Link></h3>
            <p className="bl-ai-fact"><CalendarDays size={16} aria-hidden="true" /><span>{t(event.dateLabel)}</span></p>
            <p className="bl-ai-fact"><MapPin size={16} aria-hidden="true" /><span>{t(event.venue)}</span></p>
            <p className="bl-ai-fact bl-ai-ticket"><Ticket size={16} aria-hidden="true" /><span>{t(event.costLabel)}</span></p>
            <p className="bl-ai-summary">{t(event.summary)}</p>
            <p className="bl-ai-audience">{t('适合')} · {event.audience.map(item => t(item)).join(' / ')}</p>
            <details><summary>{t('报名与行前提示')}</summary><ul>{event.plan.map(tip => <li key={tip}>{t(tip)}</li>)}</ul></details>
            <div className="bl-ai-card-actions"><Link to={`/events/${event.id}`}>{t('查看场次与安排')} <ArrowRight size={15} aria-hidden="true" /></Link><a onClick={() => recordProductEvent('official_source_click')} href={event.officialUrl} target="_blank" rel="noopener noreferrer">{t('主办方报名页')} <ArrowUpRight size={15} aria-hidden="true" /></a></div>
            <p className="bl-ai-source">{t('核对日期')} {event.verifiedAt} · {t(event.sourceLabel)}</p>
          </article>;
        })}</div>}
    </section>

    <section className="bl-ai-prep" aria-label={t('第一次参加？从这里开始')}>
      {[
        ['01', '带上一个具体问题', '想自动化什么、正在做哪种产品、想认识哪类同行，都比“随便看看”更容易帮你选场。'],
        ['02', '先确认报名，再安排路线', '需要主办方批准的场次，提交申请不等于已获准入场；地址、票种与最新变动以活动页为准。'],
        ['03', '一次只排一个区域', '旧金山、Oakland、Menlo Park 分开安排；不要把地图上的邻近感当作晚高峰的通勤时间。'],
      ].map(([number, title, body]) => <div key={number}><span>{number}</span><h3>{t(title)}</h3><p>{t(body)}</p></div>)}
    </section>
    <footer className="bl-ai-footnote"><h2>{t('这份精选如何维护')}</h2><p>{t('只收录已找到公开主办方页面、具体日期与地点的场次。没有确认票价的活动不会标成免费；不展示实时余票、录取概率或保留席位。')}</p><div><Link to="/this-month">{t('返回本月活动')} <ArrowRight size={15} aria-hidden="true" /></Link><Link to="/explore">{t('继续探索湾区')} <ArrowRight size={15} aria-hidden="true" /></Link></div></footer>
  </main>;
}
