import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guides } from '../src/data/guides';
import { localDiscoveries, discoveryShare } from '../src/data/local-discoveries';
import { MONTHLY_EDITION } from '../src/data/monthly-edition';
import { SLUG_TO_CATEGORY } from '../src/routing';
import { languagePath, type SiteLanguage, unprefixedPath } from '../src/lib/language-path';
import { SITE_URL, escapeHtml } from '../src/lib/seo';
import { ROUTES } from '../src/app/route-table';

/** The dev/public file and the production prerender use the same current catalog. */
export function generateSitemap() {
  // Route table (src/app/route-table.ts): static pages flagged `sitemap`, then every published id of the id routes.
  const ids: Record<string, string[]> = {
    '/category/:categorySlug': Object.keys(SLUG_TO_CATEGORY).map(slug => `/category/${slug}`),
    '/guides/:slug': guides.map(guide => `/guides/${guide.slug}`),
    '/events/:id': [], '/offers/:id': [], '/openings/:id': [],
  };
  for (const item of localDiscoveries) ids[`/${discoveryShare(item).path.split('/')[1]}/:id`].push(discoveryShare(item).path);
  const basePaths = ROUTES.filter(route => route.sitemap).flatMap(route => {
    if (!route.path.includes(':')) return [route.path];
    if (!ids[route.path]) throw new Error(`The sitemap has no published ids for ${route.path}`);
    return ids[route.path];
  });
  const paths = (['zh-Hans','zh-Hant','en'] as SiteLanguage[]).flatMap(locale => basePaths.map(path => languagePath(path,locale)));
  const dates = new Map(guides.map(guide => [`/guides/${guide.slug}`, guide.updatedAt]));
  for (const item of localDiscoveries) {
    const share = discoveryShare(item);
    if (share.checkedAt) dates.set(share.path, share.checkedAt);
  }
  dates.set('/this-month', MONTHLY_EDITION.checkedAt);
  dates.set('/events', MONTHLY_EDITION.checkedAt);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${paths.map(path => `  <url><loc>${escapeHtml(SITE_URL + path)}</loc>${dates.has(unprefixedPath(path)) ? `<lastmod>${escapeHtml(dates.get(unprefixedPath(path))!)}</lastmod>` : ''}${(['zh-Hans','zh-Hant','en'] as SiteLanguage[]).map(locale => `<xhtml:link rel="alternate" hreflang="${locale}" href="${SITE_URL}${languagePath(path,locale)}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${languagePath(path,'zh-Hans')}"/></url>`).join('\n')}\n</urlset>\n`;
  return { paths, xml };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { paths, xml } = generateSitemap();
  await writeFile('public/sitemap.xml', xml);
  console.log(`Updated public sitemap with ${paths.length} current public routes and source modification dates.`);
}
