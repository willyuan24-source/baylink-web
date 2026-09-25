import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ArrowRight, BookOpen, Check, Compass, Footprints, MapPin, Sparkles, Stamp, Users, X } from 'lucide-react';
import { translateText, type Locale } from '../../i18n/locale';
import { SF_EXPLORATION_ROUTES, SF_EXPLORATION_STOPS, SF_EXPLORATION_STOP_BY_ID, SF_RESIDENTS, sfRouteProgress, type SfExplorationProgress, type SfStoryText } from './sf-exploration';
import SfDiscoveryChallenge from './SfDiscoveryChallenge';

export type SfExplorationTab = 'routes' | 'passport' | 'neighbors' | 'encounter';
export type SfExplorationPanelProps = {
  locale: Locale;
  progress: SfExplorationProgress;
  currentNearId: string | null;
  initialTab?: SfExplorationTab;
  initialResidentId?: string;
  onStartRoute: (routeId: string) => void;
  onCollect: (landmarkId: string, choiceId?: string) => void;
  onTravel: (landmarkId: string) => void;
  onGuide: (landmarkId: string) => void;
  onClose: () => void;
};

const accent = (color: string): CSSProperties => ({ '--sf-story-accent': color } as CSSProperties);

export default function SfExplorationPanel({ locale, progress, currentNearId, initialTab, initialResidentId, onStartRoute, onCollect, onTravel, onGuide, onClose }: SfExplorationPanelProps) {
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const story = (value: SfStoryText) => t(value.zh, value.en);
  const nearStop = currentNearId ? SF_EXPLORATION_STOP_BY_ID[currentNearId] : undefined;
  const [tab, setTab] = useState<SfExplorationTab>(initialTab ?? (nearStop ? 'encounter' : 'routes'));
  const [residentId, setResidentId] = useState(initialResidentId ?? SF_RESIDENTS[0].id);
  const [choice, setChoice] = useState<{ stopId: string; choiceId: string } | null>(null);
  const [memoryId, setMemoryId] = useState<string | null>(null);
  const [solvedChallenge, setSolvedChallenge] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const collected = Object.keys(progress.stamps).length;
  const activeRoute = SF_EXPLORATION_ROUTES.find(route => route.id === progress.activeRouteId);
  const nextStopId = activeRoute ? sfRouteProgress(progress, activeRoute).nextStopId : null;
  const resident = SF_RESIDENTS.find(item => item.id === residentId) ?? SF_RESIDENTS[0];
  const nearStamp = nearStop ? progress.stamps[nearStop.id] : undefined;
  const challengeReady = !nearStop?.challenge || solvedChallenge === nearStop.id;
  const chosen = nearStop?.choices.find(item => item.id === (nearStamp?.choiceId ?? (choice?.stopId === nearStop.id ? choice.choiceId : null)));
  const memoryStop = memoryId ? SF_EXPLORATION_STOP_BY_ID[memoryId] : undefined;
  const memory = memoryStop?.choices.find(item => item.id === progress.stamps[memoryStop.id]?.choiceId);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    close.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    if (solvedChallenge && solvedChallenge === nearStop?.id) panel.current?.querySelector<HTMLButtonElement>('.sf-story-choices button')?.focus();
  }, [solvedChallenge, nearStop?.id]);

  function handleKeys(event: KeyboardEvent<HTMLElement>) {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const elements = [...(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]') ?? [])];
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  return <div className="sf-story-overlay" onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={panel} className="sf-story-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={handleKeys} onKeyUp={event => event.stopPropagation()}>
      <header className="sf-story-header">
        <div><span className="sf-story-eyebrow">BAYBAY’S LITTLE JOURNAL</span><h3 id={titleId}>{t('把旧金山，慢慢收进旅行本', 'A little journal of San Francisco')}</h3></div>
        <button ref={close} className="sf-story-close" type="button" aria-label={t('关闭旅行本', 'Close journal')} onClick={onClose}><X size={20} /></button>
      </header>
      <nav className="sf-story-tabs" aria-label={t('旅行本栏目', 'Journal sections')}>
        {[{ id: 'encounter' as const, label: t('此刻', 'Here'), Icon: Sparkles }, { id: 'routes' as const, label: t('小旅行', 'Trips'), Icon: Compass }, { id: 'passport' as const, label: `${t('旅行章', 'Stamps')} ${collected}`, Icon: Stamp }, { id: 'neighbors' as const, label: t('邻居', 'Neighbors'), Icon: Users }].map(({ id, label, Icon }) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}><Icon size={16} /><span>{label}</span></button>)}
      </nav>
      <div className="sf-story-body">
        {tab === 'encounter' && <div className="sf-story-encounter">
          {nearStop ? <>
            <div className="sf-story-place-line"><MapPin size={14} />{story(nearStop.name)}<span>{t('迷你世界', 'Miniature world')}</span></div>
            <div className={`sf-story-emblem ${nearStamp ? 'is-collected' : ''}`} style={accent(nearStop.color)} aria-hidden="true">{nearStop.symbol}</div>
            <h4>{nearStamp ? story(nearStop.stamp) : t('在这里，留下一段小回忆', 'Make a little memory here')}</h4>
            <p>{nearStamp && chosen ? story(chosen.memory) : story(nearStop.prompt)}</p>
            {!nearStamp && nearStop.challenge && <SfDiscoveryChallenge key={nearStop.id} kind={nearStop.challenge} locale={locale} completed={challengeReady} onSolve={() => setSolvedChallenge(nearStop.id)} />}
            {!nearStamp && challengeReady && <div className="sf-story-choices">{nearStop.choices.map(item => <button key={item.id} type="button" aria-pressed={chosen?.id === item.id} onClick={() => setChoice({ stopId: nearStop.id, choiceId: item.id })}>{story(item.label)}{chosen?.id === item.id ? <Check size={17} /> : <ArrowRight size={17} />}</button>)}</div>}
            {!nearStamp && chosen && <p className="sf-story-reveal" role="status">{story(chosen.memory)}</p>}
          </> : <div className="sf-story-empty"><Footprints size={32} /><h4>{t('小回忆，藏在下一站', 'Your next memory is waiting')}</h4><p>{t('让 BAYBAY 走到景点附近，就能开启一段小互动。先选一条小旅行也可以。', 'Walk BAYBAY up to a landmark to discover a little interaction, or choose a trip to get started.')}</p><button className="sf-story-primary" type="button" onClick={() => setTab('routes')}>{t('看看小旅行', 'Find a little trip')}<ArrowRight size={16} /></button></div>}
        </div>}

        {tab === 'routes' && <div className="sf-story-routes">
          <p className="sf-story-intro">{t('在游戏里用几分钟探索；喜欢的地方，再打开攻略安排真实出行。', 'Take a few minutes to explore in the game. Open a guide when a place inspires a real day out.')}</p>
          {SF_EXPLORATION_ROUTES.map(route => {
            const state = sfRouteProgress(progress, route);
            return <article className="sf-story-route" key={route.id} style={accent(route.color)}>
              <div className="sf-story-route-top"><span>{story(route.duration)}</span><span>{state.completed === state.total ? <><Check size={13} />{t('已完成', 'Complete')}</> : `${state.completed} / ${state.total}`}</span></div>
              <h4>{story(route.title)}</h4><p>{story(route.description)}</p>
              <ol className="sf-story-route-stops">{route.stopIds.map((id, index) => <li key={id}><span className={progress.stamps[id] ? 'is-collected' : ''}>{progress.stamps[id] ? <Check size={12} /> : index + 1}</span>{story(SF_EXPLORATION_STOP_BY_ID[id].name)}</li>)}</ol>
              <button type="button" onClick={() => { onStartRoute(route.id); onTravel(state.nextStopId ?? route.stopIds[0]); }}>{state.completed === state.total ? t('再逛一次', 'Visit again') : progress.activeRouteId === route.id ? t('继续这趟旅行', 'Continue this trip') : t('开始这趟旅行', 'Start this trip')}<ArrowRight size={17} /></button>
            </article>;
          })}
        </div>}

        {tab === 'passport' && <div className="sf-story-passport">
          <div className="sf-story-passport-summary"><div><span>{t('BAYBAY 与你的旅行章', 'Your BAYBAY stamp collection')}</span><strong>{collected}<small> / {SF_EXPLORATION_STOPS.length}</small></strong></div><Stamp size={34} /></div>
          <p className="sf-story-intro">{t('每枚章都是一次迷你世界里的相遇。点击已收藏的章，可以重读你留下的小回忆。', 'Each stamp remembers a moment in the miniature world. Select a collected stamp to read your memory again.')}</p>
          {memoryStop && memory && <div className="sf-story-memory" role="status" style={accent(memoryStop.color)}><span aria-hidden="true">{memoryStop.symbol}</span><div><strong>{story(memoryStop.stamp)}</strong><p>{story(memory.memory)}</p></div><button type="button" aria-label={t('收起这段回忆', 'Close this memory')} onClick={() => { setMemoryId(null); panel.current?.querySelector<HTMLButtonElement>(`[data-stamp-id="${memoryId}"]`)?.focus(); }}><X size={16} /></button></div>}
          <div className="sf-story-stamp-grid">{SF_EXPLORATION_STOPS.map(stop => <button type="button" className={progress.stamps[stop.id] ? 'is-collected' : ''} key={stop.id} data-stamp-id={stop.id} style={accent(stop.color)} onClick={() => { if (progress.stamps[stop.id]) setMemoryId(stop.id); else onTravel(stop.id); }} aria-label={`${story(stop.name)} · ${progress.stamps[stop.id] ? t('重读回忆', 'Read memory') : t('前往探索', 'Go explore')}`}><span aria-hidden="true">{stop.symbol}</span><strong>{story(stop.stamp)}</strong><small>{story(stop.name)}</small><em>{progress.stamps[stop.id] ? t('已收藏', 'Collected') : t('去发现', 'Discover')}</em></button>)}</div>
        </div>}

        {tab === 'neighbors' && <div className="sf-story-neighbors">
          <p className="sf-story-intro">{t('三位 BAYLINK 预设小镇居民，分享各自喜欢的小路线。', 'Meet three authored BAYLINK town residents and their favorite little routes.')}</p>
          <div className="sf-story-resident-picker">{SF_RESIDENTS.map(item => <button type="button" key={item.id} style={accent(item.color)} aria-label={`${item.name} ${story(item.role)}`} aria-pressed={item.id === resident.id} onClick={() => setResidentId(item.id)}><span aria-hidden="true">{item.symbol}</span><strong>{item.name}</strong><small>{story(item.role)}</small></button>)}</div>
          <article className="sf-story-resident" style={accent(resident.color)}><div className="sf-story-resident-name"><h4>{resident.name}</h4><span>{t('预设角色', 'Authored character')}</span></div><p className="sf-story-resident-speech">{story(resident.greeting)}</p><h5>{t('我的散步推荐', 'My little recommendations')}</h5><div className="sf-story-recommendations">{resident.recommendationIds.map(id => <div key={id}><button type="button" onClick={() => onTravel(id)}><MapPin size={15} /><span>{story(SF_EXPLORATION_STOP_BY_ID[id].name)}</span><ArrowRight size={16} /></button><button type="button" aria-label={`${t('查看攻略', 'Read guide')}: ${story(SF_EXPLORATION_STOP_BY_ID[id].name)}`} onClick={() => onGuide(id)}><BookOpen size={16} /></button></div>)}</div></article>
        </div>}
      </div>
      {tab === 'encounter' && nearStop && <div className="sf-story-encounter-actions">
        {nearStamp ? <span className="sf-story-saved" role="status"><Check size={16} />{t('已收藏到旅行本', 'Saved to your journal')}</span> : <button className="sf-story-primary" type="button" disabled={!chosen || !challengeReady} onClick={() => { if (chosen && challengeReady) { onCollect(nearStop.id, chosen.id); close.current?.focus(); } }}><Stamp size={17} />{t('收下这枚虚拟旅行章', 'Keep this virtual stamp')}</button>}
        {nearStamp && nextStopId && <button className="sf-story-primary" type="button" onClick={() => onTravel(nextStopId)}>{t('继续下一站', 'Go to the next stop')}<ArrowRight size={17} /></button>}
        {nearStamp && activeRoute && !nextStopId && <div className="sf-story-route-finished"><Sparkles size={17} />{t('这条小旅行已完成！', 'This little trip is complete!')}<button type="button" onClick={() => setTab('routes')}>{t('选下一条路线', 'Choose another trip')}</button></div>}
        <button className="sf-story-text-action" type="button" onClick={() => onGuide(nearStop.id)}><BookOpen size={16} />{t('查看真实地点攻略', 'Explore the real place')}</button>
      </div>}
      <footer className="sf-story-footer">{t('虚拟旅行章保存在此浏览器，不代表现实到访或实物奖品。', 'Virtual stamps stay in this browser. They do not record real visits or unlock physical prizes.')}</footer>
    </section>
  </div>;
}
