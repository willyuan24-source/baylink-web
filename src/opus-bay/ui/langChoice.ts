import { isLocale, setLocale, type Locale } from '../../i18n/locale';
import { languagePath } from '../../lib/language-path';

/**
 * The game's language switch (the owner's request, 2026-09-28: 在游戏里切换中英文，或者一开始选中英文来开始). One choice for
 * the whole BAYLINK site: the site's own setLocale(…, persist) — it saves the choice, sets <html lang> and tells every
 * listener, and the game's text follows (useT re-renders; game-side caches outside React listen through the site's subscribeLocale).
 *
 * Title-chunk safe: this module imports the site's locale and dependency-free path helper (no three, no game module), so the title screen
 * and Settings share it.
 */

/** The three editions, each named in its own script (never converted: the pills carry translate="no"). */
export const GAME_LANGS: readonly { value: Locale; label: string }[] = [
  { value: 'zh-Hans', label: '简体' },
  { value: 'zh-Hant', label: '繁體' },
  { value: 'en', label: 'English' },
];

/**
 * Legacy links use ?lang: Simplified carries no parameter and the other two are named.
 * Returns the new search string ('' or '?…'); every other parameter is kept.
 */
export function langSearch(search: string, locale: Locale): string {
  const q = new URLSearchParams(search);
  if (locale === 'zh-Hans') q.delete('lang'); else q.set('lang', locale);
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** What `chooseGameLocale` touches outside the locale module (tests pass fakes). */
export interface LangEnv {
  set: (locale: Locale, persist: boolean) => Promise<boolean>;
  location: { pathname: string; search: string; hash: string } | null;
  replace: ((url: string) => void) | null;
}

const browserEnv = (): LangEnv => ({
  set: setLocale,
  location: typeof window === 'undefined' ? null : window.location,
  replace: typeof window === 'undefined' ? null : (url: string) => {
    window.history.replaceState(window.history.state, '', url);
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: window.history.state }));
  },
});

/**
 * Switch the game (and the site) to `locale`: persist it and update the standard language prefix without reloading.
 * Remove legacy ?lang while keeping other query values and the hash, so a reload keeps the selected edition.
 * Resolves true when this choice took effect, false when a later choice overtook it (setLocale's own sequence) or the
 * value is not a locale; rejects when the edition's text could not load (offline: the old language stays).
 */
export async function chooseGameLocale(locale: Locale, env: LangEnv = browserEnv()): Promise<boolean> {
  if (!isLocale(locale)) return false;
  if (!(await env.set(locale, true))) return false;
  const loc = env.location;
  if (loc && env.replace) {
    const next = `${languagePath(loc.pathname, locale)}${langSearch(loc.search, 'zh-Hans')}${loc.hash}`;
    if (next !== `${loc.pathname}${loc.search}${loc.hash}`) {
      try { env.replace(next); } catch { /* a sandboxed frame: the saved choice still holds */ }
    }
  }
  return true;
}

