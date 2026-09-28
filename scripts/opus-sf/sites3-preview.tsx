// Wave-4 tier-3 sites preview (lane L3, early phase, dev server only): /scripts/opus-sf/sites3-preview.html?world=city&…
// is /opus-bay with the NOT YET REGISTERED wave-4 sites — lane L's (w4list.ts) and the tier-3 ones (w4list3.ts) —
// appended to the landmark registry before the city boots, as lane L's sites-preview.html does, so they stream, draw
// their draped ground, exclude city buildings and collide exactly as registered landmarks will. `?sites=a,b` limits the
// tier-3 sites appended (lane L's are always appended: the tier-3 ones sit next to them). Nothing imports this file.
import { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { SF_LANDMARKS, SF_SITES } from '../../src/opus-bay/world/sf/landmarks/index';
import { W4_SITES } from '../../src/opus-bay/world/sf/landmarks/w4list';
import { W4_SITES_T3 } from '../../src/opus-bay/world/sf/landmarks/w4list3';

const only = new URLSearchParams(location.search).get('sites');
// since the wave-4 integration (W4-IL1) the registry draws every site (SF_SITES): nothing is appended any more
for (const s of W4_SITES) if (!SF_SITES.includes(s)) SF_LANDMARKS.push(s);
for (const s of W4_SITES_T3) if (!SF_SITES.includes(s) && (!only || only.split(',').includes(s.id))) SF_LANDMARKS.push(s);
(window as unknown as { __w4sites3?: string[] }).__w4sites3 = W4_SITES_T3.map(s => s.id);

const OpusBayPage = lazy(() => import('../../src/opus-bay/OpusBayPage'));
createRoot(document.getElementById('root')!).render(<Suspense fallback={null}><OpusBayPage /></Suspense>);
