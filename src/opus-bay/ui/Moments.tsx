import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Aperture, Check, Download, HandHeart, Images, Mail, Sparkles, X } from 'lucide-react';
import { runtime } from '../core/runtime';
import { DEFAULT_TOUR_ID, tourIdOf, useGame } from '../core/store';
import { DISTRICT } from '../data/district';
import { sourceDomain } from '../data/links';
import { activePostcardCount, activePostcardTotal } from '../data/postcards';
import { goalProgress } from '../data/sf/goals';
import { RESIDENTS, tasksDone, tasksOpen } from '../data/sf/residents';
import { FREE_GOALS } from '../data/script';
import {
  FISH_CATCHES, closeFishing, closePostcardReward, exitPhotoMode, notePhotoTaken, reel, retryFishing,
} from '../game/flow';
import { flow, useFlow } from '../game/flowStore';
import { postcardById } from '../game/interactables';
import { downloadUrl, requestShutter } from '../game/photo';
import { SF_NAME, zoneName } from '../data/cityZones';
import { cityDistrictZh } from '../data/sf/cityPois';
import { closeOverlay, openOverlay, openOverlays } from './slots';
import { registerAnchor } from '../game/projector';
import { useT } from '../i18n';
import { BaybayFace, Keycap } from './common';
import { useDevice, useImageState, useWindowKey } from './hooks';
import { postcardArt } from './format';
import './content-ui.css';

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
  // only the active world's cards count (G2-3)
  const total = activePostcardTotal();
  const count = useGame(s => activePostcardCount(s.postcards));
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
            {card.sourceUrl && <a className="ob-postcard-src" href={card.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}><span>{t('资料来源', 'Source')} · {sourceDomain(card.sourceUrl)}</span></a>}
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

/** game/album.ts ALBUM_ID (the album's overlay, city mode; not imported: the album stays in its lazy chunk) */
const ALBUM_OVERLAY = 'c-album';

export function PhotoMode() {
  const { t, locale } = useT();
  const device = useDevice();
  const flash = useFlow(s => s.photoFlash);
  const last = useFlow(s => s.lastPhoto);
  const area = useGame(s => s.area);
  const city = useGame(s => s.worldMode === 'city');
  const [flashing, setFlashing] = useState(false);
  // (the city: its neighbourhood name, or the waterfront zone in the city's words — W5-C7; the district as before)
  const districtZone = DISTRICT.zones.find(item => item.id === area)?.name;
  const cityZone = city ? zoneName(area) : null;
  const cityName = cityZone && cityZone !== SF_NAME ? cityZone : districtZone ?? SF_NAME;
  const zone = city ? { zh: cityDistrictZh(cityName.zh), en: cityName.en } : districtZone ?? DISTRICT.name;
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
    // (the album open over photo mode: Escape closes the album, not photo mode; its other keys are its own)
    if (openOverlays().some(o => o.id === ALBUM_OVERLAY)) { if (e.code === 'Escape') { e.preventDefault(); closeOverlay(ALBUM_OVERLAY); } return; }
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
        {last?.album ? (
          <button type="button" className="ob-photo-thumb" onClick={() => openOverlay(ALBUM_OVERLAY, { photo: last.name })} aria-label={t('看看相册', 'Open the album')} style={{ backgroundImage: `url(${last.url})` }}><Images size={16} aria-hidden /></button>
        ) : last ? (
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
  const city = useGame(s => s.worldMode === 'city');
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
        {FREE_GOALS.map(goal => { const progress = goalProgress(goal.id, done); return <li key={goal.id} className={done.includes(goal.id) ? 'is-done' : ''}><span className="ob-check">{done.includes(goal.id) && <Check size={12} aria-hidden />}</span><span>{t(goal.label)}{progress && ` · ${progress}`}<small>{t(goal.hint)}</small></span></li>; })}
      </ul>
      {city && <FavoursMini done={done} />}
    </aside>
  );
}

/** 邻居的小忙 in the goals card (city, plan G2-11): the count and the favours you said yes to (two at most). */
function FavoursMini({ done }: { done: readonly string[] }) {
  const { t } = useT();
  const open = tasksOpen(done);
  const count = tasksDone(done);
  return (
    <>
      <header style={{ marginTop: 8 }}><strong><HandHeart size={16} aria-hidden />{t('邻居的小忙', 'Neighbour favours')} · {count}/{RESIDENTS.length}</strong></header>
      <ul>
        {open.slice(0, 2).map(r => <li key={r.key}><span className="ob-check" /><span>{t(r.task.title)}<small>{t(r.task.hint)}</small></span></li>)}
        {!open.length && count < RESIDENTS.length && <li><span className="ob-check" /><span>{t('城里有六位邻居，各有一件小事想请你帮忙', 'Six neighbours around the city each have a small favour to ask')}<small>{t('旅行本 · 目标里有他们在哪', 'Your journal’s Goals tab says where they are')}</small></span></li>}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tour recap
// ---------------------------------------------------------------------------

/** Wave 4 · lane C: the Grand Tour's recap (lazy with the tour data; ui/CityTourRecap.tsx → ui/TourRecap.tsx). */
const CityTourRecap = lazy(() => import('./CityTourRecap'));
/** The first lesson's recap, lazy too (it opens once, at the end of the tour). */
const DistrictRecap = lazy(() => import('./DistrictRecap'));

/** The recap panel: the first lesson's, or a city tour's when `game.tour` holds one (tour.id). */
export function Recap() {
  const city = useGame(s => tourIdOf(s.tour) !== DEFAULT_TOUR_ID);
  return <Suspense fallback={null}>{city ? <CityTourRecap /> : <DistrictRecap />}</Suspense>;
}

