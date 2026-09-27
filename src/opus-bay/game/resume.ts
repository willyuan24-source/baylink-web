import { startGame } from './flow';

/**
 * 继续上次的位置 (lane G1 owns this file from wave 2; plan G1-10). Day-0 stub: ui/Overlay.tsx calls startOrResume()
 * when the title's Start is pressed; with no resume request pending it is exactly the old startGame().
 *
 * G1 fills in: the title's "continue" button records a request (data/save.ts requestResume, dependency-free so the
 * title chunk stays small); startOrResume() then awaits the city around the saved spot (cityStreamer().whenReady),
 * teleports to arrivalSpot and calls beginPlaying('local') instead of playing the arrival cinematic.
 */
export function startOrResume(): void {
  startGame();
}
