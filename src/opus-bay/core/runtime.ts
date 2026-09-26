import type { MoveMode, MoveSpot } from './store';
import type { SurfaceKind, Vec2 } from './types';

/**
 * Mutable per-frame state shared between systems. Never put this in React state.
 * Writers: actors (player/guide/camera/input), world (streetcar), game systems (guide brain decisions).
 */

export type GuideState = 'idle' | 'follow' | 'lead' | 'wait' | 'talk' | 'emote';
/** transition phase of the movement state machine (actors/modes.ts) */
export type MovePhase = 'steady' | 'boarding' | 'braking' | 'alighting' | 'takeoff' | 'landing' | 'settling' | 'rising';
export type Emote = 'none' | 'wave' | 'point' | 'hop' | 'clap' | 'shrug' | 'think';

export const runtime = {
  time: 0,
  player: {
    x: 0, y: 0, z: 0,
    heading: 0,
    speed: 0,
    moving: false,
    running: false,
    grounded: true,
    surface: 'plaza' as SurfaceKind,
    /** set by actors when a click-to-walk / interact path is active */
    pathTarget: null as Vec2 | null,
    /** interactable id to trigger when the auto-walk reaches its target */
    pendingInteract: null as string | null,
    /** freeze controls (dialogue, cinematic) */
    locked: false,
  },
  guide: {
    x: 0, y: 0, z: 0,
    heading: 0,
    speed: 0,
    state: 'follow' as GuideState,
    /** decided by the guide brain (game/), executed by actors/ */
    target: null as Vec2 | null,
    run: false,
    emote: 'none' as Emote,
    /** true while the guide is at its target */
    arrived: false,
  },
  camera: {
    yaw: 0,
    pitch: 0.66,
    distance: 15,
    /** optional cinematic override: when set, camera rig eases to it */
    shot: null as null | { position: [number, number, number]; target: [number, number, number]; duration: number },
    shake: 0,
  },
  input: {
    moveX: 0,
    moveY: 0,
    run: false,
    jump: false,
    interact: false,
    call: false,
    device: 'keyboard' as 'keyboard' | 'touch' | 'gamepad',
  },
  streetcar: {
    x: 0, z: 0, heading: 0,
    /** 0..1 along district.streetcar.path */
    t: 0,
    /** stop id when dwelling at a stop */
    atStop: null as string | null,
  },
  /** movement mode this frame (actors/moveSystem.ts): store.move changes only on transitions, this every frame */
  move: {
    mode: 'foot' as MoveMode,
    phase: 'steady' as MovePhase,
    /** 0..1 progress of the current transition phase */
    progress: 1,
    spot: null as MoveSpot | null,
  },
  /**
   * The bike / toy car the player is in (or last used): pose and dynamics (actors/vehicles). `id` null = on foot and no
   * vehicle claimed yet. speed is signed (u/s, < 0 reversing); grade = Δh/Δs along the heading.
   */
  vehicle: {
    id: null as string | null,
    kind: null as 'bike' | 'car' | null,
    /** true while the player sits in it */
    occupied: false,
    x: 0, y: 0, z: 0,
    heading: 0,
    speed: 0,
    /** front-wheel angle (rad) */
    steer: 0,
    pitch: 0,
    roll: 0,
    grade: 0,
    airborne: false,
  },
  /** Pelican glide (actors/glide.ts). y is the rider's seat height; height = y − ground under it. */
  glide: {
    active: false,
    x: 0, y: 0, z: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    height: 0,
  },
  perf: { fps: 60, tier: 'high' as 'low' | 'mid' | 'high' },
};

export type Runtime = typeof runtime;
