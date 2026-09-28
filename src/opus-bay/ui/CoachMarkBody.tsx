import { useEffect, useRef, useState } from 'react';
import { Hand } from 'lucide-react';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { cinemaActive } from '../game/cinema';
import { flow } from '../game/flowStore';
import { useT } from '../i18n';
import { Keycap } from './common';
import { useDevice } from './hooks';
import { coachSeen, markCoachSeen } from './coachSeen';

/**
 * F2 · Onboarding coach mark: teaches movement in context, once. It waits until the screen is genuinely free
 * (playing, not the welcome, no dialogue / panel / cinematic / bubble / goals card, player not locked) for 1.5 s,
 * hides the moment anything else appears, and is marked as seen only after 4 s of unobstructed display or on the
 * first real move. (Wave 4 integration: its own lazy chunk, fetched only while the lesson is still due — ui/CoachMark
 * mounts it — so GameRoot does not carry it on every later visit.)
 */

/** Everything that must be absent for the coach mark (or any low-priority overlay) to show. */
function screenIsFree(): boolean {
  const s = game.get(), f = flow.get();
  return s.phase === 'playing' && s.mode !== 'onboarding' && !s.dialogue.nodeId && !s.panel.kind && !s.photoMode && !s.riding
    && s.move.mode === 'foot' && !f.cinematic && !cinemaActive() && !f.bubble && !f.goalsCard && !f.fishing && !f.postcardReward && !f.postcardFly && !runtime.player.locked;
}

export default function CoachMarkBody() {
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
      if (!screenIsFree()) { freeSince = 0; setShow(false); return; }
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
