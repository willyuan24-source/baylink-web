import { useEffect, useMemo, useState } from 'react';
import { Check, History, MapPinned, Star, TramFront } from 'lucide-react';
import { game } from '../core/store';
import type { Bilingual } from '../core/types';
import { landmarkAreaAt, zoneName } from '../data/cityZones';
import { readSave } from '../data/save';
import { glossName, transitData } from '../data/transit';
import { discoveredIds, useDiscoveryEpoch, visitedZoneIds, zoneVisited } from '../game/discovery';
import { openMapOn } from '../game/mapPanel';
import { useT } from '../i18n';
import { useFar, usePlaceIndex } from './cityHooks';
import { footprintsSummary } from './footprintsData';
import './city-ui.css';

/**
 * 足迹 (lane G1, G1-11): the Journal tab with what you found in the city — landmarks, the curated places, every place
 * you walked past, the neighbourhoods and the cable-car rides (save v2). Lane G2's ui/Journal.tsx shows the tab when
 * FOOTPRINTS_TAB is set and renders <Footprints /> in it; it is set in city mode only (the district journal keeps its
 * three tabs). A landmark or a recent find opens the map on it.
 */
// the Journal (lane G2) imports the tab from here by contract (sf-w2-contracts §5.5)
// eslint-disable-next-line react-refresh/only-export-components
export const FOOTPRINTS_TAB: { label: Bilingual; count?: () => string } | null = game.get().worldMode === 'city'
  ? { label: { zh: '足迹', en: 'Footprints' }, count: () => { const n = discoveredIds().length; return n ? String(n) : ''; } }
  : null;

/** DataSF neighbourhoods (far.zones, names learned by useFar): ids and the total (41 until far.obc is in). */
function useZones(): { ids: string[]; total: number } {
  const far = useFar();
  return useMemo(() => (far ? { ids: far.zones.map(z => z.id), total: far.zones.length } : { ids: [], total: 41 }), [far]);
}

const OTHER_LINES: Record<string, Bilingual> = {
  streetcar: { zh: 'F 线电车', en: 'F-line streetcar' },
  ferry: { zh: '渡轮', en: 'Ferry' },
};

type Attr = { id: string; placeId?: string; rank: number; name: Bilingual; x: number; z: number };
type W4Names = Readonly<Record<string, { name: Bilingual }>>;
/**
 * The attraction list and the wave-4 line names, loaded with the tab (the Journal chunk also serves the district, which
 * needs neither).
 */
function useCityLists(): { attractions: readonly Attr[]; w4: W4Names } {
  const [v, setV] = useState<{ attractions: readonly Attr[]; w4: W4Names }>({ attractions: [], w4: {} });
  useEffect(() => {
    let live = true;
    void Promise.all([import('../data/sf/attractions'), import('../data/sf/stationNames')]).then(([a, s]) => { if (live) setV({ attractions: a.ATTRACTIONS, w4: s.W4_LINES }); });
    return () => { live = false; };
  }, []);
  return v;
}

export function Footprints() {
  const { t } = useT();
  const epoch = useDiscoveryEpoch();
  const ix = usePlaceIndex();
  const zones = useZones();
  const { attractions, w4 } = useCityLists();
  const s = useMemo(() => {
    const lines = transitData()?.lines ?? [];
    // cable-car lines by their data/transit.ts names, lane T's loop / N / M by theirs; lane F's F-line ('streetcar')
    // and ferry ('ferry') rides by kind
    const lineName = (id: string) => { const l = lines.find(x => x.id === id); return l ? glossName(l.name) : w4[id]?.name ?? OTHER_LINES[id] ?? null; };
    const lineTotal = lines.length + Object.keys(w4).length + Object.keys(OTHER_LINES).length;
    return footprintsSummary(ix, discoveredIds(), visitedZoneIds().length, zones.total, readSave()?.rides ?? {}, lineName, 8, attractions, lineTotal);
  }, [ix, zones.total, epoch, attractions, w4]); // eslint-disable-line react-hooks/exhaustive-deps
  const mustSee = useMemo(() => attractions.filter(a => a.rank === 1), [attractions]);
  const found = useMemo(() => new Set(discoveredIds()), [epoch]); // eslint-disable-line react-hooks/exhaustive-deps
  const showOnMap = (id: string) => openMapOn({ kind: 'place', id });
  const area = (x: number, z: number, zone?: string | null) => t(landmarkAreaAt(x, z)?.name ?? zoneName(zone ?? ''));

  return (
    <>
      <ul className="ob-steps-stats" aria-label={t('足迹统计', 'Footprint counts')}>
        <li><strong>{s.mustSee.found}<small>/{s.mustSee.total || 16}</small></strong><span>{t('必看', 'Must-see')}</span></li>
        <li><strong>{s.attractions.found}<small>/{s.attractions.total || '…'}</small></strong><span>{t('景点', 'Sights')}</span></li>
        <li><strong>{s.zones.visited}<small>/{s.zones.total}</small></strong><span>{t('街区', 'Neighbourhoods')}</span></li>
        <li><strong>{s.lines.ridden}<small>/{s.lines.total || '…'}</small></strong><span>{t('线路', 'Lines')}</span></li>
      </ul>
      {!s.places && !s.zones.visited && (
        <p className="ob-muted">{t('还没有足迹。出去走走吧：走近一个地方就会盖上章，走进一个街区地图上的雾就散开。', 'No footprints yet. Walk up to a place to stamp it; walk into a neighbourhood and its fog lifts on the map.')}</p>
      )}

      {s.recent.length > 0 && (
        <section className="ob-block">
          <h3 className="ob-h3"><History size={15} aria-hidden />{t('最近发现', 'Latest finds')} · {t({ zh: `去过 ${s.places} 个地点`, en: `${s.places} places found` })}</h3>
          <ul className="ob-steps-list">
            {s.recent.map(p => (
              <li key={p.id}>
                <button type="button" onClick={() => showOnMap(p.id)}>
                  <span className="ob-check is-on"><Check size={12} aria-hidden /></span>
                  <span className="ob-steps-text"><span>{t(p.name)}</span><small>{area(p.x, p.z, p.zone)}</small></span>
                  <MapPinned size={15} aria-hidden className="ob-steps-go" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="ob-block">
        <h3 className="ob-h3"><Star size={15} aria-hidden />{t('旧金山必看', 'San Francisco must-sees')} · {s.mustSee.found}/{s.mustSee.total || 16}</h3>
        {!mustSee.length && <p className="ob-muted">{t('地点加载中…', 'Loading places…')}</p>}
        <ul className="ob-steps-list is-grid">
          {mustSee.map(a => {
            const ok = found.has(a.placeId ?? a.id), row = ix?.get(a.placeId ?? a.id);
            return (
              <li key={a.id} className={ok ? 'is-found' : ''}>
                <button type="button" onClick={() => openMapOn({ kind: 'attraction', id: a.id })} aria-label={`${t(a.name)} · ${ok ? t('去过', 'visited') : t('还没去', 'not yet')}`}>
                  <span className={`ob-check ${ok ? 'is-on' : ''}`}>{ok && <Check size={12} aria-hidden />}</span>
                  <span className="ob-steps-text"><span>{t(a.name)}</span><small>{area(a.x, a.z, row?.zone)}</small></span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="ob-block">
        <h3 className="ob-h3"><MapPinned size={15} aria-hidden />{t('走过的街区', 'Neighbourhoods')} · {s.zones.visited}/{s.zones.total}</h3>
        <ul className="ob-steps-chips">
          {zones.ids.map(id => <li key={id} className={zoneVisited(id) ? 'is-on' : ''}>{t(zoneName(id))}</li>)}
        </ul>
      </section>

      {s.rides.length > 0 && (
        <section className="ob-block">
          <h3 className="ob-h3"><TramFront size={15} aria-hidden />{t('坐过的车', 'Rides')} · {s.ridesTotal}</h3>
          <ul className="ob-steps-list">
            {s.rides.map(r => (
              <li key={r.lineId}><div><span className="ob-check is-on"><Check size={12} aria-hidden /></span><span className="ob-steps-text"><span>{t(r.name)}</span><small>{t({ zh: `坐了 ${r.count} 段`, en: `${r.count} ride${r.count > 1 ? 's' : ''}` })}</small></span></div></li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
