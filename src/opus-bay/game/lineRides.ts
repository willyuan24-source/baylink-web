import { lineVoices } from '../audio/cityHooks';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { Bilingual, DialogueNode } from '../core/types';
import { TUNNELS, W4_LINES, type W4LineId, metroStation, stationAttractions, w4StationName, w4StationShort } from '../data/sf/stationNames';
import { LOOP_STOP_LINES, loopHopOffTip, metroNarration } from '../data/sf/tourLines';
import { type TransitW4, activeCableSystem, activeLineFleet, boardAt, stopPos as cableStopPos, transitData, transitW4, w4Kind } from '../data/transit';
import type { TransitLine, TransitTunnel } from '../world/sf/format';
import { BUS, type BusRideStatus } from '../world/busSystem';
import { LRV, type RailRideStatus, stopPos } from '../world/lightRail';
import { noteLoopRide, sayTunnel } from './cityContent';
import { hookFill, npcLine } from './content';
import { getLocale } from '../../i18n/locale';
import { cityStreamerLazy } from '../world/cityLoader';
import { travelEpoch } from './fastTravel';
import { announce, defineNode, playDialogue, refreshLock, say } from './flow';
import { flow, type FlowRide } from './flowStore';
import type { Interactable } from './interactables';
import { type LineChoice, type LineLite, lineChoices, lineRideLabel } from './lineChoices';
import { LINE_TTL } from './linePacer';
import { type RideState, beginLineRide, currentRide, isLineRide, lineRideEta } from './ride';
import { registerLineEstimator, registerTripLines, transitTripLine } from './tripProviders';

/**
 * Wave 4 · lane T, integration (W4-T4 / T9 / T10 / T11 / T12): the game side of the sightseeing loop and the Muni Metro
 * N / M. City mode only, loaded lazily by game/transit.ts `initTransit` (the main graph keeps thin stubs), so GameRoot
 * does not grow by the line tables, the choices or the tour texts.
 *
 *   boardLine(station, { to?, line? })   E at a loop pole / Metro kiosk: the boarding dialogue (lineChoices); `to` =
 *                                        a trip / tour leg's pre-filled row "上车 · 坐到 石镇（约 70 秒）"
 *   rideLine(line, from, to)             wait at `from` for a bus / train toward `to`, then ride it (to = from: a lap)
 *   lineLabel(ride)                      the RideBanner slots (+ canHopOff / hopOffNote / nextStop)
 *   lineInteractables()                  the 16 loop poles and the Metro kiosks / surface poles (at the placed props)
 *   stationRides(station) / nextArrival(station, line?, dir?)   lane P's StationActions (rows with seconds; the ETA)
 *   requestNextStop()                    下一站下车 (the system sets the next stop as the destination; the stop bell)
 *   subwayView()                         what ui/LineRideLayer.tsx shows (the subway overlay while underground)
 *   leaveSpot(r, status, finishing)      where a ride on these lines ends (kiosk underground, kerb side on the surface)
 *   initLineRides()                      the trip planner's lines + estimator (lane G's registries); returns a disposer
 */

type W4Status = (BusRideStatus | RailRideStatus) & { underground?: boolean; tunnel?: TransitTunnel | null; at?: number; dir?: 1 | -1; portalWait?: boolean; canHopOff?: boolean };

const BUS_DRIVER: Bilingual = { zh: '观光巴士司机', en: 'Tour bus driver' };
const METRO_OPERATOR: Bilingual = { zh: '地铁司机', en: 'Muni operator' };
const NOT_RUNNING: [string, string] = ['车还没开过来，稍等一下', 'Not running here yet, try again in a moment'];

const lines = (): TransitW4 | null => transitW4();
export const w4Line = (id: string): TransitLine | undefined => lines()?.lines.find(l => l.id === id);

/** The short line name the HUD / dialogue use (观光环线 · N 线 · M 线). */
export const lineShortName = (id: string): Bilingual => W4_LINES[id as W4LineId]?.shortName ?? w4Line(id)?.name ?? { zh: id, en: id };

/** A published line as the choices / labels need it (the short line name, stops with their zh glossed names). */
export function lite(line: TransitLine): LineLite {
  return {
    id: line.id, kind: line.kind === 'bus' ? 'bus' : 'light-rail', name: lineShortName(line.id), loop: line.loop,
    stops: line.stops.map(s => ({ id: s.id, name: w4StationName(s.id) ?? s.name, at: s.at, major: s.major })),
    tunnels: line.tunnels?.map(t => ({ fromAt: t.fromAt, toAt: t.toAt })),
  };
}

/**
 * Seconds of a ride on `line` from → to, from stepping aboard (the running systems' own estimate plus the dwell at the
 * boarding stop, which the rider sits through: 8 s on the bus, 3 / 4 s on the Metro under / above ground; to = from on
 * the loop: a whole lap). The rows, the planner and the banner all say this.
 */
export function lineRideSeconds(line: string, from: string, to: string): number {
  const f = activeLineFleet();
  if (!f) return 0;
  if (w4Kind(line) === 'bus') return f.bus.rideSeconds(from, to) + BUS.dwell;
  const s = f.rail.rideSeconds(line, from, to);
  return s > 0 ? s + (metroStation(from)?.underground ? LRV.dwellUnderground : LRV.dwell) : 0;
}

/** A wave-4 station's name and where you board there (its placed pole / kiosk), or null. */
export function stationPoint(id: string): { name: Bilingual; x: number; z: number } | null {
  const w4 = lines();
  if (!w4) return null;
  for (const l of w4.lines) {
    const s = l.stops.find(q => q.id === id);
    if (s) return { name: w4StationName(id) ?? s.name, ...boardAt(w4, s) };
  }
  return null;
}

/** The wave-4 lines stopping at `station` (the five Market St stations are shared by the N and the M). */
export function stationLines(station: string): TransitLine[] {
  return lines()?.lines.filter(l => l.stops.some(s => s.id === station)) ?? [];
}

const phone = () => runtime.input.device === 'touch';

/** The boarding rows at `station` over every line serving it (≤ 6 ride rows on a phone), then 看线路图 and 先不坐. */
export function stationChoices(station: string, o: { to?: string; line?: string } = {}): LineChoice[] {
  const ls = stationLines(station).filter(l => !o.line || l.id === o.line);
  const max = phone() ? 6 : 8;
  const per = Math.max(2, Math.floor(max / Math.max(1, ls.length)));
  const rides: LineChoice[] = [];
  let map: LineChoice | null = null, cancel: LineChoice | null = null;
  for (const l of ls) {
    for (const c of lineChoices(lite(l), station, { rideSeconds: lineRideSeconds, max: per, to: o.to })) {
      if (c.kind === 'map') map ??= c;
      else if (c.kind === 'cancel') cancel ??= c;
      else rides.push(c);
    }
    // a pre-filled leg on one of the lines: only its confirm row
    if (o.to && rides.some(r => r.to === o.to)) return [...rides.filter(r => r.to === o.to).slice(0, 1), cancel ?? { kind: 'cancel', label: { zh: '先不坐了', en: 'Not now' } }];
  }
  return [...rides, ...(map ? [map] : []), cancel ?? { kind: 'cancel', label: { zh: '先不坐了', en: 'Not now' } }];
}

// ---------------------------------------------------------------------------
// Lane P: StationActions
// ---------------------------------------------------------------------------

export interface StationRide {
  line: string;
  lineName: Bilingual;
  short: string;
  color: string;
  kind: 'ride' | 'lap';
  to: string;
  toName: Bilingual;
  dir: 1 | -1;
  seconds: number;
  /** the destination serves an attraction (★) */
  star: boolean;
}

/** The rides offered at a station (the boarding dialogue's rows, as data): next stops each way, ★ stops, termini, 坐一圈. */
export function stationRides(station: string): StationRide[] {
  const out: StationRide[] = [];
  for (const c of stationChoices(station)) {
    if ((c.kind !== 'ride' && c.kind !== 'lap') || !c.line || !c.to) continue;
    const meta = W4_LINES[c.line as W4LineId];
    out.push({
      line: c.line, lineName: lineShortName(c.line), short: meta?.short ?? '', color: meta?.color ?? w4Line(c.line)?.color ?? '#888',
      kind: c.kind, to: c.to, toName: w4StationShort(c.to) ?? w4StationName(c.to) ?? { zh: c.to, en: c.to }, dir: c.dir ?? 1,
      seconds: Math.round(c.seconds ?? 0), star: !!c.star,
    });
  }
  return out;
}

/**
 * Seconds until the next vehicle stops at `station` (on `line`, travelling `dir` when given), or null (not running /
 * not a wave-4 station). The loop runs one way (dir ignored).
 */
export function nextArrival(station: string, line?: string, dir?: 1 | -1): number | null {
  // a cable-car station (lane P's station card, optional request): the soonest car of its lines either way
  const cable = activeCableSystem(), data = transitData();
  if (cable && data?.stations.some(st => st.id === station)) {
    let best = Infinity;
    for (const l of data.lines) {
      if (line && l.id !== line) continue;
      const stop = l.stops.find(st => st.station === station);
      if (!stop) continue;
      for (const c of cable.cars) {
        if (c.line !== l) continue;
        for (const d of dir ? [dir] : ([1, -1] as const)) best = Math.min(best, cable.eta(c, cableStopPos(stop, d), d));
      }
    }
    return Number.isFinite(best) ? best : null;
  }
  const f = activeLineFleet();
  if (!f) return null;
  let best = Infinity;
  for (const l of stationLines(station)) {
    if (line && l.id !== line) continue;
    if (l.kind === 'bus') {
      const idx = f.bus.stopIndex(station);
      if (idx >= 0) for (const b of f.bus.buses) best = Math.min(best, f.bus.eta(b, idx));
      continue;
    }
    const tr = f.rail.trackOf(l.id);
    const st = tr?.stops.find(s => s.id === station);
    if (!tr || !st) continue;
    const pos = stopPos(tr, st);
    for (const t of f.rail.trains) {
      if (t.track !== tr) continue;
      for (const d of dir ? [dir] : ([1, -1] as const)) best = Math.min(best, f.rail.eta(t, pos, d));
    }
  }
  return Number.isFinite(best) ? best : null;
}

// ---------------------------------------------------------------------------
// Boarding and riding
// ---------------------------------------------------------------------------

/** E at a loop pole / Metro kiosk: the driver asks where to (or confirms a trip / tour leg's pre-filled ride). */
export function boardLine(station: string, o: { to?: string; line?: string } = {}) {
  const ls = stationLines(station);
  if (!ls.length || !activeLineFleet()) { say(...NOT_RUNNING); return; }
  const bus = ls.every(l => l.kind === 'bus');
  const name = w4StationName(station) ?? ls[0].stops.find(s => s.id === station)!.name;
  const choices: NonNullable<DialogueNode['choices']> = stationChoices(station, o).map((c, i) => {
    const hotkey = String(i + 1);
    if (c.kind === 'cancel') return { hotkey, label: c.label, action: { type: 'end' as const } };
    if (c.kind === 'map') return { hotkey, label: c.label, next: `flow.ride.map:${c.line}` };
    return { hotkey, label: c.label, next: `flow.ride.ln:${c.line}:${station}:${c.to}` };
  });
  const lineNames = ls.map(l => lineShortName(l.id));
  const text: Bilingual = bus
    ? hookFill('busStop', { station: name }) ?? { zh: `这里是观光巴士「${name.zh}」站。上层是露天的，BAYBAY 一路讲解，想坐到哪儿？`, en: `Sightseeing loop, ${name.en}. The top deck is open and BAYBAY guides the whole way. Where to?` }
    : hookFill('metroStation', { station: name }) ?? { zh: `这里是 ${name.zh}，${lineNames.map(n => n.zh).join(' / ')}。想坐到哪一站？`, en: `${name.en}: ${lineNames.map(n => n.en).join(' / ')}. Where to?` };
  playDialogue(defineNode({
    id: bus ? 'flow.bus' : 'flow.metro', speaker: 'npc', mood: 'happy',
    npcName: npcLine(bus ? 'busDriver' : 'metroOperator').name ?? (bus ? BUS_DRIVER : METRO_OPERATOR),
    text, choices,
  }));
}

/** Wait at `from` for a bus / train of `line` toward `to` (to = from on the loop: the whole lap), then ride it. */
export function rideLine(line: string, from: string, to: string) {
  const l = w4Line(line), kind = w4Kind(line);
  const a = l?.stops.find(s => s.id === from), b = l?.stops.find(s => s.id === to);
  if (!l || !kind || !a || !b || (a === b && !l.loop)) { say(...NOT_RUNNING); return; }
  const dir: 1 | -1 = l.loop ? 1 : b.at > a.at ? 1 : -1;
  const r = beginLineRide(line, from, to, dir, travelEpoch(), kind);
  if (!r) { say(...NOT_RUNNING); return; }
  // the bus: the upper deck's front bench (the ride camera "deck"); the LRV: standing at the front by the pole
  game.set({ move: { mode: 'transit', line, spot: kind === 'bus' ? 'seat' : 'rail' }, panel: { kind: null } });
  refreshLock();
  const eta = lineRideEta();
  flow.set({ ride: { stage: 'waiting', from, to, line, kind, eta: eta ? Math.max(1, Math.round(eta)) : undefined } });
  const dest = w4StationShort(to) ?? w4StationName(to) ?? b.name;
  announce(kind === 'bus'
    ? { zh: a === b ? '等观光巴士：坐一圈' : `等观光巴士：去 ${dest.zh}`, en: a === b ? 'Waiting for the tour bus: the whole loop' : `Waiting for the tour bus to ${dest.en}` }
    : { zh: `等 ${lineShortName(line).zh}：开往 ${dest.zh}`, en: `Waiting for the ${lineShortName(line).en} to ${dest.en}` });
}

/** 下一站下车: the ridden bus / train makes its next stop the destination; the stop bell rings. */
export function requestNextStop(): string | null {
  const r = currentRide();
  if (!isLineRide(r) || r.mode === 'wait') return null;
  const f = activeLineFleet(), kind = w4Kind(r.line);
  if (!f || !kind) return null;
  const at = kind === 'bus' ? f.bus.requestNextStop() : f.rail.requestNextStop();
  if (!at) return null;
  r.to = at;
  const cur = flow.get().ride;
  if (cur) flow.set({ ride: { ...cur, to: at } });
  emit({ type: 'transit', what: 'bell', line: r.line, kind, strength: 1 });
  const name = w4StationShort(at) ?? w4StationName(at);
  if (name) say(`下一站下车：${name.zh}`, `Getting off at the next stop: ${name.en}`);
  return at;
}

/** The ride's live status (bus or light rail), or null. */
export function w4Status(r: RideState | null = currentRide()): W4Status | null {
  if (!isLineRide(r) || !w4Kind(r.line)) return null;
  const f = activeLineFleet();
  const st = w4Kind(r.line) === 'bus' ? f?.bus.rideStatus() : f?.rail.rideStatus();
  return st && st.line === r.line ? (st as W4Status) : null;
}

/** The HUD's RideBanner slots for a bus / Metro ride (lineChoices.lineRideLabel over the live status). */
export function lineLabel(ride: FlowRide): { icon: 'bus' | 'metro'; waiting: Bilingual; lineTo: Bilingual; dest: Bilingual | null; canHopOff: boolean; hopOffNote: Bilingual | null; nextStop: boolean } {
  const l = ride.line ? w4Line(ride.line) : undefined;
  const st = w4Status();
  const status = st ?? { phase: ride.stage === 'waiting' ? 'coming' : 'riding', eta: ride.eta ?? 0, nextStop: null, nextEta: 0 };
  const label = l ? lineRideLabel(lite(l), status, ride.to) : null;
  const bus = ride.kind === 'bus';
  return {
    icon: bus ? 'bus' : 'metro',
    waiting: label?.waiting ?? { zh: '等车进站…', en: 'Waiting…' },
    lineTo: label?.lineTo ?? lineShortName(ride.line ?? ''),
    dest: label?.dest ?? null,
    canHopOff: label?.canHopOff ?? true,
    hopOffNote: label?.hopOffNote ?? null,
    nextStop: ride.stage !== 'waiting',
  };
}

// ---------------------------------------------------------------------------
// Stations as interactables
// ---------------------------------------------------------------------------

const STATION_RADIUS = 4.2;

/** The loop poles (上观光巴士) and the Metro kiosks / surface poles (坐 N 线 / 坐 M 线 / 坐地铁), at the placed props. */
export function lineInteractables(): Interactable[] {
  const w4 = lines();
  if (!w4 || !activeLineFleet()) return [];
  const out: Interactable[] = [];
  const seen = new Set<string>();
  for (const l of w4.lines) {
    for (const s of l.stops) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      const at = boardAt(w4, s);
      const served = stationLines(s.id);
      const verb: Bilingual = l.kind === 'bus'
        ? { zh: '上观光巴士', en: 'Board the tour bus' }
        : served.length > 1 ? { zh: '坐地铁', en: 'Ride Muni Metro' } : { zh: `坐 ${lineShortName(l.id).zh}`, en: `Ride the ${lineShortName(l.id).en}` };
      out.push({ id: `transit-${s.id}`, source: 'transit', action: 'streetcar', verb, name: w4StationName(s.id) ?? s.name, x: at.x, z: at.z, radius: STATION_RADIUS, refId: s.id });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Getting off
// ---------------------------------------------------------------------------

/**
 * Where a ride on the loop / the Metro ends, or null for the generic "beside the car" rule of game/transit.ts:
 * - underground (the train is hidden) or 直接到站 before the stop: the destination's kiosk / pole (you only get off at
 *   stations under ground; a skip lands you where you would have alighted);
 * - a surface stop: null (beside the vehicle, on its kerb side: `side`).
 */
export function leaveSpot(r: RideState, st: W4Status | null, finishing: boolean): { spot: { x: number; z: number } | null; side: 1 | -1; station: string | null } {
  const w4 = lines();
  const l = w4Line(r.line ?? '');
  const arrived = st?.phase === 'arrived';
  // the kerb (and the LRV's stop pole) is on the right of the direction of travel: the platform's −x side
  const side: 1 | -1 = -1;
  if (!w4 || !l) return { spot: null, side, station: null };
  const stopAt = (id: string | null | undefined) => (id ? l.stops.find(s => s.id === id) : undefined);
  if (st?.underground || r.hold) {
    // under ground only at a station: the one the train stands at (在这站下车 / arrived), else the destination
    const here = stopAt(st?.station) ?? stopAt(finishing ? r.to : null);
    return { spot: here ? boardAt(w4, here) : r.hold ?? null, side, station: here?.id ?? null };
  }
  if (finishing && !arrived && r.mode === 'follow') {
    const dest = stopAt(r.to);
    return { spot: dest ? boardAt(w4, dest) : null, side, station: dest?.id ?? null };
  }
  return { spot: null, side, station: st?.station ?? null };
}

/** 直接到站 farther than this (u, straight to the destination: beyond the ring the streamer holds round the player) waits under a veil for the city to stream in. */
export const SKIP_VEIL_OVER = 250;

/**
 * 直接到站 on a long leg (plan §3.4: > 400 u): a dark veil fades in over the view (0.35 s), `jump` ends the ride and puts
 * the rider at the destination under it, the streamer brings that part of the city in (whenReady 150 u, at most 8 s),
 * then the veil fades out (0.5 s). Plain DOM (no React root): one element over the canvas, under the HUD's toasts.
 */
export function veiledSkip(to: { x: number; z: number }, name: Bilingual | null, jump: () => void) {
  if (typeof document === 'undefined') { jump(); return; }
  const host = document.querySelector('.ob-overlay') ?? document.body;
  const veil = document.createElement('div');
  veil.className = 'ob-line-veil';
  veil.setAttribute('aria-hidden', 'true');
  Object.assign(veil.style, {
    position: 'absolute', inset: '0', zIndex: '45', pointerEvents: 'auto', opacity: '0', transition: 'opacity .35s ease',
    background: 'radial-gradient(ellipse at 50% 55%, #243037 0 35%, #11171b 100%)', display: 'grid', placeItems: 'center',
    color: '#f5efe2', font: '800 17px/1.4 inherit', letterSpacing: '.02em',
  } as Partial<CSSStyleDeclaration>);
  const en = getLocale() === 'en';
  if (name) veil.textContent = en ? `Next stop: ${name.en} …` : `直接到站：${name.zh} …`;
  host.appendChild(veil);
  requestAnimationFrame(() => { veil.style.opacity = '1'; });
  window.setTimeout(() => {
    jump();
    const streamer = cityStreamerLazy();
    const ready = streamer ? streamer.whenReady(to, 150) : Promise.resolve();
    void Promise.race([ready, new Promise(r => window.setTimeout(r, 8000))]).then(() => {
      veil.style.transition = 'opacity .5s ease';
      veil.style.opacity = '0';
      window.setTimeout(() => veil.remove(), 600);
    });
  }, 380);
}

/**
 * 直接到站 on a loop / Metro ride counts as a ride (plan §3.4) when the skipped leg is a real one: another station, at
 * least the odometer rule's length along the line, no fast travel since boarding.
 */
export function skipCounts(r: RideState, minOdometer: number): boolean {
  const l = w4Line(r.line ?? '');
  const st = w4Status(r);
  const a = l?.stops.find(s => s.id === (st?.lastStation ?? r.from)), b = l?.stops.find(s => s.id === r.to);
  if (!l || !a || !b || a === b || r.epoch !== travelEpoch()) return false;
  const along = l.loop ? (((b.at - a.at) % l.length) + l.length) % l.length : Math.abs(b.at - a.at);
  return (st?.odometer ?? 0) + along >= minOdometer;
}

// ---------------------------------------------------------------------------
// The subway overlay (ui/LineRideLayer.tsx)
// ---------------------------------------------------------------------------

export interface SubwayView {
  visible: boolean;
  line: { short: string; name: Bilingual; color: string };
  destination: Bilingual;
  tunnel: { fromAt: number; toAt: number; name?: Bilingual; fact?: Bilingual; portalA?: Bilingual | null; portalB?: Bilingual | null };
  stations: { id: string; name: Bilingual; at: number }[];
  at: number;
  dir: 1 | -1;
  moving: boolean;
  stopped: string | null;
  next: { id: string; name: Bilingual; eta: number } | null;
  portalWait: boolean;
}

/**
 * The tunnel the rider is in (data/sf/stationNames.ts TUNNELS): the N's second span is the Sunset Tunnel; the M's one
 * span is the Market Street subway up to the Castro, then the Twin Peaks Tunnel (it starts west of Castro station).
 */
function tunnelInfo(line: string, t: TransitTunnel, at: number): { name?: Bilingual; fact?: Bilingual } {
  const key = /sunset/i.test(t.name?.en ?? '') ? 'sunset-tunnel' : line === 'm-ocean-view' && at > 700 ? 'twin-peaks-tunnel' : 'market-street-subway';
  const info = TUNNELS[key];
  return { name: info?.name ?? t.name, fact: info?.fact };
}

let lastTunnel: TransitTunnel | null = null;

/** What the subway overlay shows now (null: not underground on a Metro ride). */
export function subwayView(): SubwayView | null {
  const r = currentRide();
  const st = w4Status(r);
  if (!r || !st || w4Kind(r.line ?? '') !== 'light-rail' || r.mode === 'wait') { lastTunnel = null; return null; }
  const l = w4Line(r.line!);
  if (!l) return null;
  const tunnel = st.underground ? st.tunnel ?? null : null;
  if (!tunnel) { lastTunnel = null; return null; }
  if (tunnel !== lastTunnel) {
    lastTunnel = tunnel;
    // lane C's line for the stretch of this ride under ground (the Market Street subway / the Twin Peaks Tunnel): said
    // once as the overlay comes up
    const a = l.stops.find(s => s.id === r.from)?.at ?? tunnel.fromAt, b = l.stops.find(s => s.id === r.to)?.at ?? tunnel.toAt;
    const clamp = (x: number) => Math.min(tunnel.toAt, Math.max(tunnel.fromAt, x));
    // through BAYBAY's line pacer (lane C: game/cityMoments sayTunnel), never over another of her lines
    sayTunnel(l.id, clamp(a), clamp(b));
  }
  const meta = W4_LINES[l.id as W4LineId];
  const stations = l.stops.filter(s => s.at >= tunnel.fromAt - 0.5 && s.at <= tunnel.toAt + 0.5).map(s => ({ id: s.id, name: w4StationShort(s.id) ?? w4StationName(s.id) ?? s.name, at: s.at }));
  const next = st.nextStop ? l.stops.find(s => s.id === st.nextStop) : undefined;
  const info = tunnelInfo(l.id, tunnel, st.at ?? 0);
  return {
    visible: true,
    line: { short: meta?.short ?? l.short ?? '', name: lineShortName(l.id), color: meta?.color ?? l.color },
    destination: w4StationShort(r.to) ?? w4StationName(r.to) ?? { zh: r.to, en: r.to },
    tunnel: { fromAt: tunnel.fromAt, toAt: tunnel.toAt, ...info, portalA: tunnel.portalA?.name ?? null, portalB: tunnel.portalB?.name ?? null },
    stations,
    at: st.at ?? 0,
    dir: st.dir ?? r.dir ?? 1,
    moving: st.station === null,
    stopped: st.station,
    next: next ? { id: next.id, name: w4StationShort(next.id) ?? w4StationName(next.id) ?? next.name, eta: st.nextEta } : null,
    portalWait: !!st.portalWait,
  };
}

// ---------------------------------------------------------------------------
// Narration fallbacks (lane C narrates the loop / Metro stops from the `transit` events; these are the boarding bubbles)
// ---------------------------------------------------------------------------

/**
 * The boarding bubble of a loop ride, or null: the Metro's board line is lane C's (its pacer says `metro-board-n / -m`
 * on the fleet's `board` event), the loop's frozen lines start at the first approach.
 */
export function boardBubble(r: RideState): Bilingual | null {
  if (w4Kind(r.line ?? '') !== 'bus') return null;
  return { zh: '上车啦！上层前排视野最好，每一站我都给你讲', en: 'All aboard! The front of the top deck has the best view, and I’ll tell you about every stop' };
}

/**
 * Getting off at a loop stop: its hop-off tip (lane C's frozen line: "下车走 20 米就是风车…") through BAYBAY's line pacer
 * (game/cityMoments offerLine: after whatever she is saying, never over it; the arrival moment follows on foot).
 * Returns whether the stop has one.
 */
export function sayHopOffTip(station: string | null): boolean {
  const line = station ? loopHopOffTip(station) : null;
  if (!line) return false;
  void import('./cityMoments').then(m => m.offerLine(line.id, LINE_TTL.tip), () => {});
  return true;
}

/** Lane C's sightseeing goal: the loop stops of a ride finished with 直接到站 (no `arrive` under the veil). */
export function noteLoopSkip(from: string, to: string) { noteLoopRide(from, to); }

/**
 * The recorded tour lines (lane C's frozen TOUR_LINES, lane V's clips) that may play at `station` and at the next stop
 * ahead: audio/audio.ts fetches them on board / approach / arrive so the 0.7 s line wait never drops one.
 */
export function stopVoiceIds(line: string, station: string, dir?: 1 | -1): string[] {
  const l = w4Line(line);
  const i = l ? l.stops.findIndex(s => s.id === station) : -1;
  if (!l || i < 0) return [];
  const next = l.loop ? l.stops[(i + 1) % l.stops.length] : l.stops[i + (dir ?? 1)];
  const ids = new Set<string>();
  for (const s of [l.stops[i], next]) {
    if (!s) continue;
    if (l.kind === 'bus') {
      const ls = LOOP_STOP_LINES[s.id];
      if (ls) for (const t of [ls.approach, ls.arrive, ls.hopOffTip]) if (t) ids.add(t.id);
      continue;
    }
    for (const what of ['approach', 'arrive'] as const) { const t = metroNarration({ what, line, station: s.id, dir }); if (t) ids.add(t.id); }
  }
  return [...ids];
}

/** The attraction ids a wave-4 stop serves (the arrival flow's hint). */
export const servedAttractions = (station: string): readonly string[] => stationAttractions(station);

// ---------------------------------------------------------------------------
// The trip planner (lane G's registries)
// ---------------------------------------------------------------------------

/**
 * Register the loop / N / M with lane G's planner (their stops at the placed poles / kiosks: where you board) and the
 * systems' own wait / ride estimates (the times the boarding rows show). Returns the disposer.
 */
export function initLineRides(): () => void {
  const off = registerTripLines('t-w4', () => {
    const w4 = lines();
    if (!w4) return [];
    return w4.lines.map(l => transitTripLine({ ...l, stops: l.stops.map(s => ({ ...s, ...boardAt(w4, s) })) }));
  });
  registerLineEstimator({
    lineWait: (line, stop, dir) => (w4Kind(line) ? nextArrival(stop, line, w4Kind(line) === 'bus' ? undefined : dir) : undefined),
    lineRide: (line, board, alight) => { if (!w4Kind(line)) return undefined; const s = lineRideSeconds(line, board, alight); return s > 0 ? s : undefined; },
  });
  lineVoices.ids = stopVoiceIds;
  return () => { off(); registerLineEstimator({}); if (lineVoices.ids === stopVoiceIds) lineVoices.ids = null; };
}
