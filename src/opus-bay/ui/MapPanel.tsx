import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CalendarPlus, ChevronDown, Info, LocateFixed, Lock, Maximize2, Navigation } from 'lucide-react';
import { runtime } from '../core/runtime';
import { useGame } from '../core/store';
import type { PoiDef, Polygon, Vec2 } from '../core/types';
import { DISTRICT } from '../data/district';
import { POIS } from '../data/pois';
import { POSTCARDS } from '../data/postcards';
import { REGION_LABELS, placesByRegion, useCatalog } from '../data/catalog';
import { guideUrl, planUrl } from '../data/links';
import { closePanel, currentStop, navigateTo, openPanel } from '../game/flow';
import { useT } from '../i18n';
import { Sheet } from './common';
import { InteractIcon } from './icons';
import { placeLabels, textWidth, type Box, type LabelOut } from './mapLabels';
import { travelLabel } from '../game/travel';

const pts = (poly: Polygon | Vec2[]) => poly.map(p => `${p.x.toFixed(1)},${p.z.toFixed(1)}`).join(' ');

/**
 * Map extent: everything you can walk to or use (walk areas, piers, anchors, POIs, the hill) plus a margin,
 * clipped to the slab. The slab itself has generous open water that would only shrink the map.
 */
let cachedBounds: { minX: number; maxX: number; minZ: number; maxZ: number; w: number; h: number } | null = null;
function bounds() {
  if (cachedBounds) return cachedBounds;
  const pts: Vec2[] = [
    ...DISTRICT.walk.flatMap(area => area.polygon),
    ...DISTRICT.piers.flatMap(pier => pier.deck),
    ...Object.values(DISTRICT.anchors ?? {}),
    ...POIS.map(poi => poi.position),
    ...DISTRICT.hills.flatMap(hill => [{ x: hill.center.x - hill.radiusX, z: hill.center.z - hill.radiusZ }, { x: hill.center.x + hill.radiusX, z: hill.center.z + hill.radiusZ }]),
  ].filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.z));
  const sx = DISTRICT.slab.map(p => p.x), sz = DISTRICT.slab.map(p => p.z);
  const slab = { minX: Math.min(...sx), maxX: Math.max(...sx), minZ: Math.min(...sz), maxZ: Math.max(...sz) };
  if (!pts.length) { cachedBounds = { ...slab, w: slab.maxX - slab.minX, h: slab.maxZ - slab.minZ }; return cachedBounds; }
  const m = 10;
  const minX = Math.max(slab.minX, Math.min(...pts.map(p => p.x)) - m), maxX = Math.min(slab.maxX, Math.max(...pts.map(p => p.x)) + m);
  const minZ = Math.max(slab.minZ, Math.min(...pts.map(p => p.z)) - m), maxZ = Math.min(slab.maxZ, Math.max(...pts.map(p => p.z)) + m);
  cachedBounds = { minX, maxX, minZ, maxZ, w: maxX - minX, h: maxZ - minZ };
  return cachedBounds;
}

/** Deterministic jitter so postcard hints show an area, not the exact spot. */
function jitter(id: string, amount: number): Vec2 {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return { x: ((h & 0xff) / 255 - 0.5) * amount, z: (((h >> 8) & 0xff) / 255 - 0.5) * amount };
}

const CityMapPanel = lazy(() => import('./CityMap').then(m => ({ default: m.CityMapPanel })));

/** City mode: the whole-city map (ui/CityMap.tsx, lane G1); district mode: the waterfront map below, unchanged. */
export function MapPanel() {
  const city = useGame(s => s.worldMode === 'city');
  return city ? <Suspense fallback={null}><CityMapPanel /></Suspense> : <DistrictMapPanel />;
}

/** Top-down SVG map of the district with "带我去", plus the rest of the Bay from the catalog. */
function DistrictMapPanel() {
  const { t, locale } = useT();
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState<'all' | 'near'>(() => (window.matchMedia?.('(max-width: 720px)').matches ? 'near' : 'all'));
  const unlocked = useGame(s => s.viewpointUnlocked);
  const pos = useGame(s => s.playerPos);
  const poi = POIS.find(item => item.id === selected);
  const b = useMemo(() => bounds(), []);
  const [width, setWidth] = useState(480);
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth || 480);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pad = Math.max(b.w, b.h) * 0.02;
  let vb = { x: b.minX - pad, y: b.minZ - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
  if (zoom === 'near') {
    // a squarer window around you (or the selected place) reads better than a thin strip
    const w = Math.max(80, vb.w / 2.8), h = Math.min(vb.h, w * 0.66);
    const focus = poi ? poi.position : pos;
    vb = { x: Math.min(b.maxX + pad - w, Math.max(b.minX - pad, focus.x - w / 2)), y: Math.min(b.maxZ + pad - h, Math.max(b.minZ - pad, focus.z - h / 2)), w, h };
  }
  const k = vb.w / Math.max(200, width); // world units per CSS pixel
  // F17: labels are placed inside what you actually see (the current window), by priority:
  // the tour's next stop / the selected place, then the other places, then zone names, then pier numbers
  const near = zoom === 'near';
  const tourActive = useGame(s => s.tour.active);
  const next = tourActive ? currentStop()?.poi.id : undefined;
  const vx = vb.x, vy = vb.y, vw = vb.w, vh = vb.h;
  const plan = useMemo(() => planMapLabels({ k, view: { x0: vx, z0: vy, x1: vx + vw, z1: vy + vh }, near, selected, next, narrow: width < 480, t, locale }),
    [k, vx, vy, vw, vh, near, selected, next, width, t, locale]);

  return (
    <Sheet eyebrow={t('地图', 'Map')} title={t(DISTRICT.name)} onClose={closePanel} className="ob-map" wide snap={70}>
      <div className="ob-map-frame">
        <svg ref={svgRef} className="ob-map-svg" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="img" aria-label={t('海滨地图', 'Waterfront map')} preserveAspectRatio="xMidYMid meet">
          <StaticLayers k={k} />
          <DynamicLayer k={k} selected={selected} onSelect={setSelected} unlocked={unlocked} />
          <MapLabels k={k} plan={plan} />
        </svg>
      </div>
      <div className="ob-map-under">
        <div className="ob-map-row">
          <div className="ob-map-zoom" role="radiogroup" aria-label={t('缩放', 'Zoom')}>
            <button type="button" role="radio" aria-checked={zoom === 'all'} className={zoom === 'all' ? 'is-on' : ''} onClick={() => setZoom('all')}><Maximize2 size={15} aria-hidden />{t('全图', 'All')}</button>
            <button type="button" role="radio" aria-checked={zoom === 'near'} className={zoom === 'near' ? 'is-on' : ''} onClick={() => setZoom('near')}><LocateFixed size={15} aria-hidden />{t('附近', 'Nearby')}</button>
          </div>
          <div className="ob-map-legend" aria-hidden>
            <span><i className="lg-you" />{t('你', 'You')}</span>
            <span><i className="lg-baybay" />BAYBAY</span>
            <span><i className="lg-poi" />{t('地点', 'Places')}</span>
            {unlocked && <span><i className="lg-card" />{t('明信片', 'Postcards')}</span>}
          </div>
        </div>
        {!unlocked && <p className="ob-map-lock"><Lock size={14} aria-hidden />{t('登上 Coit Tower 看全景，解锁完整地图和明信片线索', 'Reach the Coit Tower viewpoint to reveal the full map and postcard hints')}</p>}
      </div>

      {poi && (
        <div className="ob-map-pop" role="group" aria-label={t(poi.name)}>
          <span className="ob-map-pop-icon"><InteractIcon kind={poi.interaction.kind} size={20} /></span>
          <div className="ob-map-pop-text">
            <strong>{t(poi.name)}</strong>
            <small>{t(poi.interaction.verb)} · {distanceLabel(poi, t)}</small>
          </div>
          <button type="button" className="ob-btn ob-btn-primary ob-btn-sm" onClick={() => navigateTo(poi.id)}><Navigation size={15} aria-hidden /><span>{t('带我去', 'Take me')}</span></button>
          {poi.realInfo && <button type="button" className="ob-icon-btn" onClick={() => openPanel('poi', poi.id)} aria-label={t('查看介绍', 'Details')}><Info size={18} aria-hidden /></button>}
        </div>
      )}

      <section className="ob-block">
        <h3 className="ob-h3">{t('这片海滨', 'On this waterfront')}</h3>
        <ul className="ob-place-list">
          {POIS.filter(item => item.interaction.kind !== 'postcard').map((item, i) => (
            <li key={item.id}>
              <button type="button" className={selected === item.id ? 'is-on' : ''} onClick={() => setSelected(item.id)}>
                <span className="ob-place-num" aria-hidden>{i + 1}</span>
                <span className="ob-place-text"><span>{t(item.name)}</span><small>{distanceLabel(item, t)}</small></span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <ElsewhereInBay />
    </Sheet>
  );
}

/** F8: in-game walking time, plus the real walk for real places ("游戏里约 1 分钟 · 现实步行约 30 分钟 / 2.5 公里"). */
function distanceLabel(poi: PoiDef, t: ReturnType<typeof useT>['t']) {
  return t(travelLabel({ x: runtime.player.x, z: runtime.player.z }, poi));
}

const centroid = (poly: Vec2[]) => poly.reduce((acc, p) => ({ x: acc.x + p.x / poly.length, z: acc.z + p.z / poly.length }), { x: 0, z: 0 });

type LabelPlan = { pois: LabelOut[]; zones: LabelOut[]; piers: LabelOut[] };

/** Greedy, prioritised, collision-free label layout for the map window (pure; world units). */
function planMapLabels(o: { k: number; view: Box; near: boolean; selected: string | null; next?: string; narrow: boolean; t: ReturnType<typeof useT>['t']; locale: string }): LabelPlan {
  const { k, view, t } = o;
  const inset = { x0: view.x0 + 4 * k, z0: view.z0 + 4 * k, x1: view.x1 - 4 * k, z1: view.z1 - 4 * k };
  const markers = POIS.map(poi => ({ x: poi.position.x, z: poi.position.z, r: 9 * k }));
  const boxes = (out: LabelOut[], f: number): Box[] => out.map(l => { const w = textWidth(l.text, f) + f * 0.4; return { x0: l.x - w / 2, z0: l.y - f * 0.95, x1: l.x + w / 2, z1: l.y + f * 0.3 }; });
  // 1) places: the next stop / the selected one first; the others only when zoomed in
  const fp = 12 * k;
  const rank = (id: string) => (id === o.next ? 0 : id === o.selected ? 1 : 2);
  const poiIn = POIS.filter(poi => o.near || poi.id === o.selected || poi.id === o.next)
    .sort((a, b) => rank(a.id) - rank(b.id))
    .map(poi => ({ id: poi.id, text: t(poi.name), at: { x: poi.position.x, z: poi.position.z - 14 * k } }));
  const pois = placeLabels(poiIn, { fontSize: fp, view: inset, markers });
  // 2) zone names fill the gaps
  const fz = 12 * k;
  const zoneIn = DISTRICT.zones
    .filter(zone => zone.polygon.length > 2 && (o.near || zone.id !== 'embarcadero'))
    .map(zone => ({ id: zone.id, text: t(zone.name), at: centroid(zone.polygon) }));
  const zones = placeLabels(zoneIn, { fontSize: fz, view: inset, markers, avoid: boxes(pois, fp) });
  // 3) pier numbers last — zoomed in, on a map wide enough, and in Chinese only the "PIER n" ones (no English-only signs)
  const fq = 10 * k;
  const pierIn = o.near && !o.narrow
    ? DISTRICT.piers.filter(pier => o.locale === 'en' || /^PIER\s*\d+/i.test(pier.label)).map(pier => ({ id: pier.id, text: pier.label, at: { x: centroid(pier.deck).x, z: centroid(pier.deck).z + 4 * k } }))
    : [];
  const piers = placeLabels(pierIn, { fontSize: fq, view: inset, markers, avoid: [...boxes(pois, fp), ...boxes(zones, fz)] });
  return { pois, zones, piers };
}

function MapLabels({ k, plan }: { k: number; plan: LabelPlan }) {
  return (
    <g className="ob-map-labels" aria-hidden>
      {plan.piers.map(l => <text key={l.id} x={l.x} y={l.y} className="m-pier-label" style={{ fontSize: 10 * k, strokeWidth: 2.5 * k }}>{l.text}</text>)}
      {plan.zones.map(l => <text key={l.id} x={l.x} y={l.y} className="m-zone" style={{ fontSize: 12 * k, strokeWidth: 3 * k }}>{l.text}</text>)}
      {plan.pois.map(l => <text key={l.id} x={l.x} y={l.y} className="m-poi-label" style={{ fontSize: 12 * k, strokeWidth: 3.2 * k }}>{l.text}</text>)}
    </g>
  );
}

const StaticLayers = memo(function StaticLayers({ k }: { k: number }) {
  return (
    <g className="ob-map-static">
      <polygon points={pts(DISTRICT.slab)} className="m-water" />
      {DISTRICT.hills.map(hill => (
        <g key={hill.id} className="m-hill" style={{ strokeWidth: k }}>
          {[1, 0.72, 0.45].map(f => <ellipse key={f} cx={hill.center.x} cy={hill.center.z} rx={hill.radiusX * f} ry={hill.radiusZ * f} />)}
        </g>
      ))}
      {DISTRICT.walk.map(area => <polygon key={area.id} points={pts(area.polygon)} className={`m-walk s-${area.surface}`} style={{ strokeWidth: k }} />)}
      {DISTRICT.blocks.map(block => <polygon key={block.id} points={pts(block.footprint)} className="m-block" style={{ strokeWidth: k * 0.8 }} />)}
      {DISTRICT.roads.map(road => <polyline key={road.id} points={pts(road.points)} className={`m-road k-${road.kind}`} style={{ strokeWidth: road.width }} />)}
      {DISTRICT.ramps.map(ramp => <polyline key={ramp.id} points={pts(ramp.points)} className="m-ramp" style={{ strokeWidth: ramp.width }} />)}
      {DISTRICT.piers.map(pier => {
        return (
          <g key={pier.id} className="m-pier">
            <polygon points={pts(pier.deck)} className="m-deck" style={{ strokeWidth: k }} />
            {pier.shed && <polygon points={pts(pier.shed.footprint)} className="m-shed" style={{ strokeWidth: k * 1.2 }} />}
          </g>
        );
      })}
      {DISTRICT.streetcar.path.length > 1 && <polyline points={pts(DISTRICT.streetcar.path)} className="m-track" style={{ strokeWidth: 1.6 * k, strokeDasharray: `${5 * k} ${3 * k}` }} />}
      {DISTRICT.landmarks.filter(item => item.kind !== 'streetcar-stop' && item.kind !== 'telescope').map(item => <circle key={item.id} cx={item.position.x} cy={item.position.z} r={3.2 * k} className="m-landmark" style={{ strokeWidth: 1.4 * k }} />)}
    </g>
  );
});

function DynamicLayer({ k, selected, onSelect, unlocked }: { k: number; selected: string | null; onSelect: (id: string) => void; unlocked: boolean }) {
  const { t } = useT();
  const pos = useGame(s => s.playerPos);
  const postcards = useGame(s => s.postcards);
  const completed = useGame(s => s.tour.completed);
  const tourActive = useGame(s => s.tour.active);
  const next = tourActive ? currentStop()?.poi.id : undefined;
  const b = bounds();
  const heading = runtime.player.heading;
  const angle = (Math.atan2(Math.cos(heading), Math.sin(heading)) * 180) / Math.PI;
  const fogR = Math.max(40, b.w * 0.12);
  return (
    <g>
      {!unlocked && (
        <>
          <defs>
            <mask id="ob-fog-mask">
              <rect x={b.minX - 50} y={b.minZ - 50} width={b.w + 100} height={b.h + 100} fill="white" />
              <circle cx={pos.x} cy={pos.z} r={fogR} fill="black" />
              {POIS.filter(poi => completed.includes(poi.id)).map(poi => <circle key={poi.id} cx={poi.position.x} cy={poi.position.z} r={fogR * 0.6} fill="black" />)}
            </mask>
          </defs>
          <rect x={b.minX - 50} y={b.minZ - 50} width={b.w + 100} height={b.h + 100} className="m-fog" mask="url(#ob-fog-mask)" />
        </>
      )}
      {unlocked && POSTCARDS.map(card => {
        const got = postcards.includes(card.id);
        const j = got ? { x: 0, z: 0 } : jitter(card.id, 14);
        return got
          ? <rect key={card.id} x={card.position.x - 6 * k} y={card.position.z - 4.5 * k} width={12 * k} height={9 * k} rx={2 * k} className="m-card is-got" style={{ strokeWidth: 1.2 * k }} />
          : <circle key={card.id} cx={card.position.x + j.x} cy={card.position.z + j.z} r={Math.max(9, 14 * k)} className="m-card-hint" style={{ strokeWidth: 1.5 * k, strokeDasharray: `${4 * k} ${3 * k}` }}><title>{t(card.hint)}</title></circle>;
      })}
      {POIS.map((poi, i) => {
        const done = completed.includes(poi.id);
        return (
          <g
            key={poi.id}
            className={`m-poi ${poi.id === next ? 'is-next' : ''} ${done ? 'is-done' : ''} ${selected === poi.id ? 'is-on' : ''}`}
            transform={`translate(${poi.position.x} ${poi.position.z})`}
            onClick={() => onSelect(poi.id)}
            role="button"
            tabIndex={0}
            aria-label={t(poi.name)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(poi.id); } }}
          >
            {poi.id === next && <circle r={16 * k} className="m-poi-pulse" />}
            <circle r={9 * k} className="m-poi-dot" style={{ strokeWidth: 2 * k }} />
            <text y={3.6 * k} className="m-poi-num" style={{ fontSize: 10 * k }}>{done ? '✓' : i + 1}</text>
          </g>
        );
      })}
      <g transform={`translate(${runtime.guide.x} ${runtime.guide.z})`} className="m-baybay"><circle r={5 * k} style={{ strokeWidth: 2.4 * k }} /></g>
      <g transform={`translate(${pos.x} ${pos.z}) rotate(${angle}) scale(${k})`} className="m-you">
        <circle r={16} className="m-you-halo" />
        <path d="M12 0 L-6 7.5 L-2.8 0 L-6 -7.5 Z" className="m-you-arrow" />
        <circle r={4} className="m-you-dot" />
      </g>
    </g>
  );
}

function ElsewhereInBay() {
  const { t, locale } = useT();
  const catalog = useCatalog();
  // F14: only places that really are NOT on this little map (PIER 39 and Alcatraz Landing are on it)
  const onMap = new Set(POIS.map(poi => poi.plannerPlaceId).filter((id): id is string => !!id));
  const groups = placesByRegion(catalog).map(group => ({ ...group, places: group.places.filter(place => !onMap.has(place.id)) })).filter(group => group.places.length > 0);
  const [open, setOpen] = useState<string | null>('sf');
  if (!groups.length) return null;
  return (
    <section className="ob-block ob-elsewhere">
      <h3 className="ob-h3">{t('湾区更多地方', 'More of the Bay')}</h3>
      <p className="ob-muted">{t('这些地方不在这张小地图里，BAYLINK 有完整攻略：', 'Not on this little map — BAYLINK has full guides:')}</p>
      {groups.map(group => (
        <div key={group.region} className={`ob-acc ${open === group.region ? 'is-open' : ''}`}>
          <button type="button" className="ob-acc-head" aria-expanded={open === group.region} onClick={() => setOpen(open === group.region ? null : group.region)}>
            <span>{REGION_LABELS[group.region] ? t(REGION_LABELS[group.region]) : group.region}</span>
            <small>{group.places.length}</small>
            <ChevronDown size={16} aria-hidden />
          </button>
          {open === group.region && (
            <ul className="ob-acc-body">
              {group.places.map(place => (
                <li key={place.id}>
                  <div>
                    <strong>{place.title}</strong>
                    {place.summary && <small>{place.summary}</small>}
                  </div>
                  <span className="ob-acc-links">
                    {place.guideSlug && <a href={guideUrl(place.guideSlug, locale)} target="_blank" rel="noopener" aria-label={t('攻略', 'Guide')} title={t('攻略', 'Guide')}><BookOpen size={16} aria-hidden /></a>}
                    <a href={planUrl({ stops: [{ kind: 'place', id: place.id }] }, catalog, locale)} target="_blank" rel="noopener" aria-label={t('安排进计划', 'Plan')} title={t('安排进计划', 'Plan')}><CalendarPlus size={16} aria-hidden /></a>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}
