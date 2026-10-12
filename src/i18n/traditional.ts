// 繁體 for the site's own text (WEB-DATA-SPLIT, ENGSEC-01): opencc's core with its character table, the Taiwan variants and
// only the simplified → traditional phrases the site's sources contain (scripts/generate-traditional-phrases.ts proves the
// result equals the full dictionary on every Chinese run of the sources). About 45 KB instead of the 495 KB full build on a
// 繁體 page's critical path; the full phrase table (traditional-full.ts) loads after the reader's first tap, for text the
// site does not ship (BayBay answers, messages from the API).
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

/**
 * The browser's 繁體 converter (i18n/locale.ts): the site's phrases now. Text the site does not ship appears after the reader
 * does something, so the full phrase table waits for the first tap or key press: a reader who only reads never downloads it.
 * Then, between idle periods, it downloads, its trie is built in slices of 2,000 phrases (no long task) and `onUpgrade`
 * receives the full converter. Text converted so far is converted again and `changed` says whether any of it differs (the
 * page re-renders only then); the site's own text never does.
 */
export function siteTraditional(make: typeof taiwanConverter, onUpgrade: (full: Converter, changed: boolean) => void): Converter {
  const site = make({ Trie, Locale: SITE_LOCALE } as unknown as Tables);
  const seen = new Map<string, string>();
  const convert: Converter = (text, words = false) => {
    const out = site(text, words);
    if (seen.size < 20000) seen.set(`${words ? 1 : 0}${text}`, out);
    return out;
  };
  if (typeof window === 'undefined') return convert;
  const upgrade = async () => {
    await idleSlice();
    const { fullPhrases } = await import('./traditional-full');
    const phrases = new Trie();
    phrases.loadDict(STCharacters);
    const entries = fullPhrases.split('|');
    for (let at = 0; at < entries.length; at += 2000) {
      for (const entry of entries.slice(at, at + 2000)) { const space = entry.indexOf(' '); phrases.addWord(entry.slice(0, space), entry.slice(space + 1)); }
      await idleSlice();
    }
    const full = make({ Trie, Locale: { from: { cn: [[]] }, to: SITE_LOCALE.to } } as unknown as Tables, phrases);
    let changed = false;
    for (const [key, out] of seen) if (full(key.slice(1), key[0] === '1') !== out) { changed = true; break; }
    seen.clear();
    onUpgrade(full, changed);
  };
  const triggers = ['pointerdown', 'keydown'] as const;
  const begin = () => {
    for (const type of triggers) window.removeEventListener(type, begin, true);
    void upgrade().catch(() => { /* The site's own phrases stay; other text converts by character until a reload. */ });
  };
  for (const type of triggers) window.addEventListener(type, begin, { capture: true, passive: true });
  return convert;
}
