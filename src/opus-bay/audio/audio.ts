/**
 * Opus Bay audio entry point. GameRoot calls startAudio() once and keeps the returned cleanup.
 *
 * - The AudioContext is created lazily on the first {type:'start'} event (a user gesture). If the
 *   title was skipped (?start=…) and no 'start' arrives, the first key/pointer gesture after the
 *   title phase boots it instead.
 * - Resumes on later gestures, suspends while the tab is hidden or sound is switched off.
 * - settings.sound is the master switch; settings.music toggles the music bus (both live).
 * All sounds are synthesized; optional voice barks are feature-detected (see voice.ts).
 */
import { onEvent, type GameEvent } from '../core/events';
import { runtime } from '../core/runtime';
import { game, type GameState } from '../core/store';
import { DISTRICT } from '../data/district';
import { Ambience, describeWorld } from './ambience';
import { AudioEngine, BUS_LEVELS } from './engine';
import { createRateLimiter } from './logic';
import { Music } from './music';
import * as rides from './rides';
import * as sfx from './sfx';
import { VoicePlayer } from './voice';

type AudioCtor = typeof AudioContext;

interface Rig {
  ctx: AudioContext;
  engine: AudioEngine;
  ambience: Ambience;
  music: Music;
  voice: VoicePlayer;
  /** wind while gliding, the toy car's motor (movement lane) */
  loops: rides.RideLoops;
}

const DEV = import.meta.env.DEV;

export function startAudio(): () => void {
  if (typeof window === 'undefined') return () => {};
  let rig: Rig | null = null;
  let disposed = false;
  let loop = 0;
  let lastTick = 0;
  let suspendTimer = 0;
  let bootedAt = 0;
  const timers: number[] = [];
  let prev: GameState = game.get();

  const footstepOk = createRateLimiter(6, 2);
  const hoverOk = createRateLimiter(10, 2);
  const areaOk = createRateLimiter(1 / 6, 1);
  const areasHeard = new Set<string>();

  const wantsSound = () => game.get().settings.sound && document.visibilityState === 'visible';
  // right after boot the context may still report 'suspended' for a moment: sounds scheduled then
  // (the arrival foghorn is emitted in the same tick as 'start') simply play once it is running
  const live = () => !!rig && game.get().settings.sound
    && (rig.ctx.state === 'running' || (rig.ctx.state === 'suspended' && performance.now() - bootedAt < 1500));

  const resume = () => {
    if (!rig || !wantsSound()) return;
    window.clearTimeout(suspendTimer);
    // 'suspended', or iOS 'interrupted' (phone call, other app took the audio session)
    const state = rig.ctx.state as string;
    if (state !== 'running' && state !== 'closed') rig.ctx.resume().catch(() => { /* needs another gesture */ });
  };

  const suspendSoon = (delay = 350) => {
    if (!rig) return;
    window.clearTimeout(suspendTimer);
    suspendTimer = window.setTimeout(() => {
      if (rig && !wantsSound() && rig.ctx.state === 'running') rig.ctx.suspend().catch(() => {});
    }, delay);
  };

  const applySettings = (first = false) => {
    if (!rig) return;
    const s = game.get().settings;
    rig.engine.setMaster(s.sound, first ? 0.9 : 0.25);
    const musicOn = s.sound && s.music;
    if (!musicOn) rig.music.setEnabled(false);
    else if (first) timers.push(window.setTimeout(() => { if (rig && game.get().settings.sound && game.get().settings.music) rig.music.setEnabled(true); }, 2200));
    else rig.music.setEnabled(true);
    if (s.sound) resume(); else suspendSoon();
  };

  const tick = () => {
    if (!rig || rig.ctx.state !== 'running') return;
    const now = rig.ctx.currentTime;
    const dt = lastTick ? Math.min(0.5, now - lastTick) : 0.1;
    lastTick = now;
    try {
      rig.ambience.update(dt);
      const v = runtime.vehicle, g = runtime.glide;
      rig.loops.update({ gliding: g.active, glideSpeed: g.speed, glideHeight: g.height, driving: v.occupied && v.kind === 'car', carSpeed: v.speed });
      rig.music.tick();
      rig.engine.update(now);
    } catch (error) {
      if (DEV) console.error('[opus-audio] tick', error);
    }
  };

  const boot = () => {
    if (rig || disposed) return;
    const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return;
    let ctx: AudioContext;
    try { ctx = new Ctor({ latencyHint: 'interactive' }); } catch { return; }
    try {
      // iOS unlock: play one silent sample inside the gesture
      const silent = ctx.createBufferSource();
      silent.buffer = ctx.createBuffer(1, 1, 22050);
      silent.connect(ctx.destination);
      silent.start(0);
    } catch { /* ignore */ }
    const s = game.get();
    const engine = new AudioEngine(ctx);
    const ambience = new Ambience(engine, describeWorld(DISTRICT, false));
    const music = new Music(engine, s.timeOfDay, s.mode);
    const voice = new VoicePlayer(engine);
    rig = { ctx, engine, ambience, music, voice, loops: new rides.RideLoops(engine) };
    bootedAt = performance.now();
    engine.log('boot', { state: ctx.state, sampleRate: ctx.sampleRate });
    applySettings(true);
    engine.setMuffled(s.paused);
    // heavier setup off the gesture: the shore distance field and voice clip probing
    timers.push(window.setTimeout(() => { if (rig && !disposed) rig.ambience.setWorld(describeWorld(DISTRICT, true)); }, 900));
    timers.push(window.setTimeout(() => { if (rig && !disposed) void rig.voice.preload(); }, 3500));
    loop = window.setInterval(tick, 100);
    ctx.addEventListener?.('statechange', () => { if (rig) rig.engine.log(`ctx:${rig.ctx.state}`); });
  };

  const handle = (ev: GameEvent) => {
    if (ev.type === 'start') { boot(); resume(); return; }
    if (!rig || !live()) return;
    const { engine: e, ambience, voice } = rig;
    const now = e.now;
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
      case 'streetcar-bell': sfx.streetcarBell(e); break;
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
    if (s.settings.sound !== p.settings.sound || s.settings.music !== p.settings.music) applySettings();
    if (s.timeOfDay !== p.timeOfDay || s.mode !== p.mode) rig.music.setMood(s.timeOfDay, s.mode);
    if (s.paused !== p.paused) rig.engine.setMuffled(s.paused);
    if (s.photoMode !== p.photoMode) rig.engine.buses.music.setLevel(BUS_LEVELS.music * (s.photoMode ? 0.55 : 1), 0.8);
    if (s.dialogue.nodeId !== p.dialogue.nodeId) {
      // music sits lower while a speech bubble is open (blips duck it further)
      rig.engine.buses.music.hold(s.dialogue.nodeId ? 0.65 : 1);
      if (s.dialogue.nodeId === null) rig.voice.cancel();
    }
  });

  const onGesture = () => {
    if (disposed) return;
    if (!rig) {
      if (game.get().phase === 'title') return;
      boot();
    }
    resume();
  };
  const onVisibility = () => {
    if (!rig) return;
    if (document.visibilityState === 'hidden') { window.clearTimeout(suspendTimer); rig.ctx.suspend().catch(() => {}); }
    else resume();
  };
  const gestureOpts: AddEventListenerOptions = { capture: true, passive: true };
  window.addEventListener('pointerdown', onGesture, gestureOpts);
  window.addEventListener('keydown', onGesture, gestureOpts);
  window.addEventListener('touchend', onGesture, gestureOpts);
  document.addEventListener('visibilitychange', onVisibility);

  if (DEV) {
    (window as unknown as { __opusAudio?: unknown }).__opusAudio = {
      /** snapshot for scripted QA (node scripts/opus-shot.mjs … eval) */
      stats: () => rig ? {
        state: rig.ctx.state,
        time: +rig.ctx.currentTime.toFixed(2),
        ...rig.engine.stats,
        counts: { ...rig.engine.stats.counts },
      } : { state: 'not-started' },
      boot,
    };
  }

  return () => {
    disposed = true;
    offEvent();
    offStore();
    window.removeEventListener('pointerdown', onGesture, gestureOpts);
    window.removeEventListener('keydown', onGesture, gestureOpts);
    window.removeEventListener('touchend', onGesture, gestureOpts);
    document.removeEventListener('visibilitychange', onVisibility);
    window.clearInterval(loop);
    window.clearTimeout(suspendTimer);
    timers.forEach(t => window.clearTimeout(t));
    if (rig) {
      const r = rig;
      rig = null;
      try { r.loops.dispose(); r.voice.dispose(); r.music.dispose(); r.ambience.dispose(); r.engine.dispose(); } catch { /* ignore */ }
      r.ctx.close().catch(() => {});
    }
    if (DEV) delete (window as unknown as { __opusAudio?: unknown }).__opusAudio;
  };
}
