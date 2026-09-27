import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { installInput, padActions } from '../core/input';
import { openPanel, togglePanel } from '../game/flow';
import { flow } from '../game/flowStore';
import { game } from '../core/store';
import { attachPointer } from './pointer';
import { ActorSystem } from './system';

/**
 * Actors entry (imported by GameRoot): the newcomer, BAYBAY, the residents, click / tap-to-walk and input.
 * All per-frame work happens in ActorSystem.update — no React state changes per frame.
 */
export function Actors() {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera);
  const system = useMemo(() => new ActorSystem(), []);

  useEffect(() => {
    system.setPrecompile(object => gl.compileAsync(object, camera, scene));
    return () => system.setPrecompile(null);
  }, [system, gl, camera, scene]);

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
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    w.__opusBay = { ...(w.__opusBay ?? {}), actors: system };
  }, [system]);

  useFrame((state, dt) => system.update(dt, state.clock.elapsedTime, state.camera));

  return (
    <>
      <primitive object={system.root} />
      <primitive object={system.pick} onClick={system.onGroundClick} />
    </>
  );
}
