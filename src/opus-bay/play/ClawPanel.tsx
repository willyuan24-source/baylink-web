import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react';
import { useT } from '../i18n';
import { Keycap } from '../ui/common';
import { useDevice } from '../ui/hooks';
import { AIM_SECONDS, CAB_W, cancelClaw, clawGame, clawSeq, clawSet, dropClaw, PRIZE_KINDS, setClawDir, setCount, subscribeClaw, aimClaw } from './claw';
import { clawHead, drawAimLine, drawCabinet, drawClaw, drawPrize, HELD_BELOW, ROW_Y } from './clawArt';
import { CLAW_NAME } from './sfgamesLines';
import './sfgames.css';

/** A mouse press never focuses a game button: Space stays the game's key (a focused button would take it). */
const keepFocus = (e: { preventDefault(): void }) => e.preventDefault();

/**
 * Wave 7 · lane M · the claw machine's panel (overlay 'play-claw', its own chunk): the glass cabinet on a canvas (drawn
 * every animation frame from play/claw.ts's ClawGame; React re-renders only on a new phase), the quarters left, the aim
 * clock, and the controls — one thumb: drag in the glass to aim and lift to drop (a tap aims there and drops); or hold ◀ ▶
 * and press 抓！ (≥ 56 px); keys ← → / A D and Space / Enter / ↓. ✕ gives up (nothing paid).
 */

const CAB_H = 80;

export default function ClawPanel() {
  const { t } = useT();
  const device = useDevice();
  useSyncExternalStore(subscribeClaw, clawSeq, clawSeq);
  const game = clawGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef<HTMLElement>(null);
  const dragging = useRef(false);
  const stripRef = useRef<HTMLCanvasElement>(null);
  const setMask = clawSet();
  // the collection: the eight souvenirs in a row, the ones won in colour, the rest as faint shapes
  useEffect(() => {
    const cv = stripRef.current;
    if (!cv) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1), w = cv.clientWidth || 200, h = cv.clientHeight || 26;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const c = cv.getContext('2d');
    if (!c) return;
    const cell = 100 / PRIZE_KINDS.length;
    c.setTransform(dpr * w / 100, 0, 0, dpr * h / 14, 0, 0);
    c.clearRect(0, 0, 100, 14);
    PRIZE_KINDS.forEach((_, i) => {
      c.globalAlpha = setMask & (1 << i) ? 1 : 0.2;
      drawPrize(c, i, cell * (i + 0.5), 13, 0.85);
    });
    c.globalAlpha = 1;
  }, [setMask]);

  useEffect(() => {
    let id = 0;
    const draw = (now: number) => {
      const cv = canvasRef.current, g = clawGame();
      if (cv && g) {
        const dpr = Math.min(3, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        const c = cv.getContext('2d');
        if (c) {
          c.setTransform(dpr * w / CAB_W, 0, 0, dpr * h / CAB_H, 0, 0);
          drawCabinet(c, now / 1000);
          // the pile: the back row first
          for (const row of [1, 0] as const) g.prizes.forEach((p, i) => { if (!p.won && p.row === row && g.held !== i) drawPrize(c, p.kind, p.x, ROW_Y[row]); });
          if (g.phase === 'aim') drawAimLine(c, g.x);
          // a held prize under the hub, the fingers drawn over it
          if (g.held !== null) drawPrize(c, g.prizes[g.held].kind, g.x, clawHead(g.y) + HELD_BELOW);
          drawClaw(c, g.x, g.y, g.grip);
        }
        const clock = clockRef.current;
        if (clock) clock.style.width = `${(g.aimLeft / AIM_SECONDS) * 100}%`;
      }
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(id); setClawDir(0); };
  }, []);

  if (!game) return null;
  const aiming = game.phase === 'aim';
  const unitsAt = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return ((e.clientX - r.left) / Math.max(1, r.width)) * CAB_W;
  };
  const down = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!aiming) return;
    dragging.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* old browsers */ }
    aimClaw(unitsAt(e));
  };
  const move = (e: ReactPointerEvent<HTMLCanvasElement>) => { if (dragging.current) aimClaw(unitsAt(e)); };
  const up = (e: ReactPointerEvent<HTMLCanvasElement>) => { if (!dragging.current) return; dragging.current = false; aimClaw(unitsAt(e), true); };
  const hold = (d: -1 | 1) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ok */ } setClawDir(d); },
    onPointerUp: () => setClawDir(0), onPointerCancel: () => setClawDir(0), onLostPointerCapture: () => setClawDir(0),
  });
  const mask = clawSet(), kinds = setCount(mask);
  const hint = device === 'touch'
    ? t('在玻璃里拖动爪子，松手就抓', 'Drag the claw in the glass, let go to grab')
    : t('← → 移动 · 空格 抓 · 也可以用鼠标拖', '← → to move · Space to grab · or drag with the mouse');
  return (
    <div className="ob-sfg-panel is-claw" role="dialog" aria-label={t(CLAW_NAME)}>
      <div className="ob-sfg-head">
        <strong>{t(CLAW_NAME)}</strong>
        <span className="ob-sfg-coins" aria-label={t(`还剩 ${game.tries} 枚硬币`, `${game.tries} quarters left`)}>
          {Array.from({ length: 5 }, (_, i) => <i key={i} className={i < game.tries ? 'is-on' : ''} />)}
        </span>
        <button type="button" className="ob-sfg-x" onClick={cancelClaw} aria-label={t('放弃', 'Give up')}><X size={20} /></button>
      </div>
      <div className="ob-sfg-clock"><i ref={clockRef} /></div>
      <canvas ref={canvasRef} className="ob-sfg-canvas is-claw" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { dragging.current = false; }} />
      <p className="ob-sfg-hint">{aiming ? hint : game.phase === 'done' ? '' : t('爪子在动……', 'The claw is on its way…')}</p>
      <div className="ob-sfg-controls">
        <button type="button" onMouseDown={keepFocus} className="ob-sfg-btn is-dir" disabled={!aiming} aria-label={t('向左', 'Left')} {...hold(-1)}><ChevronLeft size={28} />{device !== 'touch' && <Keycap>←</Keycap>}</button>
        <button type="button" onMouseDown={keepFocus} className="ob-sfg-btn is-go" disabled={!aiming} onClick={dropClaw}>{t('抓！', 'Grab!')}{device !== 'touch' && <Keycap>{t('空格', 'Space')}</Keycap>}</button>
        <button type="button" onMouseDown={keepFocus} className="ob-sfg-btn is-dir" disabled={!aiming} aria-label={t('向右', 'Right')} {...hold(1)}><ChevronRight size={28} />{device !== 'touch' && <Keycap>→</Keycap>}</button>
      </div>
      <div className="ob-sfg-set">
        <canvas ref={stripRef} className="ob-sfg-strip" role="img" aria-label={t(`收集 ${kinds} / ${PRIZE_KINDS.length} 种纪念品`, `${kinds} / ${PRIZE_KINDS.length} souvenirs collected`)} />
        <span>{kinds} / {PRIZE_KINDS.length}{game.won.length ? t(` · 这次 ${game.won.length} 个`, ` · ${game.won.length} this time`) : ''}</span>
      </div>
    </div>
  );
}
