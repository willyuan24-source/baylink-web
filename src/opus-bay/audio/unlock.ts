/**
 * W7-Q1 · the iPhone audio unlock, inside the Start tap. Dependency-free and tiny: the page chunk (OpusBayPage, the
 * title) imports it, and so does the lazy audio chunk (audio/audio.ts adopts the context made here).
 *
 * Why: WebKit (Safari, and every iOS browser, WeChat included) starts an AudioContext only from inside a user gesture's
 * handler; Chrome and Firefox accept any later moment once the page has been tapped (sticky activation). The game's
 * 'start' event reaches audio.ts seconds after the Start tap (the page waits for the world's first frame and the play
 * layer's parts), outside the gesture, so on an iPhone the arrival foghorn, the music and BAYBAY's first line stayed
 * silent until a second tap. Now the tap itself primes the page's one context:
 *
 *   primeAudio({ starting })   called synchronously inside a click / keydown / touchend (the title's Start, 继续旅程 and
 *                              从头开始 through OpusBayPage.start, the title's sound button, any title tap via
 *                              audio.ts onGesture): creates the context if the audio chunk has not made one yet, plays
 *                              one silent sample and resumes it. A `starting` prime leaves it running for the arrival;
 *                              any other prime suspends it again once WebKit has seen it start (the title stays quiet;
 *                              a context once started inside a gesture may be resumed later without one).
 *   adoptAudioContext()        audio.ts createContext: the context a tap made, if any (then no second context)
 *   shareAudioContext(c)       audio.ts: the context it made at idle, so a later tap primes that one
 *   releaseAudioContext(c)     audio.ts dispose (it closes the context)
 *   audioProbe                 what the ?debug=1 iOS line reads (audio.ts / voice.ts write their parts)
 *
 * Chrome, Edge, Firefox, Android: nothing happens here (sticky activation already works there, and opening an audio
 * device inside a tap costs 110–370 ms on Windows — the reason audio.ts opens it at idle). `?unlock=1` forces the
 * WebKit path on any browser (QA in Chrome: it proves the wiring, not WebKit's rule — that is the real-iPhone check in
 * docs/opus-bay/iphone-checklist.md).
 */

type AudioCtor = new (options?: AudioContextOptions) => AudioContext;

/** The window parts this module reads (node tests pass a stand-in). */
export interface UnlockWindow {
  AudioContext?: AudioCtor;
  webkitAudioContext?: AudioCtor;
  navigator?: { userAgent?: string; maxTouchPoints?: number; platform?: string };
  location?: { search?: string };
  setTimeout?: (fn: () => void, ms: number) => number;
  clearTimeout?: (id: number) => void;
}

/** Shared state for the ?debug=1 iOS line (ui/iosDebug.ts) and the audio chunk. */
export const audioProbe = {
  /** the page's one context: made here inside a tap, or made by audio.ts at idle and shared */
  ctx: null as AudioContext | null,
  /** primes made inside a tap */
  primes: 0,
  /** a Start / Resume prime happened: the context stays running from then on */
  startPrimed: false,
  /** a prime's resume() resolved with the context running: WebKit saw a gesture start it */
  unlocked: false,
  /** audio.ts took the context a tap had made */
  adopted: false,
  /** audio.ts: the player pressed Start (sound may play) */
  activated: false,
  /** audio/voice.ts: decoded clips held, their bytes, how many were evicted (the clip cache's LRU) */
  clips: 0,
  clipBytes: 0,
  evicted: 0,
};

const winNow = (): UnlockWindow | null => (typeof window !== 'undefined' ? (window as unknown as UnlockWindow) : null);

/**
 * WebKit's gesture rule applies: any iOS / iPadOS browser (all are WebKit: CriOS, FxiOS, WeChat's MicroMessenger …) and
 * desktop Safari. Chromium and Gecko carry their own tokens. `?unlock=1` forces it (QA), `?unlock=0` turns it off.
 */
export function gestureUnlockNeeded(win: UnlockWindow | null = winNow()): boolean {
  if (!win) return false;
  const q = win.location?.search ?? '';
  if (/[?&]unlock=1(?:&|$)/.test(q)) return true;
  if (/[?&]unlock=0(?:&|$)/.test(q)) return false;
  const nav = win.navigator;
  const ua = nav?.userAgent ?? '';
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  // iPadOS 13+ asks for the desktop site: a "Macintosh" with a touch screen
  if (/Macintosh/.test(ua) && (nav?.maxTouchPoints ?? 0) > 1) return true;
  return /AppleWebKit/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS|Android/.test(ua);
}

/** One silent sample played inside the gesture (the classic iOS unlock; audio.ts plays one too at activation). */
export function silentSample(c: AudioContext) {
  try {
    const s = c.createBufferSource();
    s.buffer = c.createBuffer(1, 1, 22050);
    s.connect(c.destination);
    s.start(0);
  } catch { /* ignore */ }
}

function makeContext(win: UnlockWindow): AudioContext | null {
  const Ctor = win.AudioContext ?? win.webkitAudioContext;
  if (!Ctor) return null;
  try { return new Ctor({ latencyHint: 'interactive' }); } catch { return null; }
}

let quietTimer = 0;

/**
 * Inside a tap: create or resume the page's context and play one silent sample. Returns whether it primed (false on
 * browsers that do not need it, or without Web Audio). Never throws.
 */
export function primeAudio(opts: { starting?: boolean } = {}, win: UnlockWindow | null = winNow()): boolean {
  if (!win || !gestureUnlockNeeded(win)) return false;
  try {
    let c = audioProbe.ctx;
    if (!c || c.state === 'closed') { c = makeContext(win); audioProbe.ctx = c; audioProbe.adopted = false; }
    if (!c) return false;
    const ctx = c;
    audioProbe.primes++;
    if (opts.starting) { audioProbe.startPrimed = true; if (quietTimer) { win.clearTimeout?.(quietTimer); quietTimer = 0; } }
    silentSample(ctx);
    const settle = () => {
      if (ctx.state === 'running') audioProbe.unlocked = true;
      // a title tap (not Start): quiet again once started — unless Start came meanwhile or audio went live
      if (opts.starting || audioProbe.startPrimed || audioProbe.activated || !win.setTimeout) return;
      if (quietTimer) win.clearTimeout?.(quietTimer);
      quietTimer = win.setTimeout(() => {
        quietTimer = 0;
        if (!audioProbe.startPrimed && !audioProbe.activated && audioProbe.ctx === ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
      }, 400);
    };
    // 'suspended' or iOS 'interrupted' (a call, another app took the audio session)
    if ((ctx.state as string) !== 'running') ctx.resume().then(settle, () => { /* not a gesture WebKit accepts */ });
    else settle();
    return true;
  } catch { return false; }
}

/** audio.ts createContext: the context a tap made (still open), which it uses instead of making a second one. */
export function adoptAudioContext(): AudioContext | null {
  const c = audioProbe.ctx;
  if (!c || c.state === 'closed') return null;
  audioProbe.adopted = true;
  return c;
}

/** audio.ts: the context it made itself (at idle), so the Start tap primes that one. */
export function shareAudioContext(c: AudioContext) { audioProbe.ctx = c; audioProbe.adopted = false; }

/** audio.ts dispose: it closes its context (a world switch or unmount makes a new one). */
export function releaseAudioContext(c: AudioContext | null) {
  if (c && audioProbe.ctx === c) audioProbe.ctx = null;
  audioProbe.activated = false;
}

/** Tests. */
export function resetUnlockForTests() {
  audioProbe.ctx = null; audioProbe.primes = 0; audioProbe.startPrimed = false; audioProbe.unlocked = false;
  audioProbe.adopted = false; audioProbe.activated = false; audioProbe.clips = 0; audioProbe.clipBytes = 0; audioProbe.evicted = 0;
  quietTimer = 0;
}
