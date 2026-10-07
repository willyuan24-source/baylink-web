import { readdir } from 'node:fs/promises';
import { basename } from 'node:path';

/** Every discovered test belongs to exactly one lane; shared changes run both. */
export async function testLanes(directory = 'tests') {
  const all = (await readdir(directory, { recursive: true }))
    .filter(file => /\.test\.(ts|tsx|mjs)$/.test(file))
    .map(file => `${directory}/${file.replaceAll('\\', '/')}`).sort();
  const opus = all.filter(file => /^(opus-|little-bay)/.test(basename(file)));
  const opusSet = new Set(opus);
  const site = all.filter(file => !opusSet.has(file));
  if (!site.length || !opus.length || new Set(all).size !== all.length
    || site.length + opus.length !== all.length) throw new Error('Incomplete release test inventory');
  return { all, site, opus };
}
