import type { Locale } from '../i18n/locale';

/** Published, named city entrances only. Keep the 3D scene out of the site's route graph. */
export const OPUS_BAY_ATTRACTION_ENTRIES: Readonly<Record<string, { target: string; zh: string; en: string }>> = {
  'golden-gate': { target: 'lm-golden-gate-bridge', zh: '3D 看金门大桥', en: 'See the Golden Gate in 3D' },
  pier39: { target: 'pier-39', zh: '3D 逛 39 号码头', en: 'Explore Pier 39 in 3D' },
  // The existing island travel contract begins at its ferry terminal, rather than teleporting onto the island.
  alcatraz: { target: 'alcatraz-landing', zh: '3D 到 33 号码头', en: 'Visit Pier 33 in 3D' },
  chinatown: { target: 'lm-dragon-gate', zh: '3D 走进唐人街', en: 'Enter Chinatown in 3D' },
  palace: { target: 'lm-palace-of-fine-arts', zh: '3D 看艺术宫', en: 'See the Palace in 3D' },
  'golden-gate-park': { target: 'lm-conservatory-of-flowers', zh: '3D 从花卉温室出发', en: 'Start at the Conservatory in 3D' },
  presidio: { target: 'osm-w91114607', zh: '3D 逛 Tunnel Tops', en: 'Explore Tunnel Tops in 3D' },
};

export function opusBayAttractionEntry(id: string, locale: Locale): { href: string; label: string } | undefined {
  if (!Object.hasOwn(OPUS_BAY_ATTRACTION_ENTRIES, id)) return undefined;
  const entry = OPUS_BAY_ATTRACTION_ENTRIES[id];
  const query = new URLSearchParams({ world: 'city', start: 'free', at: entry.target, from: 'guide' });
  if (locale !== 'zh-Hans') query.set('lang', locale);
  return { href: `/opus-bay?${query}`, label: locale === 'en' ? entry.en : entry.zh };
}
