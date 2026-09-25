import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BookOpen, Camera, CarFront, Check, Compass, Expand, Footprints, Gift, Map, MapPin, Minus, Orbit, Pause, Play, Plus, RotateCcw, Sun, Sunset, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { translateText, useLocale } from '../../i18n/locale';
import { SF_LANDMARKS } from './sf-world';
import type { SfCameraCommand } from './sf-camera';
import type { GardenInput } from './ParkGardenScene';
import type { Stop } from '../../lib/planner';
import { PLANNER_EVENTS } from '../../data/planner-catalog';
import { eventOccursOn } from '../../lib/event-calendar';

const CityScene = lazy(() => import('./SanFranciscoScene'));
const ParkScene = lazy(() => import('./ParkGardenScene'));
const GuidePanel = lazy(() => import('./SfGuidePanel'));
const PLACE_IDS: Record<string, string> = { bridge: 'golden-gate', pier: 'pier39', park: 'golden-gate-park', alcatraz: 'alcatraz', palace: 'palace', presidio: 'presidio', chinatown: 'chinatown' };
const makeInput = (): GardenInput => ({ forward: false, backward: false, left: false, right: false });

class WorldBoundary extends Component<{ children: ReactNode; onError: () => void; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function SanFranciscoExplorer({ date, stops, onAddPlace, onShowList, freeOnly = false, ownerId }: {
  date: string; stops: Stop[]; onAddPlace: (id: string) => void; onShowList: () => void; freeOnly?: boolean; ownerId?: string;
}) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const [selectedId, setSelectedId] = useState<string | null>('park');
  const [mode, setMode] = useState<'overview' | 'walk' | 'drive'>('walk');
  const [garden, setGarden] = useState(false);
  const [cityMounted, setCityMounted] = useState(true);
  const [running, setRunning] = useState(true);
  const [golden, setGolden] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [startId, setStartId] = useState('park');
  const [arrival, setArrival] = useState<string | null>(null);
  const [street, setStreet] = useState('');
  const [nearTreasure, setNearTreasure] = useState(false);
  const [found, setFound] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [digging, setDigging] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [photoNotice, setPhotoNotice] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [cameraCommand, setCameraCommand] = useState<SfCameraCommand>();
  const [guideId, setGuideId] = useState<string | null>(null);
  const stage = useRef<HTMLElement>(null);
  const reward = useRef<HTMLDivElement>(null);
  const input = useRef<GardenInput>(makeInput());
  const digTimer = useRef<ReturnType<typeof setTimeout>>();
  const photoTimer = useRef<ReturnType<typeof setTimeout>>();
  const cameraSequence = useRef(0);
  const progressKey = `baylink:mini-sf:exploration:v1:${ownerId || 'guest'}`;
  const selected = SF_LANDMARKS.find(p => p.id === selectedId);
  const arrived = SF_LANDMARKS.find(p => p.id === arrival);
  const nearby = garden ? SF_LANDMARKS.find(p => p.id === 'park') : mode === 'overview' ? selected : arrived;
  const guidePlace = SF_LANDMARKS.find(p => p.id === guideId);
  const linkedPlaceId = selected ? PLACE_IDS[selected.id] : undefined;
  const added = !!linkedPlaceId && stops.some(stop => stop.kind === 'place' && stop.id === linkedPlaceId);
  const live = running && visible && !rewardOpen && !eventsOpen && !guidePlace;
  const events = PLANNER_EVENTS.filter(event => event.region === 'sf' && (!freeOnly || event.cost === 'free') && eventOccursOn(event, date));
  const label = (p: (typeof SF_LANDMARKS)[number]) => locale === 'en' ? p.titleEn : translateText(p.title, locale);

  const release = useCallback(() => { input.current = makeInput(); }, []);
  const sceneReady = useCallback(() => setReady(true), []);
  const sceneError = useCallback(() => { setError(true); setRunning(false); }, []);
  const onArrival = useCallback((id: string | null) => setArrival(id), []);
  const onNear = useCallback((near: boolean) => setNearTreasure(near), []);
  const cancelDig = useCallback(() => { clearTimeout(digTimer.current); setDigging(false); }, []);
  useEffect(() => { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setRunning(false); }, []);
  useEffect(() => {
    try { setFound(localStorage.getItem(progressKey) === 'garden-found'); } catch { setFound(false); }
    setRewardOpen(false); setDigging(false);
    return () => { clearTimeout(digTimer.current); clearTimeout(photoTimer.current); };
  }, [progressKey]);
  useEffect(() => {
    let inView = true;
    const update = () => { setVisible(inView && document.visibilityState !== 'hidden'); release(); };
    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update(); }, { threshold: 0.02 });
    if (stage.current) observer?.observe(stage.current);
    document.addEventListener('visibilitychange', update); window.addEventListener('blur', release);
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', update); window.removeEventListener('blur', release); release(); };
  }, [release]);
  useEffect(() => { if (!live) release(); }, [live, release]);
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !rewardOpen && !guidePlace) { if (viewOpen) setViewOpen(false); else setExpanded(false); } };
    window.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', close); };
  }, [expanded, rewardOpen, guidePlace, viewOpen]);
  useEffect(() => {
    if (!rewardOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = reward.current;
    dialog?.querySelector<HTMLButtonElement>('button')?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setRewardOpen(false); }
      if (event.key !== 'Tab' || !dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previousFocus?.focus({ preventScroll: true }); };
  }, [rewardOpen]);

  const select = useCallback((id: string) => { cancelDig(); setCameraCommand(undefined); input.current = makeInput(); setCityMounted(true); setSelectedId(id); setGarden(false); setMode('overview'); setNearTreasure(false); }, [cancelDig]);
  const city = () => { cancelDig(); setCameraCommand(undefined); release(); setCityMounted(true); setGarden(false); setMode('overview'); setSelectedId(null); setNearTreasure(false); };
  const enterGarden = () => { if (garden) { setRunning(true); return; } cancelDig(); setCameraCommand(undefined); release(); setSelectedId('park'); setGarden(true); setRunning(true); setNearTreasure(false); if (!garden) setReady(false); };
  const travel = (next: 'walk' | 'drive') => {
    if (next === 'drive' && selectedId === 'alcatraz') return;
    if (garden) setCameraCommand(undefined);
    const newDeparture = garden || (mode === 'overview' && !!selectedId);
    cancelDig(); release(); setCityMounted(true); setGarden(false); setMode(next); setRunning(true); setNearTreasure(false);
    if (newDeparture) { setStartId(garden ? 'park' : selectedId!); setResetToken(value => value + 1); }
  };
  const drive = () => travel('drive');
  const walk = () => travel('walk');
  const adjustCamera = (action: SfCameraCommand['action']) => setCameraCommand({ id: ++cameraSequence.current, action });
  const openGuide = (id: string) => { release(); setViewOpen(false); setGuideId(id); };
  const closeGuide = useCallback(() => setGuideId(null), []);
  const dig = () => {
    if (!nearTreasure || found || digging) return;
    release(); setDigging(true);
    digTimer.current = setTimeout(() => {
      setDigging(false); setFound(true); setRewardOpen(true);
      try { localStorage.setItem(progressKey, 'garden-found'); } catch { /* Exploration works without storage. */ }
    }, 1300);
  };
  const photo = () => {
    const canvas = stage.current?.querySelector<HTMLCanvasElement>(garden ? '.sf-garden-layer canvas' : '.sf-city-layer canvas');
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `baylink-${garden ? 'golden-gate-park' : selectedId || 'san-francisco'}-postcard.png`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      setPhotoNotice(true); clearTimeout(photoTimer.current); photoTimer.current = setTimeout(() => setPhotoNotice(false), 2400);
    }, 'image/png');
  };
  const fallback = <div className="sf-fallback"><Compass size={38} /><strong>{t('用地点列表继续探索', 'Keep exploring with the place list')}</strong><p>{t('当前设备无法显示 3D。攻略和真实活动仍可正常使用。', '3D is unavailable on this device. Guides and local events are still available.')}</p><button onClick={onShowList}>{t('打开地点列表', 'Open place list')}<ArrowUpRight size={15} /></button><button onClick={() => { setError(false); setReady(false); setRunning(true); }}>{t('重新加载 3D', 'Retry 3D')}<RotateCcw size={15} /></button></div>;

  return <section className="sf-explorer" aria-label={t('迷你旧金山', 'Mini San Francisco')}>

    <section className={`sf-stage ${expanded ? 'is-expanded' : ''} ${garden ? 'is-garden' : ''} ${!garden && mode !== 'overview' ? 'is-exploring' : ''}`} ref={stage} aria-label={t('旧金山 3D 场景', 'San Francisco 3D scene')}>
      <nav className="sf-explorer-bar sf-scene-nav" aria-label={t('游戏内地点与地图', 'In-game places and map')}>
        <label><MapPin size={16} /><span className="sr-only">{t('选择城市地标', 'Choose a city landmark')}</span>
          <select aria-label={t('选择城市地标', 'Choose a city landmark')} value={selectedId || ''} onChange={event => event.target.value ? select(event.target.value) : city()}>
            <option value="">{t('整座旧金山', 'All of San Francisco')}</option>
            {SF_LANDMARKS.map(p => <option key={p.id} value={p.id}>{label(p)}</option>)}
          </select>
        </label>
        <button onClick={city} aria-pressed={!garden && mode === 'overview' && !selectedId}><Map size={16} /><span>{t('全城地图', 'City map')}</span></button>
        <button onClick={enterGarden} aria-pressed={garden}><Footprints size={16} /><span>{t('花园', 'Garden')}</span></button>
      </nav>
      {!error && <WorldBoundary onError={sceneError} fallback={fallback}><Suspense fallback={<div className="sf-loading"><span className="sf-loading-orbit" /><strong>{t('BayBay 正在准备出发', 'BayBay is getting ready')}</strong></div>}>
        {cityMounted && <div className="sf-city-layer" style={{ display: garden ? 'none' : 'block' }}><CityScene selectedId={selectedId} onSelect={select} mode={mode} cameraCommand={garden ? undefined : cameraCommand} running={live && !garden} timeOfDay={golden ? 'golden' : 'day'} driveInput={input} resetToken={resetToken} startId={startId} locale={locale === 'en' ? 'en' : 'zh'} onStreetChange={setStreet} onArrival={onArrival} onReady={sceneReady} onError={sceneError} /></div>}
        {garden && <div className="sf-garden-layer"><ParkScene input={input} cameraCommand={cameraCommand} running={live && !digging} golden={golden} treasureFound={found} onNearTreasure={onNear} onReady={sceneReady} onError={sceneError} /></div>}
      </Suspense></WorldBoundary>}
      {error && fallback}
      <div className="sf-scene-heading"><span className="sf-chapter">BAYBAY'S LITTLE SAN FRANCISCO</span><h2>{garden ? t('花房旁，慢慢走。', 'A little walk in the garden.') : mode === 'walk' ? t('跟 BAYBAY，逛旧金山。', 'Explore with BAYBAY.') : mode === 'drive' ? t('开车，随处逛逛。', 'Take a little drive.') : selected ? label(selected) : t('你好，旧金山。', 'Hello, San Francisco.')}</h2><span>{garden ? 'GOLDEN GATE PARK' : mode !== 'overview' ? `${mode === 'walk' ? t('步行探索', 'WALKING') : t('自由驾驶', 'FREE DRIVE')} · ${street || 'SAN FRANCISCO'}` : t('拖动旋转 · 滚轮缩放', 'DRAG TO ORBIT · SCROLL TO ZOOM')}</span></div>
      <div className="sf-corner-tools"><button onClick={() => setGolden(value => !value)} aria-label={golden ? t('切换白昼', 'Switch to daylight') : t('切换日落', 'Switch to golden hour')}>{golden ? <Sunset size={18} /> : <Sun size={18} />}</button><button onClick={() => setRunning(value => !value)} aria-label={running ? t('暂停场景', 'Pause scene') : t('继续探索', 'Resume exploring')}>{running ? <Pause size={16} /> : <Play size={16} />}</button><button onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-label={expanded ? t('退出大画面', 'Close expanded scene') : t('放大画面', 'Expand scene')}><Expand size={16} /></button></div>
      <div className="sf-view-tools">
        <button className="sf-view-toggle" onClick={() => setViewOpen(value => !value)} aria-expanded={viewOpen} aria-controls="sf-camera-options"><Orbit size={17} />{t('视角', 'View')}</button>
        {viewOpen && <div id="sf-camera-options" className="sf-camera-options" role="group" aria-label={t('调整视角', 'Adjust camera')}>
          <span>{t('转动 · 俯仰 · 缩放', 'Rotate · Tilt · Zoom')}</span>
          <div>{([
            ['left', ArrowLeft, '视角向左旋转', 'Rotate view left'], ['right', ArrowRight, '视角向右旋转', 'Rotate view right'],
            ['up', ArrowUp, '抬高视角', 'Raise camera'], ['down', ArrowDown, '降低视角', 'Lower camera'],
            ['zoom-in', Plus, '拉近画面', 'Zoom in'], ['zoom-out', Minus, '拉远画面', 'Zoom out'],
          ] as const).map(([action, Icon, zh, en]) => <button key={action} onClick={() => adjustCamera(action)} aria-label={t(zh, en)} title={t(zh, en)}><Icon size={18} /></button>)}</div>
          <button className="sf-camera-reset" onClick={() => adjustCamera('reset')}><RotateCcw size={15} />{t('恢复视角', 'Reset view')}</button>
          <small>{t('拖动画面旋转，滚轮缩放；手机双指调整。', 'Drag to orbit, scroll to zoom. Use two fingers on mobile.')}</small>
        </div>}
      </div>
      {ready && !error && (garden || mode !== 'overview') && <div className="sf-drive-controls" aria-label={t('移动控制', 'Movement controls')}>{([['forward', ArrowUp, '前进', 'Forward'], ['left', ArrowLeft, '左转或向左', 'Left'], ['backward', ArrowDown, '向后', 'Back'], ['right', ArrowRight, '右转或向右', 'Right']] as const).map(([direction, Icon, zh, en]) => <button key={direction} className={`sf-pad-${direction}`} aria-label={t(zh, en)} disabled={!live || digging} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); input.current[direction] = true; }} onPointerUp={() => { input.current[direction] = false; }} onPointerCancel={release} onLostPointerCapture={() => { input.current[direction] = false; }} onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); input.current[direction] = true; } }} onKeyUp={() => { input.current[direction] = false; }} onBlur={() => { input.current[direction] = false; }}><Icon size={20} /></button>)}</div>}
      {nearby && !error && <aside className="sf-nearby" aria-label={t('身边的景点', 'Nearby attraction')}>
        <div><span>{mode === 'overview' && !garden ? t('正在查看', 'ON THE MAP') : t('身边的发现', 'NEARBY')}</span><strong>{label(nearby)}</strong></div>
        <button onClick={() => openGuide(nearby.id)}>{nearby.guideSlug ? <BookOpen size={16} /> : <MapPin size={16} />}{nearby.guideSlug ? t('看攻略', 'Read guide') : t('景点信息', 'Place info')}</button>
        {!garden && nearby.id === 'park' && <button onClick={enterGarden}><Footprints size={16} />{t('进花园', 'Garden')}</button>}
      </aside>}
      <div className="sf-context-actions">
        {garden && nearTreasure && !found && <button className="sf-dig" onClick={dig} disabled={digging || !live}><Gift size={18} />{digging ? t('正在挖掘…', 'Digging…') : t('挖掘彩蛋', 'Dig here')}</button>}
        {garden && found && <button onClick={() => setRewardOpen(true)}><Check size={16} />{t('我的花园发现', 'My garden discovery')}</button>}
        <div className="sf-travel-toggle" role="group" aria-label={t('探索方式', 'Travel mode')}>
          <button onClick={garden ? () => setRunning(true) : walk} aria-pressed={garden || mode === 'walk'}><Footprints size={16} />{t('走路', 'Walk')}</button>
          <button onClick={drive} disabled={!garden && selectedId === 'alcatraz'} aria-pressed={!garden && mode === 'drive'}><CarFront size={16} />{t('开车', 'Drive')}</button>
        </div>
        {!garden && mode !== 'overview' && <button className="sf-reset-position" onClick={() => { release(); setResetToken(value => value + 1); }} aria-label={t('回到出发点', 'Return to start')}><RotateCcw size={17} /></button>}
        <button onClick={photo} aria-label={t('拍照保存明信片', 'Save a photo postcard')}><Camera size={17} /></button>
      </div>
      {guidePlace && <Suspense fallback={<div className="sf-guide-overlay"><div className="sf-guide-panel" role="status">{t('正在打开攻略…', 'Opening guide…')}<button onClick={closeGuide}>{t('关闭', 'Close')}</button></div></div>}><GuidePanel landmark={guidePlace} locale={locale} onClose={closeGuide} /></Suspense>}
      <div className="sf-ground-caption">{garden ? t('点地面走路 · 拖动转视角', 'Tap to walk · Drag to orbit') : mode === 'drive' ? t('WASD / 方向键开车 · 拖动转视角', 'WASD / arrows to drive · Drag to orbit') : mode === 'walk' ? t('点地面走路 · WASD 移动 · 拖动转视角', 'Tap to walk · WASD to move · Drag to orbit') : t('真实街区与主要街道 · 房屋为微缩艺术化布置', 'Real districts and main streets · Homes are miniature interpretations')}</div>
      {photoNotice && <div className="sf-photo-notice" role="status">{t('明信片已准备下载。', 'Your postcard is ready to download.')}</div>}
      {rewardOpen && <div className="sf-modal-shade"><div className="sf-reward" ref={reward} role="dialog" aria-modal="true" aria-labelledby="sf-reward-title"><button className="sf-close" onClick={() => setRewardOpen(false)} aria-label={t('关闭发现卡', 'Close discovery card')}><X size={19} /></button><span className="sf-demo-label">{t('试玩彩蛋 · 实物领奖尚未开放', 'PLAYTEST · PHYSICAL REWARDS NOT OPEN')}</span><div className="sf-gift-mark"><Gift size={42} strokeWidth={1.3} /></div><span>GOLDEN GATE PARK · LITTLE SECRET</span><h3 id="sf-reward-title">{t('你发现了花园的秘密！', 'You found the garden’s secret!')}</h3><strong>LABUBU {t('盲盒彩蛋', 'blind-box surprise')}</strong><p>{t('这次先收藏一枚花园探索印章。正式奖品活动开放后，符合条件的发现会生成领取凭证，再联系管理员领取。', 'For now, keep a garden exploration stamp. When the prize event opens, eligible discoveries will receive a claim for collection through the administrator.')}</p><small>{t('本次试玩不发放实物、不生成兑奖资格。', 'This playtest does not award a physical item or a prize claim.')}</small><button className="sf-reward-done" onClick={() => setRewardOpen(false)}>{t('带着发现，继续逛逛', 'Keep exploring')}<ArrowRight size={16} /></button></div></div>}
    </section>
    <div className="sf-place-strip"><div><span className="sf-small-label">{garden ? 'A QUIET CORNER' : 'YOUR NEXT LITTLE DISCOVERY'}</span><h3>{garden ? t('金门公园 · Conservatory of Flowers', 'Golden Gate Park · Conservatory of Flowers') : selected ? label(selected) : t('整座小城，都值得慢慢逛', 'A whole little city to explore')}</h3><p>{garden ? t('白色花房、木长椅和一只爱探索的 BayBay。', 'A white conservatory, a wooden bench and one curious BayBay.') : selectedId === 'alcatraz' ? t('这是一座离岸岛屿，现实中从 Pier 33 搭乘渡轮前往。', 'An offshore island, reached by ferry from Pier 33 in real life.') : t('景点保持固定位置，街区为未来的小店和活动留出空间。', 'Landmarks keep their locations, with room for future local shops and events.')}</p></div><div className="sf-place-actions">{selected?.guideSlug && <Link to={`/guides/${selected.guideSlug}`} target="_blank" rel="noopener noreferrer">{t('看真实攻略', 'Read the guide')}<ArrowUpRight size={15} /></Link>}{selected?.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">{t('官方信息', 'Official info')}<ArrowUpRight size={15} /></a>}{linkedPlaceId && <button disabled={added} onClick={() => onAddPlace(linkedPlaceId)}>{added ? <Check size={15} /> : <MapPin size={15} />}{added ? t('已加入周末', 'Added to my day') : t('加入我的周末', 'Add to my day')}</button>}<button onClick={() => setEventsOpen(value => !value)} aria-expanded={eventsOpen}>{t('这一天的活动', 'Events on this day')}<span>{events.length}</span></button></div></div>
    {eventsOpen && <div className="sf-events"><div><strong>{t('旧金山 · 当日活动', 'San Francisco · On this day')}</strong><button onClick={() => setEventsOpen(false)} aria-label={t('收起活动', 'Close events')}><X size={18} /></button></div>{events.length ? events.slice(0, 6).map(event => <Link key={event.id} to={`/events/${event.id}`} target="_blank" rel="noopener noreferrer"><span>{translateText(event.title, locale)}</span><ArrowUpRight size={15} /></Link>) : <p>{t('这一天暂时没有已收录的活动，仍然可以探索城市。', 'No listed events for this date yet. There is still a city to explore.')}</p>}<Link to={`/calendar?date=${date}&region=sf`} target="_blank" rel="noopener noreferrer">{t('打开完整活动日历', 'Open the full event calendar')}<ArrowUpRight size={15} /></Link></div>}
    <div className="sf-map-credit">{freeOnly && <span>{t('免费筛选适用于活动与下方出游建议；城市保持完整。', 'Free admission filters events and outing suggestions; the city stays complete.')} </span>}{t('地理资料：DataSF、SFMTA 等公开来源；距离、坡度与建筑为游戏作适度简化。', 'Geography: DataSF, SFMTA and public sources. Distances, slopes and buildings are simplified for play.')} <a href="https://data.sf.gov/" target="_blank" rel="noopener noreferrer">DataSF ↗</a></div>
  </section>;
}
