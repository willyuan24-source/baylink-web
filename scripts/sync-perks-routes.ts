import { readFile, writeFile } from 'node:fs/promises';
import { currentFreebies } from '../src/data/october-offers';
import { guides } from '../src/data/guides';

// Keep explicit route allowlists in sync while preserving redirects, headers and 404s.
const path = new URL('../vercel.json', import.meta.url);
const config = JSON.parse(await readFile(path, 'utf8'));
for (const [kind, ids] of [['offers', currentFreebies.map(offer => offer.id)], ['guides', guides.map(guide => guide.slug)]] as const) {
  const routes = config.routes as { src?: string; dest?: string }[];
  const index = routes.findIndex(route => route.dest === `/${kind}/$1.html`);
  if (index < 0) throw new Error(`No existing ${kind} routes`);
  config.routes = routes.filter(route => route.dest !== `/${kind}/$1.html`);
  const fresh = [];
  for (let i = 0; i < ids.length; i += 100) {
    const group = ids.slice(i, i + 100);
    if (group.some(id => !/^[a-z0-9-]+$/.test(id))) throw new Error(`Unsafe ${kind} identifier`);
    fresh.push({ src: `^/${kind}/(${group.join('|')})/?$`, dest: `/${kind}/$1.html` });
  }
  config.routes.splice(index, 0, ...fresh);
}
await writeFile(path, JSON.stringify(config, null, 2) + '\n');
console.log(`Synced ${currentFreebies.length} offer and ${guides.length} guide routes.`);
