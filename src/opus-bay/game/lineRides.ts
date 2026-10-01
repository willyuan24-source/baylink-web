import { lineVoices } from '../audio/cityHooks';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { Bilingual, DialogueNode } from '../core/types';
import { TUNNELS, W4_LINES, type W4LineId, metroStation, stationAttractions, w4StationName, w4StationShort } from '../data/sf/stationNames';
import { LOOP_STOP_LINES, loopHopOffTip, metroNarration } from '../data/sf/tourLines';
import { METRO_ENDS } from '../data/sf/goalMarks';
import { DISTRICT } from '../data/district';
import { type TransitStation, type TransitW4, activeCableSystem, activeFerrySystem, activeLineFleet, activeStreetcarSystem, boardAt, ferryTerminal, flineJson, rideSystemFor, stopPos as cableStopPos, transitData, transitW4, w4Kind } from '../data/transit';
import { canStand, groundPending, nearestWalkable } from '../core/terrain';
import { type TransitLine, type TransitTunnel, tunnelAt } from '../world/sf/format';
import { BUS, type BusRideStatus } from '../world/busSystem';
import { LRV, type RailRideStatus, stopPos } from '../world/lightRail';
import { noteLoopRide, sayTunnel } from './cityContent';
import { hookFill, npcLine } from './content';
import { getLocale } from '../../i18n/locale';
import { pick } from '../i18n';
import { cityStreamerLazy } from '../world/cityLoader';
import { travelEpoch } from './fastTravel';
import { W8K_LINES } from './fixedLines';
import { announce, bubble, defineNode, playDialogue, refreshLock, say } from './flow';
import { flow, type FlowRide } from './flowStore';
import type { Interactable } from './interactables';
import { type LineChoice, type LineLite, lineChoices, lineRideLabel } from './lineChoices';
import { LINE_TTL } from './linePacer';
import { busStalls, busWatchNow, watchBuses } from './busWatch';
import { type RideState, beginLineRide, currentRide, isLineRide, lineRideEta, rideSeconds } from './ride';
import type { TransitKind } from '../core/events';
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
  const perLine: LineChoice[][] = [];
  let map: LineChoice | null = null, cancel: LineChoice | null = null;
  for (const l of ls) {
    const rides: LineChoice[] = [];
    for (const c of lineChoices(lite(l), station, { rideSeconds: lineRideSeconds, max: ls.length > 1 ? 99 : max, to: o.to, prefer: METRO_ENDS[l.id] })) {
      if (c.kind === 'map') map ??= c;
      else if (c.kind === 'cancel') cancel ??= c;
      else rides.push(c);
    }
    // a pre-filled leg on one of the lines: only its confirm row
    if (o.to && rides.some(r => r.to === o.to)) return [...rides.filter(r => r.to === o.to).slice(0, 1), cancel ?? { kind: 'cancel', label: { zh: '先不坐了', en: 'Not now' } }];
    perLine.push(rides);
  }
  // (review) the five Market St stations serve the N and the M: take the lines' rows in turn and offer a destination
  // both reach once. A cap per line had left two identical rows each for the trunk stops (Civic Center, Montgomery,
  // Embarcadero) and no Ocean Beach / Balboa Park row on a phone at Powell (Ocean Beach: the Metro goal's sea).
  // (W5-T5) rank by rank: every line's next stops, then the Metro goal's ends (the N to Ocean Beach, the M to Stonestown
  // and SF State: on a phone at Powell / Civic Center the M's rows used to fall past the sixth), then the rest in turn
  const rides: LineChoice[] = [];
  // (each line in turn offers its next row not offered yet: a row both lines share does not use up a line's turn)
  for (const rank of [0, 1, 2] as const) {
    const tier = perLine.map(rs => rs.filter(c => (c.rank ?? 2) === rank));
    const at = tier.map(() => 0);
    for (let more = true; more && rides.length < max;) {
      more = false;
      tier.forEach((rs, li) => {
        while (at[li] < rs.length && rides.some(r => r.to === rs[at[li]].to)) at[li]++;
        if (at[li] >= rs.length || rides.length >= max) return;
        rides.push(rs[at[li]++]);
        more = true;
      });
    }
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

/**
 * E at a loop pole / Metro kiosk: the driver asks where to (or confirms a trip / tour leg's pre-filled ride).
 * (W5-T3, plan MF2 "the tour's own bus boards without the driver question") A pre-filled leg of the Grand Tour (or any
 * caller passing `auto: true`) boards at once: BAYBAY says where to, and the rider waits for the bus / train with the
 * ride banner's 不坐了 — no dialogue (the scout's tour: 自动跟上 → the driver asked 上车 · 坐到 … again at every stop).
 */
export function boardLine(station: string, o: { to?: string; line?: string; auto?: boolean } = {}) {
  const ls = stationLines(station);
  if (!ls.length || !activeLineFleet()) { say(...NOT_RUNNING); return; }
  const bus = ls.every(l => l.kind === 'bus');
  const name = w4StationName(station) ?? ls[0].stops.find(s => s.id === station)!.name;
  const auto = !!o.to && (o.auto ?? flow.get().trip?.source === 'tour');
  const pre = auto ? stationChoices(station, o).find(c => c.kind === 'ride' && c.to === o.to && c.line) : undefined;
  if (pre?.line && pre.to) {
    const to = w4StationShort(pre.to) ?? w4StationName(pre.to);
    // (W8-K3) a fixed line lane X can voice: the ride banner names the stop
    if (to) bubble(W8K_LINES.allAboard, 2600);
    rideLine(pre.line, station, pre.to);
    return;
  }
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
  // (W5-T1) the quote the boarding row said, and the ride's length along the line (rideEta)
  r.quote = lineRideSeconds(line, from, to);
  r.dist = l.loop ? (a === b ? l.length : ((((b.at - a.at) % l.length) + l.length) % l.length)) : Math.abs(b.at - a.at);
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
 * - a surface stop the vehicle stands at: its pole, when it stands within POLE_STEP of the vehicle (W5-T part c: every
 *   loop / Metro pole now stands on open ground, checked by the sidecar's sweep rule; off a bus at Twin Peaks the
 *   rider used to land on the road beside it, in the path it pulls out on, and held it 12 s);
 * - between stops (a hop-off): null (beside the vehicle, on its kerb side: `side`).
 */
export function leaveSpot(r: RideState, st: W4Status | null, finishing: boolean, alightAt: string | null = null): { spot: { x: number; z: number } | null; side: 1 | -1; station: string | null } {
  const w4 = lines();
  const l = w4Line(r.line ?? '');
  const arrived = st?.phase === 'arrived';
  // the kerb (and the LRV's stop pole) is on the right of the direction of travel: the platform's −x side
  const side: 1 | -1 = -1;
  if (!w4 || !l) return { spot: null, side, station: null };
  const stopAt = (id: string | null | undefined) => (id ? l.stops.find(s => s.id === id) : undefined);
  if (st?.underground || r.hold) {
    // under ground only at a station: the one the rider asked to get off at (在这站下车: `alightAt`, kept through the
    // veil while the train may have moved on), the one the train stands at (a hop-off there, arrived), else the
    // destination. (review) 直接到站 while the train dwells at a station on the way used to put the rider at that
    // station, not at the destination.
    const here = stopAt(alightAt) ?? (!finishing || arrived ? stopAt(st?.station) : undefined) ?? stopAt(finishing ? r.to : null);
    return { spot: here ? boardAt(w4, here) : r.hold ?? null, side, station: here?.id ?? null };
  }
  // 直接到站 aboard, or while still waiting (verify M2 / m5): the destination's pole / kiosk
  if (finishing && !arrived) {
    const dest = stopAt(r.to);
    return { spot: dest ? boardAt(w4, dest) : null, side, station: dest?.id ?? null };
  }
  const at = stopAt(st?.station);
  const pose = at && st ? rideSystemFor(l.id)?.cars[st.car]?.pose : undefined;
  if (at && pose) {
    const pole = boardAt(w4, at);
    if (Math.hypot(pole.x - pose.x, pole.z - pose.z) <= POLE_STEP) return { spot: clearOfPath(l.path, pole), side, station: at.id };
  }
  return { spot: null, side, station: st?.station ?? null };
}

/** (W5-T part c) Off at a surface stop: to its pole when it stands this close (u) to the bus / train (else beside it). */
export const POLE_STEP = 9;
/** (W5-T part c) someone this close (u) to a vehicle's path is in its way (a bus's half width 1.25 + a person 0.45 + room) */
export const PATH_CLEAR = 2.3;

/**
 * (W5-T part c) A spot by `p` (a stop's pole) that is out of the vehicles' path: the pole itself when it stands
 * PATH_CLEAR from the line's centreline, else the point pushed straight away from the path until it does (≤ 2 u, on
 * standable ground). A loop pole stands 1.6 u off the bus's line (a thin pole clears the bus); someone standing there
 * did not, and the bus waited for them (22 s at the Golden Gate Bridge stop in the node sim).
 */
export function clearOfPath(path: readonly number[], p: { x: number; z: number }): { x: number; z: number } {
  let d = Infinity, qx = p.x, qz = p.z;
  for (let i = 3; i + 2 < path.length; i += 3) {
    const ax = path[i - 3], az = path[i - 1], bx = path[i], bz = path[i + 2];
    if (Math.max(ax, bx) < p.x - 12 || Math.min(ax, bx) > p.x + 12 || Math.max(az, bz) < p.z - 12 || Math.min(az, bz) > p.z + 12) continue;
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / L2));
    const cx = ax + dx * t, cz = az + dz * t, e = Math.hypot(p.x - cx, p.z - cz);
    if (e < d) { d = e; qx = cx; qz = cz; }
  }
  if (d >= PATH_CLEAR || d < 1e-3) return { x: p.x, z: p.z };
  const ux = (p.x - qx) / d, uz = (p.z - qz) / d;
  for (let k = PATH_CLEAR - d; k <= PATH_CLEAR - d + 2; k += 0.25) {
    const x = p.x + ux * k, z = p.z + uz * k;
    if (canStand(x, z, 0.45)) return { x, z };
  }
  return { x: p.x, z: p.z };
}

/** 直接到站 farther than this (u, straight to the destination: beyond the ring the streamer holds round the player) waits under a veil for the city to stream in. */
export const SKIP_VEIL_OVER = 250;

/**
 * 直接到站 on a long leg (plan §3.4: > 400 u) or to a stop that has not streamed in (verify M2, any city line): a dark veil
 * fades in over the view (0.35 s) while the streamer brings the destination in (whenReady 150 u, at most 8 s; the ride
 * goes on under the veil), then `jump` ends the ride and puts the rider there on walkable ground, and the veil fades out
 * (0.5 s). Plain DOM (no React root): one element over the canvas, under the HUD's toasts.
 * (W5-T2) Returns a handle: `cancel()` drops the jump and lifts the veil at once — a hop-off or a fly-to during the veil
 * wins (game/transit.ts leaveLineRide / the jump's travel check).
 */
export function veiledSkip(to: { x: number; z: number }, name: Bilingual | null, jump: () => void): { cancel(): void } {
  if (typeof document === 'undefined') { jump(); return { cancel() {} }; }
  const host = document.querySelector('.ob-overlay') ?? document.body;
  const veil = document.createElement('div');
  veil.className = 'ob-line-veil';
  veil.setAttribute('aria-hidden', 'true');
  Object.assign(veil.style, {
    position: 'absolute', inset: '0', zIndex: '45', pointerEvents: 'auto', opacity: '0', transition: 'opacity .35s ease',
    background: 'radial-gradient(ellipse at 50% 55%, #243037 0 35%, #11171b 100%)', display: 'grid', placeItems: 'center',
    color: '#f5efe2', font: '800 17px/1.4 inherit', letterSpacing: '.02em',
  } as Partial<CSSStyleDeclaration>);
  // (plain DOM: pick() gives 繁體 its own characters — the site's React layer never sees this node)
  if (name) veil.textContent = pick({ zh: `直接到站：${name.zh} …`, en: `Next stop: ${name.en} …` }, getLocale());
  host.appendChild(veil);
  requestAnimationFrame(() => { veil.style.opacity = '1'; });
  const streamer = cityStreamerLazy();
  const ready = streamer ? streamer.whenReady(to, 150) : Promise.resolve();
  const shown = new Promise(r => window.setTimeout(r, 380));
  let done = false;
  const lift = () => {
    veil.style.pointerEvents = 'none';
    veil.style.transition = 'opacity .5s ease';
    requestAnimationFrame(() => { veil.style.opacity = '0'; });
    window.setTimeout(() => veil.remove(), 650);
  };
  void Promise.all([shown, Promise.race([ready, new Promise(r => window.setTimeout(r, 8000))])]).then(() => {
    if (done) return;
    done = true;
    // (review) the veil takes the pointer: it always lifts, even if the jump throws (a torn-down world)
    try { jump(); } finally { lift(); }
  }).catch((e: unknown) => { console.error('[opus-bay] 直接到站', e); });
  return { cancel() { if (done) return; done = true; lift(); } };
}

/**
 * 直接到站 on a loop / Metro ride counts as a ride (plan §3.4) when the skipped leg is a real one: another station, at
 * least the odometer rule's length along the line, no fast travel since boarding.
 */
export function skipCounts(r: RideState, minOdometer: number, to: string = r.to): boolean {
  const l = w4Line(r.line ?? '');
  const st = w4Status(r);
  // (review) `to`: where the rider gets off (在这站下车 at a station on the way: that station, not the destination)
  const a = l?.stops.find(s => s.id === (st?.lastStation ?? r.from)), b = l?.stops.find(s => s.id === to);
  if (!l || !a || !b || a === b || r.epoch !== travelEpoch()) return false;
  const along = l.loop ? (((b.at - a.at) % l.length) + l.length) % l.length : Math.max(0, (b.at - a.at) * (r.dir ?? (b.at > a.at ? 1 : -1)));
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

// ---------------------------------------------------------------------------
// Every city line (wave 4 verify, part b): kept in this lazy chunk, called by game/transit.ts in city mode
// ---------------------------------------------------------------------------

/** the city lines' poll clock (s, 4 Hz from game/transit.ts pollTurntables) */
let cityClock = 0;
let stepAsideAt = -Infinity;
/** A vehicle has stood this long (s) short of the player on its track before BAYBAY asks them to step aside (verify D3). */
export const STEP_ASIDE_AFTER = 4;
/** …at most once in this long (s) */
const STEP_ASIDE_EVERY = 40;

/**
 * 4 Hz from game/transit.ts: (verify D3) a cable car / F-line car / bus / Metro train standing short of the player on its
 * track: after STEP_ASIDE_AFTER s BAYBAY asks them to step aside (the gripman already rang; nothing told the player
 * before, and a car could wait for good). Returns true when a cable-car station near the player can now have its prompt
 * placed beside the track (the caller rebuilds the interactables).
 */
export function pollCity(dt: number): boolean {
  cityClock += dt;
  const fleet = activeLineFleet();
  // (W5-T2) the sightseeing buses: where, how fast, why they stand (the stall log)
  watchBuses(dt, fleet);
  const held: [number, Bilingual][] = [
    [activeCableSystem()?.viewerHeld() ?? 0, { zh: '叮当车在等我们让路呢，往路边站一站吧', en: 'The cable car is waiting for us. Let’s step to the side' }],
    [activeStreetcarSystem()?.viewerHeld() ?? 0, { zh: '电车在等我们让路呢，往路边站一站吧', en: 'The streetcar is waiting for us. Let’s step to the side' }],
    [fleet?.bus.viewerHeld() ?? 0, { zh: '观光巴士在等我们让路呢，往路边站一站吧', en: 'The tour bus is waiting for us. Let’s step to the side' }],
    [fleet?.rail.viewerHeld() ?? 0, { zh: '轻轨在等我们让路呢，往路边站一站吧', en: 'The train is waiting for us. Let’s step to the side' }],
  ];
  let best: [number, Bilingual] | null = null;
  for (const h of held) if (h[0] >= STEP_ASIDE_AFTER && (!best || h[0] > best[0])) best = h;
  // (W6-B review) since W6-B1 the transit also stands short of the player sitting in their bike / toy car
  // (world/sf/roadViewer.ts): BAYBAY asks them to pull over, as she asks the player on foot to step aside
  const mode = game.get().move.mode;
  if (best && cityClock - stepAsideAt >= STEP_ASIDE_EVERY && (mode === 'foot' || mode === 'bike' || mode === 'car')) {
    stepAsideAt = cityClock;
    bubble(mode === 'foot' ? best[1] : pullOver(best[1], mode), 3600);
  }
  const data = transitData(), p = runtime.player;
  return !!data?.stations.some(st => !kerbSpots.has(st.id) && (kerbMiss.get(st.id) ?? -Infinity) <= cityClock - KERB_RETRY
    && Math.abs(st.x - p.x) < 80 && Math.abs(st.z - p.z) < 80 && !groundPending(st.x, st.z, 6));
}

/** (W6-B review) The step-aside line for the player in their bike / toy car: "…把车挪到路边吧" / "…pull over to the side". */
export function pullOver(line: Bilingual, mode: 'bike' | 'car'): Bilingual {
  return {
    zh: line.zh.replace('往路边站一站吧', mode === 'bike' ? '把单车骑到路边吧' : '把车挪到路边吧'),
    en: line.en.replace('step to the side', 'pull over to the side'),
  };
}

/**
 * Where each cable-car station's prompt stands: beside the track (verify D3), once the ground there has streamed in. (Also
 * the F-line stations' landing spots, keyed `f:<id>`.)
 */
const kerbSpots = new Map<string, { x: number; z: number }>();
/**
 * When a search last found no spot (city clock, s): it is tried again after KERB_RETRY (the ground round a stop can still
 * be settling when its chunk is resident: in the game Hyde & Beach found none on its first look and a spot 3 u off the
 * track a little later; a kept miss had left the prompt, and a 直接到站 landing, on the rails).
 */
const kerbMiss = new Map<string, number>();
const KERB_RETRY = 5;
/**
 * a station prompt stands at least this far from every vehicle path (u): a passing cable car's body reaches 2.05 u; a
 * bus stops for someone within 1.5 u of its path, an F-line car within 1.4 u, a cable car within 1.3 u
 */
export const KERB_OFF = 2.45;
/**
 * the least a prompt may stand from a vehicle path where the street has no room for KERB_OFF (u): a bus stops for someone
 * within 1.5 u of its path, a train or F-line car 1.4 u, a cable car 1.3 u
 */
export const KERB_MIN = 1.6;
/** how far round a station the kerb search looks (u; a terminus: round its turntable) */
const KERB_RINGS = [2.6, 3.2, 3.8, 4.5, 5.5, 6.5, 7.5, 9];
const KERB_RINGS_TURNTABLE = [5.2, 6, 7];

/**
 * (review) Every vehicle path within `r` of (x, z) as flat segments [ax, az, bx, bz, …]: the cable lines, the F-line
 * (Market St and the Castro as published, the hero waterfront as the district gives it), the sightseeing loop and the
 * N / M outside their tunnels. A station prompt clears all of them, not only its own track: the D3 spots stood in the
 * sightseeing bus's path on California St (1.1–1.6 u), 0.09 u from it at Powell & Bush, 0.9 u at Hyde & North Point, and
 * on the F-line's rails at Powell & Market (1.0 u) and California & Drumm (0.6 u), so the bus / streetcar stopped for
 * whoever waited there (or ran through a rider waiting for their cable car).
 */
export function vehicleSegmentsNear(x: number, z: number, r: number): number[] {
  const out: number[] = [];
  const seg = (ax: number, az: number, bx: number, bz: number) => {
    if (Math.max(ax, bx) < x - r || Math.min(ax, bx) > x + r || Math.max(az, bz) < z - r || Math.min(az, bz) > z + r) return;
    out.push(ax, az, bx, bz);
  };
  const triples = (p: ArrayLike<number>, under?: (at: number) => boolean) => {
    let at = 0;
    for (let i = 3; i + 2 < p.length; i += 3) {
      const ax = p[i - 3], az = p[i - 1], bx = p[i], bz = p[i + 2], L = Math.hypot(bx - ax, bz - az);
      if (!under?.(at + L / 2)) seg(ax, az, bx, bz);
      at += L;
    }
  };
  for (const l of transitData()?.lines ?? []) triples(l.xyz);
  const f = flineJson();
  if (f) triples(f.path);
  const hero = DISTRICT.streetcar?.path ?? [];
  for (let i = 1; i < hero.length; i++) seg(hero[i - 1].x, hero[i - 1].z, hero[i].x, hero[i].z);
  for (const l of transitW4()?.lines ?? []) triples(l.path, l.tunnels?.length ? at => !!tunnelAt(l, at) : undefined);
  return out;
}

/** Distance from (x, z) to the nearest of `segs` (vehicleSegmentsNear), ∞ without any. */
export function segmentsDistance(segs: readonly number[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i + 3 < segs.length; i += 4) {
    const ax = segs[i], az = segs[i + 1], dx = segs[i + 2] - ax, dz = segs[i + 3] - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

/** A kerb spot's walkable ground must reach this far (u): not a gap walled in behind the kerb (review: Powell & Bush). */
const KERB_JOIN = 10;

/**
 * Can the player walk KERB_JOIN u away from (x0, z0)? A flood of standable ground in 0.5 u steps, at most 4000 cells
 * (ground not streamed in yet is not standable: a spot that cannot be judged yet is a miss, looked at again later).
 */
export function walkJoinedNear(x0: number, z0: number, reach = KERB_JOIN): boolean {
  if (!canStand(x0, z0, 0.45)) return false;
  const step = 0.5, key = (i: number, j: number) => (i + 512) * 1024 + (j + 512);
  const seen = new Set<number>([key(0, 0)]), stack: number[] = [0, 0];
  let cells = 0;
  while (stack.length && cells++ < 4000) {
    const j = stack.pop()!, i = stack.pop()!;
    if (Math.hypot(i, j) * step >= reach) return true;
    for (let d = 0; d < 4; d++) {
      const a = i + (d === 0 ? 1 : d === 1 ? -1 : 0), b = j + (d === 2 ? 1 : d === 3 ? -1 : 0), k = key(a, b);
      if (seen.has(k)) continue;
      seen.add(k);
      const x = x0 + a * step, z = z0 + b * step;
      if (!groundPending(x, z) && canStand(x, z, 0.45)) stack.push(a, b);
    }
  }
  return cells >= 4000;
}

/**
 * The nearest standable spot on the rings round (bx, bz) that is ≥ KERB_OFF from every vehicle path and joined to the
 * street (walkJoinedNear) (cached under `key` once found; a miss is kept KERB_RETRY s), or null (the ground not in yet,
 * or nothing found).
 */
function kerbAround(key: string, bx: number, bz: number, rings: readonly number[]): { x: number; z: number } | null {
  const hit = kerbSpots.get(key);
  if (hit) return hit;
  const miss = kerbMiss.get(key);
  if (groundPending(bx, bz, 6) || (miss !== undefined && cityClock - miss < KERB_RETRY)) return null;
  const segs = vehicleSegmentsNear(bx, bz, rings[rings.length - 1] + KERB_OFF + 1);
  // a street too narrow for KERB_OFF (Powell & Bush: the cable track and the bus loop cross between buildings at the
  // kerb): the joined spot farthest from every path, if no vehicle stops for someone standing there (KERB_MIN)
  let best: { x: number; z: number; off: number } | null = null;
  for (const r of rings) {
    for (let a = 0; a < 16; a++) {
      const x = bx + Math.cos((a * Math.PI) / 8) * r, z = bz + Math.sin((a * Math.PI) / 8) * r;
      if (!canStand(x, z, 0.45)) continue;
      const off = segmentsDistance(segs, x, z);
      if (off < KERB_MIN || (off < KERB_OFF && best && off <= best.off) || !walkJoinedNear(x, z)) continue;
      if (off < KERB_OFF) { best = { x, z, off }; continue; }
      const spot = { x, z };
      kerbSpots.set(key, spot);
      kerbMiss.delete(key);
      return spot;
    }
  }
  if (best) {
    const spot = { x: best.x, z: best.z };
    kerbSpots.set(key, spot);
    kerbMiss.delete(key);
    return spot;
  }
  kerbMiss.set(key, cityClock);
  return null;
}

/**
 * (verify D3) A cable-car station's prompt (and so where the player walks to and waits, and where 直接到站 lands) stands
 * beside the track, not on it: a car cannot pull in to a stop someone stands on (the Powell & Market prompt was 2.5 u from
 * the turntable centre, and a car stood short of it for good). The nearest standable spot 2.6–9 u round the station that
 * is ≥ KERB_OFF from every vehicle path there (its own track, and the review: the bus loop, the F-line, the other lines);
 * at a terminus 5–7 u round the turntable, clear of the turning car. None (or the ground not in yet): the station point
 * itself, and another look KERB_RETRY s later. `fresh`: forget the last answer (QA).
 */
export function stationBoardSpot(st: TransitStation, fresh = false): { x: number; z: number } {
  if (fresh) { kerbSpots.delete(st.id); kerbMiss.delete(st.id); }
  const data = transitData();
  if (!data) return { x: st.x, z: st.z };
  const tt = data.turntables.find(t => Math.hypot(t.x - st.x, t.z - st.z) < 6);
  return kerbAround(st.id, tt ? tt.x : st.x, tt ? tt.z : st.z, tt ? KERB_RINGS_TURNTABLE : KERB_RINGS) ?? { x: st.x, z: st.z };
}

/**
 * (review, verify M2) Where 直接到站 to a city F-line station lands: the station point is on the rails (a streetcar coming
 * in stopped short of the rider and BAYBAY asked them to step aside); a hero stop's platform (the district anchor), else
 * the kerb beside the tracks, else the point itself.
 */
export function flineLandingSpot(st: { id: string; x: number; z: number; hero?: boolean }): { x: number; z: number } {
  const platform = st.hero ? DISTRICT.anchors?.[`streetcar-${st.id}`] : undefined;
  if (platform) return { x: platform.x, z: platform.z };
  return kerbAround(`f:${st.id}`, st.x, st.z, KERB_RINGS) ?? { x: st.x, z: st.z };
}

/**
 * 直接到站 waits under the veil (veiledSkip) when the destination lies farther than SKIP_VEIL_OVER (beyond the ring the
 * streamer holds round the rider) or its ground has not streamed in yet (verify M2: the Powell–Hyde skip from Powell &
 * Market to Hyde & Beach found no walkable ground there and left the rider mid-route).
 */
export function skipNeedsVeil(to: { x: number; z: number }, far = SKIP_VEIL_OVER): boolean {
  const p = runtime.player;
  return Math.hypot(to.x - p.x, to.z - p.z) > far || groundPending(to.x, to.z, 2) || !nearestWalkable(to, 16);
}

/**
 * Seconds until the boat can take a rider waiting at terminal `from` (0 when it lies there): world/ferry.ts `eta`, with the
 * dwell at the other end cut short the way a waiting rider cuts it (verify D11 / m5: the offer left out an 80–140 s wait).
 */
export function ferryWaitSeconds(from: string): number {
  // (wave 8, lane A) another ferry line's own system answers for its quays (the Alcatraz boat: world/sf/alcatrazFerry.ts)
  const route = ferryTerminal(from)?.route.id;
  const own = route && route !== 'ferry' ? (rideSystemFor(route) as unknown as { waitSeconds?(station: string): number } | null) : null;
  if (own?.waitSeconds) return Math.max(0, own.waitSeconds(from));
  const sys = activeFerrySystem() as unknown as { line?: { stops: { terminal: string }[] }; eta?(i: number): number; boat?: { mode: string; at: number; timer: number } } | null;
  const i = sys?.line?.stops.findIndex(s => s.terminal === from) ?? -1;
  if (!sys?.eta || i < 0) return 0;
  const b = sys.boat;
  const cut = b && b.mode === 'dwell' && b.at !== i ? Math.max(0, b.timer - FERRY_DWELL_RIDER) : 0;
  return Math.max(0, sys.eta(i) - cut);
}
/** world/ferry.ts: a rider waiting at the other terminal cuts the boat's dwell to this (s) */
const FERRY_DWELL_RIDER = 4;

/** (W5-T2, QA) the bus watch: every bus now and the stalls logged (window.__opusBay.transit.busWatch()). */
export function busWatchReport() { return { now: busWatchNow(), stalls: busStalls() }; }

// ---------------------------------------------------------------------------
// W5-T1 / T2: the ride's time left, the stall watch, the turntable beat (city chunk; game/transit.ts keeps thin stubs)
// ---------------------------------------------------------------------------

export interface RideEta {
  line: string;
  kind: TransitKind;
  stage: 'waiting' | 'riding';
  from: string;
  to: string;
  /** seconds until the rider stands at `to`: the wait left + the ride left */
  seconds: number;
  /** waiting: the vehicle's live ETA at the boarding stop (0 aboard) */
  waitLeft: number;
  /** the ride left, from where the vehicle really is (the whole quote while waiting) */
  rideLeft: number;
  /** 0 … 1 of the ride behind (0 while waiting) */
  progress: number;
  /**
   * seconds the vehicle coming for / carrying the rider has not moved (a dwell counts; the 直接到站 rule reads it); aboard
   * it counts from boarding, and at the stop boarded at only past BOARD_GRACE (W5-T review)
   */
  stalled: number;
}

/** the vehicle has moved when it is this far from where it was last seen moving (u) */
const STALL_MOVE = 0.5;
/**
 * (W5-T review) aboard, before the vehicle has left the stop the rider boarded at, its stand counts only past this (s): the
 * stop's own dwell is boarding, not a hold-up — the ferry lies 14 s at its quay, and a cable car boarded at the Hyde St or
 * Taylor & Bay turntable had stood 13 s (its arrival dwell and the turn, while the rider waited), so the banner said
 * 车停住了 with 直接到站 as the big button the moment the rider stepped on
 */
export const BOARD_GRACE = 15;
const stall = { ride: null as RideState | null, x: NaN, z: NaN, t: 0, aboard: false, departed: false };

/** The pose of the vehicle coming for / carrying the rider (the hero F-line: the district streetcar). */
function rideVehicle(r: RideState): { x: number; z: number } | null {
  if (!isLineRide(r)) return r.mode === 'virtual' ? null : runtime.streetcar;
  const sys = rideSystemFor(r.line), st = sys?.rideStatus();
  return st && sys ? sys.cars[st.car]?.pose ?? null : null;
}

/** Per frame (game/transit.ts stepTransit): how long the rider's vehicle has not moved (STALL_MOVE from where it last did). */
export function watchStall(dt: number) {
  const r = currentRide();
  const pose = r ? rideVehicle(r) : null;
  if (!r || !pose || stall.ride !== r) { stall.ride = r; stall.x = pose?.x ?? NaN; stall.z = pose?.z ?? NaN; stall.t = 0; stall.aboard = false; stall.departed = false; return; }
  // (W5-T review) the count starts again when the rider steps aboard: the wait before it is not the ride's hold-up
  const aboard = !(flow.get().ride?.stage === 'waiting' || r.mode === 'wait');
  if (aboard !== stall.aboard) { stall.aboard = aboard; stall.departed = false; stall.x = pose.x; stall.z = pose.z; stall.t = 0; return; }
  if (!(Math.hypot(pose.x - stall.x, pose.z - stall.z) < STALL_MOVE)) { stall.x = pose.x; stall.z = pose.z; stall.t = 0; if (aboard) stall.departed = true; return; }
  stall.t += dt;
}

/** How long the vehicle has made no progress for the ride (aboard at the boarding stop: past BOARD_GRACE only). */
function stalledFor(r: RideState): number {
  if (stall.ride !== r) return 0;
  // (just stepped aboard: the watch starts its count on its next step)
  const aboard = !(flow.get().ride?.stage === 'waiting' || r.mode === 'wait');
  if (aboard !== stall.aboard) return 0;
  return aboard && !stall.departed ? Math.max(0, stall.t - BOARD_GRACE) : stall.t;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * The current ride's time left, from where its vehicle really is: the bus and the Metro count their run, dwells and
 * stops to the rider's stop (`LineRideSystem.rideLeft`); the cable cars, the F-line and the ferry take the boarding quote ×
 * the share of the line still ahead. While waiting: the vehicle's live ETA + the whole quote. Null when not riding.
 */
export function rideEtaNow(): RideEta | null {
  const r = currentRide(), f = flow.get().ride;
  if (!r || !f) return null;
  const waiting = f.stage === 'waiting' || r.mode === 'wait';
  const stalled = stalledFor(r);
  if (!isLineRide(r)) {
    // the hero F-line: a virtual ride has its own clock; a followed car ≈ its duration
    const waitLeft = waiting ? Math.max(0, f.eta ?? 0) : 0;
    const rideLeft = waiting ? r.duration || rideSeconds(r.from, r.to) : r.mode === 'virtual' ? Math.max(0, r.duration - r.elapsed) : Math.max(0, rideSeconds(r.from, r.to) - r.elapsed);
    const total = r.duration || rideSeconds(r.from, r.to) || 1;
    return { line: r.line ?? 'streetcar', kind: 'streetcar', stage: waiting ? 'waiting' : 'riding', from: r.from, to: r.to, seconds: waitLeft + rideLeft, waitLeft, rideLeft, progress: waiting ? 0 : clamp01(1 - rideLeft / total), stalled };
  }
  const sys = rideSystemFor(r.line), st = sys?.rideStatus();
  if (!sys || !st) return null;
  const quote = Math.max(0, r.quote ?? 0);
  const waitLeft = waiting ? Math.max(0, st.eta) : 0;
  const exact = waiting ? null : sys.rideLeft?.() ?? null;
  let rideLeft: number, progress: number;
  if (waiting) { rideLeft = quote; progress = 0; }
  else if (st.phase === 'arrived') { rideLeft = 0; progress = 1; }
  else if (exact !== null) { rideLeft = Math.max(0, exact); progress = quote > 0 ? clamp01(1 - rideLeft / quote) : 0; }
  else {
    const k = r.dist && r.dist > 1 ? clamp01(st.odometer / r.dist) : 0;
    rideLeft = quote * (1 - k);
    progress = k;
  }
  return { line: r.line, kind: r.kind ?? 'cable-car', stage: waiting ? 'waiting' : 'riding', from: r.from, to: r.to, seconds: waitLeft + rideLeft, waitLeft, rideLeft, progress, stalled };
}

/** turntable id → audioNow() when its turn was first seen near the player (the heave-ho beat's zero) */
const turnSeen = new Map<string, number>();

/** 4 Hz (game/transit.ts pollTurntables): the turntables turning near the player now (a beat starts / ends with each). */
export function noteTurning(ids: readonly string[], now: number) {
  for (const id of [...turnSeen.keys()]) if (!ids.includes(id)) turnSeen.delete(id);
  for (const id of ids) if (!turnSeen.has(id)) turnSeen.set(id, now);
}

/** The nearest of `ids` (turntables turning near the player) and how far round its car is (0 … 1), or null. */
export function turntableNear(ids: readonly string[]): { id: string; name: Bilingual; x: number; z: number; progress: number } | null {
  const sys = activeCableSystem(), data = transitData();
  if (!sys || !data || !ids.length) return null;
  const p = runtime.player;
  let best: (typeof data.turntables)[number] | null = null, bd = Infinity;
  for (const id of ids) {
    const tt = data.turntables.find(t => t.id === id);
    const d = tt ? Math.hypot(tt.x - p.x, tt.z - p.z) : Infinity;
    if (tt && d < bd) { bd = d; best = tt; }
  }
  const car = best ? sys.turningAt(best.id) : null;
  return best && car ? { id: best.id, name: best.name, x: best.x, z: best.z, progress: Math.min(1, car.turn / Math.PI) } : null;
}

/** The beat for the turn at turntable `at` on the audioNow() clock (`period` s apart), or null when nothing turns there. */
export function turntableBeat(at: string, now: number, period: number): { id: string; period: number; next: number; n: number } | null {
  if (!activeCableSystem()?.turningAt(at)) return null;
  let t0 = turnSeen.get(at);
  if (t0 === undefined) { t0 = now; turnSeen.set(at, t0); }
  const n = Math.max(1, Math.ceil((now - t0) / period + 1e-6));
  return { id: at, period, next: t0 + n * period, n };
}
