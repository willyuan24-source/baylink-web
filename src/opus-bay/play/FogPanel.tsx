import { X } from 'lucide-react';
import { useEffect, useRef, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react';
import { useT } from '../i18n';
import { Keycap } from '../ui/common';
import { useDevice } from '../ui/hooks';
import { cancelFoghorn, CALL_LEN, fogGame, fogPress, fogRelease, fogSeq, SHIP_IN, SHIP_OUT, subscribeFog, type FogGame, type Horn } from './foghorn';
import { FOG_NAME } from './sfgames8Lines';
import './sfgames.css';
import './sfgames8.css';

/**
 * Wave 8 · lane M · the foghorns' panel (overlay 'play-foghorn', its own chunk): the Golden Gate from Fort Point on a
 * canvas — the south tower in International Orange, the main cable to mid-span, Fort Point's brick corner, the strait
 * and the fog (thicker each round) —, the ship of the round coming out of the fog, waiting while the bridge calls, then
 * sailing under the bridge (or dropping anchor); the horns light up and ring as they sound. Three thumb buttons: the
 * south tower's long horn (hold), the mid-span's high and low (tap); 1 2 3 or J K L on a keyboard. Shapes only on the
 * canvas: the words are under it.
 */

const W = 100, H = 60;
const ORANGE = '#c0362c';
const TOWER_X = 20, DECK_Y = 29, SEA_Y = 40;
const HORN_AT: Readonly<Record<Horn, { x: number; y: number }>> = { S: { x: TOWER_X, y: SEA_Y - 1.5 }, H: { x: 64, y: DECK_Y + 2.6 }, L: { x: 72, y: DECK_Y + 2.6 } };
const HORN_COL: Readonly<Record<Horn, string>> = { S: '#2f6f8f', H: '#e2a52a', L: '#3d9a6b' };

function bridge(c: CanvasRenderingContext2D) {
  // the main cable from the tower top, sagging to mid-span and up toward the north tower beyond the frame
  c.strokeStyle = ORANGE; c.lineWidth = 0.8;
  c.beginPath(); c.moveTo(TOWER_X, 4); c.quadraticCurveTo(80, 44, 140, 4); c.stroke();
  c.beginPath(); c.moveTo(TOWER_X, 4); c.quadraticCurveTo(10, 16, -2, 24); c.stroke();
  c.lineWidth = 0.18;
  for (let x = 24; x < 100; x += 3) { const t = (x - TOWER_X) / 120, y = (1 - t) * (1 - t) * 4 + 2 * (1 - t) * t * 44 + t * t * 4; c.beginPath(); c.moveTo(x, y); c.lineTo(x, DECK_Y); c.stroke(); }
  // the deck and its truss
  c.fillStyle = ORANGE; c.fillRect(-2, DECK_Y, 104, 1.6);
  c.fillStyle = '#9b2a22'; c.fillRect(-2, DECK_Y + 1.6, 104, 0.8);
  // the south tower: two legs, the portal struts, the pier
  c.fillStyle = ORANGE;
  c.fillRect(TOWER_X - 3.2, 2, 1.8, SEA_Y - 2); c.fillRect(TOWER_X + 1.4, 2, 1.8, SEA_Y - 2);
  for (const y of [5, 13, 21]) c.fillRect(TOWER_X - 3.2, y, 6.4, 1.2);
  c.fillStyle = '#9c9488'; c.fillRect(TOWER_X - 5, SEA_Y - 1, 10, 3);
}

function ship(c: CanvasRenderingContext2D, g: FogGame) {
  const k = g.round % 6;
  let x = 84, alpha = 1;
  if (g.phase === 'intro') return;
  if (g.phase === 'ship') x = 112 - (28 * Math.min(1, g.t / SHIP_IN));
  if (g.phase === 'pass') x = 84 - 104 * Math.min(1, g.t / SHIP_OUT);
  if (g.phase === 'anchor') alpha = 0.55;
  if (g.phase === 'done') return;
  const y = SEA_Y + 4.5 + Math.sin(g.clock * 2.2) * 0.3;
  c.save();
  c.globalAlpha = alpha;
  c.translate(x, y);
  // hulls of six kinds: a container ship, a sailboat, a tanker, a ferry, a fishing boat, a container ship
  c.fillStyle = ['#36414f', '#f4f1ea', '#5c3a32', '#f4f1ea', '#2f6f8f', '#7a2a1f'][k];
  c.beginPath(); c.moveTo(-9, -2); c.lineTo(9, -2); c.lineTo(7, 1.5); c.lineTo(-8, 1.5); c.closePath(); c.fill();
  if (k === 0 || k === 5) { const cols = ['#d8433a', '#2f8f86', '#f0b429', '#7b5ea7']; for (let i = 0; i < 6; i++) { c.fillStyle = cols[(i + k) % 4]; c.fillRect(-6 + i * 2, -4.4, 1.9, 2.4); } c.fillStyle = '#f4f1ea'; c.fillRect(5, -6.5, 2.6, 4.5); }
  if (k === 1) { c.fillStyle = '#5d574f'; c.fillRect(-0.2, -11, 0.4, 9); c.fillStyle = '#fffaf1'; c.beginPath(); c.moveTo(0.4, -10.5); c.lineTo(6, -2.5); c.lineTo(0.4, -2.5); c.fill(); c.beginPath(); c.moveTo(-0.4, -9); c.lineTo(-5, -2.5); c.lineTo(-0.4, -2.5); c.fill(); }
  if (k === 2) { c.fillStyle = '#8d8a83'; c.fillRect(-7, -3.2, 11, 1.2); c.fillStyle = '#f4f1ea'; c.fillRect(4.5, -6.5, 3, 4.5); }
  if (k === 3) { c.fillStyle = '#2f8f86'; c.fillRect(-6, -4.6, 12, 2.6); c.fillStyle = '#cfe6ee'; for (let i = 0; i < 6; i++) c.fillRect(-5.4 + i * 2, -4, 1.2, 1.2); }
  if (k === 4) { c.fillStyle = '#efe2c4'; c.fillRect(-2, -5, 4, 3); c.strokeStyle = '#5d574f'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(4, -2); c.lineTo(8, -9); c.stroke(); }
  if (g.phase === 'anchor') { c.strokeStyle = '#3b3631'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-6, 1.5); c.lineTo(-6, 4); c.stroke(); c.beginPath(); c.arc(-6, 3.6, 0.8, 0, Math.PI); c.stroke(); }
  c.restore();
}

function hornMark(c: CanvasRenderingContext2D, h: Horn, lit: number, now: number) {
  const p = HORN_AT[h];
  // the horn: a little flared trumpet pointing to the strait
  c.fillStyle = lit > 0 ? HORN_COL[h] : '#5d574f';
  c.beginPath(); c.moveTo(p.x - 1.4, p.y - 0.5); c.lineTo(p.x + 0.6, p.y - 0.5); c.lineTo(p.x + 1.8, p.y - 1.4); c.lineTo(p.x + 1.8, p.y + 1.4); c.lineTo(p.x + 0.6, p.y + 0.5); c.lineTo(p.x - 1.4, p.y + 0.5); c.closePath(); c.fill();
  if (lit <= 0) return;
  // the sound going out over the water: three arcs
  for (let k = 0; k < 3; k++) {
    const ph = ((now * 1.6 + k / 3) % 1);
    c.strokeStyle = `rgba(255,255,255,${(1 - ph) * 0.9 * lit})`;
    c.lineWidth = 0.6;
    c.beginPath(); c.arc(p.x + 1.8, p.y, 1.5 + ph * (h === 'S' ? 9 : 6), -0.9, 0.9); c.stroke();
  }
}

function fog(c: CanvasRenderingContext2D, g: FogGame, now: number) {
  const d = g.fog;
  for (let k = 0; k < 7; k++) {
    const x = ((k * 23 + now * (2 + k % 3)) % 140) - 20, y = 14 + (k % 4) * 9;
    const gr = c.createRadialGradient(x, y, 1, x, y, 22);
    gr.addColorStop(0, `rgba(236,240,240,${0.8 * d})`); gr.addColorStop(1, 'rgba(236,240,240,0)');
    c.fillStyle = gr; c.fillRect(x - 22, y - 22, 44, 44);
  }
  c.fillStyle = `rgba(228,233,234,${0.42 * d})`; c.fillRect(0, 0, W, H);
}

function draw(c: CanvasRenderingContext2D, g: FogGame, now: number) {
  const sky = c.createLinearGradient(0, 0, 0, SEA_Y);
  sky.addColorStop(0, '#aebfc7'); sky.addColorStop(1, '#dfe6e6');
  c.fillStyle = sky; c.fillRect(0, 0, W, SEA_Y);
  c.fillStyle = '#3f6670'; c.fillRect(0, SEA_Y, W, H - SEA_Y);
  c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 0.25;
  for (let k = 0; k < 9; k++) { const y = SEA_Y + 2 + k * 2.2, o = (now * 3 + k * 7) % 10; c.beginPath(); for (let x = -10 + o; x < W; x += 10) { c.moveTo(x, y); c.lineTo(x + 4, y); } c.stroke(); }
  bridge(c);
  ship(c, g);
  // the horns: lit while the call sounds them, or while the player blows one
  const blowing = g.blown && g.clock - g.blown.at < CALL_LEN[g.blown.h] ? g.blown.h : null;
  for (const h of ['S', 'H', 'L'] as const) hornMark(c, h, g.calling === h || blowing === h || g.held?.h === h ? 1 : 0, now);
  fog(c, g, now);
  // Fort Point's brick corner in front
  c.fillStyle = '#a8573e'; c.fillRect(0, 47, 13, 13);
  c.fillStyle = '#8d4733'; for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) c.fillRect(k * 3.3 + (r % 2) * 1.6, 48 + r * 2.5, 2.8, 0.4);
  c.fillStyle = '#bdb3a2'; c.fillRect(0, 46, 14, 1.4);
  // the tune: a dot a horn (lit as the call plays it, filled as you answer)
  const tune = g.tune, n = tune.length;
  for (let i = 0; i < n; i++) {
    const x = 50 - (n - 1) * 2.6 + i * 5.2, y = 4.5;
    const done = g.phase === 'answer' ? i < g.got : g.phase === 'pass';
    c.fillStyle = done ? HORN_COL[tune[i]] : 'rgba(255,255,255,.75)';
    c.strokeStyle = HORN_COL[tune[i]]; c.lineWidth = 0.5;
    c.beginPath(); c.arc(x, y, tune[i] === 'S' ? 1.8 : 1.3, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  // the ships of the game: a dot each (green through, grey at anchor, white to come)
  for (let i = 0; i < g.tunes.length; i++) {
    const x = 84 + i * 2.6, y = 4.5, past = i < g.round || (i === g.round && (g.phase === 'pass' || g.phase === 'anchor'));
    c.fillStyle = !past ? 'rgba(255,255,255,.7)' : i === g.round && g.phase === 'anchor' ? '#9a948a' : '#3d9a6b';
    c.beginPath(); c.arc(x, y, 0.9, 0, Math.PI * 2); c.fill();
  }
}

const HORN_LABEL: Readonly<Record<Horn, { zh: string; en: string }>> = {
  S: { zh: '南塔 · 长音', en: 'South · long' }, H: { zh: '桥中 · 高', en: 'Mid · high' }, L: { zh: '桥中 · 低', en: 'Mid · low' },
};
const HORN_KEY: Readonly<Record<Horn, string>> = { S: '1', H: '2', L: '3' };

export default function FogPanel() {
  const { t } = useT();
  const device = useDevice();
  useSyncExternalStore(subscribeFog, fogSeq, fogSeq);
  const g = fogGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let id = 0;
    const frame = (now: number) => {
      const cv = canvasRef.current, gg = fogGame();
      if (cv && gg) {
        const dpr = Math.min(3, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        const c = cv.getContext('2d');
        if (c) { c.setTransform(dpr * w / W, 0, 0, dpr * h / H, 0, 0); draw(c, gg, now / 1000); }
        if (scoreRef.current) scoreRef.current.textContent = String(gg.score);
      }
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(id); const gg = fogGame(); if (gg?.held) fogRelease(gg.held.h); };
  }, []);

  if (!g) return null;
  const n = Math.min(g.round + 1, g.tunes.length);
  const hint = g.phase === 'intro' || g.phase === 'ship' ? t('一艘船从雾里开过来……', 'A ship is coming out of the fog…')
    : g.phase === 'call' ? (g.tries ? t('再听一遍……', 'Listen again…') : t('听！桥上的雾笛在叫……', 'Listen! The bridge is calling…'))
    : g.phase === 'answer' ? t('轮到你：照着吹！（南塔长音要按住）', 'Your turn: blow it back! (hold the south horn)')
    : g.phase === 'pass' ? t('船听见了，从桥下开过去啦！', 'The ship heard you: under the bridge it goes!')
    : t('这艘船先抛锚等一等……', 'This one drops anchor to wait…');
  const answering = g.phase === 'answer';
  const btn = (h: Horn) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ok */ } fogPress(h); },
    onPointerUp: () => fogRelease(h), onPointerCancel: () => fogRelease(h), onLostPointerCapture: () => fogRelease(h),
  });
  return (
    <div className="ob-sfg-panel is-fog" role="dialog" aria-label={t(FOG_NAME)}>
      <div className="ob-sfg-head">
        <strong>{t(FOG_NAME)}</strong>
        <span className="ob-sfg-run">{n} / {g.tunes.length}</span>
        <span className="ob-sfg-score" ref={scoreRef}>{g.score}</span>
        <button type="button" className="ob-sfg-x" onMouseDown={e => e.preventDefault()} onClick={cancelFoghorn} aria-label={t('放弃', 'Give up')}><X size={20} /></button>
      </div>
      <canvas ref={canvasRef} className="ob-sfg-canvas is-fog" aria-hidden="true" />
      <p className={`ob-sfg-hint${answering ? ' is-answer' : ''}`} aria-live="polite">{hint}</p>
      <div className={`ob-sfg-controls is-horns${answering ? '' : ' is-listening'}`}>
        {(['S', 'H', 'L'] as const).map(h => (
          <button key={h} type="button" onMouseDown={e => e.preventDefault()} className={`ob-sfg-btn is-horn is-${h}${g.held?.h === h ? ' is-held' : ''}`} {...btn(h)}>
            <i aria-hidden="true" />{t(HORN_LABEL[h])}{device !== 'touch' ? <Keycap>{HORN_KEY[h]}</Keycap> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
