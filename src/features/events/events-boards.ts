import { useEffect, useState, useSyncExternalStore } from 'react';
import { chunkLoader } from '../../lib/chunk-recovery';
import { isLocaleReadyForFeature, loadLocaleForFeature, useLocale, type Locale } from '../../i18n/locale';
import { installBoards, isBoardsInstalled, subscribeBoards } from './events-model';
import type { EventsBoards } from './events-index-types';

/**
 * UI9-IMG-A1b (captain 21:15 step 2): the 免费与优惠 and 新店 boards' offers, new shops and their pictures are not in the
 * events route (events-index.json carries events only), so /events and /calendar no longer pay for them. The boards' views
 * load them with their own chunk (EventsFrame.tsx), with their English pack on /en; a URL that opens on a board waits for
 * them at boot (events-later.ts loadForLocation). Node has them installed already (events-model.ts).
 */
const loadChunk = chunkLoader(() => import('../../data/generated/events-boards.json'), module => module.default as unknown as EventsBoards);
const englishReady = () => isLocaleReadyForFeature('en', 'events-boards');

/** Whether the boards can render in this language. */
export const isBoardsReady = (locale: Locale): boolean => isBoardsInstalled() && (locale !== 'en' || englishReady());

const pending = new Map<Locale, Promise<void>>();
/** Load what is missing of events-boards.json and, in English, its text. A failed load rejects; the next call tries again. */
export function loadBoards(locale: Locale): Promise<void> {
  if (isBoardsReady(locale)) return Promise.resolve();
  let promise = pending.get(locale);
  if (!promise) {
    promise = Promise.all([
      isBoardsInstalled() ? undefined : loadChunk().then(installBoards),
      locale === 'en' && !englishReady() ? loadLocaleForFeature('en', 'events-boards') : undefined,
    ]).then(() => undefined).finally(() => { pending.delete(locale); });
    pending.set(locale, promise);
  }
  return promise;
}

/** The boards' records once they are in (the frame's counts wait for them; `enabled` false: not asked for). */
export function useBoards(enabled: boolean): { ready: boolean } {
  const locale = useLocale();
  useSyncExternalStore(subscribeBoards, isBoardsInstalled, isBoardsInstalled);
  const [, setLoaded] = useState(0);
  const ready = isBoardsReady(locale);
  useEffect(() => {
    if (ready || !enabled) return;
    let live = true;
    loadBoards(locale).then(() => { if (live) setLoaded(count => count + 1); }, () => undefined);
    return () => { live = false; };
  }, [ready, enabled, locale]);
  return { ready };
}
