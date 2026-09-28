import * as THREE from 'three';
import type { Bilingual } from '../core/types';
import { canStand } from '../core/terrain';
import { runtime } from '../core/runtime';
import type { AttachSlot, CharApi, CharWho, Emote as CharEmote, PaintKind, SoftBox, TintPart } from './charApi';
import { BODY_EMOTES, EMOTE_SECONDS, type Animator, type Emote } from './anim';
import { BAYBAY_SCARF, NEWCOMER_WEAR, baybayScarfUniforms, type Rig } from './models';
import { boneIndices, recolorGeometry, shade, type RecolorRule } from './recolor';
import { setGlideSoftBox } from './glide';
import { BIKE_LIVERIES, PAINTS, PALETTE, PELICAN_RIBBON, RIBBON_HIDDEN, isPaintId, type PaintId } from './vehicles/models';

/**
 * Wave 5 · W5-F2: the implementation of actors/charApi.ts (frozen interface) over the actor system — what lanes A
 * (emotes, pet, sit, the first flight's box), E (wearables, paints), R (the Fleet Week air box) and D (BAYBAY's float)
 * may ask of the two heroes, the rides and the pelican. actors/system.ts builds it with a CharHost and Actors.tsx
 * registers it (`setCharApi`) while the actors are mounted.
 *
 * - emote: the Animator's emote channel (anim.ts). wave, cheer, clap, point, pose existed; dance (120 bpm, steps on
 *   the beat), lie (on the back), sit (the ground sit), float (BAYBAY's otter float) and pet (BAYBAY: a happy wiggle;
 *   the player: the petting hand) are new. One play by default; `loop` holds it for `seconds` (none: until the next
 *   move). The whole-body moods (dance, lie, sit, float) end as soon as that body moves, and are skipped while it is
 *   carried (a ride, the pelican, a bench, a deck). Nothing here locks the player.
 * - sitGround: the player sits on the ground at a standable spot within SIT_REACH (placed there, facing `heading`),
 *   until stand() or any move.
 * - attach: an object on a body slot (head / neck / back), in the slot's frame: origin on the slot point, +y up, +z the
 *   way the body faces, character units (the body's own scale applies). A player head item hides the bucket hat.
 *   Attachments move with BAYBAY when her GLB replaces the procedural body.
 * - tint: the player's hat and backpack, BAYBAY's scarf (vertex colours on the clay rigs, recolor.ts; the textured GLB
 *   keys the scarf's teal in her shader: models.ts baybayScarfUniforms). Other parts: nothing to tint (no-op).
 * - vehiclePaint: PAINTS ids (vehicles/models.ts). bike: the bike the player rides (its own livery back when they get
 *   off); car: every toy car; pelican: the ribbon round its neck (hidden with null). An unknown id changes nothing.
 * - glideSoftBox: glide.ts setGlideSoftBox (the pelican turns back; BAYBAY says `line`, moveSystem).
 */

/** how far sitGround may place the player from where they stand (u) */
export const SIT_REACH = 8;
/** a charApi one-play of `pose` (the Animator holds its own pose until stopped) */
const POSE_ONCE_S = 2.5;
/** a loop with no `seconds` lasts until the next move */
const UNTIL_MOVED = 1e9;

export interface CharRide { kind: 'bike' | 'car'; rig: Rig; occupied: boolean; spot: { livery?: number } }

/** What the implementation needs from the actor system (a stub rig in tests/opus-bay-w5-char.test.ts). */
export interface CharHost {
  readonly player: Rig;
  /** BAYBAY's current body (the procedural one until her GLB swaps in) */
  readonly guide: Rig;
  readonly playerAnim: Animator;
  readonly guideAnim: Animator;
  guideIsGlb(): boolean;
  /** the player stands on their own feet (not on a ride, the pelican, a bench, a deck, the streetcar) */
  playerFree(): boolean;
  /** BAYBAY stands on her own feet (not in the basket, the car, on the pelican) */
  guideFree(): boolean;
  /** the player moves (walks, is steered, has a walk target, is in the air) */
  playerMoving(): boolean;
  /** BAYBAY walks / runs */
  guideMoving(): boolean;
  /** put the player at (x, z) facing heading, walk target cleared, controller synced */
  placePlayer(x: number, z: number, heading: number): void;
  rides(): readonly CharRide[];
  pelican(): Rig | null;
}

const SLOTS: Record<'newcomer' | 'baybay' | 'baybay-glb', Record<AttachSlot, { bone: string; at: readonly [number, number, number] }>> = {
  // the bean's crown (a hat sits here), the base of the face, the backpack's back
  newcomer: { head: { bone: 'body', at: [0, 1.03, -0.02] }, neck: { bone: 'body', at: [0, 0.3, 0.02] }, back: { bone: 'pack', at: [0, -0.2, -0.27] } },
  // the crown between the ears, the scarf ring, the middle of the back
  baybay: { head: { bone: 'head', at: [0, 0.47, 0.01] }, neck: { bone: 'body', at: [0, 0.62, 0.015] }, back: { bone: 'body', at: [0, 0.32, -0.3] } },
  'baybay-glb': { head: { bone: 'head', at: [0, 0.46, 0] }, neck: { bone: 'body', at: [0, 0.44, 0] }, back: { bone: 'body', at: [0, 0.2, -0.3] } },
};

type LoopState = { name: Emote; left: number; body: boolean } | null;
const WHO: readonly CharWho[] = ['player', 'baybay'];

export class CharImpl implements CharApi {
  private readonly host: CharHost;
  private loops: Record<CharWho, LoopState> = { player: null, baybay: null };
  private sitting = false;
  private attached = new Map<string, THREE.Object3D>();
  /** the slot anchors made so far, each on the body it was made for */
  private anchors = new Map<string, { a: THREE.Object3D; rig: Rig }>();
  private tints: Record<string, number | null> = {};
  private paints: Record<PaintKind, PaintId | null> = { bike: null, car: null, pelican: null };
  /** the bike painted now (its livery comes back when the player gets off) and each car's paint */
  private paintedBike: CharRide | null = null;
  private paintedCars = new WeakMap<Rig, PaintId | null>();
  private pelicanPainted: { rig: Rig; id: PaintId | null } | null = null;

  constructor(host: CharHost) { this.host = host; }

  // -------------------------------------------------------------------------------------------------------------
  // emotes
  // -------------------------------------------------------------------------------------------------------------

  emote(who: CharWho, name: CharEmote, opts?: { loop?: boolean; seconds?: number }): void {
    const anim = who === 'player' ? this.host.playerAnim : this.host.guideAnim;
    const em = name as Emote;
    if (!(em in EMOTE_SECONDS)) return;
    const body = BODY_EMOTES.has(em);
    if (body && !(who === 'player' ? this.host.playerFree() : this.host.guideFree())) return;
    const secs = opts?.seconds !== undefined && Number.isFinite(opts.seconds) && opts.seconds > 0 ? opts.seconds : null;
    const dur = opts?.loop ? secs ?? UNTIL_MOVED : secs ?? (em === 'pose' ? POSE_ONCE_S : EMOTE_SECONDS[em]);
    anim.play(em, dur);
    this.loops[who] = { name: em, left: dur, body: body || !!opts?.loop };
    if (who === 'player') this.sitting = em === 'sit';
  }

  sitGround(pose: { x: number; z: number; heading: number }): boolean {
    const { x, z, heading } = pose;
    if (![x, z, heading].every(Number.isFinite) || !this.host.playerFree()) return false;
    const p = runtime.player;
    if (Math.hypot(x - p.x, z - p.z) > SIT_REACH || !canStand(x, z, 0.4)) return false;
    this.host.placePlayer(x, z, heading);
    this.host.playerAnim.play('sit', UNTIL_MOVED);
    this.loops.player = { name: 'sit', left: UNTIL_MOVED, body: true };
    this.sitting = true;
    return true;
  }

  stand(): void {
    if (!this.sitting) return;
    this.sitting = false;
    if (this.host.playerAnim.playing('sit')) this.host.playerAnim.stop();
    this.loops.player = null;
  }

  /** the player sits on the ground (sitGround / a sit emote) */
  get seated(): boolean { return this.sitting; }

  /** Once a frame (actors/system.ts): loops run out or end on a move; the ridden bike's paint follows the rider. */
  update(dt: number): void {
    // (W5-F review: once a frame — no array or closure made here)
    for (const who of WHO) {
      const l = this.loops[who];
      if (!l) continue;
      const anim = who === 'player' ? this.host.playerAnim : this.host.guideAnim;
      l.left -= dt;
      const moved = who === 'player' ? this.host.playerMoving() || !this.host.playerFree() : this.host.guideMoving() || !this.host.guideFree();
      const replaced = !anim.playing(l.name);
      if (replaced || l.left <= 0 || (l.body && moved)) {
        if (!replaced && (l.body && moved)) anim.stop();
        this.loops[who] = null;
        if (who === 'player') this.sitting = false;
      }
    }
    this.syncPaints();
  }

  // -------------------------------------------------------------------------------------------------------------
  // attach / tint
  // -------------------------------------------------------------------------------------------------------------

  attach(who: CharWho, slot: AttachSlot, obj: THREE.Object3D | null): void {
    const key = `${who}:${slot}`;
    const old = this.attached.get(key);
    if (old === obj) return;
    if (old) { old.parent?.remove(old); this.attached.delete(key); }
    if (obj) {
      this.anchor(who, slot).add(obj);
      this.attached.set(key, obj);
    }
    if (who === 'player' && slot === 'head') this.host.player.bones.hat?.scale.setScalar(obj ? 1e-4 : 1);
  }

  /** what is on a slot now (QA, tests, lane E's wardrobe) */
  attachedAt(who: CharWho, slot: AttachSlot): THREE.Object3D | null { return this.attached.get(`${who}:${slot}`) ?? null; }

  tint(who: CharWho, part: TintPart, color: number | null): void {
    if (color !== null && !Number.isFinite(color)) return;
    const key = `${who}:${part}`;
    if (who === 'player' && part === 'scarf') return;
    if (who === 'baybay' && part !== 'scarf') return;
    this.tints[key] = color;
    this.applyTint(who, part, color);
  }

  private applyTint(who: CharWho, part: TintPart, color: number | null) {
    const c = color === null ? null : new THREE.Color(color);
    if (who === 'player') {
      const mesh = this.host.player.mesh;
      if (part === 'hat') {
        const rules: RecolorRule[] = [[NEWCOMER_WEAR.hat, c], [NEWCOMER_WEAR.hatBand, c && shade(c, 0.72)]];
        recolorGeometry(mesh.geometry, rules, boneIndices(mesh, ['hat']));
      } else if (part === 'pack') {
        const rules: RecolorRule[] = [[NEWCOMER_WEAR.pack, c], [NEWCOMER_WEAR.packDark, c && shade(c, 0.8)], [NEWCOMER_WEAR.strap, c && shade(c, 0.64)]];
        recolorGeometry(mesh.geometry, rules, boneIndices(mesh, ['pack', 'body']));
      }
      return;
    }
    // BAYBAY's scarf: the GLB keys it in her shader; the procedural body repaints its vertices
    baybayScarfUniforms.scarfOn.value = c ? 1 : 0;
    if (c) baybayScarfUniforms.scarfTint.value.copy(c);
    if (!this.host.guideIsGlb()) {
      const mesh = this.host.guide.mesh;
      recolorGeometry(mesh.geometry, [[BAYBAY_SCARF.color, c], [BAYBAY_SCARF.dark, c && shade(c, 0.8)]], boneIndices(mesh, ['body', 'scarf']));
    }
  }

  /** actors/system.ts: BAYBAY's GLB replaced the procedural body — move her attachments over, keep her scarf. */
  onGuideSwap(): void {
    for (const [k, obj] of [...this.attached]) {
      if (!k.startsWith('baybay:')) continue;
      obj.parent?.remove(obj);
      this.anchor('baybay', k.slice('baybay:'.length) as AttachSlot).add(obj);
    }
    const scarf = this.tints['baybay:scarf'];
    if (scarf !== undefined) this.applyTint('baybay', 'scarf', scarf);
    // a mood she was in goes on on the new body (its own animator starts idle)
    const l = this.loops.baybay;
    if (l && l.left > 0) this.host.guideAnim.play(l.name, l.left);
  }

  private anchor(who: CharWho, slot: AttachSlot): THREE.Object3D {
    const key = `${who}:${slot}`;
    const rig = who === 'player' ? this.host.player : this.host.guide;
    const had = this.anchors.get(key);
    if (had && had.rig === rig) return had.a;
    had?.a.parent?.remove(had.a);
    const def = SLOTS[who === 'player' ? 'newcomer' : this.host.guideIsGlb() ? 'baybay-glb' : 'baybay'][slot];
    const bone = rig.bones[def.bone] ?? rig.bones.body ?? rig.bones.root;
    const a = new THREE.Object3D();
    a.name = `ob-slot-${who}-${slot}`;
    a.position.set(def.at[0], def.at[1], def.at[2]);
    bone.add(a);
    this.anchors.set(key, { a, rig });
    return a;
  }

  // -------------------------------------------------------------------------------------------------------------
  // paints
  // -------------------------------------------------------------------------------------------------------------

  vehiclePaint(kind: PaintKind, id: string | null): void {
    if (id !== null && !isPaintId(id)) {
      if (import.meta.env?.DEV) console.warn(`[opus-bay] vehiclePaint: unknown paint "${id}" (vehicles/models.ts PAINTS)`);
      return;
    }
    this.paints[kind] = id;
    this.syncPaints();
  }

  /** the paint worn by a kind now (QA, tests) */
  paintOf(kind: PaintKind): PaintId | null { return this.paints[kind]; }

  private syncPaints() {
    const rides = this.host.rides();
    // the ridden bike
    let bike: CharRide | null = null;
    for (const r of rides) if (r.kind === 'bike' && r.occupied) { bike = r; break; }
    if (this.paintedBike && (this.paintedBike !== bike || this.paints.bike === null)) { paintBike(this.paintedBike, null); this.paintedBike = null; }
    if (bike && this.paints.bike && (this.paintedBike !== bike || this.bikeId !== this.paints.bike)) { paintBike(bike, this.paints.bike); this.paintedBike = bike; }
    this.bikeId = this.paintedBike ? this.paints.bike : null;
    // every toy car
    for (const r of rides) {
      if (r.kind !== 'car') continue;
      const had = this.paintedCars.get(r.rig) ?? null;
      if (had === this.paints.car) continue;
      paintCar(r.rig, this.paints.car);
      this.paintedCars.set(r.rig, this.paints.car);
    }
    // the pelican's ribbon
    const pel = this.host.pelican();
    if (pel && (this.pelicanPainted?.rig !== pel || this.pelicanPainted.id !== this.paints.pelican)) {
      paintRibbon(pel, this.paints.pelican);
      this.pelicanPainted = { rig: pel, id: this.paints.pelican };
    }
  }
  private bikeId: PaintId | null = null;

  // -------------------------------------------------------------------------------------------------------------
  // the glide's soft boxes
  // -------------------------------------------------------------------------------------------------------------

  glideSoftBox(key: string, box: SoftBox | null, line?: Bilingual): void { setGlideSoftBox(key, box, line); }

  /** Remove everything this implementation put on the bodies (the actors unmount). */
  dispose(): void {
    for (const k of [...this.attached.keys()]) { const [who, slot] = k.split(':') as [CharWho, AttachSlot]; this.attach(who, slot, null); }
    for (const { a } of this.anchors.values()) a.parent?.remove(a);
    this.anchors.clear();
  }
}

const FRAME_BONES = ['frame', 'fork', 'wheelF', 'wheelR'];

function paintBike(ride: CharRide, id: PaintId | null) {
  const [frame, dark] = BIKE_LIVERIES[(ride.spot.livery ?? 0) % BIKE_LIVERIES.length];
  const p = id ? PAINTS[id] : null;
  recolorGeometry(ride.rig.mesh.geometry, [[frame, p?.color ?? null], [dark, p?.dark ?? null]], boneIndices(ride.rig.mesh, FRAME_BONES));
}

function paintCar(rig: Rig, id: PaintId | null) {
  const p = id ? PAINTS[id] : null;
  recolorGeometry(rig.mesh.geometry, [[PALETTE.terracotta, p?.color ?? null], [PALETTE.terracottaDark, p?.dark ?? null]], boneIndices(rig.mesh, ['body']));
}

function paintRibbon(rig: Rig, id: PaintId | null) {
  rig.bones.ribbon?.scale.setScalar(id ? 1 : RIBBON_HIDDEN);
  recolorGeometry(rig.mesh.geometry, [[PELICAN_RIBBON, id ? PAINTS[id].color : null]], boneIndices(rig.mesh, ['ribbon']));
}
