import type { TourDef } from '../core/types';

/**
 * 湾区第一课 / Bay 101 — seven stops in walking order: Ferry Building → market → Pier 7 → Exploratorium →
 * (through Levi's Plaza) Filbert Steps → Coit Tower viewpoint → (past Pier 33) PIER 39 sea lions.
 * Levi's Plaza and Pier 33 are mentioned on the way (exploratorium / coit-tower done lines) rather than being stops.
 * Every node referenced here lives in data/script.ts and ends with { type: 'end' } (the tour system continues).
 */
export const FIRST_TOUR: TourDef = {
  id: 'first-lesson',
  name: { zh: '湾区第一课', en: 'Bay 101' },
  introNode: 'tour.intro',
  outroNode: 'tour.outro',
  stops: [
    { poiId: 'ferry-building', arriveNode: 'tour.ferry-building.arrive', doneNode: 'tour.ferry-building.done' },
    { poiId: 'farmers-market', arriveNode: 'tour.farmers-market.arrive', doneNode: 'tour.farmers-market.done' },
    { poiId: 'pier7', arriveNode: 'tour.pier7.arrive', doneNode: 'tour.pier7.done' },
    { poiId: 'exploratorium', arriveNode: 'tour.exploratorium.arrive', doneNode: 'tour.exploratorium.done' },
    { poiId: 'filbert-steps', arriveNode: 'tour.filbert-steps.arrive', doneNode: 'tour.filbert-steps.done' },
    { poiId: 'coit-tower', arriveNode: 'tour.coit-tower.arrive', doneNode: 'tour.coit-tower.done' },
    { poiId: 'sea-lions', arriveNode: 'tour.sea-lions.arrive', doneNode: 'tour.sea-lions.done' },
  ],
};

/** POIs the tour passes without stopping; the guide may bark them on the way (PoiDef.bark). */
export const FIRST_TOUR_PASSES = ['levis-plaza', 'pier33'] as const;
