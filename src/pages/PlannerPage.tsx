import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, Sparkles, Heart, Plus, X, Share2, ArrowUp, CalendarDays } from 'lucide-react';
import { useApp } from '../app/context';
import { api } from '../lib/api';
import { useLocale, translateText } from '../i18n/locale';
import { ATTRACTION_REGIONS } from '../data/attractions';
import { PLANNER_EVENTS, PLANNER_PLACES } from '../data/planner-catalog';
import { cleanStops, distanceKm, errorText, parseSharedPlan, sharePlanUrl, stopPath, stopTitle, todayInBay, type Recommendations, type SavedPlan, type Stop } from '../lib/planner';
import { usePlannerLibrary } from '../lib/planner-library';
import { PlannerMap } from '../components/PlannerMap';
import { PlannerAccountNotice } from '../components/PlannerAccountNotice';
import { setPageMetadata } from '../lib/seo';
import { PLAN_METADATA } from '../lib/planner';
import { recordProductEvent } from '../lib/product-events';

export default function PlannerPage() {
  const app = useApp();
  const location = useLocation();
  const shared = useMemo(() => parseSharedPlan(location.search), [location.search]);
  const locale = useLocale();
  useEffect(() => { setPageMetadata(PLAN_METADATA); }, [locale]);
  const library = usePlannerLibrary(app?.user?.id);
  const [message, setMessage] = useState(new URLSearchParams(location.search).get('q')?.slice(0, 800) || '');
  const [date, setDate] = useState(shared.date);
  const [region, setRegion] = useState('all');
  const [budget, setBudget] = useState('');
  const [age, setAge] = useState('');
  const [setting, setSetting] = useState('any');
  const [travel, setTravel] = useState('any');
  const [results, setResults] = useState<Recommendations | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [stops, setStops] = useState<Stop[]>(shared.stops);
  const [title, setTitle] = useState(() => translateText('我的湾区出游', locale));
  const [editing, setEditing] = useState<SavedPlan>();
  const [selected, setSelected] = useState('');
  const request = useRef<AbortController>();
  const editLoaded = useRef('');
  const prefsLoaded = useRef(false);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { setEditing(undefined); setStops(parseSharedPlan(location.search).stops); setDate(parseSharedPlan(location.search).date); setTitle(translateText('我的湾区出游')); editLoaded.current = ''; prefsLoaded.current = false; }, [app?.user?.id, location.search]);
  useEffect(() => {
    if (new URLSearchParams(location.search).has('edit')) return;
    const next = parseSharedPlan(location.search); setStops(next.stops); setDate(next.date); setEditing(undefined); editLoaded.current = '';
  }, [location.search]);
  useEffect(() => {
    if (!library.loading && !prefsLoaded.current) { prefsLoaded.current = true; setRegion(library.data.preferences.regions[0] || 'all'); setTravel(library.data.preferences.travelMode || 'any'); }
    const id = new URLSearchParams(location.search).get('edit') || editing?.id;
    if (id && !library.loading) {
      const plan = library.data.plans.find(plan => plan.id === id);
      if (plan && editLoaded.current !== `${id}:${plan.version}`) { editLoaded.current = `${id}:${plan.version}`; setEditing(plan); setStops(cleanStops(plan.stops)); setDate(plan.date); setTitle(plan.title); }
    }
  }, [library.loading, library.data, location.search, editing?.id]);

  const filteredPlaces = useMemo(() => PLANNER_PLACES.filter(place => region === 'all' || place.region === region), [region]);
  const events = useMemo(() => results?.suggestions.map(s => PLANNER_EVENTS.find(event => event.id === s.eventId)).filter(event => !!event) || PLANNER_EVENTS.filter(event => event.endDate >= todayInBay() && (region === 'all' || event.region === region) && (!date || event.startDate <= date && event.endDate >= date)).slice(0, 8), [results, region, date]);
  const points = useMemo(() => [...events.map(event => ({ key: `event:${event.id}`, title: event.title, location: event.location })), ...filteredPlaces.map(place => ({ key: `place:${place.id}`, title: place.title, location: place.location }))].filter((point): point is { key: string; title: string; location: NonNullable<typeof point.location> } => !!point.location), [events, filteredPlaces]);
  const anchor = points.find(point => point.key === selected) || points.find(point => stops.some(stop => `${stop.kind}:${stop.id}` === point.key));
  const nearby = anchor ? filteredPlaces.filter(place => place.location && anchor.key !== `place:${place.id}`).map(place => ({ place, km: distanceKm(anchor.location, place.location!) })).filter(item => item.km <= 15).sort((a, b) => a.km - b.km).slice(0, 3) : [];
  const choose = (key: string) => { setSelected(key); document.getElementById(`catalog-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
  const add = (stop: Stop) => { setStatus(''); if (stops.some(s => s.kind === stop.kind && s.id === stop.id)) return; if (stops.length >= 3) { setStatus('一份计划最多三站，先移除一站再添加。'); return; } setStops([...stops, stop]); setSelected(`${stop.kind}:${stop.id}`); };
  const recommend = async (replace = false) => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setRequesting(true); setError('');
    try {
      const result: Recommendations = await api.request('/planner/recommend', { method: 'POST', signal: controller.signal, body: JSON.stringify({ message, locale, filters: { ...(date ? { date } : {}), region, ...(budget !== '' ? { budget: Number(budget) } : {}), ...(age !== '' ? { childAge: Number(age) } : {}), setting, travelMode: travel }, excludeEventIds: replace ? results?.suggestions.map(s => s.eventId) || [] : [] }) });
      if (request.current === controller && !controller.signal.aborted) { setResults(result); recordProductEvent('planner_recommendation'); }
    } catch (e) { if (request.current === controller && !controller.signal.aborted) setError(errorText(e)); }
    finally { if (request.current === controller) setRequesting(false); }
  };
  const save = async () => {
    setStatus('');
    if (!stops.length) { setStatus('先选择至少一站。'); return; }
    if (!date) { setStatus('请先选择出游日期。'); return; }
    if (date < todayInBay()) { setStatus('请选择今天或未来日期。'); return; }
    const badDate = stops.some(stop => { const event = stop.kind === 'event' && PLANNER_EVENTS.find(e => e.id === stop.id); return event && (date < event.startDate || date > event.endDate); });
    if (badDate) { setStatus('计划日期与所选活动不一致，请调整日期或移除活动。'); return; }
    const saved = await library.savePlan({ title: title.trim() || translateText('我的湾区出游', locale), date, stops }, editing);
    if (saved) { setEditing(saved); setStatus(app?.user ? '已保存到账号。' : '已保存到这个浏览器。'); }
  };
  const share = async () => {
    try { await navigator.clipboard.writeText(sharePlanUrl({ date, stops }, window.location.origin)); recordProductEvent('plan_shared'); setStatus('公开地点与日期链接已复制；不包含账号或私人标题。'); } catch { setStatus('复制失败，请使用下方分享链接。'); }
  };
  const favorite = (kind: 'event' | 'place', id: string) => library.data.favorites.some(item => item.kind === kind && item.id === id);
  return <div className="planner-page">
    <header className="planner-hero"><div className="planner-eyebrow"><Sparkles size={16} /> BAYBAY / PLAN A LITTLE BETTER</div><h1>下一次出门，<br /><em>从一个好计划开始。</em></h1><p>告诉 BayBay 想去哪里、想花多少。从真实活动出发，把湾区的下一站排进来。</p><nav><Link to="/my-week"><CalendarDays size={16} /> 我的这周</Link><Link to="/ai-in-the-bay">湾区 AI 活动 ↗</Link><Link to="/calendar">活动日历 ↗</Link></nav></header>
    <PlannerAccountNotice library={library} signedIn={!!app?.user} login={() => app?.setShowLogin(true)} />
    <form className="planner-form" onChange={() => { request.current?.abort(); setRequesting(false); setResults(null); }} onSubmit={e => { e.preventDefault(); void recommend(); }}>
      <label className="planner-question">这次想怎么过？<textarea maxLength={800} value={message} onChange={e => setMessage(e.target.value)} placeholder={translateText('例如：周六在东湾带孩子玩，门票每人不超过 30 美元', locale)} /></label>
      <div className="planner-filters"><label>出游日期<input type="date" min={todayInBay()} value={date} onChange={e => setDate(e.target.value)} /></label><label>地区<select value={region} onChange={e => setRegion(e.target.value)}>{ATTRACTION_REGIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label><label>每人门票预算 $<input type="number" min="0" max="10000" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} placeholder={translateText('不限', locale)} /></label><label>同行孩子年龄<input type="number" min="0" max="17" value={age} onChange={e => setAge(e.target.value)} placeholder={translateText('不填写', locale)} /></label><label>场地<select value={setting} onChange={e => setSetting(e.target.value)}><option value="any">室内外皆可</option><option value="indoor">只看已确认室内</option><option value="outdoor">只看已确认户外</option></select></label><label>出行方式<select value={travel} onChange={e => setTravel(e.target.value)}><option value="any">暂未决定</option><option value="drive">开车</option><option value="transit">公共交通</option><option value="walk">步行</option></select></label></div>
      <div className="planner-form-actions"><button className="planner-primary" disabled={requesting}><Sparkles size={17} />{requesting ? '正在挑选…' : '帮我挑选方案'}</button><span>门票预算不含餐饮、停车与交通。</span></div>
    </form>
    {error && <p className="planner-error" role="alert">{error}</p>}
    {results && <section className="planner-results"><div className="planner-section-head"><div><span className="planner-eyebrow">YOUR OPTIONS</span><h2>有依据的出游建议</h2><p>{results.responseMode === 'ai' ? 'AI 根据已收录资料整理，活动信息可追溯到官方来源。' : '根据活动目录与筛选条件匹配。'}</p></div><button disabled={requesting} onClick={() => void recommend(true)}>换一批</button></div>
      {results.notices.map((notice, index) => <p className="planner-note" key={index}>{notice}</p>)}
      {!results.suggestions.length && <p className="planner-note">没有完全符合条件的活动。试着放宽日期、地区或场地限制，也可以从地图中的景点开始。</p>}
      <div className="planner-options">{results.suggestions.map((suggestion, index) => { const event = PLANNER_EVENTS.find(e => e.id === suggestion.eventId); if (!event) return null; return <article className="planner-option" key={suggestion.id}><span className="planner-number">0{index + 1}</span><h3><Link to={`/events/${event.id}`}>{event.title}</Link></h3><p className="planner-meta">{event.dateLabel} · {event.city}</p><p>{suggestion.reasons?.length ? suggestion.reasons.join(' ') : suggestion.reason}</p><strong className="planner-cost">{event.costLabel}</strong><ul>{suggestion.unknowns.map((unknown, i) => <li key={i}>{unknown}</li>)}</ul><a onClick={() => recordProductEvent('official_source_click')} href={event.officialUrl} target="_blank" rel="noreferrer">查看主办方最新信息 ↗</a><small>资料核查：{event.verifiedAt}</small><button className="planner-primary" onClick={() => { setStops(cleanStops([{ kind: 'event', id: event.id }, ...suggestion.placeIds.map(id => ({ kind: 'place', id }))])); setDate(suggestion.date); setSelected(`event:${event.id}`); setTitle(translateText(event.title, locale)); setEditing(undefined); }}>用这个方案开始</button></article>; })}</div>
    </section>}
    <div className="planner-workspace"><main>
      <div className="planner-section-head"><div><span className="planner-eyebrow">EXPLORE THE BAY</span><h2>地图上，接着逛</h2></div><span><MapPin size={15} /> {points.length}</span></div>
      <PlannerMap points={points} selected={selected} onSelect={choose} />
      {nearby.length > 0 && <section className="planner-nearby"><h3>附近再加一站</h3><p>直线距离仅供选点；实际路线和开放时间请另查。</p>{nearby.map(({ place, km }) => <button key={place.id} onClick={() => add({ kind: 'place', id: place.id })}>{place.title}<span>{km.toFixed(1)} km <Plus size={14} /></span></button>)}</section>}
      <div className="planner-catalog">{[...events.map(event => ({ kind: 'event' as const, id: event.id, title: event.title, city: event.city, summary: event.summary, label: `${translateText(event.dateLabel, locale)} · ${translateText(event.costLabel, locale)}`, point: event.location, official: event.officialUrl })), ...filteredPlaces.map(place => ({ kind: 'place' as const, id: place.id, title: place.title, city: place.city, summary: place.summary, label: '常设景点 · 开放时间请查官方', point: place.location, official: place.officialUrl }))].map(item => { const key = `${item.kind}:${item.id}`; const pin = points.findIndex(point => point.key === key); return <article id={`catalog-${key}`} key={key} className={`planner-place ${selected === key ? 'is-selected' : ''}`}><div className="planner-place-heading"><button className="planner-place-title" onClick={() => setSelected(key)}>{pin >= 0 && <span>{pin + 1}</span>}<h3>{item.title}</h3></button><button aria-label={translateText(favorite(item.kind, item.id) ? '取消收藏' : '收藏到我的这周', locale)} aria-pressed={favorite(item.kind, item.id)} disabled={library.loading || library.busy} onClick={() => void library.toggleFavorite({ kind: item.kind, id: item.id })}><Heart size={17} fill={favorite(item.kind, item.id) ? 'currentColor' : 'none'} /></button></div><p className="planner-meta">{item.city} · {item.label}</p><p>{item.summary}</p><div className="planner-place-actions"><Link to={stopPath(item)}>阅读详情</Link>{item.point && <> <a href={item.point.sourceUrl} target="_blank" rel="noreferrer">坐标来源 ↗</a><a href={`https://www.google.com/maps/search/?api=1&query=${item.point.lat},${item.point.lng}`} target="_blank" rel="noreferrer">查看地图与路线 ↗</a></>}<button onClick={() => add({ kind: item.kind, id: item.id })}><Plus size={15} /> 加入计划</button></div></article>; })}</div>
    </main><aside className="planner-editor"><span className="planner-eyebrow">YOUR LITTLE ESCAPE</span><h2>排好这一天</h2><p>最多三站，留些时间给路上。</p><label>计划名称<input maxLength={80} value={title} onChange={e => setTitle(e.target.value)} /></label><label>日期<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      {!stops.length && <div className="planner-empty">从建议或地点列表中<br />加入你的第一站。</div>}
      <ol className="planner-stops">{stops.map((stop, index) => <li key={`${stop.kind}:${stop.id}`}><span>{index + 1}</span><Link to={stopPath(stop)}>{stopTitle(stop)}</Link><div>{index > 0 && <button aria-label={translateText('上移一站', locale)} onClick={() => setStops(current => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}><ArrowUp size={14} /></button>}<button aria-label={translateText('移除此站', locale)} onClick={() => setStops(stops.filter((_, i) => i !== index))}><X size={14} /></button></div></li>)}</ol>
      <button className="planner-primary" disabled={library.loading || library.busy || !stops.length} onClick={() => void save()}>{library.busy ? '保存中…' : editing ? '更新这份计划' : '保存这份计划'}</button>
      {stops.length > 0 && <><button className="planner-share" onClick={() => void share()}><Share2 size={15} /> 分享地点与日期</button><a className="planner-public-link" onClick={() => recordProductEvent('plan_shared')} href={sharePlanUrl({ date, stops })}>打开公开分享链接 ↗</a></>}
      {status && <p className="planner-note" role="status">{status}</p>}
      <p className="planner-note">景点顺序由你决定。出发前确认门票、开放时间及导航路线。</p>
    </aside></div>
  </div>;
}
