import type { Bilingual } from '../core/types';
import { eggPostcard, type EggPostcard } from '../data/sf/eggPostcards';
import { SOUND_COINS, soundById } from './citySounds';
import { GOLDEN_CARD, PEBBLE_CARD, PEBBLE_COINS } from './pebbleSpots';
import { EGG_COINS, eggById, type EggSource } from './registry';

/**
 * Wave 5 · lane D · what a find card shows, for each kind of find lane D pays: an egg (小发现 · +10 金币), and (W5-D6)
 * a city sound (城市之声 · +5) or one of BAYBAY's pebbles (BAYBAY 的小石子 · +3). Pure data (the card chunk and the tests
 * read it): the kicker, the name, the fact and its sources, and an egg's secret postcard (lane V's W5-V8, shown once the
 * card is opened — the card only ever opens after the find).
 */

export type CardKind = 'egg' | 'sound' | 'pebble';

export interface CardEntry {
  kind: CardKind;
  kicker: Bilingual;
  name: Bilingual;
  fact: Bilingual;
  sources: readonly EggSource[];
  coins: number;
  /** the egg's secret postcard (lane V, data/sf/eggPostcards.ts), or null */
  postcard: EggPostcard | null;
}

type Lookup = (id: string) => Omit<CardEntry, 'kind'> | null;
const lookups: Partial<Record<CardKind, Lookup>> = {
  egg: id => {
    const e = eggById(id);
    return e ? { kicker: { zh: '小发现', en: 'A find' }, name: e.name, fact: e.fact, sources: e.sources, coins: EGG_COINS, postcard: eggPostcard(id) } : null;
  },
  sound: id => {
    const s = soundById(id);
    return s ? { kicker: { zh: '城市之声', en: 'City sounds' }, name: s.name, fact: s.fact, sources: s.sources, coins: SOUND_COINS, postcard: null } : null;
  },
  // the first pebble's card (what the aquarium says about otters and rocks) and the golden pebble's
  pebble: id => {
    const kicker = { zh: 'BAYBAY 的小石子', en: 'BAYBAY’s pebbles' };
    if (id === 'first') return { kicker, name: PEBBLE_CARD.name, fact: PEBBLE_CARD.fact, sources: PEBBLE_CARD.sources, coins: PEBBLE_COINS, postcard: null };
    if (id === 'golden') return { kicker, name: GOLDEN_CARD.name, fact: GOLDEN_CARD.fact, sources: [], coins: PEBBLE_COINS, postcard: null };
    return null;
  },
};

/** What the card of `kind` / `id` shows, or null for an unknown id. */
export function cardEntry(kind: CardKind, id: string): CardEntry | null {
  const e = lookups[kind]?.(id);
  return e ? { kind, ...e } : null;
}
