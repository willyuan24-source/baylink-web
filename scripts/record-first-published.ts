/**
 * Records the day each guide, offer and opening first shipped (src/data/first-published/*.json), for the Article
 * `datePublished` (I18N-SEO-13). The day is the first commit (Pacific author date) whose added lines under src/data
 * carry the item's id — a real fact from the history, not the review date. Append-only: an existing entry never changes;
 * items without one simply have no `datePublished` until this runs where the git history is available (a full clone,
 * not CI's shallow checkout). Run: `npx tsx --tsconfig tsconfig.app.json scripts/record-first-published.ts`.
 */
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { guides } from '../src/data/guides';
import { discoveryShare, localDiscoveries } from '../src/data/local-discoveries';

const files = { guides: 'src/data/first-published/guides.json', listings: 'src/data/first-published/listings.json' } as const;
const read = async (path: string) => JSON.parse(await readFile(path, 'utf8')) as Record<string, string>;
const recorded = { guides: await read(files.guides), listings: await read(files.listings) };
const wanted = new Map<string, { file: keyof typeof files; key: string }>();
for (const guide of guides) if (!recorded.guides[guide.slug]) wanted.set(guide.slug, { file: 'guides', key: guide.slug });
for (const item of localDiscoveries) {
  if (item.kind === 'event') continue;
  const share = discoveryShare(item);
  const key = `${share.kind}:${share.id}`;
  if (!recorded.listings[key]) wanted.set(share.id, { file: 'listings', key });
}

if (wanted.size) {
  const found = new Map<string, string>();
  await new Promise<void>((resolve, reject) => {
    const git = spawn('git', ['log', '--reverse', '--format=@@COMMIT %aI', '-p', '--unified=0', '--no-renames', '--', 'src/data']);
    let date = '', buffer = '';
    const pacificDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' });
    const quoted = /['"`]([a-z0-9][a-z0-9._-]{2,120})['"`]/g;
    const line = (text: string) => {
      if (text.startsWith('@@COMMIT ')) { date = pacificDay.format(new Date(text.slice(9).trim())); return; }
      if (!text.startsWith('+') || text.startsWith('+++')) return;
      for (const match of text.matchAll(quoted)) if (wanted.has(match[1]) && !found.has(match[1])) found.set(match[1], date);
    };
    git.stdout.setEncoding('utf8');
    git.stdout.on('data', (chunk: string) => { buffer += chunk; let index; while ((index = buffer.indexOf('\n')) >= 0) { line(buffer.slice(0, index)); buffer = buffer.slice(index + 1); } });
    git.on('error', reject);
    git.on('close', code => { if (buffer) line(buffer); if (code) reject(new Error(`git log exited with ${code}`)); else resolve(); });
  });
  for (const [id, date] of found) { const { file, key } = wanted.get(id)!; recorded[file][key] = date; }
  console.log(`Recorded ${found.size} first-published days; ${wanted.size - found.size} items are not in the history yet (uncommitted).`);
} else console.log('Every guide, offer and opening already has its first-published day.');

const sorted = (record: Record<string, string>) => JSON.stringify(Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n';
await writeFile(files.guides, sorted(recorded.guides));
await writeFile(files.listings, sorted(recorded.listings));
