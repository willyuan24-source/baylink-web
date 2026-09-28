import { Bird, CircleDot, Navigation2 } from 'lucide-react';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useT } from '../i18n';
import { Keycap } from '../ui/common';
import { useDevice } from '../ui/hooks';
import { flightName, flightState, ringBearing, skipFirstFlight, subscribeFlight, takeOffNow, type FlightCourse } from './firstFlight';
import './play.css';

/**
 * Wave 5 · lane A · the first flight's chip (overlay 'play-flight'; the Golden Gate rings' too, by its course name): one
 * line under the top of the screen — 第一次飞行 ·
 * 金圈 3 / 8 — with 跳过; before the take-off it teaches the button once (desktop: the G keycap; phones: its own 起飞, the
 * same press as the move column's 起飞 button); while flying a small arrow points to the next ring (as the camera sees
 * it: up = ahead).
 */

const snapshot = () => {
  const s = flightState();
  return s ? `${s.phase}:${s.got}:${s.rings.length}:${s.course}` : '';
};

export default function FlightChip() {
  const { t } = useT();
  const device = useDevice();
  const key = useSyncExternalStore(subscribeFlight, snapshot, snapshot);
  const arrow = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let id = 0;
    const tick = () => {
      const el = arrow.current, b = ringBearing();
      if (el) {
        el.style.opacity = b === null ? '0' : '1';
        if (b !== null) el.style.transform = `rotate(${(-b * 180) / Math.PI}deg)`;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
  if (!key) return null;
  const [phase, got, total, course] = key.split(':');
  return (
    <div className={`ob-play-flight is-${phase}`} role="status" aria-live="polite">
      <Bird size={18} aria-hidden />
      <span className="ob-play-flight-name">{t(flightName(course as FlightCourse))}</span>
      {phase === 'intro' ? (
        device === 'touch'
          ? <button type="button" className="ob-play-btn is-go" onClick={takeOffNow}>{t('起飞', 'Take off')}</button>
          : <span className="ob-play-flight-hint">{t('按', 'Press')} <Keycap>G</Keycap> {t('起飞', 'to take off')}</span>
      ) : (
        <span className="ob-play-flight-count"><CircleDot size={15} aria-hidden /> {t('金圈', 'Rings')} {got} / {total}</span>
      )}
      <span ref={arrow} className="ob-play-flight-arrow" aria-hidden><Navigation2 size={16} /></span>
      <button type="button" className="ob-play-btn is-quiet" onClick={skipFirstFlight}>{t('跳过', 'Skip')}</button>
    </div>
  );
}
