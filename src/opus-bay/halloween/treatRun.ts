import * as THREE from 'three';
import { playSound } from '../audio/hooks';
import { panFor, proximity } from '../audio/logic';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { toast } from '../core/store';
import type { Bilingual } from '../core/types';
import { PLAYER_HEIGHT } from '../actors/dims';
import { isPaid } from '../economy/ledger';
import { bayParts } from '../game/bayNow';
import { cinemaActive } from '../game/cinema';
import { bubble, busy, teleportPlayer } from '../game/flow';
import { invalidateInteractables, registerInteractables, type Interactable } from '../game/interactables';
import { registerFrameSystem } from '../game/systemsRegistry';
import { cityStreamerLazy } from '../world/cityLoader';
import { freezeStatic } from '../world/builder';
import { spawnFx } from '../world/fx';
import { meshWarmup, registerWarmup } from '../world/warmup';
import { getWorld, type WorldSystem } from '../world/world';
import { hLine } from './lines';
import { halloweenPhase, isTreatHour, type HalloweenPhase } from './season';
import { allDoorsKnocked, candyCount, doorAnswers, doorsDressed, knockResult, type Knock } from './treat';
import { TREAT_DOORS, type TreatDoor } from './treatDoors';
import { buildCandyGeometry, buildDoorsGeometry, buildSwingGeometry, doorMaterial, doorPoints, DOOR_PAINTS, trianglesOf, type DoorLook } from './treatMesh';
import { KNOCK_OUT, TREAT_STREETS, type TreatStreetId } from './treatStreets';
import { registerTreatSounds } from './treatSounds';

/**
 * Wave 6 · lane G (W6-G2) · trick-or-treat in the city: the decorated doors near the player, the 敲门 / Knock prompt,
 * the knock → the door swings open → the candy flies into your bag, BAYBAY's 不给糖就捣蛋！, the coins.
 *
 * - The doors of a street are one merged mesh, built while the player is within BUILD_NEAR of the street (dropped past
 *   DROP_FAR) in the season and on the big night; rebuilt when a door's look changes (the day, the treat hours, a door
 *   opening). The swing and the candy are two small meshes on the same material, only while a door is answering.
 * - The prompt (source 'find', flow calls `act`): one per door of a built street, at the knock spot 0.9 u out.
 * - A treat pays through `{ type: 'reward', source: 'halloween:door:<n>' | 'halloween:night:<n>' }` (the ledger pays each
 *   once per save) and emits `{ type: 'halloween', what: 'treat', id: 'door:<n>' }`.
 * - BAYBAY says a street's line the first time you come near it in a session (and the treat-hour / big-night line).
 */

export const BUILD_NEAR = 170;
export const DROP_FAR = 210;
/** a street's line when the player comes this near one of its doors */
const LINE_NEAR = 22;
const KNOCK_RADIUS = 1.3;
/** the knock's beats (s) */
/** (in step with lane X's treat sound, audio/halloween.ts: knocks 0–0.34 s, the creak at 0.62, the candies at 1.08–1.3, the chime at 1.5) */
const T_OPEN = 0.6, T_CANDY = 0.8, T_LAND = 1.32, T_THANKS = 1.9, T_CLOSE = 4.6, SWING_S = 0.45, OPEN_RAD = 1.85;

interface StreetMesh { mesh: THREE.Mesh; key: string }
interface Answering { door: TreatDoor; t: number; knock: Knock; paid: boolean; swing: THREE.Mesh | null; candy: THREE.Mesh | null; from: THREE.Vector3 }

const byStreet = new Map<TreatStreetId, TreatDoor[]>();
for (const d of TREAT_DOORS) if (!d.gone) { const l = byStreet.get(d.street) ?? []; l.push(d); byStreet.set(d.street, l); }
const centreOf = new Map<TreatStreetId, { x: number; z: number; r: number }>();
for (const [id, l] of byStreet) {
  const x = l.reduce((s, d) => s + d.x, 0) / l.length, z = l.reduce((s, d) => s + d.z, 0) / l.length;
  centreOf.set(id, { x, z, r: Math.max(...l.map(d => Math.hypot(d.x - x, d.z - z))) });
}
const doorByN = new Map(TREAT_DOORS.map(d => [d.n, d]));

const lineMs = (b: Bilingual) => Math.max(2600, Math.min(5400, 2000 + 70 * [...b.zh].length));
/** BAYBAY says a Halloween line (a bubble; lane X's recording matches its text). */
export const sayLine = (id: string): void => { const l = hLine(id); bubble(l, lineMs(l)); };

export interface TreatRun {
  /** DEV / QA: knock on door n now (from anywhere) */
  knock(n: number): Knock['kind'] | 'busy';
  /** DEV / QA: stand `out` u in front of door n, facing it, the camera behind (shots) */
  look(n: number, out?: number): boolean;
  stats(): { phase: HalloweenPhase; streets: string[]; tris: number; answering: number | null; bag: number; answers: number[] };
  off(): void;
}

export function initTreat(): TreatRun {
  const mat = doorMaterial();
  const offs: (() => void)[] = [registerTreatSounds(), registerWarmup('g-doors', () => meshWarmup(mat, { receiveShadow: true }))];
  const group = new THREE.Group();
  group.name = 'halloween-doors';
  let offSystem: (() => void) | null = null;
  const attach = () => {
    if (offSystem || !cityStreamerLazy()) return;
    const sys: WorldSystem = { name: 'halloween-doors', group };
    offSystem = getWorld().addSystem(sys);
  };

  const built = new Map<TreatStreetId, StreetMesh>();
  let phase: HalloweenPhase = 'off';
  let dateKey = '';
  let treatHour = false;
  let answering: Answering | null = null;
  const said = new Set<string>();
  let timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, s: number) => { timers.push(setTimeout(fn, s * 1000)); };

  const lookOf = (d: TreatDoor): DoorLook => ({
    answers: doorAnswers(d.n, phase, dateKey, treatHour) || (!!answering && answering.door.n === d.n),
    bright: phase === 'night' || treatHour,
    open: !!answering && answering.door.n === d.n && answering.t >= T_OPEN && answering.t < T_CLOSE + SWING_S,
  });
  const keyOf = (id: TreatStreetId) => `${phase}|${dateKey}|${treatHour}|${answering && answering.door.street === id && lookOf(answering.door).open ? answering.door.n : 0}`;

  const drop = (id: TreatStreetId) => {
    const s = built.get(id);
    if (!s) return;
    group.remove(s.mesh);
    s.mesh.geometry.dispose();
    built.delete(id);
  };
  const build = (id: TreatStreetId) => {
    const key = keyOf(id);
    const had = built.get(id);
    if (had && had.key === key) return false;
    const mesh = freezeStatic(new THREE.Mesh(buildDoorsGeometry(byStreet.get(id) ?? [], lookOf), mat));
    mesh.name = `halloween-doors-${id}`;
    mesh.receiveShadow = true;
    if (had) { group.remove(had.mesh); had.mesh.geometry.dispose(); }
    group.add(mesh);
    built.set(id, { mesh, key });
    return !had;
  };

  const interactables = (): Interactable[] => {
    if (!doorsDressed(phase)) return [];
    const out: Interactable[] = [];
    for (const id of built.keys()) {
      const st = TREAT_STREETS.find(s => s.id === id)!;
      for (const d of byStreet.get(id) ?? []) {
        const k = doorPoints(d, KNOCK_OUT).knock;
        out.push({
          id: `treat:door:${d.n}`, source: 'find', action: 'info', verb: { zh: '敲门', en: 'Knock' },
          name: { zh: `${st.name.zh}的人家`, en: `A house on ${st.name.en}` }, x: k.x, z: k.z, radius: KNOCK_RADIUS,
          act: () => { knock(d.n); },
        });
      }
    }
    return out;
  };
  offs.push(registerInteractables('g-treat', interactables));

  const placed = (at: { x: number; z: number }) => {
    const l = { x: runtime.player.x, z: runtime.player.z };
    return { gain: proximity(Math.hypot(at.x - l.x, at.z - l.z), 6, 60), pan: panFor(l, runtime.camera.yaw, at) };
  };
  const sound = (id: string, at: { x: number; z: number }) => { const p = placed(at); if (p.gain > 0.01) playSound(id, p); };

  const paid = (source: string) => isPaid(source);

  function knock(n: number): Knock['kind'] | 'busy' {
    const d = doorByN.get(n);
    if (!d) return 'closed';
    if (answering) return 'busy';
    const result = knockResult(n, phase, dateKey, treatHour, paid);
    const pts = doorPoints(d, KNOCK_OUT);
    if (result.kind === 'closed') return result.kind;
    if (result.kind === 'again') { sayLine('w6g-again'); return result.kind; }
    sayLine('w6g-knock');
    // nobody home: our own knock (the frozen `halloween` event means a door answered: lane X's treat sound is the whole
    // vignette — knock, creak, candies, chime — played by audio/audio.ts for it)
    if (result.kind === 'nobody') { sound('g-knock', d); later(() => sayLine('w6g-nobody'), 1.6); return result.kind; }
    emit({ type: 'halloween', what: 'treat', id: `door:${d.n}` });
    answering = { door: d, t: 0, knock: result, paid: false, swing: null, candy: null, from: new THREE.Vector3(pts.front.x, pts.front.y, pts.front.z) };
    return result.kind;
  }

  const finishTreat = (a: Answering) => {
    if (a.paid || a.knock.kind !== 'treat') return;
    a.paid = true;
    const k = a.knock;
    for (const p of k.pays) emit({ type: 'reward', source: p.source, coins: p.coins });
    const bag = candyCount(paid);
    toast({ zh: `得到${k.candy.name.zh}${k.pieces > 1 ? ' ×2' : ''}！糖果袋 ${bag} 颗`, en: `${k.pieces > 1 ? 'Double treat' : 'Treat'}: ${k.candy.name.en}! Candy bag: ${bag}` }, 'gold', 3200);
    const next = allDoorsKnocked(paid) && !said.has('all') ? 'w6g-all-doors' : bag >= 10 && !said.has('ten') ? 'w6g-not-too-much' : bag >= 5 && !said.has('five') ? 'w6g-bag-heavy' : null;
    later(() => {
      sayLine('w6g-thanks');
      if (next) {
        said.add(next === 'w6g-all-doors' ? 'all' : next === 'w6g-not-too-much' ? 'ten' : 'five');
        later(() => sayLine(next), lineMs(hLine('w6g-thanks')) / 1000 + 0.25);
      }
    }, T_THANKS - T_LAND);
  };

  const stepAnswering = (dt: number) => {
    const a = answering;
    if (!a) return;
    const was = a.t;
    a.t += dt;
    const d = a.door;
    // the door swings open (its panel on the hinge) and back
    if (was < T_OPEN && a.t >= T_OPEN) {
      const swing = new THREE.Mesh(buildSwingGeometry(DOOR_PAINTS[(d.n * 5) % DOOR_PAINTS.length]), mat);
      swing.name = 'halloween-door-swing';
      swing.position.copy(doorPoints(d).hinge);
      group.add(swing);
      a.swing = swing;
      if (built.has(d.street)) build(d.street);
    }
    if (a.swing) {
      const open = a.t < T_CLOSE ? Math.min(1, (a.t - T_OPEN) / SWING_S) : Math.max(0, 1 - (a.t - T_CLOSE) / SWING_S);
      const e = open * open * (3 - 2 * open);
      a.swing.rotation.y = d.f - e * OPEN_RAD;
    }
    // the candy: from the doorway to the player's bag, in an arc
    if (was < T_CANDY && a.t >= T_CANDY && a.knock.kind === 'treat') {
      const c = a.knock.candy;
      const candy = new THREE.Mesh(buildCandyGeometry(a.knock.pieces > 1 ? [c, c, c] : [c, c]), mat);
      candy.name = 'halloween-candy';
      candy.position.copy(a.from);
      group.add(candy);
      a.candy = candy;
    }
    if (a.candy) {
      const k = Math.min(1, (a.t - T_CANDY) / (T_LAND - T_CANDY));
      const to = { x: runtime.player.x, y: runtime.player.y + PLAYER_HEIGHT * 0.45, z: runtime.player.z };
      a.candy.position.set(a.from.x + (to.x - a.from.x) * k, a.from.y + (to.y - a.from.y) * k + Math.sin(Math.PI * k) * 0.7, a.from.z + (to.z - a.from.z) * k);
      a.candy.rotation.y += dt * 9;
      a.candy.scale.setScalar(1 - 0.5 * k * k);
      if (k >= 1) {
        group.remove(a.candy);
        a.candy.geometry.dispose();
        a.candy = null;
        spawnFx('sparkle', to.x, to.y, to.z, { count: 10, color: '#f2a93b' });
        finishTreat(a);
      }
    }
    if (a.t >= T_CLOSE + SWING_S) {
      if (a.swing) { group.remove(a.swing); a.swing.geometry.dispose(); }
      if (a.candy) { group.remove(a.candy); a.candy.geometry.dispose(); }
      finishTreat(a);
      answering = null;
      if (built.has(d.street)) build(d.street);
    }
  };

  let acc = 1;
  const offFrame = registerFrameSystem('w6-halloween-treat', dt => {
    stepAnswering(dt);
    if ((acc += dt) < 0.5) return;
    acc = 0;
    attach();
    const ph = halloweenPhase();
    const p = bayParts();
    const th = isTreatHour();
    const changed = ph !== phase || p.dateKey !== dateKey || th !== treatHour;
    phase = ph; dateKey = p.dateKey; treatHour = th;
    const dressed = !!offSystem && doorsDressed(phase);
    const px = runtime.player.x, pz = runtime.player.z;
    let setChanged = false;
    for (const [id, c] of centreOf) {
      const dist = Math.hypot(px - c.x, pz - c.z) - c.r;
      if (!dressed || dist > DROP_FAR) { if (built.has(id)) { drop(id); setChanged = true; } continue; }
      if (built.has(id) || dist < BUILD_NEAR) { if (build(id)) setChanged = true; }
    }
    if (setChanged || changed) invalidateInteractables();
    // BAYBAY's street line (and the treat-hour / big-night line) the first time near a street this session
    if (!dressed || busy() || cinemaActive() || runtime.move.mode !== 'foot') return;
    for (const id of built.keys()) {
      if (said.has(id)) continue;
      const near = (byStreet.get(id) ?? []).some(d => Math.hypot(d.x - px, d.z - pz) < LINE_NEAR);
      if (!near) continue;
      said.add(id);
      const st = TREAT_STREETS.find(s => s.id === id)!;
      const extra = phase === 'night' && !said.has('night') ? 'w6g-big-night' : treatHour && !said.has('hour') ? 'w6g-treat-hour' : null;
      sayLine(extra ?? st.line);
      if (extra) { said.add(extra === 'w6g-big-night' ? 'night' : 'hour'); later(() => sayLine(st.line), lineMs(hLine(extra)) / 1000 + 0.3); }
      break;
    }
  });
  offs.push(offFrame);

  return {
    knock: n => knock(n),
    look: (n, out = KNOCK_OUT) => {
      const d = doorByN.get(n);
      if (!d) return false;
      const k = doorPoints(d, out).knock;
      const s = Math.sin(d.f), c = Math.cos(d.f);
      // the player a step to the door's right, turned to it; a framing shot from the street, from the left (the
      // cinematic override the camera rig eases to)
      teleportPlayer({ x: k.x + c * 0.7, z: k.z - s * 0.7 }, d.f + Math.PI - 0.5);
      const cam = out + 4.2;
      runtime.camera.shot = { position: [d.x + s * cam - c * 1.6, d.y + 2.1, d.z + c * cam + s * 1.6], target: [d.x + c * 0.3, d.y + 0.75, d.z - s * 0.3], duration: 0.2 };
      return true;
    },
    stats: () => ({
      phase, streets: [...built.keys()],
      tris: [...built.values()].reduce((s, b) => s + trianglesOf(b.mesh.geometry), 0),
      answering: answering?.door.n ?? null, bag: candyCount(paid),
      answers: TREAT_DOORS.filter(d => doorAnswers(d.n, phase, dateKey, treatHour)).map(d => d.n),
    }),
    off: () => {
      for (const t of timers) clearTimeout(t);
      timers = [];
      if (answering) { answering.swing?.geometry.dispose(); answering.candy?.geometry.dispose(); answering = null; }
      for (const id of [...built.keys()]) drop(id);
      group.clear();
      offSystem?.();
      offSystem = null;
      for (const off of offs.splice(0).reverse()) off();
      invalidateInteractables();
    },
  };
}
