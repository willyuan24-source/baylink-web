import type { Crab, CrabGame } from './crab';

/**
 * Wave 7 · lane M · crabbing's art on a 2D canvas (100 wide × 90 high, the caller scales the context): the pier's edge
 * and the water, the rope, the hoop net with its bait on the sandy bottom, the crabs (a rock crab: brick red with
 * black-tipped claws; a Dungeness: purple-brown with white-tipped claws), and the gauge (a ruler in inches with the
 * 4-inch mark) the crabs are measured on. Toy-flat, no text but the ruler's numbers.
 */

type C = CanvasRenderingContext2D;
const INK = '#3b2a20';
export const SURFACE = 16, BOTTOM = 80;
/** the net's height on screen for a depth 0…1 */
export const netY = (depth: number) => SURFACE - 4 + depth * (BOTTOM - SURFACE + 2);

function outline(c: C, w = 0.45) { c.lineWidth = w; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(); }

/** A crab seen from above-front, its middle at (x, y), `w` wide (units); `wiggle` 0…1 moves the legs. */
export function drawCrab(c: C, kind: Crab['kind'], x: number, y: number, w: number, wiggle = 0) {
  const s = w / 10, body = kind === 'rock' ? '#c2452d' : '#8a5a5e', dark = kind === 'rock' ? '#8f2f1f' : '#5f3b40', tip = kind === 'rock' ? '#231a17' : '#f4efe6';
  c.save(); c.translate(x, y); c.scale(s, s);
  c.strokeStyle = dark; c.lineWidth = 0.7; c.lineCap = 'round';
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const a = Math.sin(wiggle * Math.PI * 2 + i) * 0.6;
    c.beginPath(); c.moveTo(side * 3, 0.6 + i * 0.5); c.lineTo(side * (5.6 + i * 0.3), 1.6 + i * 0.6 + a); c.lineTo(side * (6.4 + i * 0.2), 3 + i * 0.5 + a); c.stroke();
  }
  c.beginPath(); c.ellipse(0, 0, 5, 3.1, 0, 0, Math.PI * 2); c.fillStyle = body; c.fill(); outline(c, 0.5);
  c.beginPath(); c.ellipse(0, -0.6, 3.4, 1.6, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fill();
  for (const side of [-1, 1]) {
    c.beginPath(); c.moveTo(side * 3.6, -1.6); c.lineTo(side * 5.6, -3.6); c.strokeStyle = dark; c.lineWidth = 0.9; c.stroke();
    c.beginPath(); c.ellipse(side * 6.2, -4.4, 1.5, 1.1, side * 0.5, 0, Math.PI * 2); c.fillStyle = body; c.fill(); outline(c, 0.4);
    c.beginPath(); c.ellipse(side * 6.9, -5.3, 0.7, 0.55, 0, 0, Math.PI * 2); c.fillStyle = tip; c.fill();
    c.beginPath(); c.arc(side * 1.1, -3, 0.55, 0, Math.PI * 2); c.fillStyle = '#fffaf0'; c.fill(); outline(c, 0.25);
    c.beginPath(); c.arc(side * 1.1, -2.9, 0.25, 0, Math.PI * 2); c.fillStyle = INK; c.fill();
  }
  c.restore();
}

/** The scene under the pier: planks, waves, the water, kelp, the sand, the rope, the net, the crabs. */
export function drawWater(c: C, g: CrabGame, time: number) {
  const water = c.createLinearGradient(0, SURFACE, 0, 90);
  water.addColorStop(0, '#3d8e9a'); water.addColorStop(1, '#1d4f5c');
  c.fillStyle = '#bfe0e6'; c.fillRect(0, 0, 100, SURFACE);
  c.fillStyle = water; c.fillRect(0, SURFACE, 100, 90 - SURFACE);
  // the pier's planks along the top, and a post
  c.fillStyle = '#8a6a4a'; c.fillRect(0, 0, 100, 5);
  c.fillStyle = '#6f5238'; for (let x = 0; x < 100; x += 9) c.fillRect(x, 0, 0.5, 5);
  c.fillStyle = '#5d4632'; c.fillRect(84, 5, 4, 85);
  // little waves
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 0.6;
  c.beginPath();
  for (let x = 0; x <= 100; x += 2) { const y = SURFACE + Math.sin(x * 0.35 + time * 2) * 0.6; if (x) c.lineTo(x, y); else c.moveTo(x, y); }
  c.stroke();
  // light shafts, kelp
  c.fillStyle = 'rgba(255,255,255,0.05)';
  c.beginPath(); c.moveTo(20, SURFACE); c.lineTo(30, SURFACE); c.lineTo(18, 90); c.lineTo(8, 90); c.closePath(); c.fill();
  for (const [kx, h] of [[10, 22], [76, 18], [94, 26]] as const) {
    c.strokeStyle = '#2f7a4f'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(kx, 88);
    for (let i = 1; i <= 6; i++) c.lineTo(kx + Math.sin(time * 1.5 + i + kx) * 1.4, 88 - (h * i) / 6);
    c.stroke();
  }
  // the sand
  c.fillStyle = '#c9b287'; c.beginPath(); c.moveTo(0, BOTTOM + 2); c.quadraticCurveTo(50, BOTTOM - 1, 100, BOTTOM + 2); c.lineTo(100, 90); c.lineTo(0, 90); c.closePath(); c.fill();
  c.fillStyle = '#b39b70'; for (let i = 0; i < 14; i++) c.fillRect((i * 37) % 100, 84 + (i % 3) * 2, 1.2, 0.5);
  // the crabs on the bottom (not the ones riding the net)
  for (const cr of g.crabs) if (cr.state === 'coming' || cr.state === 'eating' || cr.state === 'leaving') {
    if (cr.state === 'coming' && g.soak < cr.arrive) continue;
    drawCrab(c, cr.kind, cr.x, BOTTOM + 1, 8 + cr.size * 0.9, cr.state === 'eating' ? time * 0.6 : time * 2.2);
  }
  // the rope (it twitches while crabs are eating) and the net
  const y = netY(g.depth), tug = g.phase === 'soak' && g.eating > 0 ? Math.sin(time * 18) * 0.8 : 0;
  c.strokeStyle = '#e9dcc0'; c.lineWidth = 0.6;
  c.beginPath(); c.moveTo(50, 0); c.quadraticCurveTo(50 + tug * 2, (y + 5) / 2, 50, y - 1); c.stroke();
  // bridle lines to the ring
  c.beginPath(); c.moveTo(50, y - 10); c.lineTo(34, y); c.moveTo(50, y - 10); c.lineTo(66, y); c.stroke();
  // the ring and its mesh, the bait in the middle
  c.fillStyle = 'rgba(233,220,192,0.22)'; c.beginPath(); c.ellipse(50, y, 16, 3.6, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(233,220,192,0.55)'; c.lineWidth = 0.3;
  for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(50 + i * 4.5, y - 3.3); c.lineTo(50 + i * 4.5, y + 3.3); c.stroke(); }
  c.beginPath(); c.ellipse(50, y, 16, 3.6, 0, 0, Math.PI * 2); c.strokeStyle = '#d9b44a'; c.lineWidth = 0.9; c.stroke();
  if (g.soak < 16 || g.phase === 'sink' || g.phase === 'ready') { c.beginPath(); c.ellipse(50, y - 0.6, 2.4, 1.1, 0, 0, Math.PI * 2); c.fillStyle = '#b8c3c9'; c.fill(); outline(c, 0.3); }
  // crabs riding the net up
  let k = 0;
  for (const cr of g.crabs) if (cr.state === 'on-net') { drawCrab(c, cr.kind, 50 + (k % 2 ? 1 : -1) * (4 + Math.floor(k / 2) * 5), y - 1.5, 8 + cr.size * 0.9, time * 3); k++; }
}

/** The gauge: a ruler 0–7 inches (INCH units each) with the 4-inch keeper mark, the crab lying on it from 0. */
export const INCH = 11, RULER_X = 12;
export function drawGauge(c: C, cr: Crab, flash: { ok: boolean } | null, time: number) {
  c.fillStyle = '#f3ead8'; c.fillRect(0, 0, 100, 90);
  // the bucket's rim in the corner and a towel
  c.fillStyle = '#3f7fbf'; c.fillRect(0, 0, 100, 6);
  // the crab across the ruler: its width = its size
  const w = cr.size * INCH;
  drawCrab(c, cr.kind, RULER_X + w / 2, 42, w, time * 0.8);
  // the ruler
  c.fillStyle = '#f2c14e'; c.fillRect(RULER_X - 4, 60, 7 * INCH + 8, 12);
  c.strokeStyle = INK; c.lineWidth = 0.4; c.strokeRect(RULER_X - 4, 60, 7 * INCH + 8, 12);
  c.fillStyle = INK; c.font = '700 5px sans-serif'; c.textAlign = 'center';
  for (let i = 0; i <= 7; i++) {
    const x = RULER_X + i * INCH;
    c.fillRect(x - 0.2, 60, 0.4, 4.5);
    c.fillText(String(i), x, 70.2);
    if (i < 7) for (const f of [0.25, 0.5, 0.75]) c.fillRect(x + f * INCH - 0.15, 60, 0.3, f === 0.5 ? 3 : 2);
  }
  // the keeper line at 4 inches (dashed, up through the crab; the ruler's 4 stays readable)
  const x4 = RULER_X + 4 * INCH;
  c.save(); c.setLineDash([1.4, 1.2]); c.strokeStyle = '#c34a33'; c.lineWidth = 0.8;
  c.beginPath(); c.moveTo(x4, 18); c.lineTo(x4, 60); c.stroke(); c.restore();
  c.fillStyle = '#c34a33'; c.fillRect(x4 - 0.7, 60, 1.4, 5.5);
  c.beginPath(); c.arc(x4, 74.8, 2.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.font = '700 3px sans-serif'; c.fillText('✓', x4, 75.9);
  // the shell's two edges (what a gauge measures), marked down to the ruler
  c.save(); c.setLineDash([1, 0.8]); c.strokeStyle = 'rgba(59,42,32,0.8)'; c.lineWidth = 0.6;
  c.beginPath(); c.moveTo(RULER_X, 38); c.lineTo(RULER_X, 60); c.moveTo(RULER_X + w, 38); c.lineTo(RULER_X + w, 60); c.stroke(); c.restore();
  c.fillStyle = INK;
  for (const ex of [RULER_X, RULER_X + w]) { c.beginPath(); c.moveTo(ex - 1.6, 56); c.lineTo(ex + 1.6, 56); c.lineTo(ex, 59.6); c.closePath(); c.fill(); }
  if (flash) {
    c.fillStyle = flash.ok ? 'rgba(47,138,122,0.18)' : 'rgba(195,74,51,0.16)';
    c.fillRect(0, 0, 100, 90);
  }
}
