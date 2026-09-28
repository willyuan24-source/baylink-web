import type { Bilingual } from '../core/types';
import type { Attraction } from '../data/sf/attractionTypes';
import { MAP_STICKERS_T1, isMapStickerId } from '../data/sf/mapStickers';
import { attractionShort, type MapTier } from '../data/sf/attractions';
import { type BadgeSize, type BadgeState, SCALE_STEPS, badgeNodes, badgeSize, pipBox, scaleRules } from './mapBadges';
import { type MapView, labelWidth, toPx } from './cityMapDraw';
import { MAP_FILTERS, filterAttraction, type MapFilter } from './mapFilterRules';
import { type MapStation, type StationSymbol, stationNodes } from './mapLines';

/**
 * Wave 4 · badge and label layout of the city map (lane P, W4-P5; plan sf-w4-plan.md §4.1 "Labels", "Clusters",
 * "Perf"). Pure, screen px, in the existing rAF (memoise per view / filter / discovery epoch):
 *
 * 1. priority order: selected, active target, next tour stop, T1 by fame, T2 by fame, stations, T3, T4, zones;
 * 2. clusters (s < 1.2): a badge within rA + rB + 2 px of a kept badge of equal or higher priority merges into it (the
 *    kept one gets a "+n" pip; its label reads "州立大学 +1"); the selected badge and the target never merge away;
 * 3. labels, greedy in the same order: each kept badge tries 4 boxes (right x + r + 3 centred, left, above, below;
 *    a clustered badge then also the right box just below its own pip);
 *    a box stays inside the frame minus the tool column (44 px right) and the credit line (16 px bottom) and avoids
 *    placed labels, every cluster pip (its own too) and every kept badge EXCEPT ITS OWN (the wave-3 "no label ever
 *    renders" bug: a label tested against its own marker always lost);
 * Box-shaped markers (lane P2): a transfer station's pill is up to 80 px wide (N M 叮当 F), so an item may give its
 * half extents `hw` / `hh`: its obstacle box, its label gaps and its overlap test use the box instead of the disc r.
 * Stations enter with `clusterable: false, host: false` (they never merge, and nothing merges into them: MapStationMark
 * draws no pip); labels keep off them, except the T1 band's (`yieldBelow: 20`: a must-see keeps its name over a pill).
 *
 * 4. node budget: SVG nodes ≤ `maxNodes` (150 desktop / 120 phone), counted as rendered (badgeNodes / stationNodes:
 *    a badge is 5 elements, not 3); each badge is admitted WITH its label's node reserved, in priority order, so the
 *    T1 labels never lose their node to a crowd of T2 / T3 badges; the lowest-priority badges past the budget are
 *    returned in `overBudget` for the canvas (plain dots, no tap target). A marker that costs no SVG node (a canvas
 *    station, `nodes: 0`) is never over budget: past it, it stays an obstacle without its label.
 */

export interface LayoutItem {
  id: string;
  x: number;
  y: number;
  /** badge radius (px), 0 for a label-only item (zone names) */
  r: number;
  /** lower = more important (see `layoutPriority`) */
  prio: number;
  /** the label text (absent = no label wanted) */
  label?: string;
  fontPx?: number;
  /** may merge into a neighbour (false: selected, target, stations) */
  clusterable?: boolean;
  /** others may merge into it (default true; false: stations, whose mark has no "+n" pip) */
  host?: boolean;
  /** a box-shaped marker's half width / half height (px; default r): a station pill */
  hw?: number;
  hh?: number;
  /** labels of items more important than this (prio below it) may cover this marker (stations: the T1 band) */
  yieldBelow?: number;
  /** SVG nodes this item costs without its label and pip (badgeNodes / stationNodes; default a plain badge, 5) */
  nodes?: number;
}

export interface LabelBox { x: number; y: number; w: number; h: number; pos: 'right' | 'left' | 'above' | 'below' | 'center'; anchor: 'start' | 'end' | 'middle'; tx: number; ty: number }
export interface LaidOut { id: string; x: number; y: number; r: number; members: string[]; label: LabelBox | null; text: string | null }
export interface LayoutResult { kept: LaidOut[]; merged: Record<string, string>; overBudget: string[]; nodes: number }

export interface LayoutOptions {
  w: number;
  h: number;
  /** right tool column (px) */
  toolRight?: number;
  /** bottom credit line (px) */
  creditBottom?: number;
  /** gap around label boxes (px) */
  pad?: number;
  clusters?: boolean;
  /** SVG node budget (badges + labels) */
  maxNodes?: number;
}

type Box = [number, number, number, number];
const hit = (a: Box, b: Box) => !(a[2] <= b[0] || a[0] >= b[2] || a[3] <= b[1] || a[1] >= b[3]);

/**
 * The four label boxes of a badge, in the order they are tried (plan §4.1). A box-shaped marker (`box`: half extents)
 * keeps its labels 3 px beside / above / below its box instead of its disc.
 */
export function labelCandidates(x: number, y: number, r: number, text: string, fontPx: number, pad = 3, box?: { hw: number; hh: number }): LabelBox[] {
  const w = labelWidth(text, fontPx) + 4, h = fontPx + 3, gx = (box?.hw ?? r) + 3, gy = (box?.hh ?? r) + 3;
  if (r === 0 && !box) return [{ x: x - w / 2, y: y - h / 2, w, h, pos: 'center', anchor: 'middle', tx: x, ty: y + fontPx * 0.36 }];
  const base = fontPx * 0.36;
  return [
    { x: x + gx, y: y - h / 2, w, h, pos: 'right', anchor: 'start', tx: x + gx + 2, ty: y + base },
    { x: x - gx - w, y: y - h / 2, w, h, pos: 'left', anchor: 'end', tx: x - gx - 2, ty: y + base },
    { x: x - w / 2, y: y - gy - h - pad / 2, w, h, pos: 'above', anchor: 'middle', tx: x, ty: y - gy - pad / 2 - h / 2 + base },
    { x: x - w / 2, y: y + gy + pad / 2, w, h, pos: 'below', anchor: 'middle', tx: x, ty: y + gy + pad / 2 + h / 2 + base },
  ];
}

const hwOf = (k: LayoutItem) => k.hw ?? k.r, hhOf = (k: LayoutItem) => k.hh ?? k.r;
/** Two markers touch (2 px apart or closer): discs by their radii, a box-shaped one by its box. */
function touching(a: LayoutItem, b: LayoutItem): boolean {
  if (a.hw === undefined && a.hh === undefined && b.hw === undefined && b.hh === undefined) return Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + 2;
  return Math.abs(a.x - b.x) < hwOf(a) + hwOf(b) + 2 && Math.abs(a.y - b.y) < hhOf(a) + hhOf(b) + 2;
}

/** Lay out badges, clusters and labels (pure; see the header). Items may come in any order. */
export function layoutMap(items: readonly LayoutItem[], o: LayoutOptions): LayoutResult {
  const { w, h } = o;
  const toolRight = o.toolRight ?? 44, creditBottom = o.creditBottom ?? 16, pad = o.pad ?? 3, maxNodes = o.maxNodes ?? 150;
  const sorted = [...items].sort((a, b) => a.prio - b.prio || (a.id < b.id ? -1 : 1));
  // 2. clusters
  const kept: (LayoutItem & { members: string[] })[] = [];
  const merged: Record<string, string> = {};
  for (const it of sorted) {
    if (o.clusters !== false && it.r > 0 && it.clusterable !== false) {
      const host = kept.find(k => k.r > 0 && k.host !== false && touching(k, it));
      if (host) { host.members.push(it.id); merged[it.id] = host.id; continue; }
    }
    kept.push({ ...it, members: [] });
  }
  // 4. budget, in priority order: a badge comes in with its pip and its label's node reserved (released below when the
  //    label finds no room), so a crowd of low badges can never starve the T1 labels
  let nodes = 0;
  const overBudget: string[] = [];
  const within: typeof kept = [];
  for (const k of kept) {
    const own = (k.nodes ?? (k.r > 0 ? 5 : 0)) + (k.members.length ? 2 : 0);
    const n = own + (k.label ? 1 : 0);
    if (nodes + n > maxNodes) {
      // a marker that costs no SVG node (a canvas station: ui/mapLines drawStationMarks draws it anyway) stays an
      // obstacle and only loses its label (review 2: dropping it let lower labels cover the pill and listed it in
      // `overBudget`, whose ids the canvas draws a second time as plain dots)
      if (own === 0 && (k.r > 0 || k.hw !== undefined)) within.push({ ...k, label: undefined });
      else overBudget.push(k.id);
      continue;
    }
    nodes += n;
    within.push(k);
  }
  // 3. labels
  const frame: Box = [0, 0, w - toolRight, h - creditBottom];
  const discs: Box[] = within.map(k => [k.x - hwOf(k), k.y - hhOf(k), k.x + hwOf(k), k.y + hhOf(k)]);
  // the "+n" pips (MapBadge draws them at 2 o'clock): no label covers one, not even its own badge's
  const placed: Box[] = within.filter(k => k.members.length && k.r > 0).map(k => { const b = pipBox(k.r, k.members.length); return [k.x + b[0], k.y + b[1], k.x + b[2], k.y + b[3]]; });
  const out: LaidOut[] = [];
  within.forEach((k, i) => {
    let label: LabelBox | null = null, text: string | null = null;
    if (k.label) {
      text = k.members.length ? `${k.label} +${k.members.length}` : k.label;
      const cands = labelCandidates(k.x, k.y, k.r, text, k.fontPx ?? 11, pad, k.hw !== undefined || k.hh !== undefined ? { hw: hwOf(k), hh: hhOf(k) } : undefined);
      if (k.members.length && k.r > 0) {
        // a clustered badge: its own pip takes the upper right, so the right-hand box may also sit just below the pip
        const right = cands[0], dy = k.y + pipBox(k.r, k.members.length)[3] + pad - right.y;
        if (dy > 0) cands.push({ ...right, y: right.y + dy, ty: right.ty + dy });
      }
      // never against its own badge; a marker that yields (a station) only blocks the labels less important than its
      // band — and even those try every box clear of it first (review 2: a must-see's name took its first box over a
      // pill while another box was free, hiding the pill's discs: 市政厅 over the Civic Center pill)
      const pick = (strict: boolean): LabelBox | null => {
        for (const c of cands) {
          const b: Box = [c.x - pad / 2, c.y - pad / 2, c.x + c.w + pad / 2, c.y + c.h + pad / 2];
          if (b[0] < frame[0] || b[1] < frame[1] || b[2] > frame[2] || b[3] > frame[3]) continue;
          if (placed.some(p => hit(p, b))) continue;
          if (discs.some((d, j) => j !== i && (strict || !(k.prio < (within[j].yieldBelow ?? -Infinity))) && hit(d, b))) continue;
          placed.push(b);
          return c;
        }
        return null;
      };
      label = pick(true) ?? (within.some((o, j) => j !== i && k.prio < (o.yieldBelow ?? -Infinity)) ? pick(false) : null);
      if (!label) { text = null; nodes--; }
    }
    out.push({ id: k.id, x: k.x, y: k.y, r: k.r, members: k.members, label, text });
  });
  return { kept: out, merged, overBudget, nodes };
}

// ---------------------------------------------------------------------------------------------------------------------
// Attractions → layout items (the CityMap glue, pure)
// ---------------------------------------------------------------------------------------------------------------------

/** Priority bands (lower first): selected 0, target 1, next tour stop 2, T1 10, T2 20, stations 30, T3 40, T4 50, zones 60; fame orders inside a band. */
export function layoutPriority(o: { selected?: boolean; target?: boolean; tourNext?: boolean; tier?: MapTier; station?: boolean; zone?: boolean; fame?: number }): number {
  const band = o.selected ? 0 : o.target ? 1 : o.tourNext ? 2 : o.zone ? 60 : o.station ? 30 : o.tier === 1 ? 10 : o.tier === 2 ? 20 : o.tier === 3 ? 40 : 50;
  return band + (1 - Math.min(100, Math.max(0, o.fame ?? 50)) / 100) * 0.99;
}

export interface AttractionMarker { a: Attraction; x: number; y: number; size: BadgeSize; state: BadgeState; alpha: number; label: string | null }

/**
 * The attraction badges for a view (culled with a 24 px margin, visibility by scale and filter), as layout items and
 * the per-badge draw data. `name` picks the label text (zh shows zh only below s 1.2: the caller passes the locale's
 * short name). The selected badge and the active target always show.
 */
export function attractionMarkers(list: readonly Attraction[], v: MapView, o: {
  discovered: (placeId: string) => boolean; arrived?: (id: string) => boolean; selected?: string | null; target?: string | null;
  tourNext?: { id: string; n: number } | null; filter?: MapFilter; name: (b: Bilingual) => string;
  /** a highlighted walking route: attraction id → its stop number (the badge wears it; shown and named like a tour stop) */
  stops?: ReadonlyMap<string, number> | null;
  /** lane V's T1 stickers are ready (the atlas decoded, not `?stickers=0`): T1 badges draw them from s 0.45 */
  stickers?: boolean;
}): { items: LayoutItem[]; markers: Map<string, AttractionMarker> } {
  const s = v.scale, rules = scaleRules(s);
  const focusCat = MAP_FILTERS.find(d => d.id === o.filter)?.cat;
  const items: LayoutItem[] = [];
  const markers = new Map<string, AttractionMarker>();
  for (const a of list) {
    const [x, y] = toPx(v, a.x, a.z);
    if (x < -24 || y < -24 || x > v.w + 24 || y > v.h + 24) continue;
    const walkN = o.stops?.get(a.id);
    const selected = o.selected === a.id, target = o.target === a.id, tourNext = o.tourNext?.id === a.id || walkN !== undefined;
    const look = filterAttraction(o.filter ?? 'all', a);
    if (!look.show && !selected && !target) continue;
    // a category chip (校园, 博物馆 …) shows its own T2 / T3 at every scale (integration: at the whole-city fit the
    // campus chip must show the campuses, not only SF State): T2 as badges, T3 as dots
    const focus = (!!focusCat && a.cat === focusCat && a.rank > 1) || (walkN !== undefined && a.rank > 1);
    let size = badgeSize(a.rank, s);
    if (size.kind === 'none' && focus) size = a.rank === 2 ? badgeSize(2, SCALE_STEPS.t2) : badgeSize(3, SCALE_STEPS.t3);
    if (size.kind === 'none' && !selected && !target) continue;
    const shown = size.kind === 'none' ? badgeSize(1, s) : size;
    const dim = look.alpha < 1 && !selected && !target;
    const state: BadgeState = {
      discovered: o.discovered(a.placeId ?? a.id), arrived: o.arrived?.(a.id), selected, target, dim,
      ...(dim ? { dimAlpha: look.alpha } : {}), ...(o.tourNext?.id === a.id ? { tourStop: o.tourNext.n } : walkN !== undefined ? { tourStop: walkN, stopTone: 'walk' as const } : {}),
      ...(o.stickers && a.rank === 1 && !target && s >= MAP_STICKERS_T1.minScale && isMapStickerId(a.id) ? { sticker: true } : {}),
    };
    const wantLabel = selected || target || tourNext || (look.label && (a.rank === 1 || (a.rank === 2 && (rules.t2Labels || focus)) || (a.rank === 3 && (rules.t3Labels || (focus && s >= SCALE_STEPS.t3)))));
    const label = wantLabel ? o.name(selected ? a.name : attractionShort(a)) : null;
    items.push({
      id: a.id, x, y, r: shown.r, prio: layoutPriority({ selected, target, tourNext, tier: a.rank, fame: a.fame }),
      ...(label ? { label, fontPx: shown.font } : {}), clusterable: !selected && !target, nodes: badgeNodes(shown, state),
    });
    markers.set(a.id, { a, x, y, size: shown, state, alpha: state.dim ? look.alpha : 1, label });
  }
  return { items, markers };
}

/** The layout id of a station item (stations and attractions share one layout; ids must not collide). */
export const stationLayoutId = (stationId: string) => `station:${stationId}`;

/**
 * A station as a layout item (lane P2; CityMap feeds these with the attraction items): its pill / dot as a box (the
 * dot's stair mark widens it), band 30 (majors first), its real SVG cost (`stationNodes`), and no merging either way —
 * a pill is never swallowed into a badge's "+n" and nothing merges into a pill; labels, its own included, keep off it.
 * `label` is the station name to show when the symbol asks for one (`sym.label`). `canvas: true` (the phone budget:
 * ui/mapLines drawStationMarks draws the marks) makes the mark cost no SVG node; its label still costs one.
 */
export function stationItem(st: Pick<MapStation, 'id' | 'major'>, sym: StationSymbol, x: number, y: number, label?: string | null, fontPx = 10, o: { canvas?: boolean } = {}): LayoutItem {
  const hw = sym.w / 2 + (sym.stair && sym.kind === 'dot' ? 12 : 0);
  return {
    id: stationLayoutId(st.id), x, y, r: sym.h / 2, hw, hh: sym.h / 2, prio: layoutPriority({ station: true, fame: st.major ? 70 : 30 }),
    clusterable: false, host: false, yieldBelow: 20, nodes: o.canvas ? 0 : stationNodes(sym), ...(label && sym.label ? { label, fontPx } : {}),
  };
}
