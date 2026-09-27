import type { AttractionGlyph } from '../data/sf/attractionTypes';

/**
 * Wave 4 · the attraction glyphs as ONE SVG path each (lane P, W4-P4 review fix; plan sf-w4-plan.md §4.1 "Perf": ≤ 150
 * SVG nodes on desktop / 120 on phones). A lucide-react icon renders an <svg> plus one element per stroke (Castle and
 * Theater 9, Landmark 6), so a badge with the <Icon> inside cost 6–14 nodes, not the 3 the budget counted. Here each
 * icon's elements are joined into one path `d` in lucide's 24 × 24 box (lines, circles and polygons converted to path
 * commands, a leading relative `m` made absolute), drawn with the same stroke: `translate(-g/2,-g/2) scale(g/24)`,
 * stroke-width 2.3, round caps and joins, no fill. Palette's four dots are filled circles of r .5 in lucide: the 2.3
 * stroke covers them, so the stroke-only path looks the same.
 *
 * Source: lucide-react 0.460.0 (ISC licence, https://lucide.dev/license). tests/opus-bay-sf-map-w4.test.ts converts
 * each icon's rendered markup again and fails when the table drifts from the installed lucide-react.
 */
export const GLYPH_D: Readonly<Record<AttractionGlyph, string>> = {
  Landmark: 'M3 22L21 22M6 18L6 11M10 18L10 11M14 18L14 11M18 18L18 11M12 2L20 7L4 7Z',
  Palette: 'M13 6.5a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0M17 10.5a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0M8 7.5a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0M6 12.5a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z',
  Trees: 'M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0ZM7 16v6M13 19v3M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5',
  PawPrint: 'M9 4a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M16 8a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M18 16a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z',
  Mountain: 'M8 3l4 8 5-5 5 15H2L8 3z',
  Binoculars: 'M10 10h4M19 7V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3M20 21a2 2 0 0 0 2-2v-3.851c0-1.39-2-2.962-2-4.829V8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2zM 22 16 L 2 16M4 21a2 2 0 0 1-2-2v-3.851c0-1.39 2-2.962 2-4.829V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2zM9 7V4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v3',
  Waves: 'M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
  Sailboat: 'M22 18H2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4ZM21 14 10 2 3 14h18ZM10 2v16',
  GraduationCap: 'M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0zM22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5',
  ShoppingBag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0',
  Trophy: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z',
  Church: 'M10 9h4M12 7v5M14 22v-4a2 2 0 0 0-4 0v4M18 22V5.618a1 1 0 0 0-.553-.894l-4.553-2.277a2 2 0 0 0-1.788 0L6.553 4.724A1 1 0 0 0 6 5.618V22M18 7l3.447 1.724a1 1 0 0 1 .553.894V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.618a1 1 0 0 1 .553-.894L6 7',
  Theater: 'M2 10s3-3 3-8M22 10s-3-3-3-8M10 2c0 4.4-3.6 8-8 8M14 2c0 4.4 3.6 8 8 8M2 10s2 2 2 5M22 10s-2 2-2 5M8 15h8M2 22v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1M14 22v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1',
  Castle: 'M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2ZM18 11V4H6v7M15 22v-4a3 3 0 0 0-3-3a3 3 0 0 0-3 3v4M22 11V9M2 11V9M6 4V2M18 4V2M10 4V2M14 4V2',
  Signpost: 'M12 13v8M12 3v3M18 6a2 2 0 0 1 1.387.56l2.307 2.22a1 1 0 0 1 0 1.44l-2.307 2.22A2 2 0 0 1 18 13H6a2 2 0 0 1-1.387-.56l-2.306-2.22a1 1 0 0 1 0-1.44l2.306-2.22A2 2 0 0 1 6 6z',
};

/** lucide's stroke in its 24-unit box (MapBadge draws the glyph at 2.3, as the <Icon strokeWidth={2.3}> did). */
export const GLYPH_STROKE = 2.3;
