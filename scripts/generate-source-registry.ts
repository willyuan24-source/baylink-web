import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getContentReviewManifest } from '../src/data/content-review';
import { getBayAreaToday } from '../src/lib/monthly';
import type { ContentReviewRecord } from '../src/lib/content-review';

type Source = { id: string; title: string; url: string; kind: string; contentIds: string[]; endDate?: string; region?: string; redirectHosts?: string[] };
const canonical = (value: string): string | undefined => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || isIP(url.hostname) || !url.hostname.includes('.') || /(?:^localhost$|\.local$)/i.test(url.hostname) || url.href.length > 2000) return;
    url.hash = '';
    return url.href;
  } catch { return; }
};

/** Registry membership schedules reading, never renews an editorial checked date. */
export function createSourceRegistry(records: readonly ContentReviewRecord[], previous: readonly Source[]) {
  const byUrl = new Map<string, Source>();
  for (const row of previous) {
    const url = canonical(row.url);
    if (!url || !/^source-[a-z0-9-]+$/i.test(row.id) || byUrl.has(url)) throw new Error('Invalid or duplicate existing source registry');
    byUrl.set(url, { ...row, url, contentIds: [...row.contentIds] });
  }
  const associations = new Map<string, ContentReviewRecord[]>();
  const unmonitorable: { contentId: string; url: string }[] = [];
  for (const record of records) for (const raw of new Set(record.sourceUrls)) {
    const url = canonical(raw);
    if (!url) { unmonitorable.push({ contentId: record.id, url: raw }); continue; }
    const entries = associations.get(url) || [];
    entries.push(record); associations.set(url, entries);
  }
  for (const [url, entries] of associations) {
    const previousRow = byUrl.get(url);
    const contentIds = [...new Set([...(previousRow?.contentIds || []), ...entries.map(record => record.id)])].sort();
    // A shared evergreen source must keep running after one dated event ends.
    const bounded = entries.every(record => record.endDate && /^\d{4}-\d{2}-\d{2}$/.test(record.endDate));
    const endDate = bounded ? entries.map(record => record.endDate!).sort().at(-1) : undefined;
    const row = { ...(previousRow || {}), id: previousRow?.id || `source-${createHash('sha256').update(url).digest('hex').slice(0, 16)}`, title: previousRow?.title || entries[0].title, url, kind: previousRow?.kind || entries[0].kind, contentIds } as Source;
    delete row.endDate;
    if (endDate) row.endDate = endDate;
    byUrl.set(url, row);
  }
  const registry = [...byUrl.values()].sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(registry.map(row => row.id)).size !== registry.length) throw new Error('Source ID collision');
  return { registry, unmonitorable };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const existingPath = process.argv.find(arg => arg.startsWith('--existing='))?.slice(11);
  const outputPath = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
  if (!existingPath || !outputPath) throw new Error('Explicit --existing and --output registry paths are required');
  const previous = JSON.parse(await readFile(existingPath, 'utf8')) as Source[];
  const result = createSourceRegistry(getContentReviewManifest(getBayAreaToday()).items, previous);
  await writeFile(outputPath, JSON.stringify(result.registry, null, 2) + '\n');
  console.log(`Registered ${result.registry.length} unique public HTTPS sources for ${new Set(result.registry.flatMap(row => row.contentIds)).size} content IDs; retained ${previous.length} existing source identities. ${result.unmonitorable.length} source references require manual access.`);
}
