import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import * as OpenCC from 'opencc-js';
import { Trie } from 'opencc-js/core';
import STPhrases from 'opencc-js/dict/STPhrases';
import STCharacters from 'opencc-js/dict/STCharacters';
import TWVariantsPhrases from 'opencc-js/dict/TWVariantsPhrases';
import TWVariants from 'opencc-js/dict/TWVariants';
import { taiwanConverter, TAIWAN_WORDS } from '../src/i18n/locale';
import { SITE_TAIWAN_TERMS } from '../src/i18n/taiwan-terms';

/**
 * 繁體 without the 400 KB phrase dictionary on the critical path (WEB-DATA-SPLIT, ENGSEC-01): the site's own text uses a
 * few thousand of opencc's ~49,000 simplified → traditional phrases. This keeps every phrase that occurs anywhere in the
 * site's sources (src/**: UI, editorial data, generated catalogs), in the text the 3D game's word list produces, or in the
 * converted output (the converter checks its own output once more, locale.ts taiwanConverter), and proves that the pruned
 * converter turns every Chinese run of those sources into exactly what the full one does. Text the site does not ship
 * (posts, BayBay answers, messages) converts with the full dictionary, which the browser loads when such text is shown
 * (locale.ts noteDynamicChinese); text the pages assemble at render time is checked by the prerender (checkSiteTraditional).
 * Run with the English scopes (generate:home, prebuild and pretest); deterministic for given sources. Every converter here
 * applies the site's 繁體 term table (i18n/taiwan-terms.ts, WEB-SEO-I18N) as the browser's does, so the phrases are collected
 * from the term-substituted text too and the proof covers what 繁體 pages actually show.
 */
const HAN_RUN = /[〇㐀-鿿豈-﫿\u{20000}-\u{2ffff}]+/gu;

async function sourceRuns(root = 'src'): Promise<Set<string>> {
  const runs = new Set<string>();
  const scan = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await scan(path);
      else if (/\.(?:tsx?|json)$/u.test(entry.name) && !path.replace(/\\/g, '/').endsWith('generated/zh-hant-phrases.json')) {
        for (const match of (await readFile(path, 'utf8')).matchAll(HAN_RUN)) runs.add(match[0]);
      }
    }
  };
  await scan(root);
  return runs;
}

type Node = Map<number, Node> & { key?: string };
function phraseTrie(entries: readonly string[]): Node {
  const root: Node = new Map();
  for (const entry of entries) {
    const key = entry.slice(0, entry.indexOf(' '));
    let node = root;
    for (const char of key) { const cp = char.codePointAt(0)!; let next = node.get(cp); if (!next) node.set(cp, next = new Map()); node = next; }
    node.key = key;
  }
  return root;
}
/** Every dictionary key that occurs anywhere in `text`. */
function collectKeys(root: Node, text: string, found: Set<string>) {
  const chars = [...text];
  for (let start = 0; start < chars.length; start++) {
    let node: Node | undefined = root;
    for (let at = start; at < chars.length && node; at++) {
      node = node.get(chars[at].codePointAt(0)!);
      if (node?.key) found.add(node.key);
    }
  }
}

export async function generateTraditionalPhrases(): Promise<void> {
  const runs = [...await sourceRuns()].sort();
  const entries = STPhrases.split('|');
  const trie = phraseTrie(entries);
  const full = taiwanConverter(OpenCC, undefined, SITE_TAIWAN_TERMS);
  const local = new Trie(); local.loadDict([...TAIWAN_WORDS, ...SITE_TAIWAN_TERMS.words] as unknown as string[][]);
  const found = new Set<string>();
  for (const run of runs) {
    for (const text of [run, local.convert(run)]) {
      collectKeys(trie, text, found);
      collectKeys(trie, full(text), found);
    }
  }
  const pruned = entries.filter(entry => found.has(entry.slice(0, entry.indexOf(' ')))).join('|');
  const prunedConverter = taiwanConverter({ Trie, Locale: { from: { cn: [[pruned, STCharacters]] }, to: { tw: [[TWVariantsPhrases, TWVariants]] } } } as unknown as Parameters<typeof taiwanConverter>[0], undefined, SITE_TAIWAN_TERMS);
  const fresh = taiwanConverter(OpenCC, undefined, SITE_TAIWAN_TERMS);
  const differing = runs.filter(run => prunedConverter(run) !== fresh(run) || prunedConverter(run, true) !== fresh(run, true));
  if (differing.length) throw new Error(`The pruned 繁體 phrases convert ${differing.length} source runs differently, e.g. ${differing.slice(0, 5).join(', ')}`);
  await writeFile('src/data/generated/zh-hant-phrases.json', JSON.stringify(pruned));
  console.log(`繁體 phrases: ${found.size} of ${entries.length} (${(gzipSync(pruned).length / 1024).toFixed(1)} KiB gzip vs ${(gzipSync(STPhrases).length / 1024).toFixed(1)}), identical on ${runs.length} source runs.`);
}
