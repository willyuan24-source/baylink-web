import type { ReactNode } from 'react';
import { isLocaleReadyForFeature, isLocaleReadyForPath, loadLocaleForFeature, loadLocaleForPath, useLocale, type Locale } from '../i18n/locale';

type Pending = { promise: Promise<void>; error?: unknown };
const pending = new Map<string, Pending>();

/** Suspend before a new page mounts; a failed dictionary load uses the recoverable app boundary. */
function requireLanguage(locale: Locale, paths: readonly string[]) {
  if (isLocaleReadyForPath(locale, paths)) return;
  requireLoad(`${locale}:${paths.join('|')}`, () => loadLocaleForPath(locale, paths));
}

function requireLoad(key: string, load: () => Promise<void>) {
  let entry = pending.get(key);
  if (!entry) {
    entry = { promise: Promise.resolve() };
    const current = entry;
    current.promise = load().then(() => { pending.delete(key); }, error => {
      current.error = error;
      throw error;
    });
    pending.set(key, current);
  }
  if (entry.error) throw entry.error;
  throw entry.promise;
}

export function LocaleContentGate({ paths, children }: { paths: readonly string[]; children: ReactNode }) {
  const locale = useLocale();
  requireLanguage(locale, paths);
  return children;
}

/**
 * A feature that shows content from many routes (the search dialog: guides' full text, events, places) waits for that
 * feature's dictionaries, not for whichever pages it happens to be opened over (WEB-DATA-SPLIT: /guides no longer loads
 * the guides' full text with the page).
 */
export function LocaleFeatureGate({ feature, children }: { feature: 'search'; children: ReactNode }) {
  const locale = useLocale();
  if (!isLocaleReadyForFeature(locale, feature)) requireLoad(`${locale}:feature:${feature}`, () => loadLocaleForFeature(locale, feature));
  return children;
}
