import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentFreebies } from '../src/data/october-offers';
import { currentOpenings } from '../src/data/local-discoveries';
import { loadLocale, translateText, type Locale } from '../src/i18n/locale';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targets = [resolve(root, 'public/discovery-context.json'), ...(process.argv[2] ? [resolve(root, process.argv[2])] : [])];
/**
 * The catalog's check date comes from the data, never the build day: the newest `verifiedAt` of the exported items.
 * A rebuild on another day then writes the same files, and the API (which reads `checkedAt` as the recorded date of
 * the few offers without their own `verifiedAt`) never sees a date nobody checked anything on.
 */
export function discoveryCheckedAt(items: readonly { verifiedAt?: string }[]): string {
  const newest = items.map(item => item.verifiedAt?.slice(0, 10)).filter((day): day is string => !!day && /^\d{4}-\d{2}-\d{2}$/.test(day)).sort().at(-1);
  if (!newest) throw new Error('discovery context: no exported item has a verifiedAt date');
  return newest;
}
const checkedAt = discoveryCheckedAt([...currentFreebies, ...currentOpenings]);
const catalog = (locale: Locale) => {
  const t = (value: string) => translateText(value, locale);
  return { version: 1, checkedAt, items: [
    ...currentFreebies.map(offer => ({ kind: 'offer', id: offer.id, title: t(offer.title), path: `/offers/${offer.id}`, summary: t(offer.description), details: [t(offer.requirement)], region: offer.region,
      startDate: offer.startDate, endDate: offer.endDate, weekdays: offer.weekdays, dateLabel: t(offer.dateLabel), costLabel: t(offer.kind === 'check-terms' ? '条件待核对' : offer.kind === 'purchase' ? '需消费' : offer.kind === 'reservation' ? '需预约' : '无需购物'), status: offer.availability,
      verifiedAt: offer.verifiedAt, verificationStatus: offer.verificationStatus, sourceUrl: offer.sourceUrl, sourceLabel: t(offer.sourceLabel) })),
    ...currentOpenings.map(shop => ({ kind: 'opening', id: shop.id, title: t(shop.name), path: `/openings/${shop.id}`, summary: t(shop.summary), details: [t(shop.editorTip), t(shop.address), t(shop.category)], region: shop.region, city: t(shop.city),
      startDate: shop.openedOn, dateLabel: t(shop.dateLabel), status: shop.status, verifiedAt: shop.verifiedAt, sourceUrl: shop.officialUrl, sourceLabel: `${shop.name} · ${locale === 'en' ? 'Official website' : '官方入口'}` })),
  ] };
};
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await loadLocale('en');
  for (const locale of ['zh-Hans', 'en'] as const) for (const target of targets) {
    const path = locale === 'en' ? target.replace(/\.json$/, '.en.json') : target;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(catalog(locale), null, 2) + '\n', 'utf8');
  }
  process.stdout.write(`Exported ${currentFreebies.length} offers and ${currentOpenings.length} openings to ${targets.length} catalog locations (Chinese and English), checked ${checkedAt}. Existing verification dates were preserved.\n`);
}
