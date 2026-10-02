import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Hand } from 'lucide-react';
import { runtime } from '../core/runtime';
import { game, useGame } from '../core/store';
import { cinemaActive } from '../game/cinema';
import { flow } from '../game/flowStore';
import { useAttention } from '../game/attention';
import { useT } from '../i18n';
import { Keycap } from './common';
import { useDevice } from './hooks';
import { coachSeen, markCoachSeen } from './coachSeen';

/**
 * F2 · Onboarding coach mark: teaches movement in context, once. It waits until the screen is genuinely free
 * (playing, not the welcome, no dialogue / panel / cinematic / goals card, player not locked) for 1.5 s and hides the
 * moment anything else appears. (Wave 4 integration: its own lazy chunk, fetched only while the lesson is still due —
 * ui/CoachMark mounts it — so GameRoot does not carry it on every later visit.)
 *
 * W9-F8 (review R§5 #14: "自动带路一开始，教学就被记为已学会" — any move faster than 0.8 marked it seen, so the tour and the
 * week's 带我去 marked it in 0.4–0.7 s, carried by BAYBAY, and phones never saw it):
 *   - only the PLAYER's own movement marks it seen: the stick / the keys / the pad (runtime.input.moveX / moveY) — a
 *     walk BAYBAY carries (auto-travel, a tour leg, tap-to-walk's path) never does; 8 s on screen counts as seen too;
 *   - it is a title-level message (game/attention.ts) of the lowest priority: it waits for a toast / card, never stacks
 *     on one, and after 2.5 s on screen anything else of the title level takes over — it comes back after that one
 *     (a toast no longer waits 10 s behind a hint and gets dropped); a bubble no longer hides it (a line is another level);
 *   - on touch: a 3 s ghost joystick at the lower left (where the floating stick appears) shows the thumb's drag;
 *   - one wording for turning the camera: 右边拖动转视角 / drag right to look (the coach, the title's controls line).
 */

/** Everything that must be absent for the coach mark (or any low-priority overlay) to show. */
function screenIsFree(): boolean {
  const s = game.get(), f = flow.get();
  return s.phase === 'playing' && s.mode !== 'onboarding' && !s.dialogue.nodeId && !s.panel.kind && !s.photoMode && !s.riding
    && s.move.mode === 'foot' && !f.cinematic && !cinemaActive() && !f.goalsCard && !f.fishing && !f.postcardReward && !f.postcardFly && !runtime.player.locked;
}

/** The player's own push (stick, keys, pad), not a path BAYBAY or a tap set. */
const ownMove = (): boolean => Math.abs(runtime.input.moveX) + Math.abs(runtime.input.moveY) > 0.3;
/** Below a plain toast (ATTENTION_PRIORITY.toast = 0): every other title message may take over after COACH_MIN_MS. */
const COACH_PRIORITY = -1;
const COACH_MIN_MS = 2500;
/** On screen this long (ms) counts as seen. */
const COACH_SEEN_MS = 8000;
/** The ghost joystick's demo (ms). */
const GHOST_MS = 3000;

const ghostBase: CSSProperties = {
  position: 'fixed', left: 'calc(18px + var(--ob-sl, 0px))', bottom: 'calc(max(6px, var(--ob-sb, 0px)) + 150px)', width: 96, height: 96, borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(255,250,241,.14) 0%, rgba(255,250,241,.32) 62%, rgba(255,250,241,.5) 100%)',
  border: '2px dashed rgba(255,255,255,.85)', pointerEvents: 'none', zIndex: 6,
};
const ghostKnob: CSSProperties = {
  position: 'absolute', left: 48, top: 48, width: 42, height: 42, marginLeft: -21, marginTop: -21, borderRadius: '50%',
  background: 'radial-gradient(circle at 35% 30%, #fffaf1 0%, #f3e6cc 70%, #e6d3ae 100%)', border: '2px solid #fff', opacity: 0.9,
};

/** W9-F8: the stick's drag, played once for GHOST_MS (the Web Animations API: no stylesheet change). */
function GhostStick() {
  const knob = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = knob.current;
    if (!el || typeof el.animate !== 'function') return;
    const a = el.animate([
      { transform: 'translate(0, 0)' }, { transform: 'translate(0, -26px)' }, { transform: 'translate(20px, -18px)' },
      { transform: 'translate(-20px, -18px)' }, { transform: 'translate(0, -26px)' }, { transform: 'translate(0, 0)' },
    ], { duration: GHOST_MS, easing: 'ease-in-out' });
    return () => a.cancel();
  }, []);
  return <div className="ob-ghost-stick" style={ghostBase} aria-hidden><div ref={knob} style={ghostKnob} /></div>;
}

/** (W9-I, F-RC-2: district mode never changes) the city gets W9-F8's coach; the district its pre-W9-F one. */
export default function CoachMarkBody() {
  const city = useGame(s => s.worldMode === 'city');
  return city ? <CityCoach /> : <DistrictCoach />;
}

function CityCoach() {
  const { t } = useT();
  const device = useDevice();
  const [want, setWant] = useState(false);
  const [ghost, setGhost] = useState(false);
  const done = useRef(coachSeen());
  // (W9-F8) a title-level message: it waits for a toast / card / the arrival card instead of stacking on it
  // taken over (another title message after COACH_MIN_MS): ask again at once under a new id — it queues behind that one
  // (a want toggle could be batched away into no change)
  const [gen, setGen] = useState(0);
  const show = useAttention('title', gen ? `coach:${gen}` : 'coach', want, { priority: COACH_PRIORITY, minMs: COACH_MIN_MS, maxWaitMs: 60_000, onDrop: () => setGen(g => g + 1) });
  const showRef = useRef(false);
  useEffect(() => { showRef.current = show; }, [show]);
  useEffect(() => {
    if (done.current) return;
    let freeSince = 0, shownFor = 0, last = performance.now(), ghosted = false;
    const id = window.setInterval(() => {
      const now = performance.now(), dt = now - last;
      last = now;
      // the player's own first move: the lesson landed (never BAYBAY carrying them)
      if (ownMove() && runtime.player.moving && game.get().phase === 'playing' && game.get().mode !== 'onboarding') {
        done.current = true; markCoachSeen(); setWant(false); setGhost(false); window.clearInterval(id); return;
      }
      if (!screenIsFree()) { freeSince = 0; setWant(false); return; }
      if (!freeSince) freeSince = now;
      if (now - freeSince < 1500) return;
      setWant(true);
      if (!showRef.current) return; // waiting for its turn (game/attention.ts)
      if (!ghosted && runtime.input.device === 'touch') { ghosted = true; setGhost(true); window.setTimeout(() => setGhost(false), GHOST_MS); }
      shownFor += dt;
      // (W9-I, F-RC-3: a player who only taps the ground, or rides the tour, kept the bar for good) 8 s on screen: seen, and it goes
      if (shownFor > COACH_SEEN_MS) { done.current = true; markCoachSeen(); setWant(false); setGhost(false); window.clearInterval(id); }
    }, 150);
    return () => window.clearInterval(id);
  }, []);
  if (!show) return null;
  return (
    <>
      {ghost && <GhostStick />}
      <div className={`ob-coach ${device === 'touch' ? 'is-touch' : ''}`} role="status" data-coach="move">
        {device === 'touch' ? (
          <span className="ob-coach-line"><Hand size={18} aria-hidden />{t('左边拖动走路 · 右边拖动转视角 · 点地面也能走', 'Drag left to walk · drag right to look · or tap the ground')}</span>
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
    </>
  );
}

/** The district's coach exactly as before W9-F8 (7a232652~1): any move marks it seen, 4 s on screen counts, a bubble hides it. */
function DistrictCoach() {
  const { t } = useT();
  const device = useDevice();
  const [show, setShow] = useState(false);
  const done = useRef(coachSeen());
  useEffect(() => {
    if (done.current) return;
    let freeSince = 0, shownFor = 0, last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now(), dt = now - last;
      last = now;
      const p = runtime.player;
      // first successful move: the lesson landed
      if (p.moving && p.speed > 0.8 && game.get().phase === 'playing' && game.get().mode !== 'onboarding') {
        done.current = true; markCoachSeen(); setShow(false); window.clearInterval(id); return;
      }
      if (!screenIsFree() || flow.get().bubble) { freeSince = 0; setShow(false); return; }
      if (!freeSince) freeSince = now;
      if (now - freeSince < 1500) return;
      setShow(true);
      shownFor += dt;
      if (shownFor > 4000) markCoachSeen(); // seen, but keep it up until the player moves or something covers it
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
