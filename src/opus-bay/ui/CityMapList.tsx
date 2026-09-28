import { useMemo } from 'react';
import { Check, Footprints, Search, TrainFront } from 'lucide-react';
import type { Bilingual, Vec2 } from '../core/types';
import { ATTRACTION_AREAS, type Attraction, type AttractionArea } from '../data/sf/attractionTypes';
import { ATTRACTIONS, coveredPlaceIds } from '../data/sf/attractions';
import type { CityPlace, PlaceIndex } from '../data/sf/places';
import { SF_ROUTES, type SfRoute, type SfRouteId, routePath } from '../data/sf/routes';
import { SEARCH_GROUP_NAMES, SEARCH_SUGGESTIONS, type SearchEntry, attractionEntries, groupHits, lineEntries, placeEntries, prepareSearch, rankSearch, stationEntries } from '../data/sf/placeSearch';
import { landmarkAreaAt, zoneName } from '../data/cityZones';
import { discoveredIds, isDiscovered } from '../game/discovery';
import { timeLabel } from '../game/tripText';
import { useT } from '../i18n';
import type { MapSel } from './cityMapModel';
import { attractionThumb, listWalkSeconds } from './mapListData';
import { MapBadge } from './MapBadge';
import { badgeSize } from './mapBadges';
import { LINE_STYLES, type MapLine, type MapStation, lineStrokes } from './mapLines';

/**
 * Wave 4 · the list under the city map (lane P, W4-P8 / W4-P9; plan §4.1 "Filters, legend, list, search"): the search
 * (attractions, stations, lines and the other places, ranked and grouped 景点 / 车站 / 线路 / 地点, the empty state's
 * suggestions) and the tabs 景点 · 线路 · 附近 · 去过的. 景点 lists the T1 then T2 attractions by area with a photo thumb
 * (or the badge), the walking time and a tick once found; 线路 one row per line (tap: highlight it, its stations under it).
 */

export type MapTab = 'sights' | 'lines' | 'near' | 'found';

const AREA_ORDER = Object.keys(ATTRACTION_AREAS) as AttractionArea[];

function Thumb({ a }: { a: Attraction }) {
  const src = attractionThumb(a);
  if (src) return <img className="mw-thumb" src={src} alt="" loading="lazy" decoding="async" width={44} height={44} />;
  const size = badgeSize(2, 1);
  return (
    <svg className="mw-thumb is-badge" width={44} height={44} viewBox="-22 -22 44 44" aria-hidden>
      <MapBadge a={a} tier={a.rank} s={1} state={{ discovered: isDiscovered(a.placeId ?? a.id) }} x={0} y={0} size={{ ...size, r: 14, glyph: 15 }} />
    </svg>
  );
}

function LineSwatch({ id }: { id: string }) {
  const st = LINE_STYLES[id];
  if (!st) return null;
  return (
    <svg className="mw-swatch" width={34} height={14} viewBox="0 0 34 14" aria-hidden>
      {lineStrokes(st, 1.4).map((s, i) => <path key={i} d="M3 7 H31" stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash?.join(' ')} strokeLinecap="round" fill="none" />)}
    </svg>
  );
}

export interface CityMapListProps {
  ix: PlaceIndex | null;
  lines: readonly MapLine[];
  stations: readonly MapStation[];
  pos: Vec2;
  query: string;
  setQuery: (q: string) => void;
  tab: MapTab;
  setTab: (t: MapTab) => void;
  selected: MapSel | null;
  highlight: string | null;
  /** re-render on discoveries */
  epoch: number;
  onAttraction: (a: Attraction) => void;
  onPlace: (p: CityPlace) => void;
  onStation: (st: MapStation) => void;
  onLine: (id: string) => void;
  /** a walking route (data/sf/routes.ts): highlight it on the map */
  onRoute: (id: SfRouteId) => void;
}

type Row =
  | { kind: 'head'; key: string; text: Bilingual }
  | { kind: 'attraction'; key: string; a: Attraction }
  | { kind: 'place'; key: string; p: CityPlace }
  | { kind: 'station'; key: string; st: MapStation }
  | { kind: 'line'; key: string; id: string }
  | { kind: 'route'; key: string; r: SfRoute }
  | { kind: 'routeStop'; key: string; r: SfRoute; i: number };

export function CityMapList(p: CityMapListProps) {
  const { t } = useT();
  const { ix, lines, stations, pos, query, tab } = p;
  const covered = useMemo(() => coveredPlaceIds(), []);
  const lineIds = useMemo(() => lines.map(l => l.id).sort((a, b) => (LINE_STYLES[a]?.order ?? 10) - (LINE_STYLES[b]?.order ?? 10)), [lines]);
  const stationById = useMemo(() => new Map(stations.map(s => [s.id, s])), [stations]);
  const attrById = useMemo(() => new Map(ATTRACTIONS.map(a => [a.id, a])), []);
  const search = useMemo(() => {
    const entries: SearchEntry[] = [
      ...attractionEntries(ATTRACTIONS),
      ...lineEntries(lineIds.map(id => LINE_STYLES[id]).filter(Boolean)),
      ...stationEntries(stations),
      ...(ix ? placeEntries(ix.list.filter(pl => !pl.station), covered) : []),
    ];
    return prepareSearch(entries);
  }, [ix, stations, lineIds, covered]);

  const rows = useMemo((): Row[] => {
    const q = query.trim();
    if (q) {
      const out: Row[] = [];
      for (const g of groupHits(rankSearch(search, q, 30))) {
        out.push({ kind: 'head', key: `h:${g.group}`, text: SEARCH_GROUP_NAMES[g.group] });
        for (const h of g.hits) {
          const e = h.entry;
          if (e.group === 'attraction') { const a = attrById.get(e.id); if (a) out.push({ kind: 'attraction', key: `a:${a.id}`, a }); }
          else if (e.group === 'station') { const st = stationById.get(e.id); if (st) out.push({ kind: 'station', key: `s:${st.id}`, st }); }
          else if (e.group === 'line') out.push({ kind: 'line', key: `l:${e.id}`, id: e.id });
          else { const pl = ix?.get(e.id); if (pl) out.push({ kind: 'place', key: `p:${pl.id}`, p: pl }); }
        }
      }
      return out;
    }
    if (tab === 'sights') {
      const out: Row[] = [];
      for (const area of AREA_ORDER) {
        const list = ATTRACTIONS.filter(a => a.rank <= 2 && a.area === area);
        if (!list.length) continue;
        out.push({ kind: 'head', key: `h:${area}`, text: ATTRACTION_AREAS[area] });
        for (const a of list) out.push({ kind: 'attraction', key: `a:${a.id}`, a });
      }
      return out;
    }
    if (tab === 'lines') {
      const out: Row[] = [];
      for (const id of lineIds) {
        out.push({ kind: 'line', key: `l:${id}`, id });
        if (p.highlight === id) for (const st of stations) if (st.lines.includes(id)) out.push({ kind: 'station', key: `s:${id}:${st.id}`, st });
      }
      // the three finished walking routes (lane D2's SF_ROUTES): a row each, its stops under it while highlighted
      out.push({ kind: 'head', key: 'h:walks', text: { zh: '步行路线', en: 'Walking routes' } });
      for (const r of SF_ROUTES) {
        out.push({ kind: 'route', key: `r:${r.id}`, r });
        if (p.highlight === `route:${r.id}`) r.stops.forEach((_, i) => out.push({ kind: 'routeStop', key: `rs:${r.id}:${i}`, r, i }));
      }
      return out;
    }
    if (tab === 'near') {
      // attractions, stations and found places within 320 u, nearest first
      const near: { d: number; row: Row }[] = [];
      for (const a of ATTRACTIONS) { const d = Math.hypot(a.x - pos.x, a.z - pos.z); if (d < 320) near.push({ d, row: { kind: 'attraction', key: `a:${a.id}`, a } }); }
      for (const st of stations) { const d = Math.hypot(st.x - pos.x, st.z - pos.z); if (d < 320) near.push({ d, row: { kind: 'station', key: `s:${st.id}`, st } }); }
      for (const pl of ix?.near(pos.x, pos.z, 320) ?? []) if (!covered.has(pl.id) && !pl.station && (pl.curated || isDiscovered(pl.id))) near.push({ d: Math.hypot(pl.x - pos.x, pl.z - pos.z), row: { kind: 'place', key: `p:${pl.id}`, p: pl } });
      return near.sort((a, b) => a.d - b.d).slice(0, 30).map(n => n.row);
    }
    // 去过的: newest first (G1 review open 6: it was in index order)
    const out: Row[] = [];
    const seen = new Set<string>();
    for (const id of [...discoveredIds()].reverse()) {
      const pl = ix?.get(id);
      if (!pl || seen.has(id)) continue;
      seen.add(id);
      const a = ATTRACTIONS.find(x => (x.placeId ?? x.id) === id), st = pl.station ? stationById.get(pl.id) : undefined;
      out.push(a ? { kind: 'attraction', key: `a:${a.id}`, a } : st ? { kind: 'station', key: `s:${st.id}`, st } : { kind: 'place', key: `p:${pl.id}`, p: pl });
      if (out.length >= 40) break;
    }
    return out;
  }, [query, search, tab, ix, pos.x, pos.z, stations, lineIds, p.highlight, p.epoch, attrById, stationById, covered]); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = p.selected;
  const area = (x: number, z: number, zone: string | null) => t(landmarkAreaAt(x, z)?.name ?? zoneName(zone));
  // an attraction's neighbourhood (its place row's), else its list area
  const attractionArea = (a: Attraction) => { const zone = ix?.get(a.placeId ?? a.id)?.zone ?? null; const lm = landmarkAreaAt(a.x, a.z); return t(lm?.name ?? (zone ? zoneName(zone) : a.area ? ATTRACTION_AREAS[a.area] : zoneName(null))); };
  return (
    <section className="ob-block ob-citymap-list">
      <label className="ob-citymap-search">
        <Search size={16} aria-hidden />
        <input type="search" value={query} onChange={e => p.setQuery(e.target.value)} placeholder={t('搜地方：金门大桥、大学、N 线…', 'Search: Golden Gate, university, N Judah…')} aria-label={t('搜索地点', 'Search places')} />
      </label>
      {!query.trim() && (
        <div className="ob-map-zoom ob-citymap-tabs" role="tablist">
          {([['sights', t('景点', 'Sights')], ['lines', t('线路', 'Lines')], ['near', t('附近', 'Nearby')], ['found', t('去过的', 'Visited')]] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => p.setTab(k)}>{label}</button>
          ))}
        </div>
      )}
      <ul className="ob-place-list mw-list">
        {rows.map(r => {
          if (r.kind === 'head') return <li key={r.key} className="mw-list-head" role="presentation">{t(r.text)}</li>;
          if (r.kind === 'attraction') {
            const a = r.a, found = isDiscovered(a.placeId ?? a.id);
            return (
              <li key={r.key}>
                <button type="button" className={`mw-row${sel?.kind === 'attraction' && sel.id === a.id ? ' is-on' : ''}`} onClick={() => p.onAttraction(a)}>
                  <Thumb a={a} />
                  <span className="ob-place-text"><span>{t(a.name)}</span><small>{attractionArea(a)} · {t(timeLabel(listWalkSeconds(pos, a.arrival ?? a)))}</small></span>
                  {found && <Check size={16} className="mw-found" aria-label={t('去过', 'Visited')} />}
                </button>
              </li>
            );
          }
          if (r.kind === 'station') {
            const st = r.st;
            return (
              <li key={r.key}>
                <button type="button" className={`mw-row is-station${sel?.kind === 'station' && sel.id === st.id ? ' is-on' : ''}`} onClick={() => p.onStation(st)}>
                  <span className="mw-row-disc" aria-hidden><TrainFront size={15} /></span>
                  <span className="ob-place-text"><span>{t(st.name)}</span><small>{[...new Set(st.lines.map(l => t(LINE_STYLES[l]?.disc ?? { zh: l, en: l })))].join(' · ')} · {t(timeLabel(listWalkSeconds(pos, st)))}</small></span>
                  {isDiscovered(st.id) && <Check size={16} className="mw-found" aria-label={t('去过', 'Visited')} />}
                </button>
              </li>
            );
          }
          if (r.kind === 'route') {
            const len = routePath(r.r.id)?.length ?? 0, on = p.highlight === `route:${r.r.id}`;
            return (
              <li key={r.key}>
                <button type="button" className={`mw-row is-line${on ? ' is-on' : ''}`} onClick={() => p.onRoute(r.r.id)} aria-pressed={on}>
                  <span className="mw-row-disc is-walk" aria-hidden><Footprints size={15} /></span>
                  <span className="ob-place-text"><span>{t(r.r.name)}</span><small>{t({ zh: `${r.r.stops.length} 站`, en: `${r.r.stops.length} stops` })} · {t(timeLabel(len / 4.2))}</small></span>
                </button>
              </li>
            );
          }
          if (r.kind === 'routeStop') {
            const s = r.r.stops[r.i];
            const a = s.attraction ? attrById.get(s.attraction) : s.placeId ? ATTRACTIONS.find(x => (x.placeId ?? x.id) === s.placeId) : undefined;
            const pl = !a && s.placeId ? ix?.get(s.placeId) : undefined;
            return (
              <li key={r.key}>
                <button type="button" className="mw-row is-stop" onClick={() => { if (a) p.onAttraction(a); else if (pl) p.onPlace(pl); }} disabled={!a && !pl}>
                  <span className="mw-row-num" aria-hidden>{r.i + 1}</span>
                  <span className="ob-place-text"><span>{t(s.name)}</span><small>{t(s.line)}</small></span>
                </button>
              </li>
            );
          }
          if (r.kind === 'line') {
            const st = LINE_STYLES[r.id];
            if (!st) return null;
            const n = stations.filter(s => s.lines.includes(r.id)).length;
            return (
              <li key={r.key}>
                <button type="button" className={`mw-row is-line${p.highlight === r.id ? ' is-on' : ''}`} onClick={() => p.onLine(r.id)} aria-pressed={p.highlight === r.id}>
                  <LineSwatch id={r.id} />
                  <span className="ob-place-text"><span>{t(st.name)}</span><small>{t(st.route)}{n ? ` · ${t({ zh: `${n} 站`, en: `${n} stops` })}` : ''}</small></span>
                </button>
              </li>
            );
          }
          const pl = r.p;
          return (
            <li key={r.key}>
              <button type="button" className={`mw-row${sel?.kind === 'place' && sel.id === pl.id ? ' is-on' : ''}`} onClick={() => p.onPlace(pl)}>
                <span className={`ob-place-num ${isDiscovered(pl.id) ? 'is-found' : ''}`} aria-hidden>·</span>
                <span className="ob-place-text"><span>{t(pl.name)}</span><small>{area(pl.x, pl.z, pl.zone)}</small></span>
              </button>
            </li>
          );
        })}
        {!rows.length && (
          <li className="ob-citymap-empty">
            {!ix && !query.trim() ? t('地点加载中…', 'Loading places…') : (
              <>
                <span>{query.trim() ? t('没找到，试试：', 'Nothing found — try:') : t('这里还没有', 'Nothing here yet')}</span>
                <span className="mw-suggest">
                  {SEARCH_SUGGESTIONS.map(s => <button key={s.zh} type="button" className="mw-chip" onClick={() => p.setQuery(t(s))}>{t(s)}</button>)}
                </span>
              </>
            )}
          </li>
        )}
      </ul>
    </section>
  );
}
