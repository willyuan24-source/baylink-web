import type { Object3D } from 'three';
import type { Bilingual } from '../core/types';

/**
 * Wave 5 (FROZEN interface at day 0, plan sf-w5-plan.md §4.2 W5-0d) · what the new lanes may ask of the player's and
 * BAYBAY's bodies, the rides and the pelican. Lane F implements it (W5-F2, `actors/charImpl.ts`) and registers the
 * implementation with `setCharApi` once the actors are up; until then `charApi()` is null and every caller must cope
 * (skip the flourish, never throw):
 *
 *   charApi()?.emote('baybay', 'dance', { loop: true, seconds: 6 });
 *
 * Users: lane A (emotes, pet, sit, the first flight's soft box), lane E (wearables: attach / tint / vehicle paints),
 * lane R (Fleet Week: the glide soft box round the air show), lane D (BAYBAY's float at Fort Point), lane N (none yet).
 * Nothing here locks the player: a lane that needs the feet held uses game/playerLock.ts `holdLock('activity' | 'shop')`.
 */

/** Emotes the implementation plays (the existing anim.ts channel has wave, cheer, clap, pose; F adds the rest). */
export const EMOTES = ['wave', 'cheer', 'clap', 'point', 'pose', 'dance', 'lie', 'sit', 'float', 'pet'] as const;
export type Emote = (typeof EMOTES)[number];
export type CharWho = 'player' | 'baybay';
export type AttachSlot = 'head' | 'neck' | 'back';
export type TintPart = 'scarf' | 'hat' | 'pack';
export type PaintKind = 'bike' | 'car' | 'pelican';
export interface SoftBox { minX: number; minZ: number; maxX: number; maxZ: number; minY?: number }

export interface CharApi {
  /** play an emote on the player or BAYBAY; `loop` keeps it going for `seconds` (default: one play) or until the next move */
  emote(who: CharWho, name: Emote, opts?: { loop?: boolean; seconds?: number }): void;
  /** sit the player on the ground at pose (x, z, facing heading); false when the spot is not standable / sittable */
  sitGround(pose: { x: number; z: number; heading: number }): boolean;
  /** stand the player up from sitGround (nothing when not sitting) */
  stand(): void;
  /** attach an object to a body slot (null removes what is there); the object's material must be the caller's own, warmed */
  attach(who: CharWho, slot: AttachSlot, obj: Object3D | null): void;
  /** recolour a body part (BAYBAY's scarf region, a hat, the player's backpack); null = the default colour */
  tint(who: CharWho, part: TintPart, color: number | null): void;
  /** a paint for the bike / toy car (`BIKE_LIVERIES` ids …) or the pelican's ribbon; null = the default */
  vehiclePaint(kind: PaintKind, id: string | null): void;
  /**
   * a box the pelican glide is turned back from (Fleet Week's air box, the first flight's course), keyed so several
   * lanes can hold boxes; null removes the key's box. `line` = what BAYBAY says when she turns you back.
   */
  glideSoftBox(key: string, box: SoftBox | null, line?: Bilingual): void;
}

let impl: CharApi | null = null;

/** Lane F registers its implementation (null on teardown). */
export function setCharApi(next: CharApi | null): void { impl = next; }

/** The implementation, or null before lane F registered it (callers skip the flourish then). */
export function charApi(): CharApi | null { return impl; }
