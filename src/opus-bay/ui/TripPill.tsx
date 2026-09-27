import { useEffect, useRef } from 'react';
import { Bike, Bird, Bus, CableCar, CarFront, Footprints, Rabbit, Repeat, SkipForward, TrainFront, TramFront, X, type LucideIcon } from 'lucide-react';
import type { TripLineInfo } from '../game/tripPlan';
import type { TripState } from '../game/tripTypes';
import { useT } from '../i18n';
import { type LegIcon, type PillText, tripLegRows } from './guideText';
import './guide-ui.css';

/**
 * Wave 4 · the trip pill and the trip card (lane G, W4-G3; plan sf-w4-plan.md §4.2 "Trip pill"). Prop-driven: the Hud
 * shows <TripPill> in the objective slot (it reuses .ob-objective, so the M1 / DR-3 layout rules hold) while a trip,
 * tour leg or ride runs, and <TripCard> as a bottom sheet (phones, snap 40 %) or a card under the pill (desktop).
 *
 *   <TripPill text={tripPillText(trip, left, …)} dots={…} onOpen={…} />     "[icon] 下一站 名称 · 约 N 分钟" + tour dots
 *   <TripCard trip lines onSkip onChange onEnd onClose />                     legs with icons and times, 跳过这一站,
 *                                                                              换个方式, 结束
 */

const LEG_ICONS: Readonly<Record<LegIcon, LucideIcon>> = {
  walk: Footprints, run: Rabbit, bike: Bike, car: CarFront, bus: Bus, metro: TrainFront, 'cable-car': CableCar, tram: TramFront, fly: Bird,
};

export interface TripPillProps {
  text: PillText;
  /** tour progress (the Grand Tour's stops in this chapter): done, now, total */
  dots?: { done: number; now: number; total: number } | null;
  onOpen(): void;
  /** the trip card is open (aria-expanded) */
  open?: boolean;
}

export function TripPill({ text, dots, onOpen, open }: TripPillProps) {
  const { t } = useT();
  const Icon = LEG_ICONS[text.icon];
  return (
    <button type="button" className="ob-objective ob-trip-pill" onClick={onOpen} aria-expanded={!!open} aria-label={`${t(text.title)} · ${t(text.time)}`}>
      <span className="ob-objective-icon"><Icon size={16} aria-hidden /></span>
      <span className="ob-objective-text">
        <strong><span className="ob-trip-pill-title">{t(text.title)}</span>{text.step && <em>{text.step}</em>}</strong>
        <small>{t(text.time)}</small>
      </span>
      {dots && dots.total > 1 && (
        <span className="ob-progress-dots" aria-hidden>
          {Array.from({ length: Math.min(dots.total, 8) }, (_, i) => <i key={i} className={i < dots.done ? 'done' : i === dots.now ? 'now' : ''} />)}
        </span>
      )}
    </button>
  );
}

export interface TripCardProps {
  trip: Pick<TripState, 'legs' | 'leg'>;
  title: { zh: string; en: string };
  /** the whole trip's remaining time ("还要约 3 分钟") */
  left: { zh: string; en: string };
  lines?: ReadonlyMap<string, TripLineInfo>;
  onSkip?(): void;
  onChange?(): void;
  onEnd(): void;
  onClose(): void;
}

/** The trip card: phones = a bottom sheet (40 % high), desktop = a card under the pill. Esc / the × close it. */
export function TripCard({ trip, title, left, lines, onSkip, onChange, onEnd, onClose }: TripCardProps) {
  const { t } = useT();
  const rows = tripLegRows(trip, lines);
  const ref = useRef<HTMLElement>(null);
  // (review) the Overlay re-renders the card every second (the time left) with a fresh inline onClose: keep the
  // latest callback in a ref and focus the first action once, on open — re-running the effect per render pulled the
  // focus back to 跳过这一站 every second, so a keyboard user could never reach 结束
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); } };
    window.addEventListener('keydown', onKey, true);
    ref.current?.querySelector<HTMLButtonElement>('.ob-trip-card-actions button')?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  const last = trip.leg >= trip.legs.length - 1;
  return (
    <section ref={ref} className="ob-trip-card" role="dialog" aria-label={t(title)}>
      <header className="ob-trip-card-head">
        <span className="ob-trip-card-grip" aria-hidden />
        <div>
          <h3>{t(title)}</h3>
          <p>{t(left)}</p>
        </div>
        <button type="button" className="ob-icon-btn ob-icon-sm" onClick={onClose} aria-label={t('收起', 'Close')}><X size={16} aria-hidden /></button>
      </header>
      <ol className="ob-trip-legs">
        {rows.map((r, i) => {
          const Icon = LEG_ICONS[r.icon];
          return (
            <li key={i} className={`is-${r.state}`} aria-current={r.state === 'now' ? 'step' : undefined}>
              <span className="ob-trip-leg-icon"><Icon size={16} aria-hidden /></span>
              <span className="ob-trip-leg-text">{t(r.label)}{r.wait && <small>{t(r.wait)}</small>}</span>
              <span className="ob-trip-leg-time">{t(r.time)}</span>
            </li>
          );
        })}
      </ol>
      <div className="ob-trip-card-actions">
        {onSkip && !last && <button type="button" className="ob-btn ob-btn-soft" onClick={onSkip}><SkipForward size={16} aria-hidden />{t('跳过这一站', 'Skip this leg')}</button>}
        {onChange && <button type="button" className="ob-btn ob-btn-soft" onClick={onChange}><Repeat size={16} aria-hidden />{t('换个方式', 'Another way')}</button>}
        <button type="button" className="ob-btn ob-btn-ghost" onClick={onEnd}>{t('结束', 'End trip')}</button>
      </div>
    </section>
  );
}
