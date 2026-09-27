/**
 * Work kept off the input path (lead note P1). Long setup — the noise and reverb buffers, the shore distance field —
 * is written as generator jobs that yield after every small unit of work (a few thousand samples, a few land tests),
 * and runs here in slices of at most SLICE_MS: in idle callbacks where the browser has them (Chrome, Firefox), else
 * one slice right after each frame (Safari). While the tab is hidden the frame fallback simply pauses.
 * No Web Audio in here; node tests drive the runner with a fake host.
 */

/** Longest slice (ms) the runner takes before handing the main thread back (the last unit may run a little over). */
export const SLICE_MS = 4;

/** A job: yields between units of work, returns its result. */
export type Job<T> = Generator<void, T, void>;

/** Where slices run: a clock and a way to ask for the next slice (returns a cancel function). */
export interface SliceHost {
  now(): number;
  next(run: () => void): () => void;
}

export interface Sliced<T> {
  readonly done: Promise<T>;
  cancel(): void;
  /** slices run so far, the longest one and the first 64 durations (ms), for QA and tests */
  readonly stats: { slices: number; longest: number; times: number[] };
}

type IdleWindow = {
  requestIdleCallback?: (fn: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
  requestAnimationFrame?: (fn: () => void) => number;
  cancelAnimationFrame?: (id: number) => void;
};

/** The browser host: idle callbacks (≤ 200 ms late while the page is busy loading), else after the next frame. */
export function browserHost(): SliceHost {
  const g = globalThis as unknown as IdleWindow;
  const now = () => performance.now();
  if (g.requestIdleCallback && g.cancelIdleCallback) {
    const ric = g.requestIdleCallback, cic = g.cancelIdleCallback;
    return { now, next: run => { const id = ric(run, { timeout: 200 }); return () => cic(id); } };
  }
  if (g.requestAnimationFrame && g.cancelAnimationFrame) {
    const raf = g.requestAnimationFrame, caf = g.cancelAnimationFrame;
    return {
      now,
      next: run => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const id = raf(() => { timer = setTimeout(run, 0); });
        return () => { caf(id); if (timer !== null) clearTimeout(timer); };
      },
    };
  }
  return { now, next: run => { const t = setTimeout(run, 0); return () => clearTimeout(t); } };
}

/** Run a job in slices of ≤ `budget` ms on `host`. A job that throws rejects `done`; `cancel()` leaves it pending. */
export function runSliced<T>(job: Job<T>, host: SliceHost = browserHost(), budget = SLICE_MS): Sliced<T> {
  let cancelNext: (() => void) | null = null;
  let cancelled = false;
  const stats = { slices: 0, longest: 0, times: [] as number[] };
  const done = new Promise<T>((resolve, reject) => {
    const slice = () => {
      cancelNext = null;
      if (cancelled) return;
      const start = host.now();
      const end = start + budget;
      try {
        for (;;) {
          const step = job.next();
          if (step.done) { note(start); resolve(step.value); return; }
          if (host.now() >= end) break;
        }
      } catch (error) {
        note(start);
        reject(error);
        return;
      }
      note(start);
      cancelNext = host.next(slice);
    };
    const note = (start: number) => {
      const ms = host.now() - start;
      stats.slices++;
      stats.longest = Math.max(stats.longest, ms);
      if (stats.times.length < 64) stats.times.push(+ms.toFixed(2));
    };
    cancelNext = host.next(slice);
  });
  return {
    done,
    stats,
    cancel() {
      cancelled = true;
      cancelNext?.();
      cancelNext = null;
      try { job.return(undefined as never); } catch { /* already finished */ }
    },
  };
}

/** Run a job to the end at once (tests, and the synchronous helpers kept for them). */
export function drain<T>(job: Job<T>): T {
  for (;;) {
    const step = job.next();
    if (step.done) return step.value;
  }
}
