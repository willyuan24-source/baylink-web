import { X } from 'lucide-react';
import type { Bilingual } from '../core/types';
import { ATTRACTION_CAT_STYLE, ATTRACTION_CATS, type AttractionCat } from '../data/sf/attractionTypes';
import { useT } from '../i18n';
import { MapBadge, MapTargetPin, StairGlyph } from './MapBadge';
import { type BadgeSize, badgeSize } from './mapBadges';
import { LINE_STYLES, type LineStyle, lineStrokes } from './mapLines';

const BIG = 1.3; // a scale where every tier draws (the legend shows fixed sizes)

function Swatch({ style, underground = false }: { style: LineStyle; underground?: boolean }) {
  const strokes = lineStrokes(style, 1.6, { underground });
  return (
    <svg className="mw-swatch" width={40} height={16} viewBox="0 0 40 16" aria-hidden>
      {strokes.map((s, i) => <path key={i} d="M3 8 H37" stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash?.join(' ')} strokeLinecap="round" opacity={s.alpha} fill="none" />)}
    </svg>
  );
}

function BadgeCell({ cat, size, state, label }: { cat: AttractionCat; size: BadgeSize; state: Parameters<typeof MapBadge>[0]['state']; label: Bilingual }) {
  const { t } = useT();
  const box = Math.max(28, size.r * 2 + 12) + (state.cluster ? 14 : 0);
  return (
    <li>
      <svg width={box} height={box} viewBox={`${-box / 2} ${-box / 2} ${box} ${box}`} aria-hidden>
        <MapBadge a={{ id: cat, cat }} tier={1} s={BIG} state={state} x={0} y={0} size={size} />
      </svg>
      <span>{t(label)}</span>
    </li>
  );
}

/**
 * Wave 4 · the ⓘ legend sheet of the city map (lane P, W4-P8; plan §4.1 "Filters, legend"): category icons, T1 / T2 /
 * T3 sizes, badge states, line swatches, station symbols, "浅色区域 = 还没去过". Prop-driven; the caller shows it as a
 * sheet over the map (phones) or a popover (desktop).
 */
export function MapLegend({ onClose }: { onClose?: () => void }) {
  const { t } = useT();
  const t1 = badgeSize(1, BIG), t2: BadgeSize = { ...badgeSize(2, BIG) }, t3 = badgeSize(3, 0.6), t4: BadgeSize = { kind: 'dot', r: 1.75, glyph: 0, font: 10, weight: 600 };
  const lines: { key: string; style: LineStyle; label: Bilingual }[] = [
    { key: 'loop', style: LINE_STYLES['sf-loop'], label: { zh: '观光巴士环线', en: 'Sightseeing loop' } },
    { key: 'n', style: LINE_STYLES['n-judah'], label: { zh: 'N 线（地铁）', en: 'N Judah (Metro)' } },
    { key: 'm', style: LINE_STYLES['m-ocean-view'], label: { zh: 'M 线（地铁）', en: 'M Ocean View (Metro)' } },
    { key: 'cable', style: LINE_STYLES['powell-hyde'], label: { zh: '叮当车（三条线）', en: 'Cable cars (three lines)' } },
    { key: 'f', style: LINE_STYLES['f-line'], label: { zh: 'F 线复古电车', en: 'F-line streetcar' } },
  ];
  return (
    <section className="mw-legend" aria-label={t('地图图例', 'Map legend')}>
      <header>
        <h3>{t('地图图例', 'Map legend')}</h3>
        {onClose && <button type="button" className="ob-icon-btn" onClick={onClose} aria-label={t('关闭', 'Close')}><X size={18} aria-hidden /></button>}
      </header>

      <h4>{t('类别', 'Kinds of places')}</h4>
      <ul className="mw-legend-grid">
        {ATTRACTION_CATS.map(c => <BadgeCell key={c} cat={c} size={t2} state={{ discovered: true }} label={ATTRACTION_CAT_STYLE[c].name} />)}
      </ul>

      <h4>{t('大小', 'Sizes')}</h4>
      <ul className="mw-legend-grid">
        <BadgeCell cat="landmark" size={t1} state={{ discovered: true }} label={{ zh: '必看（16 个）', en: 'Must-see (16)' }} />
        <BadgeCell cat="landmark" size={t2} state={{ discovered: true }} label={{ zh: '热门', en: 'Popular' }} />
        <BadgeCell cat="landmark" size={t3} state={{ discovered: true }} label={{ zh: '小景点（放大看）', en: 'Smaller sights (zoom in)' }} />
        <BadgeCell cat="neighbourhood" size={t4} state={{ discovered: true }} label={{ zh: '去过的地点', en: 'Places you found' }} />
      </ul>

      <h4>{t('状态', 'States')}</h4>
      <ul className="mw-legend-grid">
        <BadgeCell cat="museum" size={t2} state={{ discovered: false }} label={{ zh: '还没去过', en: 'Not visited' }} />
        <BadgeCell cat="museum" size={t2} state={{ discovered: true }} label={{ zh: '去过（能飞过去）', en: 'Visited (fly there)' }} />
        <BadgeCell cat="museum" size={t2} state={{ discovered: true, arrived: true }} label={{ zh: '到过，盖了章', en: 'Arrived, stamped' }} />
        <BadgeCell cat="museum" size={t2} state={{ discovered: true, selected: true }} label={{ zh: '选中', en: 'Selected' }} />
        <li>
          <svg width={34} height={36} viewBox="-12 -32 34 36" aria-hidden><MapTargetPin x={0} y={0} /></svg>
          <span>{t('正在去的地方', 'Where you are heading')}</span>
        </li>
        <BadgeCell cat="landmark" size={t2} state={{ discovered: false, tourStop: 3 }} label={{ zh: '导览下一站', en: 'Next tour stop' }} />
        <BadgeCell cat="park" size={t2} state={{ discovered: true, cluster: 2 }} label={{ zh: '叠在一起的景点', en: 'Grouped sights' }} />
      </ul>

      <h4>{t('线路和车站', 'Lines and stops')}</h4>
      <ul className="mw-legend-rows">
        {lines.map(l => <li key={l.key}><Swatch style={l.style} /><span>{t(l.label)}</span></li>)}
        <li><Swatch style={LINE_STYLES['n-judah']} underground /><span>{t('虚线：在地下（坐车时看隧道动画）', 'Dashed: underground (a tunnel ride)')}</span></li>
        <li>
          <svg width={40} height={16} viewBox="-20 -8 40 16" aria-hidden><circle r={3.5} fill="#fff" stroke={LINE_STYLES['n-judah'].color} strokeWidth={2} /></svg>
          <span>{t('车站', 'Stop')}</span>
        </li>
        <li>
          <svg width={40} height={16} viewBox="-20 -8 40 16" aria-hidden>
            <rect x={-16} y={-8} width={32} height={16} rx={8} fill="#fff" stroke="rgba(60,40,20,.25)" />
            <circle cx={-7} r={6} fill={LINE_STYLES['n-judah'].color} /><text x={-7} y={3} className="mw-disc-t">N</text>
            <circle cx={7} r={6} fill={LINE_STYLES['m-ocean-view'].color} /><text x={7} y={3} className="mw-disc-t">M</text>
          </svg>
          <span>{t('换乘站', 'Transfer')}</span>
        </li>
        <li><svg width={40} height={16} viewBox="-20 -8 40 16" aria-hidden><circle cx={-6} r={3.5} fill="#fff" stroke={LINE_STYLES['m-ocean-view'].color} strokeWidth={2} /><StairGlyph x={1} y={-6} /></svg><span>{t('地下站：从路边入口进站', 'Underground stop: street entrance')}</span></li>
      </ul>

      <p className="mw-legend-note"><i className="mw-fog-chip" aria-hidden />{t('浅色区域 = 还没去过的街区', 'Pale areas = neighbourhoods you have not visited yet')}</p>
    </section>
  );
}
