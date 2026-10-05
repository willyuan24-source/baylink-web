import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guides } from '../src/data/guides';
import { localDiscoveries, discoveryShare } from '../src/data/local-discoveries';
import { MONTHLY_EDITION } from '../src/data/monthly-edition';
import { SLUG_TO_CATEGORY } from '../src/routing';
import { SITE_URL, escapeHtml } from '../src/lib/seo';

/** The dev/public file and the production prerender use the same current catalog. */
export function generateSitemap() {
  const paths = ['/', '/guides', '/this-month', '/calendar', '/explore', '/plan', '/opus-bay', '/ai-in-the-bay', '/tools', '/recommend', '/about', ...Object.keys(SLUG_TO_CATEGORY).map(slug => `/category/${slug}`), ...guides.map(guide => `/guides/${guide.slug}`), ...localDiscoveries.map(item => discoveryShare(item).path), '/terms', '/privacy', '/sms-consent'];
  const dates = new Map(guides.map(guide => [`/guides/${guide.slug}`, guide.updatedAt]));
  for (const item of localDiscoveries) {
    const share = discoveryShare(item);
    if (share.checkedAt) dates.set(share.path, share.checkedAt);
  }
  dates.set('/this-month', MONTHLY_EDITION.checkedAt);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(path => `  <url><loc>${escapeHtml(SITE_URL + path)}</loc>${dates.has(path) ? `<lastmod>${escapeHtml(dates.get(path)!)}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
  return { paths, xml };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { paths, xml } = generateSitemap();
  await writeFile('public/sitemap.xml', xml);
  console.log(`Updated public sitemap with ${paths.length} current public routes and source modification dates.`);
}
