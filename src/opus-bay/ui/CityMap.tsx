import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type TouchEvent as RTouchEvent } from 'react';
import { Bike, CalendarDays, Car, Info, LocateFixed, Maximize2, Minus, Navigation, Plus, Route as RouteIcon, X } from 'lucide-react';
import { fleetSnapshot } from '../actors/moveApi';
import { walkGraph } from '../actors/nav';
import { runtime } from '../core/runtime';
import { nearestWalkable, standAt } from '../core/terrain';
import { DEFAULT_TOUR_ID, toast, tourIdOf, useGame } from '../core/store';
import type { Bilingual, Vec2 } from '../core/types';
import { MAP_FRAME, MAP_PAPER } from '../data/mapPaper';
import { cityAreaAt, farZoneIndexAt, landmarkAreaAt, zoneLabelAnchor, zoneName } from '../data/cityZones';
import type { Attraction } from '../data/sf/attractionTypes';
import { ATTRACTIONS, ATTRACTION_INDEX, coveredPlaceIds, tripDestination } from '../data/sf/attractions';
import type { CityPlace } from '../data/sf/places';
import { type SfRouteId, routePath, sfRoute } from '../data/sf/routes';
import { vehicleSpots } from '../data/vehicles';
import { arrivalSeen } from '../game/cityContent';
import { isDiscovered, useDiscoveryEpoch, zoneVisited } from '../game/discovery';
import { closePanel, endTrip as endFlowTrip, openEvent, replanTrip } from '../game/flow';
import { type PlaceTripDest, startPlaceTrip } from '../game/placeTrips';
import { useFlow } from '../game/flowStore';
import { type PlannedRoute, cachedRoute, cancelPlan, endTrip, offRoute, planRoute, tripPlaceId } from '../game/mapRoute';
import { parseMapPanelId } from '../game/mapPanel';
import { autoWalkSeconds, routeAhead, routeTravelLabel, secondsLabel } from '../game/travel';
import { tripRemainingSeconds } from '../game/tripPlan';
import type { TripOption } from '../game/tripTypes';
import { timeLabel } from '../game/tripText';
import { useT } from '../i18n';
import { type MapView, clampView, drawCityMap, labelWidth, maxScale, paperShare, thinPx, toPx, toWorld, zoomAt } from './cityMapDraw';
import { type MapSel, type MapTarget, NORTH_DEG, buildScene, canvasMarksKey, clusterPoints, drawMapExtras, firstOpenView, fitAbs, hitTest, sfLandView } from './cityMapModel';
import { useFar, usePlaceIndex } from './cityHooks';
import { CityMapList, type MapTab } from './CityMapList';
import { BaybayFace, Sheet } from './common';
import { MapBadge, MapLabel, MapTargetPin } from './MapBadge';
import { type ChooserRow, ClusterChooser, MapGoCard, useQuickWays } from './MapGoCard';
import { type PressLookups, type PressSpot, PRESS, chooserHeight, creditGuarded, goCardHeight, mapGestureTarget, panForCard, pressPlaceId, pressSpot, toolsMaxHeight } from './mapGo';
import { pinsFor, useWeekPins, weekFitPoints } from './mapEvents';
import { useMapLines, useMapStations, useStickersReady } from './mapData';
import { filterLines, loadMapFilter, saveMapFilter, type MapFilter } from './mapFilterRules';
import { MapFilters } from './MapFilters';
import { MapLegend } from './MapLegend';
import { type StationCtx, drawTransitLines, tripRouteStrokes } from './mapLines';
import { MapPaperLayer } from './MapPaperLayer';
import { mapOpenFallback, mapTargetOf, tripEta } from './mapTrips';
import { PlaceActions, type WalkInfo, useTripOptions } from './PlaceActions';
import { optionTitle, optionWay, tripSecondsLabel } from './tripRows';
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
/** From this frame height the tool column is one button wide (below it: two columns, the 375 × 667 phone) */
const TALL_TOOLS_H = 300;
/** px the right-hand tool column takes (labels keep off it, framings keep you, BAYBAY and the target clear of it) */
const toolColumn = (frameH: number) => (frameH >= TALL_TOOLS_H ? 48 : 90);
/** W5-N4: a map frame this narrow (px) is a phone's: the selection's card is pinned over the map, a "+n" opens the chooser */
const COMPACT_W = 520;

/** W5-N4 · what a long-press asks of the game (ui/mapGo.ts pressSpot): the terrain, the walking graph, places, land, areas. */
function pressLookups(far: ReturnType<typeof useFar>, ix: ReturnType<typeof usePlaceIndex>, graph: Awaited<ReturnType<typeof walkGraph>> | null): PressLookups {
  return {
    stand: (x, z) => standAt(x, z),
    nearestWalkable: (p, r) => nearestWalkable(p, r),
    graphNear: graph ? (p, r) => { const i = graph.nearestNode(p.x, p.z, r); return i >= 0 ? graph.pos(i) : null; } : undefined,
    placesNear: (x, z, r) => (ix?.near(x, z, r) ?? []).map(p => ({ id: p.id, name: p.name, x: p.x, z: p.z, arrival: p.arrival, walkable: p.walkable })),
    onLand: (x, z) => !!far && farZoneIndexAt(far, x, z) >= 0,
    area: (x, z) => cityAreaAt(x, z)?.name ?? null,
  };
}

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
function routeLeft(route: PlannedRoute, pos: Vec2): { points: Vec2[]; time: Bilingual; seconds: number; walked: Vec2[] } {
  const ahead = routeAhead(route.points, pos);
  const seconds = autoWalkSeconds(ahead.length + ahead.off);
  return { points: ahead.points, time: secondsLabel(seconds), seconds, walked: [{ x: pos.x, z: pos.z }, ...ahead.points] };
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
  const [filterPicked, setFilterState] = useState<MapFilter>(() => loadMapFilter());
  const setFilter = useCallback((f: MapFilter) => { setFilterState(f); saveMapFilter(f); }, []);
  // W5-N8 · lane R's events of the next seven days: the 这周 chip (every venue), 全部 shows today's; a remembered 这周 with
  // no event this week is 全部
  const weekPinsAll = useWeekPins();
  const filter: MapFilter = filterPicked === 'week' && !weekPinsAll.length ? 'all' : filterPicked;
  const [evSel, setEvSel] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [legend, setLegend] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<MapView | null>(null);
  // W5-N4 · the phone map (plan MF4): the selection's card pinned over the frame on narrow maps (phones), the "+n"
  // badge's chooser there, and a long-pressed spot (去这里, every device); ≤ 2 taps from the open map to moving
  const compact = !!size && size.w <= COMPACT_W;
  const [press, setPress] = useState<{ at: Vec2; spot: PressSpot | null } | null>(null);
  const [chooser, setChooser] = useState<{ id: string; members: string[] } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const lowerRef = useRef<HTMLDivElement>(null);
  // the long-press timer reads the view of its moment
  const viewRef = useRef<MapView | null>(null);
  useEffect(() => { viewRef.current = view; }, [view]);
  // a new selection (a tap, the list, the search) replaces a pressed spot and the chooser
  useEffect(() => { setMoreOpen(false); if (sel) { setPress(null); setChooser(null); setEvSel(null); } }, [sel?.kind, sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 带我去 in progress (flow.mapTarget = place:<id>) or a trip (lane C's flow.trip): the target pin, the trip's route
  const mapTarget = useFlow(s => s.mapTarget);
  const trip = useFlow(s => s.trip);
  // lane C's arrival moments: an attraction reached gets the gold tick at 4 o'clock (a new arrival repaints the scene)
  const arrivalNow = useFlow(s => s.arrival);
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
        // you, BAYBAY and the target clear of the tool column (the size's own: the column is one or two wide)
        right: toolColumn(size.h),
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
  const tallTools = !!size && size.h >= TALL_TOOLS_H;
  // (a literal, not toolColumn(): the React compiler keeps the memos below only for values it knows are primitives)
  const toolRight = tallTools ? 48 : 90;
  // --- pan / zoom / pinch / tap -----------------------------------------------------------------------------------------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ moved: number; pinch: number | null }>({ moved: 0, pinch: null });
  const local = (e: { clientX: number; clientY: number }) => {
    const r = frameRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  // W5-N4 · long-press → 去这里: held PRESS.ms without moving more than PRESS.slop px, one pointer
  const pressTimer = useRef<{ id: number; fired: boolean } | null>(null);
  const cancelPress = () => { if (pressTimer.current) { window.clearTimeout(pressTimer.current.id); pressTimer.current = pressTimer.current.fired ? pressTimer.current : null; } };
  // (W5-N review) a map closed mid-press (the sheet swiped down, M, Escape) must not fire its long-press afterwards
  useEffect(() => () => { if (pressTimer.current) window.clearTimeout(pressTimer.current.id); }, []);
  const onDown =(e: RPointerEvent<HTMLDivElement>) => {
    if (!mapGestureTarget(e.target)) return;
    if (e.button > 0) return;
    frameRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    drag.current = { moved: 0, pinch: null };
    cancelPress();
    pressTimer.current = null;
    if (pointers.current.size === 1) {
      const at = local(e);
      const t = { id: 0, fired: false };
      t.id = window.setTimeout(() => {
        if (pressTimer.current !== t || drag.current.moved > PRESS.slop || pointers.current.size !== 1) return;
        t.fired = true;
        pressAt(at.x, at.y);
      }, PRESS.ms);
      pressTimer.current = t;
    }
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !view) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size > 1 || drag.current.moved > PRESS.slop) cancelPress();
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
  // CP-2 (the mid-wave checkpoint): a tap that selects lifts the OSM credit over the pinned card, right under the finger,
  // and the touch's compatibility click then opened openstreetmap.org/copyright in a new tab (the game went to the
  // background). A map tap swallows its click (touchend preventDefault), and the credit ignores clicks for a moment
  // after a map gesture.
  const lastMapTap = useRef(-Infinity);
  const onTouchEnd = (e: RTouchEvent<HTMLDivElement>) => {
    if (!mapGestureTarget(e.target)) return;
    lastMapTap.current = e.timeStamp;
    if (!e.cancelable) return;
    e.preventDefault();
    // (no click follows: a focused search field keeps the keyboard up unless it is let go here, as the click would)
    const f = document.activeElement;
    if (f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement) f.blur();
  };
  const onCreditClick = (e: RMouseEvent<HTMLAnchorElement>) => {
    // (event time stamps: the same clock as performance.now())
    if (creditGuarded(e.timeStamp, lastMapTap.current)) e.preventDefault();
  };
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (mapGestureTarget(e.target)) lastMapTap.current = e.timeStamp;
    const had = pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) drag.current.pinch = null;
    const pressed = !!pressTimer.current?.fired;
    cancelPress();
    pressTimer.current = null;
    if (!had || pressed || drag.current.moved > 6 || !view || !scene) return;
    // a tap: the nearest badge / place / station within reach; a "+n" badge zooms in to its members (on a phone: the
    // chooser lists them, each with its go button)
    const p = local(e);
    setPress(null);
    // (W5-N8) an event pin first: they stand over the badges
    const pin = shownPins.reduce<{ key: string; d: number; at: Vec2 } | null>((best, q) => {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      return d <= 18 && (!best || d < best.d) ? { key: q.p.key, d, at: { x: q.p.venue.x, z: q.p.venue.z } } : best;
    }, null);
    if (pin) {
      setSel(null); setChooser(null); setEvSel(pin.key);
      setView(v => (v ? panForCard(v, pin.at) ?? v : v));
      return;
    }
    setEvSel(null);
    const hit = hitTest(scene, p.x, p.y, HIT_PX);
    if (hit?.members?.length && scene.s < 1.2) {
      if (compact) {
        setSel(null);
        setChooser({ id: hit.id, members: hit.members });
        // the badge stays in sight above the chooser
        const at = toWorld(view, p.x, p.y), rows = Math.min(8, 1 + hit.members.length);
        setView(v => (v ? panForCard(v, at, chooserHeight(rows, v.h)) ?? v : v));
        return;
      }
      zoomCluster(hit.id, hit.members);
      return;
    }
    setChooser(null);
    setSel(hit ? { kind: hit.kind, id: hit.id } : null);
    // the pinned card must not cover what was tapped
    if (hit && compact) { const at = toWorld(view, p.x, p.y); setView(v => (v ? panForCard(v, at) ?? v : v)); }
  };
  const zoomCluster = (id: string, members: readonly string[]) => {
    if (!scene) return;
    const pts = clusterPoints(scene, ATTRACTION_BY_ID, id, members);
    setView(v => (v ? fitAbs(v, MAP_FRAME, pts, 56, 0.5, 2.4, toolRight) : v));
  };
  // a right-click is a long-press with the mouse
  const onContextMenu = (e: RMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, .mw-legend-pop, .mw-gocard')) return;
    e.preventDefault();
    const p = local(e);
    pressAt(p.x, p.y);
  };
  /** A long-press at frame pixel (px, py): the nearest walkable arrival spot there, its card over the map. */
  const pressAt = (px: number, py: number) => {
    const v = viewRef.current;
    if (!v) return;
    const at = toWorld(v, px, py);
    setSel(null);
    setChooser(null);
    setEvSel(null);
    // the walking graph is in by now in the city (the street life loads it); a failed load answers without it
    void walkGraph().then(g => g, () => null).then(g => {
      const spot = pressSpot(at, pressLookups(far, ix, g));
      setPress({ at, spot });
      if (spot) setView(cur => (cur ? panForCard(cur, spot) ?? cur : cur));
    });
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
      setView(v => (v ? fitAbs(v, MAP_FRAME, pts, 28, 0.1, 1.2, toolRight) : v));
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
      setView(v => (v ? fitAbs(v, MAP_FRAME, pts, 36, 0.2, 2, toolRight) : v));
    }
  };
  // a pick from the list under the map (search, 景点 · 线路 · 附近 · 去过的, a card's 步行路线 chip): bring the map back into
  // view when the sheet has scrolled past it (integration review: on the phone a highlighted line or a framed place
  // changed nothing you could see — the map sat above the fold)
  const reduced = useGame(st => st.settings.reducedMotion);
  const revealMap = () => {
    const el = frameRef.current, body = el?.closest('.ob-sheet-body') as HTMLElement | null;
    if (!el || !body) return;
    const top = el.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 8;
    if (top < body.scrollTop - 1) body.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
  };
  useEffect(() => {
    if (!openId || !view || openedOn.current === openId) return;
    const on = parseMapPanelId(openId);
    if (!on) return;
    if (on.kind === 'line') { if (!lines.some(l => l.id === on.id)) return; openedOn.current = openId; pickLine(on.id); return; }
    if (on.kind === 'station') {
      // any of the station's stop ids (a merged station holds several)
      const st = stationById.get(on.id) ?? stations.find(s => s.ids.includes(on.id));
      if (st) { openedOn.current = openId; pickStation(st.id); }
      return;
    }
    if (on.kind === 'attraction') { const a = ATTRACTION_INDEX.resolve(on.id); if (a) { openedOn.current = openId; pickAttraction(a); } return; }
    // an id that is no place row: a Grand Tour stop's trip (the trip card's 换个方式), `transit-<stop>`, `sf:<id>`
    const alt = !ix?.get(on.id) ? mapOpenFallback(on.id, stations, trip) : null;
    if (alt) {
      openedOn.current = openId;
      if (alt.kind === 'station') pickStation(alt.id);
      else { const a = ATTRACTION_INDEX.get(alt.id); if (a) pickAttraction(a); }
      return;
    }
    if (!ix) return;
    const p = ix.get(on.id);
    if (!p) return;
    openedOn.current = openId;
    pickPlace(p);
  }, [openId, ix, view, lines, stationById, stations, trip?.placeId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // (a Grand Tour stop's trip names its stop's interactable: its attraction selected is the trip's destination too)
  const tripHere = !!trip && ((!!dest?.placeId && trip.placeId === dest.placeId) || (!!trip.attraction && !!selAttraction && ATTRACTION_INDEX.resolve(trip.attraction)?.id === selAttraction.id)
    || (!!selStation && selStation.ids.some(id => trip.placeId === id || trip.placeId === `transit-${id}`)));
  const plan = useRoutePlan(tripHere ? null : dest, pos);
  const onTrip = tripHere || (!!dest?.placeId && dest.placeId === tripId);
  const left = useMemo(() => (plan?.route ? routeLeft(plan.route, pos) : null), [plan, pos]);
  // W5-N2 · one ETA source: the planner's 推荐 (the card's go button). A walk keeps the route's own live time (the same
  // auto-travel pace); another way (the pelican, a bike, a line) puts its words and time on the pin: "飞过去 约 7 秒"
  const planDest = useMemo(() => (dest?.placeId && !tripHere ? { placeId: dest.placeId, x: dest.to.x, z: dest.to.z, name: dest.name, ...(selAttraction ? { attraction: selAttraction.id } : {}) } : null), [dest, tripHere, selAttraction]);
  const { options: planned } = useTripOptions(planDest);
  const recWay = planned.find(o => o.recommended) ?? null;
  const routeDraw = useMemo(() => {
    if (!view || !left || left.points.length < 2) return null;
    const pts = thinPx(left.points.map(p => toPx(view, p.x, p.z)));
    const end = pts[pts.length - 1];
    const other = recWay && recWay.mode !== 'walk' && recWay.mode !== 'run' ? recWay : null;
    const chip = other ? `${t(optionTitle(other))} ${t(tripSecondsLabel(other.seconds))}` : t(left.time);
    const cw = labelWidth(chip, 11) + 16;
    return { pts: pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '), end, chip, cw };
  }, [view, left, t, recWay]);
  // a walking route (data/sf/routes.ts, the 线路 tab's 步行路线): its walk and numbered stops over the dimmed lines; a stop
  // an attraction badge stands for wears its number on the badge (gold, at 10 o'clock), the others get a disc on the walk
  const walkId = highlight?.startsWith('route:') ? (highlight.slice(6) as SfRouteId) : null;
  const walk = useMemo(() => {
    const r = walkId ? sfRoute(walkId) : undefined, p = walkId ? routePath(walkId) : undefined;
    if (!r || !p) return null;
    const stops = r.stops.map((st, i) => ({ x: st.x, z: st.z, n: i + 1, attraction: (st.attraction ? ATTRACTION_INDEX.resolve(st.attraction) : st.placeId ? ATTRACTION_INDEX.primary(st.placeId) : undefined)?.id ?? null }));
    return { xz: p.points, stops, numbers: new Map(stops.filter(st => st.attraction).map(st => [st.attraction!, st.n])) };
  }, [walkId]);
  // the trip strip: where lane C's trip goes (its last leg's point name, else the place / attraction)
  const tripName: Bilingual | null = !trip ? null : trip.legs[trip.legs.length - 1]?.to.name ?? (trip.attraction ? ATTRACTION_INDEX.resolve(trip.attraction)?.name : undefined) ?? ix?.get(trip.placeId)?.name ?? null;
  // the trip's ETA chip at its destination (plan §4.1): "市政厅 · 步行 约 2 分钟"
  const tripChip = useMemo(() => {
    if (!trip || !view) return null;
    const end = trip.legs[trip.legs.length - 1]?.to;
    if (!end) return null;
    const [x, y] = toPx(view, end.x, end.z);
    if (x < -40 || y < -40 || x > view.w + 40 || y > view.h + 40) return null;
    const eta = tripEta(trip);
    const text = t({ zh: `${tripName?.zh ?? ''} · ${eta.zh}`, en: `${tripName?.en ?? ''} · ${eta.en}` });
    // kept inside the frame (clear of the tool column and the credit line): the target may sit at its edge
    const cw = labelWidth(text, 11) + 16;
    return { x: Math.min(view.w - toolRight - cw / 2 - 4, Math.max(cw / 2 + 4, x)), y: Math.min(view.h - 52, Math.max(8, y)), text, cw };
  }, [trip, view, tripName, t, toolRight]);
  // the scene (after the route and the trip: their time chips are boxes the labels keep off — the trip's covered the
  // target's own name, integration review)
  const scene = useMemo(() => {
    if (!view) return null;
    const obstacles = [
      ...rides.map(r => ({ x: r.x, y: r.y, r: 8 })), ...(youAt ? [{ x: youAt[0], y: youAt[1], r: 10 }] : []), ...(guideAt ? [{ x: guideAt[0], y: guideAt[1], r: 12 }] : []), { x: 26, y: 26, r: 18 },
      ...(routeDraw ? [{ x: routeDraw.end[0], y: routeDraw.end[1] + 22, r: 10, hw: routeDraw.cw / 2, hh: 10 }] : []),
      ...(tripChip ? [{ x: tripChip.x, y: tripChip.y + 22, r: 10, hw: tripChip.cw / 2, hh: 10 }] : []),
      // (W5-N8) the event pins: the labels keep off them
      ...pinsFor(filter, weekPinsAll).map(p => { const [x, y] = toPx(view, p.venue.x, p.venue.z); return { x, y, r: 13 }; }),
    ];
    return buildScene({
      view, attractions: ATTRACTIONS, places: ix?.list ?? null, covered, stations, termini, zones: visitedZones,
      discovered: isDiscovered, arrived: arrivalSeen, selected: sel, target, tourNext, stops: walk?.numbers ?? null, filter, highlight, stickers, locale: loc, t, maxNodes: coarse ? 120 : 150, obstacles, toolRight,
    });
  }, [view, ix, covered, stations, termini, visitedZones, sel, target, tourNext, filter, highlight, stickers, loc, t, coarse, rides, youAt?.[0], youAt?.[1], guideAt?.[0], guideAt?.[1], toolRight, epoch, routeDraw, tripChip, arrivalNow, walk, weekPinsAll]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- the canvas: base map, lines, the trip route, station marks (one rAF per change) ------------------------------------
  const routeStrokes = useMemo(() => (trip ? tripRouteStrokes(trip.legs, trip.leg) : null), [trip]);
  // what the canvas draws of the scene, by content: you and BAYBAY moving re-lay the labels (10 Hz while you walk with
  // the map open) but move no station mark or dot, so the base map is not redrawn for them (integration review)
  const canvasKey = scene ? canvasMarksKey(scene, !!walk) : '';
  const marks = useMemo(() => (scene ? { stations: scene.stations, dots: scene.canvasDots, onBadge: new Set(scene.layout.kept.map(kk => kk.id)) } : null), [canvasKey]); // eslint-disable-line react-hooks/exhaustive-deps
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
      // the stops whose badge is on the map wear their number there
      const walkDraw = walk ? { xz: walk.xz, stops: walk.stops.filter(st => !st.attraction || !marks?.onBadge.has(st.attraction)) } : null;
      drawMapExtras(ctx as unknown as StationCtx, view, { route: routeStrokes, walk: walkDraw, stations: marks?.stations ?? [], stationAlpha: highlight ? 0.85 : 1, dots: marks?.dots ?? [] });
    });
    return () => cancelAnimationFrame(id);
  }, [view, far, lines, epoch, highlight, filter, routeStrokes, walk, marks]);

  // the map opened on a trip: frame you and the whole way once the route is known
  const framedTrip = useRef(false);
  useEffect(() => {
    if (framedTrip.current || !onTrip || !plan?.route) return;
    framedTrip.current = true;
    const route = plan.route;
    setView(v => (v ? fitAbs(v, MAP_FRAME, [{ x: runtime.player.x, z: runtime.player.z }, ...route.points], 44, 0.25, 2, toolRight) : v));
  }, [onTrip, plan, toolRight]);
  const showRoute = () => {
    const route = plan?.route;
    const pts: Vec2[] = route ? routeAhead(route.points, runtime.player).points : trip ? trip.legs.flatMap(l => [l.from, l.to]) : [];
    if (pts.length) setView(v => (v ? fitAbs(v, MAP_FRAME, [{ x: runtime.player.x, z: runtime.player.z }, ...pts], 44, 0.2, 2, toolRight) : v));
  };
  // lane C's trip to the selection: the card's 换个方式 changes its way (the trip card's 换个方式 opens the map on its
  // destination: the list starts open then)
  const changeWay = (o: TripOption) => { replanTrip(o); closePanel(); };
  const openedToChange = tripHere && !!trip && !!openId && parseMapPanelId(openId)?.id === trip.placeId;
  // the ways are planned to where the running trip ends (a Grand Tour stop: its bus stop, not the attraction's arrival)
  const tripEnd = trip ? trip.legs[trip.legs.length - 1]?.to : undefined;
  const changeTo = useMemo((): PlaceTripDest | null => (trip && tripEnd ? {
    placeId: trip.placeId, x: tripEnd.x, z: tripEnd.z, ...(tripName ? { name: tripName } : {}), ...(trip.attraction ? { attraction: trip.attraction } : {}),
  } : null), [trip, tripEnd, tripName]);
  const walkInfo: WalkInfo | null = !plan ? null : plan.status === 'pending' ? { state: 'pending' } : plan.status === 'none' || !plan.route ? { state: 'none' } : { state: 'ok', label: routeTravelLabel(left?.walked ?? plan.route.points) };

  const heading = runtime.player.heading;
  const vis = view ? { x: view.cx - view.w / 2 / view.scale, z: view.cz - view.h / 2 / view.scale, w: view.w / view.scale, h: view.h / view.scale } : null;
  const s = view?.scale ?? 0;
  // the paper leaves the DOM once the vector base covers it (decoded papers come back at once when you zoom out)
  const showPaper = !!MAP_PAPER && paperShare(s) > 0;
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const atMax = !!view && view.scale >= maxScale(MAP_FRAME, view.w, view.h) - 1e-6;
  const leading = !!useFlow(st => st.freeLead) || !!trip || !!tripId;

  // --- W5-N4 · the pinned card (phones), the "+n" chooser, the long-pressed spot ----------------------------------------
  const pressDest = useMemo((): PlaceTripDest | null => (press?.spot ? { placeId: pressPlaceId(press.spot), x: press.spot.x, z: press.spot.z, name: press.spot.name } : null), [press]);
  const { options: pressWays, busy: pressBusy } = useTripOptions(pressDest);
  const pressRec = pressWays.find(o => o.recommended) ?? pressWays[0] ?? null;
  const selName: Bilingual | null = selAttraction?.name ?? selPlace?.name ?? selStation?.name ?? null;
  // the selection's card over the map on a phone (a running trip to it keeps the card under the map: its 换个方式)
  const cardSel = compact && !!selName && !onTrip && !press && !chooser;
  const selZone = selPlace ? landmarkAreaAt(selPlace.x, selPlace.z)?.name ?? (selPlace.zone ? zoneName(selPlace.zone) : null) : null;
  const selMeta = [selZone ? t(selZone) : null, selStation ? t('车站', 'Station') : null, selPlace && isDiscovered(selPlace.id) ? t('去过', 'visited') : null].filter(Boolean).join(' · ') || null;
  const chooserRows = useMemo((): ChooserRow[] => {
    if (!chooser) return [];
    const out: ChooserRow[] = [];
    // the layout's ids: an attraction's own, `place:<id>` for a place row (cityMapModel placeLayoutId)
    for (const m of [chooser.id, ...chooser.members]) {
      const a = ATTRACTION_BY_ID.get(m);
      if (a) {
        const d = tripDestination(a);
        out.push({ key: `a:${a.id}`, placeId: d.placeId, x: d.x, z: d.z, name: a.name, attraction: a.id, sub: isDiscovered(a.placeId ?? a.id) ? t('去过', 'visited') : null });
        continue;
      }
      const pl = m.startsWith('place:') ? ix?.get(m.slice(6)) : undefined;
      if (pl) out.push({ key: `p:${pl.id}`, placeId: pl.id, x: pl.arrival.x, z: pl.arrival.z, name: pl.name, sub: isDiscovered(pl.id) ? t('去过', 'visited') : null });
    }
    return out.slice(0, 8);
  }, [chooser, ix, t]);
  const chooserWays = useQuickWays(chooserRows, chooserRows.length);
  const pickRow = (r: ChooserRow) => {
    setChooser(null);
    setSel(r.attraction ? { kind: 'attraction', id: r.attraction } : { kind: 'place', id: r.placeId });
    setView(v => (v ? panForCard(v, { x: r.x, z: r.z }) ?? v : v));
  };
  // --- W5-N8 · lane R's event pins (这周 / today's under 全部) and the selected pin's card --------------------------------
  // (a handful: laid out every render, no memo)
  const shownPins = !view ? [] : pinsFor(filter, weekPinsAll)
    .map(p => { const [x, y] = toPx(view, p.venue.x, p.venue.z); return { p, x, y }; })
    .filter(q => q.x > -14 && q.y > -14 && q.x < view.w + 14 && q.y < view.h + 14);
  const evPin = evSel ? weekPinsAll.find(p => p.key === evSel) ?? null : null;
  const evFirst = evPin?.events[0] ?? null;
  const evDest = useMemo((): PlaceTripDest | null => (evPin && evFirst ? { placeId: evPin.venue.placeId ?? `event:${evFirst.id}`, x: evPin.venue.x, z: evPin.venue.z, name: evPin.venue.name } : null), [evPin?.key, evFirst?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const { options: evWays, busy: evBusy } = useTripOptions(evDest);
  const evRec = evWays.find(o => o.recommended) ?? evWays[0] ?? null;
  const evMeta = evPin && evFirst
    ? [t(evFirst.when), t(evPin.venue.name), evPin.events.length > 1 ? t({ zh: `另有 ${evPin.events.length - 1} 个活动`, en: `+${evPin.events.length - 1} more` }) : null].filter(Boolean).join(' · ')
    : null;
  // (W5-N review) picking 这周 frames the week's venues and you, clear of the tool column (the view stayed where it was:
  // near the player the pins sat outside the frame or under the zoom buttons)
  const pickFilter = (f: MapFilter) => {
    setFilter(f);
    if (f !== 'week' || f === filter) return;
    const pts = weekFitPoints(weekPinsAll, { x: runtime.player.x, z: runtime.player.z });
    if (pts.length) setView(v => (v ? fitAbs(v, MAP_FRAME, pts, 36, 0.1, 1.2, toolRight) : v));
  };
  const pinned = cardSel || !!press || !!evPin;
  const cardH = size ? goCardHeight(size.h) : 0;
  const showMore = () => {
    setMoreOpen(true);
    window.setTimeout(() => lowerRef.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }), 40);
  };

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
      <div ref={frameRef} className={`ob-citymap-frame${pinned ? ' has-gocard' : ''}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onTouchEnd={onTouchEnd} onContextMenu={onContextMenu}
        role="application" aria-label={t('旧金山地图：拖动平移，滚轮或双指缩放，长按任意位置去那里', 'Map of San Francisco: drag to pan, wheel or pinch to zoom, long-press anywhere to go there')}>
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
            {shownPins.map(({ p, x, y }) => (
              <g key={p.key} className={`mw-evpin${p.live ? ' is-live' : ''}${evSel === p.key ? ' is-on' : ''}`} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
                {p.live && <circle className="mw-evpin-pulse" r={12} />}
                <circle className="mw-evpin-disc" r={11} />
                <CalendarDays x={-6.5} y={-6.5} width={13} height={13} strokeWidth={2.4} className="mw-evpin-ico" />
                {p.events.length > 1 && <><circle className="mw-evpin-n" cx={9} cy={-9} r={6.5} /><text className="mw-evpin-nt" x={9} y={-6.3}>{p.events.length}</text></>}
              </g>
            ))}
            {press?.spot && (() => { const [x, y] = toPx(view, press.spot.x, press.spot.z); return <MapTargetPin x={x} y={y} />; })()}
            {youAt && (() => {
              // heading (three.js yaw: forward = (sin h, cos h) in world x/z = screen x/y)
              const deg = (Math.atan2(Math.cos(heading), Math.sin(heading)) * 180) / Math.PI;
              return <g className="cm-you" transform={`translate(${youAt[0]},${youAt[1]}) rotate(${deg})`}><circle r={9} /><path d="M-4 -4 L6 0 L-4 4 Z" /></g>;
            })()}
          </svg>
        )}
        {!far && <p className="ob-citymap-wait">{t('地图铺开中…', 'Unfolding the map…')}</p>}
        <button type="button" className="mw-compass" onClick={() => toast({ zh: '地图按游戏方向摆放，北在左上', en: 'The map follows the game view: north is up-left' }, 'info', 2800)}
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
        <div className={`ob-citymap-tools${tallTools ? '' : ' is-two'}${chooser ? ' is-hidden' : ''}`} style={pinned && size ? { maxHeight: toolsMaxHeight(size.h, true) } : undefined}>
          <button type="button" className="ob-icon-btn" onClick={() => zoomBy(1.6)} aria-label={t('放大', 'Zoom in')} disabled={atMax}><Plus size={17} aria-hidden /></button>
          <button type="button" className="ob-icon-btn" onClick={() => zoomBy(1 / 1.6)} aria-label={t('缩小', 'Zoom out')}><Minus size={17} aria-hidden /></button>
          <button type="button" className="ob-icon-btn" onClick={locate} aria-label={t('回到我这', 'Find me')}><LocateFixed size={17} aria-hidden /></button>
          <button type="button" className="ob-icon-btn" onClick={fitCity} aria-label={t('全城', 'Whole city')}><Maximize2 size={16} aria-hidden /></button>
          {(plan?.route || trip) && <button type="button" className="ob-icon-btn" onClick={showRoute} aria-label={t('看整条路线', 'Show the whole route')}><RouteIcon size={16} aria-hidden /></button>}
          <button type="button" className={`ob-icon-btn${legend ? ' is-on' : ''}`} onClick={() => setLegend(v => !v)} aria-label={t('图例', 'Legend')} aria-pressed={legend}><Info size={17} aria-hidden /></button>
        </div>
        {legend && <div className="mw-legend-pop"><MapLegend onClose={() => setLegend(false)} /></div>}
        <p className={`ob-citymap-credit${chooser ? ' is-hidden' : ''}`} style={pinned ? { bottom: cardH + 14 } : undefined}>{t('地图数据', 'Map data')} © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" onClick={onCreditClick}>OpenStreetMap</a> {t('贡献者', 'contributors')} (ODbL) · DataSF</p>
        {cardSel && selName && (
          <MapGoCard title={selName} meta={selMeta} option={recWay} busy={!!planDest && !recWay} short={!!size && size.h < 340}
            onGo={o => { if (planDest) startPlaceTrip(o, planDest); }} onMore={showMore} onClose={() => setSel(null)} />
        )}
        {press && (
          <MapGoCard title={{ zh: '去这里', en: 'Go here' }} meta={press.spot ? t(press.spot.name) : null} option={press.spot ? pressRec : null} busy={!!press.spot && pressBusy && !pressRec}
            short={!!size && size.h < 340} noWay={{ zh: '那里去不了，长按陆地试试', en: "Can't go there — press on land" }}
            onGo={o => { if (pressDest) startPlaceTrip(o, pressDest); }} onClose={() => setPress(null)} />
        )}
        {evPin && evFirst && !press && (
          <MapGoCard title={{ zh: evFirst.title, en: evFirst.title }} meta={evMeta} option={evRec} busy={evBusy && !evRec} short={!!size && size.h < 340}
            onGo={o => { if (evDest) startPlaceTrip(o, evDest); }} onMore={() => openEvent(evFirst.id)} more="info" onClose={() => setEvSel(null)} />
        )}
        {chooser && chooserRows.length > 0 && (
          <ClusterChooser rows={chooserRows} ways={chooserWays} onPick={pickRow} onZoom={() => { const c = chooser; setChooser(null); zoomCluster(c.id, c.members); }} onClose={() => setChooser(null)} />
        )}
      </div>

      <MapFilters value={filter} onChange={pickFilter} week={weekPinsAll.length} />

      <div ref={lowerRef} className="mw-lower">
        {selPlace && <PlaceActions place={selPlace} attraction={selAttraction} walk={walkInfo} onTrip={onTrip} tripTime={tripHere && trip ? tripEta(trip) : null} hideGo={cardSel}
          onReplan={tripHere ? changeWay : null} changeTo={tripHere ? changeTo : null} tripMode={tripHere && trip ? optionWay(trip.option) : null} startOpen={openedToChange || moreOpen} onRoute={id => { pickRoute(id); revealMap(); }} />}
        {selStation && (
          <StationPanel station={selStation} lines={lines} pos={pos} walk={walkInfo} routeSeconds={left?.seconds ?? null} placeId={dest?.placeId ?? null}
            change={tripHere && trip && changeTo ? { to: changeTo, tripTime: tripEta(trip), tripMode: trip.option.mode, startOpen: openedToChange, onPick: changeWay } : null} />
        )}
      </div>

      <CityMapList
        ix={ix} lines={lines} stations={stations} pos={pos} query={query} setQuery={setQuery} tab={tab} setTab={setTab} selected={sel} highlight={highlight} epoch={epoch}
        onAttraction={a => { pickAttraction(a); revealMap(); }} onPlace={p => { pickPlace(p); revealMap(); }} onStation={st => { pickStation(st.id); revealMap(); }}
        onLine={id => { pickLine(id); revealMap(); }} onRoute={id => { pickRoute(id); revealMap(); }}
      />
    </Sheet>
  );
}
