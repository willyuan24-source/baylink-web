import { openOverlays } from '../ui/slots';

/**
 * Wave 8 · lane K · W8-K1 — what holds BAYBAY's ambient lines (sf-w8-lead §4 "Overlay gate").
 *
 * BAYBAY's unprompted lines (game/cityMoments.ts `stepPacer`: arrival, tour, transit and tunnel lines, the rumours, the
 * pelican moment; game/baybayLines.ts: the event and neighbourhood lines; realsf/index.ts: the Bay's calendar lines;
 * halloween/world.ts: the season's lines; economy/lines.ts `sayWhenFree`) wait while one of these is open: their bubble
 * would sit under the panel / card and the voice would play with no text to read (W7-I, the claw panel and the 螃蟹方向盘
 * line; the neighbourhood greeting under the Halloween postcard). The game's own lines (a claw catch, a skyline answer, a
 * kite gust…) are bubbles the game says itself and are never held by this.
 *
 * Overlay ids are strings on purpose: importing the games' modules would pull their lazy chunks into GameRoot. Never
 * `openOverlays().length`: the play chip ('play-chip') and the first-flight chip ('play-flight') are overlays too, and
 * the glide / stairs / ride lines must go on under them.
 *
 * ADDING A PANEL (lanes M / A / H / W1 / W2 / S): append its overlay id to BAYBAY_HOLD_OVERLAYS — one line, named in
 * your commit. A PlayKit activity with no panel of its own during which BAYBAY must not chatter (she hides, she flies a
 * kite with you, a rhythm game) goes into BAYBAY_HOLD_ACTIVITIES (its `startActivity` id).
 */

/** Overlay ids (ui/slots registerOverlay) that hold BAYBAY's ambient lines while open. Append one line per new panel. */
export const BAYBAY_HOLD_OVERLAYS: readonly string[] = [
  // the play panels and cards (play/*.ts)
  'play-claw', 'play-crab', 'play-dough', 'play-fortune', // lane M (W7): claw, crab net, sourdough, fortune teller
  'play-grip', // lane M (W8): the cable-car grip
  'w2-skyline', // lane W2 (W7): 那是什么？'s three names
  'play-result', // PlayKit's medal card
  'play-snap', // the crest hop's polaroid
  'play-lion-badges', // the sea-lion count
  'play-emotes', // the emote wheel
  // the Halloween postcard (halloween/playPostcardRun.ts H_POSTCARD_OVERLAY)
  'h-postcard',
  // the egg cards (eggs/index.ts)
  'egg-card', 'egg-note', 'egg-operator', 'egg-listen',
  // the city's cards
  'c-album', 'c-letter', // game/album.ts, game/residentTasks.ts
  'realsf-opening', // realsf/openings.ts OVERLAY_ID (a 新店 card)
];

/**
 * PlayKit activity ids (play/kit.ts startActivity) that hold BAYBAY's ambient lines while they run, panel or not: the
 * panel games (their panel may not be up yet: a prompt, a lead-in), hide & seek (she is hiding: a bubble gives her away),
 * the kite (she flies hers beside you and talks the wind), the bell riff (a rhythm game).
 */
export const BAYBAY_HOLD_ACTIVITIES: readonly string[] = [
  'claw', 'crab', 'sourdough', 'fortune', 'skyline', 'kite', 'hide-seek', 'bell',
];

/**
 * Overlays a speech bubble (game/flow.ts bubble) waits behind instead of showing under (the Halloween postcard is a
 * modal card like the city postcard reward, whose bubbles are dropped; this one keeps the last bubble and shows it
 * after the card closes).
 */
export const BUBBLE_WAIT_OVERLAYS: readonly string[] = ['h-postcard'];

let holdSet: ReadonlySet<string> | null = null;
let waitSet: ReadonlySet<string> | null = null;
let activity: string | null = null;

/** play/kit.ts: the running activity's id (null when none runs). */
export function noteHoldActivity(id: string | null): void { activity = id; }
/** The running activity as the hold sees it (tests). */
export const holdActivity = (): string | null => activity;

/** The open overlay that holds BAYBAY's ambient lines now, else null (QA: which one). */
export function holdingOverlay(): string | null {
  holdSet ??= new Set(BAYBAY_HOLD_OVERLAYS);
  for (const o of openOverlays()) if (holdSet.has(o.id)) return o.id;
  return null;
}

/** BAYBAY's ambient lines must wait now (a holding overlay is open, or a holding activity runs). */
export function baybayHeld(): boolean {
  return holdingOverlay() !== null || (activity !== null && BAYBAY_HOLD_ACTIVITIES.includes(activity));
}

/** A speech bubble must wait now (game/flow.ts bubble). */
export function bubbleWaits(): boolean {
  waitSet ??= new Set(BUBBLE_WAIT_OVERLAYS);
  const set = waitSet;
  return openOverlays().some(o => set.has(o.id));
}
