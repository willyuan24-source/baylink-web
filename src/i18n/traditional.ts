// 繁體 for the site's own text (WEB-DATA-SPLIT, ENGSEC-01): opencc's core with its character table, the Taiwan variants and
// only the simplified → traditional phrases the site's sources contain (scripts/generate-traditional-phrases.ts proves the
// result equals the full dictionary on every Chinese run of the sources; the prerender checks every string it converts).
// About 45 KB instead of the 495 KB full build on a 繁體 page's critical path; the full phrase table (traditional-full.ts)
// loads only for text the site does not ship (BayBay answers, posts, messages from the API: locale.ts noteDynamicChinese).
import { Trie } from 'opencc-js/core';
import STCharacters from 'opencc-js/dict/STCharacters';
import TWVariantsPhrases from 'opencc-js/dict/TWVariantsPhrases';
import TWVariants from 'opencc-js/dict/TWVariants';
import sitePhrases from '../data/generated/zh-hant-phrases.json';
import type { taiwanConverter } from './locale';

export { Trie };
export const SITE_LOCALE = { from: { cn: [[sitePhrases, STCharacters]] }, to: { tw: [[TWVariantsPhrases, TWVariants]] } };

type Converter = (text: string, words?: boolean) => string;
type Tables = Parameters<typeof taiwanConverter>[0];

/** One idle slice (or a short timeout where requestIdleCallback is missing, Safari). */
const idleSlice = () => new Promise<void>(resolve => {
  const idle = (globalThis as { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => void }).requestIdleCallback;
  if (idle) idle(() => resolve(), { timeout: 2000 }); else setTimeout(resolve, 50);
});

/** Strings remembered for the check after the upgrade, phrases added to the trie per slice, strings checked per slice. */
const SEEN_LIMIT = 20000, BUILD_SLICE = 2000, CHECK_SLICE = 250;

/**
 * The browser's 繁體 converter (i18n/locale.ts): `convert` uses the site's phrases. `upgrade()` (once; again after a failed
 * download) fetches the full phrase table between idle periods and builds its trie in slices of 2,000 phrases; from then on
 * `convert` uses it, so new text is exact at once. The text converted before is checked again, 250 strings per idle slice
 * (no long task right after the reader's action), and `onUpgrade(full, changed)` receives the full converter and whether
 * any of that text now converts differently: the page re-renders only then. The site's own text never does.
 */
export function siteTraditional(make: typeof taiwanConverter, onUpgrade: (full: Converter, changed: boolean) => void, idle: () => Promise<void> = idleSlice): { convert: Converter; upgrade: () => void } {
  const site = make({ Trie, Locale: SITE_LOCALE } as unknown as Tables);
  const seen = new Map<string, string>();
  let full: Converter | undefined;
  const convert: Converter = (text, words = false) => {
    if (full) return full(text, words);
    const out = site(text, words);
    if (seen.size < SEEN_LIMIT) seen.set(`${words ? 1 : 0}${text}`, out);
    return out;
  };
  const run = async () => {
    await idle();
    const { fullPhrases } = await import('./traditional-full');
    const phrases = new Trie();
    phrases.loadDict(STCharacters);
    const entries = fullPhrases.split('|');
    for (let at = 0; at < entries.length; at += BUILD_SLICE) {
      for (const entry of entries.slice(at, at + BUILD_SLICE)) { const space = entry.indexOf(' '); phrases.addWord(entry.slice(0, space), entry.slice(space + 1)); }
      await idle();
    }
    const upgraded = make({ Trie, Locale: { from: { cn: [[]] }, to: SITE_LOCALE.to } } as unknown as Tables, phrases);
    full = upgraded;
    const earlier = [...seen];
    seen.clear();
    let changed = false;
    for (let at = 0; at < earlier.length && !changed; at += CHECK_SLICE) {
      if (at) await idle();
      changed = earlier.slice(at, at + CHECK_SLICE).some(([key, out]) => upgraded(key.slice(1), key[0] === '1') !== out);
    }
    onUpgrade(upgraded, changed);
  };
  let started: Promise<void> | undefined;
  // A failed download keeps the site's phrases (other text converts by character) until the next dynamic text asks again.
  const upgrade = () => { started ||= run().catch(() => { started = undefined; }); };
  return { convert, upgrade };
}
