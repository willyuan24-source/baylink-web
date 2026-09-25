import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronRight, Compass, ExternalLink, Globe2, Leaf, List, Loader2, MapPin, Pause, Play, Plus, RotateCcw, Share2, Sparkles, Sun, Sunset, Ticket, TramFront, X } from 'lucide-react';
import { useApp } from '../app/context';
import { BRAND } from '../brandAssets';
import { LittleBayStopPicture } from '../components/LittleBayStopPicture';
import { ATTRACTION_REGIONS } from '../data/attractions';
import { useLocale, translateText } from '../i18n/locale';
import { parseSharedPlan, sharePlanUrl, todayInBay, validDay, type SavedPlan, type Stop } from '../lib/planner';
import { usePlannerLibrary } from '../lib/planner-library';
import { setPageMetadata } from '../lib/seo';
import { LITTLE_BAY_METADATA } from '../lib/little-bay-metadata';
import { cleanLittleBayPlanStops, getLittleBayStops, getNextSaturday, pickLittleBayOuting, resolveLittleBayStop } from '../features/little-bay/catalog';

const LittleBayScene = lazy(() => import('../features/little-bay/LittleBayScene'));
const SanFranciscoExplorer = lazy(() => import('../features/little-bay/SanFranciscoExplorer'));
type Notice = { zh: string; en: string } | null;

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function LittleBayPage() {
  const app = useApp();
  const locale = useLocale();
  const { search } = useLocation();
  // Language changes update the URL too; only a different shared itinerary should
  // replace the user's unsaved ticket.
  const params = new URLSearchParams(search);
  const sharedSearch = new URLSearchParams({ date: params.get('date') || '', stops: params.get('stops') || '', places: params.get('places') || '' }).toString();
  const shared = useMemo(() => parseSharedPlan(sharedSearch), [sharedSearch]);
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const editorial = (value: string) => translateText(value, locale);
  const [date, setDate] = useState(() => shared.date || getNextSaturday());
  const [region, setRegion] = useState(() => resolveLittleBayStop(shared.stops[0])?.region || 'sf');
  const [freeOnly, setFreeOnly] = useState(false);
  const [stops, setStops] = useState<Stop[]>(() => cleanLittleBayPlanStops(shared.stops, shared.date));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'golden'>('day');
  const [listMode, setListMode] = useState(() => new URLSearchParams(search).get('view') === 'places');
  const [mounted, setMounted] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneError, setSceneError] = useState(false);
  const [sceneVersion, setSceneVersion] = useState(0);
  const [sceneVisible, setSceneVisible] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [saved, setSaved] = useState<SavedPlan>();
  const [shareUrl, setShareUrl] = useState('');
  const library = usePlannerLibrary(app?.user?.id);
  const previousOwner = useRef(app?.user?.id);
  const tripRef = useRef<HTMLElement>(null);
  const catalogRef = useRef<HTMLElement>(null);
  const worldRef = useRef<HTMLElement>(null);

  useEffect(() => { setPageMetadata(LITTLE_BAY_METADATA); }, [locale]);
  useEffect(() => { setMounted(true); setRunning(!window.matchMedia('(prefers-reduced-motion: reduce)').matches); }, []);
  useEffect(() => {
    const visibility = () => setDocumentVisible(document.visibilityState !== 'hidden');
    visibility(); document.addEventListener('visibilitychange', visibility);
    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(([entry]) => setSceneVisible(entry.isIntersecting), { threshold: 0.05 });
    if (worldRef.current) observer?.observe(worldRef.current);
    return () => { document.removeEventListener('visibilitychange', visibility); observer?.disconnect(); };
  }, []);
  useEffect(() => {
    if (previousOwner.current !== app?.user?.id) {
      previousOwner.current = app?.user?.id;
      setSaved(undefined); setStops([]); setNotice(null); setShareUrl('');
    }
  }, [app?.user?.id]);
  useEffect(() => {
    const nextDate = shared.date || getNextSaturday();
    setDate(nextDate); setStops(cleanLittleBayPlanStops(shared.stops, nextDate));
    setRegion(resolveLittleBayStop(shared.stops[0])?.region || 'sf');
    setSaved(undefined); setNotice(null); setShareUrl('');
  }, [shared]);

  const options = useMemo(() => getLittleBayStops({ date, region, freeOnly }), [date, region, freeOnly]);
  const active = options.find(item => item.key === selectedKey) || options.find(item => item.kind === 'place') || options[0];
  const chosen = stops.map(stop => resolveLittleBayStop(stop)).filter(item => !!item);
  const hasActive = !!active && stops.some(stop => stop.kind === active.stop.kind && stop.id === active.stop.id);
  const dateLabel = validDay(date) ? new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : locale === 'zh-Hant' ? 'zh-TW' : 'zh-CN', { month: 'short', day: 'numeric', weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)) : '';
  const displayedRegion = editorial(ATTRACTION_REGIONS.find(item => item.id === region)?.label || '旧金山');
  const sceneStops = options.map(item => ({ key: item.key, label: editorial(item.title), kind: item.kind }));
  const savedUnchanged = saved && saved.date === date && JSON.stringify(saved.stops) === JSON.stringify(stops);
  const plannerUrl = new URL(sharePlanUrl({ date, stops }));
  const ready = useCallback(() => setSceneReady(true), []);
  const fail = useCallback(() => { setSceneError(true); setRunning(false); }, []);
  const select = useCallback((key: string) => { setSelectedKey(key); }, []);

  const updateDate = (value: string) => {
    setDate(value); setShareUrl('');
    if (!validDay(value)) return;
    const valid = cleanLittleBayPlanStops(stops, value);
    if (valid.length !== stops.length) setNotice({ zh: '已移除新日期没有举办的活动，其他地点仍在车票里。', en: 'Events unavailable on the new date were removed. Your other places are still on the ticket.' });
    else setNotice(null);
    setStops(valid);
  };
  const addStop = () => {
    if (!active || hasActive || library.busy) return;
    if (stops.length >= 3) { setNotice({ zh: '三站刚刚好。先从车票移除一站，就能换上新的去处。', en: 'Three stops make a lovely outing. Remove one from your ticket to swap in somewhere new.' }); tripRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
    setStops(current => [...current, active.stop]); setShareUrl('');
    setNotice({ zh: '已加入你的周末车票。', en: 'Added to your little getaway.' });
  };
  const addWorldPlace = (id: string) => {
    if (library.busy || !resolveLittleBayStop({ kind: 'place', id }) || stops.some(stop => stop.kind === 'place' && stop.id === id)) return;
    if (stops.length >= 3) { setNotice({ zh: '车票已有三站，移除一站后可以加入这个地方。', en: 'Your ticket has three stops. Remove one to add this place.' }); tripRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
    setStops(current => [...current, { kind: 'place', id }]); setShareUrl('');
    setNotice({ zh: '已把这个真实地点加入周末车票。', en: 'This real place has been added to your getaway ticket.' });
  };
  const removeStop = (index: number) => { setStops(current => current.filter((_, i) => i !== index)); setNotice(null); setShareUrl(''); };
  const autoPick = () => {
    if (!options.length) return;
    const anchor = active || options[0];
    setStops(pickLittleBayOuting(anchor, date, freeOnly)); setShareUrl('');
    setNotice({ zh: '已从同城去处中搭配，优先选择免费景点。出发前请确认开放时间、预约和交通。', en: 'Paired with places in the same city, with free admission first. Check hours, reservations and travel before heading out.' });
  };
  const saveTrip = async () => {
    if (!stops.length || !validDay(date) || date < todayInBay()) { setNotice({ zh: '请选择今天或未来的日期，并加入至少一站。', en: 'Choose today or a future date and add at least one stop.' }); return; }
    const clean = cleanLittleBayPlanStops(stops, date);
    if (clean.length !== stops.length) { setStops(clean); setNotice({ zh: '部分活动不在这天举办，已更新车票。请确认后再保存。', en: 'Some events do not run on this date. Review your updated ticket before saving.' }); return; }
    const plan = await library.savePlan({ title: t('BayBay 的小小旅行', 'A little getaway with BayBay'), date, stops: clean }, saved);
    if (plan) { setSaved(plan); setNotice(app?.user ? { zh: '已保存到「我的这周」，随时可以回来继续。', en: 'Saved to My week. Your next little adventure is ready.' } : { zh: '已保存到这个浏览器的「我的这周」。', en: 'Saved to My week in this browser.' }); }
  };
  const shareTrip = async () => {
    const url = new URL(sharePlanUrl({ date, stops }, window.location.origin));
    url.pathname = '/play';
    setShareUrl(url.href);
    try { await navigator.clipboard.writeText(url.href); setNotice({ zh: '车票链接已复制，可以发给一起出门的人。', en: 'Ticket link copied. Send it to your adventure companion.' }); }
    catch { setNotice({ zh: '你的分享链接已准备好，请复制下方链接。', en: 'Your share link is ready. Copy it from the field below.' }); }
  };
  const sceneFallback = <div className="lb-scene-fallback"><Compass size={42} strokeWidth={1} /><strong>{t('小小湾区，照样出发', 'A little adventure, any way you like')}</strong><p>{t('使用下方地点卡片，一样可以挑选和保存三站。', 'Use the place cards below to build and save your three-stop getaway.')}</p><button onClick={() => { setListMode(true); catalogRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>{t('浏览地点', 'Explore the places')} <ArrowDown size={15} /></button></div>;

  return <div className="lb-page">
    <header className="lb-header">
      <div><div className="lb-eyebrow"><span /> BAYLINK PRESENTS <i /> LITTLE BAY</div><h1>{t('小小湾区，大好周末。', 'A little Bay. A lovely day.')}<span className="lb-title-star">✳</span></h1><p>{t('跟着 BayBay 逛一圈，把喜欢的地方排进下一次出门。', 'Take the scenic route with BayBay. Turn a little exploring into your next day out.')}</p></div>
      <Link to="/my-week" className="lb-week-link"><Ticket size={18} />{t('我的这周', 'My week')}<ArrowUpRight size={16} /></Link>
    </header>

    <div className="lb-toolbar">
      <div className="lb-filters"><label><MapPin size={16} /><span className="sr-only">{t('探索地区', 'Explore a region')}</span><select value={region} disabled={library.busy} onChange={event => { setRegion(event.target.value); setSelectedKey(null); }}>{ATTRACTION_REGIONS.filter(item => item.id !== 'all').map(item => <option key={item.id} value={item.id}>{editorial(item.label)}</option>)}</select></label><span className="lb-filter-divider" /><label><CalendarDays size={16} /><span className="sr-only">{t('出游日期', 'Outing date')}</span><input aria-label={t('出游日期', 'Outing date')} type="date" min={todayInBay()} value={date} disabled={library.busy} onChange={event => updateDate(event.target.value)} /></label><button className={`lb-free ${freeOnly ? 'is-active' : ''}`} aria-pressed={freeOnly} onClick={() => setFreeOnly(value => !value)}><Leaf size={15} />{t('主体免费', 'Free admission')}</button></div>
      <div className="lb-view-toggle" aria-label={t('浏览方式', 'Explore view')}><button aria-pressed={!listMode} onClick={() => setListMode(false)}><Globe2 size={16} />{t('3D 探索', '3D world')}</button><button aria-pressed={listMode} onClick={() => setListMode(true)}><List size={16} />{t('地点列表', 'Places')}</button></div>
    </div>

    {region === 'sf' && !listMode ? <Suspense fallback={<div className="lb-world lb-loading"><Loader2 className="animate-spin" size={22} /><span>{t('正在走进迷你旧金山…', 'Entering little San Francisco…')}</span></div>}><SanFranciscoExplorer date={date} stops={stops} onAddPlace={addWorldPlace} onShowList={() => setListMode(true)} freeOnly={freeOnly} ownerId={app?.user?.id} onAsk={app?.openBayBay} /></Suspense> : <div className={`lb-world-layout ${listMode ? 'is-list' : ''}`}>
      <section ref={worldRef} className={`lb-world lb-world--${timeOfDay}`} aria-label={t('互动湾区微缩街景', 'Interactive miniature Bay Area')}>
        {!listMode && <><div className="lb-world-heading"><span className="lb-live-dot" />{displayedRegion}<span className="lb-world-edition">A LITTLE BAY ADVENTURE</span></div><div className="lb-light-toggle"><button aria-label={t('白昼光线', 'Daylight')} title={t('白昼光线', 'Daylight')} aria-pressed={timeOfDay === 'day'} onClick={() => setTimeOfDay('day')}><Sun size={18} /></button><button aria-label={t('日落光线', 'Golden hour')} title={t('日落光线', 'Golden hour')} aria-pressed={timeOfDay === 'golden'} onClick={() => setTimeOfDay('golden')}><Sunset size={18} /></button></div></>}
        {listMode ? <div className="lb-list-world"><div className="lb-list-intro"><Compass size={26} /><div><span>LITTLE DISCOVERIES</span><h2>{t('下一站，想去哪里？', 'Where to next?')}</h2><p>{t('点开一个去处，看看是否适合你的这一天。', 'Open a place and see if it belongs in your day.')}</p></div></div><div className="lb-list-cards">{options.map((item, index) => <button key={item.key} className={active?.key === item.key ? 'is-selected' : ''} onClick={() => select(item.key)}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{editorial(item.title)}</strong><small>{item.city} · {editorial(item.price)}</small></div><ChevronRight size={16} /></button>)}</div>{!options.length && <p className="lb-empty">{t('这组条件下暂时没有去处，换个日期或取消免费筛选看看。', 'No places match these filters. Try another date or turn off free admission.')}</p>}</div> : <>
          {sceneError ? sceneFallback : <SceneBoundary key={sceneVersion} fallback={sceneFallback}><Suspense fallback={<div className="lb-loading"><Loader2 className="animate-spin" size={22} /><span>{t('BayBay 正在准备小电车…', 'BayBay is getting the tram ready…')}</span></div>}>{mounted && <LittleBayScene stops={sceneStops} selectedKey={active?.key || null} onSelect={select} running={running && sceneVisible && documentVisible} timeOfDay={timeOfDay} carriageCount={stops.length} onReady={ready} onError={fail} />}</Suspense></SceneBoundary>}
          {active && <button className="lb-mobile-stop" onClick={() => document.querySelector('.lb-stop-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><span>{String(options.indexOf(active) + 1).padStart(2, '0')}</span><strong>{editorial(active.title)}</strong><ArrowDown size={14} /></button>}
          <div className="lb-world-bottom"><span><Compass size={14} />{t('拖动探索 · 手机双指旋转', 'Drag to explore · Two fingers on mobile')}</span><div><button disabled={!sceneReady || sceneError} onClick={() => setRunning(value => !value)} aria-label={running ? t('暂停小电车', 'Pause the tram') : t('启动小电车', 'Start the tram')}>{running ? <Pause size={16} /> : <Play size={16} />}<span>{running ? t('暂停', 'Pause') : t('出发', 'Ride')}</span></button><button aria-label={t('重置视角', 'Reset view')} title={t('重置视角', 'Reset view')} onClick={() => { setSceneVersion(value => value + 1); setSceneError(false); setSceneReady(false); }}><RotateCcw size={16} /></button></div></div>
        </>}
      </section>

      <aside className="lb-stop-card" aria-label={t('下一站详情', 'Your next stop')}>
        <div className="lb-stop-card-heading"><span>{t('值得停一停', 'WORTH A LITTLE DETOUR')}</span><span>{active ? String(options.indexOf(active) + 1).padStart(2, '0') : '—'} / {String(options.length).padStart(2, '0')}</span></div>
        {active ? <><LittleBayStopPicture stop={active} />
          <div className="lb-stop-body"><div className="lb-stop-location"><MapPin size={13} />{active.city}</div><h2>{editorial(active.title)}</h2><p>{editorial(active.subtitle)}</p><div className="lb-stop-facts"><span><Ticket size={14} />{editorial(active.price)}</span>{active.kind === 'event' && <span><CalendarDays size={14} />{dateLabel}</span>}</div><button className={`lb-add-stop ${hasActive ? 'is-added' : ''}`} disabled={hasActive || library.busy} onClick={addStop}>{hasActive ? <Check size={17} /> : <Plus size={17} />}{hasActive ? t('已在你的车票里', 'On your ticket') : t('这一站，我想去', 'Add to my day')} {!hasActive && <ArrowRight size={17} />}</button><div className="lb-stop-links"><Link to={active.href} target="_blank" rel="noopener noreferrer">{t('查看攻略', 'Explore details')}<ArrowUpRight size={13} /></Link>{active.sourceUrl && <a href={active.sourceUrl} target="_blank" rel="noopener noreferrer">{t('官方信息', 'Official info')}<ExternalLink size={12} /></a>}</div><small className="lb-admission-note">{t('出发前确认开放时间、预约与费用。', 'Check hours, booking requirements and prices before you go.')}</small>{active.imageMeta && <details className="lb-image-credit"><summary>{t('图片来源与说明', 'Image credit & context')}</summary><p>{editorial(active.imageMeta.caption)}</p>{active.imageMeta.creditUrl ? <a href={active.imageMeta.creditUrl} target="_blank" rel="noopener noreferrer">{editorial(active.imageMeta.credit)}</a> : <span>{editorial(active.imageMeta.credit)}</span>}{active.imageMeta.licenseUrl && <a href={active.imageMeta.licenseUrl} target="_blank" rel="noopener noreferrer">{t('使用许可', 'License')}</a>}</details>}</div></> : <div className="lb-stop-body lb-empty"><Compass size={32} /><h2>{t('给探索留一点余地', 'Leave room to explore')}</h2><p>{t('暂时没有符合条件的去处。换个日期或地区看看。', 'No places match yet. Try a different date or region.')}</p></div>}
      </aside>
    </div>}

    {(region !== 'sf' || listMode) && <div className="lb-scene-caption"><span>{t('湾区灵感微缩场景，非实际道路或公交线路。', 'A Bay-inspired miniature, not a street map or transit route.')}</span><span><span className="lb-caption-dot" />{t('真实活动与地点', 'Real places. Real possibilities.')}</span></div>}

    <section className="lb-ticket" ref={tripRef} aria-label={t('我的周末车票', 'My getaway ticket')}>
      <div className="lb-ticket-heading"><div><span className="lb-eyebrow">YOUR LITTLE GETAWAY</span><h2><TramFront size={23} />{t('我的周末车票', 'Your day, coming together.')}</h2><p>{dateLabel} <span>·</span> {t('最多三站，留一点时间慢慢逛。', 'Up to three stops. Leave a little room to linger.')}</p></div><button className="lb-curate" disabled={!options.length || library.busy} onClick={autoPick}><Sparkles size={16} />{t('帮我搭配', 'Pick a little outing')}</button></div>
      {date < todayInBay() && <div className="lb-past-date" role="status">{t('这是一张过去日期的车票。原行程保留展示；重新出发前请更新日期。', 'This ticket is for a past date. Its original stops are shown; choose a new date before saving a new outing.')}</div>}<ol className="lb-ticket-stops">{[0, 1, 2].map(index => <li key={index} className={chosen[index] ? 'is-filled' : ''}><span className="lb-ticket-number">{index + 1}</span>{chosen[index] ? <><div><strong>{editorial(chosen[index].title)}</strong><small>{chosen[index].city}</small></div><button aria-label={t(`移除第 ${index + 1} 站`, `Remove stop ${index + 1}`)} disabled={library.busy} onClick={() => removeStop(index)}><X size={15} /></button>{index > 0 && <button className="lb-reorder" title={t('向前一站', 'Move earlier')} aria-label={t(`将第 ${index + 1} 站提前`, `Move stop ${index + 1} earlier`)} disabled={library.busy} onClick={() => { setStops(current => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; }); setShareUrl(''); }}>←</button>}</> : <button className="lb-empty-slot" onClick={() => catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{t('留给下一个心动的地方', 'Room for a little discovery')}<Plus size={15} /></button>}</li>)}</ol>
      <div className="lb-ticket-footer"><div className="lb-ticket-note"><img src={BRAND.baybayAvatar} alt="BayBay" width="36" height="36" /><span>{app?.user ? t('保存后，可以在「我的这周」继续安排。', 'Save it to My week and make it a day to remember.') : t('不用登录也能保存，车票会留在这个浏览器。', 'No account needed. Your ticket stays in this browser.')}</span></div><div className="lb-ticket-actions"><button className="lb-share" disabled={!stops.length || !validDay(date)} onClick={() => void shareTrip()}><Share2 size={16} />{t('分享车票', 'Share')}</button><button className="lb-save" disabled={!stops.length || !validDay(date) || date < todayInBay() || library.busy || library.loading || !!savedUnchanged} onClick={() => void saveTrip()}>{library.busy ? <Loader2 size={16} className="animate-spin" /> : savedUnchanged ? <Check size={16} /> : <Ticket size={16} />}{savedUnchanged ? t('已保存', 'Saved') : t('保存这趟小旅行', 'Save my getaway')}</button></div></div>
      {notice && <div className="lb-notice" role="status">{t(notice.zh, notice.en)}{savedUnchanged && <Link to="/my-week">{t('去我的这周', 'Open My week')}<ArrowUpRight size={13} /></Link>}</div>}
      {library.error && <div className="lb-error" role="alert">{editorial(library.error)}<button onClick={() => void library.refresh()}>{t('重试', 'Try again')}</button></div>}
      {shareUrl && <label className="lb-share-link"><span>{t('公开地点与日期链接', 'Public places and date link')}</span><input readOnly value={shareUrl} onFocus={event => event.currentTarget.select()} /></label>}
      {!!stops.length && <Link className="lb-real-map" to={plannerUrl.pathname + plannerUrl.search} target="_blank" rel="noopener noreferrer"><MapPin size={14} />{t('在真实地图中查看与调整', 'View and refine on the real map')}<ArrowUpRight size={13} /></Link>}
    </section>

    <section className="lb-discoveries" ref={catalogRef} aria-label={t('探索这些去处', 'Explore these places')}><div className="lb-discoveries-heading"><div><span className="lb-eyebrow">A FEW GOOD PLACES</span><h2>{t('每一站，都有点期待。', 'A few reasons to get outside.')}</h2></div><Link to="/calendar">{t('完整活动日历', 'The full calendar')}<ArrowUpRight size={15} /></Link></div><div className="lb-discovery-grid">{options.map((item, index) => <button key={item.key} className={active?.key === item.key ? 'is-active' : ''} onClick={() => { select(item.key); if (region === 'sf' && !listMode) setListMode(true); requestAnimationFrame(() => document.querySelector('.lb-stop-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })); }}><span className={`lb-discovery-icon ${item.kind === 'event' ? 'is-event' : ''}`}>{item.kind === 'event' ? <CalendarDays size={21} /> : <MapPin size={21} />}</span><div><small>{String(index + 1).padStart(2, '0')} / {item.city}</small><strong>{editorial(item.title)}</strong><span>{editorial(item.price)}</span></div>{stops.some(stop => stop.kind === item.stop.kind && stop.id === item.stop.id) ? <Check size={17} /> : <ArrowUpRight size={17} />}</button>)}</div>{!options.length && <p className="lb-empty">{t('这组条件下暂时没有去处，请调整上方筛选。', 'No places match these filters. Adjust your date, region or admission preference.')}</p>}</section>
    <footer className="lb-footer"><span>BAYBAY'S LITTLE BAY <i>✳</i> MADE FOR REAL-LIFE ADVENTURES</span><Link to="/plan">{t('更多条件？用 BayBay 智能规划', 'More in mind? Plan it with BayBay')}<ArrowRight size={15} /></Link></footer>
  </div>;
}
