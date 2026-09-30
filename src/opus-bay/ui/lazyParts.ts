/**
 * The HUD parts that are their own chunks (wave 4 integration, lane G): one loader each, shared by the component that
 * mounts the part and the Overlay's prefetch a few seconds into play. GameRoot does not carry them.
 *
 *   RideBanner   during a ride (ui/RideBanner.tsx)
 *   MoveChip     keyboard / pad: on a vehicle, gliding, seated, riding, the glide button once unlocked (ui/MoveChip.tsx)
 *   GuideLayer   city mode only: the trip pill, the arrival toast / card, the panorama tags, the trip card, the lead chip
 */
import { importRetry } from '../game/importRetry';

// (W7-P3: a lost request is fetched again: game/importRetry.ts)
export const loadRideBanner = () => importRetry(() => import('./RideBanner'));
export const loadMoveChip = () => importRetry(() => import('./MoveChip'));
export const loadGuideLayer = () => importRetry(() => import('./GuideLayer'));
