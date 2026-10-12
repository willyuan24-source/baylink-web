// 繁體 for the site's own text (WEB-DATA-SPLIT, ENGSEC-01): opencc's core with its character table, the Taiwan variants and
// only the simplified → traditional phrases the site's sources contain (scripts/generate-traditional-phrases.ts proves the
// result equals the full dictionary on every Chinese run of the sources). About 45 KB instead of the 495 KB full build on a
// 繁體 page's critical path; the full phrase table (traditional-full.ts) loads after the page is ready, for text the site
// does not ship (BayBay answers, messages from the API).
import { Trie } from 'opencc-js/core';
import STCharacters from 'opencc-js/dict/STCharacters';
import TWVariantsPhrases from 'opencc-js/dict/TWVariantsPhrases';
import TWVariants from 'opencc-js/dict/TWVariants';
import sitePhrases from '../data/generated/zh-hant-phrases.json';

export { Trie };
export const SITE_LOCALE = { from: { cn: [[sitePhrases, STCharacters]] }, to: { tw: [[TWVariantsPhrases, TWVariants]] } };
