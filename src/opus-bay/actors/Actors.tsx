import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { installInput, padActions } from '../core/input';
import { openPanel, togglePanel } from '../game/flow';
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
    padActions.journal = () => { if (game.get().phase === 'playing') togglePanel('journal'); };
    padActions.settings = () => { if (game.get().phase === 'playing') openPanel('settings'); };
    return () => { offKeys(); offPointer(); padActions.journal = null; padActions.settings = null; };
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
