import { Bird, CircleDot } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { useT } from '../i18n';
import { Keycap } from '../ui/common';
import { useDevice } from '../ui/hooks';
import { flightState, skipFirstFlight, subscribeFlight, takeOffNow, FIRST_FLIGHT_NAME } from './firstFlight';
import './play.css';

/**
 * Wave 5 · lane A · the first flight's chip (overlay 'play-flight'): under the top pill, one line — 第一次飞行 · 金圈
 * 3 / 8 — with 跳过; before the take-off it teaches the button once (desktop: the G keycap; phones: its own 起飞, the
 * same press as the move column's 起飞 button).
 */

const snapshot = () => {
  const s = flightState();
  return s ? `${s.phase}:${s.got}:${s.rings.length}` : '';
};

export default function FlightChip() {
  const { t } = useT();
  const device = useDevice();
  const key = useSyncExternalStore(subscribeFlight, snapshot, snapshot);
  if (!key) return null;
  const [phase, got, total] = key.split(':');
  return (
    <div className={`ob-play-flight is-${phase}`} role="status" aria-live="polite">
      <Bird size={18} aria-hidden />
      <span className="ob-play-flight-name">{t(FIRST_FLIGHT_NAME)}</span>
      {phase === 'intro' ? (
        device === 'touch'
          ? <button type="button" className="ob-play-btn is-go" onClick={takeOffNow}>{t('起飞', 'Take off')}</button>
          : <span className="ob-play-flight-hint">{t('按', 'Press')} <Keycap>G</Keycap> {t('起飞', 'to take off')}</span>
      ) : (
        <span className="ob-play-flight-count"><CircleDot size={15} aria-hidden /> {t('金圈', 'Rings')} {got} / {total}</span>
      )}
      <button type="button" className="ob-play-btn is-quiet" onClick={skipFirstFlight}>{t('跳过', 'Skip')}</button>
    </div>
  );
}
