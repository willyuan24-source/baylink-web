/**
 * Opus Bay audio entry point. GameRoot calls startAudio() once and keeps the returned cleanup.
 *
 * - Preparation runs at load, off the input path (lead note P1): the AudioContext is created in the first idle slice
 *   (opening the audio device is the one unavoidable stall, 110–370 ms on Windows Chrome, so it happens while the
 *   page is still loading), then the noise / reverb buffers and the shore field are synthesised in slices of ≤ 4 ms
 *   (audio/slices.ts). The context stays suspended.
 * - Activation is the old boot moment: the first {type:'start'} event (a user gesture), or, if the title was skipped
 *   (?start=…), the first key / pointer gesture after the title phase. It only resumes the context and plays the
 *   silent iOS unlock sample; a gesture that comes before the idle slice opens the context there (rare).
 * - Resumes on later gestures, suspends while the tab is hidden or sound is switched off.
 * - settings.sound is the master switch; settings.music toggles the music bus (both live).
 * All sounds are synthesized; optional voice barks are feature-detected (see voice.ts).
 */
import { subscribeLocale } from '../../i18n/locale';
import { onEvent, type GameEvent } from '../core/events';
import { runtime } from '../core/runtime';
import { game, type GameState } from '../core/store';
import { DISTRICT } from '../data/district';
import { SF_VOICE_LINES } from '../data/voiceLinesSf';
import { Ambience, describeWorld, shoreJob } from './ambience';
import { lineVoices, soundAt } from './cityHooks';
import { AudioEngine, BUS_LEVELS, engineBuffersJob, makeReverb } from './engine';
import { audioHooksStats, bindAudioHooks, soundRegistered, stepAudioHooks } from './hooks';
import { clamp, createRateLimiter, panFor, transitSound } from './logic';
import { Music } from './music';
import * as rides from './rides';
import * as sfx from './sfx';
import { runSliced, type Job, type Sliced } from './slices';
import { VoicePlayer } from './voice';
import { busGains, getAudioLevels, onAudioLevels } from './levels';
import { adoptAudioContext, audioProbe, primeAudio, releaseAudioContext, shareAudioContext, silentSample } from './unlock';
import type { LineLoops } from './lines';
import { platforms } from '../actors/platform';
import { w4Kind } from '../data/transit';
import { currentRide, lineRideUnderground } from '../game/ride';
import { flow } from '../game/flowStore';
import { importRetry } from '../game/importRetry';

type AudioCtor = typeof AudioContext;

interface Rig {
  ctx: AudioContext;
  engine: AudioEngine;
  ambience: Ambience;
  music: Music;
  voice: VoicePlayer;
  /** wind while gliding, the toy car's motor (movement lane) */
  loops: rides.RideLoops;
  /** wave 4 (lane T, city mode): the bus hum, the LRV whine, the tunnel rumble (audio/lines.ts, built on the first ride) */
  lines?: LineLoops;
}

// optional chaining: node tests run startAudio against a fake window (no import.meta.env there)
const DEV = import.meta.env?.DEV;

/** wave 6 (lane X, W6-X3): audio/halloween.ts, loaded at the first `halloween` event (out of the main graph) */
let halloweenChunk: Promise<typeof import('./halloween')> | null = null;
function halloweenSfx(e: AudioEngine, ev: Extract<GameEvent, { type: 'halloween' }>) {
  // a moment a lane sounds itself (lane H's own find chime, registered as 'halloween:pumpkin') is left to that lane
  if (ev.what === 'pumpkin' && soundRegistered('halloween:pumpkin')) return;
  (halloweenChunk ??= importRetry(() => import('./halloween'))).then(m => { const s = m.halloweenSound(ev); if (s) m.playHalloween(e, s); })
    .catch(error => { halloweenChunk = null; if (DEV) console.warn('[opus-bay audio] halloween sounds', error); });
}

const NIGHT_PHASE: Extract<GameEvent, { type: 'halloween' }> = { type: 'halloween', what: 'phase', id: 'night' };

/**
 * (W9-X1) Music in a public place (the first-use review's risk: music on by default, straight out of the speaker): the
 * music no longer starts 2.2 s after the Start tap. It waits for the player's own first gesture after Start (a gesture
 * at least MUSIC_GESTURE_GAP ms later — the Start tap's own pointer / touch / click events do not count; with ?start= the
 * activating gesture is the player's own, so it counts) and then fades in from silence (MUSIC_FADE_TAU: ≈ 95 % after
 * 3 τ ≈ 9 s), at the player's music level (audio/levels.ts, default 60 % of wave 8's mix). The master, the soundscape
 * and BAYBAY come in with the Start tap as before (the W7 iPhone unlock inside the tap is unchanged).
 */
export const MUSIC_GESTURE_GAP = 1200;
export const MUSIC_FADE_TAU = 3;
/**
 * (W9-X review, X-RV-5) A gesture that reaches for the sound is not the music's cue: the tap on ⚙ / the More menu's
 * 设置, Esc, the gamepad's settings button, or any tap inside Settings (its 音乐 switch, the sliders). The gesture counts
 * only when Settings is closed both as it happens and this long after it (the click that opens the panel lands in
 * between); the first gesture after Settings is closed again starts the music (at the level just chosen).
 */
export const MUSIC_SETTINGS_GRACE = 300;
/** (W9-X1, tests / QA) the music's start in the running startAudio: the player's gesture has come, the music has begun */
export const musicProbe = { wanted: false, started: false };
/**
 * (W9-X3, tests / QA) voice-line events taken / skipped (a second one for the same bubble); (W9-X6) the dialogue node the
 * last taken line belongs to (null: a bubble's, or none) and how often a node's line was let go (the node moved on)
 */
export const voiceLineProbe = { accepted: 0, skipped: 0, node: null as string | null, nodeReleases: 0 };

/**
 * (W6-X review) The big night's toll waits for the sound to be live: halloween/world.ts announces the phase once, when the
 * feature starts, and that is before the audio is live (live QA with ?halloween=night: no toll). Every event is `see`n
 * before the live gate; the first live moment after a `night` announcement `take`s the toll (once; a later phase disarms it).
 */
export function nightTollGate() {
  let armed = false;
  return {
    see(ev: GameEvent) { if (ev.type === 'halloween' && ev.what === 'phase') armed = ev.id === 'night'; },
    take(): boolean { const t = armed; armed = false; return t; },
  };
}

export function startAudio(): () => void {
  if (typeof window === 'undefined') return () => {};
  let ctx: AudioContext | null = null;
  let rig: Rig | null = null;
  let prep: Sliced<void> | null = null;
  /** the player pressed Start / made the first gesture after the title: sound may play from now on */
  let activated = false;
  let activatedAt = 0;
  /** how long opening the context took (QA: the one stall preparation cannot slice) */
  let ctxMs = 0;
  /** (W9-X1) the player's own first gesture after Start has come: the music may begin (and once begun, it stays begun) */
  let musicWanted = false;
  let musicStarted = false;
  /** (X-RV-5) a gesture's music cue waiting out MUSIC_SETTINGS_GRACE */
  let musicCue = 0;
  let disposed = false;
  let loop = 0;
  let lastTick = 0;
  let suspendTimer = 0;
  const timers: number[] = [];
  let prev: GameState = game.get();

  const footstepOk = createRateLimiter(6, 2);
  const hoverOk = createRateLimiter(10, 2);
  const areaOk = createRateLimiter(1 / 6, 1);
  const cableBellOk = createRateLimiter(1 / 1.5, 1);
  const hornOk = createRateLimiter(1 / 4, 1);
  const hopOk = createRateLimiter(1 / 4, 1);
  /** where an event emitted with audio/cityHooks emitAt happened: its pan and distance from the listener */
  const located = () => {
    if (!soundAt.set) return { pan: 0, d: 0 };
    const p = runtime.player;
    return { pan: panFor(p, runtime.camera.yaw, soundAt, 0.8), d: Math.hypot(soundAt.x - p.x, soundAt.z - p.z) };
  };
  const areasHeard = new Set<string>();
  // wave 4 (lane T): the loop / Metro sounds, their own small chunk, fetched in city mode on the first bus / LRV event
  let cityLines: typeof import('./lines') | null = null;
  let linesLoading: Promise<void> | null = null;
  const loadCityLines = () => {
    if (game.get().worldMode !== 'city') return;
    linesLoading ??= importRetry(() => import('./lines')).then(m => { cityLines = m; }, () => { linesLoading = null; });
  };
  /** the tour clips that may play at this stop and the next (lane C's narration; lane V's recordings) */
  const preloadStopVoices = (line: string, station: string) => {
    const ids = lineVoices.ids?.(line, station, currentRide()?.dir);
    if (!rig || !ids?.length) return;
    const lang = VoicePlayer.lang();
    // (W7-Q2) pinned in the capped clip cache until the next stop's list replaces them
    rig.voice.loadStop(ids.map(id => `${lang}-${id}`));
  };
  /** the continuous line layers from the ride: the bus / surface LRV speed (its platform), the subway rumble */
  const lineLoops = (r: Rig) => {
    const ride = currentRide();
    const kind = ride?.line ? w4Kind(ride.line) : null;
    if (!kind && !r.lines) return;
    if (!cityLines) { if (kind) loadCityLines(); return; }
    r.lines ??= new cityLines.LineLoops(r.engine);
    const riding = !!kind && ride!.mode !== 'wait';
    const plat = riding ? platforms.get(ride!.line!) : undefined;
    const speed = plat?.live ? Math.hypot(plat.vx, plat.vz) : 0;
    const tunnel = riding && kind === 'light-rail' && lineRideUnderground();
    r.lines.update({ bus: riding && kind === 'bus', busSpeed: speed, lrv: riding && kind === 'light-rail' && !tunnel, lrvSpeed: speed, tunnel });
  };

  const wantsSound = () => game.get().settings.sound && document.visibilityState === 'visible';
  // right after boot the context may still report 'suspended' for a moment: sounds scheduled then
  // (the arrival foghorn is emitted in the same tick as 'start') simply play once it is running
  const live = () => !!rig && activated && game.get().settings.sound
    && (rig.ctx.state === 'running' || (rig.ctx.state === 'suspended' && performance.now() - activatedAt < 1500));

  const resume = () => {
    if (!ctx || !activated || !wantsSound()) return;
    window.clearTimeout(suspendTimer);
    // 'suspended', or iOS 'interrupted' (phone call, other app took the audio session)
    const state = ctx.state as string;
    if (state !== 'running' && state !== 'closed') ctx.resume().catch(() => { /* needs another gesture */ });
  };

  const suspendSoon = (delay = 350) => {
    if (!ctx) return;
    window.clearTimeout(suspendTimer);
    suspendTimer = window.setTimeout(() => {
      if (ctx && (!activated || !wantsSound()) && ctx.state === 'running') ctx.suspend().catch(() => {});
    }, delay);
  };

  /** (W9-X1) the music bus's gain: its mix level × the player's music level (audio/levels.ts), lower in photo mode; 0 before it begins */
  const musicGain = () => musicStarted ? busGains(getAudioLevels(), BUS_LEVELS).music * (game.get().photoMode ? 0.55 : 1) : 0;
  let applied: ReturnType<typeof busGains> | null = null;
  /** (W9-X1) the player's levels on the four buses (only the buses whose gain changed are touched: a fade in progress keeps going) */
  const applyLevels = (tau = 0.15) => {
    if (!rig) return;
    const g = { ...busGains(getAudioLevels(), BUS_LEVELS), music: musicGain() };
    const b = rig.engine.buses;
    for (const k of ['ambience', 'sfx', 'voice', 'music'] as const) if (!applied || Math.abs(applied[k] - g[k]) > 1e-4) b[k].setLevel(g[k], tau);
    applied = g;
  };
  /** (W9-X1) the music begins once: after the player's own first gesture, from silence, fading in at their level */
  const maybeStartMusic = () => {
    if (musicStarted || !musicWanted || !rig || !activated || disposed) return;
    musicStarted = true;
    musicProbe.started = true;
    rig.engine.log('music:begin');
    applyLevels(MUSIC_FADE_TAU);
    const s = game.get().settings;
    if (s.sound && s.music) rig.music.setEnabled(true);
  };

  const applySettings = (first = false) => {
    if (!rig || !activated) return;
    const s = game.get().settings;
    rig.engine.setMaster(s.sound, first ? 0.9 : 0.25);
    const musicOn = s.sound && s.music;
    // (W9-X1) before the player's first own gesture the music waits (maybeStartMusic), whatever the switch says
    if (!musicOn) rig.music.setEnabled(false);
    else if (musicStarted) rig.music.setEnabled(true);
    if (s.sound) resume(); else suspendSoon();
  };

  const tick = () => {
    if (!rig || !activated || rig.ctx.state !== 'running') return;
    const now = rig.ctx.currentTime;
    const dt = lastTick ? Math.min(0.5, now - lastTick) : 0.1;
    lastTick = now;
    try {
      rig.ambience.update(dt);
      const v = runtime.vehicle, g = runtime.glide;
      rig.loops.update({ gliding: g.active, glideSpeed: g.speed, glideHeight: g.height, driving: v.occupied && v.kind === 'car', carSpeed: v.speed });
      lineLoops(rig);
      // wave 5 (audio/hooks.ts): the new lanes' loops fade toward their targets
      stepAudioHooks(dt);
      rig.music.tick();
      rig.engine.update(now);
    } catch (error) {
      if (DEV) console.error('[opus-audio] tick', error);
    }
  };

  /**
   * Open a context, suspended until activation. The first one opens the audio device: 110–370 ms on Windows.
   * (W7-Q1) On WebKit a tap on the title may already have made the page's context (audio/unlock.ts primeAudio, inside
   * the Start tap): that one is adopted — started inside the gesture, it is the one WebKit lets play. The one made here
   * is shared back, so the Start tap primes it.
   */
  const createContext = (): AudioContext | null => {
    const adopted = adoptAudioContext();
    let c: AudioContext;
    if (adopted) { c = adopted; ctxMs = 0; } else {
      const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) return null;
      const t0 = performance.now();
      try { c = new Ctor({ latencyHint: 'interactive' }); } catch { return null; }
      ctxMs = performance.now() - t0;
      shareAudioContext(c);
    }
    // an autoplay-allowed page starts it running: keep it quiet (and the audio thread idle) until activation — but not
    // one the Start tap left running for the arrival (W7-Q1)
    if (!activated && c.state === 'running' && !audioProbe.startPrimed) c.suspend().catch(() => {});
    c.addEventListener?.('statechange', () => { if (rig) rig.engine.log(`ctx:${c.state}`); });
    return c;
  };

  /** iOS unlock: one silent sample played inside the gesture that activates audio (audio/unlock.ts). */
  const unlock = silentSample;

  /** The rig comes alive (the old boot tail): master fade-in, music after 2.2 s, voice clips after 3.5 s, the tick. */
  const goLive = () => {
    if (!rig || disposed) return;
    const s = game.get();
    rig.engine.log('boot', { state: rig.ctx.state, sampleRate: rig.ctx.sampleRate });
    // wave 5 (audio/hooks.ts): the lanes' playSound / setLoop / duck reach this engine from now on
    bindAudioHooks(rig.engine, live);
    // (W9-X1) the player's levels (the music bus silent until the music begins), then the switches
    applied = null;
    applyLevels(0.05);
    applySettings(true);
    maybeStartMusic();
    rig.engine.setMuffled(s.paused);
    timers.push(window.setTimeout(() => {
      if (!rig || disposed) return;
      const voice = rig.voice;
      // city mode: lane H2b's recorded lines after the barks (data/voiceLinesSf.ts; nothing while it is empty)
      void voice.preload().then(() => { if (!disposed && game.get().worldMode === 'city') void voice.preloadLines(); });
    }, 3500));
    loop = window.setInterval(tick, 100);
  };

  /** Everything heavy, in idle slices from load on: the context, the engine buffers, the rig, then the shore field. */
  function* prepare(): Job<void> {
    let reverb: ConvolverNode | undefined;
    if (!ctx) {
      ctx = createContext();
      if (!ctx) return;
      // the reverb's kernel setup is native and unsliceable too: take it in the same stall (≈ +30 ms)
      reverb = makeReverb(ctx);
      yield;
    }
    const c = ctx;
    const buffers = yield* engineBuffersJob(c, reverb);
    const engine = new AudioEngine(c, buffers);
    yield;
    const ambience = new Ambience(engine, describeWorld(DISTRICT, false));
    yield;
    const s = game.get();
    const music = new Music(engine, s.timeOfDay, s.mode);
    rig = { ctx: c, engine, ambience, music, voice: new VoicePlayer(engine), loops: new rides.RideLoops(engine) };
    if (activated) goLive();
    yield;
    // the shore distance field: the district's; in city mode the ambience builds the whole city's round the listener
    // (audio/city.ts CityShore) once the streamed terrain is in
    if (game.get().worldMode === 'city') return;
    const shore = yield* shoreJob(DISTRICT);
    if (rig && !disposed) rig.ambience.setShore(shore);
  }

  const startPrep = () => {
    if (prep || disposed) return;
    prep = runSliced(prepare());
    prep.done.catch(error => { if (DEV) console.error('[opus-audio] prepare', error); });
  };

  /** The gesture path: resume the context and play the unlock sample, nothing heavy (lead note P1). */
  const activate = () => {
    if (disposed) return;
    const first = !activated;
    if (first) { activated = true; activatedAt = performance.now(); audioProbe.activated = true; }
    // a gesture before the first idle slice opened the context: open it here (the old path, rare)
    if (!ctx) ctx = createContext();
    if (!ctx) return;
    if (first) {
      unlock(ctx);
      // else prepare() goes live as soon as the rig exists
      if (rig) goLive();
    }
    resume();
  };

  /** (W9-X3) the bubble the playing recorded line belongs to (undefined: none, or a line with no bubble) */
  let lineKey: number | undefined;
  /** (W9-X6) the dialogue node a recorded line with no bubble belongs to (BAYBAY's dialogue box: game/voiceW5.ts) */
  let lineNode: string | null = null;
  const night = nightTollGate();
  const handle = (ev: GameEvent) => {
    night.see(ev);
    if (ev.type === 'start') { activate(); return; }
    if (!rig || !live()) return;
    const { engine: e, ambience, voice } = rig;
    const now = e.now;
    if (night.take()) halloweenSfx(e, NIGHT_PHASE);
    switch (ev.type) {
      case 'footstep': if (footstepOk(now)) sfx.footstep(e, ev.surface, ev.run); break;
      case 'jump': sfx.jump(e); break;
      case 'land': sfx.land(e, ev.impact, runtime.player.surface); break;
      case 'bump': sfx.bump(e, ev.kind, ev.strength); break;
      case 'interact': sfx.interact(e, ev.kind); break;
      case 'dialogue': voice.speak(ev.speaker, ev.nodeId); break;
      case 'choice': sfx.choice(e); break;
      case 'ui': if (ev.action !== 'hover' || hoverOk(now)) sfx.ui(e, ev.action); break;
      case 'stamp': sfx.stamp(e); break;
      case 'postcard': sfx.postcard(e); voice.bark('yay', 0.9); break;
      case 'goal': sfx.goal(e); voice.bark('yay', 0.8); break;
      case 'wish': sfx.wish(e, ev.added); break;
      case 'bell': sfx.bell(e); break;
      // (city mode: another F-line car's bell comes from where it is)
      case 'streetcar-bell': { const at = located(); if (soundAt.set) sfx.streetcarBell(e, clamp(1 - at.d / 70, 0.25, 1), at.pan); else sfx.streetcarBell(e); break; }
      // city transit (lane F): cable-car bells, grip, turntable; the ferry's horn; a walker hopping out of the way —
      // panned from where they happened (audio/cityHooks emitAt), the loudness already in `strength`
      case 'transit': {
        const s = transitSound(ev.what, ev.kind, ev.strength);
        if (!s) break;
        const { pan } = located();
        switch (s.kind) {
          case 'cable-bell': if (cableBellOk(now)) sfx.cableBell(e, s.gain, s.strikes, pan); break;
          case 'grip-clank': sfx.gripClank(e, s.gain, pan); break;
          case 'turntable-creak': sfx.turntableCreak(e, s.gain, pan); break;
          case 'turntable-rumble': sfx.turntableRumble(e, s.gain, pan); break;
          case 'ferry-horn': if (hornOk(now)) sfx.ferryHorn(e, s.gain, pan); break;
          case 'hop-squeak': if (hopOk(now)) sfx.hopSqueak(e, s.gain, pan); break;
          // wave 4 (lane T): the loop buses and the Muni Metro (audio/lines.ts, loaded with the city layers)
          default: {
            const w4 = cityLines;
            if (!w4) { void loadCityLines(); break; }
            switch (s.kind) {
              case 'bus-arrive': w4.busAirBrake(e, s.gain, pan); w4.doorChime(e, true, s.gain, pan, 0.5); break;
              case 'door-open': w4.doorChime(e, true, s.gain, pan); break;
              case 'door-close': w4.doorChime(e, false, s.gain, pan); break;
              case 'stop-bell': w4.stopBell(e); break;
              case 'lrv-gong': if (cableBellOk(now)) w4.lrvGong(e, s.gain, pan); break;
              case 'bus-horn': if (hornOk(now)) w4.busHorn(e, s.gain, pan); break;
            }
          }
        }
        // the tour clips of the next stop (lane C's narration): fetched ahead so the 0.7 s line wait never drops them
        if (ev.station && (ev.what === 'board' || ev.what === 'approach' || ev.what === 'arrive')) preloadStopVoices(ev.line, ev.station);
        break;
      }
      case 'foghorn': ambience.foghorn(); break;
      case 'sea-lion': ambience.seaLion(ev.intensity); break;
      case 'gull': ambience.gull(); break;
      case 'shutter': sfx.shutter(e); break;
      case 'arrive': sfx.arrive(e); voice.bark('arrived', 0.45); break;
      case 'area':
        // a soft "discovered" chime the first time you enter a named area
        if (!areasHeard.has(ev.name) && areaOk(now)) { areasHeard.add(ev.name); sfx.areaChime(e); }
        break;
      case 'guide-call': sfx.guideCall(e); voice.bark('hi', 0.8); break;
      case 'emote': sfx.emote(e, ev.who, ev.emote); break;
      // --- movement (lane E)
      case 'vehicle:enter': rides.seatPop(e, true); break;
      case 'vehicle:exit': rides.seatPop(e, false); break;
      case 'vehicle:horn': if (ev.vehicle === 'bike') rides.bikeBell(e); else rides.toyHorn(e); break;
      case 'vehicle:call': if (ev.vehicle === 'bike') rides.bikeBell(e); else rides.toyHorn(e); break;
      case 'vehicle:bump': if (ev.strength > 0.08) sfx.bump(e, ev.vehicle === 'car' ? 'rubber' : 'metal', 0.2 + ev.strength * 0.8); break;
      case 'vehicle:hop': sfx.jump(e); break;
      case 'vehicle:land': sfx.land(e, ev.impact, 'road'); break;
      case 'vehicle:blocked': case 'glide:no-landing': sfx.ui(e, 'error'); break;
      case 'glide:start': rides.glideWhoosh(e); voice.bark('wow', 0.7); break;
      case 'glide:unlock': sfx.goal(e); break;
      case 'sit': rides.sitCreak(e); break;
      case 'pant': rides.pant(e); break;
      // wave 6 (lane X, W6-X3): the Halloween sounds live in their own small chunk, fetched at the season's first event
      case 'halloween': if (ev.what !== 'phase') halloweenSfx(e, ev); break;
      // recorded city lines (lane H2b data, lane G2 triggers): the clip, else the line's chirp
      // (W9-X3) the line belongs to the bubble on screen when it is emitted (every lane emits it right after its bubble():
      // game/voiceW5.ts, the pacer, baybayLines, realsf, economy): its clip starts only while that bubble is still up, and
      // a newer bubble cuts it (offBubble below). (W9-X6) No bubble but a dialogue box open: the line belongs to that
      // node (closed or moved on before the clip starts: it never plays; moved on while it plays: it stops, offStore).
      // Neither (a card carries the words): no gate.
      case 'voice-line': {
        const key = flow.get().bubble?.key;
        const node = key === undefined ? game.get().dialogue.nodeId : null;
        // one voice per bubble: the first voice-line of a bubble wins (the binder's text match comes first, inside
        // bubble(); a lane's own id for the same bubble after it — realsf's `realsf-<key>` — would chirp over the clip)
        if (key !== undefined && key === lineKey) { voiceLineProbe.skipped++; break; }
        voiceLineProbe.accepted++;
        // a line of another bubble still playing stops now (not only once the new clip has loaded)
        if (key !== lineKey && voice.stopLine()) voice.lineStats.cut++;
        lineKey = key;
        lineNode = node;
        voiceLineProbe.node = node;
        voice.line(ev.id, SF_VOICE_LINES[ev.id]?.fallback ?? 'hi', key !== undefined ? () => flow.get().bubble?.key === key : node ? () => game.get().dialogue.nodeId === node : null);
        break;
      }
    }
  };

  const offEvent = onEvent(ev => {
    try { handle(ev); } catch (error) { if (DEV) console.error('[opus-audio]', ev.type, error); }
  });

  const offStore = game.subscribe(() => {
    const s = game.get();
    const p = prev;
    prev = s;
    if (!rig) return;
    if (activated && (s.settings.sound !== p.settings.sound || s.settings.music !== p.settings.music)) applySettings();
    if (s.timeOfDay !== p.timeOfDay || s.mode !== p.mode) rig.music.setMood(s.timeOfDay, s.mode);
    if (s.paused !== p.paused) rig.engine.setMuffled(s.paused);
    if (s.photoMode !== p.photoMode) applyLevels(0.8);
    if (s.dialogue.nodeId !== p.dialogue.nodeId) {
      // music sits lower while a speech bubble is open (blips duck it further)
      rig.engine.buses.music.hold(s.dialogue.nodeId ? 0.65 : 1);
      if (s.dialogue.nodeId === null) rig.voice.cancel();
      // (W9-X6) the dialogue line's node closed or moved on: its words are gone, so is its voice
      if (lineNode !== null && s.dialogue.nodeId !== lineNode) { lineNode = null; voiceLineProbe.nodeReleases++; if (rig.voice.stopLine()) rig.voice.lineStats.cut++; }
    }
  });

  // (W9-X3) one voice at a time: when another bubble replaces the one a recorded line belongs to (a new line, a resident's
  // bubble, a card's line), that line fades out — its words are gone. A bubble that simply ends keeps its clip (the
  // binder holds a voiced bubble for its clip's length, game/voiceW5.ts).
  const offBubble = flow.subscribe(() => {
    if (lineKey === undefined || !rig) return;
    const b = flow.get().bubble;
    if (b && b.key !== lineKey) { lineKey = undefined; if (rig.voice.stopLine()) rig.voice.lineStats.cut++; }
  });

  // (W9-X1) Settings' sliders / 只关语音 (audio/levels.ts) apply live
  const offLevels = onAudioLevels(() => applyLevels(0.15));

  // a language switch (Settings · 语言): BAYBAY's next line is in the new language (VoicePlayer.lang() is read per line);
  // warm the new language's barks — and in the city its recorded lines — as at boot, so that line does not wait for
  // its clip or fall back to a chirp. 简体 ↔ 繁體 share the Chinese recordings: nothing to load.
  let voiceLang = VoicePlayer.lang();
  const offLocale = subscribeLocale(() => {
    const lang = VoicePlayer.lang();
    if (lang === voiceLang) return;
    voiceLang = lang;
    const voice = rig?.voice;
    // (before the rig goes live its own warm-up, 3.5 s after the start, takes the language of that moment)
    if (!voice || disposed || !activated) return;
    void voice.preload().then(() => { if (!disposed && game.get().worldMode === 'city') void voice.preloadLines(); });
  });

  const settingsOpen = () => game.get().panel.kind === 'settings';
  const onGesture = () => {
    if (disposed) return;
    // (W7-Q1) a tap on the title does not activate sound yet, but on WebKit it starts the context inside the gesture
    // (then quiet again), so the later 'start' may resume it; the Start tap itself primes it in OpusBayPage.start
    if (!activated && game.get().phase === 'title') { primeAudio(); return; }
    // (W9-X1) the player's own gesture: the one that activates sound when the title was skipped (?start=), or the first
    // one well after the Start tap (not that tap's own pointer / touch / key events)
    const own = !musicWanted && (!activated || performance.now() - activatedAt > MUSIC_GESTURE_GAP);
    activate();
    // (X-RV-5) …unless it reaches for the sound: Settings open now, or open once the gesture's click has landed
    if (own && !musicCue && !settingsOpen()) {
      musicCue = window.setTimeout(() => {
        musicCue = 0;
        if (disposed || musicWanted || settingsOpen()) return;
        musicWanted = musicProbe.wanted = true;
        maybeStartMusic();
      }, MUSIC_SETTINGS_GRACE);
    }
  };
  const onVisibility = () => {
    if (!ctx || !activated) return;
    if (document.visibilityState === 'hidden') { window.clearTimeout(suspendTimer); ctx.suspend().catch(() => {}); }
    else resume();
  };
  const gestureOpts: AddEventListenerOptions = { capture: true, passive: true };
  window.addEventListener('pointerdown', onGesture, gestureOpts);
  window.addEventListener('keydown', onGesture, gestureOpts);
  window.addEventListener('touchend', onGesture, gestureOpts);
  document.addEventListener('visibilitychange', onVisibility);

  if (DEV) {
    // (W7-Q1) the tap unlock: primes made, whether this module adopted the tap's context and still shares it
    const unlockStats = () => ({ primes: audioProbe.primes, startPrimed: audioProbe.startPrimed, unlocked: audioProbe.unlocked, adopted: audioProbe.adopted, shared: !!ctx && audioProbe.ctx === ctx });
    (window as unknown as { __opusAudio?: unknown }).__opusAudio = {
      /** snapshot for scripted QA (node scripts/opus-shot.mjs … eval) */
      stats: () => rig ? {
        state: rig.ctx.state,
        activated,
        time: +rig.ctx.currentTime.toFixed(2),
        prep: prep ? { slices: prep.stats.slices, ctxMs: +ctxMs.toFixed(1), longestAfterContext: Math.max(0, ...prep.stats.times.slice(1)), times: prep.stats.times } : null,
        ...rig.engine.stats,
        counts: { ...rig.engine.stats.counts },
        city: rig.ambience.debugCity(),
        // (W5-T6) the wave-5 lanes' sounds and loops (audio/hooks.ts), and the buses' ducks
        hooks: audioHooksStats(),
        ducks: { music: rig.engine.buses.music.ducking, ambience: rig.engine.buses.ambience.ducking },
        unlock: unlockStats(),
        // (W9-X1) the player's levels and the music's start
        levels: { ...getAudioLevels(), musicWanted, musicStarted, buses: applied },
        // (W9-X3) recorded lines played / dropped with their bubble gone / cut by a newer bubble / skipped (只关语音)
        lines: { ...rig.voice.lineStats, speaking: rig.voice.lineSpeaking() },
      } : { state: ctx ? 'preparing' : 'not-started', activated, unlock: unlockStats(), prep: prep ? { slices: prep.stats.slices, ctxMs: +ctxMs.toFixed(1), longestAfterContext: Math.max(0, ...prep.stats.times.slice(1)), times: prep.stats.times } : null },
      boot: activate,
    };
  }
  musicProbe.wanted = musicProbe.started = false;
  startPrep();

  return () => {
    disposed = true;
    offEvent();
    offStore();
    offLocale();
    offLevels();
    offBubble();
    window.removeEventListener('pointerdown', onGesture, gestureOpts);
    window.removeEventListener('keydown', onGesture, gestureOpts);
    window.removeEventListener('touchend', onGesture, gestureOpts);
    document.removeEventListener('visibilitychange', onVisibility);
    window.clearInterval(loop);
    window.clearTimeout(suspendTimer);
    window.clearTimeout(musicCue);
    timers.forEach(t => window.clearTimeout(t));
    prep?.cancel();
    bindAudioHooks(null);
    if (rig) {
      const r = rig;
      rig = null;
      try { r.loops.dispose(); r.lines?.dispose(); r.voice.dispose(); r.music.dispose(); r.ambience.dispose(); r.engine.dispose(); } catch { /* ignore */ }
    }
    releaseAudioContext(ctx);
    ctx?.close().catch(() => {});
    ctx = null;
    if (DEV) delete (window as unknown as { __opusAudio?: unknown }).__opusAudio;
  };
}
