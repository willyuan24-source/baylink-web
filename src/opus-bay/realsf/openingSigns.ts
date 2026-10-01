import { createElement, Suspense } from 'react';
import { lazyChunk } from '../game/lazyChunk';
import * as THREE from 'three';
import { runtime } from '../core/runtime';
import { canStand, heightAt } from '../core/terrain';
import { registerFlagSource, type ExtraFlag } from '../game/flags';
import { registerInteractables, type Interactable } from '../game/interactables';
import { registerFrameSystem } from '../game/systemsRegistry';
import { openOverlay, registerOverlay, type OverlayProps } from '../ui/slots';
import { freezeStatic } from '../world/builder';
import { cityStreamerLazy } from '../world/cityLoader';
import { meshWarmup, registerWarmup } from '../world/warmup';
import { getWorld, type WorldSystem } from '../world/world';
import { buildOpeningSignGeometry, makeKitMaterial } from './eventKit';
import { FLAG_FAR, OPENING_GOLD, OPENING_SIGNS, OVERLAY_ID, PROMPT_R, SIGN_NEAR, signFront, type OpeningSign } from './openings';
import { importRetry } from '../game/importRetry';

/**
 * Wave 6 · lane S (W6-S3) · the new openings' signs in the city (data: realsf/openings.ts). Only the nearest sign within
 * SIGN_NEAR stands (one merged mesh, ≤ 400 triangles, the event kits' material program `ob-toy-dyn`: no new program);
 * its gold pennant (lane N's flag layer) flies within FLAG_FAR; E at the sign (看看新店) opens the 新店 card.
 */

/** the card (and its CSS) loads on the first E at a sign, not with the realsf chunk */
const LazyCard = lazyChunk(() => importRetry(() => import('./OpeningCard')));
const OpeningCardSlot = (p: OverlayProps) => createElement(Suspense, { fallback: null }, createElement(LazyCard, p));

export interface Openings {
  stats(): { built: string | null; tris: number };
  off(): void;
}

export function initOpenings(): Openings {
  const material = makeKitMaterial();
  material.name = 'ob-realsf-opening';
  const offWarm = registerWarmup('r-opening-sign', () => meshWarmup(material, { receiveShadow: true }));
  const offOverlay = registerOverlay({ id: OVERLAY_ID, Component: OpeningCardSlot });
  const group = new THREE.Group();
  group.name = 'realsf-openings';
  let offSystem: (() => void) | null = null;
  let built: { id: string; mesh: THREE.Mesh; tris: number } | null = null;

  const drop = () => {
    if (!built) return;
    group.remove(built.mesh);
    built.mesh.geometry.dispose();
    built = null;
  };

  const offInteract = registerInteractables('w6-realsf-openings', () => OPENING_SIGNS.map((s): Interactable => {
    const f = signFront(s);
    return {
      id: `realsf-opening:${s.id}`, source: 'event', action: 'info', verb: { zh: '看看新店', en: 'See the new place' },
      name: { zh: s.name, en: s.name }, x: f.x, z: f.z, radius: PROMPT_R,
      act: () => openOverlay(OVERLAY_ID, { id: s.id }),
    };
  }));

  const offFlags = registerFlagSource('realsf-new', ctx => OPENING_SIGNS
    .filter(s => Math.hypot(ctx.player.x - s.x, ctx.player.z - s.z) < FLAG_FAR)
    .map((s): ExtraFlag => ({ key: s.id, x: s.x, z: s.z, color: OPENING_GOLD, glyph: 'ShoppingBag', h: 12, priority: 1, far: FLAG_FAR })));

  const tick = () => {
    if (!offSystem && cityStreamerLazy()) offSystem = getWorld().addSystem({ name: 'realsf-openings', group } satisfies WorldSystem);
    const p = runtime.player;
    let best: OpeningSign | null = null, bd = SIGN_NEAR;
    for (const s of OPENING_SIGNS) { const d = Math.hypot(p.x - s.x, p.z - s.z); if (d < bd) { bd = d; best = s; } }
    if (built && built.id !== best?.id) drop();
    if (!built && best && offSystem && canStand(best.x, best.z)) {
      const geo = buildOpeningSignGeometry({ x: best.x, z: best.z, yaw: best.yaw }, heightAt);
      const mesh = freezeStatic(new THREE.Mesh(geo, material));
      mesh.name = `realsf-opening:${best.id}`;
      mesh.receiveShadow = true;
      group.add(mesh);
      built = { id: best.id, mesh, tris: (geo.index?.count ?? 0) / 3 };
    }
  };

  let acc = 1;
  const offFrame = registerFrameSystem('w6-realsf-openings', dt => {
    if ((acc += dt) < 0.5) return;
    acc = 0;
    tick();
  }, 5);

  return {
    stats: () => ({ built: built?.id ?? null, tris: built?.tris ?? 0 }),
    off: () => {
      offFrame(); offFlags(); offInteract(); offOverlay();
      drop();
      offSystem?.();
      offSystem = null;
      offWarm();
      material.dispose();
    },
  };
}
