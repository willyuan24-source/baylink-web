import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { game, useGame } from '../core/store';
import { WorldScene } from '../world/WorldScene';
import { loadCity } from '../world/cityLoader';
import { initQualityPolicy, nextWarmState } from '../world/quality';
import { stopWarmup, warmPrograms } from '../world/warmup';
import { Actors } from '../actors/Actors';
import { CameraRig } from '../actors/CameraRig';
import { Systems } from './Systems';
import { Overlay } from '../ui/Overlay';

const DPR: Record<string, number> = { high: 1.5, mid: 1.25, low: 1 };
/** Camera far plane: the district fits in 1600 u; the whole city (Twin Peaks → Ferry Building + boards) needs 3000. */
const FAR = { district: 1600, city: 3000 } as const;

/** ?solo=<landmarkId> — landmark turntable for QA instead of the game (world/sf/landmarks/SoloView.tsx) */
const SoloView = lazy(() => import('../world/sf/landmarks/SoloView'));
function readSolo(): string | null {
  try { const v = new URLSearchParams(location.search).get('solo'); return v && /^[a-z0-9-]{1,64}$/i.test(v) ? v : null; } catch { return null; }
}

// Audio (~60 kB min) is its own chunk, fetched as soon as the game chunk runs: it is normally in by the time
// Start is pressed (the title shows meanwhile); if not, it boots on the next gesture (audio/audio.ts).
const audio = typeof window !== 'undefined' ? import('../audio/audio') : null;

// City mode only: the streamed city is its own chunk (world/cityLoader.ts, HC-2), fetched in parallel with the
// renderer setup; WorldScene waits for it. District mode never loads it.
if (typeof window !== 'undefined' && game.get().worldMode === 'city') loadCity().catch(() => { /* WorldScene retries and reports */ });

// The start quality (world/quality.ts, P4): touch-first / high-density devices start at `mid` unless ?quality= or the
// player's own pick says otherwise; applied before the canvas mounts (no high → mid rebuild on the first frames).
if (typeof window !== 'undefined') initQualityPolicy();

export interface GameRootProps {
  /** the page's title screen asked to start (the title lives in OpusBayPage so it paints before this chunk) */
  startRequested?: boolean;
}

/** Composition root. Modules plug in here; keep this file thin. */
export default function GameRoot({ startRequested = false }: GameRootProps) {
  const solo = readSolo();
  if (solo) return <Suspense fallback={null}><SoloView id={solo} /></Suspense>;
  return <Game startRequested={startRequested} />;
}

function Game({ startRequested }: { startRequested: boolean }) {
  const quality = useGame(s => s.settings.quality);
  const phase = useGame(s => s.phase);
  const worldMode = useGame(s => s.worldMode);
  // a Start pressed on the page's title waits for the world's first frame (no empty canvas behind the cinematic)
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    let stop: (() => void) | null = null, gone = false;
    void audio?.then(m => { if (!gone) stop = m.startAudio(); });
    return () => { gone = true; stop?.(); };
  }, []);
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) game.set(s => ({ settings: { ...s.settings, reducedMotion: true } }));
  }, []);
  return (
    <div className={`ob-root ob-phase-${phase}`}>
      <Canvas
        className="ob-canvas"
        shadows={quality !== 'low' ? 'percentage' : false}
        dpr={[1, DPR[quality] ?? 1.25]}
        gl={{ antialias: quality !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: false }}
        camera={{ fov: 40, near: 0.5, far: FAR[worldMode], position: [0, 30, 40] }}
        onCreated={({ gl }) => { gl.setClearColor('#f3ecdf'); }}
      >
        <Suspense fallback={null}>
          <WorldScene />
          <FirstFrame onDrawn={setDrawn} />
          <Warmup />
          <Actors />
          <CameraRig />
          <Systems />
        </Suspense>
      </Canvas>
      <Overlay startRequested={startRequested && drawn} />
    </div>
  );
}

/** Reports once the world has rendered a frame. */
function FirstFrame({ onDrawn }: { onDrawn: (v: boolean) => void }) {
  const done = useRef(false);
  useFrame(() => { if (!done.current) { done.current = true; onDrawn(true); } });
  return null;
}

/**
 * Compiles the streamed city's shader variants once the world has mounted (world/warmup.ts) — in both world
 * modes, so the first city cell never stalls — and again after a quality / motion change (the render path
 * is part of each program's key). Exposes the result on window.__opusBay.warmup in DEV.
 */
function Warmup() {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera);
  const offscreen = useGame(s => s.settings.quality === 'high' && !s.settings.reducedMotion);
  const quality = useGame(s => s.settings.quality);
  useEffect(() => {
    let gone = false;
    // after the world's own effects (fog, tone mapping, shadow map) and the first frames
    const id = window.setTimeout(() => {
      void warmPrograms(gl, scene, camera, { offscreen, next: nextWarmState(quality) }).then(r => {
        if (gone || !import.meta.env.DEV) return;
        const w = window as unknown as { __opusBay?: Record<string, unknown> };
        w.__opusBay = { ...(w.__opusBay ?? {}), warmup: r };
        console.debug(`[opus-bay warmup] ${r.before} → ${r.after} programs in ${r.ms.toFixed(0)} ms`);
      }).catch(error => { if (import.meta.env.DEV) console.warn('[opus-bay warmup]', error); });
    }, 250);
    // the background passes of this warm-up stop with it (a new level warms up again; an unmount frees the renderer)
    return () => { gone = true; window.clearTimeout(id); stopWarmup(gl); };
  }, [gl, scene, camera, offscreen, quality]);
  return null;
}
