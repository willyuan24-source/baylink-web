import { useEffect, type ReactNode } from 'react';
import { isLocaleReadyForFeature, isLocaleReadyForPath, loadLocaleForFeature, loadLocaleForPath, noteDynamicChinese, useLocale, type Locale } from '../i18n/locale';
import type { EnglishFeature } from '../lib/english-loading';

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
 * A feature that shows content from many routes (the search dialog: guides' full text, events, places; BayBay's cards) waits
 * for that feature's dictionaries, not for whichever pages it happens to be opened over (WEB-DATA-SPLIT: /guides, /events
 * and /calendar now load only what they display). BayBay's answers are text the site does not ship: once its panel is open
 * in 繁體, opencc's full phrase table loads in idle time, before the first answer arrives (noteDynamicChinese).
 */
export function LocaleFeatureGate({ feature, children }: { feature: EnglishFeature; children: ReactNode }) {
  const locale = useLocale();
  useEffect(() => { if (feature === 'baybay' && locale === 'zh-Hant') noteDynamicChinese(); }, [feature, locale]);
  if (!isLocaleReadyForFeature(locale, feature)) requireLoad(`${locale}:feature:${feature}`, () => loadLocaleForFeature(locale, feature));
  return children;
}
