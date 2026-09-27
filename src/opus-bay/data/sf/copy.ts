import type { Bilingual } from '../../core/types';

/**
 * City-mode onboarding copy (lane G2 owns this file from wave 2; plan G2-8). DEPENDENCY-FREE (type imports only): the
 * title screen (OpusBayPage chunk, painted before three.js loads) imports it.
 *
 *   titleSub   the title card's subtitle in city mode; null = keep the district subtitle (day 0)
 */
export interface CityCopy {
  titleSub: Bilingual | null;
}

export const CITY_COPY: CityCopy = {
  titleSub: null,
};
