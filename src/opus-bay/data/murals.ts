/**
 * Original Mission murals (lane H2b owns this file from wave 2; plan H2b-10, optional). Dependency-free data.
 * Day 0: none, so world/sf/murals.ts attaches nothing.
 */

export interface MuralDef {
  id: string;
  title: { zh: string; en: string };
  /** atlas rect in uv (0..1) */
  rect: { u0: number; v0: number; u1: number; v1: number };
  /** 512 px single for UI cards */
  single?: string;
  /** placement: world x, z (projectCity), yaw (rad), panel width (u) */
  at: { x: number; z: number; yaw: number; width: number };
}

export const MURALS: MuralDef[] = [];
/** the 2048×1024 atlas, or null */
export const MURAL_ATLAS: string | null = null;

/** Every mural file (data/assets.ts listAssetUrls). */
export function muralUrls(): string[] {
  const atlas: string | null = MURAL_ATLAS;
  return [...(atlas ? [atlas] : []), ...MURALS.flatMap(m => (m.single ? [m.single] : []))];
}
