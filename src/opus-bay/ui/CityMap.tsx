import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Bike, Car, Info, LocateFixed, Maximize2, Minus, Navigation, Plus, Route as RouteIcon, X } from 'lucide-react';
import { fleetSnapshot } from '../actors/moveApi';
import { runtime } from '../core/runtime';
import { DEFAULT_TOUR_ID, toast, tourIdOf, useGame } from '../core/store';
import type { Bilingual, Vec2 } from '../core/types';
import { MAP_FRAME, MAP_PAPER } from '../data/mapPaper';
import { zoneLabelAnchor, zoneName } from '../data/cityZones';
import type { Attraction } from '../data/sf/attractionTypes';
import { ATTRACTIONS, ATTRACTION_INDEX, coveredPlaceIds, tripDestination } from '../data/sf/attractions';
import type { CityPlace } from '../data/sf/places';
import { type SfRouteId, routePath, sfRoute } from '../data/sf/routes';
import { vehicleSpots } from '../data/vehicles';
import { isDiscovered, useDiscoveryEpoch, zoneVisited } from '../game/discovery';
import { closePanel, endTrip as endFlowTrip } from '../game/flow';
import { useFlow } from '../game/flowStore';
import { type PlannedRoute, cachedRoute, cancelPlan, endTrip, offRoute, planRoute, tripPlaceId } from '../game/mapRoute';
import { parseMapPanelId } from '../game/mapPanel';
import { autoWalkSeconds, routeAhead, routeTravelLabel, secondsLabel } from '../game/travel';
import { tripRemainingSeconds } from '../game/tripPlan';
import { TRIP_MODE_NAMES } from '../game/tripTypes';
import { timeLabel } from '../game/tripText';
import { useT } from '../i18n';
import { type MapView, clampView, drawCityMap, labelWidth, maxScale, paperShare, thinPx, toPx, zoomAt } from './cityMapDraw';
import { type MapSel, type MapTarget, NORTH_DEG, buildScene, clusterPoints, drawMapExtras, firstOpenView, fitAbs, hitTest, sfLandView } from './cityMapModel';
import { useFar, usePlaceIndex } from './cityHooks';
import { CityMapList, type MapTab } from './CityMapList';
import { BaybayFace, Sheet } from './common';
import { MapBadge, MapLabel } from './MapBadge';
import { useMapLines, useMapStations, useStickersReady } from './mapData';
import { filterLines, loadMapFilter, saveMapFilter, type MapFilter } from './mapFilterRules';
import { MapFilters } from './MapFilters';
import { MapLegend } from './MapLegend';
import { type StationCtx, drawTransitLines, tripRouteStrokes } from './mapLines';
import { MapPaperLayer } from './MapPaperLayer';
import { PlaceActions, type WalkInfo } from './PlaceActions';
import { StationPanel } from './StationPanel';
import './city-ui.css';
import './map-w4.css';

/**
 * The whole-city map (lane G1 in wave 3; wave 4 lane P, plan sf-w4-plan.md §4.1): far.obc on a canvas
 * (ui/cityMapDraw.ts) over H2b's painted paper, the transit lines (the loop, N, M, the cable cars, the F-line; dashed
 * underground) and the station marks on the canvas too, and a screen-space SVG with the attraction badges by tier and
 * category (T1 always, T2 from s 0.3, T3 from 0.45), the other places, labels beside their badge, "+n" clusters, the
 * target's gold pin-flag, BAYBAY and you — all laid out once per view (ui/cityMapModel.ts buildScene). Under the frame:
 * the filter chips, the selected place (PlaceActions) or station (StationPanel), then the search and the tabs 景点 ·
 * 线路 · 附近 · 去过的 (ui/CityMapList.tsx). Drag to pan, wheel / pinch / buttons to zoom; a tap selects the nearest badge
 * or station, a tap on a "+n" zooms into it. The compass rose shows true north (up-left: the game turns the city).
 */

const MAX_DPR = 2;
const MAX_CANVAS = 1800;
const HIT_PX = 22;

/** The selected destination's walking route (G1-8): pending while E2's time-sliced A* runs, then the route or 'none'. */
interface RoutePlan { id: string; status: 'pending' | 'ok' | 'none'; route: PlannedRoute | null }
interface Dest { id: string; to: Vec2 & { heading?: number }; walkable: boolean; placeId: string | null; name: Bilingual }

function useRoutePlan(dest: Dest | null, pos: Vec2): RoutePlan | null {
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const id = dest?.walkable ? dest.id : null;
  const to = dest?.walkable ? dest.to : null;
  // the player left the planned way (the map does not stop you): plan again from here. Walking along it (带我去 with
  // the map open) keeps the plan: what is left of it is drawn and timed (G1-review: no re-plan every 20 u)
  const stale = !!plan?.route && plan.id === id && offRoute(plan.route, pos);
  useEffect(() => {
    if (!id || !to) { setPlan(null); return; }
    const from = { x: runtime.player.x, z: runtime.player.z };
    const hit = cachedRoute(from, to);
    if (hit) { setPlan({ id, status: 'ok', route: hit }); return; }
    setPlan(p => (p?.id === id && p.route ? p : { id, status: 'pending', route: null }));
    let live = true;
    // a short delay: flicking through the list does not start a search per row
    const timer = window.setTimeout(() => {
      void planRoute(from, to).then(r => { if (live && r !== undefined) setPlan({ id, status: r ? 'ok' : 'none', route: r }); });
    }, 120);
    return () => { live = false; window.clearTimeout(timer); };
  }, [id, to?.x, to?.z, stale]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => cancelPlan, []);
  return plan && plan.id === id ? plan : null;
}

/** "约 3 分钟" of auto-walk left on a route for someone at pos, and that route's remaining polyline (G1-review). */
function routeLeft(route: PlannedRoute, pos: Vec2): { points: Vec2[]; time: Bilingual; walked: Vec2[] } {
  const ahead = routeAhead(route.points, pos);
  return { points: ahead.points, time: secondsLabel(autoWalkSeconds(ahead.length + ahead.off)), walked: [{ x: pos.x, z: pos.z }, ...ahead.points] };
}

/** The map's target: an attraction's badge becomes the pin, or a plain place (the island piers: the badge stays). */
function mapTargetOf(placeId: string | null, attraction?: string | null): MapTarget | null {
  if (!placeId && !attraction) return null;
  const a = attraction ? ATTRACTION_INDEX.resolve(attraction) : placeId ? ATTRACTION_INDEX.primary(placeId) : undefined;
  if (a && (!placeId || (a.placeId ?? a.id) === placeId)) return { attraction: a.id };
  return placeId ? { place: placeId } : null;
}

/** One MapTarget object per (place, attraction) pair: a stable identity for the scene's memo. */
const TARGETS = new Map<string, MapTarget | null>();
function mapTargetFor(placeId: string | null, attraction: string | null): MapTarget | null {
  const key = `${placeId ?? ''}|${attraction ?? ''}`;
  let v = TARGETS.get(key);
  if (v === undefined) { v = mapTargetOf(placeId, attraction); TARGETS.set(key, v); }
  return v;
}

const ATTRACTION_BY_ID: ReadonlyMap<string, Attraction> = new Map(ATTRACTIONS.map(a => [a.id, a]));
const T1_LIST = ATTRACTIONS.filter(a => a.rank === 1);

export function CityMapPanel() {
  const { t, locale } = useT();
  const loc: 'zh' | 'en' = locale === 'en' ? 'en' : 'zh';
  const far = useFar();
  const ix = usePlaceIndex();
  const lines = useMapLines();
  const { stations, termini } = useMapStations(lines);
  const stationById = useMemo(() => new Map(stations.map(s => [s.id, s])), [stations]);
  const epoch = useDiscoveryEpoch();
  const pos = useGame(s => s.playerPos);
  const coarse = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches, []);
  const covered = useMemo(() => coveredPlaceIds(), []);
  const stickers = useStickersReady();
  const [sel, setSel] = useState<MapSel | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<MapTab>('sights');
  const [filter, setFilterState] = useState<MapFilter>(() => loadMapFilter());
  const setFilter = useCallback((f: MapFilter) => { setFilterState(f); saveMapFilter(f); }, []);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [legend, setLegend] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<MapView | null>(null);

  // 带我去 in progress (flow.mapTarget = place:<id>) or a trip (lane C's flow.trip): the target pin, the trip's route
  const mapTarget = useFlow(s => s.mapTarget);
  const trip = useFlow(s => s.trip);
  const tripId = tripPlaceId(mapTarget);
  const tripPlace = tripId && ix ? ix.get(tripId) ?? null : null;
  const targetPlaceId = trip ? trip.placeId : tripId, targetAttraction = trip?.attraction ?? null;
  const target = mapTargetFor(targetPlaceId, targetAttraction);
  // a city tour (lane C's Grand Tour): its current stop's attraction gets the coral number disc (plan §4.1 "next tour stop")
  const tourId = useGame(s => (s.tour.active && tourIdOf(s.tour) !== DEFAULT_TOUR_ID ? tourIdOf(s.tour) : null));
  const tourStep = useGame(s => s.tour.stop);
  const [tourNext, setTourNext] = useState<{ id: string; n: number } | null>(null);
  useEffect(() => {
    if (!tourId) { setTourNext(null); return; }
    let live = true;
    void Promise.all([import('../game/cityTour'), import('../data/sf/tours')]).then(([ct, tours]) => {
      const run = ct.cityTourRun(), def = tours.cityTour(tourId);
      const stop = run?.stop && def ? def.chapters.flatMap(c => c.stops).find(s => s.id === run.stop) : undefined;
      const a = stop?.attraction ? ATTRACTION_INDEX.resolve(stop.attraction) : undefined;
      if (live) setTourNext(a && run ? { id: a.id, n: run.i + 1 } : null);
    }, () => { if (live) setTourNext(null); });
    return () => { live = false; };
  }, [tourId, tourStep, trip?.placeId]);

  // size: follow the frame
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => setSize({ w: Math.max(200, el.clientWidth), h: Math.max(200, el.clientHeight) });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // the first view (plan §4.1 "Framing"): the player + the target / the 3 nearest T1 not visited yet; later resizes
  // keep the centre and the scale
  const targetPoint = useMemo((): Vec2 | null => {
    if (target?.attraction) { const a = ATTRACTION_INDEX.get(target.attraction); if (a) { const d = tripDestination(a); return { x: d.x, z: d.z }; } }
    if (target?.place) { const p = ix?.get(target.place); if (p) return p.arrival; }
    return null;
  }, [target, ix]);
  useEffect(() => {
    if (!size) return;
    setView(v => {
      if (v) return clampView({ ...v, w: size.w, h: size.h }, MAP_FRAME);
      const base: MapView = { cx: runtime.player.x, cz: runtime.player.z, scale: 0.5, w: size.w, h: size.h };
      return firstOpenView(base, MAP_FRAME, {
        player: { x: runtime.player.x, z: runtime.player.z },
        focus: targetPoint ? [targetPoint] : [],
        t1: T1_LIST.map(a => ({ x: a.x, z: a.z, found: isDiscovered(a.placeId ?? a.id) })),
      });
    });
  }, [size?.w, size?.h]); // eslint-disable-line react-hooks/exhaustive-deps

  // the map opened on a trip: the destination selected
  const openedOnTrip = useRef(false);
  useEffect(() => {
    if (openedOnTrip.current || !target) return;
    openedOnTrip.current = true;
    setSel(s => s ?? (target.attraction ? { kind: 'attraction', id: target.attraction } : target.place ? { kind: 'place', id: target.place } : null));
  }, [target]);

  // openPanel('map', …): a place (the Journal's 足迹), an attraction, a station, a line (lane T's 看线路图)
  const openId = useGame(s => (s.panel.kind === 'map' ? s.panel.id ?? null : null));
  const openedOn = useRef<string | null>(null);

  // --- the scene (badges, places, stations, zone names, labels, clusters) -----------------------------------------------
  const zones = useMemo(() => (far ? far.zones.map(z => ({ id: z.id, at: zoneLabelAnchor(z) })).filter(z => z.at).map(z => ({ id: z.id, x: z.at!.x, z: z.at!.z, name: zoneName(z.id) })) : []), [far]);
  const visitedZones = useMemo(() => zones.filter(z => zoneVisited(z.id)), [zones, epoch]); // eslint-disable-line react-hooks/exhaustive-deps
  // parked bikes and the toy car (their spots, or where you left them: E2's fleet snapshot), from s 1.2
  const rides = useMemo(() => {
    if (!view || view.scale < 1.2) return [] as { id: string; kind: 'bike' | 'car'; x: number; y: number }[];
    const fleet = fleetSnapshot();
    const out: { id: string; kind: 'bike' | 'car'; x: number; y: number }[] = [];
    for (const s of vehicleSpots()) {
      const moved = s.kind === 'car' ? fleet.car : fleet.bike?.id === s.id ? fleet.bike : undefined;
      const x = moved?.x ?? s.x, z = moved?.z ?? s.z;
      if (Math.hypot(x - pos.x, z - pos.z) < 2.5) continue; // the one you are riding
      const [px, py] = toPx(view, x, z);
      if (px < -10 || py < -10 || px > view.w + 10 || py > view.h + 10) continue;
      out.push({ id: s.id, kind: s.kind, x: px, y: py });
    }
    return out;
  }, [view, pos]);
  const guideAt = view ? toPx(view, runtime.guide.x, runtime.guide.z) : null;
  const youAt = view ? toPx(view, pos.x, pos.z) : null;
  const tallTools = !!size && size.h >= 300;
  const toolRight = tallTools ? 48 : 90;
  // --- pan / zoom / pinch / tap -----------------------------------------------------------------------------------------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ moved: number; pinch: number | null }>({ moved: 0, pinch: null });
  const local = (e: { clientX: number; clientY: number }) => {
    const r = frameRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, .mw-legend-pop')) return;
    frameRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    drag.current = { moved: 0, pinch: null };
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !view) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (drag.current.pinch) setView(v => (v ? zoomAt(v, MAP_FRAME, d / drag.current.pinch!, (a.x + b.x) / 2, (a.y + b.y) / 2) : v));
      drag.current.pinch = d;
      drag.current.moved += 10;
      return;
    }
    const dx = p.x - prev.x, dy = p.y - prev.y;
    drag.current.moved += Math.abs(dx) + Math.abs(dy);
    setView(v => (v ? clampView({ ...v, cx: v.cx - dx / v.scale, cz: v.cz - dy / v.scale }, MAP_FRAME) : v));
  };
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    const had = pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) drag.current.pinch = null;
    if (!had || drag.current.moved > 6 || !view || !scene) return;
    // a tap: the nearest badge / place / station within reach; a "+n" badge zooms in to its members
    const p = local(e);
    const hit = hitTest(scene, p.x, p.y, HIT_PX);
    if (hit?.members?.length && scene.s < 1.2) {
      const pts = clusterPoints(scene, ATTRACTION_BY_ID, hit.id, hit.members);
      setView(v => (v ? fitAbs(v, MAP_FRAME, pts, 56, 0.5, 2.4) : v));
      return;
    }
    setSel(hit ? { kind: hit.kind, id: hit.id } : null);
  };
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const r = frameRef.current!.getBoundingClientRect();
    setView(v => (v ? zoomAt(v, MAP_FRAME, Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top) : v));
  }, []);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);
  const zoomBy = (k: number) => setView(v => (v ? zoomAt(v, MAP_FRAME, k, v.w / 2, v.h / 2) : v));
  const fitCity = () => setView(v => (v ? sfLandView(v, MAP_FRAME) : v));
  const locate = () => setView(v => (v ? clampView({ ...v, cx: runtime.player.x, cz: runtime.player.z, scale: Math.max(v.scale, 0.9) }, MAP_FRAME) : v));
  const focusAt = (x: number, z: number, minScale = 0.8) => setView(v => (v ? clampView({ ...v, cx: x, cz: z, scale: Math.max(v.scale, minScale) }, MAP_FRAME) : v));
  const pickAttraction = (a: Attraction) => { setSel({ kind: 'attraction', id: a.id }); focusAt(a.x, a.z); };
  const pickPlace = (p: CityPlace) => {
    // a place an attraction speaks for selects the attraction's badge; a station row selects the station
    const a = ATTRACTION_INDEX.primary(p.id);
    if (a) { pickAttraction(a); return; }
    if (stationById.has(p.id)) { pickStation(p.id); return; }
    setSel({ kind: 'place', id: p.id });
    focusAt(p.x, p.z, 1.2);
  };
  const pickStation = (id: string) => { const st = stationById.get(id); if (!st) return; setSel({ kind: 'station', id }); focusAt(st.x, st.z, 0.8); };
  const pickLine = (id: string) => {
    setHighlight(h => (h === id ? null : id));
    setTab('lines');
    const line = lines.find(l => l.id === id);
    if (line && highlight !== id) {
      const pts: Vec2[] = [];
      for (let i = 0; i + 2 < line.path.length; i += 3 * 8) pts.push({ x: line.path[i], z: line.path[i + 2] });
      setView(v => (v ? fitAbs(v, MAP_FRAME, pts, 28, 0.1, 1.2) : v));
    }
  };
  const pickRoute = (id: SfRouteId) => {
    const key = `route:${id}`;
    setHighlight(h => (h === key ? null : key));
    setTab('lines');
    const p = routePath(id);
    if (p && highlight !== key) {
      const pts: Vec2[] = [];
      for (let i = 0; i + 1 < p.points.length; i += 2) pts.push({ x: p.points[i], z: p.points[i + 1] });
      setView(v => (v ? fitAbs(v, MAP_FRAME, pts, 36, 0.2, 2) : v));
    }
  };
  useEffect(() => {
    if (!openId || !view || openedOn.current === openId) return;
    const on = parseMapPanelId(openId);
    if (!on) return;
    if (on.kind === 'line') { if (!lines.some(l => l.id === on.id)) return; openedOn.current = openId; pickLine(on.id); return; }
    if (on.kind === 'station') { if (!stationById.has(on.id)) return; openedOn.current = openId; pickStation(on.id); return; }
    if (on.kind === 'attraction') { const a = ATTRACTION_INDEX.resolve(on.id); if (a) { openedOn.current = openId; pickAttraction(a); } return; }
    if (!ix) return;
    const p = ix.get(on.id);
    if (!p) return;
    openedOn.current = openId;
    pickPlace(p);
  }, [openId, ix, view, lines, stationById]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- the selection: its destination, its walking route (G1-8) -------------------------------------------------------
  const selAttraction = sel?.kind === 'attraction' ? ATTRACTION_INDEX.get(sel.id) ?? null : null;
  const selPlace: CityPlace | null = !ix || !sel ? null : sel.kind === 'place' ? ix.get(sel.id) ?? null : selAttraction ? ix.get(selAttraction.placeId ?? selAttraction.id) ?? null : null;
  const selStation = sel?.kind === 'station' ? stationById.get(sel.id) ?? null : null;
  const dest = useMemo((): Dest | null => {
    if (selAttraction) {
      const d = tripDestination(selAttraction);
      const row = ix?.get(d.placeId);
      return { id: `a:${selAttraction.id}`, to: { x: d.x, z: d.z }, walkable: row ? row.walkable : !selAttraction.offWalk, placeId: d.placeId, name: d.name };
    }
    if (selPlace) return { id: `p:${selPlace.id}`, to: selPlace.arrival, walkable: selPlace.walkable, placeId: selPlace.id, name: selPlace.name };
    if (selStation) return { id: `s:${selStation.id}`, to: { x: selStation.x, z: selStation.z }, walkable: true, placeId: ix?.get(selStation.id) ? selStation.id : null, name: selStation.name };
    return null;
  }, [selAttraction, selPlace, selStation, ix]);
  // a trip of lane C's runner to the selection: its legs are on the canvas, no walking preview of G1-8's
  const tripHere = !!trip && !!dest?.placeId && trip.placeId === dest.placeId;
  const plan = useRoutePlan(tripHere ? null : dest, pos);
  const onTrip = !!dest?.placeId && (dest.placeId === tripId || (!!trip && trip.placeId === dest.placeId));
  const left = useMemo(() => (plan?.route ? routeLeft(plan.route, pos) : null), [plan, pos]);
  const routeDraw = useMemo(() => {
    if (!view || !left || left.points.length < 2) return null;
    const pts = thinPx(left.points.map(p => toPx(view, p.x, p.z)));
    const end = pts[pts.length - 1];
    const chip = t(left.time);
    const cw = labelWidth(chip, 11) + 16;
    return { pts: pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '), end, chip, cw };
  }, [view, left, t]);
  // the scene (after the route: its time chip is an obstacle for the labels)
  const scene = useMemo(() => {
    if (!view) return null;
    const obstacles = [...rides.map(r => ({ x: r.x, y: r.y, r: 8 })), ...(youAt ? [{ x: youAt[0], y: youAt[1], r: 10 }] : []), ...(guideAt ? [{ x: guideAt[0], y: guideAt[1], r: 12 }] : []), { x: 26, y: 26, r: 18 }, ...(routeDraw ? [{ x: routeDraw.end[0], y: routeDraw.end[1] + 22, r: routeDraw.cw / 2 }] : [])];
    return buildScene({
      view, attractions: ATTRACTIONS, places: ix?.list ?? null, covered, stations, termini, zones: visitedZones,
      discovered: isDiscovered, selected: sel, target, tourNext, filter, highlight, stickers, locale: loc, t, maxNodes: coarse ? 120 : 150, obstacles, toolRight,
    });
  }, [view, ix, covered, stations, termini, visitedZones, sel, target, tourNext, filter, highlight, stickers, loc, t, coarse, rides, youAt?.[0], youAt?.[1], guideAt?.[0], guideAt?.[1], toolRight, epoch, routeDraw]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- the canvas: base map, lines, the trip route, station marks (one rAF per change) ------------------------------------
  const routeStrokes = useMemo(() => (trip ? tripRouteStrokes(trip.legs, trip.leg) : null), [trip]);
  // a walking route (data/sf/routes.ts, the 线路 tab's 步行路线): its walk and numbered stops over the dimmed lines
  const walkId = highlight?.startsWith('route:') ? (highlight.slice(6) as SfRouteId) : null;
  const walk = useMemo(() => { const r = walkId ? sfRoute(walkId) : undefined, p = walkId ? routePath(walkId) : undefined; return r && p ? { xz: p.points, stops: r.stops.map(s => ({ x: s.x, z: s.z })) } : null; }, [walkId]);
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !view || !far) return;
    const id = requestAnimationFrame(() => {
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1, MAX_CANVAS / Math.max(view.w, view.h));
      const W = Math.round(view.w * dpr), H = Math.round(view.h * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // the painted paper at city scale, the vector base when close (verify-visual F2): no second coastline over the paper
      drawCityMap(ctx, { far, visited: zoneVisited, paper: MAP_PAPER ? paperShare(view.scale) : 0, coast: false }, view);
      const fl = filterLines(filter);
      drawTransitLines(ctx, lines, view, { highlight: walk ? null : highlight, dimAll: fl.lines === 'dim' || !!walk });
      drawMapExtras(ctx as unknown as StationCtx, view, { route: routeStrokes, walk, stations: scene?.stations ?? [], stationAlpha: highlight ? 0.85 : 1, dots: scene?.canvasDots ?? [] });
    });
    return () => cancelAnimationFrame(id);
  }, [view, far, lines, epoch, highlight, filter, routeStrokes, walk, scene]);


  // the map opened on a trip: frame you and the whole way once the route is known
  const framedTrip = useRef(false);
  useEffect(() => {
    if (framedTrip.current || !onTrip || !plan?.route) return;
    framedTrip.current = true;
    const route = plan.route;
    setView(v => (v ? fitAbs(v, MAP_FRAME, [{ x: runtime.player.x, z: runtime.player.z }, ...route.points], 44, 0.25, 2) : v));
  }, [onTrip, plan]);
  const showRoute = () => {
    const route = plan?.route;
    const pts: Vec2[] = route ? routeAhead(route.points, runtime.player).points : trip ? trip.legs.flatMap(l => [l.from, l.to]) : [];
    if (pts.length) setView(v => (v ? fitAbs(v, MAP_FRAME, [{ x: runtime.player.x, z: runtime.player.z }, ...pts], 44, 0.2, 2) : v));
  };
  // the trip strip: where lane C's trip goes (its last leg's point name, else the place / attraction)
  const tripName: Bilingual | null = !trip ? null : trip.legs[trip.legs.length - 1]?.to.name ?? (trip.attraction ? ATTRACTION_INDEX.resolve(trip.attraction)?.name : undefined) ?? ix?.get(trip.placeId)?.name ?? null;
  // the trip's ETA chip at its destination (plan §4.1): "市政厅 · 步行 约 2 分钟"
  const tripChip = useMemo(() => {
    if (!trip || !view) return null;
    const end = trip.legs[trip.legs.length - 1]?.to;
    if (!end) return null;
    const [x, y] = toPx(view, end.x, end.z);
    if (x < -40 || y < -40 || x > view.w + 40 || y > view.h + 40) return null;
    const mode = TRIP_MODE_NAMES[trip.option.mode], time = timeLabel(tripRemainingSeconds(trip));
    const text = t({ zh: `${tripName?.zh ?? ''} · ${mode.zh} ${time.zh}`, en: `${tripName?.en ?? ''} · ${mode.en} ${time.en}` });
    // kept inside the frame (clear of the tool column and the credit line): the target may sit at its edge
    const cw = labelWidth(text, 11) + 16;
    return { x: Math.min(view.w - toolRight - cw / 2 - 4, Math.max(cw / 2 + 4, x)), y: Math.min(view.h - 52, Math.max(8, y)), text, cw };
  }, [trip, view, tripName, t, toolRight]);
  const walkInfo: WalkInfo | null = !plan ? null : plan.status === 'pending' ? { state: 'pending' } : plan.status === 'none' || !plan.route ? { state: 'none' } : { state: 'ok', label: routeTravelLabel(left?.walked ?? plan.route.points) };

  const heading = runtime.player.heading;
  const vis = view ? { x: view.cx - view.w / 2 / view.scale, z: view.cz - view.h / 2 / view.scale, w: view.w / view.scale, h: view.h / view.scale } : null;
  const s = view?.scale ?? 0;
  // the paper leaves the DOM once the vector base covers it (decoded papers come back at once when you zoom out)
  const showPaper = !!MAP_PAPER && paperShare(s) > 0;
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const atMax = !!view && view.scale >= maxScale(MAP_FRAME, view.w, view.h) - 1e-6;
  const leading = !!useFlow(st => st.freeLead) || !!trip || !!tripId;

  return (
    <Sheet eyebrow={t('地图', 'Map')} title={t('旧金山', 'San Francisco')} onClose={closePanel} className="ob-map ob-citymap" wide snap={78}>
      {trip && (
        <div className="ob-citymap-trip" role="status">
          <Navigation size={15} aria-hidden />
          <span>
            <b>{t('当前：去', 'Now: to')}{loc === 'en' ? ' ' : ''}{t(tripName ?? { zh: '目的地', en: 'the destination' })}</b>
            <small>{t(timeLabel(tripRemainingSeconds(trip)))}</small>
          </span>
          <button type="button" className="ob-btn ob-btn-ghost ob-btn-sm" onClick={endFlowTrip}><X size={14} aria-hidden /><span>{t('结束', 'End')}</span></button>
        </div>
      )}
      {tripPlace && !trip && (
        <div className="ob-citymap-trip" role="status">
          <Navigation size={15} aria-hidden />
          <span>
            <b>{t('正在去', 'Heading to')} {t(tripPlace.name)}</b>
            {onTrip && left && <small>{t({ zh: `还要走${left.time.zh}`, en: `${left.time.en} to go` })}</small>}
          </span>
          <button type="button" className="ob-btn ob-btn-ghost ob-btn-sm" onClick={() => endTrip(tripPlace.arrival)}><X size={14} aria-hidden /><span>{t('不去了', 'Stop')}</span></button>
        </div>
      )}
      <div ref={frameRef} className="ob-citymap-frame" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        role="application" aria-label={t('旧金山地图：拖动平移，滚轮或双指缩放', 'Map of San Francisco: drag to pan, wheel or pinch to zoom')}>
        {vis && showPaper && <svg className="ob-citymap-paper" viewBox={`${vis.x} ${vis.z} ${vis.w} ${vis.h}`} preserveAspectRatio="none" aria-hidden><MapPaperLayer width={s * dpr > 0.7 ? 4096 : 2048} /></svg>}
        <canvas ref={canvasRef} className="ob-citymap-canvas" style={size ? { width: size.w, height: size.h } : undefined} aria-hidden />
        {guideAt && guideAt[0] > -12 && guideAt[1] > -12 && guideAt[0] < (size?.w ?? 0) + 12 && guideAt[1] < (size?.h ?? 0) + 12 && (
          <span className={`cm-baybay-face${leading ? ' is-leading' : ''}`} style={{ transform: `translate(${(guideAt[0] - 11).toFixed(1)}px, ${(guideAt[1] - 11).toFixed(1)}px)` }} aria-hidden><BaybayFace size={22} /></span>
        )}
        {view && scene && (
          <svg className="ob-citymap-overlay" width={view.w} height={view.h} aria-hidden>
            {routeDraw && (
              <g className={`cm-route ${onTrip ? 'is-trip' : ''}`}>
                <polyline className="cm-route-case" points={routeDraw.pts} />
                <polyline className="cm-route-line" points={routeDraw.pts} />
              </g>
            )}
            {rides.map(r => (
              <g key={r.id} className="cm-ride" transform={`translate(${r.x.toFixed(1)},${r.y.toFixed(1)})`}>
                <circle r={8} />
                {r.kind === 'car' ? <Car x={-5.5} y={-5.5} width={11} height={11} strokeWidth={2.4} /> : <Bike x={-5.5} y={-5.5} width={11} height={11} strokeWidth={2.4} />}
              </g>
            ))}
            {scene.layout.kept.map(k => {
              const m = scene.attractions.get(k.id);
              if (m) return <MapBadge key={k.id} a={m.a} tier={m.a.rank} s={s} state={{ ...m.state, ...(k.members.length ? { cluster: k.members.length } : {}) }} x={k.x} y={k.y} size={m.size} />;
              const pm = scene.places.get(k.id);
              if (pm) return <MapBadge key={k.id} a={{ id: pm.p.id, cat: pm.cat }} tier={pm.tier} s={s} state={{ ...pm.state, ...(k.members.length ? { cluster: k.members.length } : {}) }} x={k.x} y={k.y} size={pm.size} />;
              return null;
            })}
            {scene.layout.kept.map(k => {
              if (!k.label || !k.text) return null;
              if (scene.zones.has(k.id)) return <text key={`l:${k.id}`} x={k.label.tx} y={k.label.ty} className="cm-zone" style={{ textAnchor: 'middle' }}>{k.text}</text>;
              const m = scene.attractions.get(k.id), pm = scene.places.get(k.id);
              const size = m?.size ?? pm?.size;
              const on = (m && sel?.kind === 'attraction' && sel.id === m.a.id) || (pm && sel?.kind === 'place' && sel.id === pm.p.id) || (!m && !pm && sel?.kind === 'station' && k.id === `station:${sel.id}`);
              return <MapLabel key={`l:${k.id}`} label={k.label} text={k.text} fontPx={size?.font ?? 10} weight={size?.weight ?? 700} selected={!!on} />;
            })}
            {tripChip && (
              <g className="cm-route-chip is-trip" transform={`translate(${tripChip.x.toFixed(1)},${(tripChip.y + 22).toFixed(1)})`}>
                <rect x={-tripChip.cw / 2} y={-10} width={tripChip.cw} height={20} rx={10} />
                <text y={4}>{tripChip.text}</text>
              </g>
            )}
            {routeDraw && (
              <g className={`cm-route-chip ${onTrip ? 'is-trip' : ''}`} transform={`translate(${routeDraw.end[0].toFixed(1)},${(routeDraw.end[1] + 22).toFixed(1)})`}>
                <rect x={-routeDraw.cw / 2} y={-10} width={routeDraw.cw} height={20} rx={10} />
                <text y={4}>{routeDraw.chip}</text>
              </g>
            )}
            {youAt && (() => {
              // heading (three.js yaw: forward = (sin h, cos h) in world x/z = screen x/y)
              const deg = (Math.atan2(Math.cos(heading), Math.sin(heading)) * 180) / Math.PI;
              return <g className="cm-you" transform={`translate(${youAt[0]},${youAt[1]}) rotate(${deg})`}><circle r={9} /><path d="M-4 -4 L6 0 L-4 4 Z" /></g>;
            })()}
          </svg>
        )}
        {!far && <p className="ob-citymap-wait">{t('地图铺开中…', 'Unfolding the map…')}</p>}
        <button type="button" className="mw-compass" onClick={() => toast(t('地图按游戏方向摆放，北在左上', 'The map follows the game view: north is up-left'), 'info', 2800)}
          aria-label={t('指北针：北在左上', 'Compass: north is up-left')}>
          <svg width={28} height={28} viewBox="-14 -14 28 28" aria-hidden>
            <circle r={13} className="mw-compass-disc" />
            <g transform={`rotate(${NORTH_DEG})`}>
              <path d="M0 -10 L3.6 0 L0 -2 L-3.6 0 Z" className="mw-compass-n" />
              <path d="M0 10 L3.6 0 L0 2 L-3.6 0 Z" className="mw-compass-s" />
              <text y={-5.2} x={0} className="mw-compass-t" transform={`rotate(${-NORTH_DEG} 0 -7.5)`}>{t('北', 'N')}</text>
            </g>
          </svg>
        </button>
        <div className={`ob-citymap-tools${tallTools ? '' : ' is-two'}`}>
          <button type="button" className="ob-icon-btn" onClick={() => zoomBy(1.6)} aria-label={t('放大', 'Zoom in')} disabled={atMax}><Plus size={17} aria-hidden /></button>
          <button type="button" className="ob-icon-btn" onClick={() => zoomBy(1 / 1.6)} aria-label={t('缩小', 'Zoom out')}><Minus size={17} aria-hidden /></button>
          <button type="button" className="ob-icon-btn" onClick={locate} aria-label={t('回到我这', 'Find me')}><LocateFixed size={17} aria-hidden /></button>
          <button type="button" className="ob-icon-btn" onClick={fitCity} aria-label={t('全城', 'Whole city')}><Maximize2 size={16} aria-hidden /></button>
          {(plan?.route || trip) && <button type="button" className="ob-icon-btn" onClick={showRoute} aria-label={t('看整条路线', 'Show the whole route')}><RouteIcon size={16} aria-hidden /></button>}
          <button type="button" className={`ob-icon-btn${legend ? ' is-on' : ''}`} onClick={() => setLegend(v => !v)} aria-label={t('图例', 'Legend')} aria-pressed={legend}><Info size={17} aria-hidden /></button>
        </div>
        {legend && <div className="mw-legend-pop"><MapLegend onClose={() => setLegend(false)} /></div>}
        <p className="ob-citymap-credit">{t('地图数据', 'Map data')} © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> {t('贡献者', 'contributors')} (ODbL) · DataSF</p>
      </div>

      <MapFilters value={filter} onChange={setFilter} />

      {selPlace && <PlaceActions place={selPlace} attraction={selAttraction} walk={walkInfo} onTrip={onTrip} onRoute={pickRoute} />}
      {selStation && (
        <StationPanel station={selStation} lines={lines} pos={pos} walk={walkInfo} placeId={dest?.placeId ?? null} />
      )}

      <CityMapList
        ix={ix} lines={lines} stations={stations} pos={pos} query={query} setQuery={setQuery} tab={tab} setTab={setTab} selected={sel} highlight={highlight} epoch={epoch}
        onAttraction={pickAttraction} onPlace={pickPlace} onStation={st => pickStation(st.id)} onLine={pickLine} onRoute={pickRoute}
      />
    </Sheet>
  );
}
