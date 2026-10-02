import { type CSSProperties, useEffect, useRef } from 'react';
import { CalendarDays, Gamepad2, Star, TrainFront } from 'lucide-react';
import { ATTRACTION_CAT_STYLE } from '../data/sf/attractionTypes';
import { useT } from '../i18n';
import { MAP_FILTERS, type MapFilter, PLAY_VIOLET, WEEK_CORAL } from './mapFilterRules';
import { ATTRACTION_ICONS } from './mapIcons';

/**
 * Wave 4 · the filter chip row under the city map frame (lane P, W4-P8). Prop-driven: CityMap keeps the value
 * (loadMapFilter / saveMapFilter in mapFilterRules.ts) and applies filterAttraction / filterLines. A horizontally
 * scrolling row of 32 px chips inside a 44 px touch band; the chosen chip is announced (radio group semantics) and scrolled
 * into view. Wave 5 (W5-N8): 这周 with the count of lane R's event venues this week, right after 全部 while there are any
 * (none: no chip).
 */
export function MapFilters({ value, onChange, week = 0 }: { value: MapFilter; onChange: (f: MapFilter) => void; week?: number }) {
  const { t } = useT();
  const row = useRef<HTMLDivElement>(null);
  // a remembered chip far right in the row (校园, 购物, 交通 on a 375 px phone) scrolls into view
  useEffect(() => {
    const r = row.current, on = r?.querySelector<HTMLElement>('.is-on');
    if (!r || !on) return;
    if (on.offsetLeft < r.scrollLeft || on.offsetLeft + on.offsetWidth > r.scrollLeft + r.clientWidth) r.scrollLeft = Math.max(0, on.offsetLeft - 12);
  }, [value]);
  const list = week > 0 ? [MAP_FILTERS[0], ...MAP_FILTERS.filter(f => f.id === 'week'), ...MAP_FILTERS.slice(1).filter(f => f.id !== 'week')] : MAP_FILTERS.filter(f => f.id !== 'week');
  return (
    <div ref={row} className="mw-chips" role="radiogroup" aria-label={t('按类别看地图', 'Filter the map')}>
      {list.map(f => {
        const on = f.id === value;
        const Icon = f.cat ? ATTRACTION_ICONS[ATTRACTION_CAT_STYLE[f.cat].glyph] : f.id === 'must' ? Star : f.id === 'transit' ? TrainFront : f.id === 'week' ? CalendarDays : f.id === 'play' ? Gamepad2 : null;
        const color = f.cat ? ATTRACTION_CAT_STYLE[f.cat].color : f.id === 'must' ? '#e0a94a' : f.id === 'transit' ? '#2f6fb0' : f.id === 'week' ? WEEK_CORAL : f.id === 'play' ? PLAY_VIOLET : undefined;
        return (
          <button key={f.id} type="button" role="radio" aria-checked={on} className={`mw-chip${on ? ' is-on' : ''}`} onClick={() => onChange(f.id)}
            style={color ? ({ '--mw-chip': color } as CSSProperties) : undefined}>
            {Icon && <Icon size={14} strokeWidth={2.4} aria-hidden />}
            <span>{f.id === 'week' ? `${t(f.label)} ${week}` : t(f.label)}</span>
          </button>
        );
      })}
    </div>
  );
}
