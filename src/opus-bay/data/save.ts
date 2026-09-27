/**
 * Save v2 (lane G1 owns this file from wave 2; plan G1-3). DEPENDENCY-FREE (no three, no game modules): the title
 * screen imports it. Day-0 stub with the functions other lanes call:
 *
 *   noteRide(lineId)       lane F, after a counted stop-to-stop ride (save v2 `rides`)
 *   readSave()             the validated save or null (G1: decoded as untrusted input, ≤ 64 KB, version 2)
 *   requestResume() / takeResumeRequest()   the title's "继续上次的位置" → game/resume.ts startOrResume
 */

export interface SaveV2 {
  version: 2;
  /** last safe spot per world mode */
  lastSafe?: { world: 'district' | 'city'; x: number; z: number; heading: number; zone?: string };
  discovered?: string[];
  zones?: string[];
  rides?: Record<string, number>;
  vehicles?: { bike?: { id: string; x: number; z: number; heading: number }; car?: { x: number; z: number; heading: number } };
}

export function readSave(): SaveV2 | null { return null; }

/** lane F: one counted ride on `lineId` (day 0: a no-op) */
export const noteRide: (lineId: string) => void = () => {};

let resumeRequested = false;
export function requestResume() { resumeRequested = true; }
/** true once after requestResume() (game/resume.ts reads it) */
export function takeResumeRequest(): boolean { const r = resumeRequested; resumeRequested = false; return r; }
