import type { SeptemberOpening } from '../data/september-openings';

/**
 * A new shop becomes a planner place ("opening-<id>", src/data/planner-local-stops.ts) once it serves customers: open or
 * soft-open; an announcement never does. Kept apart from the planner catalog so a detail page can ask without importing
 * the catalog (and the guides corpus behind it).
 */
export const isPlannableOpening = (shop: Pick<SeptemberOpening, 'status'>) => shop.status === 'open' || shop.status === 'soft_open';
export const openingPlaceId = (shopId: string) => `opening-${shopId}`;
