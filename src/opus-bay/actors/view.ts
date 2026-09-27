import type { Obstacle } from './controller';

/**
 * Per-frame actor state shared between the actor system and the camera rig (plain objects, no three import,
 * so node tests can load the camera maths without the scene code).
 */

/**
 * Smoothed visual state the camera rig follows (ride offsets included), plus who the player is talking to
 * (speaker: 0 none, 1 BAYBAY, 2 a resident) for the conversation two-shot.
 */
export const view = { x: 0, y: 0, z: 0, ground: 0, vx: 0, vz: 0, heading: 0, ready: false, speaker: 0 as 0 | 1 | 2, speakerX: 0, speakerY: 0, speakerZ: 0 };

/**
 * Movement basis for the player controller (A7): normally the camera yaw; while an automatic camera turn happens
 * with a movement key / stick held, the basis stays where it was until the input is released (or 1.5 s), then
 * blends over 0.3 s, so a camera assist never steers the player's walk. Written by actors/camera.ts.
 */
export const moveBasis = { yaw: 0, locked: false };

/**
 * The jogger (A12): where they are and whether they are paused at a loop end (stretching, or waiting because the
 * player walked up). Flow can offer "talk to the jogger" (interactable id `npc-jogger`) while `paused` is true.
 */
export const joggerState = { paused: false, x: 0, z: 0 };

/**
 * Where the residents (NPCs) stand this frame — written by the actor system, read by the camera so a conversation /
 * tour-stop two-shot never puts the lens inside a resident or looks at the pair through one.
 */
export const residents: { x: number; z: number }[] = [];

/**
 * Rideable toys parked in the world (bikes, the toy car): id (data/vehicles.ts), kind, where they are and whether
 * they can be boarded. Written by actors/moveSystem.ts, read by game/interactables.ts (the "骑上单车" prompt follows
 * a moved bike).
 */
export const rideables: { id: string; kind: 'bike' | 'car'; x: number; z: number; free: boolean }[] = [];

/**
 * Day-0 obstacle registry (wave 2): moving things other lanes own (F's crowd walkers and toy traffic) add soft
 * obstacles for the walker and the ride code without editing actors files. `fn(out, x, z, r)` pushes the obstacles
 * within r of (x, z) into `out` (kind e.g. 'crowd' | 'traffic'); it runs once per frame per consumer, so keep it cheap
 * (a grid lookup). Returns the unregister function.
 */
export type ObstacleSource = (out: Obstacle[], x: number, z: number, r: number) => void;
const obstacleSources: ObstacleSource[] = [];
export function registerObstacleSource(fn: ObstacleSource): () => void {
  obstacleSources.push(fn);
  return () => { const i = obstacleSources.indexOf(fn); if (i >= 0) obstacleSources.splice(i, 1); };
}
/** Consumers (actors/system.ts walker obstacles; moveSystem giveWay, E2): append every source's obstacles near (x, z). */
export function collectObstacles(out: Obstacle[], x: number, z: number, r: number) {
  for (const fn of obstacleSources) fn(out, x, z, r);
}
