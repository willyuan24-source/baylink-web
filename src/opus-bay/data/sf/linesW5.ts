import type { TourLine } from './tourLines';

/**
 * Wave 5 · lane C · W5-C6: BAYBAY's new fixed lines of lane C (plan sf-w5-plan.md §4.6 "C's own new lines … frozen with
 * a tag for V"): the pelican moment (W5-C2), the welcome back and the goals step (W5-C3), the Golden Gate deck crossing
 * (W5-C5). Data only (a type import): data/sf/tourLines.ts adds them to its id lookup, so a paced line offered by id
 * (game/cityMoments.ts offerLine) carries its voice id, and lane V records them with the tour narration (H5-3, the Pixie
 * preset, clip `<lang>-<id>` in data/sf/voiceTour.ts). Until a clip exists a line plays as a text bubble.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 * │ FROZEN 2026-09-28 (W5_C_LINES_FROZEN; git tag `w5-c-lines-frozen`). An id never changes its words once pushed: │
 * │ a new wording is a NEW id (and a new recording). Snapshot-tested in tests/opus-bay-w5-content.test.ts.        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Not in the set (text only, never recorded): lines that name the device's control (想飞的时候点「起飞」就行～ / 按 G),
 * lines with a place filled in (欢迎回来！上次我们走到唐人街了。), rumours (lane D's texts in lane C's 听说… frames) and
 * button labels. Each text: one idea, zh ≤ 45, en ≤ 110, the VOICE.md glossary; a fact carries its source and date.
 */

export const W5_C_LINES_FROZEN = '2026-09-28';

const L = (id: string, zh: string, en: string, mood: TourLine['mood'], url?: string): TourLine =>
  ({ id, zh, en, mood, ...(url ? { source: { url, verifiedAt: W5_C_LINES_FROZEN } } : {}) });

/** The pelican moment (W5-C2, plan MF3). */
export const W5_PELICAN = {
  /** BAYBAY's question at the unlock (the dialogue with 试试起飞 · 以后再说) */
  ask: L('w5c-pelican-ask', '以后想去哪都能飞啦！先试试起飞？', 'Now we can fly anywhere! Want to try a take-off?', 'excited'),
  /** 试试起飞 → the first flight */
  go: L('w5c-pelican-go', '抓稳啦，我们出发！', 'Hold on tight — here we go!', 'excited'),
  /** the Grand Tour's first stop meets the pelican (a line, no dialogue) */
  tour: L('w5c-pelican-tour', '送你一位鹈鹕朋友！以后想去哪都能飞～', 'Meet your pelican friend — now we can fly anywhere!', 'excited'),
  /** BAYBAY's first free-roam suggestion while goal #1 is open */
  nudge: L('w5c-pelican-nudge', '先去科伊特塔找鹈鹕朋友吧！之后想去哪都能飞～', "Let's meet the pelican at Coit Tower first — then we can fly anywhere!", 'point'),
} as const;

/** The welcome back and the goals step (W5-C3, plan MF6). */
export const W5_WELCOME = {
  /** a resumed player whose area has no name */
  back: L('w5c-welcome-back', '欢迎回来！我们接着逛吧。', "Welcome back! Let's keep exploring.", 'wave'),
  /** free roam again, with the pelican met */
  freeAgain: L('w5c-free-again', '好嘞，你带路，我跟着！想去哪儿就叫我～', "Okay — you lead, I'll follow! Call me when you want to go somewhere.", 'happy'),
  /** the goals step's opening line */
  goalsIntro: L('w5c-goals-intro', '好嘞，整座旧金山都给你逛！先看看这几个小目标～', 'All of San Francisco is yours! Here are a few little goals~', 'excited'),
} as const;

/** The Golden Gate deck crossing, said on the deck while the goal is open (W5-C5, plan MF2). */
export const W5_DECK = {
  /** the first tower passed was the south one (local x −89.29) */
  south: L('w5c-deck-south', '南塔到啦！走到北塔，就算走过金门大桥～', 'The south tower! Walk on to the north tower to cross the bridge.', 'point'),
  north: L('w5c-deck-north', '北塔到啦！走到南塔，就算走过金门大桥～', 'The north tower! Walk on to the south tower to cross the bridge.', 'point'),
  half: L('w5c-deck-half', '走到一半啦！脚下就是金门海峡。', 'Halfway! Right below us is the Golden Gate strait.', 'happy'),
  // goldengate.org design & construction stats (checked 2026-09-28): "distance between towers is 4,200 ft (1,280 m)"
  done: L('w5c-deck-done', '走过金门大桥啦！两座塔之间有 1280 米！', 'We crossed the Golden Gate Bridge — 1,280 m from tower to tower!', 'proud',
    'https://www.goldengate.org/bridge/history-research/statistics-data/design-construction-stats/'),
} as const;

/** Every frozen wave-5 lane-C line, in recording order (lane V's script). */
export const W5_C_LINES: readonly TourLine[] = [
  ...Object.values(W5_PELICAN),
  ...Object.values(W5_WELCOME),
  ...Object.values(W5_DECK),
];

/** The Bilingual text of a frozen line (for bubbles and dialogue nodes that show it as text). */
export const w5Text = (line: TourLine) => ({ zh: line.zh, en: line.en });
