import { readWorldMode, type WorldMode } from '../core/store';

/**
 * Which world's content is active (lane G2, plan G2-0; fixes CS-9 "district barks and goals everywhere in the city").
 *
 * The world mode is fixed for the page (`?world=city|district`, read once like core/store's initial `worldMode`), so
 * content modules resolve their exports at import time: every content table keeps an explicit `DISTRICT_*` export
 * (the v1 values, untouched) and, where the city differs, a `CITY_*` one; the plain name that the game and UI import
 * (`POIS`, `POSTCARDS`, `FREE_GOALS`, `GUIDE_BARKS`, `START_NODE`, `SCRIPT_HOOKS`) is `byMode(DISTRICT_*, CITY_*)`.
 * City entries never merge into district mode. Node tests run without `location`, so they always see district mode;
 * they test the city side through the `CITY_*` exports or `contentFor('city')`.
 */
export const CONTENT_MODE: WorldMode = readWorldMode();

/** The district or the city value for `mode` (default: the page's world mode). */
export function byMode<T>(district: T, city: T, mode: WorldMode = CONTENT_MODE): T {
  return mode === 'city' ? city : district;
}

export const isCityContent = (mode: WorldMode = CONTENT_MODE) => mode === 'city';
