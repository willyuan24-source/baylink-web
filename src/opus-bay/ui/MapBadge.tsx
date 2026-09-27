import type { Attraction } from '../data/sf/attractionTypes';
import type { MapTier } from '../data/sf/attractions';
import { BADGE_INK, type BadgeSize, type BadgeState, badgeGlyph, badgePaint, badgeSize } from './mapBadges';
import { ATTRACTION_ICONS } from './mapIcons';

/**
 * Wave 4 · one attraction badge in the city map's SVG overlay (lane P, W4-P4; plan §4.1 "Badges"). Prop-driven, no
 * store access: CityMap (integration phase) passes the attraction, its tier, the scale and the state. Draws a baked
 * shadow circle (no SVG filters: phones), the disc, the category glyph, and the extras (arrived tick, cluster pip,
 * tour-stop number). `MapTargetPin` is the active target's gold pin-flag (the in-world flag's shape).
 */
export function MapBadge({ a, tier, s, state, x, y, size }: {
  a: Pick<Attraction, 'id' | 'cat' | 'glyph'>; tier: MapTier; s: number; state: BadgeState; x: number; y: number;
  /** override (the legend draws fixed sizes) */
  size?: BadgeSize;
}) {
  const sz = size ?? badgeSize(tier, s);
  if (sz.kind === 'none') return null;
  const p = badgePaint(a, sz, state);
  if (state.target) return <MapTargetPin x={x} y={y} />;
  if (sz.kind === 'dot') {
    return <circle className="mw-dot" cx={x} cy={y} r={sz.r} fill={p.fill} stroke={p.ring} strokeWidth={sz.r > 3 ? 1.6 : 1} opacity={p.opacity} />;
  }
  const Icon = ATTRACTION_ICONS[badgeGlyph(a)];
  const g = sz.glyph;
  return (
    <g className={`mw-badge t${tier}${state.selected ? ' is-on' : ''}`} transform={`translate(${x},${y}) scale(${p.scale})`} opacity={p.opacity} data-id={a.id}>
      <circle cy={p.shadow.dy} r={sz.r + 1} fill={p.shadow.color} />
      <circle r={sz.r} fill={p.fill} stroke={p.ring} strokeWidth={p.ringWidth} />
      <circle r={sz.r + p.ringWidth / 2 + 0.5} fill="none" stroke={BADGE_INK.outline} strokeWidth={1} />
      <Icon x={-g / 2} y={-g / 2} width={g} height={g} strokeWidth={2.3} color={p.glyph} aria-hidden />
      {p.tick && (
        <g transform={`translate(${p.tick.x},${p.tick.y})`}>
          <circle r={3.5} fill={BADGE_INK.tick} stroke={BADGE_INK.cream} strokeWidth={1.2} />
          <path d="M-1.6 0 L-0.4 1.2 L1.7 -1.2" fill="none" stroke={BADGE_INK.cream} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {p.pip && (
        <g transform={`translate(${p.pip.x},${p.pip.y})`} className="mw-pip">
          <rect x={-2} y={-6} width={p.pip.text.length * 6 + 6} height={12} rx={6} fill={BADGE_INK.cream} stroke={BADGE_INK.outline} />
          <text x={1} y={3.5}>{p.pip.text}</text>
        </g>
      )}
      {p.tourDisc && (
        <g transform={`translate(${p.tourDisc.x},${p.tourDisc.y})`} className="mw-tour">
          <circle r={6.5} fill={BADGE_INK.coral} stroke={BADGE_INK.cream} strokeWidth={1.4} />
          <text y={3.4}>{p.tourDisc.text}</text>
        </g>
      )}
    </g>
  );
}

/** The active target: a 30 px gold pin-flag with a pulse ring (CSS animation, off under reduced motion). */
export function MapTargetPin({ x, y }: { x: number; y: number }) {
  return (
    <g className="mw-target" transform={`translate(${x},${y})`}>
      <circle className="mw-target-pulse" r={12} fill="none" stroke={BADGE_INK.gold} strokeWidth={2} />
      <ellipse cy={1.5} rx={4} ry={1.6} fill={BADGE_INK.shadow} />
      <path d="M0 0 L0 -28" stroke={BADGE_INK.goldDeep} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M0.8 -28 L15 -23.5 L0.8 -18.5 Z" fill={BADGE_INK.gold} stroke={BADGE_INK.goldDeep} strokeWidth={1} strokeLinejoin="round" />
      <circle cy={-28.5} r={2} fill={BADGE_INK.gold} stroke={BADGE_INK.goldDeep} strokeWidth={0.8} />
    </g>
  );
}

/** The underground-station mark (no stairs icon in lucide 0.460): a small stepped line, 12 × 12 px at (x, y) top-left. */
export function StairGlyph({ x = 0, y = 0, color = '#4d5d58' }: { x?: number; y?: number; color?: string }) {
  return <path d={`M${x + 1} ${y + 11} H${x + 4} V${y + 8} H${x + 7} V${y + 5} H${x + 10} V${y + 2} H${x + 12}`} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />;
}
