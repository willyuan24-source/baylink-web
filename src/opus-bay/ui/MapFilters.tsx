import { type CSSProperties, useEffect, useRef } from 'react';
import { Star, TrainFront } from 'lucide-react';
import { ATTRACTION_CAT_STYLE } from '../data/sf/attractionTypes';
import { useT } from '../i18n';
import { MAP_FILTERS, type MapFilter } from './mapFilterRules';
import { ATTRACTION_ICONS } from './mapIcons';

/**
 * Wave 4 · the filter chip row under the city map frame (lane P, W4-P8). Prop-driven: CityMap keeps the value
 * (loadMapFilter / saveMapFilter in mapFilterRules.ts) and applies filterAttraction / filterLines. A horizontally
 * scrolling row of 32 px chips inside a 44 px touch band; the chosen chip is announced (radio group semantics) and scrolled
 * into view.
 */
export function MapFilters({ value, onChange }: { value: MapFilter; onChange: (f: MapFilter) => void }) {
  const { t } = useT();
  const row = useRef<HTMLDivElement>(null);
  // a remembered chip far right in the row (校园, 购物, 交通 on a 375 px phone) scrolls into view
  useEffect(() => {
    const r = row.current, on = r?.querySelector<HTMLElement>('.is-on');
    if (!r || !on) return;
    if (on.offsetLeft < r.scrollLeft || on.offsetLeft + on.offsetWidth > r.scrollLeft + r.clientWidth) r.scrollLeft = Math.max(0, on.offsetLeft - 12);
  }, [value]);
  return (
    <div ref={row} className="mw-chips" role="radiogroup" aria-label={t('按类别看地图', 'Filter the map')}>
      {MAP_FILTERS.map(f => {
        const on = f.id === value;
        const Icon = f.cat ? ATTRACTION_ICONS[ATTRACTION_CAT_STYLE[f.cat].glyph] : f.id === 'must' ? Star : f.id === 'transit' ? TrainFront : null;
        const color = f.cat ? ATTRACTION_CAT_STYLE[f.cat].color : f.id === 'must' ? '#e0a94a' : f.id === 'transit' ? '#2f6fb0' : undefined;
        return (
          <button key={f.id} type="button" role="radio" aria-checked={on} className={`mw-chip${on ? ' is-on' : ''}`} onClick={() => onChange(f.id)}
            style={color ? ({ '--mw-chip': color } as CSSProperties) : undefined}>
            {Icon && <Icon size={14} strokeWidth={2.4} aria-hidden />}
            <span>{t(f.label)}</span>
          </button>
        );
      })}
    </div>
  );
}
