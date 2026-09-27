import type { Bilingual } from '../../core/types';

/**
 * City-mode onboarding copy (lane G2 owns this file from wave 2; plan G2-8). DEPENDENCY-FREE (type imports only): the
 * title screen (OpusBayPage chunk, painted before three.js loads) imports it.
 *
 *   titleSub   the title card's subtitle in city mode (null would keep the district subtitle). zh glossary as in the
 *              game: 双峰 (not 双子峰), 叮当车 for the cable cars, 唐人街, 要塞公园 (Presidio).
 */
export interface CityCopy {
  titleSub: Bilingual | null;
}

export const CITY_COPY: CityCopy = {
  titleSub: {
    zh: '跟 BAYBAY 逛整座旧金山：金门大桥、叮当车、双峰，真实景点和这周活动，边玩边查。',
    en: 'Roam all of San Francisco with BAYBAY — the Golden Gate, cable cars, Twin Peaks: real places and this week’s events, all playable.',
  },
};
