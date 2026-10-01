import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../core/store';
import { useFlow } from '../game/flowStore';
import { registerAnchor } from '../game/projector';
import { useDevice } from './hooks';
import { coachSeen } from './coachSeen';
import { importRetry } from '../game/importRetry';

/**
 * F2 · Onboarding coach mark: teaches movement in context, once (ui/CoachMarkBody.tsx: it waits for a free screen, is
 * marked seen after 4 s of display or on the first real move). Touch also gets a pulsing tap marker on the ground
 * between you and BAYBAY at the first "跟我来".
 *
 * Wave 4 integration (lane G): the body is its own lazy chunk, mounted only while the lesson is still due on this
 * device, so GameRoot does not carry it on every later visit (it keeps GameRoot within its size while the city
 * guidance glue comes in).
 */
const CoachMarkBody = lazy(() => importRetry(() => import('./CoachMarkBody')));

export function CoachMark() {
  const [due] = useState(() => !coachSeen());
  if (!due) return null;
  return <Suspense fallback={null}><CoachMarkBody /></Suspense>;
}

/**
 * Touch: at the first "跟我来" of a guided walk, a pulsing tap marker on the ground between you and BAYBAY
 * (projected by the Canvas ticker through domAnchors.tapHint). Once per visit, 6 s at most.
 */
export function TapHint() {
  const device = useDevice();
  const leading = useFlow(s => s.tourPhase === 'leading' || s.weekStage === 'walking');
  const dialogue = useGame(s => !!s.dialogue.nodeId);
  const [on, setOn] = useState(false);
  const shown = useRef(false);
  const ref = useCallback((el: HTMLDivElement | null) => registerAnchor('tapHint', el), []);
  useEffect(() => {
    if (device !== 'touch' || !leading || dialogue || shown.current || coachSeen()) return;
    shown.current = true;
    setOn(true);
    const id = window.setTimeout(() => setOn(false), 6000);
    return () => window.clearTimeout(id);
  }, [device, leading, dialogue]);
  useEffect(() => { if (on && (!leading || dialogue)) setOn(false); }, [on, leading, dialogue]);
  return <div ref={ref} className="ob-tap-hint" data-show={on ? '1' : '0'} aria-hidden><i /><i /></div>;
}
