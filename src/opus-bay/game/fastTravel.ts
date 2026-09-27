/**
 * 飞过去 fast travel (lane G1 owns this file from wave 2; plan G1-7). Day-0 stub with the exports other lanes read:
 *
 *   travelActive()   true while a fast-travel trip is running (store move.mode is 'travel' then)
 *   travelEpoch()    increments at every trip start, ?at= teleport and resume: lane F compares the value at boarding
 *                    and at the end of a ride, and never counts a ride goal across a change (anti-cheat)
 *   travelPose()     the sky path pose for lane E2's pelican, rider and BAYBAY while travelling (null otherwise)
 */

export interface TravelPose {
  phase: 'pickup' | 'rise' | 'pan' | 'hold' | 'descent';
  /** 0..1 within the phase */
  t: number;
  x: number;
  y: number;
  z: number;
  heading: number;
}

export function travelActive(): boolean { return false; }
export function travelEpoch(): number { return 0; }
export function travelPose(): TravelPose | null { return null; }
