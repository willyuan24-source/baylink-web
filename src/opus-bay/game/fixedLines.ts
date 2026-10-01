import type { Bilingual } from '../core/types';

/**
 * Wave 8 · lane K · W8-K3 — BAYBAY's fixed bubbles that replace templated ones in the city (sf-w8-lead §4 Voice: lane
 * X's binder matches a line by its exact zh + en text, so a bubble with a name in it can never be voiced). The name
 * moves to what already shows it (the lead chip / the waypoint label / the ride banner / the slow look's caption) or to
 * a toast next to the bubble. District mode keeps its old bubbles (the district never changes).
 *
 * zh ≤ 45 characters, no numbers, no names: tests/opus-bay-w8-k3-lines.test.ts. Lane X: voice these by their text.
 */
export const W8K_LINES = {
  /** game/flow.ts startFreeLead (问 BAYBAY → 带我去…): was 跟我来！去<name> — the lead chip and the waypoint name it */
  leadGo: { zh: '跟我来！我带你过去～', en: 'Follow me — I’ll take you there!' },
  /** game/flow.ts freeLeadArrived: was 到啦！试试「<verb>」～ — the prompt shows the verb */
  leadArrive: { zh: '到啦！试试看吧～', en: 'Here we are — give it a try!' },
  /** game/tripRun.ts a trip to a plain place ends: was 到啦！这里就是<name> — a toast names the place */
  tripHere: { zh: '到啦！就是这里～', en: 'Here we are!' },
  /** game/tripRun.ts the next leg is a ride: was 去车站，坐车到<stop> — the trip pill names the stop */
  tripToStop: { zh: '去车站，我们坐车过去！', en: 'To the stop — we’ll ride there!' },
  /** game/goToRun.ts the place is where you stand: was <name>就在这里啦！ — a toast names the place */
  goToHere: { zh: '就在这里啦！', en: 'It’s right here!' },
  /** game/lineRides.ts boarding on a trip: was 上车！坐到<stop> — the ride banner names the stop */
  allAboard: { zh: '上车！出发咯～', en: 'All aboard — off we go!' },
  /** play/sit.ts a view spot: was 坐一会儿，看看<name>的风景～ — the slow look's caption names it */
  sitView: { zh: '坐一会儿，看看风景～', en: 'Let’s sit and take in the view.' },
} satisfies Record<string, Bilingual>;
