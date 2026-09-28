import type { Bilingual } from '../../core/types';

/**
 * City-mode onboarding copy (lane G2 owns this file from wave 2; plan G2-8; lane C from wave 4). DEPENDENCY-FREE (type
 * imports only): the title screen (OpusBayPage chunk, painted before three.js loads) and game/flow.ts (the call menu)
 * import it.
 *
 *   titleSub   the title card's subtitle in city mode (null would keep the district subtitle). zh glossary as in the
 *              game: 双峰 (not 双子峰), 叮当车 for the cable cars, 唐人街, 要塞公园 (Presidio).
 *   greet      BAYBAY's first-visit line on the title card in city mode (G1 wave 3 a4: ui/TitleScreen shows it when
 *              present; a returning player still gets "欢迎回来").
 */
export interface CityCopy {
  titleSub: Bilingual | null;
  greet?: Bilingual;
}

export const CITY_COPY: CityCopy = {
  titleSub: {
    zh: '跟 BAYBAY 逛整座旧金山：金门大桥、叮当车、双峰，真实景点和这周活动，边玩边查。',
    en: 'Roam all of San Francisco with BAYBAY — the Golden Gate, cable cars, Twin Peaks: real places and this week’s events, all playable.',
  },
  greet: { zh: '嗨～这次我们逛整座旧金山！', en: 'Hi! This time we explore all of San Francisco!' },
};

/**
 * Wave 4 · lane C · W4-C7: the Grand Tour's words where the main graph needs them (the welcome choice's second line,
 * the call menu). The tour itself (data/sf/tours.ts SF_GRAND, ≈ 23 KB with its lines) loads lazily, so these copy its
 * numbers; tests/opus-bay-sf-tours.test.ts checks they equal `SF_GRAND.subtitle`, the timing model's minutes and
 * `tourResumeLabel` (one time rule: game/tripText.ts minutesLabel).
 */
export const GRAND_TOUR = {
  id: 'sf-grand',
  name: { zh: '环游旧金山 · 一日游', en: 'San Francisco Grand Tour' } as Bilingual,
  /** the welcome choice's second line (= SF_GRAND.subtitle) */
  subtitle: { zh: '全城 5 章 · 约 26 分钟 · 随时下车', en: 'The whole city in 5 chapters · about 26 min · hop off anytime' } as Bilingual,
  /** the call menu row before the tour was started (or after it was finished) */
  call: { zh: '带我环游旧金山（约 26 分钟）', en: 'Take me round San Francisco (about 26 min)' } as Bilingual,
  /** the call menu row with a tour left half way (= tourResumeLabel) */
  resume: (chapter: number): Bilingual => ({ zh: `继续一日游 · 第 ${chapter} 章`, en: `Resume the San Francisco Grand Tour · chapter ${chapter}` }),
} as const;
