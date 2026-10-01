import { lazy, Suspense, useEffect, useSyncExternalStore, type CSSProperties } from 'react';
import { runtime } from '../core/runtime';
import { game, useGame } from '../core/store';
import { loadCatalog } from '../data/catalog';
import { DISTRICT } from '../data/district';
import { progressExtras } from '../data/wishlist';
import { skipCinema } from '../game/cinema';
import { skipTravel, travelActive } from '../game/fastTravel';
import {
  beginPlaying, callBaybay, initFlowListeners, closeFishing, closePanel, closePostcardReward, enterPhotoMode, noteInteractHandled, openPanel, reel, requestInteract,
  teleportPlayer, togglePanel,
} from '../game/flow';
import { startOrResume } from '../game/resume';
import { flow, useFlow } from '../game/flowStore';
import { setRightInset } from '../game/projector';
import { bayTimeOfDay, readQa } from '../game/qa';
import { useIsMobile } from './hooks';
import { loadGuideLayer, loadMoveChip, loadRideBanner } from './lazyParts';
import { lazyPart, loadPlayParts } from './playLayer';
import { afterFirstFrame } from '../game/firstFrame';
import { importRetry } from '../game/importRetry';
import { closeOverlay, closeTopOverlay, openOverlays, overlays, subscribeOverlays } from './slots';

// W6-P1 (lane P, MF9): the parts that render in play (and the toasts / live regions) are one chunk (ui/playParts.tsx), fetched as soon as GameRoot
// runs; GameRoot holds a pressed Start until it is in, so each stand-in below is the part itself from the first frame.
const Dialogue = lazyPart('Dialogue');
const EventCard = lazyPart('EventCard');
const CoachMark = lazyPart('CoachMark');
const TapHint = lazyPart('TapHint');
const Hud = lazyPart('Hud');
const RideBanner = lazyPart('RideBanner');
const FishGame = lazyPart('FishGame');
const GoalsCard = lazyPart('GoalsCard');
const PhotoMode = lazyPart('PhotoMode');
const PostcardReward = lazyPart('PostcardReward');
const Recap = lazyPart('Recap');
const PoiCard = lazyPart('PoiCard');
const TouchControls = lazyPart('TouchControls');
const CinematicLayer = lazyPart('CinematicLayer');
const DebugOverlay = lazyPart('DebugOverlay');
const LeadChip = lazyPart('LeadChip');
const LiveRegion = lazyPart('LiveRegion');
const SpeechBubble = lazyPart('SpeechBubble');
const TimeOffer = lazyPart('TimeOffer');
const Toasts = lazyPart('Toasts');
const Waypoint = lazyPart('Waypoint');

// Side panels are their own chunks (opened by a key / HUD button, prefetched once play starts).
const loadMap = () => importRetry(() => import('./MapPanel'));
const loadJournal = () => importRetry(() => import('./Journal'));
const loadWeek = () => importRetry(() => import('./WeekPanel'));
const loadSettings = () => importRetry(() => import('./Settings'));
const MapPanel = lazy(() => loadMap().then(m => ({ default: m.MapPanel })));
const Journal = lazy(() => loadJournal().then(m => ({ default: m.Journal })));
const WeekPanel = lazy(() => loadWeek().then(m => ({ default: m.WeekPanel })));
const SettingsPanel = lazy(() => loadSettings().then(m => ({ default: m.SettingsPanel })));
// wave 4 · lane T: the subway overlay, only during a Muni Metro ride (its own chunk)
const LineRideLayer = lazy(() => importRetry(() => import('./LineRideLayer')));
// Wave 4 · lane G's city guidance on screen (arrival toast and card, panorama tags, trip card): city mode only
const GuideOverlay = lazy(() => loadGuideLayer().then(m => ({ default: m.GuideOverlay })));
const GuideToasts = lazy(() => loadGuideLayer().then(m => ({ default: m.GuideToasts })));
const GuideLeadChip = lazy(() => loadGuideLayer().then(m => ({ default: m.GuideLeadChip })));

/**
 * All DOM UI over the canvas. The title screen is not here: OpusBayPage owns it (it paints before this chunk
 * loads) and sets `startRequested` when Start is pressed and the world has drawn its first frame.
 */
export function Overlay({ startRequested = false }: { startRequested?: boolean }) {
  useBoot();
  // (lane G1's game/resume.ts: the title's "continue where you left off", else exactly startGame())
  useEffect(() => { if (startRequested) startOrResume(); }, [startRequested]);
  usePrefetchPanels();
  useTimeOfDay();
  useKeyboard();
  const phase = useGame(s => s.phase);
  const photo = useGame(s => s.photoMode);
  const reduced = useGame(s => s.settings.reducedMotion);
  const debug = useFlow(s => s.debug);
  const panel = useGame(s => s.panel);
  const cinematic = useFlow(s => s.cinematic);
  const metroRide = useFlow(s => s.ride?.kind === 'light-rail');
  // F1: no HUD between Start and the welcome choice (the first minute is BAYBAY's, not the buttons')
  const welcoming = useGame(s => s.mode === 'onboarding');
  const inDialogue = useGame(s => !!s.dialogue.nodeId);
  const fishing = useFlow(s => !!s.fishing);
  const talking = inDialogue || fishing;
  const wideWeek = useFlow(s => !!s.weekResult);
  const sheetWidth = !panel.kind || panel.kind === 'recap' ? 0 : panel.kind === 'map' || (panel.kind === 'week' && wideWeek) ? 572 : 452;
  const mobile = useIsMobile();
  useEffect(() => { setRightInset(mobile ? 0 : sheetWidth); }, [mobile, sheetWidth]);
  const offer = useFlow(s => !!s.timeOffer);
  const hudOn = phase === 'playing' && !photo && !cinematic && !welcoming;
  const city = useGame(s => s.worldMode === 'city');
  // wave 4 (city): a trip under way owns the objective slot (its pill opens the trip card), so the goals card folds
  const trip = useFlow(s => !!s.trip && s.trip.leg < s.trip.legs.length) && city;
  // the goals card: never over a cinematic or a trip (DR-4), and it waits while the night-view banner is up (M1)
  const goalsOn = phase === 'playing' && !photo && !cinematic && !offer && !trip;
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
          {metroRide && <Suspense fallback={null}><LineRideLayer /></Suspense>}
          {hudOn && <Hud />}
          {goalsOn && !mobile && <GoalsCard />}
          {phase === 'playing' && !photo && <CoachMark />}
          {phase === 'playing' && !photo && !welcoming && (city ? <Suspense fallback={null}><GuideLeadChip /></Suspense> : <LeadChip />)}
          {panel.kind === 'poi' && <PoiCard key={panel.id} id={panel.id} />}
          {panel.kind === 'event' && <EventCard key={panel.id} id={panel.id} />}
          <Suspense fallback={null}>
            {panel.kind === 'week' && <WeekPanel />}
            {panel.kind === 'map' && <MapPanel />}
            {panel.kind === 'journal' && <Journal />}
            {panel.kind === 'settings' && <SettingsPanel />}
          </Suspense>
          {panel.kind === 'recap' && <Recap />}
          {city && phase === 'playing' && !photo && <Suspense fallback={null}><GuideOverlay /></Suspense>}
          <SlotOverlays />
          <Dialogue />
          <FishGame />
          <PostcardReward />
          {photo && <PhotoMode />}
          {phase === 'playing' && !photo && <TouchControls />}
        </>
      )}
      {/* (M1 / DR-3) one column under the top row: night-view banner, ride banner, goals card (phones), toasts */}
      <div className="ob-topstack">
        {phase === 'playing' && <TimeOffer />}
        {hudOn && <RideBanner />}
        {goalsOn && mobile && <GoalsCard />}
        {city && phase === 'playing' && <Suspense fallback={null}><GuideToasts /></Suspense>}
        <Toasts />
      </div>
      <LiveRegion />
      {debug && <DebugOverlay />}
    </div>
  );
}

/**
 * Wave 5 · ui/slots.ts registerOverlay / openOverlay: the lanes' overlays (the shop sheet, a fact card, an activity's
 * result card, the emote wheel …), oldest first, above the HUD and the panels and under the dialogue box. Each one
 * gets its `props` and a `close`; Escape closes the most recent (useKeyboard).
 */
function SlotOverlays() {
  const open = useSyncExternalStore(subscribeOverlays, openOverlays, openOverlays);
  const registered = useSyncExternalStore(overlays.subscribe, overlays.list, overlays.list);
  if (!open.length) return null;
  return (
    <Suspense fallback={null}>
      {open.map(o => {
        const slot = registered.find(r => r.id === o.id);
        return slot ? <slot.Component key={o.id} props={o.props} close={() => closeOverlay(o.id)} /> : null;
      })}
    </Suspense>
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
    // lane G1: discovery, the HUD street name and the save v2 sampler (city mode only; district untouched). W7-P1: its
    // own chunk with the place index, fetched here in both modes as before (it is in long before Start)
    void importRetry(() => import('../game/discovery')).then(m => { m.initG1(); }, () => { /* offline: no discovery this visit */ });
    // F11: a first visit opens at golden hour (the key art's light); from the second visit the Bay clock applies
    if (!qa.time && !progressExtras().visited && game.get().settings.timeOfDay === 'auto') flow.set({ goldenFirstVisit: true });
    game.set(s => ({ settings: { ...s.settings, ...(qa.quality ? { quality: qa.quality } : {}), ...(qa.time ? { timeOfDay: qa.time } : {}) } }));
    runtime.camera.distance = game.get().settings.cameraDistance;
    if (qa.debug) flow.set({ debug: true });
    teleportPlayer(DISTRICT.anchors?.['ferry-gate'] ?? DISTRICT.spawn, DISTRICT.spawn.heading);
    // (W7-P3: a ?start= deep link — QA — begins once the play layer is in, as the title's Start does: the dialogue
    // script and the HUD come with it)
    if (qa.start) { const start = qa.start; void loadPlayParts().then(() => beginPlaying(start), () => beginPlaying(start)); }
    // Prefetch the live catalog (needed by cards and the week board) shortly after the world's first frame. W7-P5: it is
    // ≈ 125 KB gzip / 0.6 MB of JSON — on a phone the 1.5 s timer from here fired while the city was still loading and
    // took that bandwidth and ≈ 0.13 s of parse before the first frame (sf-w7-P.md part c); Start loads it anyway.
    let id = 0;
    const off = afterFirstFrame(() => { id = window.setTimeout(() => { void loadCatalog(); }, 1500); });
    return () => { off(); window.clearTimeout(id); };
  }, []);
}

/** Fetch the side-panel chunks a few seconds into play, so the first M / J press opens instantly. */
function usePrefetchPanels() {
  const playing = useGame(s => s.phase === 'playing');
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => { void loadMap(); void loadJournal(); void loadWeek(); void loadSettings(); void loadRideBanner(); void loadMoveChip(); }, 4000);
    return () => window.clearTimeout(id);
  }, [playing]);
}

/** Resolve 'auto' time of day from the real Bay Area clock. */
function useTimeOfDay() {
  const setting = useGame(s => s.settings.timeOfDay);
  const firstGolden = useFlow(s => s.goldenFirstVisit);
  // (W6-K1, lane R's review) the band depends on the world (the city's real sun, the district's fixed hours): a world
  // switch re-applies it at once instead of keeping the old world's band for up to a minute
  const world = useGame(s => s.worldMode);
  useEffect(() => {
    const apply = () => game.set({ timeOfDay: setting === 'auto' ? (firstGolden ? 'golden' : bayTimeOfDay(undefined, world)) : setting });
    apply();
    if (setting !== 'auto' || firstGolden) return;
    const id = window.setInterval(apply, 60_000);
    return () => window.clearInterval(id);
  }, [setting, firstGolden, world]);
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
        if (code === 'Escape' || (f.cinematic === 'arrival' && (code === 'Enter' || code === 'Space'))) { e.preventDefault(); if (travelActive()) skipTravel(); else skipCinema(); }
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
          // wave 5: a lane's overlay (ui/slots.ts) closes first, the most recent one
          if (closeTopOverlay()) break;
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
