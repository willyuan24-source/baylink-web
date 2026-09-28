// Wave-4 tier-3 sites preview (lane L3, dev server only): /scripts/opus-sf/sites3-preview.html?world=city&… is
// /opus-bay with the tier-3 sites that are NOT registered yet (w4list3.ts W4_SITES_T3_NEXT: built after the
// integration's W4-IL1, waiting for their tops rows) appended to the site registry (SF_SITES, read by world/sf/sites.ts
// when the city boots), so they stream, draw their draped ground, exclude city buildings and collide as registered sites
// do (their blockers have no measured tops until landmark-tops.ts is re-run: the glide treats them as walls).
// The registered ones (lane L's w4list.ts, W4_SITES_T3) are drawn by the game itself. `?sites=a,b` limits the waiting
// ones appended. Nothing imports this file; `vite build` never sees it.
import { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { SF_SITES, type SfLandmark } from '../../src/opus-bay/world/sf/landmarks/index';
import { W4_SITES_T3_ALL, W4_SITES_T3_NEXT } from '../../src/opus-bay/world/sf/landmarks/w4list3';

const only = new URLSearchParams(location.search).get('sites');
for (const s of W4_SITES_T3_NEXT) if (!SF_SITES.includes(s) && (!only || only.split(',').includes(s.id))) (SF_SITES as SfLandmark[]).push(s);
(window as unknown as { __w4sites3?: string[] }).__w4sites3 = W4_SITES_T3_ALL.map(s => s.id);

const OpusBayPage = lazy(() => import('../../src/opus-bay/OpusBayPage'));
createRoot(document.getElementById('root')!).render(<Suspense fallback={null}><OpusBayPage /></Suspense>);
