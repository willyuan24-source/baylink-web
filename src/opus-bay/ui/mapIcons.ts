import {
  Binoculars, Bird, Bike, Bus, CableCar, Car, Castle, Church, Footprints, GraduationCap, Landmark, type LucideIcon, Mountain, Palette, PawPrint,
  PersonStanding, Sailboat, ShoppingBag, Signpost, Theater, TrainFront, TramFront, Trees, Trophy, Waves,
} from 'lucide-react';
import type { AttractionGlyph } from '../data/sf/attractionTypes';
import type { TripMode } from '../game/tripTypes';
import type { LineGlyph } from './mapLines';

/**
 * Wave 4 · the lucide-react icons behind the map's glyph names (lane P): attraction badges (the frozen
 * ATTRACTION_GLYPHS), line rows / pills (mapLines LineGlyph) and trip modes (TripOptions rows). One import site, so the
 * city chunk carries exactly these 25 icons.
 */
export const ATTRACTION_ICONS: Readonly<Record<AttractionGlyph, LucideIcon>> = {
  Landmark, Palette, Trees, PawPrint, Mountain, Binoculars, Waves, Sailboat, GraduationCap, ShoppingBag, Trophy, Church, Theater, Castle, Signpost,
};

export const LINE_ICONS: Readonly<Record<LineGlyph, LucideIcon>> = { Bus, TrainFront, CableCar, TramFront };

/** Trip modes (the line mode's icon comes from its first line leg: bus / Metro / cable car / streetcar). */
export const MODE_ICONS: Readonly<Record<TripMode, LucideIcon>> = { walk: Footprints, run: PersonStanding, bike: Bike, car: Car, line: Bus, fly: Bird };
