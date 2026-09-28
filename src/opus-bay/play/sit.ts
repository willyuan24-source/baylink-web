import { charApi } from '../actors/charApi';
import { duck } from '../audio/hooks';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { heightAt } from '../core/terrain';
import { bitGet } from '../data/playSave';
import { readSave } from '../data/save';
import { cinemaActive, playShots, type Shot } from '../game/cinema';
import { bubble } from '../game/flow';
import { registerFrameSystem } from '../game/systemsRegistry';
import { MOVE_CANCEL } from './kit';
import { VIEW_COINS, VIEW_LOOK_SECONDS, VIEW_SIT_SECONDS, viewHeading, viewReward, viewSpotIndex, type ViewSpot } from './viewSpots';

/**
 * Wave 5 · lane A · sit anywhere and the 16 view spots (W5-A4, plan §3.2 A-sit). 坐下 (phone: the contextual button;
 * desktop: E) sits the player on the ground where they stand (grass, steps, rims: lane F's charApi.sitGround); at a view
 * spot the seat faces the view, and after VIEW_SIT_SECONDS of sitting the camera takes a slow 20 s look (three eased
 * shots: over the shoulder, out and up, a drift back), the music thins, the first time pays `reward view:<id>` (5
 * coins, stamp `view:<id>`) and emits `find view`. Moving (stick / WASD) stands up at no cost; the look itself is a
 * cinematic (its 跳过 button and Esc end it early, the reward stays).
 */

interface Seat { x: number; z: number; heading: number; spot: ViewSpot | null; t: number; looked: boolean; posed: boolean }
let seat: Seat | null = null;
let offFrame: (() => void) | null = null;
const found = new Set<string>();

/** The seat right now (the core hides 坐下 while seated), or null. */
export const seated = (): Readonly<Seat> | null => seat;

/** A view spot never found before (this session or the play save's `view` bitset)? */
export function firstFind(id: string): boolean {
  if (found.has(id)) return false;
  const i = viewSpotIndex(id);
  return !(i >= 0 && bitGet(readSave()?.play?.g?.view, i));
}

function watch() {
  offFrame ??= registerFrameSystem('a-play-sit', dt => {
    const s = seat;
    if (!s) return;
    s.t += dt;
    const p = runtime.player;
    const moved = Math.hypot(p.x - s.x, p.z - s.z) > 0.9;
    const pushing = s.t > 0.4 && Math.hypot(runtime.input.moveX, runtime.input.moveY) > MOVE_CANCEL;
    const carried = runtime.move.mode !== 'foot' && runtime.move.mode !== 'sit';
    if (!cinemaActive() && (pushing || moved || carried || game.get().phase !== 'playing')) { standUp(); return; }
    if (s.spot && !s.looked && s.t >= VIEW_SIT_SECONDS && !game.get().dialogue.nodeId && !cinemaActive()) slowLook(s);
  });
}

/** Sit on the ground here (the 坐下 prompt). False when lane F's body cannot sit here. */
export function sitHere(): boolean {
  const p = runtime.player;
  return sitAt({ x: p.x, z: p.z, heading: p.heading }, null);
}

/** Sit at a view spot, facing its view (the 坐下看风景 prompt). */
export function sitAtSpot(spot: ViewSpot): boolean {
  const p = runtime.player;
  // sit where the player stands inside the spot's circle (it is standable there), facing the view
  return sitAt({ x: p.x, z: p.z, heading: viewHeading({ x: p.x, z: p.z, look: spot.look }) }, spot);
}

function sitAt(pose: { x: number; z: number; heading: number }, spot: ViewSpot | null): boolean {
  if (seat) standUp();
  const api = charApi();
  runtime.player.heading = pose.heading;
  const posed = !!api && api.sitGround(pose);
  // without lane F's sit (charApi not registered yet) a view spot still works standing; plain 坐下 needs the pose
  if (!posed && !spot) return false;
  seat = { ...pose, spot, t: 0, looked: false, posed };
  // BAYBAY sits down beside you (her body emote ends by itself when she walks off)
  if (posed) setTimeout(() => { if (seat?.posed) charApi()?.emote('baybay', 'sit', { loop: true }); }, 700);
  emit({ type: 'play', activity: spot ? 'view' : 'sit', what: 'start' });
  if (spot) bubble({ zh: `坐一会儿，看看${spot.name.zh}的风景～`, en: `Let’s sit and take in ${spot.name.en}.` }, 2600);
  watch();
  return true;
}

/** Stand up (moving does it by itself); a view spot left before its look pays nothing. */
export function standUp() {
  const s = seat;
  if (!s) return;
  seat = null;
  if (s.posed) charApi()?.stand();
  emit({ type: 'play', activity: s.spot ? 'view' : 'sit', what: s.spot && s.looked ? 'end' : 'cancel' });
}

/** The three shots of a slow look from a seat at (x, y, z) facing `heading` (≈ VIEW_LOOK_SECONDS in all). */
export function lookShots(x: number, y: number, z: number, heading: number, spot: Pick<ViewSpot, 'name' | 'line'>): Shot[] {
  const fx = Math.sin(heading), fz = Math.cos(heading), rx = Math.cos(heading), rz = -Math.sin(heading);
  const at = (back: number, side: number, up: number): [number, number, number] => [x - fx * back + rx * side, y + up, z - fz * back + rz * side];
  const ahead = (d: number, up: number): [number, number, number] => [x + fx * d, y + up, z + fz * d];
  return [
    // over the shoulder, low: the seated pair at the bottom of the frame, the view above them
    { position: at(6, 1.2, 1.6), target: ahead(30, -1.5), duration: 2.5, hold: 2.5, caption: { zh: `看风景 · ${spot.name.zh}`, en: `The view · ${spot.name.en}` }, sub: spot.line },
    // out and up, slowly: the pair small in the lower third, the whole view opening up
    { position: at(14, 4, 6), target: ahead(50, -8), duration: 9, hold: 3, caption: null },
    // drift round to the other shoulder, then the follow camera takes over again
    { position: at(9, -3.5, 3.5), target: ahead(40, -5), duration: 3 },
  ];
}

function slowLook(s: Seat) {
  const spot = s.spot;
  if (!spot) return;
  s.looked = true;
  const first = firstFind(spot.id);
  found.add(spot.id);
  // the find and the reward come with the look (skipping it keeps them)
  emit({ type: 'find', kind: 'view', id: spot.id, first });
  if (first) emit({ type: 'reward', source: viewReward(spot.id), coins: VIEW_COINS, stamp: viewReward(spot.id) });
  duck('music', 0.45, VIEW_LOOK_SECONDS * 1000);
  const y = heightAt(s.x, s.z) + 1.1;
  playShots('viewpoint', lookShots(s.x, y, s.z, s.heading, spot), () => {
    bubble(first ? { zh: '真美……这张风景记进手帐啦！', en: 'So pretty… that view goes in the notebook!' } : { zh: '每次看都不一样呢。', en: 'It looks different every time.' }, 3200);
  });
}

/** tests / teardown */
export function resetSit() { seat = null; offFrame?.(); offFrame = null; found.clear(); }
