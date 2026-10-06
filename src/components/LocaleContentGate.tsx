import type { ReactNode } from 'react';
import { isLocaleReadyForPath, loadLocaleForPath, useLocale, type Locale } from '../i18n/locale';

type Pending = { promise: Promise<void>; error?: unknown };
const pending = new Map<string, Pending>();

/** Suspend before a new page mounts; a failed dictionary load uses the recoverable app boundary. */
function requireLanguage(locale: Locale, paths: readonly string[]) {
  if (isLocaleReadyForPath(locale, paths)) return;
  const key = `${locale}:${paths.join('|')}`;
  let entry = pending.get(key);
  if (!entry) {
    entry = { promise: Promise.resolve() };
    const current = entry;
    current.promise = loadLocaleForPath(locale, paths).then(() => { pending.delete(key); }, error => {
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
