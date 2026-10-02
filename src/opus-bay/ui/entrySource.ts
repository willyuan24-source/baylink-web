/**
 * W9-E · where a visit to /opus-bay came from (wave-9 contract, sf-w9-lead.md §4; the review's R§7 quick win 1 and R§9
 * funnel: "from=home/nav/play 的日开局数"). Every link into the game carries `?from=<source>`: the homepage card (home), the
 * site's sidebar (nav), the old /play address (play), a shared photo / family card / plain share link (photo, family,
 * share — lane S), a guide's "play it" link (guide), a promo video or poster (promo). No parameter = direct.
 *
 * `entrySource()` reads the parameter once, keeps it for the tab (sessionStorage, so the game's one reload after a lost
 * chunk keeps it) and removes it from the address bar with history.replaceState — keeping every other parameter, the hash
 * and the router's history state — so a link copied from the address bar does not carry someone else's source and a
 * reload is not a second "from=home". A later entry with a new `from=` in the same tab (SPA navigation home → game) wins.
 *
 * Title-chunk safe: no game import (OpusBayPage calls it on mount; lane S's metrics and anyone else call it later and get
 * the same answer). Nothing personal is kept: one of nine fixed words.
 */
export type EntrySource = 'home' | 'nav' | 'play' | 'photo' | 'family' | 'share' | 'guide' | 'promo' | 'direct';

export const ENTRY_SOURCES: readonly EntrySource[] = ['home', 'nav', 'play', 'photo', 'family', 'share', 'guide', 'promo', 'direct'];

const KEY = 'opus-bay:from';
const isSource = (v: unknown): v is EntrySource => typeof v === 'string' && (ENTRY_SOURCES as readonly string[]).includes(v);

/** The source named by a search string's `from=` (case and spaces ignored); null when it has none, 'direct' for an unknown word. */
export function parseEntrySource(search: string): EntrySource | null {
  let raw: string | null;
  try { raw = new URLSearchParams(search).get('from'); } catch { return null; }
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  return isSource(v) ? v : 'direct';
}

/** The search string without `from` ('' or '?…'); every other parameter kept in order. */
export function searchWithoutFrom(search: string): string {
  const q = new URLSearchParams(search);
  q.delete('from');
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** A link into the game with its source: `withEntrySource('/opus-bay?lang=en', 'home')` → `/opus-bay?lang=en&from=home`. */
export function withEntrySource(href: string, source: EntrySource): string {
  const hash = href.indexOf('#');
  const base = hash >= 0 ? href.slice(0, hash) : href, tail = hash >= 0 ? href.slice(hash) : '';
  const q = base.indexOf('?');
  const path = q >= 0 ? base.slice(0, q) : base;
  const params = new URLSearchParams(q >= 0 ? base.slice(q + 1) : '');
  params.delete('from');
  if (source !== 'direct') params.set('from', source);
  const s = params.toString();
  return `${path}${s ? `?${s}` : ''}${tail}`;
}

/** What `entrySource` touches outside this module (tests pass fakes). */
export interface EntryEnv {
  location: { pathname: string; search: string; hash: string } | null;
  replace: ((url: string) => void) | null;
  storage: Pick<Storage, 'getItem' | 'setItem'> | null;
}

const browserEnv = (): EntryEnv => {
  if (typeof window === 'undefined') return { location: null, replace: null, storage: null };
  let storage: EntryEnv['storage'] = null;
  try { storage = window.sessionStorage; } catch { /* storage blocked: the source still holds for this page */ }
  return { location: window.location, replace: (url: string) => window.history.replaceState(window.history.state, '', url), storage };
};

let cached: EntrySource | null = null;

/** Where this visit came from (see the module note). Never throws. */
export function entrySource(env: EntryEnv = browserEnv()): EntrySource {
  const loc = env.location;
  const fromUrl = loc ? parseEntrySource(loc.search) : null;
  if (fromUrl) {
    cached = fromUrl;
    try { env.storage?.setItem(KEY, fromUrl); } catch { /* storage full or blocked */ }
    if (loc && env.replace) {
      try { env.replace(`${loc.pathname}${searchWithoutFrom(loc.search)}${loc.hash}`); } catch { /* a sandboxed frame: the URL keeps it */ }
    }
    return fromUrl;
  }
  if (cached) return cached;
  let stored: string | null = null;
  try { stored = env.storage?.getItem(KEY) ?? null; } catch { /* blocked */ }
  cached = isSource(stored) ? stored : 'direct';
  return cached;
}

/** Tests only: forget the cached source. */
export function __resetEntrySourceForTests() { cached = null; }
