import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guides } from '../src/data/guides';
import { GUIDE_IMAGES, getGuideMedia, type GuideImage } from '../src/data/guide-media';
import { MONTHLY_EVENTS, MONTHLY_PLACES } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';
import { currentOpenings } from '../src/data/local-discoveries';
import { EVENT_CONTEXT_PHOTOS, isApprovedEventContextPhoto } from '../src/data/event-image-usage';

type CoverageRow = { id: string; image?: GuideImage };
const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url));

/** Audits the published editorial catalog and every registered responsive image. */
export function auditMediaCoverage() {
  const catalogs: Record<string, CoverageRow[]> = {
    guides: guides.map(guide => ({ id: guide.slug, image: getGuideMedia(guide).cover })),
    events: MONTHLY_EVENTS.map(event => ({ id: event.id, image: GUIDE_IMAGES[event.imageKey] })),
    offers: currentFreebies.map(offer => ({ id: offer.id, image: GUIDE_IMAGES[offer.imageKey] })),
    openings: currentOpenings.map(shop => ({ id: shop.id, image: GUIDE_IMAGES[shop.imageKey] })),
    places: MONTHLY_PLACES.map(place => ({ id: place.id, image: GUIDE_IMAGES[place.imageKey] })),
  };
  const issues: string[] = [];
  const verifiedFiles = new Set<string>();
  const checkFile = (source: string, label: string) => {
    if (!source.startsWith('/') || source.startsWith('//') || source.includes('..')) {
      issues.push(`${label}: expected a local, publishable image path: ${source}`);
      return;
    }
    if (verifiedFiles.has(source)) return;
    verifiedFiles.add(source);
    const path = resolve(publicDirectory, source.slice(1));
    if (!existsSync(path)) {
      issues.push(`${label}: missing ${source}`);
      return;
    }
    const bytes = readFileSync(path);
    if (!bytes.length) issues.push(`${label}: empty ${source}`);
    if (source.endsWith('.webp') && (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP')) {
      issues.push(`${label}: invalid WebP header ${source}`);
    }
  };
  for (const [key, image] of Object.entries(GUIDE_IMAGES)) {
    if (!image.alt.trim() || !image.caption.trim() || !image.credit.trim()) issues.push(`${key}: missing description or provenance`);
    if (!(image.width > 0 && image.height > 0)) issues.push(`${key}: missing intrinsic dimensions`);
    checkFile(image.src, key);
    if (!image.srcSet) issues.push(`${key}: missing responsive image sources`);
    for (const candidate of image.srcSet?.split(',') || []) checkFile(candidate.trim().split(/\s+/)[0], `${key} srcSet`);
  }
  for (const [kind, rows] of Object.entries(catalogs)) {
    for (const row of rows) if (!row.image) issues.push(`${kind}/${row.id}: no registered image`);
  }
  for (const [key, usage] of Object.entries(EVENT_CONTEXT_PHOTOS)) {
    const image = GUIDE_IMAGES[key];
    if (!image || image.kind !== 'photo' || !image.creditUrl?.startsWith('https://')) {
      issues.push(`${key}: contextual photos must have a traceable photo source`);
      continue;
    }
    if (!/资料/.test(image.caption) || !/不是|不代表|不表示/.test(image.caption)) issues.push(`${key}: missing non-event archival-photo disclosure`);
    if (usage.purpose === 'theme' && !/主题/.test(image.caption)) issues.push(`${key}: missing thematic-photo disclosure`);
    for (const event of MONTHLY_EVENTS.filter(event => event.imageKey === key)) {
      if (!isApprovedEventContextPhoto(key, event.id)) issues.push(`${event.id}: unreviewed use of contextual photo ${key}`);
    }
  }
  for (const guide of guides) {
    for (const inline of getGuideMedia(guide).inline) if (!inline.image) issues.push(`guides/${guide.slug}: missing inline image`);
    if (guide.cover) checkFile(guide.cover, `${guide.slug} original poster`);
  }
  const summary = Object.fromEntries(Object.entries(catalogs).map(([kind, rows]) => [kind, {
    total: rows.length,
    missing: rows.filter(row => !row.image).length,
    photos: rows.filter(row => row.image?.kind === 'photo').length,
    illustrations: rows.filter(row => row.image?.kind === 'illustration').length,
    posters: rows.filter(row => row.image?.kind === 'poster').length,
  }]));
  return { summary, registeredImages: Object.keys(GUIDE_IMAGES).length, verifiedFiles: verifiedFiles.size, issues };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = auditMediaCoverage();
  console.log(JSON.stringify(report, null, 2));
  if (report.issues.length) process.exitCode = 1;
}
