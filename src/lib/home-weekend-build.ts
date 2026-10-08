import type { MonthlyEvent } from '../data/monthly-types';
import { getHomeWeekend } from './home-weekend';
import { getListingImage } from './offer-media';

// Build-time weekend selection for the home snapshot, the /weekly cards and
// their verifier, so the three cannot drift. Scripts and tests only: the photo
// check reads the full image catalog, which must stay out of the client bundle.
export const getBuildWeekend = (today: string, catalog: MonthlyEvent[]) => getHomeWeekend(today, catalog, { hasPhoto: imageKey => !!getListingImage(imageKey) });
