import type { Bilingual } from '../core/types';
import { STOP_ATTRACTIONS, W4_LINES, type W4LineId, w4StationShort } from '../data/sf/stationNames';

/**
 * Wave 4 · lane T (plan §3.4), pure: what the boarding dialogue offers at a sightseeing-bus stop or a Muni Metro station,
 * and what the ride banner says. Integration: game/transit.ts `boardFrom` → `lineChoices(...)` → dialogue choices
 * (`flow.ride.ln:<line>:<from>:<to>`), the pre-filled trip / tour boarding → `lineChoices(..., { to })`, ui/Hud.tsx's
 * RideBanner → `lineRideLabel(...)`. Seconds come from the running systems (BusSystem / LightRailSystem `rideSeconds`),
 * so every time shown is the time the ride really takes (plan §4).
 *
 * - loop stop: the next 3 stops (★ = the stop serves an attraction), 坐一圈（约 14 分钟，BAYBAY 讲解）, 看线路图, 先不坐;
 * - Metro station: the next stop each way, the ★ stops (majors with an attraction) and both termini, nearest first;
 * - at most 6 ride choices on a phone (`max`), the "map" and "not now" rows always last;
 * - pre-filled (a trip / tour leg): one confirm row "上车 · 坐到 石镇（约 70 秒）" and 先不坐.
 */

export interface LineStopLite { id: string; name: Bilingual; at: number; major?: boolean }
export interface LineLite { id: W4LineId | string; kind: 'bus' | 'light-rail'; name: Bilingual; loop?: boolean; stops: LineStopLite[]; tunnels?: { fromAt: number; toAt: number }[] }

export type LineChoiceKind = 'ride' | 'lap' | 'map' | 'cancel';
export interface LineChoice {
  kind: LineChoiceKind;
  label: Bilingual;
  line?: string;
  to?: string;
  dir?: 1 | -1;
  seconds?: number;
  /** the destination serves an attraction (★) */
  star?: boolean;
}

export interface LineChoiceOptions {
  /** seconds of the ride from → to on this line (the systems' rideSeconds) */
  rideSeconds: (line: string, from: string, to: string) => number;
  /** max ride rows (6 on phones, 8 on desktop) */
  max?: number;
  /** pre-filled boarding: the destination of the trip / tour leg */
  to?: string;
}

const star = (id: string) => (STOP_ATTRACTIONS[id]?.length ?? 0) > 0;
const secs = (s: number) => Math.max(1, Math.round(s));
const minutes = (s: number) => Math.max(1, Math.round(s / 60));
/** "约 39 秒" under 90 s, else "约 2 分钟" (the boarding rows and the banner say it the same way) */
const duration = (seconds: number): Bilingual => (seconds >= 90 ? { zh: `约 ${minutes(seconds)} 分钟`, en: `~${minutes(seconds)} min` } : { zh: `约 ${secs(seconds)} 秒`, en: `~${secs(seconds)}s` });

function rideLabel(line: LineLite, to: LineStopLite, seconds: number, prefix?: Bilingual): Bilingual {
  const mark = star(to.id) ? '★ ' : '';
  const t = duration(seconds);
  // (integration, phone check: "N Judah · to ★ Judah & La Playa · Ocean Beach (~3 min)" wrapped to four lines in a
  // 390 px dialogue row) — the Metro rows lead with the line letter in English, destinations use their short names
  const letter = W4_LINES[line.id as W4LineId]?.short;
  const lead = prefix ?? (line.kind === 'bus' ? { zh: '去', en: 'To' } : { zh: `${line.name.zh} · 去`, en: `${letter ?? line.name.en} · to` });
  const name = w4StationShort(to.id) ?? to.name;
  return { zh: `${lead.zh} ${mark}${name.zh}（${t.zh}）`, en: `${lead.en} ${mark}${name.en} (${t.en})` };
}

/** The boarding choices at station `from` of `line`. */
export function lineChoices(line: LineLite, from: string, o: LineChoiceOptions): LineChoice[] {
  const stops = line.stops.slice().sort((a, b) => a.at - b.at);
  const here = stops.findIndex(s => s.id === from);
  if (here < 0) return [{ kind: 'cancel', label: { zh: '先不坐了', en: 'Not now' } }];
  const cancel: LineChoice = { kind: 'cancel', label: { zh: '先不坐了', en: 'Not now' } };
  const dirTo = (to: LineStopLite): 1 | -1 => (to.at > stops[here].at ? 1 : -1);
  // pre-filled: one confirm row
  if (o.to && o.to !== from) {
    const to = stops.find(s => s.id === o.to);
    if (to) {
      const seconds = o.rideSeconds(line.id, from, to.id);
      return [
        { kind: 'ride', line: line.id, to: to.id, dir: line.loop ? 1 : dirTo(to), seconds, star: star(to.id), label: rideLabel(line, to, seconds, { zh: '上车 · 坐到', en: 'Board · ride to' }) },
        cancel,
      ];
    }
  }
  const max = o.max ?? 6;
  const rides: LineChoice[] = [];
  const add = (to: LineStopLite, dir: 1 | -1) => {
    if (to.id === from || rides.some(r => r.to === to.id)) return;
    const seconds = o.rideSeconds(line.id, from, to.id);
    rides.push({ kind: 'ride', line: line.id, to: to.id, dir, seconds, star: star(to.id), label: rideLabel(line, to, seconds) });
  };
  if (line.loop) {
    for (let k = 1; k <= 3 && k < stops.length; k++) add(stops[(here + k) % stops.length], 1);
    const lap = o.rideSeconds(line.id, from, from);
    const out = rides.slice(0, max);
    out.push({ kind: 'lap', line: line.id, to: from, dir: 1, seconds: lap, label: { zh: `坐一圈（约 ${minutes(lap)} 分钟，BAYBAY 讲解）`, en: `Ride the whole loop (~${minutes(lap)} min, BAYBAY guides)` } });
    out.push({ kind: 'map', line: line.id, label: { zh: '看线路图', en: 'See the route map' } }, cancel);
    return out;
  }
  // Metro: the next stop each way, then the termini, then the ★ stops — those beyond the tunnel the rider stands in
  // first (its neighbours are one "next stop" away), nearest first
  if (here + 1 < stops.length) add(stops[here + 1], 1);
  if (here - 1 >= 0) add(stops[here - 1], -1);
  const tunnelOf = (at: number) => (line.tunnels ?? []).findIndex(t => at >= t.fromAt - 0.5 && at <= t.toAt + 0.5);
  const hereTunnel = tunnelOf(stops[here].at);
  const rank = (i: number, at: number) => (i === 0 || i === stops.length - 1 ? 0 : hereTunnel >= 0 && tunnelOf(at) === hereTunnel ? 2 : 1);
  const rest = stops
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => i !== here && (i === 0 || i === stops.length - 1 || (s.major && star(s.id))))
    .sort((a, b) => rank(a.i, a.s.at) - rank(b.i, b.s.at) || Math.abs(a.s.at - stops[here].at) - Math.abs(b.s.at - stops[here].at));
  for (const { s } of rest) add(s, dirTo(s));
  const out = rides.slice(0, max);
  out.push({ kind: 'map', line: line.id, label: { zh: '看线路图', en: 'See the route map' } }, cancel);
  return out;
}

export interface LineRideLabel {
  icon: 'bus' | 'metro';
  /** stage 'waiting' */
  waiting: Bilingual;
  /**
   * The slots of today's RideBanner (game/transit.ts `RideLabel`: `lineTo` + <strong>`dest`</strong>), so `rideLabel()` can
   * return this as is: "N 线 · 开往" + "海洋海滩"; the loop (hop on, hop off) leads with its next stop: "观光环线 · 下一站" + "艺术宫".
   */
  lineTo: Bilingual;
  dest: Bilingual | null;
  /** one line for a wider banner: "观光环线 · 下一站 艺术宫 · 约 39 秒" / "N 线 · 开往 海洋海滩 · 下一站 Carl & Hillway · UCSF" */
  title: Bilingual;
  next: Bilingual | null;
  /** 提前下车 allowed (no part of the train in a tunnel or under a hood) and the note when it is not */
  canHopOff: boolean;
  hopOffNote: Bilingual | null;
}

/**
 * What the ride banner shows for a bus / Metro ride (status fields from BusRideStatus / RailRideStatus). Destinations use
 * the stations' short names ("石镇", "海洋海滩": data/sf/stationNames.ts `w4StationShort`): the full names carry a
 * " · gloss" that reads as another part of the "开往 … · 下一站 …" line on a phone.
 */
export function lineRideLabel(line: LineLite, s: { phase: string; eta: number; nextStop: string | null; nextEta: number; underground?: boolean; portalWait?: boolean; canHopOff?: boolean }, destination: string): LineRideLabel {
  const stopName = (id: string | null) => line.stops.find(q => q.id === id)?.name ?? null;
  const shortName = (id: string | null) => (id ? w4StationShort(id) ?? stopName(id) : null);
  const dest = shortName(destination);
  const next = stopName(s.nextStop), nextShort = shortName(s.nextStop);
  const bus = line.kind === 'bus';
  const lineName = W4_LINES[line.id as W4LineId]?.shortName ?? line.name;
  const eta = Math.max(1, Math.round(s.phase === 'coming' ? s.eta : s.nextEta));
  const t = duration(eta);
  const title: Bilingual = bus
    ? { zh: `${lineName.zh}${nextShort ? ` · 下一站 ${nextShort.zh} · ${t.zh}` : ''}`, en: `${lineName.en}${nextShort ? ` · next ${nextShort.en} · ${t.en}` : ''}` }
    : { zh: `${lineName.zh} · 开往 ${dest?.zh ?? ''}${next ? ` · 下一站 ${next.zh}` : ''}`, en: `${lineName.en} · to ${dest?.en ?? ''}${next ? ` · next ${next.en}` : ''}` };
  const canHopOff = s.canHopOff ?? !s.underground;
  return {
    icon: bus ? 'bus' : 'metro',
    waiting: bus ? { zh: `等观光巴士进站…${t.zh}`, en: `Waiting for the tour bus… ${t.en}` } : { zh: `等 ${lineName.zh}进站…${t.zh}`, en: `Waiting for the ${lineName.en}… ${t.en}` },
    lineTo: bus ? { zh: `${lineName.zh} · 下一站`, en: `${lineName.en} · next` } : { zh: `${lineName.zh} · 开往`, en: `${lineName.en} · to` },
    dest: bus ? nextShort ?? dest : dest,
    title,
    next,
    canHopOff,
    hopOffNote: canHopOff ? null : s.portalWait ? { zh: '马上出隧道…', en: 'Coming out of the tunnel…' } : { zh: '隧道里不能下车', en: 'No getting off inside the tunnel' },
  };
}
