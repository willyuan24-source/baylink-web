import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

/**
 * G6 (UI-9 DECISIONS 12): no all-caps English UI labels and no text-transform:uppercase on labels, site-wide — the gate
 * UI9-INT runs after every lane fixed its own strings. Scope: the site's UI code (src/components, src/features, src/pages,
 * src/app, src/lib). Out of scope: the 3D world and its little-bay panels (src/opus-bay, src/features/little-bay,
 * OpusBayShell, LittleBay*; DECISIONS 1), content data (src/data: place and brand names as their sources write them).
 */
const UI_DIRS = ['src/components', 'src/features', 'src/pages', 'src/app', 'src/lib'];
const EXCLUDED = /src[\\/](?:opus-bay|features[\\/]little-bay)[\\/]|OpusBayShell|LittleBay/;
/** All-caps runs that are not labels: proper nouns and acronyms, a typed confirmation, file formats, a share-card tagline. */
const ALLOWED = new Set([
  'REAL ID', // the federal ID's name
  'CHICK-FIL-A', // brand case table (event-facts brandCase)
  'LAST-MODIFIED', // an iCalendar field
  'DELETE MY ACCOUNT', // the phrase a member types to confirm deletion (account-deletion.ts)
  'YYYY-MM-DD', // a date format hint
  'YOUR BAY', 'YOUR PEOPLE', // the weekly share-card artwork's tagline (an image, not a UI label; owner call to change)
]);
const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => { const path = join(dir, name); return statSync(path).isDirectory() ? walk(path) : [path]; });
const files = UI_DIRS.flatMap(walk).filter(path => !EXCLUDED.test(path));

test('G6: no all-caps English phrase in the UI code', () => {
  const hits: string[] = [];
  for (const file of files.filter(path => /\.(?:tsx?|mts)$/.test(path))) {
    readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      if (/^\s*(?:import\b|\/\/|\*|\/\*|\{\/\*)/.test(line)) return;
      for (const match of line.matchAll(/(?<![A-Za-z0-9_\-./#])([A-Z][A-Z’'&]+(?:[ -][A-Z][A-Z’'&]+)+)(?![a-z0-9_])/g)) {
        const phrase = match[1].replace(/['’]$/, '');
        if (ALLOWED.has(phrase) || /^CC BY/.test(phrase) || /^[A-Z]{2,6}-[A-Z]{2,12}$/.test(phrase) && /\/\*|\/\//.test(line)) continue;
        hits.push(`${file}:${index + 1} ${phrase}`);
      }
    });
  }
  assert.deepEqual(hits, []);
});

test('G6: no text-transform:uppercase in the UI stylesheets', () => {
  const hits: string[] = [];
  for (const file of files.filter(path => path.endsWith('.css'))) {
    for (const match of readFileSync(file, 'utf8').matchAll(/([^{}]*)\{[^}]*text-transform:\s*uppercase[^}]*\}/g)) hits.push(`${file}: ${match[1].trim().slice(-80)}`);
  }
  assert.deepEqual(hits, []);
});
