import { BellRing, X } from 'lucide-react';
import { useEffect, useRef, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react';
import { pointAt } from '../data/transit';
import { useT } from '../i18n';
import { Keycap } from '../ui/common';
import { useDevice } from '../ui/hooks';
import { BELL_AFTER, BELL_BEFORE, cancelGrip, gripBell, gripGame, gripSeq, setGripHold, subscribeGrip, type GripGame } from './grip';
import { GRIP_NAME } from './sfgames8Lines';
import './sfgames.css';
import './sfgames8.css';

/** A mouse press never focuses a game button: Space stays the game's key. */
const keepFocus = (e: { preventDefault(): void }) => e.preventDefault();

/**
 * Wave 8 · lane M · the grip game's panel (overlay 'play-grip', its own chunk), at the bottom of the screen so the ride
 * banner stays in view: the track ahead on a canvas (drawn every animation frame from play/grip.ts's GripGame: the hill,
 * the red let-go stretches, the stop boards, the cross streets' bells, the car with its grip lever and the cable
 * glowing while it is held), the hint, and two thumb buttons — the bell (tap; H) and 拉闸 (hold; Space). The canvas draws
 * shapes only (no words): the words are the hint and the legend under it.
 */

const AHEAD = 62;
const BEHIND = 9;
const CAR_X = 16;
const W = 100, H = 36;

function draw(c: CanvasRenderingContext2D, g: GripGame, now: number) {
  const p = { x: 0, y: 0, z: 0, heading: 0, grade: 0 };
  const y0 = pointAt(g.line, g.s, p).y;
  const xOf = (ds: number) => CAR_X + (ds / AHEAD) * (W - CAR_X - 3);
  const yOf = (s: number) => {
    const dy = pointAt(g.line, s, p).y - y0;
    return Math.max(7, Math.min(H - 6, 22 - dy * 1.25));
  };
  // the sky (fog-grey) and the street under the track
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#cfe3ea'); sky.addColorStop(1, '#f4ead8');
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  const step = 1.5;
  c.beginPath();
  c.moveTo(0, H);
  for (let ds = -BEHIND; ds <= AHEAD; ds += step) c.lineTo(xOf(ds), yOf(g.s + g.dir * ds) + 1.2);
  c.lineTo(W, H); c.closePath();
  c.fillStyle = '#8d8a83'; c.fill();
  // the let-go stretches: red stripes along the track
  for (const z of g.zones) {
    const a = (z.a - g.s) * g.dir, b = (z.b - g.s) * g.dir;
    if (b < -BEHIND || a > AHEAD) continue;
    for (let ds = Math.max(a, -BEHIND); ds < Math.min(b, AHEAD); ds += step) {
      const x0 = xOf(ds), x1 = xOf(Math.min(ds + step, b)), y = yOf(g.s + g.dir * ds);
      c.fillStyle = (Math.floor(ds / 2) % 2 === 0) ? '#d8433a' : '#f2b3a6';
      c.fillRect(x0, y - 2.2, x1 - x0 + 0.1, 3.6);
    }
  }
  // the track and the cable slot (glowing while the grip holds it)
  c.lineWidth = 0.8;
  c.strokeStyle = '#3b3631';
  c.beginPath();
  for (let ds = -BEHIND; ds <= AHEAD; ds += step) { const x = xOf(ds), y = yOf(g.s + g.dir * ds); if (ds === -BEHIND) c.moveTo(x, y); else c.lineTo(x, y); }
  c.stroke();
  c.setLineDash([1.2, 1.2]);
  c.lineWidth = g.grip ? 0.9 : 0.5;
  c.strokeStyle = g.grip ? '#f0b429' : '#5d574f';
  c.beginPath();
  for (let ds = -BEHIND; ds <= AHEAD; ds += step) { const x = xOf(ds), y = yOf(g.s + g.dir * ds) + 1.6; if (ds === -BEHIND) c.moveTo(x, y); else c.lineTo(x, y); }
  c.stroke();
  c.setLineDash([]);
  // the stops: a little board on a post
  for (const st of g.stops) {
    const ds = (st.at - g.s) * g.dir;
    if (ds < -BEHIND || ds > AHEAD) continue;
    const x = xOf(ds), y = yOf(st.at);
    c.fillStyle = '#5d574f'; c.fillRect(x - 0.25, y - 9, 0.5, 9);
    c.fillStyle = '#fffaf1'; c.fillRect(x - 2.6, y - 12.2, 5.2, 4);
    c.fillStyle = '#c8452c'; c.fillRect(x - 2.6, y - 12.2, 5.2, 1.3);
  }
  // the cross streets' bells: gold to ring, a ring round the ones in reach, green when rung, grey when missed
  for (const b of g.bells) {
    const ds = (b.at - g.s) * g.dir;
    if (ds < -BEHIND || ds > AHEAD) continue;
    const x = xOf(ds), y = yOf(b.at) - 15;
    const inReach = !b.rung && !b.passed && ds <= BELL_BEFORE && ds >= -BELL_AFTER;
    if (inReach) {
      const pulse = 0.5 + 0.5 * Math.sin(now * 9);
      c.strokeStyle = `rgba(240, 180, 41, ${0.5 + 0.5 * pulse})`; c.lineWidth = 0.7;
      c.beginPath(); c.arc(x, y + 0.6, 4 + pulse * 0.8, 0, Math.PI * 2); c.stroke();
    }
    c.fillStyle = b.rung ? '#3d9a6b' : b.passed ? '#b9b2a6' : '#e2a52a';
    c.beginPath();
    c.moveTo(x - 2.2, y + 2.2); c.quadraticCurveTo(x - 2, y - 2.4, x, y - 2.6); c.quadraticCurveTo(x + 2, y - 2.4, x + 2.2, y + 2.2); c.closePath(); c.fill();
    c.beginPath(); c.arc(x, y + 2.6, 0.7, 0, Math.PI * 2); c.fill();
    // the crossing line's rails across ours: a short dark band over the track
    if (b.cross) { c.fillStyle = '#3b3631'; c.fillRect(x - 0.9, y + 12.6, 1.8, 3.6); }
  }
  // the car: a toy cable car on the slope, its grip lever back (holding) or forward (let go)
  const yc = yOf(g.s), pitch = Math.atan2(yOf(g.s + g.dir * 2) - yOf(g.s - g.dir * 2), xOf(2) - xOf(-2));
  c.save();
  c.translate(xOf(0), yc);
  c.rotate(pitch);
  c.fillStyle = '#7a2a1f'; c.fillRect(-7, -1.2, 14, 1.2);
  c.fillStyle = '#b8352a'; c.fillRect(-6.5, -6.2, 13, 5);
  c.fillStyle = '#efe2c4'; c.fillRect(-6.5, -8.4, 13, 2.2);
  c.fillStyle = '#5a3d2a'; c.fillRect(-7.3, -9.3, 14.6, 1);
  c.fillStyle = '#cfe6ee';
  for (let k = -5; k <= 3; k += 2.7) c.fillRect(k, -5.4, 1.8, 2.4);
  c.fillStyle = '#2b2622';
  c.beginPath(); c.arc(-4.2, 0.2, 1, 0, Math.PI * 2); c.arc(4.2, 0.2, 1, 0, Math.PI * 2); c.fill();
  // the lever at the front (the way it goes is +x)
  c.strokeStyle = '#2b2622'; c.lineWidth = 0.8; c.lineCap = 'round';
  c.beginPath(); c.moveTo(5, -1); c.lineTo(5 + (g.grip ? -2.4 : 2.4), -7.5); c.stroke();
  c.fillStyle = g.grip ? '#f0b429' : '#8d8a83';
  c.beginPath(); c.arc(5 + (g.grip ? -2.4 : 2.4), -7.5, 0.9, 0, Math.PI * 2); c.fill();
  c.restore();
  // the last judgement: a ✓ or a ✗ over the car for a moment
  if (g.last && g.t - g.last.at < 0.7) {
    const good = /ok$/.test(g.last.ev);
    const bad = g.last.ev === 'alarm' || /bad|late|miss$/.test(g.last.ev);
    if (good || bad) {
      c.fillStyle = good ? '#3d9a6b' : '#d8433a';
      c.font = 'bold 7px sans-serif'; c.textAlign = 'center';
      c.fillText(good ? '✓' : '✗', xOf(0), yc - 12 - (g.t - g.last.at) * 6);
    }
  }
}

export default function GripPanel() {
  const { t } = useT();
  const device = useDevice();
  useSyncExternalStore(subscribeGrip, gripSeq, gripSeq);
  const g = gripGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef<HTMLElement>(null);
  const scoreRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let id = 0;
    const frame = (now: number) => {
      const cv = canvasRef.current, gg = gripGame();
      if (cv && gg) {
        const dpr = Math.min(3, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        const c = cv.getContext('2d');
        if (c) { c.setTransform(dpr * w / W, 0, 0, dpr * h / H, 0, 0); draw(c, gg, now / 1000); }
        if (clockRef.current) clockRef.current.style.width = `${(gg.timeLeft / 60) * 100}%`;
        if (scoreRef.current) scoreRef.current.textContent = String(gg.score);
      }
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(id); setGripHold(false); };
  }, []);

  if (!g) return null;
  const key = (k: string) => (device !== 'touch' ? <Keycap>{k}</Keycap> : null);
  const hold = {
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ok */ } setGripHold(true); },
    onPointerUp: () => setGripHold(false), onPointerCancel: () => setGripHold(false), onLostPointerCapture: () => setGripHold(false),
  };
  const want = g.want, bell = g.bellNow, red = g.inZone(g.s) || !!g.zoneAhead();
  const hint = bell ? (want === 'release' ? t('松开拉闸，摇铃过路口！', 'Let go, and ring across!') : t('路口到了：摇铃！（拉闸别松）', 'A crossing: ring the bell! (keep gripping)'))
    : want === 'release' ? (red ? t('红色路段：松开拉闸，滑过去！', 'Red stretch: let go and coast!') : t('要进站了：松开拉闸，刹车～', 'A stop ahead: let go and brake.'))
    : want === 'wait' ? t('停站中……发车时再拉闸', 'At the stop… grip again as we leave')
    : t('按住「拉闸」，抓紧缆绳上坡！', 'Hold “Grip” to take the cable up the hill!');
  return (
    <div className="ob-sfg-panel is-grip" role="dialog" aria-label={t(GRIP_NAME)}>
      <div className="ob-sfg-head">
        <strong>{t(GRIP_NAME)}</strong>
        <span className="ob-sfg-score" ref={scoreRef}>{g.score}</span>
        <button type="button" className="ob-sfg-x" onClick={cancelGrip} aria-label={t('放弃', 'Give up')}><X size={20} /></button>
      </div>
      <div className="ob-sfg-clock"><i ref={clockRef} /></div>
      <canvas ref={canvasRef} className="ob-sfg-canvas is-grip" aria-hidden="true" />
      <p className={`ob-sfg-hint is-${bell ? 'bell' : want}`} aria-live="polite">{hint}</p>
      <div className="ob-sfg-controls">
        <button type="button" onMouseDown={keepFocus} className="ob-sfg-btn is-bell" onPointerDown={e => { e.preventDefault(); gripBell(); }} aria-label={t('摇铃', 'Ring the bell')}>
          <BellRing size={22} aria-hidden />{t('摇铃', 'Bell')}{key('H')}
        </button>
        <button type="button" className={`ob-sfg-btn is-go is-hold is-grip${g.grip ? ' is-held' : ''}`} {...hold}>
          {g.grip ? t('抓住缆绳', 'Gripping') : t('拉闸（按住）', 'Grip (hold)')}{key(t('空格', 'Space'))}
        </button>
      </div>
      <p className="ob-sfg-foot"><i className="ob-sfg-key is-red" />{t('松闸滑行', 'let go')} · <i className="ob-sfg-key is-bell" />{t('摇铃', 'ring')} · <i className="ob-sfg-key is-stop" />{t('进站先松闸', 'let go to stop')}</p>
    </div>
  );
}
