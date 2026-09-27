import { useCallback, useEffect, useRef, useState } from 'react';
import { Hand } from 'lucide-react';
import { runtime } from '../core/runtime';
import { game, useGame } from '../core/store';
import { cinemaActive } from '../game/cinema';
import { flow, useFlow } from '../game/flowStore';
import { registerAnchor } from '../game/projector';
import { useT } from '../i18n';
import { Keycap } from './common';
import { useDevice } from './hooks';

/**
 * F2 · Onboarding coach mark: teaches movement in context, once. It waits until the screen is genuinely free
 * (playing, not the welcome, no dialogue / panel / cinematic / bubble / goals card, player not locked) for 1.5 s,
 * hides the moment anything else appears, and is marked as seen only after 4 s of unobstructed display or on the
 * first real move. Touch also gets a pulsing tap marker on the ground between you and BAYBAY at the first "跟我来".
 */

const COACH_KEY = 'opus-bay:coach:v1';

const seen = () => { try { return localStorage.getItem(COACH_KEY) === '1'; } catch { return false; } };
const markSeen = () => { try { localStorage.setItem(COACH_KEY, '1'); } catch { /* storage blocked: session only */ } };

/** Everything that must be absent for the coach mark (or any low-priority overlay) to show. */
function screenIsFree(): boolean {
  const s = game.get(), f = flow.get();
  return s.phase === 'playing' && s.mode !== 'onboarding' && !s.dialogue.nodeId && !s.panel.kind && !s.photoMode && !s.riding
    && s.move.mode === 'foot' && !f.cinematic && !cinemaActive() && !f.bubble && !f.goalsCard && !f.fishing && !f.postcardReward && !f.postcardFly && !runtime.player.locked;
}

export function CoachMark() {
  const { t } = useT();
  const device = useDevice();
  const [show, setShow] = useState(false);
  const done = useRef(seen());
  useEffect(() => {
    if (done.current) return;
    let freeSince = 0, shownFor = 0, last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now(), dt = now - last;
      last = now;
      const p = runtime.player;
      // first successful move: the lesson landed
      if (p.moving && p.speed > 0.8 && game.get().phase === 'playing' && game.get().mode !== 'onboarding') {
        done.current = true; markSeen(); setShow(false); window.clearInterval(id); return;
      }
      if (!screenIsFree()) { freeSince = 0; setShow(false); return; }
      if (!freeSince) freeSince = now;
      if (now - freeSince < 1500) return;
      setShow(true);
      shownFor += dt;
      if (shownFor > 4000) markSeen(); // seen, but keep it up until the player moves or something covers it
    }, 150);
    return () => window.clearInterval(id);
  }, []);
  if (!show) return null;
  return (
    <div className={`ob-coach ${device === 'touch' ? 'is-touch' : ''}`} role="status">
      {device === 'touch' ? (
        <span className="ob-coach-line"><Hand size={18} aria-hidden />{t('点地面走过去 · 左边拖动摇杆 · 右边拖动转视角', 'Tap the ground to walk · drag left to steer · drag right to look')}</span>
      ) : (
        <span className="ob-coach-line">
          <span className="ob-coach-keys"><Keycap>W</Keycap><Keycap>A</Keycap><Keycap>S</Keycap><Keycap>D</Keycap></span>
          <span className="ob-coach-or">/</span>
          <span className="ob-coach-keys is-arrows"><Keycap>↑</Keycap><Keycap>↓</Keycap><Keycap>←</Keycap><Keycap>→</Keycap></span>
          <b>{t('走路', 'walk')}</b>
          <span className="ob-coach-dot">·</span>{t('点地面也能走', 'or click the ground')}
          <span className="ob-coach-dot">·</span><Keycap>Shift</Keycap>{t('跑', 'run')}
        </span>
      )}
    </div>
  );
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
    if (device !== 'touch' || !leading || dialogue || shown.current || seen()) return;
    shown.current = true;
    setOn(true);
    const id = window.setTimeout(() => setOn(false), 6000);
    return () => window.clearTimeout(id);
  }, [device, leading, dialogue]);
  useEffect(() => { if (on && (!leading || dialogue)) setOn(false); }, [on, leading, dialogue]);
  return <div ref={ref} className="ob-tap-hint" data-show={on ? '1' : '0'} aria-hidden><i /><i /></div>;
}
