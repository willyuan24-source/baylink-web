import { useEffect, useRef, useState } from 'react';
import { Armchair, Bike, Bird, BookOpen, Camera, CarFront, ChevronRight, Ellipsis, Map as MapIcon, MapPin, Route, Settings, Sparkles, TramFront } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { input } from '../core/input';
import { useGame } from '../core/store';
import type { InteractionKind } from '../core/types';
import { DISTRICT } from '../data/district';
import { POSTCARDS } from '../data/postcards';
import { FREE_GOALS } from '../data/script';
import { callBaybay, cancelRide, currentStop, enterPhotoMode, finishRide, hopOffRide, openBoard, openPanel, requestInteract, tourStops } from '../game/flow';
import { AREA_NAMES } from '../game/brain';
import { flow, useFlow } from '../game/flowStore';
import { BAYBAY_ID, interactableById } from '../game/interactables';
import { readQa } from '../game/qa';
import { useT } from '../i18n';
import { BaybayFace, Keycap } from './common';
import { useDevice, useMedia } from './hooks';
import { InteractIcon } from './icons';

/** Always-on HUD: area name, one objective pill, round buttons (one bottom bar on phones), one contextual action. */
export function Hud() {
  const narrow = useMedia('(max-width: 600px)');
  return (
    <div className={`ob-hud ${narrow ? 'is-narrow' : ''}`}>
      <AreaLabel />
      <Objective />
      {narrow ? <PhoneBar /> : <HudButtons />}
      <ContextAction />
      <RideBanner />
      <MoveChip />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Movement mode chip (lane E): which mode you are in + its keys, and the glide button once it is unlocked.
// Keyboard / gamepad only — touch gets big buttons in actors/TouchControls. Clicking a hint does what the key does.
// ---------------------------------------------------------------------------

const chipStyle: CSSProperties = {
  position: 'absolute', left: '50%', bottom: 'calc(26px + var(--ob-sb))', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10,
  minHeight: 48, padding: '0 8px 0 14px', borderRadius: 999, color: '#fff', background: 'rgba(28, 44, 41, .86)', border: '1px solid rgba(255,255,255,.14)',
  boxShadow: '0 14px 30px -12px rgba(20, 30, 28, .6)', whiteSpace: 'nowrap', maxWidth: 'calc(100% - 40px)', pointerEvents: 'auto',
};
const hintStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 10px', borderRadius: 999, border: 0, background: 'rgba(255,255,255,.1)',
  color: '#fff', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
const glideStyle: CSSProperties = {
  position: 'absolute', left: 'calc(18px + var(--ob-sl))', bottom: 'calc(26px + var(--ob-sb))', display: 'flex', alignItems: 'center', gap: 8, minHeight: 44,
  padding: '0 14px 0 8px', borderRadius: 999, border: '1px solid var(--ob-line)', background: 'rgba(255, 250, 241, .95)', color: 'var(--ob-ink)',
  boxShadow: 'var(--ob-shadow-s)', font: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', pointerEvents: 'auto',
};

function Hint({ k, label, onPress }: { k: string; label: string; onPress?: () => void }) {
  const body = <><Keycap className="ob-context-key">{k}</Keycap><span>{label}</span></>;
  return onPress
    ? <button type="button" style={hintStyle} onClick={onPress}>{body}</button>
    : <span style={{ ...hintStyle, cursor: 'default', background: 'transparent', padding: '0 4px' }}>{body}</span>;
}

function MoveChip() {
  const { t } = useT();
  const mode = useGame(s => s.move.mode);
  const spot = useGame(s => s.move.spot);
  const unlocked = useGame(s => s.viewpointUnlocked) || readQa().debug;
  const dialogue = useGame(s => s.dialogue.nodeId);
  const focus = useGame(s => s.focus);
  const device = useDevice();
  if (device === 'touch' || dialogue) return null;
  const pad = device === 'gamepad';
  const exit = () => { input.vehicleCount++; };
  const glide = () => { input.glideCount++; };
  const horn = () => { input.hornCount++; };
  const chip = (icon: ReactNode, name: string, hints: ReactNode) => (
    <div style={chipStyle} role="status" aria-live="polite">
      {icon}<strong style={{ fontSize: 14.5 }}>{name}</strong>{hints}
    </div>
  );
  if (mode === 'bike' || mode === 'car') {
    const bike = mode === 'bike';
    return chip(bike ? <Bike size={20} aria-hidden /> : <CarFront size={20} aria-hidden />, bike ? t('骑车中', 'Riding') : t('开小车', 'Driving'), <>
      <Hint k={pad ? 'Y' : 'F'} label={t('下车', 'Get off')} onPress={exit} />
      <Hint k={pad ? 'LB' : 'H'} label={bike ? t('按铃', 'Bell') : t('喇叭', 'Horn')} onPress={horn} />
      {!pad && <Hint k="Space" label={t('跳一下', 'Hop')} />}
      {!pad && !bike && <Hint k="R" label={t('回到路上', 'Back on the road')} />}
      {!pad && bike && <Hint k="Shift" label={t('冲刺', 'Sprint')} />}
    </>);
  }
  if (mode === 'glide') {
    return chip(<Bird size={20} aria-hidden />, t('鹈鹕滑翔', 'Pelican glide'), <>
      {!pad && <Hint k="W/S" label={t('升降', 'Climb / dive')} />}
      <Hint k={pad ? 'RB' : 'Shift'} label={t('加速', 'Faster')} />
      <Hint k={pad ? 'L3' : 'G'} label={t('降落', 'Land')} onPress={glide} />
    </>);
  }
  if (mode === 'sit') return chip(<Armchair size={20} aria-hidden />, t('坐着歇会儿', 'Taking a seat'), <Hint k={pad ? '←→' : 'E'} label={t('起身', 'Stand up')} onPress={() => { input.interactCount++; }} />);
  if (mode === 'transit') {
    return chip(<TramFront size={20} aria-hidden />, t('车厢里', 'On board'), <>
      <Hint k={pad ? 'A' : 'E'} label={spot === 'seat' ? t('站起来', 'Stand') : t('坐下', 'Sit down')} onPress={() => { input.interactCount++; }} />
      {!pad && <Hint k="WASD" label={t('车厢里走走', 'Walk the aisle')} />}
      <Hint k={pad ? 'B' : 'Space'} label={t('下车', 'Hop off')} />
    </>);
  }
  // on foot: the glide is ready (never over a context prompt)
  if (mode === 'foot' && unlocked && !focus) {
    return (
      <button type="button" style={glideStyle} onClick={glide} aria-label={t('鹈鹕滑翔（G）', 'Pelican glide (G)')}>
        <Keycap className="ob-context-key">{pad ? 'L3' : 'G'}</Keycap><Bird size={18} aria-hidden />{t('起飞', 'Take off')}
      </button>
    );
  }
  return null;
}

const SF_NAME = { zh: '旧金山', en: 'San Francisco' };

function AreaLabel() {
  const { t, locale } = useT();
  const area = useGame(s => s.area);
  const city = useGame(s => s.worldMode === 'city');
  const zone = DISTRICT.zones?.find(item => item.id === area);
  // city mode: a DataSF neighbourhood (game/brain AREA_NAMES), else the whole city, never "The Embarcadero" out there
  const name = zone?.name ?? (area ? AREA_NAMES.get(area) : undefined) ?? (city ? SF_NAME : DISTRICT.name);
  const [fresh, setFresh] = useState(true);
  useEffect(() => {
    setFresh(true);
    const id = window.setTimeout(() => setFresh(false), 4000);
    return () => window.clearTimeout(id);
  }, [area]);
  return (
    <div className={`ob-area ${fresh ? 'is-fresh' : ''}`} key={area ?? 'default'}>
      <MapPin size={15} aria-hidden />
      <span className="ob-area-name">{t(name)}</span>
      {locale !== 'en' && <span className="ob-area-en" translate="no">{name.en}</span>}
    </div>
  );
}

function Objective() {
  const { t } = useT();
  const mode = useGame(s => s.mode);
  const tourActive = useGame(s => s.tour.active);
  const stopIndex = useGame(s => s.tour.stop);
  const completed = useGame(s => s.tour.completed.length);
  const postcards = useGame(s => s.postcards.length);
  const goalsDone = useGame(s => s.goalsDone);
  const tourPhase = useFlow(s => s.tourPhase);
  const weekStage = useFlow(s => s.weekStage);
  const results = useFlow(s => s.weekResult?.events.length ?? 0);
  const device = useDevice();
  const goalsOpen = useFlow(s => s.goalsCard);

  if (tourActive) {
    const cur = currentStop();
    const total = tourStops().length;
    const doing = tourPhase === 'await' && cur;
    return (
      <button type="button" className="ob-objective" onClick={() => openPanel('journal')} aria-label={t('查看旅行本', 'Open journal')}>
        <span className="ob-objective-icon"><Route size={16} aria-hidden /></span>
        <span className="ob-objective-text">
          <strong>{t('湾区第一课', 'Bay 101')} <em>{Math.min(stopIndex + 1, total)}/{total}</em></strong>
          {cur && <small>{doing ? <>{device === 'keyboard' && <Keycap>E</Keycap>}{t(cur.poi.interaction.verb)}</> : tourPhase === 'card' || tourPhase === 'done-node' ? <>{t('看完介绍就出发', 'Off again after this')}</> : tourPhase === 'arrived' ? <>{t(cur.poi.name)}</> : <>{stopIndex >= total - 1 ? t('最后一站啦', 'Last stop') : t('下一站', 'Next')} · {t(cur.poi.name)}</>}</small>}
        </span>
        <span className="ob-progress-dots" aria-hidden>{Array.from({ length: total }, (_, i) => <i key={i} className={i < completed ? 'done' : i === stopIndex ? 'now' : ''} />)}</span>
      </button>
    );
  }
  if (mode === 'week') {
    return (
      <button type="button" className="ob-objective" onClick={() => (weekStage === 'asking' ? openPanel('week') : openBoard())}>
        <span className="ob-objective-icon"><Sparkles size={16} aria-hidden /></span>
        <span className="ob-objective-text">
          <strong>{t('这周去哪', 'This week')}</strong>
          <small>{weekStage === 'walking' ? t(`跟 BAYBAY 去看传单（${results}）`, `Follow BAYBAY to the flyers (${results})`) : weekStage === 'board' ? t('看看传单，加入想去', 'Browse flyers, save favourites') : t('回答 3 个小问题', 'Answer 3 quick questions')}</small>
        </span>
        {weekStage === 'walking' && <span className="ob-objective-cta">{t('直接看', 'Show now')}<ChevronRight size={14} aria-hidden /></span>}
        {weekStage === 'walking' && <span className="ob-objective-chip" aria-hidden>{t('看', 'See')}<ChevronRight size={13} /></span>}
      </button>
    );
  }
  if (mode === 'free') {
    const total = POSTCARDS.length;
    const goals = FREE_GOALS.filter(goal => goalsDone.includes(goal.id)).length;
    return (
      <button type="button" className="ob-objective is-gold" onClick={() => flow.set(s => ({ goalsCard: !s.goalsCard }))} aria-label={t('看看探索目标', 'Show the explorer goals')} aria-expanded={goalsOpen}>
        <span className="ob-objective-icon"><PostcardGlyph /></span>
        <span className="ob-objective-text">
          <strong>{t('明信片', 'Postcards')} <em>{postcards}/{total || 8}</em></strong>
          {FREE_GOALS.length > 1 && <small>{t('目标', 'Goals')} {goals}/{FREE_GOALS.length}</small>}
        </span>
      </button>
    );
  }
  return null;
}

function PostcardGlyph() {
  return <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><rect x="1.5" y="3" width="13" height="10" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M9.5 5.5h3v3h-3z" fill="currentColor" /><path d="M3.5 7h4M3.5 9.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>;
}

/**
 * F16 · buttons that say what they do: each label stays visible until that button (or its key) has been used
 * once — remembered on this device — and the BAYBAY portrait carries a small "问我" until you have asked her.
 */
const HUD_SEEN_KEY = 'opus-bay:hud-seen:v1';
function readSeen(): string[] { try { const v = JSON.parse(localStorage.getItem(HUD_SEEN_KEY) ?? '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch { return []; } }
function useHudSeen() {
  const [seen, setSeen] = useState<string[]>(readSeen);
  const panel = useGame(s => s.panel.kind);
  const dialogue = useGame(s => s.dialogue.nodeId);
  const photo = useGame(s => s.photoMode);
  const mark = (id: string) => setSeen(list => {
    if (list.includes(id)) return list;
    const next = [...list, id];
    try { localStorage.setItem(HUD_SEEN_KEY, JSON.stringify(next)); } catch { /* storage blocked: this visit only */ }
    return next;
  });
  // opened by keyboard (M / J / P / Esc / Q) counts too
  useEffect(() => { if (panel === 'map' || panel === 'journal' || panel === 'settings') mark(panel); }, [panel]);
  useEffect(() => { if (photo) mark('photo'); }, [photo]);
  useEffect(() => { if (dialogue === 'flow.call') mark('baybay'); }, [dialogue]);
  return { seen, mark };
}

function HudButtons() {
  const { t } = useT();
  const device = useDevice();
  const postcards = useGame(s => s.postcards.length);
  const wishes = useGame(s => s.wishlist.length);
  const { seen, mark } = useHudSeen();
  const kb = device === 'keyboard';
  const fresh = (id: string) => (seen.includes(id) ? '' : 'is-new');
  return (
    <nav className="ob-hud-buttons" aria-label={t('游戏菜单', 'Game menu')}>
      <button type="button" className={`ob-round is-baybay ${fresh('baybay')}`} onClick={() => { mark('baybay'); callBaybay(); }} aria-label={t('问 BAYBAY（Q）', 'Ask BAYBAY (Q)')}>
        <BaybayFace size={40} />
        {!seen.includes('baybay') && <span className="ob-ask-me" aria-hidden>{t('问我', 'Ask me')}</span>}
        <span className="ob-round-label">{t('问 BAYBAY', 'Ask')}</span>{kb && <Keycap className="ob-round-key">Q</Keycap>}
      </button>
      <button type="button" className={`ob-round ${fresh('map')}`} onClick={() => { mark('map'); openPanel('map'); }} aria-label={t('地图（M）', 'Map (M)')}>
        <MapIcon size={21} aria-hidden /><span className="ob-round-label">{t('地图', 'Map')}</span>{kb && <Keycap className="ob-round-key">M</Keycap>}
      </button>
      <button type="button" className={`ob-round ${fresh('journal')}`} onClick={() => { mark('journal'); openPanel('journal'); }} aria-label={t('旅行本（J）', 'Journal (J)')}>
        <BookOpen size={21} aria-hidden /><span className="ob-round-label">{t('旅行本', 'Journal')}</span>{kb && <Keycap className="ob-round-key">J</Keycap>}
        {postcards + wishes > 0 && <span className="ob-badge">{postcards + wishes}</span>}
      </button>
      <button type="button" className={`ob-round ${fresh('photo')}`} onClick={() => { mark('photo'); enterPhotoMode(); }} aria-label={t('拍照（P）', 'Photo (P)')}>
        <Camera size={21} aria-hidden /><span className="ob-round-label">{t('拍照', 'Photo')}</span>{kb && <Keycap className="ob-round-key">P</Keycap>}
      </button>
      <button type="button" className={`ob-round ${fresh('settings')}`} onClick={() => { mark('settings'); openPanel('settings'); }} aria-label={t('设置（Esc）', 'Settings (Esc)')}>
        <Settings size={21} aria-hidden /><span className="ob-round-label">{t('设置', 'Settings')}</span>{kb && <Keycap className="ob-round-key">Esc</Keycap>}
      </button>
    </nav>
  );
}

const KIND_HINT: Partial<Record<InteractionKind, 'gold' | 'teal'>> = { postcard: 'gold' };

function ContextAction() {
  const { t } = useT();
  const focus = useGame(s => s.focus);
  const dialogue = useGame(s => s.dialogue.nodeId);
  const panel = useGame(s => s.panel.kind);
  const fishing = useFlow(s => !!s.fishing);
  const device = useDevice();
  // "news" = BAYBAY is calling you over (跟我来, a nudge) or coming because you called — not ambient chatter
  const baybayNews = useFlow(s => (s.bubble?.who === BAYBAY_ID && s.bubble.tone === 'call') || s.callPending);
  const panelId = useGame(s => s.panel.id);
  const it = interactableById(focus);
  if (!it || dialogue || fishing) return null;
  // F7: never prompt for the sheet that is already open
  if ((panel === 'poi' && panelId === it.id) || (panel === 'week' && it.action === 'board')) return null;
  const tone = KIND_HINT[it.action] ?? 'teal';
  const label = t(it.verb);
  // lane E's movement interactables: bike / toy car / seat icons (ids ride:<spot id>, sources 'vehicle' and 'seat')
  const ride = it.source === 'vehicle' ? (it.id.startsWith('ride:car') ? 'car' : 'bike') : it.source === 'seat' ? 'seat' : undefined;
  // the bar's 问 BAYBAY already covers her on phones: only offer the big action when she has something to say
  if (device === 'touch' && it.source === 'baybay' && !baybayNews) return null;
  if (device === 'touch') {
    return (
      <button type="button" className={`ob-touch-action tone-${tone} ${panel ? 'is-behind-sheet' : ''}`} onClick={() => requestInteract('button')} aria-label={label}>
        <InteractIcon kind={it.action} ride={ride} size={28} />
        <span>{label}</span>
      </button>
    );
  }
  return (
    <button type="button" className={`ob-context tone-${tone}`} onClick={() => requestInteract('button')}>
      <Keycap className="ob-context-key">{device === 'gamepad' ? 'A' : 'E'}</Keycap>
      <InteractIcon kind={it.action} ride={ride} size={18} />
      <span className="ob-context-verb">{label}</span>
      {it.source !== 'baybay' && it.source !== 'postcard' && <span className="ob-context-name">{t(it.name)}</span>}
    </button>
  );
}

/**
 * Phones (≤ 600 px): one compact bottom bar — 问 BAYBAY / 地图 / 旅行本 / ··· (拍照, 设置) — instead of the button
 * column, so nothing stacks over BAYBAY on the right edge. Labels are always shown (they fit inside the bar).
 */
function PhoneBar() {
  const { t } = useT();
  const postcards = useGame(s => s.postcards.length);
  const wishes = useGame(s => s.wishlist.length);
  const [more, setMore] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!more) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setMore(false); };
    window.addEventListener('pointerdown', close, true);
    return () => window.removeEventListener('pointerdown', close, true);
  }, [more]);
  return (
    <nav ref={ref} className="ob-bar" aria-label={t('游戏菜单', 'Game menu')}>
      <button type="button" className="ob-bar-btn is-baybay" onClick={callBaybay} aria-label={t('问 BAYBAY', 'Ask BAYBAY')}>
        <BaybayFace size={30} /><span>{t('问 BAYBAY', 'Ask')}</span>
      </button>
      <button type="button" className="ob-bar-btn" onClick={() => openPanel('map')}><MapIcon size={20} aria-hidden /><span>{t('地图', 'Map')}</span></button>
      <button type="button" className="ob-bar-btn" onClick={() => openPanel('journal')}>
        <BookOpen size={20} aria-hidden /><span>{t('旅行本', 'Journal')}</span>
        {postcards + wishes > 0 && <span className="ob-badge">{postcards + wishes}</span>}
      </button>
      <button type="button" className="ob-bar-btn" onClick={() => setMore(m => !m)} aria-expanded={more} aria-haspopup="menu" aria-label={t('更多：拍照、设置', 'More: photo, settings')}>
        <Ellipsis size={20} aria-hidden /><span>{t('更多', 'More')}</span>
      </button>
      {more && (
        <div className="ob-bar-more" role="menu">
          <button type="button" role="menuitem" onClick={() => { setMore(false); enterPhotoMode(); }}><Camera size={18} aria-hidden /><span>{t('拍照', 'Photo')}</span></button>
          <button type="button" role="menuitem" onClick={() => { setMore(false); openPanel('settings'); }}><Settings size={18} aria-hidden /><span>{t('设置', 'Settings')}</span></button>
        </div>
      )}
    </nav>
  );
}

function RideBanner() {
  const { t } = useT();
  const ride = useFlow(s => s.ride);
  if (!ride) return null;
  const to = DISTRICT.streetcar.stops.find(stop => stop.id === ride.to);
  return (
    <div className="ob-ride" role="status">
      <TramFront size={20} aria-hidden />
      <span>{ride.stage === 'waiting' ? t(`等电车进站…${ride.eta ? `约 ${ride.eta} 秒` : ''}`, `Waiting for the streetcar…${ride.eta ? ` ~${ride.eta}s` : ''}`) : <>{t('F 线电车 · 开往', 'F-line · to')} <strong>{to ? t(to.name) : ''}</strong></>}</span>
      {ride.stage === 'waiting'
        ? <button type="button" className="ob-btn ob-btn-soft ob-btn-sm" onClick={cancelRide}>{t('不坐了', 'Cancel')}</button>
        : <>
            <button type="button" className="ob-btn ob-btn-ghost ob-btn-sm" onClick={hopOffRide}>{t('提前下车', 'Hop off here')}</button>
            <button type="button" className="ob-btn ob-btn-soft ob-btn-sm" onClick={finishRide}>{t('直接到站', 'Skip to stop')}</button>
          </>}
    </div>
  );
}
