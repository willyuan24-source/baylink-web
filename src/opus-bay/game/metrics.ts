import { emit, type GameEvent } from '../core/events';

/**
 * Wave 9 · lane S · the metrics contract (docs/opus-bay/sf-w9-lead.md §4 "Metrics"; review R§5 #9, §9).
 *
 *   track(what, bucket?)   one funnel step: `track('real', 'ics')`, `track('share', 'card')`, `track('tour', 'ch3')`.
 *                          A no-op until the runner is in (game/metricsRun.ts, a lazy chunk loaded after the first frame,
 *                          city mode only); never throws; the bucket must be one fixed word of game/metricNames.ts
 *                          (anything else is dropped) — never an id, free text, a URL or a coordinate.
 *
 * It is only an emit on the core/events.ts bus (`{ type: 'metric' }`): a module in GameRoot's static graph can emit the
 * event itself and pay nothing. What is counted and sent, and when, is game/metricsRun.ts's business.
 */

export type MetricWhat = Extract<GameEvent, { type: 'metric' }>['what'];

export function track(what: MetricWhat, bucket?: string): void {
  try { emit({ type: 'metric', what, bucket }); } catch { /* metrics never interrupt the game */ }
}
