import { glideUnlocked } from '../actors/moveApi';
import { game } from '../core/store';
import { bitSet, type PlaySaveV1 } from '../data/playSave';
import { readSave } from '../data/save';
import { SOUND_IDS } from '../eggs/citySounds';
import { EGG_IDS } from '../eggs/registry';
import { isDiscovered } from '../game/discovery';
import { VIEW_SPOTS, VIEW_SPOT_IDS } from '../play/viewSpots';
import { PAGE_ITEM, type PageId } from './items';
import { commitPlay, isPaid, pay, playState, registerRewardIds, subscribeLedger } from './ledger';
import { sayWhenFree, type ELineKey } from './lines';
import { grant } from './wallet';
import { newStamps, PAGE_COINS, PAGE_IDS, pageStates, type PageState, type StampWorld } from './stamps';

/**
 * Wave 5 · lane E · W5-E5: the notebook, live. Started by economy/extras.ts (a chunk after the ledger's):
 *
 * - registers the `page` ids (PAGE_IDS) and lane A's `view` ids (play/viewSpots VIEW_SPOT_IDS, A's append-only list:
 *   the same list A registers, so either registration keeps the bits in place) with the ledger;
 * - every 2 s and after each ledger change: the 印章 page's stamps done in the world are written into the save's
 *   `stamp` bitset (once; never under `?discover=all`, whose finds are for that page only); a full page pays
 *   `page:<id>` (30 金币, once per save) and gives its cosmetic (items.ts PAGE_ITEM), and BAYBAY says so;
 * - keeps the summary the Journal tab's count and the Notebook read (subscribeNotebook).
 */

const discoverAll = () => typeof window !== 'undefined' && /[?&]discover=all(?:&|$)/.test(window.location?.search ?? '');

/** The live world the stamps are read from. */
export function stampWorld(): StampWorld {
  const s = readSave();
  const arrivals = new Set((s?.arrivals ?? []).map(k => k.split('@')[0]));
  return {
    arrived: id => arrivals.has(id) || isPaid(`arrive:${id}`),
    discovered: id => isDiscovered(id),
    pelican: glideUnlocked() || !!s?.unlocked?.glide,
    goals: new Set(game.get().goalsDone),
    rides: s?.rides ?? {},
    paid: isPaid,
  };
}

export const liveViewIds = (): string[] => VIEW_SPOTS.filter(v => !v.retired).map(v => v.id);

const PAGE_LINE: Record<PageId, ELineKey> = { stamps: 'pageStamps', finds: 'pageFinds', views: 'pageViews', sounds: 'pageSounds' };

let states: Record<PageId, PageState> | null = null;
let version = 0;
const listeners = new Set<() => void>();
export const notebookVersion = (): number => version;
export function subscribeNotebook(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
/** The pages' progress at the last check (null before the first). */
export const notebookPages = (): Record<PageId, PageState> | null => states;

/**
 * One check: persist new stamps, pay full pages. Returns the pages paid now. Exported for the tests (with a fake world).
 */
export function checkNotebook(world: StampWorld = stampWorld(), persist = !discoverAll()): PageId[] {
  if (persist) {
    const add = newStamps(playState(), world);
    if (add.length) commitPlay(p => ({ ...p, g: { ...p.g, stamp: add.reduce((b, i) => bitSet(b, i), p.g.stamp) } }) as PlaySaveV1);
  }
  const next = pageStates(playState(), persist ? world : null, EGG_IDS, liveViewIds(), isPaid, SOUND_IDS);
  const paid: PageId[] = [];
  for (const id of PAGE_IDS) {
    if (!next[id].full || isPaid(`page:${id}`)) continue;
    if (!persist) continue;
    pay(`page:${id}`, PAGE_COINS);
    grant(PAGE_ITEM[id]);
    if (isPaid(`page:${id}`)) paid.push(id);
  }
  const changed = !states || PAGE_IDS.some(id => states![id].got !== next[id].got || states![id].total !== next[id].total);
  states = next;
  if (changed) { version++; for (const fn of [...listeners]) fn(); }
  return paid;
}

/** Stamps + finds + views + city sounds collected (the Journal tab's count). */
export function notebookCount(): string | undefined {
  if (!states) return undefined;
  const n = states.stamps.got + states.finds.got + states.views.got + states.sounds.got;
  return n ? String(n) : undefined;
}

export function initNotebook(): () => void {
  // lane A's and lane D's own lists (the same append-only lists their inits register: either keeps the bits in place)
  const offs = [registerRewardIds('page', PAGE_IDS), registerRewardIds('view', VIEW_SPOT_IDS), registerRewardIds('sound', SOUND_IDS)];
  let busy = false;
  const run = () => {
    if (busy) return;
    busy = true;
    try {
      for (const id of checkNotebook()) sayWhenFree(PAGE_LINE[id]);
    } catch (error) { if (import.meta.env?.DEV) console.warn('[opus-bay notebook]', error); } finally { busy = false; }
  };
  offs.push(subscribeLedger(() => { queueMicrotask(run); }));
  const timer = setInterval(run, 2000);
  run();
  return () => { clearInterval(timer); for (const off of offs.splice(0).reverse()) off(); states = null; };
}

