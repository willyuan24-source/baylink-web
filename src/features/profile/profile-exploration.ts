import type { Library } from '../../lib/planner';
import type { UserData } from '../../lib/types';

export type ExplorationStep = { id: 'introduce' | 'preferences' | 'save' | 'plan'; complete: boolean | null };

/** A private setup guide derived from saved data, never a reputation or attendance score. */
export function profileExplorationSteps(user: UserData, library: Library | null): ExplorationStep[] {
  return [
    { id: 'introduce', complete: !!(user.bio?.trim() || user.statusText?.trim() || user.interests?.length || user.socialIntents?.length) },
    { id: 'preferences', complete: library ? !!(library.preferences.regions.length || library.preferences.interests.length || library.preferences.travelMode !== 'any') : null },
    { id: 'save', complete: library ? library.favorites.length > 0 : null },
    { id: 'plan', complete: library ? library.plans.length > 0 : null },
  ];
}
