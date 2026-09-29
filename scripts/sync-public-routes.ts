import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localDiscoveries, discoveryShare } from '../src/data/local-discoveries';
import { guides } from '../src/data/guides';

// Vercel limits each route's src to 4096 characters; leave room for future syntax changes.
export const PUBLIC_ROUTE_SRC_LIMIT = 3500;
export type PublicFolder = 'events' | 'offers' | 'openings' | 'guides';
export type HostingRoute = { src?: string; dest?: string; handle?: string; [key: string]: unknown };
export type PublicCatalog = Record<PublicFolder, string[]>;
const folders: PublicFolder[] = ['events', 'offers', 'openings', 'guides'];
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Exact, disjoint allowlists: never broaden matching to an arbitrary slug. */
export function publicRouteGroups(folder: PublicFolder, ids: string[], limit = PUBLIC_ROUTE_SRC_LIMIT): HostingRoute[] {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 4096) throw new Error('Route source limit must be between 1 and 4096');
  if (new Set(ids).size !== ids.length || ids.some(id => !id)) throw new Error(`Invalid or duplicate ${folder} identifiers`);
  const prefix = `^/${folder}/(`;
  const suffix = ')/?$';
  const groups: HostingRoute[] = [];
  let alternatives: string[] = [];
  let length = prefix.length + suffix.length;
  const flush = () => {
    if (alternatives.length) groups.push({ src: `${prefix}${alternatives.join('|')}${suffix}`, dest: `/${folder}/$1.html` });
    alternatives = [];
    length = prefix.length + suffix.length;
  };
  for (const id of ids) {
    const literal = escape(id);
    if (prefix.length + literal.length + suffix.length > limit) throw new Error(`${folder} identifier exceeds route source limit: ${id}`);
    if (length + literal.length + (alternatives.length ? 1 : 0) > limit) flush();
    length += literal.length + (alternatives.length ? 1 : 0);
    alternatives.push(literal);
  }
  flush();
  return groups;
}

/** Replace every old group at its first position, preserving all unrelated routes verbatim. */
export function syncPublicRoutes(routes: HostingRoute[], catalog: PublicCatalog, limit = PUBLIC_ROUTE_SRC_LIMIT): HostingRoute[] {
  let updated = [...routes];
  for (const folder of folders) {
    const dest = `/${folder}/$1.html`;
    const generated = publicRouteGroups(folder, catalog[folder], limit);
    const first = updated.findIndex(route => route.dest === dest);
    if (first >= 0) {
      const template = updated[first];
      updated = updated.flatMap((route, index) => route.dest !== dest ? [route]
        : index === first ? generated.map(group => ({ ...template, ...group })) : []);
    } else {
      const guide = updated.findIndex(route => route.dest === '/guides/$1.html');
      const filesystem = updated.findIndex(route => route.handle === 'filesystem');
      updated.splice(guide >= 0 ? guide : filesystem >= 0 ? filesystem : updated.length, 0, ...generated);
    }
  }
  return updated;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = JSON.parse(await readFile('vercel.json', 'utf8')) as { routes: HostingRoute[] };
  const catalog: PublicCatalog = { events: [], offers: [], openings: [], guides: guides.map(guide => guide.slug) };
  for (const item of localDiscoveries) catalog[item.kind === 'event' ? 'events' : item.kind === 'offer' ? 'offers' : 'openings'].push(discoveryShare(item).id);
  config.routes = syncPublicRoutes(config.routes, catalog);
  await writeFile('vercel.json', `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Hosting routes cover ${guides.length} guides and ${localDiscoveries.length} individual local discoveries; each public src is at most ${PUBLIC_ROUTE_SRC_LIMIT} characters.`);
}
