import { readFile, writeFile } from 'node:fs/promises';
import { localDiscoveries, discoveryShare } from '../src/data/local-discoveries';
import { guides } from '../src/data/guides';

const config = JSON.parse(await readFile('vercel.json', 'utf8'));
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const guideRoute = config.routes.find((route: { dest?: string }) => route.dest === '/guides/$1.html');
guideRoute.src = `^/guides/(${guides.map(guide => escape(guide.slug)).join('|')})/?$`;
for (const [kind, folder] of [['event', 'events'], ['offer', 'offers'], ['opening', 'openings']]) {
  const src = `^/${folder}/(${localDiscoveries.filter(item => item.kind === kind).map(item => escape(discoveryShare(item).id)).join('|')})/?$`;
  const dest = `/${folder}/$1.html`;
  const found = config.routes.find((route: { dest?: string }) => route.dest === dest);
  if (found) found.src = src; else config.routes.splice(config.routes.indexOf(guideRoute), 0, { src, dest });
}
await writeFile('vercel.json', `${JSON.stringify(config, null, 2)}\n`);
console.log(`Hosting routes cover ${guides.length} guides and ${localDiscoveries.length} individual local discoveries.`);
