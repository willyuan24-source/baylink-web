import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const decodeEntities = value => value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[a-f\d]+);/gi, entity => {
  const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
  if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
  const numeric = entity.slice(2, -1);
  const number = numeric[0].toLowerCase() === 'x' ? parseInt(numeric.slice(1), 16) : Number(numeric);
  return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : entity;
});
const routePath = path => path.replace(/\.html$/i, '').replace(/\/index$/i, '').replace(/\/$/, '') || '/';
const localeHome = path => /^\/en(?:\/|$)/.test(path) ? '/en' : /^\/zh-Hant(?:\/|$)/.test(path) ? '/zh-Hant' : '/';

/** Only body anchors count: sitemap/hreflang/schema/self links cannot conceal an orphan. */
export function inspectStaticLinkCoverage(pages, sitemapUrls) {
  const canonical = new URL(sitemapUrls[0]);
  const expected = new Set(sitemapUrls.map(value => routePath(new URL(value).pathname)));
  const incoming = new Map([...expected].map(path => [path, new Set()]));
  const graph = new Map();
  for (const { path, html } of pages) {
    const source = routePath(path);
    const links = new Set();
    const body = html.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
    for (const anchor of body.matchAll(/<a(?=[\s>])[^>]*>/gi)) {
      const attribute = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(anchor[0]);
      if (!attribute) continue;
      let url;
      try { url = new URL(decodeEntities(attribute[1] ?? attribute[2] ?? attribute[3]), new URL(source, canonical.origin)); } catch { continue; }
      if (url.origin !== canonical.origin) continue;
      const target = routePath(url.pathname);
      links.add(target);
      if (target !== source) incoming.get(target)?.add(source);
    }
    graph.set(source, links);
  }
  const reachable = new Map();
  for (const home of new Set([...expected].map(localeHome))) {
    const seen = new Set();
    const pending = [home];
    while (pending.length) {
      const path = pending.pop();
      if (seen.has(path)) continue;
      seen.add(path);
      for (const target of graph.get(path) || []) if (!seen.has(target)) pending.push(target);
    }
    reachable.set(home, seen);
  }
  return {
    count: expected.size,
    missingHtml: [...expected].filter(path => !graph.has(path)).sort(),
    noInbound: [...expected].filter(path => !incoming.get(path).size).sort(),
    unreachable: [...expected].filter(path => !reachable.get(localeHome(path)).has(path)).sort(),
  };
}

export async function verifyStaticLinks(directory = 'dist') {
  const root = resolve(directory);
  const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => decodeEntities(match[1]));
  if (!urls.length) throw new Error('The generated sitemap has no URLs');
  const pages = [];
  async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith('.html')) pages.push({ path: `/${relative(root, path).replaceAll('\\', '/')}`, html: await readFile(path, 'utf8') });
    }
  }
  await walk(root);
  const report = inspectStaticLinkCoverage(pages, urls);
  const errors = ['missingHtml', 'noInbound', 'unreachable'].filter(key => report[key].length);
  if (errors.length) throw new Error(`Static link coverage failed: ${errors.map(key => `${key}=${report[key].length} (${report[key].slice(0, 8).join(', ')})`).join('; ')}`);
  console.log(`Static link coverage verified: ${report.count} sitemap URLs have distinct anchor inbound links and are reachable from their language homepage.`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await verifyStaticLinks(process.argv[2]);
