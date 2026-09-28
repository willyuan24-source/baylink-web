/**
 * Wave 5 · lane E · hint targets (the day-1 hook, plan §4.3): what the 小铺's 寻宝罗盘 (treasure compass) and 明信片放大镜
 * (postcard magnifier) point at, one outing at a time.
 *
 *   registerHintSource(kind, fn)   a lane lists what is still unfound of `kind` (D: eggs / pebbles; E: caches; C or E:
 *                                  postcards). `fn` is called only when a hint is asked for, so it may compute.
 *   hintTarget(kind, from)         the nearest unfound target of `kind` ('any' = of every compass kind) to `from`, or null
 *
 * Dependency-free (types only): lanes import it from their own lazy chunks without pulling the ledger.
 */

export const HINT_KINDS = ['cache', 'egg', 'pebble', 'postcard'] as const;
export type HintKind = (typeof HINT_KINDS)[number];
/** The compass sniffs for these (plan §3.4: the nearest unfound cache / egg / pebble); the magnifier is 'postcard'. */
export const COMPASS_KINDS: readonly HintKind[] = ['cache', 'egg', 'pebble'];

export interface HintSpot { id: string; x: number; z: number }
export interface HintTarget extends HintSpot { kind: HintKind; dist: number }

const sources = new Map<string, { kind: HintKind; fn: () => readonly HintSpot[] }>();

/** List the unfound targets of `kind` under `key` (again with the same key: replaces). Returns the unregister. */
export function registerHintSource(kind: HintKind, fn: () => readonly HintSpot[], key: string = kind): () => void {
  const entry = { kind, fn };
  sources.set(key, entry);
  return () => { if (sources.get(key) === entry) sources.delete(key); };
}

/** The nearest unfound target of `kind` to `from` (a source that throws is skipped), or null when none is left. */
export function hintTarget(kind: HintKind | 'any', from: { x: number; z: number }): HintTarget | null {
  let best: HintTarget | null = null;
  for (const s of sources.values()) {
    if (kind === 'any' ? !COMPASS_KINDS.includes(s.kind) : s.kind !== kind) continue;
    let spots: readonly HintSpot[];
    try { spots = s.fn(); } catch { continue; }
    for (const p of spots) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) continue;
      const dist = Math.hypot(p.x - from.x, p.z - from.z);
      if (!best || dist < best.dist) best = { kind: s.kind, id: p.id, x: p.x, z: p.z, dist };
    }
  }
  return best;
}
