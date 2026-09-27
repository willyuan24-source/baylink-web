import type { AreaSet, FarData, PrismSet, RoadSet } from '../world/sf/format';

/**
 * The city map's base layer (lane G1, G1-5): far.obc drawn to a 2D canvas, pure (any CanvasRenderingContext2D-like
 * object; tests count the operations with a recording context). One path per paint class, so a full redraw is a few
 * dozen fills / strokes whatever the zoom:
 *
 *   sea → land → lakes → parks / woods / sand → street blocks → streets by class → cable-car lines →
 *   neighbourhood borders → paper fog over neighbourhoods not visited yet
 *
 * With H2b's painted paper underneath (`paper: true`, H2b's request) the paper paints sea, land, parks, beaches and
 * blocks: the canvas only strokes the coastline on top, fades the streets in from 0.8 px/u and lays a lighter fog.
 * World x → right, world z → down (the same frame as the painted map, data/mapPaper MAP_FRAME).
 */

export interface MapView {
  /** world point at the canvas centre */
  cx: number;
  cz: number;
  /** CSS px per world unit */
  scale: number;
  /** canvas size in CSS px */
  w: number;
  h: number;
}

export interface MapFrameBox { minX: number; maxX: number; minZ: number; maxZ: number }

export const MIN_ZOOM = 0.8;
export const MAX_ZOOM = 18;

export const toPx = (v: MapView, x: number, z: number): [number, number] => [(x - v.cx) * v.scale + v.w / 2, (z - v.cz) * v.scale + v.h / 2];
export const toWorld = (v: MapView, px: number, py: number): { x: number; z: number } => ({ x: (px - v.w / 2) / v.scale + v.cx, z: (py - v.h / 2) / v.scale + v.cz });

/** The scale that fits the whole frame (zoom 1). */
export const fitScale = (f: MapFrameBox, w: number, h: number) => Math.min(w / (f.maxX - f.minX), h / (f.maxZ - f.minZ));

/** Keep the zoom in [MIN_ZOOM, MAX_ZOOM] × fit and the centre inside the frame. */
export function clampView(v: MapView, f: MapFrameBox): MapView {
  const fit = fitScale(f, v.w, v.h);
  const scale = Math.min(fit * MAX_ZOOM, Math.max(fit * MIN_ZOOM, v.scale));
  return { ...v, scale, cx: Math.min(f.maxX, Math.max(f.minX, v.cx)), cz: Math.min(f.maxZ, Math.max(f.minZ, v.cz)) };
}

/** Zoom by `k` keeping the world point under (px, py) fixed. */
export function zoomAt(v: MapView, f: MapFrameBox, k: number, px: number, py: number): MapView {
  const before = toWorld(v, px, py);
  const next = clampView({ ...v, scale: v.scale * k }, f);
  const after = toWorld(next, px, py);
  return clampView({ ...next, cx: next.cx + before.x - after.x, cz: next.cz + before.z - after.z }, f);
}

/**
 * The view that shows every point with `pad` px to spare (the player and a trip's target, a route), no closer than
 * `maxZoom` × fit and inside the usual limits. Pure.
 */
export function fitPoints(v: MapView, f: MapFrameBox, pts: readonly { x: number; z: number }[], pad = 48, maxZoom = 8): MapView {
  if (!pts.length) return v;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  const fit = fitScale(f, v.w, v.h);
  const sx = (v.w - 2 * pad) / Math.max(1, x1 - x0), sz = (v.h - 2 * pad) / Math.max(1, z1 - z0);
  return clampView({ ...v, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, scale: Math.min(sx, sz, fit * maxZoom) }, f);
}

/** Drop the points of a screen polyline closer than `minPx` to the last kept one (the end always stays). Pure. */
export function thinPx(pts: readonly [number, number][], minPx = 1.5): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = out[out.length - 1];
    if (q && i < pts.length - 1 && Math.hypot(p[0] - q[0], p[1] - q[1]) < minPx) continue;
    out.push(p);
  }
  return out;
}

export function visibleBox(v: MapView, pad = 0): MapFrameBox {
  const hw = v.w / 2 / v.scale + pad, hh = v.h / 2 / v.scale + pad;
  return { minX: v.cx - hw, maxX: v.cx + hw, minZ: v.cz - hh, maxZ: v.cz + hh };
}

/** The paint the map uses (toy paper palette, DESIGN.md). */
export const MAP_PAINT = {
  sea: '#9fd0cb',
  land: '#f3ead8',
  lake: '#a9d8d2',
  park: '#bfdca1',
  forest: '#a6cc8e',
  sand: '#f2dfb2',
  blocks: '#e4d5bc',
  majorCase: '#e3b25c',
  major: '#ffd98a',
  street: '#ffffff',
  streetCase: '#d9cab2',
  border: 'rgba(125, 104, 76, .45)',
  fog: 'rgba(241, 232, 216, .82)',
  fogEdge: 'rgba(168, 146, 112, .55)',
  /** the coastline over H2b's painted paper */
  paperCoast: 'rgba(58, 116, 126, .6)',
  /** lighter fog over the painted paper: the painting hints through where you have not been yet */
  paperFog: 'rgba(241, 232, 216, .7)',
} as const;

/** The subset of the Canvas 2D API the drawing uses (tests pass a recorder). */
export type Ctx2D = Pick<CanvasRenderingContext2D,
  'save' | 'restore' | 'beginPath' | 'moveTo' | 'lineTo' | 'closePath' | 'fill' | 'stroke' | 'fillRect' | 'setLineDash'
> & { fillStyle: CanvasRenderingContext2D['fillStyle']; strokeStyle: CanvasRenderingContext2D['strokeStyle']; lineWidth: number; lineJoin: CanvasLineJoin; lineCap: CanvasLineCap; globalAlpha: number };

export interface CityMapInput {
  far: Pick<FarData, 'areas' | 'prisms' | 'lines' | 'zones'>;
  /** neighbourhood id → visited (fog lifted) */
  visited: (zoneId: string) => boolean;
  /** cable-car lines (data/transit.ts) as world [x, y, z] triples with their colour */
  transit?: readonly { xyz: Float32Array; color: string }[];
  /** H2b's painted paper is drawn underneath: skip the sea and land fills */
  paper?: boolean;
}

// area classes (world/sf/format AREA_CLASSES order)
const A_LAND = 0, A_WATER = 1, A_PARK = 2, A_GRASS = 3, A_FOREST = 4, A_SAND = 5, A_GOLF = 9, A_PITCH = 10, A_SCRUB = 11;
// road classes (ROAD_CLASSES order)
const R_TERTIARY = 4, R_TRAM = 13, R_RAIL = 14;

interface Boxes { areas: Float32Array; prisms: Float32Array; lines: Float32Array }
const boxCache = new WeakMap<object, Boxes>();

function ringBoxes(start: Uint32Array, xz: Float32Array, count: number, stride: 2 | 3): Float32Array {
  const out = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let k = start[i]; k < start[i + 1]; k++) {
      const x = xz[k * stride], z = xz[k * stride + stride - 1];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    out.set([x0, z0, x1, z1], i * 4);
  }
  return out;
}

function boxesOf(far: CityMapInput['far']): Boxes {
  let b = boxCache.get(far);
  if (!b) {
    b = {
      areas: ringBoxes(far.areas.pStart, far.areas.xz, far.areas.count, 2),
      prisms: ringBoxes(far.prisms.vStart, far.prisms.xz, far.prisms.count, 2),
      lines: ringBoxes(far.lines.pStart, far.lines.xyz, far.lines.count, 3),
    };
    boxCache.set(far, b);
  }
  return b;
}

const hit = (b: Float32Array, i: number, vb: MapFrameBox) => !(b[i * 4 + 2] < vb.minX || b[i * 4] > vb.maxX || b[i * 4 + 3] < vb.minZ || b[i * 4 + 1] > vb.maxZ);

/** Rings of the given classes into the current path. Returns how many rings went in. */
function areaPath(ctx: Ctx2D, v: MapView, a: AreaSet, box: Float32Array, vb: MapFrameBox, classes: readonly number[]): number {
  let n = 0;
  for (let i = 0; i < a.count; i++) {
    if (!classes.includes(a.cls[i]) || !hit(box, i, vb)) continue;
    const s = a.pStart[i], e = a.pStart[i + 1];
    if (e - s < 3) continue;
    for (let k = s; k < e; k++) {
      const [px, py] = toPx(v, a.xz[k * 2], a.xz[k * 2 + 1]);
      if (k === s) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    n++;
  }
  return n;
}

function prismPath(ctx: Ctx2D, v: MapView, p: PrismSet, box: Float32Array, vb: MapFrameBox): number {
  let n = 0;
  const minPx = 1.2 / v.scale; // blocks smaller than ~1 px are noise at city zoom
  for (let i = 0; i < p.count; i++) {
    if (!hit(box, i, vb) || (box[i * 4 + 2] - box[i * 4] < minPx && box[i * 4 + 3] - box[i * 4 + 1] < minPx)) continue;
    const s = p.vStart[i], e = p.vStart[i + 1];
    for (let k = s; k < e; k++) {
      const [px, py] = toPx(v, p.xz[k * 2], p.xz[k * 2 + 1]);
      if (k === s) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    n++;
  }
  return n;
}

function linePath(ctx: Ctx2D, v: MapView, r: RoadSet, box: Float32Array, vb: MapFrameBox, keep: (cls: number) => boolean): number {
  let n = 0;
  for (let i = 0; i < r.count; i++) {
    if (!keep(r.cls[i]) || !hit(box, i, vb)) continue;
    const s = r.pStart[i], e = r.pStart[i + 1];
    for (let k = s; k < e; k++) {
      const [px, py] = toPx(v, r.xyz[k * 3], r.xyz[k * 3 + 2]);
      if (k === s) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    n++;
  }
  return n;
}

function zonePath(ctx: Ctx2D, v: MapView, zones: CityMapInput['far']['zones'], pick: (id: string) => boolean): number {
  let n = 0;
  for (const z of zones) {
    if (!pick(z.id)) continue;
    for (const ring of z.rings) {
      const xz = ring.xz;
      for (let k = 0; k < xz.length / 2; k++) {
        const [px, py] = toPx(v, xz[k * 2], xz[k * 2 + 1]);
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
    n++;
  }
  return n;
}

/** Draw the whole base layer for view `v`. Returns the number of fill / stroke operations (the op budget). */
export function drawCityMap(ctx: Ctx2D, input: CityMapInput, v: MapView): number {
  const { far } = input;
  const b = boxesOf(far);
  const vb = visibleBox(v, 4);
  const zoom = v.scale; // px per u
  let ops = 0;
  const fill = (style: string, rule: CanvasFillRule = 'nonzero') => { ctx.fillStyle = style; ctx.fill(rule); ops++; };
  const stroke = (style: string, width: number) => { ctx.strokeStyle = style; ctx.lineWidth = width; ctx.stroke(); ops++; };
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (!input.paper) {
    ctx.fillStyle = MAP_PAINT.sea;
    ctx.fillRect(0, 0, v.w, v.h);
    ops++;
    ctx.beginPath();
    if (areaPath(ctx, v, far.areas, b.areas, vb, [A_LAND])) fill(MAP_PAINT.land, 'evenodd');
  }
  if (!input.paper) {
    ctx.beginPath();
    if (areaPath(ctx, v, far.areas, b.areas, vb, [A_WATER])) fill(MAP_PAINT.lake, 'evenodd');
    ctx.beginPath();
    if (areaPath(ctx, v, far.areas, b.areas, vb, [A_PARK, A_GRASS, A_GOLF, A_PITCH, A_SCRUB])) fill(MAP_PAINT.park, 'evenodd');
    ctx.beginPath();
    if (areaPath(ctx, v, far.areas, b.areas, vb, [A_FOREST])) fill(MAP_PAINT.forest, 'evenodd');
    ctx.beginPath();
    if (areaPath(ctx, v, far.areas, b.areas, vb, [A_SAND])) fill(MAP_PAINT.sand, 'evenodd');
    ctx.beginPath();
    if (prismPath(ctx, v, far.prisms, b.prisms, vb)) fill(MAP_PAINT.blocks);
  } else {
    // H2b's paper paints the lakes, parks, woods, beaches and blocks; the vector coastline goes on top of it
    ctx.beginPath();
    if (areaPath(ctx, v, far.areas, b.areas, vb, [A_LAND])) stroke(MAP_PAINT.paperCoast, Math.max(1, 0.9 * zoom));
  }
  // streets: minor ones (tertiary) from 1.6 px/u … widths grow with the zoom (right-of-way ≈ 3–6 u). Over the paper
  // they fade in from 0.8 px/u (the paper's own streets read below that)
  const w = (u: number, min: number) => Math.max(min, u * zoom);
  const streetAlpha = input.paper ? Math.min(0.9, Math.max(0, (zoom - 0.8) / 0.8)) : 1;
  if (streetAlpha > 0.01) {
    ctx.globalAlpha = streetAlpha;
    if (zoom > 0.6) {
      ctx.beginPath();
      if (linePath(ctx, v, far.lines, b.lines, vb, c => c === R_TERTIARY)) { stroke(MAP_PAINT.streetCase, w(3.4, 1.4)); stroke(MAP_PAINT.street, w(2.6, 0.9)); }
    }
    ctx.beginPath();
    if (linePath(ctx, v, far.lines, b.lines, vb, c => c > 1 && c < R_TERTIARY)) { stroke(MAP_PAINT.streetCase, w(4.4, 2.2)); stroke(MAP_PAINT.street, w(3.4, 1.5)); }
    ctx.beginPath();
    if (linePath(ctx, v, far.lines, b.lines, vb, c => c <= 1)) { stroke(MAP_PAINT.majorCase, w(5.6, 3)); stroke(MAP_PAINT.major, w(4.2, 2)); }
    ctx.globalAlpha = 1;
  }
  // cable cars (their own colours, drawn on the street)
  for (const line of input.transit ?? []) {
    ctx.beginPath();
    const xyz = line.xyz;
    for (let k = 0; k < xyz.length / 3; k++) {
      const [px, py] = toPx(v, xyz[k * 3], xyz[k * 3 + 2]);
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    stroke('#fffaf1', w(2.4, 3.6));
    stroke(line.color, w(1.4, 2));
  }
  // neighbourhood borders, then the paper fog over the ones not visited yet
  ctx.beginPath();
  if (zonePath(ctx, v, far.zones, () => true)) {
    ctx.setLineDash([4, 4]);
    stroke(MAP_PAINT.border, 1);
    ctx.setLineDash([]);
  }
  ctx.beginPath();
  if (zonePath(ctx, v, far.zones, id => !input.visited(id))) { fill(input.paper ? MAP_PAINT.paperFog : MAP_PAINT.fog, 'evenodd'); stroke(MAP_PAINT.fogEdge, 1.2); }
  ctx.restore();
  return ops;
}

/** Keep the tram / rail classes referenced (the map draws the cable cars from data/transit.ts instead). */
export const SKIPPED_ROAD_CLASSES = [R_TRAM, R_RAIL] as const;

/** Rough label width in px for the map font (CJK ≈ 1 em, latin ≈ 0.56 em). */
export function labelWidth(text: string, fontPx: number): number {
  let w = 0;
  for (const ch of text) w += /[⺀-鿿＀-￯]/.test(ch) ? fontPx : fontPx * 0.56;
  return w;
}

/**
 * A label to place. With `r` (the radius of the item's own marker at x, y) the label tries four spots around the marker
 * — above, right, left, below — and never counts its own marker as an obstacle; without `r` it is centred on the
 * baseline point (x, y) as given (neighbourhood names). `over` (the selected place): only labels and reserved boxes
 * stop it, not other markers.
 */
export interface LabelItem { id: string; x: number; y: number; text: string; prio: number; fontPx?: number; r?: number; over?: boolean }
/** Where a kept label goes: its baseline point and the SVG text-anchor. */
export interface PlacedLabel { x: number; y: number; anchor: 'middle' | 'start' | 'end' }
/** A marker on the map, as an obstacle for labels (`id`: the item whose own marker it is). */
export interface LabelObstacle { x: number; y: number; r: number; id?: string }

/** The candidate spots of one label (baseline point + anchor), in preference order. Pure. */
function labelSpots(it: LabelItem, f: number): PlacedLabel[] {
  if (it.r === undefined) return [{ x: it.x, y: it.y, anchor: 'middle' }];
  const r = it.r, gap = 3, mid = it.y + f * 0.35;
  return [
    { x: it.x, y: it.y - r - gap, anchor: 'middle' },
    { x: it.x + r + gap, y: mid, anchor: 'start' },
    { x: it.x - r - gap, y: mid, anchor: 'end' },
    { x: it.x, y: it.y + r + gap + f * 0.8, anchor: 'middle' },
  ];
}

/**
 * Greedy, collision-free labels in screen px (lower prio first): each label takes its first candidate spot that stays
 * inside the w × h box, overlaps no label placed before it and covers no other marker (`obstacles`; a label never
 * collides with its own marker) or `reserved` screen boxes [x0, y0, x1, y1] (the map's buttons, the credit line). A
 * label with no free spot is dropped. Returns the kept labels by id. Pure.
 */
export function layoutLabels(items: readonly LabelItem[], w: number, h: number, pad = 3, obstacles: readonly LabelObstacle[] = [], reserved: readonly (readonly [number, number, number, number])[] = []): Map<string, PlacedLabel> {
  const marks = obstacles.map(o => ({ id: o.id, box: [o.x - o.r, o.y - o.r, o.x + o.r, o.y + o.r] as const }));
  const placed: (readonly [number, number, number, number])[] = [...reserved];
  const out = new Map<string, PlacedLabel>();
  const overlaps = (a: readonly number[], b: readonly number[]) => !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
  for (const it of [...items].sort((a, b) => a.prio - b.prio)) {
    const f = it.fontPx ?? 11.5;
    const lw = labelWidth(it.text, f);
    for (const s of labelSpots(it, f)) {
      const x0 = s.anchor === 'middle' ? s.x - lw / 2 : s.anchor === 'start' ? s.x : s.x - lw;
      const box = [x0 - pad, s.y - f - pad, x0 + lw + pad, s.y + pad] as const;
      if (box[0] < 0 || box[2] > w || box[1] < 0 || box[3] > h) continue;
      if (placed.some(b => overlaps(box, b))) continue;
      if (!it.over && marks.some(m => m.id !== it.id && overlaps(box, m.box))) continue;
      placed.push(box);
      out.set(it.id, s);
      break;
    }
  }
  return out;
}
