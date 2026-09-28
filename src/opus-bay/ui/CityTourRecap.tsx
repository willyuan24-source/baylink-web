import { tourIdOf, useGame } from '../core/store';
import type { Bilingual } from '../core/types';
import { activePostcardCount, activePostcardTotal } from '../data/postcards';
import { SF_GRAND, cityTour } from '../data/sf/tours';
import { arrivalSeen } from '../game/cityContent';
import { lastCityTour, playedStop, savedProgress } from '../game/cityTour';
import { closePanel, openPanel } from '../game/flow';
import { interactableById } from '../game/interactables';
import { TourRecap } from './TourRecap';

/**
 * Wave 4 · lane C · W4-C4: the Grand Tour's recap in the game (ui/Moments Recap mounts it lazily when `game.tour` holds
 * a city tour). Reads the store and hands ui/TourRecap its props: the stops done (game.tour.completed), the version
 * played (the run that just ended, else the save), postcards, and the arrival stamps of the tour's attractions.
 */
export default function CityTourRecap() {
  const tourState = useGame(s => s.tour);
  const postcards = useGame(s => activePostcardCount(s.postcards));
  const def = cityTour(tourIdOf(tourState)) ?? SF_GRAND;
  const last = lastCityTour();
  const express = last && last.def.id === def.id ? last.express : !!savedProgress(def.id)?.express;
  const attractions = [...new Set(def.chapters.flatMap(c => c.stops.flatMap(s => (s.attraction && !s.optional && !(express && s.express === 'skip') ? [s.attraction] : []))))];
  const stopName = (id: string): Bilingual | null => {
    const stop = def.chapters.flatMap(c => c.stops).find(s => s.id === id);
    return stop ? interactableById(playedStop(def, stop, express).target)?.name ?? null : null;
  };
  return (
    <TourRecap
      tour={def}
      completed={tourState.completed}
      postcards={{ found: postcards, total: activePostcardTotal() }}
      stamps={{ found: attractions.filter(a => arrivalSeen(a)).length, total: attractions.length }}
      express={express}
      stopName={stopName}
      onClose={closePanel}
      onOpenMap={() => openPanel('map')}
    />
  );
}
