import type { Bilingual } from '../core/types';

/**
 * The subway overlay's line strip (wave 4 · lane T, plan §3.3), pure so node tests pin the layout: the underground part
 * of the ride drawn left → right in the direction of travel, the stations as ticks, the moving dot, and the labels
 * that fit (never overlapping: the current / next station and the far end always win, the rest only where there is
 * room; labels alternate above / below the line to fit twice as many).
 */

export interface StripStation { id: string; name: Bilingual; at: number }

export interface StripInput {
  stations: StripStation[];
  /** the underground span [fromAt, toAt] (arc u) */
  fromAt: number;
  toAt: number;
  /** the train's arc and direction */
  at: number;
  dir: 1 | -1;
  /** the mouth at each end, if any (a portal is drawn as a tunnel mouth, a null end as the line's terminus) */
  portalA?: Bilingual | null;
  portalB?: Bilingual | null;
  /** the station the train stands at, the next one it will stop at */
  stopped?: string | null;
  next?: string | null;
  /** available width (px) and the width of a label's character (px; CJK ≈ 13, Latin ≈ 7 at 12 px) */
  width: number;
  charPx?: { cjk: number; latin: number };
}

export interface StripLabel {
  id: string; x: number; text: Bilingual; row: 'above' | 'below'; kind: 'station' | 'portal'; state: 'passed' | 'current' | 'next' | 'ahead';
  /** left edge (px) and width (px) of the label box, clamped inside the strip */
  left: number; w: number;
}
export interface StripLayout {
  /** the dot, 0 … 1 along the strip */
  dot: number;
  ticks: { id: string; x: number; state: StripLabel['state'] }[];
  labels: StripLabel[];
  /** the mouth ahead (the train emerges there) or null when the ride ends underground */
  exit: Bilingual | null;
}

const isCjk = (c: string) => { const k = c.codePointAt(0) ?? 0; return (k >= 0x3000 && k <= 0x9fff) || (k >= 0xff00 && k <= 0xffef); };

/** Rough label width in px for the language shown (zh text when `zh`). */
export function labelWidth(text: Bilingual, zh: boolean, charPx = { cjk: 13, latin: 7 }): number {
  const s = zh ? text.zh : text.en;
  let w = 0;
  for (const c of s) w += isCjk(c) ? charPx.cjk : charPx.latin;
  return w + 8;
}

/** Lay the strip out for one frame. `zh` picks the label language (the layout measures what is shown). */
export function stripLayout(o: StripInput, zh: boolean): StripLayout {
  const span = Math.max(1, o.toAt - o.fromAt);
  // left → right in travel direction
  const x = (at: number) => { const f = (at - o.fromAt) / span; return o.dir > 0 ? f : 1 - f; };
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const dot = clamp01(x(o.at));
  const state = (at: number, id: string): StripLabel['state'] => {
    if (o.stopped === id) return 'current';
    if (o.next === id) return 'next';
    return (at - o.at) * o.dir < 0 ? 'passed' : 'ahead';
  };
  const stations = o.stations.filter(s => s.at >= o.fromAt - 1 && s.at <= o.toAt + 1);
  const ticks = stations.map(s => ({ id: s.id, x: clamp01(x(s.at)), state: state(s.at, s.id) }));
  const W = Math.max(40, o.width);
  const mk = (id: string, xf: number, text: Bilingual, kind: StripLabel['kind'], st: StripLabel['state'], prio: number) => {
    const w = Math.min(W, labelWidth(text, zh, o.charPx));
    return { id, x: xf, text, row: 'above' as StripLabel['row'], kind, state: st, prio, w, left: labelLeft(xf, w, W) };
  };
  const cand = stations.map(s => {
    const st = state(s.at, s.id);
    return mk(s.id, clamp01(x(s.at)), s.name, 'station', st, st === 'current' ? 0 : st === 'next' ? 1 : st === 'ahead' ? 3 : 4);
  });
  // the mouth ahead: where the train comes out
  const exitAt = o.dir > 0 ? o.toAt : o.fromAt;
  const exit = (o.dir > 0 ? o.portalB : o.portalA) ?? null;
  if (exit) cand.push(mk('exit', clamp01(x(exitAt)), exit, 'portal', 'ahead', 2));
  // the far end of the line (a terminus underground, e.g. Embarcadero) also stays readable
  const farStation = stations.length ? stations.reduce((a, b) => ((b.at - a.at) * o.dir > 0 ? b : a)) : null;
  for (const c of cand) if (!exit && farStation && c.id === farStation.id && c.prio > 2) c.prio = 2;
  // greedy: highest priority first, each on the row (above / below) where it does not overlap a kept label
  const kept: StripLabel[] = [];
  const fits = (c: { left: number; w: number }, row: 'above' | 'below') => kept.every(k => k.row !== row || c.left + c.w + 6 <= k.left || k.left + k.w + 6 <= c.left);
  for (const c of cand.slice().sort((a, b) => a.prio - b.prio || Math.abs(a.x - dot) - Math.abs(b.x - dot))) {
    for (const row of ['above', 'below'] as const) {
      if (fits(c, row)) { kept.push({ id: c.id, x: c.x, text: c.text, row, kind: c.kind, state: c.state, left: c.left, w: c.w }); break; }
    }
  }
  const labels: StripLabel[] = kept.map(({ id, x: lx, text, row, kind, state: st, left, w }) => ({ id, x: lx, text, row, kind, state: st, left, w })).sort((a, b) => a.x - b.x);
  return { dot, ticks, labels, exit };
}

/** Where a label sits so it never spills off the strip (px from the left), given its width. */
export function labelLeft(xFrac: number, labelPx: number, width: number): number {
  return Math.max(0, Math.min(width - labelPx, xFrac * width - labelPx / 2));
}
