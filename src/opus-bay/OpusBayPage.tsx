import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { SITE_URL, setPageMetadata } from '../lib/seo';
import { OPUS_BAY_OG, opusBayOgImage } from '../lib/opus-bay-metadata';
import { primeAudio } from './audio/unlock';
import { game, useGame, type GameState } from './core/store';
import { initPersistence } from './data/wishlist';
import { readQa } from './game/qa';
import { useT } from './i18n';
import { installIosTouchGuards } from './ui/iosTouch';
import { TitleScreen } from './ui/TitleScreen';
import { entrySource } from './ui/entrySource';
import './opus-bay.css';
import { isLoadFailure } from './game/importRetry';
import { glSupport, probeGl, setGlSupport, useGlSupport } from './game/warmReady';
import { initChunkPending } from './game/chunkPending';

/** (W9-P2, lane P) the WebGL probe once per page, before the game chunk mounts (game/warmReady.ts): false = no WebGL 2. */
function glOk(): boolean {
  if (glSupport() === null) { try { setGlSupport(probeGl().support); } catch { setGlSupport('ok'); } }
  return glSupport() !== 'none';
}

// The game chunk (three, R3F, the world, actors, UI) — requested once the title has painted.
// (W8-P-review, P-RC-1) a bare import, never importRetry: in the production build ~150 lazy chunks import their shared
// modules from GameRoot's own file, so a GameRoot recovered under `?retry=n` is a second instance those chunks never see
// (Chrome keeps the bare URL failed: the play layer then failed and reloaded, or Start never went through). A lost
// GameRoot reloads the page once per session (fresh HTML: a deploy between the page and its chunk is the usual cause), then
// the site's error page with its Refresh button, as before W8-P5. (importRetry stays in this route chunk: isLoadFailure.)
const GAME_RELOAD_KEY = 'opus-bay:game-reload';
const GameRoot = lazy(() => import('./game/GameRoot').then(m => {
  try { sessionStorage.removeItem(GAME_RELOAD_KEY); } catch { /* storage blocked */ }
  return m;
}, (e: unknown) => {
  if (isLoadFailure(e)) {
    try {
      if (!sessionStorage.getItem(GAME_RELOAD_KEY)) { sessionStorage.setItem(GAME_RELOAD_KEY, '1'); location.reload(); return new Promise<never>(() => {}); }
    } catch { /* storage blocked: the error page */ }
  }
  throw e;
}));

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };

let persisted = false;
/** Saved progress + settings (the title's "welcome back" needs them); URL-forced settings stay per visit. */
function initPersistenceOnce() {
  if (persisted) return;
  persisted = true;
  const qa = readQa();
  const locked: (keyof GameState['settings'])[] = [];
  if (qa.quality) locked.push('quality');
  if (qa.time) locked.push('timeOfDay');
  initPersistence({ lockedSettings: locked });
}

/**
 * /opus-bay — standalone full-screen world. The title screen is DOM and lives in this (tiny) route chunk so it
 * paints before three / R3F / the game download; the game chunk loads on idle right after, or at once for QA
 * deep links (?start=, ?solo=), which skip the title.
 */
export default function OpusBayPage() {
  const phase = useGame(s => s.phase);
  const [direct] = useState(() => { try { return !!readQa().start || new URLSearchParams(location.search).has('solo'); } catch { return false; } });
  // (W9-P2) no WebGL 2: the game never mounts (its canvas threw into the site's error page); the title stays with a note
  const [load, setLoad] = useState(() => direct && glOk());
  const noGl = useGlSupport() === 'none';
  const [wantStart, setWantStart] = useState(false);

  // (W9-E) where this visit came from (?from=home|nav|play|photo|…): read and taken off the address bar as the page
  // mounts; lane S's metrics and the game ask entrySource() again and get the same answer
  useLayoutEffect(() => { entrySource(); }, []);
  useLayoutEffect(() => initPersistenceOnce(), []);
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('ob-lock');
    // (W7-Q6) no pinch-zoom of the whole game from inside a scroller; no page left shifted after the keyboard closes
    const offTouch = installIosTouchGuards();
    // (W9-P4) a part being loaded again after a failed load: 还在加载… (game/chunkPending.ts)
    const offPending = initChunkPending();
    return () => { html.classList.remove('ob-lock'); offTouch(); offPending(); };
  }, []);
  // after the title's first paint, when the main thread is idle (≤ 1.2 s)
  useEffect(() => {
    if (load) return;
    const w = window as IdleWindow;
    let idle = 0, timer = 0;
    const raf = requestAnimationFrame(() => {
      const go = () => { if (glOk()) setLoad(true); };
      if (w.requestIdleCallback) idle = w.requestIdleCallback(go, { timeout: 1200 });
      else timer = window.setTimeout(go, 300);
    });
    return () => { cancelAnimationFrame(raf); if (idle) w.cancelIdleCallback?.(idle); window.clearTimeout(timer); };
  }, [load]);

  // (W7-Q1) inside the tap (Start, 继续旅程, 从头开始, Enter): on WebKit the audio must start in the gesture itself — the
  // game's 'start' comes seconds later, after the first frame (audio/unlock.ts)
  const start = useCallback(() => { primeAudio({ starting: true }); setLoad(true); setWantStart(true); }, []);
  const showTitle = (!direct || noGl) && phase === 'title';
  return (
    <main className="ob-page">
      <PageMeta />
      {load && (
        <Suspense fallback={direct ? <div className="ob-boot"><span className="ob-boot-dot" /></div> : null}>
          <GameRoot startRequested={wantStart} />
        </Suspense>
      )}
      {showTitle && (
        <div className="ob-overlay ob-title-layer" style={{ zIndex: 3 }}>
          <TitleScreen onStart={start} waiting={wantStart} />
        </div>
      )}
    </main>
  );
}

/**
 * The tab title in the chosen language (the site's dictionary does not know the game's words), again on a switch. Its
 * own component: the page itself does not re-render on a language switch (that would re-render the whole game tree).
 */
function PageMeta() {
  const { t } = useT();
  useEffect(() => {
    // W5-Z: the city is the default world; ?world=district keeps the district's words. (W9-E) the share image is the key
    // art's 1200 × 630 crop (the Halloween one in October), as in the prerendered dist/opus-bay.html — not the site's icon
    setPageMetadata(game.get().worldMode === 'city' ? {
      title: t('湾区小旅 · 跟 BAYBAY 逛旧金山｜BAYLINK', 'Little Bay Trip · Explore San Francisco with BAYBAY | BAYLINK'),
      description: t('跟 BAYBAY 逛整座旧金山：金门大桥、叮当车、双峰，真实景点和这周活动，一个可以边玩边查的迷你旧金山。',
        'Roam all of San Francisco with BAYBAY — the Golden Gate, cable cars, Twin Peaks: real places and this week’s events in a mini San Francisco you can play.'),
      path: '/opus-bay',
      image: opusBayOgImage(),
      preserveText: true,
    } : {
      title: t('湾区小旅 · 跟 BAYBAY 逛 Embarcadero｜BAYLINK', 'Little Bay Trip · Explore the Embarcadero with BAYBAY | BAYLINK'),
      description: t('刚来湾区？让 BAYBAY 带你从渡轮大厦走到 PIER 39：真实景点、这周活动和出游计划，一个可以边玩边查的迷你湾区。',
        'New to the Bay? Let BAYBAY walk you from the Ferry Building to Pier 39 — real places, this week’s events and day plans in a mini Bay Area you can play.'),
      path: '/opus-bay',
      image: `${SITE_URL}${OPUS_BAY_OG.key}`,
      preserveText: true,
    });
  }, [t]);
  return null;
}
