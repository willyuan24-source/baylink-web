import { createContext, useContext } from 'react';
import type { Favorite } from '../../lib/planner';

/** ♡ 想去 for BayBay answer cards; `null` outside a BayBaySaveScope or before the library has loaded. */
export type BayBaySaves = { ready: boolean; busy: boolean; error: string; saved: (favorite: Favorite) => boolean; toggle: (favorite: Favorite) => void };
export const BayBaySaveContext = createContext<BayBaySaves | null>(null);
export const useBayBaySaves = () => useContext(BayBaySaveContext);
