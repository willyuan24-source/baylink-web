import type { ComponentType } from 'react';
import type { Interactable } from './interactables';

/**
 * Day-0 registry (wave 2; FROZEN after day 0): lanes plug per-frame steps, scene components and extra click proxies into
 * game/Systems.tsx (lane G1's file) from their own files. Registration order does not matter: Systems re-renders its
 * scene components and click proxies when this registry changes.
 *
 *   registerFrameSystem(key, step, order?)   step(dt, now) every frame inside the Canvas Ticker, after the transit
 *                                            step and the input edges, before the 10 Hz focus / guide brain.
 *                                            dt is clamped to 0.1 s; now = performance.now() ms. Lower order first.
 *   registerSceneSystem(key, Component)      an R3F component mounted inside <Systems/> (use useFrame / useThree
 *                                            there); unmounted when unregistered
 *   registerProxySource(fn)                  extra invisible click spheres for an interactable (e.g. an SF landmark's
 *                                            body for its POI card): fn(it) → hits in world space, or null
 *
 * Every register returns its unregister function. Keys are unique per registry (re-registering a key replaces it).
 * World-side systems (meshes that follow the streamed city) use world/world.ts `getWorld().addSystem` instead.
 */

export type FrameStep = (dt: number, now: number) => void;
export interface ProxyHit { x: number; y: number; z: number; r: number }
export type ProxySource = (it: Interactable) => ProxyHit[] | null;

interface FrameEntry { key: string; step: FrameStep; order: number }
let frames: FrameEntry[] = [];
const scenes = new Map<string, ComponentType>();
let sceneList: { key: string; Component: ComponentType }[] = [];
const proxies: ProxySource[] = [];
let epoch = 0;
const listeners = new Set<() => void>();
const bump = () => { epoch++; listeners.forEach(fn => fn()); };

export function registerFrameSystem(key: string, step: FrameStep, order = 0): () => void {
  const entry = { key, step, order };
  frames = [...frames.filter(f => f.key !== key), entry].sort((a, b) => a.order - b.order);
  return () => { frames = frames.filter(f => f !== entry); };
}

/** Called by the Systems Ticker once per frame. A throwing step is logged (DEV) and does not stop the others. */
export function stepFrameSystems(dt: number, now: number) {
  for (const f of frames) {
    try { f.step(dt, now); } catch (error) { if (import.meta.env?.DEV) console.error(`[opus-bay frame system ${f.key}]`, error); }
  }
}

export function registerSceneSystem(key: string, Component: ComponentType): () => void {
  scenes.set(key, Component);
  sceneList = [...scenes].map(([k, C]) => ({ key: k, Component: C }));
  bump();
  return () => {
    if (scenes.get(key) !== Component) return;
    scenes.delete(key);
    sceneList = [...scenes].map(([k, C]) => ({ key: k, Component: C }));
    bump();
  };
}
/** Stable snapshot (a new array only after a change), for useSyncExternalStore. */
export const sceneSystems = () => sceneList;

export function registerProxySource(fn: ProxySource): () => void {
  proxies.push(fn);
  bump();
  return () => { const i = proxies.indexOf(fn); if (i >= 0) { proxies.splice(i, 1); bump(); } };
}
/** Extra click spheres for one interactable (empty when no source adds any). */
export function extraProxies(it: Interactable): ProxyHit[] {
  if (!proxies.length) return [];
  const out: ProxyHit[] = [];
  for (const fn of proxies) { const hits = fn(it); if (hits) out.push(...hits); }
  return out;
}

export function subscribeSystemsRegistry(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
/** Changes whenever a scene system or proxy source is (un)registered. */
export const systemsRegistryEpoch = () => epoch;
