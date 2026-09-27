import type { TimeOfDay } from '../../core/store';

/**
 * City haze (lane C2-4, checkpoint §3.1 issue 2 / CS-2). The time presets' FogExp2 densities are tuned for the
 * district (≈ 300 u across): over the whole city, downtown seen from Twin Peaks (≈ 900 u) sat under a 62–98 % fog
 * factor, and the old thinning measured height above the *local* ground, so the summit (≈ 10 u above its own ground)
 * got none. `cityFogK` scales the preset density (a uniform: no program ever recompiles) by
 *
 *   altitude     camera y above the water, 20 → 70 u        ×1 → ×0.45   (the Twin Peaks summit is y ≈ 50–60)
 *   height       camera above the ground under it, 30 → 150 u ×1 → ×0.4   (the old FOG_HIGH: QA / glide views)
 *   time         a per-time city scale, blended in from y 15 to 45 (morning stays the softest, night the clearest)
 *
 * A walking camera below y 15 (the waterfront, downtown, the Mission, the Sunset flats) keeps exactly today's fog.
 */
export const CITY_FOG = {
  altitude: { y0: 20, y1: 70, k: 0.45 },
  height: { y0: 30, y1: 150, k: 0.4 },
  time: { y0: 15, y1: 45, k: { morning: 0.85, day: 1, golden: 0.9, night: 0.45 } as Record<TimeOfDay, number> },
} as const;

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Density multiplier of the city fog for a camera at y `camY` over ground `groundY` (pure; 1 = the preset). */
export function cityFogK(camY: number, groundY: number, tod: TimeOfDay): number {
  const F = CITY_FOG;
  const a = 1 + (F.altitude.k - 1) * smooth(F.altitude.y0, F.altitude.y1, camY);
  const h = 1 + (F.height.k - 1) * smooth(F.height.y0, F.height.y1, camY - Math.max(0, groundY));
  const t = 1 + (F.time.k[tod] - 1) * smooth(F.time.y0, F.time.y1, camY);
  return a * h * t;
}

/** FogExp2 fog factor at distance d for density ρ (what the shader computes): 1 − exp(−(ρ·d)²). */
export const fogFactor = (density: number, d: number) => 1 - Math.exp(-((density * d) ** 2));
