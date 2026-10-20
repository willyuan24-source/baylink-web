import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tsImport } from 'tsx/esm/api';

/**
 * CW-01 release check: every phone number a reader sees in a prerendered page's <main> (all three languages) is a tap-to-call
 * link. The page's text outside a[href^="tel:"] is scanned with the same finder the app links with (src/lib/phone-numbers.ts),
 * so a number the app would link but a template prints bare fails the release. `node scripts/verify-phone-links.mjs
 * --report` lists them without failing.
 */
const { findPhoneNumbers } = await tsImport('../src/lib/phone-numbers.ts', import.meta.url);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
const decode = text => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name) => {
  if (name[0] === '#') return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
  return ENTITIES[name] ?? match;
});

/** The visible text of a page's <main>, with tel: links, scripts, styles and hidden attributes' values left out. */
export function unlinkedPhones(html) {
  const main = html.match(/<main\b[^>]*>([\s\S]*)<\/main>/)?.[1] ?? '';
  // A contact card prints the number large beside its own 拨打 button: a number with a tel: link on the page is callable.
  const linked = new Set([...main.matchAll(/href="tel:([^"]+)"/g)].map(match => match[1]));
  const text = decode(main
    .replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, ' ')
    // A type cover is a card's picture inside the card's one link: a guide's hook on it ("燃气味先离开打 911", UI9-C's headline
    // family, which replaced the TypeCover note line) is not a separate call target; the guide it opens links the number.
    .replace(/<p class="tc-hook"[^>]*>[\s\S]*?<\/p>/gi, ' ')
    .replace(/<a\b[^>]*href="tel:[^"]*"[^>]*>[\s\S]*?<\/a>/gi, ' ')
    // Blocks end a line; inline tags join their text as the reader sees it.
    .replace(/<\/?(?:p|li|div|h[1-6]|dd|dt|dl|ul|ol|section|article|header|footer|nav|figure|figcaption|br|tr|td|th|button)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ''));
  return findPhoneNumbers(text).filter(match => !linked.has(match.tel)).map(match => match.text);
}

async function* htmlFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'assets' && entry.name !== 'opus-bay') yield* htmlFiles(path); }
    else if (entry.name.endsWith('.html')) yield path;
  }
}

/** Scan dist/; returns [{ page, numbers }] for pages with an unlinked number. */
export async function verifyPhoneLinks(dist = 'dist') {
  const failures = [];
  for await (const file of htmlFiles(dist)) {
    const numbers = unlinkedPhones(await readFile(file, 'utf8'));
    if (numbers.length) failures.push({ page: relative(dist, file).split('\\').join('/'), numbers });
  }
  return failures;
}

if (import.meta.url === `file:///${process.argv[1]?.split('\\').join('/')}` || process.argv[1]?.endsWith('verify-phone-links.mjs')) {
  const failures = await verifyPhoneLinks();
  if (process.argv.includes('--report')) {
    for (const { page, numbers } of failures) console.log(`${page}: ${numbers.join(', ')}`);
    console.log(`${failures.length} pages with an unlinked phone number.`);
  } else if (failures.length) {
    throw new Error(`Phone numbers printed without a tel: link (CW-01) on ${failures.length} pages: ${failures.slice(0, 12).map(({ page, numbers }) => `${page} (${numbers.join(', ')})`).join('; ')}`);
  } else console.log('Every phone number on the prerendered pages is a tap-to-call link.');
}
