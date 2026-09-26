import { lazy, Suspense, useEffect, type CSSProperties } from 'react';
import { TouchControls } from '../actors/TouchControls';
import { runtime } from '../core/runtime';
import { game, useGame } from '../core/store';
import { loadCatalog } from '../data/catalog';
import { DISTRICT } from '../data/district';
import { progressExtras } from '../data/wishlist';
import { skipCinema } from '../game/cinema';
import {
  beginPlaying, callBaybay, initFlowListeners, closeFishing, closePanel, closePostcardReward, enterPhotoMode, noteInteractHandled, openPanel, reel, requestInteract,
  startGame, teleportPlayer, togglePanel,
} from '../game/flow';
import { flow, useFlow } from '../game/flowStore';
import { setRightInset } from '../game/projector';
import { bayTimeOfDay, readQa } from '../game/qa';
import { useIsMobile } from './hooks';
import { Dialogue } from './Dialogue';
import { EventCard } from './EventCard';
import { CinematicLayer, DebugOverlay, LeadChip, LiveRegion, SpeechBubble, TimeOffer, Toasts, Waypoint } from './Floating';
import { CoachMark, TapHint } from './CoachMark';
import { Hud } from './Hud';
import { FishGame, GoalsCard, PhotoMode, PostcardReward, Recap } from './Moments';
import { PoiCard } from './PoiCard';

// Side panels are their own chunks (opened by a key / HUD button, prefetched once play starts).
const loadMap = () => import('./MapPanel');
const loadJournal = () => import('./Journal');
const loadWeek = () => import('./WeekPanel');
const loadSettings = () => import('./Settings');
const MapPanel = lazy(() => loadMap().then(m => ({ default: m.MapPanel })));
const Journal = lazy(() => loadJournal().then(m => ({ default: m.Journal })));
const WeekPanel = lazy(() => loadWeek().then(m => ({ default: m.WeekPanel })));
const SettingsPanel = lazy(() => loadSettings().then(m => ({ default: m.SettingsPanel })));

/**
 * All DOM UI over the canvas. The title screen is not here: OpusBayPage owns it (it paints before this chunk
 * loads) and sets `startRequested` when Start is pressed and the world has drawn its first frame.
 */
export function Overlay({ startRequested = false }: { startRequested?: boolean }) {
  useBoot();
  useEffect(() => { if (startRequested) startGame(); }, [startRequested]);
  usePrefetchPanels();
  useTimeOfDay();
  useKeyboard();
  const phase = useGame(s => s.phase);
  const photo = useGame(s => s.photoMode);
  const reduced = useGame(s => s.settings.reducedMotion);
  const debug = useFlow(s => s.debug);
  const panel = useGame(s => s.panel);
  const cinematic = useFlow(s => s.cinematic);
  // F1: no HUD between Start and the welcome choice (the first minute is BAYBAY's, not the buttons')
  const welcoming = useGame(s => s.mode === 'onboarding');
  const inDialogue = useGame(s => !!s.dialogue.nodeId);
  const fishing = useFlow(s => !!s.fishing);
  const talking = inDialogue || fishing;
  const wideWeek = useFlow(s => !!s.weekResult);
  const sheetWidth = !panel.kind || panel.kind === 'recap' ? 0 : panel.kind === 'map' || (panel.kind === 'week' && wideWeek) ? 572 : 452;
  const mobile = useIsMobile();
  useEffect(() => { setRightInset(mobile ? 0 : sheetWidth); }, [mobile, sheetWidth]);
  return (
    <div
      className={`ob-overlay ${reduced ? 'is-reduced' : ''} ${photo ? 'is-photo' : ''} ${panel.kind ? 'has-panel' : ''} ${sheetWidth ? 'has-sheet' : ''} ${panel.kind === 'recap' ? 'is-modal' : ''} ${cinematic ? 'is-cinema' : ''} ${talking ? 'is-talking' : ''}`}
      style={sheetWidth ? ({ '--ob-sheet-w': `${sheetWidth}px` } as CSSProperties) : undefined}
    >
      {phase !== 'title' && (
        <>
          <Waypoint />
          <TapHint />
          <SpeechBubble />
          <CinematicLayer />
          {phase === 'playing' && !photo && !cinematic && !welcoming && <Hud />}
          {phase === 'playing' && !photo && <GoalsCard />}
          {phase === 'playing' && !photo && <CoachMark />}
          {phase === 'playing' && !photo && !welcoming && <LeadChip />}
          {panel.kind === 'poi' && <PoiCard key={panel.id} id={panel.id} />}
          {panel.kind === 'event' && <EventCard key={panel.id} id={panel.id} />}
          <Suspense fallback={null}>
            {panel.kind === 'week' && <WeekPanel />}
            {panel.kind === 'map' && <MapPanel />}
            {panel.kind === 'journal' && <Journal />}
            {panel.kind === 'settings' && <SettingsPanel />}
          </Suspense>
          {panel.kind === 'recap' && <Recap />}
          <Dialogue />
          <FishGame />
          <PostcardReward />
          {photo && <PhotoMode />}
          {phase === 'playing' && !photo && <TouchControls />}
        </>
      )}
      <Toasts />
      {phase === 'playing' && <TimeOffer />}
      <LiveRegion />
      {debug && <DebugOverlay />}
    </div>
  );
}

// ---------------------------------------------------------------------------

let booted = false;

/** URL hooks (?start ?time ?quality ?debug), catalog prefetch. Runs once per page (persistence: OpusBayPage). */
function useBoot() {
  useEffect(() => {
    if (booted) return;
    booted = true;
    const qa = readQa();
    initFlowListeners();
    // F11: a first visit opens at golden hour (the key art's light); from the second visit the Bay clock applies
    if (!qa.time && !progressExtras().visited && game.get().settings.timeOfDay === 'auto') flow.set({ goldenFirstVisit: true });
    game.set(s => ({ settings: { ...s.settings, ...(qa.quality ? { quality: qa.quality } : {}), ...(qa.time ? { timeOfDay: qa.time } : {}) } }));
    runtime.camera.distance = game.get().settings.cameraDistance;
    if (qa.debug) flow.set({ debug: true });
    teleportPlayer(DISTRICT.anchors?.['ferry-gate'] ?? DISTRICT.spawn, DISTRICT.spawn.heading);
    if (qa.start) beginPlaying(qa.start);
    // Prefetch the live catalog shortly after first paint (small JSON, needed by cards and the week board).
    const id = window.setTimeout(() => { void loadCatalog(); }, 1500);
    return () => window.clearTimeout(id);
  }, []);
}

/** Fetch the side-panel chunks a few seconds into play, so the first M / J press opens instantly. */
function usePrefetchPanels() {
  const playing = useGame(s => s.phase === 'playing');
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => { void loadMap(); void loadJournal(); void loadWeek(); void loadSettings(); }, 4000);
    return () => window.clearTimeout(id);
  }, [playing]);
}

/** Resolve 'auto' time of day from the real Bay Area clock. */
function useTimeOfDay() {
  const setting = useGame(s => s.settings.timeOfDay);
  const firstGolden = useFlow(s => s.goldenFirstVisit);
  useEffect(() => {
    const apply = () => game.set({ timeOfDay: setting === 'auto' ? (firstGolden ? 'golden' : bayTimeOfDay()) : setting });
    apply();
    if (setting !== 'auto' || firstGolden) return;
    const id = window.setInterval(apply, 60_000);
    return () => window.clearInterval(id);
  }, [setting, firstGolden]);
}

const typing = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};
const onControl = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute?.('role') === 'button' || el.getAttribute?.('role') === 'tab');
};

/** Global shortcuts (movement keys belong to actors/). Dialogue and photo mode own their keys. */
function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      const s = game.get(), f = flow.get();
      const code = e.code;
      if (s.phase === 'title') return; // the title screen (OpusBayPage) owns its keys
      if (f.cinematic) {
        if (code === 'Escape' || (f.cinematic === 'arrival' && (code === 'Enter' || code === 'Space'))) { e.preventDefault(); skipCinema(); }
        return;
      }
      if (f.postcardReward) {
        if (code === 'KeyE' || code === 'Escape' || ((code === 'Enter' || code === 'Space') && !onControl(e.target))) { e.preventDefault(); noteInteractHandled(); closePostcardReward(); }
        return;
      }
      if (f.fishing) {
        if (code === 'KeyE' || code === 'Space' || (code === 'Enter' && !onControl(e.target))) { e.preventDefault(); noteInteractHandled(); reel(); }
        else if (code === 'Escape') closeFishing();
        return;
      }
      if (s.dialogue.nodeId || s.photoMode || e.repeat) return;
      switch (code) {
        case 'KeyM': togglePanel('map'); break;
        case 'KeyJ': togglePanel('journal'); break;
        case 'KeyP': enterPhotoMode(); break;
        case 'KeyQ': callBaybay(); break;
        case 'Escape':
          e.preventDefault();
          if (s.panel.kind) closePanel(); else openPanel('settings');
          break;
        case 'KeyE':
          if (requestInteract('key')) e.preventDefault();
          break;
        case 'Enter':
          if (onControl(e.target)) return;
          if (requestInteract('key')) e.preventDefault();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
