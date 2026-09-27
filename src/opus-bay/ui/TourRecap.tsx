import { useMemo, type ReactNode } from 'react';
import { ArrowRight, Bird, Check, Mail, Map as MapIcon, Route, Sparkles, Stamp, X } from 'lucide-react';
import type { Bilingual } from '../core/types';
import type { CityTourDef } from '../data/sf/tours';
import { useT } from '../i18n';
import { BaybayFace } from './common';
import { RECAP_COLORS, tourRecapModel } from './tourRecapModel';

/**
 * Wave 4 · lane C · W4-C4: the Grand Tour recap panel (plan sf-w4-plan.md §3.5 "The end is a recap panel: the path on
 * a small map, postcards and stamps found, and 全城都能飞了"). PROP-DRIVEN: it reads no store, so the integration
 * mounts it from Overlay's 'recap' panel when `game.tour.id` is a city tour (the district keeps ui/Moments Recap).
 * It reuses the district recap's classes (opus-bay.css `.ob-recap*`) so it looks like the same family; the only new
 * styling is inline on the route sketch. `mapSlot` takes lane P's recap map (Footprints API, W4-P13) when it lands;
 * without it the built-in sketch (ui/tourRecapModel.ts) draws the route in the map's orientation.
 */

export interface TourRecapProps {
  tour: CityTourDef;
  /** completed stop ids (game.tour.completed / save v2 tours[id].completed) */
  completed: readonly string[];
  postcards: { found: number; total: number };
  /** arrival stamps collected (the journal's stamp count for the tour's attractions) */
  stamps: { found: number; total: number };
  /** the express version was played */
  express?: boolean;
  /** stop id → a short name for the sketch's dots (optional) */
  stopName?: (stopId: string) => Bilingual | null;
  onClose(): void;
  /** "去地图上飞" (opens the map; every stop is discovered, so fast travel covers the city) */
  onOpenMap?(): void;
  /** "继续自由逛" */
  onKeepExploring?(): void;
  /** lane P's recap map, replacing the built-in sketch */
  mapSlot?: ReactNode;
}

export function TourRecap({ tour, completed, postcards, stamps, express, stopName, onClose, onOpenMap, onKeepExploring, mapSlot }: TourRecapProps) {
  const { t } = useT();
  const model = useMemo(() => tourRecapModel(tour, completed, stopName), [tour, completed, stopName]);
  const minutes = Math.round(express ? tour.expressMinutes : tour.minutes);
  return (
    <div className="ob-recap-wrap" role="dialog" aria-modal="true" aria-labelledby="ob-tour-recap-title">
      <div className="ob-recap">
        <button type="button" className="ob-icon-btn ob-recap-close" onClick={onClose} aria-label={t('关闭', 'Close')}><X size={20} aria-hidden /></button>
        <div className="ob-recap-stamp" aria-hidden><BaybayFace mood="proud" size={84} /><span>{model.complete ? t('全城', 'WHOLE CITY') : t('打卡', 'VISITED')}</span></div>
        <h2 id="ob-tour-recap-title">{model.complete ? t(`${tour.name.zh} · 完成！`, `${tour.name.en} · complete!`) : t(tour.name)}</h2>
        <p className="ob-muted">
          {model.complete
            ? t('每一站都去过了，全城都能飞了！打开地图，想去哪儿点一下就行。', 'Every stop is discovered, so you can fly anywhere in the city. Open the map and tap where to go.')
            : t(`走了 ${model.done} / ${model.total} 站，随时可以接着走。`, `${model.done} of ${model.total} stops so far — pick it up anytime.`)}
        </p>
        {mapSlot ?? <RouteSketch model={model} label={t('一日游路线', 'The tour route')} />}
        <ol className="ob-recap-stops">
          {model.chapters.map((c, i) => {
            const ok = c.done >= c.total;
            return <li key={c.id} className={ok ? 'is-done' : ''}><span>{ok ? <Check size={13} aria-hidden /> : i + 1}</span>{t(c.name)} · {c.done}/{c.total}</li>;
          })}
        </ol>
        <div className="ob-recap-stats">
          <span><Route size={16} aria-hidden />{t(`${express ? '快速版' : '完整版'} · 约 ${minutes} 分钟`, `${express ? 'Express' : 'Full tour'} · about ${minutes} min`)}</span>
          <span><Mail size={16} aria-hidden />{postcards.found}/{postcards.total} {t('明信片', 'postcards')}</span>
          <span><Stamp size={16} aria-hidden />{stamps.found}/{stamps.total} {t('盖章', 'stamps')}</span>
          <span><Sparkles size={16} aria-hidden />{model.done}/{model.total} {t('站', 'stops')}</span>
        </div>
        <div className="ob-actions is-center is-stack">
          {onOpenMap && <button type="button" className="ob-btn ob-btn-primary" onClick={onOpenMap}>{model.complete ? <Bird size={18} aria-hidden /> : <MapIcon size={18} aria-hidden />}<span>{model.complete ? t('全城都能飞了 · 打开地图', 'Fly anywhere · open the map') : t('打开地图', 'Open the map')}</span></button>}
          <button type="button" className="ob-btn ob-btn-ghost" onClick={onKeepExploring ?? onClose}><span>{t('继续自由逛', 'Keep exploring')}</span><ArrowRight size={17} aria-hidden /></button>
        </div>
      </div>
    </div>
  );
}

/** The built-in route sketch: rides in their line colours, walks as gold dashes, stops as dots (done = filled). */
function RouteSketch({ model, label }: { model: ReturnType<typeof tourRecapModel>; label: string }) {
  const [, , w, h] = model.viewBox.split(' ').map(Number);
  const unit = Math.max(w, h) / 220;
  return (
    <svg viewBox={model.viewBox} role="img" aria-label={label} style={{ width: '100%', maxHeight: 220, borderRadius: 16, background: '#f3ead6', border: '1px solid rgba(60,40,20,.14)' }}>
      {model.segments.map((s, i) => (
        <path key={i} d={s.d} fill="none" stroke={s.color} strokeWidth={(s.dashed ? 1.6 : 2.6) * unit} strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={s.dashed ? `${3 * unit} ${3 * unit}` : undefined} opacity={s.done ? 1 : 0.35} />
      ))}
      {model.dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={3.2 * unit} fill={d.done ? RECAP_COLORS['sf-loop'] : '#fffaf1'} stroke="#3c2814" strokeOpacity={0.45} strokeWidth={0.8 * unit}>
          {d.label && <title>{d.label.zh}</title>}
        </circle>
      ))}
    </svg>
  );
}
