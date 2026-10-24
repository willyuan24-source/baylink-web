import type { BenefitSteps } from './BenefitSteps';
import type { OfferFacts, OpeningFacts } from './ShopFacts';

/**
 * The offer and opening pages' parts (ShopFacts.tsx), kept out of the detail route's chunk so an event page never loads
 * them. Importing ShopFacts.tsx registers them here; load-detail.ts imports it with an offer's or an opening's bucket and
 * the page suspends until both are in, so LocalDiscoveryDetail reads them synchronously (shopParts()) whenever it renders
 * an offer or an opening. scripts/prerender.tsx and the tests that render one directly import ShopFacts.tsx first.
 */
export type ShopParts = { OfferFacts: typeof OfferFacts; OpeningFacts: typeof OpeningFacts; BenefitSteps: typeof BenefitSteps };
let parts: ShopParts | undefined;

export const shopParts = (): ShopParts | undefined => parts;
export function provideShopParts(value: ShopParts): void { parts = value; }
