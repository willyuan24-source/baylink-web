import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Bike, Car, Landmark, LocateFixed, Maximize2, Minus, Navigation, Plus, Route as RouteIcon, Search, X } from 'lucide-react';
import { fleetSnapshot } from '../actors/moveApi';
import { runtime } from '../core/runtime';
import { useGame } from '../core/store';
import type { Bilingual, Vec2 } from '../core/types';
import { MAP_FRAME, MAP_PAPER } from '../data/mapPaper';
import { landmarkAreaAt, learnZoneNames, zoneLabelAnchor, zoneName } from '../data/cityZones';
import { type CityPlace, type PlaceIndex, loadPlaces, onPlaces, placeIndex } from '../data/sf/places';
import { onTransitData, transitData } from '../data/transit';
import { vehicleSpots } from '../data/vehicles';
import { isDiscovered, useDiscoveryEpoch, zoneVisited } from '../game/discovery';
import { closePanel } from '../game/flow';
import { useFlow } from '../game/flowStore';
import { type PlannedRoute, REPLAN_U, cachedRoute, cancelPlan, endTrip, planRoute, tripPlaceId } from '../game/mapRoute';
import { autoWalkSeconds, routeAhead, routeTravelLabel, secondsLabel } from '../game/travel';
import { useT } from '../i18n';
import { cityStreamerLazy } from '../world/cityLoader';
import type { FarData } from '../world/sf/format';
import { type LabelItem, type LabelObstacle, type MapView, MAX_ZOOM, clampView, drawCityMap, fitPoints, fitScale, labelWidth, layoutLabels, thinPx, toPx, zoomAt } from './cityMapDraw';
import { BaybayFace, Sheet } from './common';
import { MapPaperLayer } from './MapPaperLayer';
import { PlaceActions, type WalkInfo } from './PlaceActions';
import './city-ui.css';

/**
 * The whole-city map (lane G1, G1-5 / G1-6): far.obc on a canvas (ui/cityMapDraw.ts), H2b's painted paper under it
 * (<MapPaperLayer/> in a world-space SVG, empty until the paper lands), and a screen-space SVG on top with the
 * landmarks, places, neighbourhood names, BAYBAY and you. Drag to pan, wheel / pinch / buttons to zoom (0.8–18×), tap a
 * marker to select it; the list below searches every place (zh / en). Unvisited neighbourhoods stay under paper fog.
 */

const MAX_DPR = 2;
const MAX_CANVAS = 1800;
const HIT_PX = 22;
/** screen boxes labels keep clear of: the tool column (4 buttons of 34 px + gaps, city-ui.css) and the credit line */
const TOOLS_W = 48, TOOLS_H = 172, TOOL_STEP = 40, CREDIT_H = 20;

/** far.obc once the streamer has it; the neighbourhood names are learned before the first render that uses it. */
function useFar(): FarData | null {
  const [far, setFar] = useState<FarData | null>(() => { const f = cityStreamerLazy()?.far ?? null; if (f) learnZoneNames(f.zones); return f; });
  useEffect(() => {
    if (far) return;
    const id = window.setInterval(() => { const f = cityStreamerLazy()?.far; if (f) { learnZoneNames(f.zones); setFar(f); } }, 400);
    return () => window.clearInterval(id);
  }, [far]);
  return far;
}

function usePlaces(): PlaceIndex | null {
  const [ix, setIx] = useState<PlaceIndex | null>(() => placeIndex());
  useEffect(() => { void loadPlaces(); return onPlaces(setIx); }, []);
  return ix;
}

function useTransitLines() {
  const [d, setD] = useState(() => transitData());
  useEffect(() => onTransitData(setD), []);
  return useMemo(() => (d ? d.lines.map(l => ({ xyz: l.xyz, color: l.color })) : []), [d]);
}

/** The selected place's walking route (G1-8): pending while E2's time-sliced A* runs, then the route or 'none'. */
interface RoutePlan { id: string; status: 'pending' | 'ok' | 'none'; route: PlannedRoute | null }

function useRoutePlan(place: CityPlace | null, pos: Vec2): RoutePlan | null {
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const id = place?.walkable ? place.id : null;
  const to = place?.walkable ? place.arrival : null;
  // the player walked away from where the plan started (desktop: the map does not stop you): plan again from here
  const stale = !!plan?.route && plan.id === id && Math.hypot(plan.route.from.x - pos.x, plan.route.from.z - pos.z) > REPLAN_U;
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

/** "约 3 分钟" of auto-walk left on a route for someone at pos, and that route's remaining polyline. */
function routeLeft(route: PlannedRoute, pos: Vec2): { points: Vec2[]; time: Bilingual } {
  const ahead = routeAhead(route.points, pos);
  return { points: ahead.points, time: secondsLabel(autoWalkSeconds(ahead.length)) };
}

type Tab = 'landmarks' | 'near' | 'found';

export function CityMapPanel() {
  const { t } = useT();
  const far = useFar();
  const ix = usePlaces();
  const lines = useTransitLines();
  const epoch = useDiscoveryEpoch();
  const pos = useGame(s => s.playerPos);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('landmarks');
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 520, h: 360 });
  const [view, setView] = useState<MapView | null>(null);
  // 带我去 in progress (flow.mapTarget = place:<id>): the map opens on it, selected, with the route still ahead
  const tripId = tripPlaceId(useFlow(s => s.mapTarget));
  const tripPlace = tripId && ix ? ix.get(tripId) ?? null : null;
  const openedOnTrip = useRef(false);
  useEffect(() => {
    if (openedOnTrip.current || !tripPlace) return;
    openedOnTrip.current = true;
    setSelected(s => s ?? tripPlace.id);
  }, [tripPlace]);

  // size: follow the frame; the first view shows your part of the city at 3× (street names are for the HUD)
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => setSize({ w: Math.max(200, el.clientWidth), h: Math.max(200, el.clientHeight) });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    setView(v => {
      const base = v ?? { cx: runtime.player.x, cz: runtime.player.z, scale: fitScale(MAP_FRAME, size.w, size.h) * 3, w: size.w, h: size.h };
      return clampView({ ...base, w: size.w, h: size.h }, MAP_FRAME);
    });
  }, [size.w, size.h]);

  // draw (one rAF per change)
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
      drawCityMap(ctx, { far, visited: zoneVisited, transit: lines, paper: !!MAP_PAPER }, view);
    });
    return () => cancelAnimationFrame(id);
  }, [view, far, lines, epoch]);

  // --- pan / zoom / pinch -------------------------------------------------------------------------------------------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ moved: number; pinch: number | null }>({ moved: 0, pinch: null });
  const local = (e: { clientX: number; clientY: number }) => {
    const r = frameRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
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
    if (!had || drag.current.moved > 6 || !view) return;
    // a tap: the nearest marker within reach
    const p = local(e);
    let best: string | null = null, bestD = HIT_PX;
    for (const m of markers) {
      const [x, y] = toPx(view, m.p.x, m.p.z);
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < bestD) { bestD = d; best = m.p.id; }
    }
    setSelected(best);
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
  const fit = () => setView(v => (v ? clampView({ ...v, cx: (MAP_FRAME.minX + MAP_FRAME.maxX) / 2, cz: (MAP_FRAME.minZ + MAP_FRAME.maxZ) / 2, scale: fitScale(MAP_FRAME, v.w, v.h) }, MAP_FRAME) : v));
  const locate = () => setView(v => (v ? clampView({ ...v, cx: runtime.player.x, cz: runtime.player.z, scale: Math.max(v.scale, fitScale(MAP_FRAME, v.w, v.h) * 6) }, MAP_FRAME) : v));
  const focusPlace = (p: CityPlace) => {
    setSelected(p.id);
    setView(v => (v ? clampView({ ...v, cx: p.x, cz: p.z, scale: Math.max(v.scale, fitScale(MAP_FRAME, v.w, v.h) * 5) }, MAP_FRAME) : v));
  };

  // --- markers ------------------------------------------------------------------------------------------------------
  const zoom = view ? view.scale / fitScale(MAP_FRAME, view.w, view.h) : 1;
  const markers = useMemo(() => {
    if (!ix || !view) return [] as { p: CityPlace; kind: 'lm' | 'curated' | 'place' }[];
    const out: { p: CityPlace; kind: 'lm' | 'curated' | 'place' }[] = [];
    const pad = 20;
    for (const p of ix.list) {
      const kind = p.landmark ? 'lm' : p.curated ? 'curated' : 'place';
      if (kind === 'curated' && zoom < 2.2) continue;
      if (kind === 'place' && (zoom < 5 || !isDiscovered(p.id))) continue;
      const [x, y] = toPx(view, p.x, p.z);
      if (x < -pad || y < -pad || x > view.w + pad || y > view.h + pad) continue;
      out.push({ p, kind });
    }
    return out;
  }, [ix, view, zoom, epoch]); // eslint-disable-line react-hooks/exhaustive-deps
  const zoneLabels = useMemo(() => (far ? far.zones.map(z => ({ id: z.id, at: zoneLabelAnchor(z) })).filter(z => z.at) : []), [far]);
  const sel = selected && ix ? ix.get(selected) ?? null : null;

  // --- G1-8 layers: the selected place's walking route (gold while 带我去 is on) with its time chip, rideables, BAYBAY
  const plan = useRoutePlan(sel, pos);
  const onTrip = !!sel && sel.id === tripId;
  const left = useMemo(() => (plan?.route ? routeLeft(plan.route, pos) : null), [plan, pos]);
  const routeDraw = useMemo(() => {
    if (!view || !left || left.points.length < 2) return null;
    const pts = thinPx(left.points.map(p => toPx(view, p.x, p.z)));
    const end = pts[pts.length - 1];
    const chip = t(left.time);
    const cw = labelWidth(chip, 11) + 16;
    return { pts: pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '), end, chip, cw, box: [end[0] - cw / 2, end[1] + 12, end[0] + cw / 2, end[1] + 32] as const };
  }, [view, left, t]);
  // the map opened on a trip: frame you and the whole way once the route is known
  const framedTrip = useRef(false);
  useEffect(() => {
    if (framedTrip.current || !onTrip || !plan?.route) return;
    framedTrip.current = true;
    const route = plan.route;
    setView(v => (v ? fitPoints(v, MAP_FRAME, [{ x: runtime.player.x, z: runtime.player.z }, ...route.points], 44) : v));
  }, [onTrip, plan]);
  const showRoute = () => { const route = plan?.route; if (route) setView(v => (v ? fitPoints(v, MAP_FRAME, [{ x: runtime.player.x, z: runtime.player.z }, ...routeAhead(route.points, runtime.player).points], 44) : v)); };
  // parked bikes and the toy car (their spots, or where you left them: E2's fleet snapshot), from 2.5× in
  const rides = useMemo(() => {
    if (!view || zoom < 2.5) return [] as { id: string; kind: 'bike' | 'car'; x: number; y: number }[];
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
  }, [view, zoom, pos]);
  const guideAt = view ? toPx(view, runtime.guide.x, runtime.guide.z) : null;
  const youAt = view ? toPx(view, pos.x, pos.z) : null;
  const toolsH = TOOLS_H + (plan?.route ? TOOL_STEP : 0);

  // labels: the selected place first, then landmarks, curated places (zoomed in), then neighbourhood names. A marker's
  // label sits above, right, left or below its own badge (never dropped for touching it: the wave-2 bug hid them all)
  const labels = useMemo(() => {
    if (!view) return [] as { id: string; text: string; zone: boolean; x: number; y: number; anchor: 'middle' | 'start' | 'end' }[];
    const items: LabelItem[] = [];
    const obstacles: LabelObstacle[] = [];
    for (const { p, kind } of markers) {
      const [x, y] = toPx(view, p.x, p.z);
      const r = kind === 'lm' ? 10 : kind === 'curated' ? 5 : 3.5;
      obstacles.push({ id: p.id, x, y, r });
      const prio = p.id === selected ? 0 : kind === 'lm' ? (isDiscovered(p.id) ? 1 : 2) : kind === 'curated' ? 3 : 4;
      // the whole city: discovered landmarks only; zoomed in: every landmark, then curated places, then the rest
      const want = prio === 0 || (prio === 1 && zoom > 1.6) || (prio === 2 && zoom > 2.4) || (kind === 'curated' && zoom > 4) || zoom > 9;
      if (want) items.push({ id: p.id, x, y, r, text: t(p.name), prio, over: prio === 0 });
    }
    if (zoom < 7) for (const z of zoneLabels) {
      if (!zoneVisited(z.id)) continue;
      const [x, y] = toPx(view, z.at!.x, z.at!.z);
      items.push({ id: `zone:${z.id}`, x, y: y + 4, text: t(zoneName(z.id)), prio: 5, fontPx: 11 });
    }
    // you, BAYBAY and the rideables are markers too
    for (const r of rides) obstacles.push({ x: r.x, y: r.y, r: 8 });
    if (youAt) obstacles.push({ x: youAt[0], y: youAt[1], r: 10 });
    if (guideAt) obstacles.push({ x: guideAt[0], y: guideAt[1], r: 11 });
    // keep clear of the zoom / locate / fit column (top right), the ODbL credit line (bottom) and the route's time chip
    const reserved: (readonly [number, number, number, number])[] = [[view.w - TOOLS_W, 0, view.w, toolsH], [0, view.h - CREDIT_H, view.w, view.h]];
    if (routeDraw) reserved.push(routeDraw.box);
    const placed = layoutLabels(items, view.w, view.h, 3, obstacles, reserved);
    return items.flatMap(it => { const s = placed.get(it.id); return s ? [{ id: it.id, text: it.text, zone: it.id.startsWith('zone:'), ...s }] : []; });
  }, [markers, view, zoom, zoneLabels, selected, t, epoch, rides, routeDraw, toolsH, youAt?.[0], youAt?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- list ---------------------------------------------------------------------------------------------------------
  const list = useMemo(() => {
    if (!ix) return [];
    if (query.trim()) return ix.search(query, 24);
    if (tab === 'landmarks') return ix.list.filter(p => p.landmark).sort((a, b) => Math.hypot(a.x - pos.x, a.z - pos.z) - Math.hypot(b.x - pos.x, b.z - pos.z));
    if (tab === 'near') return ix.near(pos.x, pos.z, 320).filter(p => p.curated || isDiscovered(p.id)).slice(0, 24);
    return ix.list.filter(p => isDiscovered(p.id)).slice(-40).reverse();
  }, [ix, query, tab, pos.x, pos.z, epoch]); // eslint-disable-line react-hooks/exhaustive-deps

  const heading = runtime.player.heading;
  const vis = view ? { x: view.cx - view.w / 2 / view.scale, z: view.cz - view.h / 2 / view.scale, w: view.w / view.scale, h: view.h / view.scale } : null;
  const walk: WalkInfo | null = !plan ? null : plan.status === 'pending' ? { state: 'pending' } : plan.status === 'none' || !plan.route ? { state: 'none' } : { state: 'ok', label: routeTravelLabel(left?.points ?? plan.route.points) };

  return (
    <Sheet eyebrow={t('地图', 'Map')} title={t('旧金山', 'San Francisco')} onClose={closePanel} className="ob-map ob-citymap" wide snap={78}>
      {tripPlace && (
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
        {vis && <svg className="ob-citymap-paper" viewBox={`${vis.x} ${vis.z} ${vis.w} ${vis.h}`} preserveAspectRatio="none" aria-hidden><MapPaperLayer width={zoom > 4 ? 4096 : 2048} /></svg>}
        <canvas ref={canvasRef} className="ob-citymap-canvas" style={{ width: size.w, height: size.h }} aria-hidden />
        {guideAt && guideAt[0] > -12 && guideAt[1] > -12 && guideAt[0] < size.w + 12 && guideAt[1] < size.h + 12 && (
          <span className="cm-baybay-face" style={{ transform: `translate(${(guideAt[0] - 11).toFixed(1)}px, ${(guideAt[1] - 11).toFixed(1)}px)` }} aria-hidden><BaybayFace size={22} /></span>
        )}
        {view && (
          <svg className="ob-citymap-overlay" width={view.w} height={view.h} aria-hidden>
            {labels.map(l => (l.zone ? <text key={l.id} x={l.x} y={l.y} className="cm-zone">{l.text}</text> : null))}
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
            {markers.map(({ p, kind }) => {
              const [x, y] = toPx(view, p.x, p.z);
              const found = isDiscovered(p.id);
              if (kind === 'lm') {
                return (
                  <g key={p.id} className={`cm-lm ${found ? 'is-found' : ''} ${p.id === selected ? 'is-on' : ''}`} transform={`translate(${x},${y})`}>
                    <circle r={10} />
                    <Landmark x={-6.5} y={-6.5} width={13} height={13} strokeWidth={2.2} />
                  </g>
                );
              }
              return (
                <g key={p.id} className={`cm-dot ${found ? 'is-found' : ''} ${p.id === selected ? 'is-on' : ''}`} transform={`translate(${x},${y})`}>
                  <circle r={kind === 'curated' ? 5 : 3.5} />
                </g>
              );
            })}
            {labels.map(l => (l.zone ? null : <text key={l.id} x={l.x} y={l.y} className={`cm-label ${l.id === selected ? 'is-on' : ''}`} style={{ textAnchor: l.anchor }}>{l.text}</text>))}
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
        <div className="ob-citymap-tools">
          <button type="button" className="ob-icon-btn" onClick={() => zoomBy(1.6)} aria-label={t('放大', 'Zoom in')} disabled={zoom >= MAX_ZOOM - 0.01}><Plus size={17} aria-hidden /></button>
          <button type="button" className="ob-icon-btn" onClick={() => zoomBy(1 / 1.6)} aria-label={t('缩小', 'Zoom out')}><Minus size={17} aria-hidden /></button>
          <button type="button" className="ob-icon-btn" onClick={locate} aria-label={t('回到我这', 'Find me')}><LocateFixed size={17} aria-hidden /></button>
          <button type="button" className="ob-icon-btn" onClick={fit} aria-label={t('全城', 'Whole city')}><Maximize2 size={16} aria-hidden /></button>
          {plan?.route && <button type="button" className="ob-icon-btn" onClick={showRoute} aria-label={t('看整条路线', 'Show the whole route')}><RouteIcon size={16} aria-hidden /></button>}
        </div>
        <p className="ob-citymap-credit">{t('地图数据', 'Map data')} © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> {t('贡献者', 'contributors')} (ODbL) · DataSF</p>
      </div>

      {sel && <PlaceActions place={sel} walk={walk} onTrip={onTrip} />}

      <section className="ob-block ob-citymap-list">
        <label className="ob-citymap-search">
          <Search size={16} aria-hidden />
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('搜地方：金门大桥、Dolores…', 'Search: Golden Gate, 唐人街…')} aria-label={t('搜索地点', 'Search places')} />
        </label>
        {!query.trim() && (
          <div className="ob-map-zoom ob-citymap-tabs" role="tablist">
            {([['landmarks', t('地标', 'Landmarks')], ['near', t('附近', 'Nearby')], ['found', t('去过的', 'Visited')]] as const).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>
        )}
        <ul className="ob-place-list">
          {list.map(p => (
            <li key={p.id}>
              <button type="button" className={selected === p.id ? 'is-on' : ''} onClick={() => focusPlace(p)}>
                <span className={`ob-place-num ${isDiscovered(p.id) ? 'is-found' : ''}`} aria-hidden>{p.landmark ? <Landmark size={13} /> : '·'}</span>
                <span className="ob-place-text"><span>{t(p.name)}</span><small>{t(landmarkAreaAt(p.x, p.z)?.name ?? zoneName(p.zone))}</small></span>
              </button>
            </li>
          ))}
          {!list.length && <li className="ob-citymap-empty">{ix ? t('没找到，换个词试试', 'Nothing found — try another word') : t('地点加载中…', 'Loading places…')}</li>}
        </ul>
      </section>
    </Sheet>
  );
}
