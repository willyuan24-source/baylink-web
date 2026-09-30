import { BAKE_S, GOLD_HI, GOLD_LO, GUIDES, type DoughGame, type DoughShape } from './dough';

/**
 * Wave 7 · lane M · the sourdough game's art on a 2D canvas (100 wide × 70 high, the caller scales the context): the
 * floured wooden table, the dough (squashed on each press), the closing ring of the knead, the three shapes (a round
 * boule, a crab with claws, a turtle with its head and feet), the guides and the blade of the scoring, and the oven with
 * the loaf browning behind its window. No text, no brand.
 */

type C = CanvasRenderingContext2D;
const INK = '#3b2a20';
const DOUGH = [243, 228, 196] as const, GOLD = [214, 152, 72] as const, BURNT = [92, 58, 34] as const;

/** The crust's colour for 0 (raw) … 1 (burnt): dough → golden at the band → dark. */
export function crustColor(c: number): string {
  const mid = (GOLD_LO + GOLD_HI) / 2;
  const [a, b, k] = c <= mid ? [DOUGH, GOLD, c / mid] : [GOLD, BURNT, (c - mid) / (1 - mid)];
  const mix = (i: number) => Math.round(a[i] + (b[i] - a[i]) * k);
  return `rgb(${mix(0)},${mix(1)},${mix(2)})`;
}

function table(c: C) {
  c.fillStyle = '#f7efe0'; c.fillRect(0, 0, 100, 70);
  c.fillStyle = '#c9955c'; c.fillRect(0, 44, 100, 26);
  c.fillStyle = '#b8844d'; for (let y = 48; y < 70; y += 6) c.fillRect(0, y, 100, 0.5);
  c.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 18; i++) { c.beginPath(); c.arc(20 + ((i * 53) % 60), 46 + ((i * 29) % 12), 0.5 + (i % 3) * 0.3, 0, Math.PI * 2); c.fill(); }
}

/** The loaf (or the dough) at (x, y) bottom-middle, width w, in a shape and a crust colour; `squash` 0…1 on a press. */
export function drawLoaf(c: C, shape: DoughShape, x: number, y: number, w: number, color: string, squash = 0, cuts: readonly number[] = []) {
  const h = w * 0.42 * (1 - squash * 0.25), ww = w * (1 + squash * 0.12);
  c.save(); c.translate(x, y);
  c.fillStyle = color; c.strokeStyle = INK; c.lineWidth = 0.5;
  const limb = (lx: number, ly: number, rx: number, ry: number) => { c.beginPath(); c.ellipse(lx, ly, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke(); };
  if (shape === 'crab') {
    for (const s of [-1, 1]) { limb(s * ww * 0.58, -h * 0.9, w * 0.12, w * 0.09); for (let i = 0; i < 3; i++) limb(s * (ww * 0.5 + i * 1.2), -h * 0.2 + i * 1.1, w * 0.07, w * 0.03); }
    c.beginPath(); c.ellipse(0, -h * 0.5, ww * 0.5, h * 0.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    for (const s of [-1, 1]) { c.beginPath(); c.arc(s * w * 0.1, -h * 0.95, w * 0.04, 0, Math.PI * 2); c.fillStyle = INK; c.fill(); c.fillStyle = color; }
  } else if (shape === 'turtle') {
    limb(ww * 0.55, -h * 0.45, w * 0.1, w * 0.08);
    for (const s of [-1, 1]) { limb(s * ww * 0.3, -h * 0.05, w * 0.08, w * 0.05); }
    c.beginPath(); c.ellipse(0, -h * 0.5, ww * 0.46, h * 0.52, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(59,42,32,0.35)'; c.lineWidth = 0.35;
    for (const dx of [-0.2, 0, 0.2]) { c.beginPath(); c.moveTo(dx * ww, -h * 0.9); c.lineTo(dx * ww * 1.3, -h * 0.15); c.stroke(); }
    c.beginPath(); c.arc(ww * 0.6, -h * 0.5, w * 0.018, 0, Math.PI * 2); c.fillStyle = INK; c.fill();
  } else {
    c.beginPath(); c.ellipse(0, -h * 0.5, ww * 0.5, h * 0.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  // a soft highlight, then the scores (cuts) across the top: each opens a little lighter
  c.beginPath(); c.ellipse(-ww * 0.12, -h * 0.72, ww * 0.22, h * 0.14, -0.2, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fill();
  for (const u of cuts) {
    const cx = (u - 0.5) * ww * 0.9;
    c.beginPath(); c.moveTo(cx - w * 0.05, -h * 0.92); c.quadraticCurveTo(cx + w * 0.02, -h * 0.6, cx + w * 0.05, -h * 0.25);
    c.strokeStyle = '#f7e6c4'; c.lineWidth = 1.1; c.stroke();
    c.strokeStyle = 'rgba(59,42,32,0.45)'; c.lineWidth = 0.3; c.stroke();
  }
  c.restore();
}

/** The whole step, from the game. */
export function drawDough(c: C, g: DoughGame, time: number) {
  table(c);
  if (g.phase === 'knead' || g.phase === 'shape') {
    // a press squashes the dough for a moment after each counted beat
    const last = g.beat > 0 ? g.beatAt(g.beat - 1) : -9, sq = Math.max(0, 1 - Math.abs(g.t - last) / 0.18);
    const hitNow = g.hits[g.beat - 1];
    drawLoaf(c, 'boule', 50, 52, 36, crustColor(0), hitNow && hitNow !== 'miss' ? sq : 0);
    if (g.phase === 'knead' && g.beat < 8) {
      // the ring closes on the dough: at the beat it sits on the dough's outline
      const until = g.beatAt(g.beat) - g.t, r = 14 + Math.max(0, until) * 22;
      c.beginPath(); c.ellipse(50, 44.5, r, r * 0.55, 0, 0, Math.PI * 2);
      c.strokeStyle = Math.abs(until) < 0.09 ? '#2f8a7a' : 'rgba(195,74,51,0.85)'; c.lineWidth = 1; c.stroke();
    }
    // the count of good presses as little flour hearts along the top
    g.hits.forEach((k, i) => { c.beginPath(); c.arc(14 + i * 10, 8, 2.4, 0, Math.PI * 2); c.fillStyle = k === 'perfect' ? '#2f8a7a' : k === 'good' ? '#e0a94a' : '#d8cfc0'; c.fill(); });
    return;
  }
  if (g.phase === 'score') {
    drawLoaf(c, g.shape, 50, 56, 44, crustColor(0), 0, g.cuts);
    c.save(); c.setLineDash([1.2, 1.2]); c.strokeStyle = 'rgba(59,42,32,0.55)'; c.lineWidth = 0.5;
    for (const gd of GUIDES) { if (g.cuts.some(u => Math.abs(u - gd) < 0.1)) continue; const x = 50 + (gd - 0.5) * 44 * 0.9; c.beginPath(); c.moveTo(x, 30); c.lineTo(x, 50); c.stroke(); }
    c.restore();
    // the blade (a baker's lame): a slim handle and a bright edge above the loaf
    const bx = 50 + (g.blade - 0.5) * 44 * 0.9;
    c.fillStyle = '#6b4a33'; c.fillRect(bx - 0.8, 10, 1.6, 12);
    c.fillStyle = '#d6dade'; c.beginPath(); c.moveTo(bx - 2, 22); c.lineTo(bx + 2, 22); c.lineTo(bx, 28); c.closePath(); c.fill();
    c.strokeStyle = INK; c.lineWidth = 0.3; c.stroke();
    return;
  }
  // the oven: brick, the door, the window with the loaf browning, a glow
  c.fillStyle = '#a4553a'; c.fillRect(10, 4, 80, 62);
  c.fillStyle = '#8c4630'; for (let y = 8; y < 66; y += 6) for (let x = (y / 6) % 2 ? 10 : 16; x < 90; x += 12) c.fillRect(x, y, 0.5, 6);
  c.fillStyle = '#3b3431'; c.fillRect(18, 12, 64, 46);
  const glow = 0.25 + 0.1 * Math.sin(time * 5);
  c.fillStyle = `rgba(255,160,70,${glow})`; c.fillRect(22, 16, 56, 38);
  c.fillStyle = '#6f6660'; c.fillRect(22, 46, 56, 2);
  drawLoaf(c, g.shape, 50, 46, 34, crustColor(g.phase === 'done' ? g.crust : Math.min(1, g.t / BAKE_S)), 0, g.cuts);
  c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(26, 20); c.lineTo(34, 20); c.stroke();
}
