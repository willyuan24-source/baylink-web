import { recordProductEvent, type BayBayLatencyEvent } from './product-events';

/** The latency target's bands: <3 s, 3–8 s, 8–15 s, >15 s. Only BayBay imports this, so it stays out of the boot graph. */
export const bayBayLatencyEvent = (milliseconds: number): BayBayLatencyEvent => milliseconds < 3_000 ? 'baybay_latency_lt3'
  : milliseconds < 8_000 ? 'baybay_latency_3to8' : milliseconds < 15_000 ? 'baybay_latency_8to15' : 'baybay_latency_gt15';

/** One completed BayBay answer: its latency bucket, plus the older fast/slow pair (15 s) that existing reports read. */
export function recordBayBayLatency(milliseconds: number): void {
  recordProductEvent(milliseconds < 15_000 ? 'baybay_fast' : 'baybay_slow');
  recordProductEvent(bayBayLatencyEvent(milliseconds));
}
