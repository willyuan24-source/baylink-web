/**
 * The hubs' 1200 × 630 share cards (I18N-SEO-03), written by scripts/generate-share-cards.ts in three languages;
 * seo.ts points each language at its own (/share-cards/en/…, /share-cards/zh-Hant/…). Dependency-free: hub metadata
 * modules on every route import it.
 */
export type HubCard = 'home' | 'events' | 'guides' | 'explore' | 'plan' | 'tools' | 'brand';
export const hubCardPath = (name: HubCard) => `/share-cards/hub-${name}.png`;
export const HUB_CARDS: Readonly<Record<HubCard, string>> = {
  home: hubCardPath('home'), events: hubCardPath('events'), guides: hubCardPath('guides'), explore: hubCardPath('explore'),
  plan: hubCardPath('plan'), tools: hubCardPath('tools'), brand: hubCardPath('brand'),
};
