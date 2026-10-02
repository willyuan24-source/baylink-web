import type { Bilingual, Mood } from '../core/types';

/**
 * Wave 4 · lane C · part 2: BAYBAY's tour, transit and arrival lines, one at a time (lane V's early review, open item
 * 4: the tour clips run 2.2–8.1 s and `voice.line` bypasses CLIP_GAP, so two lines emitted back to back overlap).
 *
 * THE RULE: no next line until the previous clip's `TOUR_VOICE_CLIPS['<lang>-<id>'].duration` (lane V,
 * data/sf/voiceTour.ts) plus PACER_GAP has passed; a line without a recorded clip holds for its bubble's reading time
 * (the same formula as data/sf/lines.ts `lineMs`). Two more rules ride along:
 * - once per stop (lane C's review O6): a tour stop's `arrive` is often the very frozen line the transit narration
 *   picks for that stop (`loop-golden-gate-bridge-arrive` from the loop and from the tour stop, `metro-board-n` as the
 *   stop's lead and on the board event): a key offered again within REPEAT_GAP (= audio/voice.ts SAME_CLIP_GAP) is
 *   dropped;
 * - never late: a line about a moment that passes (a stop's approach) carries a `ttl` and is dropped when it cannot
 *   start in time, instead of being said after the bus has left.
 *
 * PURE (seconds on a clock the caller passes: performance.now() / 1000; a fake clock in the tests) and light (types
 * only): the city tour engine, the transit narration and the arrival moments `offer()`; one city system `step()`s it
 * at 4–10 Hz and shows what comes out:
 *
 *   // the clip lengths: lane V's TOUR_VOICE_CLIPS (lazy, with the tour data) in the voice language. NOT
 *   // VoicePlayer.lang(): audio/voice.ts lives in the lazily loaded audio chunk; voiceLang(getLocale()) is the same rule
 *   const pacer = new LinePacer(clipSecondsFrom(TOUR_VOICE_CLIPS, () => voiceLang(getLocale())));
 *   pacer.offer({ text, voice: 'loop-castro-approach', mood, ttl: LINE_TTL.approach }, now);
 *   // held (review 2) by G2's `silent` gate of game/baybayLines.ts (dialogue, cinematics, fast travel, photo mode,
 *   // fishing, paused, AND a postcard reward: flow.ts bubble() drops every bubble then, so a line stepped out would lose
 *   // its text and still play its voice) and by a bubble that is not the pacer's own (a G2 city line is speaking:
 *   // its clip would overlap; G2's lines already wait for any bubble, so they never talk over the pacer)
 *   const held = silent || (!!f.bubble && f.bubble.text !== last?.text);
 *   const said = pacer.step(now, held);
 *   if (said) { last = said; bubble(said.text, said.bubbleMs); if (said.voiced) emit({ type: 'voice-line', id: said.voice! }); }
 *
 * Repeats (review 2): a key is not said again within `line.repeatGap ?? REPEAT_GAP` seconds of its last saying. The
 * transit narration (data/sf/tours.ts `transitSay`) uses NARRATION_REPEAT, so the second N / M boarding of one outing
 * (the Grand Tour boards each twice) and a stop's lead line said again on board after a long wait stay quiet.
 */

export interface PacedLine {
  text: Bilingual;
  /** the voice-line id (a frozen tourLines id: clip `<lang>-<id>`), or none for a text-only bubble */
  voice?: string | null;
  mood?: Mood;
  /** seconds after `offer()` the line may still start (default: no limit) */
  ttl?: number;
  /** the once-per-stop key (default: the voice id, else the zh text) */
  key?: string;
  /** seconds after its last saying before this key may be said again (default REPEAT_GAP) */
  repeatGap?: number;
  /**
   * W8-W2-review (P1): while it waits, the line still fits where the player is (a place line: the player is still at the
   * place); false drops it, like an expired ttl, so a line never plays somewhere else after a fast travel
   */
  valid?: () => boolean;
  /** W8-W2-review (P3): called when the line is actually said (its bubble shown), not when it is queued */
  onSay?: () => void;
}

export interface SaidLine extends PacedLine {
  /** the clock time it starts */
  at: number;
  /** how long it holds the voice (the clip, or the reading time) */
  seconds: number;
  /** a recorded clip exists for the current language: emit the `voice-line` event (else text only, no chirp) */
  voiced: boolean;
  /** the bubble's duration in ms: the reading time or the clip, whichever is longer, + 300 ms */
  bubbleMs: number;
}

/** Seconds of a line's recorded clip in the current language, or undefined when there is none. */
export type ClipSeconds = (voice: string) => number | undefined;

/** A short breath between two lines (s). */
export const PACER_GAP = 0.6;
/** The same key again only after this long (s; = audio/voice.ts SAME_CLIP_GAP). */
export const REPEAT_GAP = 25;
/** Lines waiting at most (the oldest is dropped). */
export const PACER_MAX = 4;
/**
 * The transit narration's repeat window (s): a boarding / sight line is said once in five minutes. The Grand Tour
 * boards the N twice (135 s apart) and the M twice (157 s) and passes Winston again on the way back (105 s); a stop's
 * lead that is also the board line (`metro-board-n`) waits for the train up to ≈ 35 s (lane T's dispatch: 20 + 15 s).
 * A loop lap (≈ 13.5 min) still narrates every lap.
 */
export const NARRATION_REPEAT = 300;

/**
 * How long each kind of line may wait (s). A loop stop's approach fires ≈ 60 u before the stop, ≈ 7.3 s before the bus
 * stands (lane V's review: 12 u/s with the 2.6 u/s² brake); the dwell is 8 s; a chapter intro may wait for the ride's
 * last line.
 */
export const LINE_TTL = { approach: 5, arrive: 8, tip: 8, board: 8, portal: 6, arrival: 15, stop: 20, chapter: 30 } as const;

/** The reading time of a bubble (s): data/sf/lines.ts lineMs / 1000 (tested equal). */
export function readSeconds(text: Bilingual): number {
  const zh = [...text.zh].length, en = text.en.length;
  return Math.round(Math.min(5600, Math.max(2600, 1400 + Math.max(zh * 110, en * 42)))) / 1000;
}

/** The voice language of a UI locale: audio/voice.ts VoicePlayer.lang() ('en' → en, zh-Hans / zh-Hant → zh). */
export const voiceLang = (locale: string): 'zh' | 'en' => (locale === 'en' ? 'en' : 'zh');

/**
 * The pacer's clip lookup: `<lang>-<id>` in a clip table (lane V's TOUR_VOICE_CLIPS), read at each line so a language
 * switch mid-tour times the next line by the new language's clip.
 */
export function clipSecondsFrom(clips: Readonly<Record<string, { duration: number }>>, lang: () => 'zh' | 'en'): ClipSeconds {
  return voice => clips[`${lang()}-${voice}`]?.duration;
}

interface Waiting { line: PacedLine; key: string; deadline: number }

export class LinePacer {
  private queue: Waiting[] = [];
  private said = new Map<string, number>();
  private until = -Infinity;
  private longestGap: number;
  private readonly clipSeconds: ClipSeconds;
  private readonly gap: number;
  private readonly repeatGap: number;
  private readonly max: number;

  constructor(clipSeconds: ClipSeconds = () => undefined, opts: { gap?: number; repeatGap?: number; max?: number } = {}) {
    this.clipSeconds = clipSeconds;
    this.gap = opts.gap ?? PACER_GAP;
    this.repeatGap = opts.repeatGap ?? REPEAT_GAP;
    this.max = opts.max ?? PACER_MAX;
    this.longestGap = this.repeatGap;
  }

  static keyOf(line: PacedLine): string { return line.key ?? line.voice ?? `text:${line.text.zh}`; }

  /**
   * Queue a line; false when it is a repeat (said within its repeat gap, or already waiting: the waiting one then
   * keeps the later of the two deadlines, so a stop's line offered with a longer ttl is not lost with the transit
   * copy's shorter one).
   */
  offer(line: PacedLine, now: number): boolean {
    const key = LinePacer.keyOf(line);
    const last = this.said.get(key);
    const repeatGap = line.repeatGap ?? this.repeatGap;
    if (last !== undefined && now - last < repeatGap) return false;
    const deadline = line.ttl === undefined ? Infinity : now + line.ttl;
    for (const w of this.queue) if (w.key === key) { if (deadline > w.deadline) w.deadline = deadline; return false; }
    if (repeatGap > this.longestGap) this.longestGap = repeatGap;
    if (this.said.size > 256) for (const [k, t] of this.said) if (now - t >= this.longestGap) this.said.delete(k);
    this.queue.push({ line, key, deadline });
    while (this.queue.length > this.max) this.queue.shift();
    return true;
  }

  /** The line to say now, or null (still speaking, blocked, or nothing waiting). Expired (or no longer valid) lines are dropped here. */
  step(now: number, blocked = false): SaidLine | null {
    // drop the expired lines in place (no array per call: a city system steps this several times a second)
    let n = 0;
    for (const w of this.queue) if (now <= w.deadline && (!w.line.valid || w.line.valid())) this.queue[n++] = w;
    this.queue.length = n;
    if (blocked || now < this.until || !n) return null;
    const { line, key } = this.queue.shift()!;
    const clip = line.voice ? this.clipSeconds(line.voice) : undefined;
    const voiced = clip !== undefined && Number.isFinite(clip) && clip > 0;
    const read = readSeconds(line.text);
    const seconds = voiced ? clip : read;
    this.until = now + seconds + this.gap;
    this.said.set(key, now);
    return { ...line, at: now, seconds, voiced, bubbleMs: Math.round(Math.max(read, seconds) * 1000) + 300 };
  }

  /** The clock time the current line (and its gap) ends. */
  get busyUntil(): number { return this.until; }
  isBusy(now: number): boolean { return now < this.until; }
  pending(): number { return this.queue.length; }

  /** Drop what waits (the tour was cancelled or ended); the line being spoken keeps its time. */
  clear(): void { this.queue = []; }
}
