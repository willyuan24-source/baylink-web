import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Camera, ChevronRight, Info, Landmark, Sparkles } from 'lucide-react';
import type { Bilingual } from '../core/types';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { ATTENTION_PRIORITY, RIBBON_MERGE_MS, ribbonText, useAttention, useRibbon } from '../game/attention';
import { useT } from '../i18n';
import { ARRIVAL_CARD_MS, arrivalToastText } from './guideText';
import { useMoreMenuOpen } from './moreMenu';
import './guide-ui.css';

/**
 * Wave 4 · the arrival moment on screen (lane G, W4-G10; plan sf-w4-plan.md §4.2 "Arrival moments"). Lane C's
 * game/arrival.ts emits `{ type: 'arrival', place, tier, first, attraction }`; the Overlay then shows:
 *
 *   <ArrivalToast>  a gold banner in the top stack while the reveal plays: "抵达 · 艺术宫 Palace of Fine Arts" (quiet
 *                   places — memorials, churches: "到了 · …", cream, no gold)
 *   <ArrivalCard>   the card: phones 72 px above the PhoneBar (full width, clear of the touch action), desktop
 *                   bottom-left; photo thumb (or the category glyph), name, [看介绍] [拍照] [下一站]
 *
 * Wave 9 · lane F · W9-F2 (review R§5 #5: the banner, the ARRIVED card, 解锁：随时飞！, 今日小事 1/3 and the +1 chip were
 * up together, and the card closed itself after 6 s): ONE message. Both go through game/attention.ts' title level —
 * the banner holds it while the reveal plays and the card takes it over at once (the banner steps aside); the card is
 * a first-visit card: no timer, it stays until a tap / Esc / a button, until the player walks on (CARD_WALK_AWAY u) or
 * until something that matters more takes the level (a dialogue, a panel, a stuck card). While it is up, the toasts of
 * the moment (今日小事 ✓ 1/3, 南瓜灯 1/40, +10 金币, 解锁：随时飞！, the +1 of a find) are its ribbon row, not banners on top.
 * Nothing here plays a sound (the stamp sound is the audio layer's on the same event).
 */

/** The card closes once the player is this far (u) from where it appeared: they walked on. */
export const CARD_WALK_AWAY = 24;
/** The card keeps the title level at least this long (ms) before a card that matters more takes it. */
export const CARD_MIN_MS = 4000;
/** the ribbon row (inline: the card's stylesheet is lane Q's) */
const RIBBON_ROW: CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, margin: '2px 0 6px', fontSize: 13, fontWeight: 700, lineHeight: 1.35, color: 'var(--ob-teal-d, #1f6f69)' };

export interface ArrivalView {
  /** the place-index id (key) */
  place: string;
  name: Bilingual;
  tier: 1 | 2 | 3;
  /** a licensed photo thumb (src/data/sf-landmark-photo-assets.json -small.webp) */
  photo?: string | null;
  /** memorials, churches: the quiet tone */
  quiet?: boolean;
  /** the next stop of a trip / tour, when there is one (the [下一站] button) */
  next?: Bilingual | null;
  /** the category colour for the glyph fallback */
  color?: string;
}

/** `text` = lane C's arrivalBeats().toast when given (game/arrival.ts), else "抵达 · 名称" / "到了 · 名称". */
export function ArrivalToast({ arrival, text }: { arrival: Pick<ArrivalView, 'name' | 'quiet'>; text?: Bilingual | null }) {
  const { t, locale } = useT();
  // (W9-F2) the title level: the card that follows takes it over at once (one message, never banner + card)
  const on = useAttention('title', `arrival-banner:${arrival.name.en}`, true, { priority: ATTENTION_PRIORITY.arrivalBanner, maxWaitMs: 4000 });
  if (!on) return null;
  return (
    <div className={`ob-toast ob-arrival-toast ${arrival.quiet ? 'is-quiet' : ''}`} role="status">
      <strong>{t(text ?? arrivalToastText(arrival.name, arrival.quiet))}</strong>
      {locale !== 'en' && <small translate="no" title={arrival.name.en}>{arrival.name.en}</small>}
    </div>
  );
}

export interface ArrivalCardProps {
  arrival: ArrivalView;
  onInfo(): void;
  onPhoto(): void;
  onNext?(): void;
  /** called when the card goes (×, Esc, any button, walking on, a card that matters more; a timer when not sticky) */
  onClose(): void;
  ms?: number;
  /** (W9-F2) a first-visit card: no timer (default true; false keeps the ARRIVAL_CARD_MS timer) */
  sticky?: boolean;
}

export function ArrivalCard({ arrival, onInfo, onPhoto, onNext, onClose, ms = ARRIVAL_CARD_MS, sticky = true }: ArrivalCardProps) {
  const { t } = useT();
  const [held, setHeld] = useState(false);
  // W6-K2: an open More menu wins (a phone's 更多 menu sat under this card): the card steps back and its time waits
  const waiting = useMoreMenuOpen();
  const paused = held || waiting;
  const left = useRef(ms);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  // (W9-F2) the title level: a first-visit holder that takes the moment's toasts into its ribbon row; taken by a
  // dialogue / panel / stuck card (or never granted within 30 s): the card goes
  const granted = useAttention('title', `arrival-card:${arrival.place}`, true, {
    priority: ATTENTION_PRIORITY.card, minMs: CARD_MIN_MS, firstVisit: sticky, absorb: true, maxWaitMs: 30_000,
    onDrop: why => { if (why !== 'cleared') closeRef.current(); },
  });
  const [since] = useState(() => performance.now());
  const ribbon = useRibbon();
  const row = ribbon && ribbon.at >= since - RIBBON_MERGE_MS ? ribbonText(ribbon.parts) : null;
  // the 6 s timer (not sticky), paused while the pointer or the focus is on the card, or while a More menu is open
  useEffect(() => {
    if (sticky || paused || !granted) return;
    const start = performance.now();
    const id = window.setTimeout(() => closeRef.current(), left.current);
    return () => { window.clearTimeout(id); left.current = Math.max(800, left.current - (performance.now() - start)); };
  }, [paused, sticky, granted]);
  // (W9-F2) walking on closes it (the player left the place the card is about), and so does boarding a ride
  useEffect(() => {
    if (!granted) return;
    const from = { x: runtime.player.x, z: runtime.player.z };
    const id = window.setInterval(() => {
      if (Math.hypot(runtime.player.x - from.x, runtime.player.z - from.z) > CARD_WALK_AWAY || game.get().move.mode === 'transit') closeRef.current();
    }, 500);
    return () => window.clearInterval(id);
  }, [granted]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!granted) return null;
  const act = (fn?: () => void) => () => { fn?.(); closeRef.current(); };
  return (
    <section
      className={`ob-arrival-card ${arrival.quiet ? 'is-quiet' : ''} tier-${arrival.tier} ${waiting ? 'is-waiting' : ''} ${sticky ? 'is-sticky' : ''}`}
      aria-hidden={waiting || undefined}
      aria-label={t(arrivalToastText(arrival.name, arrival.quiet))}
      onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false); }}
      style={{ ['--ob-arrival-ms' as string]: `${ms}ms` }}
    >
      <span className="ob-arrival-thumb" style={arrival.color ? { background: arrival.color } : undefined}>
        {arrival.photo ? <img src={arrival.photo} alt="" loading="lazy" decoding="async" /> : <Landmark size={26} aria-hidden />}
      </span>
      <div className="ob-arrival-body">
        <p className="ob-arrival-kicker">{arrival.quiet ? t('到了', 'Here') : t('抵达', 'Arrived')}</p>
        <h3 className="ob-arrival-name">{t(arrival.name)}</h3>
        {row && <p key={ribbon?.key} className="ob-arrival-ribbon" role="status" style={RIBBON_ROW}><Sparkles size={13} aria-hidden /><span>{t(row)}</span></p>}
        <div className="ob-arrival-actions">
          <button type="button" className="ob-btn ob-btn-soft ob-btn-sm" onClick={act(onInfo)}><Info size={15} aria-hidden />{t('看介绍', 'About')}</button>
          <button type="button" className="ob-btn ob-btn-soft ob-btn-sm" onClick={act(onPhoto)}><Camera size={15} aria-hidden />{t('拍照', 'Photo')}</button>
          {onNext && arrival.next && <button type="button" className="ob-btn ob-btn-primary ob-btn-sm" onClick={act(onNext)}>{t('下一站', 'Next')}<ChevronRight size={15} aria-hidden /></button>}
        </div>
      </div>
      <button type="button" className="ob-arrival-close" onClick={() => closeRef.current()} aria-label={t('关闭', 'Close')}>×</button>
      {!sticky && <i className={`ob-arrival-timer ${paused ? 'is-held' : ''}`} aria-hidden />}
    </section>
  );
}
