/**
 * Wave 7 · lane M · the claw machine's art, drawn on a 2D canvas in cabinet units (100 wide × 80 high; the caller has
 * scaled the context): the eight toy souvenirs, the cabinet, the claw. Toy-like flat shapes with a dark outline, in the
 * game's palette; no text, no brand, no image files.
 */

type C = CanvasRenderingContext2D;
const INK = '#3b2a20';

function outline(c: C, w = 0.45) { c.lineWidth = w; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
function rr(c: C, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
function fill(c: C, color: string) { c.fillStyle = color; c.fill(); }

/** One souvenir, its bottom middle at (x, y). */
export function drawPrize(c: C, kind: number, x: number, y: number, scale = 1.3) {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  switch (kind) {
    case 0: { // a cable car: red ends, cream band, windows, a dark roof
      rr(c, -6, -8, 12, 6.4, 1.2); fill(c, '#c8412f'); outline(c);
      c.fillStyle = '#f2e3c4'; c.fillRect(-5.4, -6.3, 10.8, 2.6);
      c.fillStyle = '#6b8fa3'; for (let i = 0; i < 4; i++) c.fillRect(-4.8 + i * 2.6, -6, 1.8, 2);
      rr(c, -6.6, -9.4, 13.2, 1.6, 0.6); fill(c, '#4a3a33'); outline(c, 0.35);
      c.beginPath(); c.arc(-3.5, -1.3, 1.2, 0, Math.PI * 2); c.arc(3.5, -1.3, 1.2, 0, Math.PI * 2); fill(c, '#2f2a28');
      break;
    }
    case 1: { // the Golden Gate: two towers, a cable, a deck
      c.fillStyle = '#d4552e';
      for (const tx of [-4, 4]) { rr(c, tx - 1, -10, 2, 10, 0.4); fill(c, '#d4552e'); outline(c, 0.35); }
      c.beginPath(); c.moveTo(-6.5, -6); c.quadraticCurveTo(-4, -10.5, -4, -10); c.quadraticCurveTo(0, -3, 4, -10); c.quadraticCurveTo(4, -10.5, 6.5, -6);
      c.lineWidth = 0.55; c.strokeStyle = '#b7432a'; c.stroke();
      rr(c, -6.5, -3.4, 13, 1.4, 0.5); fill(c, '#d4552e'); outline(c, 0.35);
      break;
    }
    case 2: { // a sea lion plush, sitting up
      c.beginPath(); c.ellipse(0, -3.2, 5.6, 3.4, 0, 0, Math.PI * 2); fill(c, '#8a5d3b'); outline(c);
      c.beginPath(); c.ellipse(3.2, -7.2, 2.6, 2.3, 0, 0, Math.PI * 2); fill(c, '#96673f'); outline(c);
      c.beginPath(); c.ellipse(5.2, -6.8, 1.2, 0.8, 0, 0, Math.PI * 2); fill(c, '#6d4630');
      c.beginPath(); c.arc(3.4, -7.9, 0.45, 0, Math.PI * 2); fill(c, INK);
      c.beginPath(); c.ellipse(-1, -0.6, 2.4, 0.9, -0.3, 0, Math.PI * 2); fill(c, '#6d4630');
      break;
    }
    case 3: { // a fortune cookie with its paper
      c.beginPath(); c.moveTo(-4.5, -1); c.quadraticCurveTo(-4.5, -7.5, 0, -7.5); c.quadraticCurveTo(4.5, -7.5, 4.5, -1); c.quadraticCurveTo(0, -3.8, -4.5, -1); c.closePath();
      fill(c, '#e3ac5c'); outline(c);
      c.fillStyle = '#fffaf0'; c.beginPath(); c.moveTo(1, -3.2); c.lineTo(5.6, -4.6); c.lineTo(5.9, -3.7); c.lineTo(1.3, -2.4); c.closePath(); c.fill(); outline(c, 0.3);
      break;
    }
    case 4: { // a round sourdough loaf, scored
      c.beginPath(); c.ellipse(0, -3.6, 5.5, 3.6, 0, Math.PI, 0); c.lineTo(5.5, -0.6); c.quadraticCurveTo(0, 0.4, -5.5, -0.6); c.closePath();
      fill(c, '#c98545'); outline(c);
      c.strokeStyle = '#f0d19c'; c.lineWidth = 0.6;
      for (const dx of [-2.2, 0.3, 2.8]) { c.beginPath(); c.moveTo(dx - 1, -5.6); c.quadraticCurveTo(dx, -4.8, dx + 0.6, -3.2); c.stroke(); }
      break;
    }
    case 5: { // Coit Tower: a fluted cream column with its top
      rr(c, -3.4, -2, 6.8, 2, 0.4); fill(c, '#d9ccb2'); outline(c, 0.35);
      rr(c, -2.4, -11, 4.8, 9.2, 0.6); fill(c, '#efe4cc'); outline(c);
      c.strokeStyle = '#cbbd9f'; c.lineWidth = 0.3; for (const fx of [-1.2, 0, 1.2]) { c.beginPath(); c.moveTo(fx, -10); c.lineTo(fx, -2.4); c.stroke(); }
      c.fillStyle = '#5a6b73'; for (const fx of [-1.6, -0.2, 1.2]) c.fillRect(fx, -10.4, 0.5, 1.2);
      rr(c, -2.8, -11.8, 5.6, 1.2, 0.4); fill(c, '#e2d6bc'); outline(c, 0.35);
      break;
    }
    case 6: { // a Painted Lady: a pastel house with a white gable
      c.beginPath(); c.moveTo(-4.5, 0); c.lineTo(-4.5, -6.5); c.lineTo(0, -10.5); c.lineTo(4.5, -6.5); c.lineTo(4.5, 0); c.closePath();
      fill(c, '#8fbfc6'); outline(c);
      c.beginPath(); c.moveTo(-3.3, -6.6); c.lineTo(0, -9.4); c.lineTo(3.3, -6.6); c.closePath(); fill(c, '#fffaf0');
      c.fillStyle = '#e57f7f'; c.fillRect(-1, -3.6, 2, 3.6);
      c.fillStyle = '#fffaf0'; c.fillRect(-3.6, -5.4, 1.8, 1.6); c.fillRect(1.8, -5.4, 1.8, 1.6);
      break;
    }
    case 7: { // a crab plush: a round red body, two claws, legs, eyes on stalks
      c.strokeStyle = '#b8431f'; c.lineWidth = 0.7;
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(s * 3, -2 + i * 0.6); c.lineTo(s * (5.4 + i * 0.4), -0.2 + i * 0.1); c.stroke(); }
      c.beginPath(); c.ellipse(0, -3.2, 4.4, 2.8, 0, 0, Math.PI * 2); fill(c, '#d9542c'); outline(c);
      for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 5.4, -6.4, 1.5, 0, Math.PI * 2); fill(c, '#e0643a'); outline(c, 0.35); }
      for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 1.3, -6.4, 0.8, 0, Math.PI * 2); fill(c, '#fffaf0'); outline(c, 0.3); c.beginPath(); c.arc(s * 1.3, -6.3, 0.35, 0, Math.PI * 2); fill(c, INK); }
      break;
    }
  }
  c.restore();
}

/** The cabinet: the glass box, a wooden floor for the pile, the chute on the left, the rail up top. */
export function drawCabinet(c: C, time: number) {
  const g = c.createLinearGradient(0, 0, 0, 80);
  g.addColorStop(0, '#1f4e5a'); g.addColorStop(1, '#2d6c73');
  c.fillStyle = g; c.fillRect(0, 0, 100, 80);
  // a few bulbs along the top (an old arcade)
  for (let i = 0; i < 12; i++) {
    const on = (Math.floor(time * 3) + i) % 3 !== 0;
    c.beginPath(); c.arc(4 + i * 8.4, 2.2, 1, 0, Math.PI * 2); c.fillStyle = on ? '#ffd98a' : '#8a6b3a'; c.fill();
  }
  // the rail
  c.fillStyle = '#c9a15a'; c.fillRect(2, 5.2, 96, 1.2);
  // the floor of the pile
  c.fillStyle = '#9b6a3f'; c.fillRect(16, 70, 84, 10);
  c.fillStyle = '#7f5433'; for (let x = 18; x < 100; x += 8) c.fillRect(x, 70, 0.4, 10);
  // the chute: a box with a hole
  c.fillStyle = '#e3c07a'; c.fillRect(0, 50, 16, 30);
  c.fillStyle = '#23363b'; c.fillRect(2, 50, 12, 6);
  c.beginPath(); c.moveTo(1, 50); c.lineTo(15, 50); c.lineWidth = 0.6; c.strokeStyle = INK; c.stroke();
  c.fillStyle = '#c34a33'; c.beginPath(); c.moveTo(8, 60); c.lineTo(5, 64); c.lineTo(11, 64); c.closePath(); c.fill();
  // glass highlights
  c.fillStyle = 'rgba(255,255,255,0.07)';
  c.beginPath(); c.moveTo(70, 8); c.lineTo(78, 8); c.lineTo(58, 70); c.lineTo(50, 70); c.closePath(); c.fill();
}

/** The claw's head (its hub's bottom) for a drop 0…1, and where a held prize's bottom hangs. */
export const clawHead = (drop: number) => 12 + drop * 37;
export const HELD_BELOW = 12.5;

/** The claw at x, its head `drop` (0…1) of the way down, its fingers `grip` (0 open … 1 closed). */
export function drawClaw(c: C, x: number, drop: number, grip: number) {
  const top = 6.4, head = clawHead(drop);
  c.strokeStyle = '#d9d2c3'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x, top); c.lineTo(x, head - 3); c.stroke();
  rr(c, x - 3.4, top - 1.3, 6.8, 2.4, 0.6); fill(c, '#8b8f94'); outline(c, 0.35);
  rr(c, x - 3, head - 4, 6, 4, 1); fill(c, '#c9cdd2'); outline(c, 0.4);
  c.beginPath(); c.arc(x, head - 2, 0.8, 0, Math.PI * 2); fill(c, '#8b8f94');
  const open = (1 - grip) * 0.5;
  for (const s of [-1, 1]) {
    c.save(); c.translate(x + s * 2.2, head - 0.4); c.rotate(s * (0.1 + open));
    c.beginPath(); c.moveTo(0, 0); c.lineTo(s * 2.4, 5.6); c.lineTo(s * 0.4, 9.4);
    c.lineWidth = 1.3; c.strokeStyle = '#3b2a20'; c.stroke();
    c.lineWidth = 0.8; c.strokeStyle = '#d6dade'; c.stroke();
    c.restore();
  }
}

/** Where the claw would drop: a faint line down to the pile (aim help). */
export function drawAimLine(c: C, x: number) {
  c.save(); c.setLineDash([1.2, 1.6]); c.strokeStyle = 'rgba(255,236,190,0.55)'; c.lineWidth = 0.4;
  c.beginPath(); c.moveTo(x, 20); c.lineTo(x, 68); c.stroke(); c.restore();
}

/** Prize rows (the bottom middle y of each row). */
export const ROW_Y = [70, 63.5] as const;
