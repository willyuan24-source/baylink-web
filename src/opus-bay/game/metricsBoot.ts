import { game } from '../core/store';
import { afterFirstFrame } from './firstFrame';
import { importRetry } from './importRetry';

/**
 * Wave 9 · lane S · the metrics boot (review R§5 #9; sf-w9-lead.md §4 "Metrics: lazy after the first frame"). Tiny, in
 * the album's city chunk (game/album.ts initAlbum calls it: city mode only, nothing in GameRoot). From the city's boot it
 * notes when Start was pressed (the title phase ends) and the first frame after play began, so a player who presses
 * Start at once is still timed; `METRICS_DELAY_MS` after the world's first frame it loads the runner
 * (game/metricsRun.ts, its own chunk, `quiet`: a lost request never shows the reload card) and hands it these times.
 */

export const METRICS_DELAY_MS = 1500;

let booted: (() => void) | null = null;

export function bootMetrics(): () => void {
  if (booted || typeof window === 'undefined' || game.get().worldMode !== 'city') return () => {};
  const titleSeen = game.get().phase === 'title';
  let startAt = 0, playAt = 0, asked = false, timer = 0, dead = false, stop: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const tell = () => { for (const fn of [...listeners]) { try { fn(); } catch { /* the runner's own */ } } };
  const see = () => {
    const phase = game.get().phase;
    if (!startAt && phase !== 'title') { startAt = performance.now(); tell(); }
    // the first frame drawn after play began (a frozen main thread delays it: that is what the bucket measures)
    if (!asked && phase === 'playing') { asked = true; requestAnimationFrame(() => { playAt = performance.now(); tell(); }); }
  };
  see();
  const unsub = game.subscribe(see);
  const offFrame = afterFirstFrame(() => {
    timer = window.setTimeout(() => {
      void importRetry(() => import('./metricsRun'), { quiet: true }).then(m => {
        if (dead) return;
        stop = m.runMetrics({ titleSeen, startAt: () => startAt, playAt: () => playAt, listen: fn => { listeners.add(fn); return () => { listeners.delete(fn); }; } });
      }, () => { /* no metrics this visit */ });
    }, METRICS_DELAY_MS);
  });
  booted = () => { dead = true; unsub(); offFrame(); window.clearTimeout(timer); stop?.(); listeners.clear(); booted = null; };
  return booted;
}
