// Wave-4 sites preview (lane L, early phase, dev server only): /scripts/opus-sf/sites-preview.html?world=city&… is
// /opus-bay with the NOT YET REGISTERED wave-4 sites (world/sf/landmarks/w4sites.ts) appended to the landmark registry
// before the city boots, so they stream, draw, exclude city buildings and collide exactly as registered landmarks do.
// Their draped ground (`ys`, which sites.ts learns at integration) is drawn here through a SiteHooks.mount instead.
// Nothing imports this file; `vite build` never sees it. Same URL flags as /opus-bay (?at=xz:x,z, ?time=, ?quality=).
import { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { C } from '../../src/opus-bay/world/builder';
import { GROUND, GROUND_CITY } from '../../src/opus-bay/world/materials';
import { TypedBatch } from '../../src/opus-bay/world/typedBatch';
import { SF_LANDMARKS, type SfLandmark } from '../../src/opus-bay/world/sf/landmarks/index';
import type { W4Site } from '../../src/opus-bay/world/sf/landmarks/siteKit';
import { W4_SITES } from '../../src/opus-bay/world/sf/landmarks/w4sites';

/** buildGroundMesh with per-vertex heights (what sites.ts does after the integration) */
function drapedGround(s: W4Site): THREE.Mesh | null {
  if (!s.ground?.length) return null;
  const b = new TypedBatch(256);
  for (const q of s.ground) {
    const ys = q.ys;
    const yAt = ys ? (x: number, z: number) => { const i = q.poly.findIndex(p => p.x === x && p.z === z); return i >= 0 ? ys[i] : q.y; } : q.y;
    b.polygon(q.poly, yAt, C(q.color), [q.pattern, s.yaw, 0, GROUND_CITY]);
  }
  const m = new THREE.Mesh(TypedBatch.toGeometry(b.toArrays()), GROUND);
  m.name = `sf:${s.id}:ground`;
  m.receiveShadow = true;
  m.matrixAutoUpdate = false;
  return m;
}

const only = new URLSearchParams(location.search).get('sites');
for (const s of W4_SITES) {
  if (only && !only.split(',').includes(s.id)) continue;
  const rec: SfLandmark & W4Site = {
    ...s,
    ground: undefined,
    mount(group: THREE.Group) {
      const m = drapedGround(s);
      if (!m) return;
      group.add(m);
      m.updateMatrixWorld(true);
      return () => { group.remove(m); m.geometry.dispose(); };
    },
  };
  SF_LANDMARKS.push(rec);
}
(window as unknown as { __w4sites?: string[] }).__w4sites = W4_SITES.map(s => s.id);

const OpusBayPage = lazy(() => import('../../src/opus-bay/OpusBayPage'));
createRoot(document.getElementById('root')!).render(<Suspense fallback={null}><OpusBayPage /></Suspense>);
