import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { setPageMetadata } from '../lib/seo';
import { primeAudio } from './audio/unlock';
import { game, useGame, type GameState } from './core/store';
import { initPersistence } from './data/wishlist';
import { readQa } from './game/qa';
import { useT } from './i18n';
import { TitleScreen } from './ui/TitleScreen';
import './opus-bay.css';

// The game chunk (three, R3F, the world, actors, UI) — requested once the title has painted.
const GameRoot = lazy(() => import('./game/GameRoot'));

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
  const [load, setLoad] = useState(direct);
  const [wantStart, setWantStart] = useState(false);

  useLayoutEffect(() => initPersistenceOnce(), []);
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('ob-lock');
    return () => html.classList.remove('ob-lock');
  }, []);
  // after the title's first paint, when the main thread is idle (≤ 1.2 s)
  useEffect(() => {
    if (load) return;
    const w = window as IdleWindow;
    let idle = 0, timer = 0;
    const raf = requestAnimationFrame(() => {
      if (w.requestIdleCallback) idle = w.requestIdleCallback(() => setLoad(true), { timeout: 1200 });
      else timer = window.setTimeout(() => setLoad(true), 300);
    });
    return () => { cancelAnimationFrame(raf); if (idle) w.cancelIdleCallback?.(idle); window.clearTimeout(timer); };
  }, [load]);

  // (W7-Q1) inside the tap (Start, 继续旅程, 从头开始, Enter): on WebKit the audio must start in the gesture itself — the
  // game's 'start' comes seconds later, after the first frame (audio/unlock.ts)
  const start = useCallback(() => { primeAudio({ starting: true }); setLoad(true); setWantStart(true); }, []);
  const showTitle = !direct && phase === 'title';
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
    // W5-Z: the city is the default world; ?world=district keeps the district's words
    setPageMetadata(game.get().worldMode === 'city' ? {
      title: t('湾区小旅 · 跟 BAYBAY 逛旧金山｜BAYLINK', 'Little Bay Trip · Explore San Francisco with BAYBAY | BAYLINK'),
      description: t('跟 BAYBAY 逛整座旧金山：金门大桥、叮当车、双峰，真实景点和这周活动，一个可以边玩边查的迷你旧金山。',
        'Roam all of San Francisco with BAYBAY — the Golden Gate, cable cars, Twin Peaks: real places and this week’s events in a mini San Francisco you can play.'),
      path: '/opus-bay',
      preserveText: true,
    } : {
      title: t('湾区小旅 · 跟 BAYBAY 逛 Embarcadero｜BAYLINK', 'Little Bay Trip · Explore the Embarcadero with BAYBAY | BAYLINK'),
      description: t('刚来湾区？让 BAYBAY 带你从渡轮大厦走到 PIER 39：真实景点、这周活动和出游计划，一个可以边玩边查的迷你湾区。',
        'New to the Bay? Let BAYBAY walk you from the Ferry Building to Pier 39 — real places, this week’s events and day plans in a mini Bay Area you can play.'),
      path: '/opus-bay',
      preserveText: true,
    });
  }, [t]);
  return null;
}
