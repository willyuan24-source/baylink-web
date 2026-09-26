import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Aperture, ArrowRight, BookOpen, CalendarPlus, Check, Download, Footprints, Heart, Mail, Route, Sparkles, X } from 'lucide-react';
import { runtime } from '../core/runtime';
import { useGame } from '../core/store';
import { DISTRICT } from '../data/district';
import { eventById, guideTitle, placeById, useCatalog } from '../data/catalog';
import { guideUrl, planStopTitles, planUrl, sourceDomain, validPlanStops, walkingRouteUrl, type PlanStop } from '../data/links';
import { POSTCARDS } from '../data/postcards';
import { FREE_GOALS } from '../data/script';
import {
  FISH_CATCHES, closeFishing, closePanel, closePostcardReward, exitPhotoMode, notePhotoTaken, reel, retryFishing, startWeek, tourStops,
} from '../game/flow';
import { flow, useFlow } from '../game/flowStore';
import { poiById, postcardById } from '../game/interactables';
import { downloadUrl, requestShutter } from '../game/photo';
import { registerAnchor } from '../game/projector';
import { useT } from '../i18n';
import { BaybayFace, Keycap, LinkButton } from './common';
import { useDevice, useImageState, useWindowKey } from './hooks';
import { postcardArt } from './format';

// ---------------------------------------------------------------------------
// Fishing mini game (3 s bobber)
// ---------------------------------------------------------------------------

/**
 * F13: fishing happens in the world (you face the water, the camera looks over your shoulder, the bite splashes
 * where the line is and a "!" pops over your head); this is only a slim prompt strip at the bottom.
 */
export function FishGame() {
  const { t } = useT();
  const fishing = useFlow(s => s.fishing);
  const device = useDevice();
  const alertRef = useCallback((el: HTMLDivElement | null) => registerAnchor('alert', el), []);
  const stage = fishing?.stage;
  const alert = <div ref={alertRef} className="ob-fish-alert" data-show={stage === 'bite' ? '1' : '0'} aria-hidden>!</div>;
  if (!fishing || !stage) return alert;
  const fish = FISH_CATCHES[fishing.catchIndex] ?? FISH_CATCHES[0];
  return (
    <>
    {alert}
    <div className={`ob-fish is-strip stage-${stage}`} role="dialog" aria-live="assertive" aria-label={t('钓鱼', 'Fishing')}>
      <span className="ob-fish-bob" aria-hidden><i /></span>
      <div className="ob-fish-text">
        {stage === 'cast' && <p>{t('甩竿……', 'Casting…')}</p>}
        {stage === 'wait' && <p>{t('盯住浮漂，等它往下沉', 'Watch the bobber… wait for it to dip')}</p>}
        {stage === 'bite' && <p className="is-bite">{t('咬钩了！快收线！', 'Bite! Reel in now!')}</p>}
        {stage === 'caught' && (
          <div className="ob-fish-catch">
            <strong>{t('钓到了：', 'You caught: ')}{t(fish.name)}</strong>
            <p>{t(fish.fact)}</p>
            <small>{t('（小游戏里的鱼，已经放回海里啦）', '(A game fish — released back into the Bay.)')}</small>
          </div>
        )}
        {stage === 'missed' && <p>{t('哎呀，跑掉了！', 'Oops — it got away!')}</p>}
      </div>
      <div className="ob-fish-actions">
        {(stage === 'wait' || stage === 'bite' || stage === 'cast') && (
          <button type="button" className={`ob-btn ${stage === 'bite' ? 'ob-btn-gold' : 'ob-btn-soft'}`} onClick={reel}>
            {device === 'keyboard' && <Keycap>E</Keycap>}<span>{t('收线', 'Reel in')}</span>
          </button>
        )}
        {stage === 'missed' && <button type="button" className="ob-btn ob-btn-primary" onClick={retryFishing}>{t('再来一次', 'Try again')}</button>}
        {(stage === 'caught' || stage === 'missed') && <button type="button" className="ob-btn ob-btn-ghost" onClick={closeFishing}>{stage === 'caught' ? t('好耶', 'Nice') : t('不钓了', 'Stop')}</button>}
      </div>
    </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Postcard reward (card flip) — also used to view a collected card from the journal
// ---------------------------------------------------------------------------

export function PostcardReward() {
  const { t } = useT();
  const id = useFlow(s => s.postcardReward);
  const fresh = useFlow(s => s.rewardFresh);
  const total = POSTCARDS.length;
  const count = useGame(s => s.postcards.length);
  const reduced = useGame(s => s.settings.reducedMotion);
  const [flipped, setFlipped] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setFlipped(false);
    if (!id) return;
    const timer = window.setTimeout(() => setFlipped(true), reduced ? 50 : 1100);
    closeRef.current?.focus({ preventScroll: true });
    return () => window.clearTimeout(timer);
  }, [id, reduced]);
  const card = postcardById(id);
  const art = card ? postcardArt(card.id) : undefined;
  const ok = useImageState(art?.src) !== 'error' && !!art;
  if (!id || !card) return null;
  return (
    <div className="ob-reward" role="dialog" aria-modal="true" aria-label={t(card.title)} onClick={e => { if (e.target === e.currentTarget) closePostcardReward(); }}>
      {fresh && <div className="ob-burst" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</div>}
      <p className="ob-reward-kicker"><Sparkles size={16} aria-hidden />{fresh ? t(`新明信片！${count}/${total}`, `New postcard! ${count}/${total}`) : t(`明信片 ${count}/${total}`, `Postcard ${count}/${total}`)}</p>
      <button type="button" className={`ob-postcard ${flipped ? 'is-flipped' : ''}`} onClick={() => setFlipped(f => !f)} aria-label={t('翻面', 'Flip card')}>
        <span className="ob-postcard-face front">
          {ok && art ? <img className="ob-postcard-img" src={art.src} srcSet={art.srcSet} sizes="(max-width: 720px) 86vw, 460px" alt="" draggable={false} decoding="async" />
            : <span className="ob-postcard-art"><Mail size={40} aria-hidden /><em>{card.title.en}</em></span>}
          <span className="ob-postcard-caption">{t(card.title)}</span>
        </span>
        <span className="ob-postcard-face back">
          <span className="ob-postcard-message">
            <strong>{t(card.title)}</strong>
            <span className="ob-postcard-fact">{t(card.fact)}</span>
            {card.sourceUrl && <a href={card.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{t('资料来源', 'Source')} · {sourceDomain(card.sourceUrl)}</a>}
          </span>
          <span className="ob-postcard-address" aria-hidden>
            <span className="ob-postcard-stamp"><BaybayFace mood="proud" size={48} /></span>
            <span className="ob-postcard-postmark">SAN FRANCISCO · CA</span>
            <span className="ob-postcard-lines"><i /><i /><i /></span>
          </span>
        </span>
      </button>
      <div className="ob-actions is-center">
        <button ref={closeRef} type="button" className="ob-btn ob-btn-gold" onClick={closePostcardReward}><Check size={18} aria-hidden /><span>{fresh ? t('收进旅行本', 'Keep it') : t('好的', 'Done')}</span></button>
      </div>
      <p className="ob-reward-note">{t('明信片是游戏里的收藏品，背面的小知识是真的。', 'Postcards are game collectibles — the facts on the back are real.')}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Photo mode
// ---------------------------------------------------------------------------

export function PhotoMode() {
  const { t, locale } = useT();
  const device = useDevice();
  const flash = useFlow(s => s.photoFlash);
  const last = useFlow(s => s.lastPhoto);
  const area = useGame(s => s.area);
  const [flashing, setFlashing] = useState(false);
  const zone = DISTRICT.zones.find(item => item.id === area)?.name ?? DISTRICT.name;
  const shoot = () => {
    const date = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'short', day: 'numeric' }).format(new Date());
    requestShutter(`${t('湾区小旅', 'Little Bay Trip')} · ${t(zone)} · ${date}`, 'BAYLINK');
    window.setTimeout(notePhotoTaken, 200);
  };
  useEffect(() => {
    if (!flash) return;
    setFlashing(true);
    const id = window.setTimeout(() => setFlashing(false), 260);
    return () => window.clearTimeout(id);
  }, [flash]);
  useWindowKey(e => {
    if (e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); exitPhotoMode(); }
    else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') { if ((e.target as HTMLElement)?.tagName === 'BUTTON') return; e.preventDefault(); shoot(); }
  });
  return (
    <div className="ob-photo">
      <div className="ob-photo-frame" aria-hidden><i className="c tl" /><i className="c tr" /><i className="c bl" /><i className="c br" /><i className="g v1" /><i className="g v2" /><i className="g h1" /><i className="g h2" /></div>
      {flashing && <div className="ob-photo-flash" aria-hidden />}
      <p className="ob-photo-hint">{device === 'touch' ? t('双指旋转缩放取景', 'Two fingers to turn & zoom') : t('右键拖动转视角 · 滚轮缩放 · 空格拍照', 'Right-drag to turn · wheel to zoom · Space to shoot')}</p>
      <div className="ob-photo-bar">
        <button type="button" className="ob-icon-btn ob-photo-exit" onClick={exitPhotoMode} aria-label={t('退出拍照', 'Exit photo mode')}><X size={22} aria-hidden /></button>
        <button type="button" className="ob-shutter" onClick={shoot} aria-label={t('拍照', 'Take photo')}><Aperture size={30} aria-hidden /></button>
        {last ? (
          <button type="button" className="ob-photo-thumb" onClick={() => downloadUrl(last.url, last.name)} aria-label={t('再次保存照片', 'Save photo again')} style={{ backgroundImage: `url(${last.url})` }}><Download size={16} aria-hidden /></button>
        ) : <span className="ob-photo-thumb is-empty" aria-hidden />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Free-roam goals card (once, dismissible)
// ---------------------------------------------------------------------------

/**
 * Overlay queue (F2): at most one text overlay besides the pill — BAYBAY's bubble first, then this card, then the
 * coach mark. The card waits while a bubble is up, then folds back into the pill after 6 s on screen or at the
 * first step; tapping the pill brings it back.
 */
export function GoalsCard() {
  const { t } = useT();
  const open = useFlow(s => s.goalsCard);
  const bubbleUp = useFlow(s => !!s.bubble);
  const done = useGame(s => s.goalsDone);
  const dialogue = useGame(s => s.dialogue.nodeId);
  const panel = useGame(s => s.panel.kind);
  const visible = open && !dialogue && !panel && !bubbleUp;
  useEffect(() => {
    if (!visible) return;
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const moved = runtime.player.moving && runtime.player.speed > 0.8;
      if (moved || performance.now() - t0 > 6000) flow.set({ goalsCard: false });
    }, 200);
    return () => window.clearInterval(id);
  }, [visible]);
  if (!visible) return null;
  return (
    <aside className="ob-goals-card" aria-label={t('探索目标', 'Explorer goals')}>
      <header>
        <strong><Sparkles size={16} aria-hidden />{t('随便逛，顺便完成这些', 'Wander — and maybe do these')}</strong>
        <button type="button" className="ob-icon-btn ob-icon-sm" onClick={() => flow.set({ goalsCard: false })} aria-label={t('收起', 'Dismiss')}><X size={16} aria-hidden /></button>
      </header>
      <ul>
        {FREE_GOALS.map(goal => <li key={goal.id} className={done.includes(goal.id) ? 'is-done' : ''}><span className="ob-check">{done.includes(goal.id) && <Check size={12} aria-hidden />}</span><span>{t(goal.label)}<small>{t(goal.hint)}</small></span></li>)}
      </ul>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Tour recap
// ---------------------------------------------------------------------------

/** Tour stop → the BAYLINK guide that continues it in real life (shown only when the catalog lists the slug). */
const RECAP_GUIDES: Record<string, string> = {
  'sea-lions': 'sf-fishermans-wharf-pier39-guide',
  'coit-tower': 'sf-chinatown-north-beach-walk-guide',
};

export function Recap() {
  const { t, locale } = useT();
  const catalog = useCatalog();
  const completed = useGame(s => s.tour.completed);
  const postcards = useGame(s => s.postcards.length);
  const wishes = useGame(s => s.wishlist);
  const goals = useGame(s => FREE_GOALS.filter(goal => s.goalsDone.includes(goal.id)).length);
  const stops = tourStops();
  const planStops: PlanStop[] = [
    ...wishes.filter(item => item.kind === 'event').map(item => ({ kind: 'event' as const, id: item.id })),
    ...wishes.flatMap(item => (item.kind === 'place' ? [{ kind: 'place' as const, id: item.id }] : item.kind === 'poi' && poiById(item.id)?.plannerPlaceId ? [{ kind: 'place' as const, id: poiById(item.id)!.plannerPlaceId! }] : [])),
    ...completed.flatMap(id => { const place = poiById(id)?.plannerPlaceId; return place ? [{ kind: 'place' as const, id: place }] : []; }),
  ];
  const all = completed.length >= stops.length && stops.length > 0;
  // 1) a real walking route through the stops you finished, 2) the plan link named by what it carries,
  // 3) matching BAYLINK guides (only slugs the published catalog lists)
  const donePois = stops.filter(stop => completed.includes(stop.poiId)).map(stop => poiById(stop.poiId)).filter((poi): poi is NonNullable<typeof poi> => !!poi?.realInfo);
  const route = walkingRouteUrl(donePois.map(poi => ({ lat: poi.realInfo!.lat, lng: poi.realInfo!.lng })));
  const carried = validPlanStops(planStops, catalog);
  const names = planStopTitles(carried, catalog);
  const planLabel = names.length ? t(`把 ${names.join('、')} 排进 BAYLINK 计划`, `Put ${names.join(', ')} in a BAYLINK plan`) : null;
  const guideSlugs = [...new Set(donePois.map(poi => RECAP_GUIDES[poi.id]).filter((slug): slug is string => !!slug && !!guideTitle(catalog, slug)))];
  return (
    <div className="ob-recap-wrap" role="dialog" aria-modal="true" aria-labelledby="ob-recap-title">
      <div className="ob-recap">
        <button type="button" className="ob-icon-btn ob-recap-close" onClick={closePanel} aria-label={t('关闭', 'Close')}><X size={20} aria-hidden /></button>
        <div className="ob-recap-stamp" aria-hidden><BaybayFace mood="proud" size={84} /><span>{all ? t('结业', 'GRADUATE') : t('打卡', 'VISITED')}</span></div>
        <h2 id="ob-recap-title">{all ? t('湾区第一课 · 完成！', 'Bay 101 · complete!') : t('今天的湾区小结', 'Today’s Bay recap')}</h2>
        <p className="ob-muted">{t('你已经认识了海滨最值得去的几站。下次来真的湾区，照着走就行。', 'You’ve met the waterfront’s best stops. Next time you’re here for real, just follow this.')}</p>
        <ol className="ob-recap-stops">
          {stops.map((stop, i) => {
            const poi = poiById(stop.poiId);
            const ok = completed.includes(stop.poiId);
            return <li key={stop.poiId} className={ok ? 'is-done' : ''}><span>{ok ? <Check size={13} aria-hidden /> : i + 1}</span>{poi ? t(poi.name) : stop.poiId}</li>;
          })}
        </ol>
        <div className="ob-recap-stats">
          <span><Route size={16} aria-hidden />{completed.length}/{stops.length} {t('站', 'stops')}</span>
          <span><Mail size={16} aria-hidden />{postcards}/{POSTCARDS.length} {t('明信片', 'postcards')}</span>
          <span><Heart size={16} aria-hidden />{wishes.length} {t('想去', 'saved')}</span>
          <span><Sparkles size={16} aria-hidden />{goals}/{FREE_GOALS.length} {t('目标', 'goals')}</span>
        </div>
        {wishes.length > 0 && (
          <div className="ob-recap-wishes">
            <strong><Heart size={15} aria-hidden />{t('旅行本 · 想去', 'Journal · saved')}</strong>
            <ul>
              {wishes.slice(0, 5).map(item => {
                const poi = item.kind === 'poi' ? poiById(item.id) : undefined;
                const title = poi ? t(poi.name) : item.kind === 'event' ? eventById(catalog, item.id)?.title ?? item.title : placeById(catalog, item.id)?.title ?? item.title;
                return <li key={`${item.kind}:${item.id}`}>{title}</li>;
              })}
              {wishes.length > 5 && <li className="is-more">+{wishes.length - 5}</li>}
            </ul>
          </div>
        )}
        <div className="ob-actions is-center is-stack">
          {route && <LinkButton href={route} tone="primary" external icon={<Footprints size={18} aria-hidden />}>{t(`Google 地图步行路线（${donePois.length} 站）`, `Walking route in Google Maps (${donePois.length} stops)`)}</LinkButton>}
          {planLabel && <LinkButton href={planUrl({ stops: carried }, catalog, locale)} tone={route ? 'soft' : 'primary'} icon={<CalendarPlus size={18} aria-hidden />}>{planLabel}</LinkButton>}
          {guideSlugs.map(slug => <LinkButton key={slug} href={guideUrl(slug, locale)} tone="ghost" icon={<BookOpen size={17} aria-hidden />}>{t('BAYLINK 攻略', 'BAYLINK guide')} · {guideTitle(catalog, slug)}</LinkButton>)}
          <button type="button" className="ob-btn ob-btn-soft" onClick={() => { closePanel(); startWeek(); }}><Sparkles size={17} aria-hidden /><span>{t('看看这周有什么活动', 'See what’s on this week')}</span></button>
          <button type="button" className="ob-btn ob-btn-ghost" onClick={closePanel}><span>{t('继续自由逛', 'Keep exploring')}</span><ArrowRight size={17} aria-hidden /></button>
        </div>
      </div>
    </div>
  );
}
