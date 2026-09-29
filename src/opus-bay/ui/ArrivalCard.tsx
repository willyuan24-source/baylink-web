import { useEffect, useRef, useState } from 'react';
import { Camera, ChevronRight, Info, Landmark } from 'lucide-react';
import type { Bilingual } from '../core/types';
import { useT } from '../i18n';
import { ARRIVAL_CARD_MS, arrivalToastText } from './guideText';
import { useMoreMenuOpen } from './moreMenu';
import './guide-ui.css';

/**
 * Wave 4 · the arrival moment on screen (lane G, W4-G10; plan sf-w4-plan.md §4.2 "Arrival moments"). Lane C's
 * game/arrival.ts emits `{ type: 'arrival', place, tier, first, attraction }`; the Overlay then shows:
 *
 *   <ArrivalToast>  a gold toast, larger than the discovery toast, in the top stack: "抵达 · 艺术宫 Palace of Fine Arts"
 *                   (quiet places — memorials, churches: "到了 · …", cream, no gold)
 *   <ArrivalCard>   a peek card for 6 s: phones 72 px above the PhoneBar (full width, clear of the touch action),
 *                   desktop bottom-left; photo thumb (or the category glyph), name, [看介绍] [拍照] [下一站]
 * The card pauses its timer while hovered or focused and closes on Esc. Nothing here plays a sound (the stamp sound is
 * the audio layer's on the same event).
 */

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
  return (
    <div className={`ob-toast ob-arrival-toast ${arrival.quiet ? 'is-quiet' : ''}`} role="status">
      <strong>{t(text ?? arrivalToastText(arrival.name, arrival.quiet))}</strong>
      {locale !== 'en' && <small translate="no">{arrival.name.en}</small>}
    </div>
  );
}

export interface ArrivalCardProps {
  arrival: ArrivalView;
  onInfo(): void;
  onPhoto(): void;
  onNext?(): void;
  /** called when the card goes (timer, ×, Esc, any button) */
  onClose(): void;
  ms?: number;
}

export function ArrivalCard({ arrival, onInfo, onPhoto, onNext, onClose, ms = ARRIVAL_CARD_MS }: ArrivalCardProps) {
  const { t } = useT();
  const [held, setHeld] = useState(false);
  // W6-K2: an open More menu wins (a phone's 更多 menu sat under this card): the card steps back and its time waits
  const waiting = useMoreMenuOpen();
  const paused = held || waiting;
  const left = useRef(ms);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  // the 6 s timer, paused while the pointer or the focus is on the card, or while a More menu is open
  useEffect(() => {
    if (paused) return;
    const start = performance.now();
    const id = window.setTimeout(() => closeRef.current(), left.current);
    return () => { window.clearTimeout(id); left.current = Math.max(800, left.current - (performance.now() - start)); };
  }, [paused]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const act = (fn?: () => void) => () => { fn?.(); closeRef.current(); };
  return (
    <section
      className={`ob-arrival-card ${arrival.quiet ? 'is-quiet' : ''} tier-${arrival.tier} ${waiting ? 'is-waiting' : ''}`}
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
        <div className="ob-arrival-actions">
          <button type="button" className="ob-btn ob-btn-soft ob-btn-sm" onClick={act(onInfo)}><Info size={15} aria-hidden />{t('看介绍', 'About')}</button>
          <button type="button" className="ob-btn ob-btn-soft ob-btn-sm" onClick={act(onPhoto)}><Camera size={15} aria-hidden />{t('拍照', 'Photo')}</button>
          {onNext && arrival.next && <button type="button" className="ob-btn ob-btn-primary ob-btn-sm" onClick={act(onNext)}>{t('下一站', 'Next')}<ChevronRight size={15} aria-hidden /></button>}
        </div>
      </div>
      <button type="button" className="ob-arrival-close" onClick={() => closeRef.current()} aria-label={t('关闭', 'Close')}>×</button>
      <i className={`ob-arrival-timer ${paused ? 'is-held' : ''}`} aria-hidden />
    </section>
  );
}
