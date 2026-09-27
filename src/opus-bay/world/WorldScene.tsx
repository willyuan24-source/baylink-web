import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { runtime } from '../core/runtime';
import { game, useGame, type Quality, type TimeOfDay } from '../core/store';
import { flow } from '../game/flowStore';
import { readQa } from '../game/qa';
import { setSessionSettings } from '../data/wishlist';
import { suspendForCity } from './cityLoader';
import { U } from './materials';
import { PostFX, type PostParams } from './post';
import { type World, getWorld } from './world';
import { parseKarlFlag } from './sf/fog';

export { FERRY_ARRIVAL_SECONDS } from './life';

/**
 * World entry (imported by GameRoot): the diorama, its life and the render loop.
 * Takes over rendering (useFrame priority 1) so the high tier can run the tilt-shift post pass,
 * and accumulates renderer.info for the whole frame (incl. shadows) for the ?debug overlay.
 */

type QaCam = { position: THREE.Vector3; target: THREE.Vector3 } | null;
let qaCam: QaCam = null;
let post: PostFX | null = null;
const LOWER: Record<Quality, Quality> = { high: 'mid', mid: 'low', low: 'low' };
let timeApplied = false;
const post$ = { focus: 0.3, warm: 0.25, vignette: 0.35, night: 0 } satisfies PostParams;
const _v = new THREE.Vector3();

/**
 * Screen y (0 bottom … 1 top) of what the tilt-shift keeps sharp: the player's chest, or the middle of the
 * pair while a conversation is open. Uses the live projection (incl. any view offset).
 */
function focusY(camera: THREE.Camera, talking: boolean): number {
  const p = runtime.player, g = runtime.guide;
  _v.set(p.x, p.y + 1.0, p.z);
  if (talking && Math.hypot(g.x - p.x, g.z - p.z) < 9) _v.set((p.x + g.x) / 2, (p.y + g.y) / 2 + 1.0, (p.z + g.z) / 2);
  camera.updateMatrixWorld();
  _v.project(camera);
  if (!Number.isFinite(_v.y) || _v.z > 1) return 0.3;
  return Math.min(0.95, Math.max(0.05, (_v.y + 1) / 2));
}

/** Renderer setup owned by the world (tone mapping, shadow filter, per-frame info accumulation, fog). */
function attachRenderer(gl: THREE.WebGLRenderer, scene: THREE.Scene, world: World) {
  gl.toneMapping = THREE.NeutralToneMapping;
  gl.toneMappingExposure = 1;
  gl.shadowMap.type = THREE.PCFShadowMap;
  gl.info.autoReset = false;
  scene.fog = world.env.fog;
  return () => { scene.fog = null; gl.info.autoReset = true; };
}

/** Per-frame renderer prep: R3F's <Canvas shadows> re-applies PCFSoftShadowMap (removed in three r18x) on
 * every GameRoot render, and renderer.info accumulates the whole frame (post pass + shadows). */
function beginFrame(gl: THREE.WebGLRenderer, exposure: number) {
  if (gl.shadowMap.type !== THREE.PCFShadowMap) gl.shadowMap.type = THREE.PCFShadowMap;
  gl.toneMappingExposure = exposure;
  gl.info.reset();
}

function applyTime(world: World, tod: TimeOfDay, reduced: boolean) {
  world.setTime(tod, !timeApplied || reduced);
  timeApplied = true;
}

export function WorldScene() {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera);
  // city mode: the world's constructor needs the lazy city chunk (world/cityLoader.ts); suspend until it is in
  if (game.get().worldMode === 'city') suspendForCity();
  const world = useMemo(() => getWorld(), []);
  const quality = useGame(s => s.settings.quality);
  const timeOfDay = useGame(s => s.timeOfDay);
  const reduced = useGame(s => s.settings.reducedMotion);

  useLayoutEffect(() => attachRenderer(gl, scene, world), [gl, scene, world]);
  useEffect(() => world.setQuality(quality, gl), [gl, quality, world]);
  // city mode: start streaming San Francisco once the hero is on screen (manifest + far load during the arrival)
  useEffect(() => {
    if (world.mode !== 'city') return;
    const q = new URLSearchParams(location.search);
    const pool = q.get('pool');
    // ?karl=0|1: Karl the Fog off / forced on (lane C2-8); without it, the time table (on in the morning and golden hour)
    world.enableCity(gl, game.get().settings.quality, { pool: pool === 'tile' || pool === 'batched' ? pool : undefined, karl: q.has('karl') ? parseKarlFlag(q.get('karl')) : undefined });
  }, [gl, world]);
  useEffect(() => applyTime(world, timeOfDay, reduced), [timeOfDay, reduced, world]);

  // QA hooks (DEV): renderer for the debug overlay, a camera override and quick stats.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    w.__opusBay = {
      ...(w.__opusBay ?? {}),
      renderer: gl,
      world: {
        world, scene, camera, uniforms: U,
        cam(px: number, py: number, pz: number, tx: number, ty: number, tz: number, fx?: number, fz?: number) {
          qaCam = { position: new THREE.Vector3(px, py, pz), target: new THREE.Vector3(tx, ty, tz) };
          // city mode: stream where a player would stand for this view (fx, fz), else 40 u in front of the camera
          if (world.city) {
            const L = Math.hypot(tx - px, tz - pz) || 1;
            world.city.focusOverride = fx !== undefined && fz !== undefined ? { x: fx, z: fz } : { x: px + ((tx - px) / L) * 40, z: pz + ((tz - pz) / L) * 40 };
          }
        },
        clearCam() { qaCam = null; if (world.city) world.city.focusOverride = null; },
        stats() {
          let objects = 0;
          scene.traverse(() => { objects++; });
          return { calls: gl.info.render.calls, triangles: gl.info.render.triangles, objects, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, buildMs: Math.round(world.buildMs), updateMs: +world.updateMs.toFixed(2), programs: gl.info.programs?.length ?? 0 };
        },
      },
    };
  }, [gl, scene, camera, world]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const s = game.get();
    if (qaCam) {
      state.camera.position.copy(qaCam.position);
      state.camera.lookAt(qaCam.target);
      state.camera.updateMatrixWorld();
    }
    beginFrame(gl, world.env.exposure);
    const fade = !flow.get().cinematic && !qaCam;
    world.update(dt, state.clock.elapsedTime, state.camera, fade);
    const usePost = s.settings.quality === 'high' && !s.settings.reducedMotion;
    if (usePost) {
      post ??= new PostFX();
      const f = focusY(state.camera, !!s.dialogue.nodeId);
      post$.focus += (f - post$.focus) * Math.min(1, dt * 10);
      post$.warm = world.env.warm;
      post$.vignette = world.env.vignette;
      post$.night = world.env.night;
      post.render(gl, scene, state.camera, post$);
    } else {
      gl.render(scene, state.camera);
    }
  }, 1);

  const locked = useMemo(() => !!readQa().quality, []);
  const phase = useGame(st => st.phase);
  const [monitor, setMonitor] = useState(false);
  useEffect(() => {
    // Only judge performance once shaders are compiled and the GLBs are in (avoids downgrading on load hitches).
    if (phase !== 'playing' || locked) return;
    const id = window.setTimeout(() => setMonitor(true), 9000);
    return () => window.clearTimeout(id);
  }, [phase, locked]);
  return (
    <>
      <primitive object={world.root} />
      {monitor && (
        <PerformanceMonitor
          ms={500}
          iterations={8}
          flipflops={3}
          onDecline={() => {
            const q = game.get().settings.quality;
            // this visit only: a load hitch must not lower the saved quality for good
            if (q !== 'low') setSessionSettings({ quality: LOWER[q] });
          }}
        />
      )}
    </>
  );
}
