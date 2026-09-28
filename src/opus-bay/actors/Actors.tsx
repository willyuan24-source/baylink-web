import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { installInput, padActions } from '../core/input';
import { openPanel, togglePanel } from '../game/flow';
import { flow } from '../game/flowStore';
import { game, useGame } from '../core/store';
import { attachPointer } from './pointer';
import { ActorSystem } from './system';
import { setCharApi } from './charApi';

/** renderer.compileAsync for the render path the world uses (the tilt-shift post target or the screen). */
function precompileFor(gl: THREE.WebGLRenderer, object: THREE.Object3D, camera: THREE.Camera, scene: THREE.Scene, offscreen: boolean) {
  const prev = gl.getRenderTarget();
  const target = offscreen ? new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }) : null;
  try {
    gl.setRenderTarget(target);
    const pending = gl.compileAsync(object, camera, scene);
    return pending.finally(() => target?.dispose());
  } finally { gl.setRenderTarget(prev); }
}

/**
 * Actors entry (imported by GameRoot): the newcomer, BAYBAY, the residents, click / tap-to-walk and input.
 * All per-frame work happens in ActorSystem.update — no React state changes per frame.
 */
export function Actors() {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera);
  const system = useMemo(() => new ActorSystem(), []);

  // the render path is part of each program's key (world/warmup.ts): with the tilt-shift post (quality high, motion on)
  // the world draws into a half-float target without tone mapping, so late models (the BAYBAY GLB, the pelican) compile
  // for that target too — else their first frame on screen links new programs (C2's P5)
  const offscreen = useGame(s => s.settings.quality === 'high' && !s.settings.reducedMotion);
  useEffect(() => {
    system.setPrecompile(object => precompileFor(gl, object, camera, scene, offscreen));
    return () => system.setPrecompile(null);
  }, [system, gl, camera, scene, offscreen]);

  useEffect(() => {
    const offKeys = installInput();
    const offPointer = attachPointer(gl.domElement);
    // (Y / View like J / M on the keyboard: not over a dialogue, photo mode, a cinematic, fishing or the postcard reward)
    const free = () => { const s = game.get(), f = flow.get(); return s.phase === 'playing' && !s.dialogue.nodeId && !s.photoMode && !f.cinematic && !f.fishing && !f.postcardReward; };
    padActions.journal = () => { if (free()) togglePanel('journal'); };
    padActions.settings = () => { if (game.get().phase === 'playing') openPanel('settings'); };
    padActions.map = () => { if (free()) togglePanel('map'); };
    return () => { offKeys(); offPointer(); padActions.journal = null; padActions.settings = null; padActions.map = null; };
  }, [gl]);
  useEffect(() => () => system.dispose(), [system]);
  // wave 5 (W5-F2): the charApi implementation lives while the actors do (lanes A, E, R, D call charApi())
  useEffect(() => { setCharApi(system.char); return () => setCharApi(null); }, [system]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    w.__opusBay = { ...(w.__opusBay ?? {}), actors: system };
    // (QA: G1's fast travel as the game runs it — a page script's own import can load a second copy under dev HMR)
    void import('../game/fastTravel').then(ft => { w.__opusBay = { ...(w.__opusBay ?? {}), fastTravel: ft }; });
  }, [system]);

  useFrame((state, dt) => system.update(dt, state.clock.elapsedTime, state.camera));

  return (
    <>
      <primitive object={system.root} />
      <primitive object={system.pick} onClick={system.onGroundClick} />
    </>
  );
}
