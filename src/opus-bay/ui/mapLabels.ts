import type { Vec2 } from '../core/types';

/**
 * Greedy label placement for the SVG map (pure, world units): each label tries its anchor, then a few
 * nudged spots, and is dropped when it would cover a marker, another label or run off the map.
 */

export interface LabelIn { id: string; text: string; at: Vec2 }
export interface LabelOut { id: string; text: string; x: number; y: number }
export interface Box { x0: number; z0: number; x1: number; z1: number }

/** Rough text width: CJK glyphs are ~1 em, Latin ~0.56 em (bold UI font). */
export function textWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of text) { const c = ch.codePointAt(0) ?? 0; em += (c >= 0x3000 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xffef) ? 1 : ch === ' ' ? 0.3 : 0.56; }
  return em * fontSize;
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
const hitsCircle = (box: Box, c: { x: number; z: number; r: number }) => {
  const dx = Math.max(box.x0 - c.x, 0, c.x - box.x1), dz = Math.max(box.z0 - c.z, 0, c.z - box.z1);
  return dx * dx + dz * dz < c.r * c.r;
};

export function placeLabels(
  labels: LabelIn[],
  opts: { fontSize: number; view: Box; markers?: { x: number; z: number; r: number }[]; avoid?: Box[] },
): LabelOut[] {
  const { fontSize: f, view } = opts;
  const markers = opts.markers ?? [];
  const placed: Box[] = [...(opts.avoid ?? [])];
  const out: LabelOut[] = [];
  const nudges: [number, number][] = [[0, 0], [0, 1.5], [0, -1.5], [0, 3], [0, -3], [0.6, 1.5], [-0.6, 1.5]];
  for (const label of labels) {
    const w = textWidth(label.text, f) + f * 0.4;
    for (const [nx, nz] of nudges) {
      const x = label.at.x + nx * w, y = label.at.z + nz * f;
      // text is centred on x with its baseline at y
      const box: Box = { x0: x - w / 2, z0: y - f * 0.95, x1: x + w / 2, z1: y + f * 0.3 };
      if (box.x0 < view.x0 || box.x1 > view.x1 || box.z0 < view.z0 || box.z1 > view.z1) continue;
      if (markers.some(m => hitsCircle(box, m)) || placed.some(p => overlaps(box, p))) continue;
      placed.push(box);
      out.push({ id: label.id, text: label.text, x, y });
      break;
    }
  }
  return out;
}
