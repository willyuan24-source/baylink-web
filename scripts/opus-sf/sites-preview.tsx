// Wave-4 sites preview (lane L, early phase, dev server only): /scripts/opus-sf/sites-preview.html?world=city&… is
// /opus-bay with the NOT YET REGISTERED wave-4 sites (world/sf/landmarks/w4list.ts) appended to the landmark registry
// before the city boots, so they stream, draw, exclude city buildings and collide exactly as registered landmarks do:
// sites.ts draws their draped ground (`ys`, D2-09 buildGroundMesh) and reads their `sink: 0` (landmarkSink).
// Nothing imports this file; `vite build` never sees it. Same URL flags as /opus-bay (?at=xz:x,z, ?time=, ?quality=).
import { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { SF_LANDMARKS, SF_SITES } from '../../src/opus-bay/world/sf/landmarks/index';
import { W4_SITES } from '../../src/opus-bay/world/sf/landmarks/w4list';

const only = new URLSearchParams(location.search).get('sites');
// since the wave-4 integration (W4-IL1) the registry draws every site (SF_SITES): nothing is appended any more
for (const s of W4_SITES) if (!SF_SITES.includes(s) && (!only || only.split(',').includes(s.id))) SF_LANDMARKS.push(s);
(window as unknown as { __w4sites?: string[] }).__w4sites = W4_SITES.map(s => s.id);

const OpusBayPage = lazy(() => import('../../src/opus-bay/OpusBayPage'));
createRoot(document.getElementById('root')!).render(<Suspense fallback={null}><OpusBayPage /></Suspense>);
