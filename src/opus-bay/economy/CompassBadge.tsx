import { useEffect, useState } from 'react';
import { runtime } from '../core/runtime';
import { useT } from '../i18n';
import { distanceText, nearestTurn, realMetres, screenAngle } from './compass';
import { compassTarget } from './shopRun';

/**
 * Wave 5 · lane E · W5-E6: the 寻宝罗盘's pill badge (ui/slots registerPillBadge 'e-compass', only while the compass is
 * on): 🧭 with an arrow turned toward the nearest unfound cache / egg / pebble as the camera sees it, and the real
 * distance (350 米 · 1.2 公里). Updated 4 times a second; ≤ 6 characters of text (the slot's rule).
 */

export function CompassBadge() {
  const { t, locale } = useT();
  const [s, setS] = useState<{ a: number; text: string } | null>(null);
  useEffect(() => {
    const tick = () => {
      const p = { x: runtime.player.x, z: runtime.player.z };
      const tg = compassTarget(p);
      const a = tg ? screenAngle(p.x, p.z, tg.x, tg.z, runtime.camera.yaw) : 0;
      const text = tg ? distanceText(realMetres(p, tg), locale !== 'en') : '';
      // W5-E-review: the arrow turns the short way (atan2 jumps by a full turn behind you, and the CSS transition spun it
      // all the way round), and the pill does not re-render 4 times a second while nothing it shows has changed
      setS(prev => {
        if (!tg) return prev ? null : prev;
        const turn = prev ? nearestTurn(prev.a, a) : a;
        return prev && prev.text === text && Math.abs(prev.a - turn) < 0.02 ? prev : { a: turn, text };
      });
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [locale]);
  return (
    <span className="ob-compass-badge" aria-label={s ? t(`寻宝罗盘：${s.text}`, `Treasure compass: ${s.text}`) : t('寻宝罗盘', 'Treasure compass')}>
      <span aria-hidden>🧭</span>
      {s && (
        <svg className="ob-compass-arrow" width="14" height="14" viewBox="0 0 14 14" aria-hidden style={{ transform: `rotate(${s.a}rad)` }}>
          <path d="M7 1.2 L11.2 11.6 L7 9.2 L2.8 11.6 Z" fill="currentColor" />
        </svg>
      )}
      {s && <span className="ob-compass-dist" aria-hidden>{s.text}</span>}
    </span>
  );
}
