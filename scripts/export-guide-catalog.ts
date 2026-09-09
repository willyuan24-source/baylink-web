import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guides } from '../src/data/guides';
import { guideBlockText } from '../src/lib/guide-content';
import photoCredits from '../src/data/guide-photo-credits.json';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const supported = new Set(['rent', 'roommate', 'used', 'moving', 'cleaning', 'ride', 'repair', 'translation', 'part-time', 'other']);
const categoryMap: Record<string, string> = { commute: 'ride', newcomer: 'other', city: 'other', safety: 'other', events: 'other' };
const catalog = guides.map((guide) => {
  const categories = [...new Set([
    ...(supported.has(guide.category) ? [guide.category] : [categoryMap[guide.category] || 'other']),
    ...guide.recommendedForCategories.filter((category) => supported.has(category)),
  ])];
  return {
    title: guide.title, slug: guide.slug, url: `/guides/${guide.slug}`, summary: guide.summary,
    keywords: [...new Set([guide.title, guide.categoryLabel, ...guide.tags])], categories,
    content: guide.blocks.map(guideBlockText).join('\n\n'),
    sources: guide.sources.map(({ title, url }) => ({ title, url })), updatedAt: guide.updatedAt,
    ...(guide.editionMonth ? { editionMonth: guide.editionMonth } : {}),
  };
});
const output = `${JSON.stringify(catalog, null, 2)}\n`;
const targets = [resolve(root, 'public/baybay-guides.json')];
if (process.argv[2]) targets.push(resolve(root, process.argv[2]));
for (const path of targets) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, output, 'utf8');
}
console.log(`Exported ${catalog.length} published guides to ${targets.length} catalog file(s).`);
const creditsPath = resolve(root, 'public/guides/editorial/photo-credits.json');
await mkdir(dirname(creditsPath), { recursive: true });
await writeFile(creditsPath, `${JSON.stringify(photoCredits, null, 2)}\n`, 'utf8');
