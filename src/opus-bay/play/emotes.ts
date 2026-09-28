import { charApi } from '../actors/charApi';
import { playSound } from '../audio/hooks';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { Bilingual } from '../core/types';
import { surfaceAt } from '../core/terrain';
import { faceCameraToward } from '../game/cinema';
import { bubble, enterPhotoMode } from '../game/flow';
import { holdLock } from '../game/playerLock';
import { spawnFx } from '../world/fx';

/**
 * Wave 5 · lane A · the four emotes of the wheel (W5-A2, plan §3.2 A-emote): 挥手 wave · 跳舞 dance (BAYBAY dances
 * along) · 躺草地 lie on the grass · 自拍 a selfie two-shot with BAYBAY through photo mode. The bodies move through
 * lane F's actors/charApi (null until F registers: wave and the selfie still work — the wave through the `emote`
 * event the actors already play —, dance and lie wait for it and say so in the wheel).
 */

export type WheelEmote = 'wave' | 'dance' | 'lie' | 'selfie';
export interface WheelSlot { id: WheelEmote; label: Bilingual; key: string; needsChar: boolean }
export const WHEEL: readonly WheelSlot[] = [
  { id: 'wave', label: { zh: '挥手', en: 'Wave' }, key: '1', needsChar: false },
  { id: 'dance', label: { zh: '跳舞', en: 'Dance' }, key: '2', needsChar: true },
  { id: 'lie', label: { zh: '躺草地', en: 'Lie down' }, key: '3', needsChar: true },
  { id: 'selfie', label: { zh: '自拍', en: 'Selfie' }, key: '4', needsChar: false },
];
/** Surfaces you may lie down on (the lie emote asks for grass, sand or earth). */
export const LIE_SURFACES: ReadonlySet<string> = new Set(['grass', 'sand', 'dirt']);
export const DANCE_SECONDS = 8;

/** Whether an emote can run right now (on foot, playing, nothing modal). */
export function emoteAllowed(): boolean {
  const s = game.get();
  return s.phase === 'playing' && !s.dialogue.nodeId && !s.photoMode && s.riding === null && runtime.move.mode === 'foot' && !runtime.player.locked;
}

const later: ReturnType<typeof setTimeout>[] = [];
const after = (ms: number, fn: () => void) => { later.push(setTimeout(fn, ms)); };
export function clearEmoteTimers() { for (const t of later.splice(0)) clearTimeout(t); }

function baybayEmote(name: 'wave' | 'clap' | 'hop') {
  runtime.guide.emote = name;
  emit({ type: 'emote', who: 'baybay', emote: name });
}

/** Run one wheel emote; false when it cannot run now (and why was said). */
export function doEmote(id: WheelEmote): boolean {
  if (!emoteAllowed()) return false;
  const api = charApi();
  switch (id) {
    case 'wave':
      // the event is the bus's "the player waved": the actors play the wave, lane T's crowd within 6 u waves back
      emit({ type: 'emote', who: 'player', emote: 'wave' });
      after(550, () => baybayEmote('wave'));
      return true;
    case 'dance': {
      if (!api) return false;
      api.emote('player', 'dance', { loop: true, seconds: DANCE_SECONDS });
      api.emote('baybay', 'dance', { loop: true, seconds: DANCE_SECONDS });
      emit({ type: 'emote', who: 'player', emote: 'dance' });
      playSound('play-dance');
      // a few notes over the two of them while the tune plays
      for (const at of [0, 2000, 4000]) after(at, () => {
        const p = runtime.player, g = runtime.guide;
        spawnFx('notes', p.x, p.y + 2.2, p.z, { count: 5 });
        spawnFx('notes', g.x, g.y + 1.8, g.z, { count: 4 });
      });
      after(1200, () => bubble({ zh: '一起跳！左一步，右一步～', en: 'Dance with me! Left step, right step!' }, 2600));
      return true;
    }
    case 'lie': {
      if (!api) return false;
      const surface = surfaceAt(runtime.player.x, runtime.player.z);
      if (!surface || !LIE_SURFACES.has(surface)) {
        bubble({ zh: '找块草地再躺吧～', en: 'Let’s find some grass to lie on!' }, 2400);
        return false;
      }
      api.emote('player', 'lie', { loop: true, seconds: 60 });
      after(700, () => charApi()?.emote('baybay', 'float', { loop: true, seconds: 12 }));
      after(1500, () => bubble({ zh: '看，云在慢慢走～', en: 'Look, the clouds are drifting by.' }, 3000));
      return true;
    }
    case 'selfie': selfie(); return true;
  }
  return false;
}

/** The camera distance a selfie starts at (u): close enough that both faces read on a phone. */
export const SELFIE_DISTANCE = 8;

/**
 * 自拍: BAYBAY comes to your side, the camera swings round to face you both (from the front, where the player looks),
 * then photo mode opens (C's shutter, frame and caption); both strike a pose. The follow camera's distance comes back
 * when photo mode closes.
 */
export function selfie() {
  const p = runtime.player;
  const release = holdLock('activity', 'selfie');
  // the camera behind a point 10 u behind the player looks at the player's face
  faceCameraToward(p.x - Math.sin(p.heading) * 10, p.z - Math.cos(p.heading) * 10, { uncapped: true, seconds: 0.7 });
  const before = runtime.camera.distance;
  runtime.camera.distance = Math.min(before || SELFIE_DISTANCE, SELFIE_DISTANCE);
  bubble({ zh: '来，一起拍一张！', en: 'Let’s take one together!' }, 2200);
  baybayEmote('hop');
  // the shutter opens once the camera has swung round and BAYBAY stands at your side (≤ 2.5 s)
  const settled = () => {
    const g = runtime.guide, p = runtime.player;
    return g.arrived && Math.hypot(g.x - p.x, g.z - p.z) < 3.4;
  };
  const open = (waited: number) => {
    if (waited < 2500 && !settled()) { after(150, () => open(waited + 150)); return; }
    release();
    if (game.get().phase !== 'playing' || game.get().dialogue.nodeId) { runtime.camera.distance = before; return; }
    charApi()?.emote('player', 'pose', { loop: true, seconds: 20 });
    charApi()?.emote('baybay', 'pose', { loop: true, seconds: 20 });
    enterPhotoMode(null);
    // back to the player's own distance when the photo mode closes
    const off = game.subscribe(() => {
      if (game.get().photoMode) return;
      off();
      runtime.camera.distance = before;
    });
  };
  after(900, () => open(900));
}
