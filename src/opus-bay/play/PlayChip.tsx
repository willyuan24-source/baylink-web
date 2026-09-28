import { ArrowDownRight, Footprints } from 'lucide-react';
import { useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react';
import { useT } from '../i18n';
import { chipSeq, chipState, subscribeChip } from './chip';
import './play.css';

/**
 * Wave 5 · lane A · the activity chip (overlay 'play-chip'): the slides' countdown and hold-to-tuck, the stair race's
 * clock and 放弃. Same place as the first flight's chip (top middle; phones: under the objective pill).
 */

export default function PlayChip() {
  const { t } = useT();
  useSyncExternalStore(subscribeChip, chipSeq, chipSeq);
  const s = chipState();
  if (!s) return null;
  const Icon = s.icon === 'stairs' ? Footprints : ArrowDownRight;
  const hold = s.hold;
  const press = (down: boolean) => (e: ReactPointerEvent) => {
    e.preventDefault();
    if (down) {
      try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* not a live pointer */ }
      const up = () => { hold?.set(false); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true); };
      window.addEventListener('pointerup', up, true);
      window.addEventListener('pointercancel', up, true);
    }
    hold?.set(down);
  };
  return (
    <div className={`ob-play-flight ob-play-chip is-${s.id}`} role="status" aria-live="polite">
      <Icon size={18} aria-hidden />
      <span className="ob-play-flight-name">{t(s.title)}</span>
      {s.big && <span key={s.big} className="ob-play-chip-big">{s.big}</span>}
      {s.status && <span className="ob-play-chip-status">{t(s.status)}</span>}
      {s.line && <span className="ob-play-flight-hint">{t(s.line)}</span>}
      {hold && (
        <button type="button" className="ob-play-btn is-go ob-play-hold" onPointerDown={press(true)} onPointerUp={press(false)} onPointerCancel={press(false)} onContextMenu={e => e.preventDefault()}>
          {t(hold.label)}
        </button>
      )}
      {s.action && <button type="button" className="ob-play-btn is-quiet" onClick={s.action.run}>{t(s.action.label)}</button>}
    </div>
  );
}
