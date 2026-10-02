import {
  Bell, Binoculars, Bird, CableCar, ChevronsDown, Croissant, Disc, Flame, Footprints, Grab, Guitar, Megaphone, Mountain, PawPrint, RotateCw, Search,
  Shell, Snowflake, Sparkles, Spline, Volleyball, Wind, type LucideIcon,
} from 'lucide-react';
import type { DexIcon } from './playDexData';

/**
 * Wave 9 · lane G · the mini-games' icons (ui/playDexData.ts DexIcon → lucide): the journal's 游乐 tab and the map's 玩
 * pins. Its own module (not ui/mapIcons.ts, which the trip rows carry), so only those two lazy chunks carry these 22 icons.
 */
export const GAME_ICONS: Readonly<Record<DexIcon, LucideIcon>> = {
  grab: Grab, sparkles: Sparkles, croissant: Croissant, paw: PawPrint, shell: Shell, megaphone: Megaphone, bell: Bell, cable: CableCar,
  rotate: RotateCw, wind: Wind, disc: Disc, ball: Volleyball, flame: Flame, sled: Snowflake, slide: ChevronsDown, steps: Footprints,
  guitar: Guitar, spline: Spline, mountain: Mountain, bird: Bird, search: Search, binoculars: Binoculars,
};
