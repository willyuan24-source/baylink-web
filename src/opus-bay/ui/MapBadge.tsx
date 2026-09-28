import type { Attraction } from '../data/sf/attractionTypes';
import type { MapTier } from '../data/sf/attractions';
import { mapStickerSvg } from '../data/sf/mapStickers';
import { GLYPH_D, GLYPH_STROKE } from './glyphPaths';
import { BADGE_INK, type BadgeSize, type BadgeState, badgeGlyph, badgePaint, badgeSize, pipBox } from './mapBadges';
import type { LabelBox } from './mapLayout';
import { type StationSymbol, stationMarkGeometry } from './mapLines';

// city-ui.css sets `.ob-citymap-overlay text { text-anchor: middle }`, and CSS beats the SVG `text-anchor` ATTRIBUTE:
// every text here that is not centred on its x sets the anchor as an inline style (as CityMap's own labels do).

/**
 * Wave 4 · one attraction badge in the city map's SVG overlay (lane P, W4-P4; plan §4.1 "Badges"). Prop-driven, no
 * store access: CityMap (integration phase) passes the attraction, its tier, the scale and the state. Draws a baked
 * shadow circle (no SVG filters: phones), the disc, its outline, the category glyph as ONE path (ui/glyphPaths.ts), and
 * the extras (arrived tick, cluster pip, tour-stop number) as flat siblings. Every element counts against the plan's
 * SVG node budget: `badgeNodes` (mapBadges.ts) is exactly what this renders (the sf-map-w4 test counts the markup).
 * `MapTargetPin` is the active target's gold pin-flag (the in-world flag's shape).
 */
export function MapBadge({ a, tier, s, state, x, y, size }: {
  a: Pick<Attraction, 'id' | 'cat' | 'glyph'>; tier: MapTier; s: number; state: BadgeState; x: number; y: number;
  /** override (the legend draws fixed sizes) */
  size?: BadgeSize;
}) {
  const sz = size ?? badgeSize(tier, s);
  if (sz.kind === 'none') return null;
  if (state.target) return <MapTargetPin x={x} y={y} />;
  const p = badgePaint(a, sz, state);
  if (sz.kind === 'dot') {
    const dot = <circle className="mw-dot" cx={x} cy={y} r={sz.r} fill={p.fill} stroke={p.ring} strokeWidth={sz.r > 3 ? 1.6 : 1} opacity={p.opacity} />;
    if (!p.pip) return dot;
    // a T3 dot that hosts a cluster shows its "+n" pip too (review fix: its label said "+n", the dot drew none); flat
    // siblings in absolute coordinates, where layoutMap's pipBox keeps the labels off it
    const [bx0, by0, bx1] = pipBox(sz.r, state.cluster!);
    return (
      <>
        {dot}
        <rect className="mw-pip" x={x + bx0} y={y + by0} width={bx1 - bx0} height={12} rx={6} fill={BADGE_INK.cream} stroke={BADGE_INK.outline} opacity={p.opacity} />
        <text className="mw-pip-t" x={x + (bx0 + bx1) / 2} y={y + p.pip.y + 3.2} style={MIDDLE} opacity={p.opacity}>{p.pip.text}</text>
      </>
    );
  }
  const g = sz.glyph;
  // lane V's illustrated T1 sticker (its own cream rim: no disc, no ring), the atlas cropped by a nested <svg>
  const st = state.sticker ? mapStickerSvg(a.id) : null;
  if (st) {
    const d = sz.r * 2 + 4;
    return (
      <g className={`mw-badge t${tier} is-sticker${state.selected ? ' is-on' : ''}`} transform={`translate(${x},${y}) scale(${p.scale})`} opacity={p.opacity} data-id={a.id}>
        <svg x={-d / 2} y={-d / 2} width={d} height={d} viewBox={st.viewBox}><image href={st.href} width={st.atlasW} height={st.atlasH} /></svg>
        {state.selected && <circle r={d / 2 + 1} fill="none" stroke={BADGE_INK.gold} strokeWidth={3} />}
        {p.tick && <circle cx={p.tick.x} cy={p.tick.y} r={3.5} fill={BADGE_INK.tick} stroke={BADGE_INK.cream} strokeWidth={1.2} />}
        {p.tick && (
          <path d={`M${p.tick.x - 1.6} ${p.tick.y} L${p.tick.x - 0.4} ${p.tick.y + 1.2} L${p.tick.x + 1.7} ${p.tick.y - 1.2}`} fill="none" stroke={BADGE_INK.cream}
            strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {p.pip && <rect className="mw-pip" x={p.pip.x - 2} y={p.pip.y - 6} width={p.pip.text.length * 6 + 6} height={12} rx={6} fill={BADGE_INK.cream} stroke={BADGE_INK.outline} />}
        {p.pip && <text className="mw-pip-t" x={p.pip.x - 2 + (p.pip.text.length * 6 + 6) / 2} y={p.pip.y + 3.2} style={MIDDLE}>{p.pip.text}</text>}
        {p.tourDisc && <circle className="mw-tour" cx={p.tourDisc.x} cy={p.tourDisc.y} r={6.5} fill={p.tourDisc.fill} stroke={BADGE_INK.cream} strokeWidth={1.4} />}
        {p.tourDisc && <text className="mw-tour-t" x={p.tourDisc.x} y={p.tourDisc.y + 3.4} style={MIDDLE}>{p.tourDisc.text}</text>}
      </g>
    );
  }
  return (
    <g className={`mw-badge t${tier}${state.selected ? ' is-on' : ''}`} transform={`translate(${x},${y}) scale(${p.scale})`} opacity={p.opacity} data-id={a.id}>
      <circle cy={p.shadow.dy} r={sz.r + 1} fill={p.shadow.color} />
      <circle r={sz.r} fill={p.fill} stroke={p.ring} strokeWidth={p.ringWidth} />
      <circle r={sz.r + p.ringWidth / 2 + 0.5} fill="none" stroke={BADGE_INK.outline} strokeWidth={1} />
      <path d={GLYPH_D[badgeGlyph(a)]} transform={`translate(${-g / 2},${-g / 2}) scale(${g / 24})`} fill="none" stroke={p.glyph} strokeWidth={GLYPH_STROKE}
        strokeLinecap="round" strokeLinejoin="round" />
      {p.tick && <circle cx={p.tick.x} cy={p.tick.y} r={3.5} fill={BADGE_INK.tick} stroke={BADGE_INK.cream} strokeWidth={1.2} />}
      {p.tick && (
        <path d={`M${p.tick.x - 1.6} ${p.tick.y} L${p.tick.x - 0.4} ${p.tick.y + 1.2} L${p.tick.x + 1.7} ${p.tick.y - 1.2}`} fill="none" stroke={BADGE_INK.cream}
          strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {p.pip && <rect className="mw-pip" x={p.pip.x - 2} y={p.pip.y - 6} width={p.pip.text.length * 6 + 6} height={12} rx={6} fill={BADGE_INK.cream} stroke={BADGE_INK.outline} />}
      {p.pip && <text className="mw-pip-t" x={p.pip.x - 2 + (p.pip.text.length * 6 + 6) / 2} y={p.pip.y + 3.2} style={MIDDLE}>{p.pip.text}</text>}
      {p.tourDisc && <circle className="mw-tour" cx={p.tourDisc.x} cy={p.tourDisc.y} r={6.5} fill={p.tourDisc.fill} stroke={BADGE_INK.cream} strokeWidth={1.4} />}
      {p.tourDisc && <text className="mw-tour-t" x={p.tourDisc.x} y={p.tourDisc.y + 3.4} style={MIDDLE}>{p.tourDisc.text}</text>}
    </g>
  );
}

const MIDDLE = { textAnchor: 'middle' } as const;

/**
 * A badge's label where layoutMap placed it (`label.tx / ty`, anchored `label.anchor`). The anchor MUST be an inline
 * style: with the attribute alone, city-ui.css centres the text on tx, i.e. over the badge's own disc (the wave-3 "label
 * on its own marker" look; the early-phase QA shot had it on every label). One <text> = one node of the budget.
 */
export function MapLabel({ label, text, fontPx, weight, selected = false }: { label: LabelBox; text: string; fontPx: number; weight?: number; selected?: boolean }) {
  return (
    <text className={`cm-label mw-label${selected ? ' is-on' : ''}`} x={label.tx} y={label.ty} style={{ textAnchor: label.anchor, fontSize: fontPx, ...(weight ? { fontWeight: weight } : {}) }}>
      {text}
    </text>
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

/**
 * A station in the SVG overlay (s ≥ 0.45; below that the canvas dot), centred on (x, y), as `stationSymbol` sizes it
 * and `stationNodes` counts it: a dot = one white 7 px circle with the line-colour ring; a transfer = a white pill
 * with one disc per line — a 12 px circle for a letter (N, M, F), a capsule as wide as the text for 观光 / 叮当 (review
 * fix: two characters do not fit a 12 px disc) — in the symbol's locale; an underground station adds the stair mark on
 * the right. No wrapper element.
 */
export function MapStationMark({ sym, x, y }: { sym: StationSymbol; x: number; y: number }) {
  const g = stationMarkGeometry(sym, x, y);
  const stair = g.stair ? <StairGlyph x={g.stair.x} y={g.stair.y} /> : null;
  if (g.dot) {
    return (
      <>
        <circle className="mw-stop" cx={g.dot.x} cy={g.dot.y} r={g.dot.r} fill="#fff" stroke={sym.ring} strokeWidth={2} />
        {stair}
      </>
    );
  }
  const p = g.pill!;
  return (
    <>
      <rect className="mw-stop" x={p.x} y={p.y} width={p.w} height={p.h} rx={p.h / 2} fill="#fff" stroke={BADGE_INK.outline} />
      {g.discs.flatMap((d, i) => [
        d.capsule
          ? <rect key={`c${i}`} x={d.x} y={d.y} width={d.w} height={d.h} rx={d.h / 2} fill={d.color} />
          : <circle key={`c${i}`} cx={d.cx} cy={y} r={d.h / 2} fill={d.color} />,
        <text key={`t${i}`} className="mw-disc-t" x={d.cx} y={y + 3} style={MIDDLE}>{d.text}</text>,
      ])}
      {stair}
    </>
  );
}
