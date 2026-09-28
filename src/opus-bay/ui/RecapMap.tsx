import { useMemo } from 'react';
import type { Bilingual } from '../core/types';
import type { CityTourDef } from '../data/sf/tours';
import { useT } from '../i18n';
import { MapPaperLayer } from './MapPaperLayer';
import { RECAP_COLORS, tourRecapModel } from './tourRecapModel';

/**
 * Wave 4 · the tour recap map (lane P, W4-P13; the Footprints API lane C's TourRecap takes as `mapSlot`): the Grand
 * Tour's route (lane C's ui/tourRecapModel.ts: rides in their line colours, walks as gold dashes, the version played)
 * drawn over H2b's painted city paper in the same world frame as the city map, finished legs full strength, the rest
 * faded, the stops as dots (done = coral, with a cream tick ring), each chapter's first stop numbered. Lazy with the
 * recap (it pulls the tour data): `const RecapMap = lazy(() => import('./RecapMap'))`, then
 * `mapSlot={<Suspense fallback={null}><RecapMap tour={def} completed={…} express={express} /></Suspense>}`.
 */
// inline (the component imports no CSS: node tests render it; the recap is not the map chunk)
const RECAP_STYLE = { display: 'block', width: '100%', height: 'auto', maxHeight: 240, borderRadius: 16, background: '#f3ead6', border: '1px solid rgba(60, 40, 20, .14)', overflow: 'hidden' } as const;

export function RecapMap({ tour, completed, express = false, stopName, label }: {
  tour: CityTourDef;
  completed: readonly string[];
  express?: boolean;
  stopName?: (stopId: string) => Bilingual | null;
  label?: Bilingual;
}) {
  const { t } = useT();
  const model = useMemo(() => tourRecapModel(tour, completed, stopName, express), [tour, completed, stopName, express]);
  const [x0, y0, w, h] = model.viewBox.split(' ').map(Number);
  const unit = Math.max(w, h) / 240;
  const firsts = new Map<number, (typeof model.dots)[number]>();
  for (const d of model.dots) if (!firsts.has(d.chapter)) firsts.set(d.chapter, d);
  return (
    <svg className="mw-recap" viewBox={model.viewBox} preserveAspectRatio="xMidYMid meet" style={RECAP_STYLE} role="img" aria-label={t(label ?? { zh: '一日游路线图', en: 'The tour on the map' })}>
      <MapPaperLayer width={1024} />
      <rect x={x0} y={y0} width={w} height={h} fill="rgba(255, 250, 241, .18)" />
      {model.segments.map((s, i) => (
        <path key={`c${i}`} d={s.d} fill="none" stroke="#fffaf1" strokeWidth={(s.dashed ? 2.6 : 4) * unit} strokeLinecap="round" strokeLinejoin="round" opacity={s.done ? 0.95 : 0.5} />
      ))}
      {model.segments.map((s, i) => (
        <path key={`s${i}`} d={s.d} fill="none" stroke={s.color} strokeWidth={(s.dashed ? 1.6 : 2.6) * unit} strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={s.dashed ? `${3 * unit} ${3 * unit}` : undefined} opacity={s.done ? 1 : 0.35} />
      ))}
      {model.dots.map((d, i) => (
        <circle key={`d${i}`} cx={d.x} cy={d.y} r={3.4 * unit} fill={d.done ? RECAP_COLORS['sf-loop'] : '#fffaf1'} stroke={d.done ? '#fffaf1' : '#3c2814'} strokeOpacity={d.done ? 1 : 0.45} strokeWidth={(d.done ? 1.3 : 0.8) * unit}>
          {d.label && <title>{t(d.label)}</title>}
        </circle>
      ))}
      {[...firsts.entries()].map(([chapter, d]) => (
        <g key={`n${chapter}`} transform={`translate(${d.x - 7 * unit},${d.y - 7 * unit})`}>
          <circle r={4.6 * unit} fill="#3c2814" opacity={0.82} />
          <text y={1.7 * unit} fontSize={5 * unit} fontWeight={800} fill="#fffaf1" textAnchor="middle" style={{ textAnchor: 'middle' }}>{chapter + 1}</text>
        </g>
      ))}
    </svg>
  );
}

export default RecapMap;
