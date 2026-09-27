import type { Attraction } from '../data/sf/attractionTypes';
import { attractionColor, attractionGlyph, type MapTier } from '../data/sf/attractions';

/**
 * Wave 4 · attraction badges on the city map (lane P, W4-P4; plan sf-w4-plan.md §4.1 "Tiers", "Badges", "Visibility by
 * scale"). Pure numbers and rules; ui/MapBadge.tsx draws them, ui/MapLegend.tsx shows them.
 *
 * Scale `s` = CSS px per world unit (absolute: a phone and a desktop at the same s show the same things).
 */

/** What the map shows at scale s (plan §4.1 "Visibility by scale"). */
export interface ScaleRules {
  t2Badges: boolean;
  t2Labels: boolean;
  t3: 'none' | 'dot' | 'badge';
  t3Labels: boolean;
  t4Dots: boolean;
  t4Labels: boolean;
  stations: 'none' | 'canvas' | 'svg';
  zoneNames: boolean;
  lineWidth: number;
  clusters: boolean;
}

export const SCALE_STEPS = { t2: 0.3, t3: 0.45, t3Badge: 1.2, t4: 1.5, t4Labels: 3, zonesOff: 2, clustersOff: 1.2 } as const;

export function scaleRules(s: number): ScaleRules {
  return {
    t2Badges: s >= SCALE_STEPS.t2,
    t2Labels: s >= SCALE_STEPS.t3,
    t3: s >= SCALE_STEPS.t3Badge ? 'badge' : s >= SCALE_STEPS.t3 ? 'dot' : 'none',
    t3Labels: s >= SCALE_STEPS.t3Badge,
    t4Dots: s >= SCALE_STEPS.t4,
    t4Labels: s >= SCALE_STEPS.t4Labels,
    stations: s >= 0.45 ? 'svg' : s >= 0.3 ? 'canvas' : 'none',
    zoneNames: s >= SCALE_STEPS.t2 && s < SCALE_STEPS.zonesOff,
    lineWidth: s < 0.3 ? 2 : Math.min(6, Math.max(2, 1.6 * s)),
    clusters: s < SCALE_STEPS.clustersOff,
  };
}

/** The drawn size of a badge (px): r = radius of the disc, glyph = icon size; kind dot = a plain dot, no glyph. */
export interface BadgeSize { kind: 'badge' | 'dot' | 'none'; r: number; glyph: number; font: number; weight: number }

/** Plan §4.1: T1 26 px (glyph 14), T2 20 px (11), T3 a 10 px dot until s 1.2 then 16 px (9), T4 3.5 px dots from s 1.5. */
export function badgeSize(tier: MapTier, s: number): BadgeSize {
  const r = scaleRules(s);
  switch (tier) {
    case 1: return { kind: 'badge', r: 13, glyph: 14, font: 12, weight: 800 };
    case 2: return r.t2Badges ? { kind: 'badge', r: 10, glyph: 11, font: 11, weight: 700 } : { kind: 'none', r: 0, glyph: 0, font: 11, weight: 700 };
    case 3: return r.t3 === 'badge' ? { kind: 'badge', r: 8, glyph: 9, font: 10.5, weight: 700 } : r.t3 === 'dot' ? { kind: 'dot', r: 5, glyph: 0, font: 10.5, weight: 700 } : { kind: 'none', r: 0, glyph: 0, font: 10.5, weight: 700 };
    default: return r.t4Dots ? { kind: 'dot', r: 1.75, glyph: 0, font: 10, weight: 600 } : { kind: 'none', r: 0, glyph: 0, font: 10, weight: 600 };
  }
}

/** A badge's state on the map (plan §4.1 "States"). */
export interface BadgeState {
  /** been there (discovery): category fill + cream glyph; else cream fill + category ring + category glyph */
  discovered: boolean;
  /** had the arrival moment: a 7 px gold tick at 4 o'clock */
  arrived?: boolean;
  /** 3 px gold ring, scale 1.15 */
  selected?: boolean;
  /** the active trip / tour target: a 30 px gold pin-flag with a pulse ring instead of the badge */
  target?: boolean;
  /** the next tour stop: a coral number disc at 10 o'clock */
  tourStop?: number;
  /** a filter dims the badge to 25 % */
  dim?: boolean;
  /** members merged into this badge: a "+n" pip at 2 o'clock */
  cluster?: number;
}

export const BADGE_INK = { cream: '#fffaf1', outline: 'rgba(60, 40, 20, .25)', shadow: 'rgba(34, 50, 47, .22)', gold: '#e0a94a', goldDeep: '#a8741f', coral: '#e0563f', tick: '#e0a94a' } as const;

/** Paint of a badge: fill, ring, glyph colour, and the extras' anchor points (px, relative to the centre). */
export interface BadgePaint {
  fill: string;
  ring: string;
  ringWidth: number;
  glyph: string;
  scale: number;
  opacity: number;
  tick: { x: number; y: number } | null;
  pip: { x: number; y: number; text: string } | null;
  tourDisc: { x: number; y: number; text: string } | null;
  /** the baked shadow circle (offset 0, 1.5; 22 % ink), no SVG filters on phones */
  shadow: { dy: number; color: string };
}

const at = (clock: number, r: number) => { const a = ((clock / 12) * 360 - 90) * (Math.PI / 180); return { x: Math.cos(a) * r, y: Math.sin(a) * r }; };

export function badgePaint(a: Pick<Attraction, 'cat'>, size: BadgeSize, st: BadgeState): BadgePaint {
  const color = attractionColor(a);
  const discovered = st.discovered;
  return {
    fill: discovered ? color : BADGE_INK.cream,
    ring: st.selected ? BADGE_INK.gold : discovered ? BADGE_INK.cream : color,
    ringWidth: st.selected ? 3 : discovered ? 2 : 2.5,
    glyph: discovered ? BADGE_INK.cream : color,
    scale: st.selected ? 1.15 : 1,
    opacity: st.dim ? 0.25 : 1,
    tick: st.arrived ? at(4, size.r) : null,
    pip: st.cluster && st.cluster > 0 ? { ...at(2, size.r + 2), text: `+${st.cluster}` } : null,
    tourDisc: st.tourStop !== undefined ? { ...at(10, size.r + 1), text: String(st.tourStop) } : null,
    shadow: { dy: 1.5, color: BADGE_INK.shadow },
  };
}

/** The lucide glyph name of an attraction's badge. */
export const badgeGlyph = (a: Pick<Attraction, 'cat' | 'glyph'>) => attractionGlyph(a);

/** SVG nodes one badge costs (for the ≤ 150 / 120 node budget): shadow + disc + glyph (+ tick, pip 2, tour disc 2, pulse). */
export function badgeNodes(size: BadgeSize, st: BadgeState): number {
  if (size.kind === 'none') return 0;
  if (size.kind === 'dot') return 1;
  return 3 + (st.arrived ? 1 : 0) + (st.cluster ? 2 : 0) + (st.tourStop !== undefined ? 2 : 0) + (st.target ? 2 : 0);
}
