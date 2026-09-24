import { recordProductEvent } from '../lib/product-events';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Heart, MapPin, Trash2 } from 'lucide-react';
import { useApp } from '../app/context';
import { ATTRACTION_REGIONS } from '../data/attractions';
import { MONTHLY_EVENTS } from '../data/monthly-edition';
import { guides } from '../data/guides';
import { useReaderLibrary } from '../lib/reader-library';
import { usePlannerLibrary } from '../lib/planner-library';
import { favoritePath, favoriteTitle, sharePlanUrl, stopTitle, todayInBay } from '../lib/planner';
import { downloadEventCalendar } from '../lib/monthly';
import { PlannerAccountNotice } from '../components/PlannerAccountNotice';
import { translateText, useLocale } from '../i18n/locale';
import { setPageMetadata } from '../lib/seo';
import { WEEK_METADATA } from '../lib/planner';

export default function MyWeekPage() {
  const app = useApp(); const locale = useLocale();
  useEffect(() => { setPageMetadata(WEEK_METADATA); }, [locale]);
  const library = usePlannerLibrary(app?.user?.id);
  const reader = useReaderLibrary();
  const [status, setStatus] = useState('');
  const today = todayInBay();
  const end = new Date(`${today}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 6); const weekEnd = end.toISOString().slice(0, 10);
  const nextPlans = library.data.plans.filter(plan => plan.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const pastPlans = library.data.plans.filter(plan => plan.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const { preferences } = library.data;
  const thisWeek = MONTHLY_EVENTS.filter(event => event.endDate >= today && event.startDate <= weekEnd && (!preferences.regions.length || preferences.regions.includes(event.region)) && (!preferences.interests.length || preferences.interests.includes(event.category))).slice(0, 6);
  const localGuides = guides.filter(guide => reader.saved.includes(guide.slug) && !library.data.favorites.some(f => f.kind === 'guide' && f.id === guide.slug));
  const syncGuides = async () => {
    setStatus('');
    // Deliberate import; local reading history is never uploaded.
    for (const guide of localGuides) { const result = await library.toggleFavorite({ kind: 'guide', id: guide.slug }); if (!result) return; }
    setStatus('所选本机攻略已加入我的这周。');
  };
  return <div className="planner-page week-page"><header className="planner-hero"><div className="planner-eyebrow"><CalendarDays size={16} /> YOUR WEEK, AT YOUR PACE</div><h1>我的这周，<br /><em>留给喜欢的事。</em></h1><p>{today} — {weekEnd}</p><nav><Link to="/plan">新建出游计划 <ArrowRight size={16} /></Link><Link to="/ai-in-the-bay">看看湾区 AI 活动 ↗</Link></nav></header>
    <PlannerAccountNotice library={library} signedIn={!!app?.user} login={() => app?.setShowLogin(true)} />
    {library.loading ? <p role="status" className="planner-note">正在读取你的计划…</p> : <>
      <section className="week-preferences"><div><span className="planner-eyebrow">MAKE IT YOURS</span><h2>我常去的地方</h2><p>按你的选择整理未来七天的活动。</p></div><div className="week-chips">{ATTRACTION_REGIONS.filter(region => region.id !== 'all').map(region => <button key={region.id} aria-pressed={preferences.regions.includes(region.id)} disabled={library.busy} onClick={() => void library.savePreferences({ ...preferences, regions: preferences.regions.includes(region.id) ? preferences.regions.filter(id => id !== region.id) : [...preferences.regions, region.id] })}>{region.label}</button>)}</div><div className="week-chips">{[{ id: 'family', label: '亲子' }, { id: 'culture', label: '文化' }, { id: 'outdoors', label: '户外' }, { id: 'food', label: '美食' }].map(interest => <button key={interest.id} aria-pressed={preferences.interests.includes(interest.id)} disabled={library.busy} onClick={() => void library.savePreferences({ ...preferences, interests: preferences.interests.includes(interest.id) ? preferences.interests.filter(id => id !== interest.id) : [...preferences.interests, interest.id] })}>{interest.label}</button>)}</div><label>常用出行方式<select value={preferences.travelMode} disabled={library.busy} onChange={e => void library.savePreferences({ ...preferences, travelMode: e.target.value })}><option value="any">暂未决定</option><option value="drive">开车</option><option value="transit">公共交通</option><option value="walk">步行</option></select></label></section>
      <section className="week-plans"><div className="planner-section-head"><h2>已经排好的期待</h2><Link to="/plan">再排一天 ↗</Link></div>{!nextPlans.length && <div className="planner-empty"><CalendarDays size={28} /><h3>第一份计划，从一站开始。</h3><p>去地图上挑个地方，或让 BayBay 帮你选。</p><Link className="planner-primary" to="/plan">开始安排</Link></div>}<div className="week-plan-grid">{nextPlans.map(plan => <article className="week-plan-card" key={plan.id}><time dateTime={plan.date}>{plan.date}</time><h3>{plan.title}</h3><ol>{plan.stops.map(stop => <li key={`${stop.kind}:${stop.id}`}>{stopTitle(stop)}</li>)}</ol><div><Link to={`/plan?edit=${encodeURIComponent(plan.id)}`}>继续编辑</Link><a onClick={() => recordProductEvent('plan_shared')} href={sharePlanUrl(plan)}>公开分享版 ↗</a><button disabled={library.busy} aria-label={translateText('删除计划', locale)} onClick={() => { if (window.confirm(translateText('删除这份已保存计划？', locale))) void library.deletePlan(plan); }}><Trash2 size={16} /></button></div></article>)}</div></section>
      <section className="week-events"><div className="planner-section-head"><div><span className="planner-eyebrow">THE NEXT SEVEN DAYS</span><h2>这周可以去</h2></div><Link to="/calendar">整月日历 ↗</Link></div>{!thisWeek.length && <p className="planner-note">未来七天暂无符合偏好的已收录活动，可以放宽地区或兴趣。</p>}<div className="week-plan-grid">{thisWeek.map(event => <article className="week-event-card" key={event.id}><span>{event.dateLabel}</span><h3><Link to={`/events/${event.id}`}>{event.title}</Link></h3><p><MapPin size={14} /> {event.city} · {event.costLabel}</p><div><Link to={`/plan?stops=event:${event.id}&date=${event.startDate < today ? today : event.startDate}`}>放进计划</Link><button onClick={() => downloadEventCalendar(event)}>存入日历</button></div></article>)}</div></section>
      <section className="week-favorites"><div className="planner-section-head"><h2><Heart size={20} /> 想留着再看</h2><span>{library.data.favorites.length}</span></div>{!library.data.favorites.length && <p className="planner-note">在出游地图中收藏活动和景点，也可以把本机已收藏攻略加入这里。</p>}<ul>{library.data.favorites.map(favorite => <li key={`${favorite.kind}:${favorite.id}`}><Link to={favoritePath(favorite)}>{favoriteTitle(favorite)}</Link><button disabled={library.busy} onClick={() => void library.toggleFavorite(favorite)}>取消收藏</button></li>)}</ul>
        {localGuides.length > 0 && <div className="planner-account"><p>这个浏览器还有已收藏的攻略。阅读历史只留在本机。</p><button disabled={library.busy} onClick={() => void syncGuides()}>将本机收藏攻略加入这里</button></div>}
      </section>
      {pastPlans.length > 0 && <details className="week-past"><summary>过去的计划</summary>{pastPlans.map(plan => <p key={plan.id}>{plan.date} · {plan.title} <button disabled={library.busy} onClick={() => void library.deletePlan(plan)}>删除计划</button></p>)}</details>}
    </>}{status && <p className="planner-note" role="status">{status}</p>}
  </div>;
}
