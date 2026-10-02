import { onEvent, type GameEvent } from '../core/events';
import { game, type GameState } from '../core/store';
import { cityTour, tourStops } from '../data/sf/tours';
import { savesOff } from '../data/save';
import { recordProductEvent } from '../../lib/product-events';
import { entrySource } from '../ui/entrySource';
import { lastWelcome, onWelcome, type WelcomeInfo } from './welcome';
import { bayParts, bayNow } from './bayNow';
import {
  OPUS_METRICS_LIVE, SEND_CAP, coldBucket, isOpusEvent, linkAction, metricName, visitBucket, withGameFrom,
  type EntrySourceWord, type OpusEvent,
} from './metricNames';

/**
 * Wave 9 · lane S · the metrics runner (review R§5 #9, §9; sf-w9-lead.md §3 S (3)). A lazy chunk: game/metricsBoot.ts
 * loads it a moment after the world's first frame, city mode only. It listens — core/events.ts onEvent, the store, the
 * welcome (game/welcome.ts), clicks on links inside the game page — and counts the funnel of review §9 under the fixed
 * names of game/metricNames.ts:
 *
 *   opus_title                 the title was on screen (once a page)
 *   opus_start_<from>          Start pressed, by where the visit came from (lane E's ui/entrySource.ts)
 *   opus_cold_start_<bucket>   Start → the first frame after play began (the arrival over: the player can act)
 *   opus_mode_<choice>         the welcome's choice (tour / week / free / local), or resume (继续旅程)
 *   opus_first_card            within 60 s of that: a first arrival, an event / place card or the weekly board
 *   opus_real_action_<a>       a link opened from the game (plan · event · guide · offer · maps · official), a wish
 *                              added, an .ics / anything a lane `track('real', …)`s
 *   opus_share_<photo|card>    a photo / a 约家人 card handed to the share sheet (lane S's album and card)
 *   opus_visit_new · opus_returning_<1d|7d|30d>   once a Bay day, from the last visit's Bay day kept on this device
 *   opus_tour_<chN|done>       a Grand Tour chapter finished during this visit / the whole tour
 *
 * Sent: `official_source_click` (an official / source page opened from the game: a name the API accepts today) through
 * the site's recordProductEvent (no id, no referrer, no URL; nothing under DNT / GPC). The opus_* names are sent only
 * while OPUS_METRICS_LIVE is on (the API rejects unknown names: docs/opus-bay/w9-backend-metrics.patch); until then
 * they are counted in memory (metricsLog(): QA). Every link to the site opened from the game gets `from=opus-bay`.
 * Nothing personal, no free text, no coordinates, no ids — only the names above. DNT / GPC: nothing is sent or kept
 * (the in-memory count still runs for QA). `?save=off` (QA's new player): the visit day is neither read nor written.
 */

/** the device's last-visit key: one Bay day (YYYY-MM-DD) and nothing else */
export const VISIT_KEY = 'opus-bay:visit:v1';
/** how long after the first control a first card counts (ms) */
export const FIRST_CARD_MS = 60_000;

export interface FunnelDeps {
  /** ms clock (performance.now) */
  now(): number;
  /** the counter goes out (only allowed names reach it) */
  send(name: OpusEvent | 'official_source_click'): void;
  /** opus_* names go out (OPUS_METRICS_LIVE) */
  live: boolean;
  /** DNT / GPC: nothing sent, nothing kept */
  privacy: boolean;
}

export interface Funnel {
  /** count a name (caps: a funnel step once a page, an action / share a few times, ≤ SEND_CAP.total sends) */
  count(name: OpusEvent): boolean;
  /** an official / source page was opened (official_source_click, sent today) */
  official(): void;
  /** a `{ type: 'metric' }` bus step */
  step(what: string, bucket?: string): void;
  /** Start pressed at `at` (ms), from `source` */
  started(at: number, source: EntrySourceWord): void;
  /** the first frame of play at `at` (ms) */
  controls(at: number): void;
  /** a real card was seen at `at` (ms): counted once, within FIRST_CARD_MS of the first control */
  card(at: number): void;
  /** what was counted on this page */
  log(): { name: string; n: number; sent: number }[];
}

const ACTION = /^opus_(real_action|share)_/;

/** The counting core (pure over its deps; node-tested). */
export function createFunnel(deps: FunnelDeps): Funnel {
  const counts = new Map<string, { n: number; sent: number }>();
  let sends = 0, startAt = 0, controlAt = 0, started = false, controlled = false, carded = false;
  const out = (name: OpusEvent | 'official_source_click') => {
    if (deps.privacy || sends >= SEND_CAP.total) return false;
    sends++;
    try { deps.send(name); } catch { /* a counter never interrupts the game */ }
    return true;
  };
  const count = (name: OpusEvent): boolean => {
    if (!isOpusEvent(name)) return false;
    const c = counts.get(name) ?? { n: 0, sent: 0 };
    const cap = ACTION.test(name) ? SEND_CAP.action : SEND_CAP.step;
    if (c.n >= cap) return false;
    c.n++;
    counts.set(name, c);
    if (deps.live && out(name)) c.sent++;
    return true;
  };
  return {
    count,
    official() {
      const c = counts.get('official_source_click') ?? { n: 0, sent: 0 };
      if (c.n >= SEND_CAP.action * 2) return;
      c.n++;
      counts.set('official_source_click', c);
      if (out('official_source_click')) c.sent++;
    },
    step(what, bucket) { const name = metricName(what, bucket); if (!name) return; if (name === 'opus_first_card') this.card(deps.now()); else count(name); },
    started(at, source) { if (started) return; started = true; startAt = at; count(`opus_start_${source}` as OpusEvent); },
    controls(at) { if (controlled || !started) return; controlled = true; controlAt = at; count(`opus_cold_start_${coldBucket(at - startAt)}` as OpusEvent); },
    card(at) { if (carded || !controlled || at - controlAt > FIRST_CARD_MS) return; carded = true; count('opus_first_card'); },
    log: () => [...counts].map(([name, c]) => ({ name, ...c })),
  };
}

/** Chapters of a city tour fully done (every non-optional stop of the chapter in `completed`), or null (not a city tour). */
export function chaptersDone(tourId: string | undefined, completed: readonly string[]): { done: boolean[]; total: number } | null {
  const def = tourId ? cityTour(tourId) : undefined;
  if (!def) return null;
  const flat = tourStops(def), have = new Set(completed);
  const done = def.chapters.map((_, ci) => { const mine = flat.filter(f => f.chapter === ci); return mine.length > 0 && mine.every(f => have.has(f.stop.id)); });
  return { done, total: def.chapters.length };
}

/** What a game event counts (pure; the runner calls it for every event). */
export function eventStep(f: Funnel, e: GameEvent, now: number): void {
  if (e.type === 'metric') f.step(e.what, e.bucket);
  else if (e.type === 'wish' && e.added) f.count('opus_real_action_wish');
  else if (e.type === 'arrival' && e.first) f.card(now);
}

/** A real card on screen: an event card, a place / landmark card, the weekly board. */
const cardPanel = (s: Pick<GameState, 'panel'>) => s.panel.kind === 'event' || s.panel.kind === 'poi' || s.panel.kind === 'week';

let funnel: Funnel | null = null;
/** QA: what this page counted (null before the runner started). */
export const metricsLog = () => funnel?.log() ?? null;

const privacyOff = () => {
  try { const n = navigator as Navigator & { globalPrivacyControl?: boolean }; return n.doNotTrack === '1' || !!n.globalPrivacyControl; } catch { return true; }
};

/** What game/metricsBoot.ts saw before this chunk landed (performance.now() ms; 0 = not yet), and its change hook. */
export interface BootTimes { titleSeen: boolean; startAt: () => number; playAt: () => number; listen: (fn: () => void) => () => void }

/** The runner (game/metricsBoot.ts starts it): returns the disposer. */
export function runMetrics(boot: BootTimes): () => void {
  const privacy = privacyOff();
  const f = funnel = createFunnel({
    now: () => performance.now(), live: OPUS_METRICS_LIVE, privacy,
    send: name => recordProductEvent(name),
  });
  const offs: (() => void)[] = [];
  let source: EntrySourceWord = 'direct';
  try { source = entrySource(); } catch { /* direct */ }

  // the visit: once a Bay day per device (not under DNT / GPC, nor for QA's ?save=off)
  if (!privacy && !savesOff()) {
    try {
      const today = bayParts(bayNow()).dateKey;
      const prev = localStorage.getItem(VISIT_KEY);
      if (prev !== today) {
        const b = visitBucket(prev, today);
        if (b) f.count(b === 'new' ? 'opus_visit_new' : (`opus_returning_${b}` as OpusEvent));
        localStorage.setItem(VISIT_KEY, today);
      }
    } catch { /* storage blocked: no visit count */ }
  }
  if (boot.titleSeen) f.count('opus_title');

  // Start and the first control (the boot's times: a fast player is timed even before this chunk landed)
  const times = () => {
    const at = boot.startAt(), play = boot.playAt();
    if (at && boot.titleSeen) { f.started(at, source); if (play) f.controls(play); }
  };
  times();
  offs.push(boot.listen(times));

  // the first card and the tour's chapters (the store; recomputed only when the panel / the tour object changes)
  let panel: GameState['panel'] | null = null, tour: GameState['tour'] | null = null;
  let tourBase: boolean[] | null = null, tourId: string | undefined;
  const look = () => {
    const s = game.get();
    if (s.panel !== panel) { panel = s.panel; if (cardPanel(s)) f.card(performance.now()); }
    if (s.tour === tour) return;
    tour = s.tour;
    const ch = chaptersDone(s.tour.id, s.tour.completed);
    if (!ch) { tourBase = null; return; }
    // (the first look, or another tour: progress brought from an earlier visit is the baseline, not news)
    if (!tourBase || tourId !== s.tour.id) { tourBase = ch.done; tourId = s.tour.id; return; }
    const before = tourBase;
    ch.done.forEach((d, i) => { if (d && !before[i]) f.count(`opus_tour_ch${i + 1}` as OpusEvent); });
    if (ch.done.every(Boolean) && !before.every(Boolean)) f.count('opus_tour_done');
    tourBase = ch.done;
  };
  look();
  offs.push(game.subscribe(look));

  // the welcome's choice (it may have happened before this chunk landed)
  const welcomed = (info: WelcomeInfo) => { f.count(info.choice ? (`opus_mode_${info.choice}` as OpusEvent) : 'opus_mode_resume'); };
  const seen = lastWelcome();
  if (seen) welcomed(seen);
  offs.push(onWelcome((_k, info) => { welcomed(info); }));

  offs.push(onEvent(e => eventStep(f, e, performance.now())));

  // links opened from the game page: from=opus-bay on the site's own, a count for the real-world ones
  const linkOf = (t: EventTarget | null) => (t instanceof Element ? t.closest('a[href]') : null) as HTMLAnchorElement | null;
  const inGame = (a: Element) => !!a.closest('.ob-page');
  const decorate = (e: Event) => {
    const a = linkOf(e.target);
    if (!a || !inGame(a)) return;
    const href = a.getAttribute('href') ?? '';
    const next = withGameFrom(href, location.origin);
    if (next !== href) a.setAttribute('href', next);
  };
  const opened = (e: MouseEvent) => {
    if (e.type === 'auxclick' && e.button !== 1) return;
    decorate(e);
    const a = linkOf(e.target);
    if (!a || !inGame(a)) return;
    const action = linkAction(a.getAttribute('href') ?? '', location.origin, a.getAttribute('download'));
    if (!action) return;
    f.count(`opus_real_action_${action}` as OpusEvent);
    if (action === 'official') f.official();
  };
  const opts2 = { capture: true, passive: true } as const;
  for (const type of ['pointerdown', 'focusin', 'contextmenu'] as const) document.addEventListener(type, decorate, opts2);
  document.addEventListener('click', opened, opts2);
  document.addEventListener('auxclick', opened, opts2);
  offs.push(() => {
    for (const type of ['pointerdown', 'focusin', 'contextmenu'] as const) document.removeEventListener(type, decorate, opts2);
    document.removeEventListener('click', opened, opts2);
    document.removeEventListener('auxclick', opened, opts2);
  });
  return () => { for (const off of offs.splice(0)) { try { off(); } catch { /* gone */ } } funnel = null; };
}
