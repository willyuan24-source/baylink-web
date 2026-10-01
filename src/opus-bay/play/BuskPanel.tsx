import { X } from 'lucide-react';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useT } from '../i18n';
import { Keycap } from '../ui/common';
import { useDevice } from '../ui/hooks';
import { buskGame, buskSeq, buskTap, buskWithBusker, cancelBusk, LEAD, subscribeBusk, type BuskGame } from './busk';
import { BUSK_NAME } from './sfgames8Lines';
import './sfgames.css';
import './sfgames8.css';

/** A mouse press never focuses a game button: Space stays the game's key. */
const keepFocus = (e: { preventDefault(): void }) => e.preventDefault();

/**
 * Wave 8 · lane M · the busker jam's panel (overlay 'play-busk', its own chunk): the street on a canvas (Haight St's
 * painted fronts or 24th St's papel picado and a mural of shapes), the busker strumming — or BAYBAY with a toy ukulele
 * when he is not out —, his open guitar case filling with coins, and the track: dots slide in from the right to the
 * ring (the tambourine / the maracas) and you tap as each one meets it. One big button (and a tap anywhere on the
 * picture) for one thumb; Space / Enter / J / F on a keyboard. The canvas draws shapes only: the words are under it.
 */

const W = 100, H = 58;
const RING_X = 34, TRACK_Y = 27, TRACK_END = 97;

function figure(c: CanvasRenderingContext2D, g: BuskGame, busker: boolean, beatPh: number) {
  const x = 15, y = 51;
  const swing = Math.sin(beatPh * Math.PI * 2) * 0.35;
  if (busker) {
    // legs, shirt, head, hair; the guitar across the body; the strumming arm
    c.fillStyle = '#3d4f6b'; c.fillRect(x - 2.2, y - 8, 1.7, 8); c.fillRect(x + 0.5, y - 8, 1.7, 8);
    c.fillStyle = g.song.style === 'mission' ? '#c8452c' : '#6f8f4e'; c.fillRect(x - 3, y - 17, 6, 9.5);
    c.fillStyle = '#e7b98f'; c.beginPath(); c.arc(x, y - 20, 2.8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3a2a22'; c.beginPath(); c.arc(x, y - 21, 2.9, Math.PI, Math.PI * 2); c.fill();
    c.fillStyle = '#b8743a'; c.beginPath(); c.ellipse(x + 1.6, y - 11, 3.6, 2.7, -0.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3b2a20'; c.beginPath(); c.arc(x + 1.6, y - 11, 0.9, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#5a3d2a'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x + 0.5, y - 11.5); c.lineTo(x - 6, y - 15.5); c.stroke();
    c.strokeStyle = '#e7b98f'; c.lineWidth = 1.1; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x + 2.5, y - 15.5); c.lineTo(x + 2.4 + swing * 3, y - 11.5 + swing * 1.5); c.stroke();
  } else {
    // BAYBAY: a round cream otter with a teal scarf and a toy ukulele
    c.fillStyle = '#efe2c8'; c.beginPath(); c.ellipse(x, y - 7, 5.2, 7, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x, y - 16.5, 4.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x - 3.4, y - 19.6, 1.2, 0, Math.PI * 2); c.arc(x + 3.4, y - 19.6, 1.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2b2622'; c.beginPath(); c.arc(x - 1.5, y - 17, 0.55, 0, Math.PI * 2); c.arc(x + 1.5, y - 17, 0.55, 0, Math.PI * 2); c.arc(x, y - 15.6, 0.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2f8f86'; c.fillRect(x - 4, y - 13.2, 8, 1.8); c.fillRect(x + 1.5, y - 13, 1.6, 4);
    c.fillStyle = '#d99a4a'; c.beginPath(); c.ellipse(x + 1.2, y - 7.5, 2.6, 2, -0.35, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#7a4a22'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x + 0.2, y - 8); c.lineTo(x - 4.2, y - 10.6); c.stroke();
    c.strokeStyle = '#efe2c8'; c.lineWidth = 1.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x + 4, y - 10.5); c.lineTo(x + 2.6 + swing * 2.5, y - 7.5 + swing); c.stroke();
  }
  // the open guitar case with its coins
  c.fillStyle = '#2b2622'; c.fillRect(x - 12, y + 1, 12, 4.2);
  c.fillStyle = '#8a2f3a'; c.fillRect(x - 11.4, y + 1.5, 10.8, 3.2);
  const n = Math.min(24, g.coins + 2);
  for (let k = 0; k < n; k++) {
    c.fillStyle = k % 3 ? '#e7c25a' : '#d7d2c4';
    c.beginPath(); c.arc(x - 10.6 + ((k * 4.3) % 9.6), y + 2.2 + ((k * 7) % 3) * 0.75, 0.55, 0, Math.PI * 2); c.fill();
  }
}

function street(c: CanvasRenderingContext2D, g: BuskGame) {
  if (g.song.style === 'mission') {
    c.fillStyle = '#f3dcb5'; c.fillRect(0, 0, W, H);
    // a mural of shapes on the wall (a sun, leaves, waves: no copy of a real mural)
    c.fillStyle = '#2f8f86'; c.fillRect(46, 6, 52, 34);
    c.fillStyle = '#f0b429'; c.beginPath(); c.arc(84, 17, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c8452c'; for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(52 + k * 9, 33, 4, 7, 0.5, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#7b5ea7'; c.beginPath(); c.moveTo(46, 40); for (let k = 0; k <= 13; k++) c.lineTo(46 + k * 4, 36 + (k % 2) * 3); c.lineTo(98, 40); c.fill();
    // papel picado across the top
    const cols = ['#d8433a', '#f0b429', '#2f8f86', '#e86fa0', '#7b5ea7'];
    c.strokeStyle = '#5d574f'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(0, 2); c.quadraticCurveTo(50, 6, 100, 2); c.stroke();
    for (let k = 0; k < 12; k++) { const px = 3 + k * 8.3, py = 2 + Math.sin((px / 100) * Math.PI) * 3.6; c.fillStyle = cols[k % cols.length]; c.fillRect(px, py, 5.2, 4.6); }
  } else {
    c.fillStyle = '#d9ecf0'; c.fillRect(0, 0, W, H);
    // painted Victorian fronts with bay windows
    const fronts: [number, number, string][] = [[0, 30, '#8d6bb0'], [30, 24, '#f2c14e'], [54, 24, '#4fa3a5'], [78, 22, '#e07a5f']];
    for (const [x0, w, col] of fronts) {
      c.fillStyle = col; c.fillRect(x0, 4, w, 40);
      c.fillStyle = '#fff6e6'; c.fillRect(x0, 4, w, 2); c.fillRect(x0 + 2, 24, w - 4, 1);
      c.fillStyle = 'rgba(255,255,255,.75)';
      for (const wy of [9, 28]) { c.fillRect(x0 + w / 2 - 6, wy, 3.4, 8); c.fillRect(x0 + w / 2 - 1.7, wy - 1, 3.4, 9); c.fillRect(x0 + w / 2 + 2.6, wy, 3.4, 8); }
    }
  }
  // the sidewalk
  c.fillStyle = '#c9c1b2'; c.fillRect(0, 44, W, 14);
  c.fillStyle = '#b7ae9e'; for (let k = 0; k < 10; k++) c.fillRect(k * 10, 44, 0.3, 14);
}

function track(c: CanvasRenderingContext2D, g: BuskGame, now: number) {
  const s = g.song, beatPh = (g.t / s.beat) % 1;
  c.fillStyle = 'rgba(255,250,241,.88)';
  c.beginPath(); c.roundRect(RING_X - 7, TRACK_Y - 6, TRACK_END - RING_X + 10, 12, 6); c.fill();
  c.strokeStyle = 'rgba(59,54,49,.25)'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(RING_X, TRACK_Y); c.lineTo(TRACK_END, TRACK_Y); c.stroke();
  // the beats' ticks
  const first = Math.ceil(g.t / s.beat);
  for (let b = first; b * s.beat - g.t <= LEAD; b++) {
    const x = RING_X + ((b * s.beat - g.t) / LEAD) * (TRACK_END - RING_X);
    c.fillStyle = b % 4 === 0 ? 'rgba(59,54,49,.35)' : 'rgba(59,54,49,.15)';
    c.fillRect(x - 0.15, TRACK_Y - 4, 0.3, 8);
  }
  // the ring: the instrument, pulsing on the beat
  const pulse = 1 + Math.max(0, 1 - beatPh * 4) * 0.12;
  const flash = g.last && g.t - g.last.at < 0.3 ? g.last.ev : null;
  const ringCol = flash === 'perfect' ? '#3d9a6b' : flash === 'good' ? '#e2a52a' : flash === 'miss' || flash === 'off' ? '#9a948a' : flash === 'stray' ? '#d8433a' : '#3b3631';
  c.strokeStyle = ringCol; c.lineWidth = 0.9;
  c.beginPath(); c.arc(RING_X, TRACK_Y, 4.4 * pulse, 0, Math.PI * 2); c.stroke();
  if (s.style === 'haight') {
    c.fillStyle = '#f4e3bf'; c.beginPath(); c.arc(RING_X, TRACK_Y, 3.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c9a23a'; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; c.fillRect(RING_X + Math.cos(a) * 3.3 - 0.5, TRACK_Y + Math.sin(a) * 3.3 - 0.5, 1, 1); }
  } else {
    c.fillStyle = '#d8433a'; c.beginPath(); c.ellipse(RING_X - 1.1, TRACK_Y - 0.6, 1.7, 2.1, -0.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3d9a6b'; c.beginPath(); c.ellipse(RING_X + 1.3, TRACK_Y + 0.4, 1.7, 2.1, 0.3, 0, Math.PI * 2); c.fill();
  }
  if (flash && (flash === 'perfect' || flash === 'good')) {
    const k = (g.t - g.last!.at) / 0.3;
    c.strokeStyle = flash === 'perfect' ? `rgba(61,154,107,${1 - k})` : `rgba(226,165,42,${1 - k})`;
    c.lineWidth = 0.6; c.beginPath(); c.arc(RING_X, TRACK_Y, 4.6 + k * 4, 0, Math.PI * 2); c.stroke();
  }
  // the dots still to play (off-beats smaller), the missed ones fading out past the ring
  for (let i = Math.max(0, g.first - 2); i < s.notes.length; i++) {
    const dt = g.at(i) - g.t;
    if (dt > LEAD) break;
    const st = g.state[i];
    if (st === 1 || st === 2) continue;
    const x = RING_X + (dt / LEAD) * (TRACK_END - RING_X);
    if (x < RING_X - 6) continue;
    const off = s.notes[i] % 1 !== 0;
    c.fillStyle = st === 3 ? 'rgba(154,148,138,.6)' : s.style === 'mission' ? (off ? '#e86f4f' : '#c8452c') : (off ? '#e2a52a' : '#c98a12');
    c.beginPath(); c.arc(x, TRACK_Y, off ? 1.6 : 2.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(x - 0.5, TRACK_Y - 0.6, off ? 0.5 : 0.7, 0, Math.PI * 2); c.fill();
  }
  // the clock and the run (shapes only: the numbers are on the panel)
  void now;
}

function draw(c: CanvasRenderingContext2D, g: BuskGame, busker: boolean, now: number) {
  street(c, g);
  figure(c, g, busker, (g.t / g.song.beat) % 1);
  track(c, g, now);
}

export default function BuskPanel() {
  const { t } = useT();
  const device = useDevice();
  useSyncExternalStore(subscribeBusk, buskSeq, buskSeq);
  const g = buskGame();
  const busker = buskWithBusker() ?? true;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef<HTMLElement>(null);
  const scoreRef = useRef<HTMLElement>(null);
  const runRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let id = 0;
    const frame = (now: number) => {
      const cv = canvasRef.current, gg = buskGame();
      if (cv && gg) {
        const dpr = Math.min(3, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        const c = cv.getContext('2d');
        if (c) { c.setTransform(dpr * w / W, 0, 0, dpr * h / H, 0, 0); draw(c, gg, buskWithBusker() ?? true, now / 1000); }
        if (clockRef.current) clockRef.current.style.width = `${Math.max(0, 1 - gg.t / gg.end) * 100}%`;
        if (scoreRef.current) scoreRef.current.textContent = String(gg.score);
        if (runRef.current) runRef.current.textContent = gg.run >= 2 ? `×${gg.run}` : '';
      }
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, []);

  if (!g) return null;
  const mission = g.song.style === 'mission';
  const intro = g.t < g.at(0) - 1;
  const hint = intro ? (busker ? t('先听前奏……圆点碰到圈就拍！', 'Listen in… tap as each dot meets the ring!') : t('BAYBAY 先弹前奏……圆点碰到圈就拍！', 'BAYBAY plays the intro… tap as each dot meets the ring!'))
    : g.inChorus ? t('副歌！节奏变密啦～', 'The chorus! More beats now!')
    : mission ? t('沙锤摇在反拍上：咚——沙！', 'Shake on the off-beat: boom — shh!') : t('铃鼓拍在二、四拍：嘣——啪！', 'Tambourine on two and four: boom — tsh!');
  const key = device !== 'touch' ? <Keycap>{t('空格', 'Space')}</Keycap> : null;
  const tap = (e: { preventDefault(): void }) => { e.preventDefault(); buskTap(); };
  return (
    <div className="ob-sfg-panel is-busk" role="dialog" aria-label={t(BUSK_NAME)}>
      <div className="ob-sfg-head">
        <strong>{t(BUSK_NAME)}</strong>
        <span className="ob-sfg-run" ref={runRef} aria-hidden="true" />
        <span className="ob-sfg-score" ref={scoreRef}>{g.score}</span>
        <button type="button" className="ob-sfg-x" onMouseDown={keepFocus} onClick={cancelBusk} aria-label={t('放弃', 'Give up')}><X size={20} /></button>
      </div>
      <div className="ob-sfg-clock"><i ref={clockRef} /></div>
      <canvas ref={canvasRef} className="ob-sfg-canvas is-busk" aria-hidden="true" onPointerDown={tap} />
      <p className="ob-sfg-hint" aria-live="polite">{hint}</p>
      <div className="ob-sfg-controls">
        <button type="button" onMouseDown={keepFocus} className="ob-sfg-btn is-go is-tap" onPointerDown={tap}>
          {mission ? t('摇沙锤', 'Shake') : t('拍铃鼓', 'Tap')}{key}
        </button>
      </div>
    </div>
  );
}
