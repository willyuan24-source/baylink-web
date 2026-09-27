import type { Bilingual, Vec2 } from '../core/types';
import {
  ATTRACTION_CAT_STYLE, ATTRACTION_FLAG_H, type AttractionCat, type AttractionFlag, type AttractionGlyph, type AttractionRank,
} from '../data/sf/attractionTypes';

/**
 * Wave 4 · which attraction flags stand in the world (lane G, W4-G7; plan sf-w4-plan.md §4.2 "Attraction flags" and
 * "Viewpoint panorama"). Pure: world/sf/flags.ts draws what `pickFlags` returns (one InstancedMesh), the panorama tags
 * (ui/PanoramaTags.tsx) show what `pickPanoramaTags` returns, placed by `layoutPanoramaTags`.
 *
 *   1. the active target first (gold, up to the 3,000 u far plane; none within 60 u: the light column takes the last
 *      150 u and the landmark reads by itself there)
 *   2. undiscovered T1 within 1,600 u and ±75° of the camera's view, nearest first (discovered T1 only with Settings ›
 *      显示地标旗)
 *   3. during a panorama: every T1 / T2 in view within 2,000 u (T1 first)
 *   max 6 on desktop, 3 on phones / quality mid or low, 8 during a desktop panorama; flags carry no text (anti-spam,
 *   plan §4.2: 1 waypoint, the flags, BAYBAY's bubble, 1 toast)
 */

export const FLAG_RULES = {
  /** no flag closer than this (u) */
  near: 60,
  /** undiscovered T1 within this (u) */
  far: 1600,
  /** the active target's flag up to the far plane (u) */
  targetFar: 3000,
  /** panorama flags / tags within this (u) */
  panoramaFar: 2000,
  /** half the view cone around the camera's look direction (rad): ±75° */
  halfView: (75 * Math.PI) / 180,
  maxDesktop: 6,
  maxPhone: 3,
  maxPanorama: 8,
  /** pole top of a site without `flag.h` (plan §4.2: low sites a 30 u pole) */
  defaultH: 30,
} as const;

/** The active target's pennant (the map's gold pin-flag colour). */
export const FLAG_GOLD = '#e0a94a';

/** Glyphs on flags: the attraction glyphs plus a pin for a target that is not an attraction (a place, a stop). */
export const FLAG_GLYPHS = ['Landmark', 'Palette', 'Trees', 'PawPrint', 'Mountain', 'Binoculars', 'Waves', 'Sailboat', 'GraduationCap', 'ShoppingBag', 'Trophy', 'Church', 'Theater', 'Castle', 'Signpost', 'MapPin'] as const;
export type FlagGlyph = (typeof FLAG_GLYPHS)[number];

/** What pickFlags needs of an attraction (data/sf/attractionTypes.ts Attraction is assignable). */
export interface FlagSource {
  id: string;
  rank: AttractionRank;
  cat: AttractionCat;
  glyph?: AttractionGlyph;
  x: number;
  z: number;
  flag?: AttractionFlag;
  placeId?: string;
  fame?: number;
  name?: Bilingual;
  short?: Bilingual;
}

export interface FlagTarget {
  x: number;
  z: number;
  /** the Attraction id when the target is one (its glyph, its flag foot and height) */
  attraction?: string;
  /** pole top above the ground (u); default: the attraction's flag.h, else FLAG_RULES.defaultH */
  h?: number;
}

export type FlagRole = 'target' | 'tier1' | 'panorama';

export interface FlagPick {
  /** stable key (the attraction id, or `target` for a non-attraction target) */
  key: string;
  attraction: string | null;
  role: FlagRole;
  /** pole foot */
  x: number;
  z: number;
  /** pole top above the ground (u, clamped to ATTRACTION_FLAG_H) */
  h: number;
  /** pennant colour (hex) */
  color: string;
  glyph: FlagGlyph;
  /** distance from the player (u) */
  d: number;
}

export interface PickFlagsInput {
  player: Vec2;
  /** the camera orbit yaw (runtime.camera.yaw: the camera sits at (sin yaw, cos yaw) · dist from the player and looks
   * the other way) */
  yaw: number;
  attractions: readonly FlagSource[];
  discovered: (a: FlagSource) => boolean;
  target?: FlagTarget | null;
  max: number;
  /** Settings › 显示地标旗: discovered T1 keep their flag */
  showDiscovered?: boolean;
  /** a viewpoint panorama is running: T1 / T2 in view within 2,000 u */
  panorama?: boolean;
}

/** How many flags: 3 on phones / quality mid or low, 6 on desktop, 8 during a desktop panorama. */
export function flagMax(o: { phone: boolean; quality?: 'low' | 'mid' | 'high'; panorama?: boolean }): number {
  if (o.phone || o.quality === 'mid' || o.quality === 'low') return FLAG_RULES.maxPhone;
  return o.panorama ? FLAG_RULES.maxPanorama : FLAG_RULES.maxDesktop;
}

/** The camera's look direction on the ground for an orbit yaw (unit vector). */
export const viewDir = (yaw: number): Vec2 => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });

/** Is p within ±half of the look direction from `from`? */
export function inViewCone(from: Vec2, yaw: number, p: Vec2, half: number = FLAG_RULES.halfView): boolean {
  const dx = p.x - from.x, dz = p.z - from.z, d = Math.hypot(dx, dz);
  if (d < 1e-6) return true;
  const v = viewDir(yaw);
  return (dx * v.x + dz * v.z) / d >= Math.cos(half);
}

const clampH = (h: number) => Math.min(ATTRACTION_FLAG_H.max, Math.max(ATTRACTION_FLAG_H.min, h));
const glyphOf = (a: FlagSource): FlagGlyph => a.glyph ?? ATTRACTION_CAT_STYLE[a.cat].glyph;
const footOf = (a: FlagSource): Vec2 => (a.flag ? { x: a.flag.x, z: a.flag.z } : { x: a.x, z: a.z });

function pickOf(a: FlagSource, role: FlagRole, player: Vec2): FlagPick {
  const f = footOf(a);
  return {
    key: a.id, attraction: a.id, role, x: f.x, z: f.z, h: clampH(a.flag?.h ?? FLAG_RULES.defaultH),
    color: role === 'target' ? FLAG_GOLD : ATTRACTION_CAT_STYLE[a.cat].color, glyph: glyphOf(a), d: Math.hypot(f.x - player.x, f.z - player.z),
  };
}

const byFame = (a: FlagSource, b: FlagSource) => (b.fame ?? 50) - (a.fame ?? 50);

/** The flags to stand in the world now (plan §4.2 order), at most `max`. */
export function pickFlags(input: PickFlagsInput): FlagPick[] {
  const { player, yaw, attractions, target, showDiscovered, panorama } = input;
  const max = Math.max(0, Math.floor(input.max));
  const out: FlagPick[] = [];
  if (max === 0) return out;
  const taken = new Set<string>();
  // 1. the active target (gold): its attraction's flag, else a pin on the target point
  if (target) {
    const a = target.attraction ? attractions.find(x => x.id === target.attraction) : undefined;
    const p: FlagPick = a
      ? { ...pickOf(a, 'target', player), ...(target.h !== undefined ? { h: clampH(target.h) } : {}) }
      : { key: 'target', attraction: null, role: 'target', x: target.x, z: target.z, h: clampH(target.h ?? FLAG_RULES.defaultH), color: FLAG_GOLD, glyph: 'MapPin', d: Math.hypot(target.x - player.x, target.z - player.z) };
    if (p.d >= FLAG_RULES.near && p.d <= FLAG_RULES.targetFar) out.push(p);
    // the target's attraction never shows twice (also not while the target flag hides within 60 u)
    if (a) taken.add(a.id);
  }
  const room = () => out.length < max;
  const eligible = (a: FlagSource, far: number) => {
    if (taken.has(a.id)) return null;
    const f = footOf(a), d = Math.hypot(f.x - player.x, f.z - player.z);
    if (d < FLAG_RULES.near || d > far || !inViewCone(player, yaw, f)) return null;
    return d;
  };
  // 3. panorama: T1 then T2 in view within 2,000 u (nearest first inside a rank)
  if (panorama) {
    for (const rank of [1, 2] as const) {
      const list = attractions
        .filter(a => a.rank === rank)
        .map(a => ({ a, d: eligible(a, FLAG_RULES.panoramaFar) }))
        .filter((e): e is { a: FlagSource; d: number } => e.d !== null)
        .sort((p, q) => p.d - q.d);
      for (const { a } of list) { if (!room()) return out; out.push(pickOf(a, 'panorama', player)); taken.add(a.id); }
    }
    return out;
  }
  // 2. T1 (undiscovered, or all with the setting on) within 1,600 u in view, nearest first
  const t1 = attractions
    .filter(a => a.rank === 1 && (showDiscovered || !input.discovered(a)))
    .map(a => ({ a, d: eligible(a, FLAG_RULES.far) }))
    .filter((e): e is { a: FlagSource; d: number } => e.d !== null)
    .sort((p, q) => p.d - q.d || byFame(p.a, q.a));
  for (const { a } of t1) { if (!room()) break; out.push(pickOf(a, 'tier1', player)); taken.add(a.id); }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Viewpoint panorama tags (plan §4.2): "我指给你看！" — every T1 / T2 in view within 2,000 u, a projected name tag
// for 10 s, at most 8, collision-avoided; tap → trip options from here
// ---------------------------------------------------------------------------------------------------------------

export const PANORAMA = {
  /** the tags show this long (s) */
  seconds: 10,
  max: 8,
  far: 2000,
  /** the six viewpoints (sf-w4-attractions.json ids; lane P marks them `panorama: true`, which wins): the first
   * arrival or E at the overlook starts it */
  viewpoints: ['twin-peaks', 'coit-tower', 'de-young-tower', 'grand-view-park', 'corona-heights-randall-museum', 'bernal-heights-park'],
} as const;

/**
 * A panorama name tag. `x`, `z` = the flag's pole foot (the same point pickFlags plants the flag on) and `h` = its pole
 * top above the ground there, so the projector anchors the tag at (x, ground + h, z), right over the flag (review: the
 * tag used the attraction centre, up to ≈ 10 u off the flag, and the integrator had to look the flag height up again).
 */
export interface PanoramaTag { id: string; name: Bilingual; x: number; z: number; h: number; rank: AttractionRank; d: number; color: string; glyph: FlagGlyph }

/** Is this attraction a panorama viewpoint (its `panorama` flag, else the default list)? */
export const isPanoramaViewpoint = (a: { id: string; panorama?: boolean }) => a.panorama ?? (PANORAMA.viewpoints as readonly string[]).includes(a.id);

/** The attractions to name from a viewpoint: T1 then T2, in view, within 2,000 u, at most 8 (T1 first, nearer first). */
export function pickPanoramaTags(eye: Vec2, yaw: number, attractions: readonly FlagSource[], max: number = PANORAMA.max, halfView = FLAG_RULES.halfView): PanoramaTag[] {
  const list = attractions
    .filter(a => (a.rank === 1 || a.rank === 2) && a.name)
    .map(a => { const f = footOf(a); return { a, f, d: Math.hypot(f.x - eye.x, f.z - eye.z) }; })
    .filter(e => e.d >= FLAG_RULES.near && e.d <= PANORAMA.far && inViewCone(eye, yaw, e.f, halfView))
    .sort((p, q) => p.a.rank - q.a.rank || p.d - q.d);
  return list.slice(0, Math.max(0, max)).map(({ a, f, d }) => ({
    id: a.id, name: a.short ?? a.name!, x: f.x, z: f.z, h: clampH(a.flag?.h ?? FLAG_RULES.defaultH), rank: a.rank, d, color: ATTRACTION_CAT_STYLE[a.cat].color, glyph: glyphOf(a),
  }));
}

/** A tag projected to the screen: anchor (the attraction's top) in CSS px; `w` / `h` = the tag's size estimate. */
export interface TagInput { id: string; x: number; y: number; w: number; h: number; rank: AttractionRank; behind?: boolean }
export interface TagBox { l: number; t: number; r: number; b: number }
export interface PlacedTag { id: string; x: number; y: number; box: TagBox; lead: boolean }

/** Tag width estimate (CSS px, ui/guide-ui.css .ob-pano-tag): 12.5 px per CJK character, 7 per Latin one, + the dot,
 * gap, padding and border (7 + 8 + 6 + 9 + 2 = 32). */
export function tagWidth(text: string): number {
  let w = 0;
  for (const ch of text) { const c = ch.codePointAt(0) ?? 0; w += (c >= 0x3000 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xffef) ? 12.5 : 7; }
  return Math.ceil(w + 32);
}

const hit = (a: TagBox, b: TagBox, pad = 4) => a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad;

/**
 * Place the tags greedily (T1 first, then T2; nearer screen centre first inside a rank): each tag tries above its
 * anchor, then lifted by one and two rows (a leader line joins it to the anchor: `lead`), and is dropped when none of
 * those fits inside `area` without touching a placed tag or a fixed HUD box. Tags behind the camera or off screen drop.
 */
export function layoutPanoramaTags(tags: readonly TagInput[], area: TagBox, fixed: readonly TagBox[] = [], max: number = PANORAMA.max): PlacedTag[] {
  const cx = (area.l + area.r) / 2, cy = (area.t + area.b) / 2;
  const order = tags
    .filter(t => !t.behind && t.x >= area.l && t.x <= area.r && t.y >= area.t && t.y <= area.b)
    .sort((a, b) => a.rank - b.rank || Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  const placed: PlacedTag[] = [];
  for (const t of order) {
    if (placed.length >= max) break;
    for (let lift = 0; lift < 3; lift++) {
      const y = t.y - 10 - lift * (t.h + 8);
      const l = Math.min(area.r - t.w, Math.max(area.l, t.x - t.w / 2));
      const box: TagBox = { l, t: y - t.h, r: l + t.w, b: y };
      if (box.t < area.t) break;
      if (placed.some(p => hit(p.box, box)) || fixed.some(f => hit(f, box, 2))) continue;
      placed.push({ id: t.id, x: l + t.w / 2, y, box, lead: lift > 0 });
      break;
    }
  }
  return placed;
}
