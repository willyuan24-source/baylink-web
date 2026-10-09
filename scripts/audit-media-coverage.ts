import { getListingImage } from '../src/lib/offer-media';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guides } from '../src/data/guides';
import { CITY_CURRENT_UPDATES } from '../src/data/guides-city-exploration';
import { GUIDE_IMAGES, getGuideMedia, type GuideImage, type MediaRights } from '../src/data/guide-media';
import { MONTHLY_EVENTS, MONTHLY_PLACES } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';
import { currentOpenings } from '../src/data/local-discoveries';
import { currentRegionalBulletins } from '../src/data/october-2026-bulletins';
import { EVENT_CONTEXT_PHOTOS, isApprovedEventContextPhoto } from '../src/data/event-image-usage';
import { SCENE3D_POSTCARDS } from '../src/data/scene3d-postcards';
import legacyMediaKeys from './data/media-rights-baseline.json';

type CoverageRow = { id: string; image?: GuideImage; textOnly?: boolean };
const listing = (id: string, imageKey: string): CoverageRow => ({ id, image: getListingImage(imageKey), textOnly: !imageKey || GUIDE_IMAGES[imageKey]?.kind === 'illustration' });
const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url));

/** Every published catalog and the image each row shows: the pages a reader can reach. */
export function publishedMediaCatalogs(): Record<string, CoverageRow[]> {
  return {
    cityUpdates: CITY_CURRENT_UPDATES.map(update => listing(update.city, update.imageKey)),
    guides: guides.map(guide => ({ id: guide.slug, image: getGuideMedia(guide).cover })),
    events: MONTHLY_EVENTS.map(event => listing(event.id, event.imageKey)),
    offers: currentFreebies.map(offer => listing(offer.id, offer.imageKey)),
    openings: currentOpenings.map(shop => listing(shop.id, shop.imageKey)),
    bulletins: currentRegionalBulletins.map(item => listing(item.id, item.imageKey)),
    places: MONTHLY_PLACES.map(place => ({ id: place.id, image: GUIDE_IMAGES[place.imageKey] })),
  };
}

/**
 * Sources a page can show today: catalog covers, guide inline images and the slim home catalog
 * (src/data/generated/home-catalog.json), which adds its own context images. The image ladder makes 800/1200 rungs for
 * these; a registered image no page shows keeps the plain srcset until a page starts using it.
 */
export function publishedImageSources(): Set<string> {
  const sources = new Set<string>();
  for (const rows of Object.values(publishedMediaCatalogs())) for (const row of rows) if (row.image) sources.add(row.image.src);
  for (const guide of guides) for (const inline of getGuideMedia(guide).inline) if (inline.image) sources.add(inline.image.src);
  const homeCatalog = fileURLToPath(new URL('../src/data/generated/home-catalog.json', import.meta.url));
  if (existsSync(homeCatalog)) {
    const home = JSON.parse(readFileSync(homeCatalog, 'utf8')) as { images: Record<string, { src: string }>; guides: { media: { cover: { src: string } } }[] };
    for (const image of Object.values(home.images)) sources.add(image.src);
    for (const guide of home.guides) sources.add(guide.media.cover.src);
  }
  return sources;
}

const RIGHTS_BASES = new Set<MediaRights['basis']>(['official', 'permission', 'press-kit', 'promo-editorial', 'public-domain', 'cc', 'owner', 'ai']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
type MediaFacts = Pick<GuideImage, 'rights' | 'coverOk' | 'focal' | 'shotAt' | 'ownShot' | 'kind' | 'fullFrame'>;

/** Malformed media facts are always errors; a structured record must be complete enough to act on. */
export function mediaFactErrors(key: string, image: MediaFacts): string[] {
  const errors: string[] = [];
  const { rights } = image;
  if (rights && typeof rights === 'object') {
    if (!RIGHTS_BASES.has(rights.basis)) errors.push(`${key}: rights.basis must be one of ${[...RIGHTS_BASES].join(', ')}`);
    if (rights.evidenceUrl !== undefined && !/^https:\/\//.test(rights.evidenceUrl)) errors.push(`${key}: rights.evidenceUrl must be an https link`);
    if (!rights.evidenceUrl && !['owner', 'ai'].includes(rights.basis)) errors.push(`${key}: rights.basis ${rights.basis} needs an evidenceUrl`);
    if (rights.grantedAt !== undefined && !DATE.test(rights.grantedAt)) errors.push(`${key}: rights.grantedAt must be YYYY-MM-DD`);
    if (rights.promoAllowed !== undefined && typeof rights.promoAllowed !== 'boolean') errors.push(`${key}: rights.promoAllowed must be true or false`);
  }
  if (image.coverOk !== undefined && typeof image.coverOk !== 'boolean') errors.push(`${key}: coverOk must be true or false`);
  if (image.focal !== undefined && !(image.focal.length === 2 && image.focal.every(value => Number.isFinite(value) && value >= 0 && value <= 100))) errors.push(`${key}: focal must be [x, y] percentages`);
  if (image.focal !== undefined && (image.kind === 'poster' || image.fullFrame)) errors.push(`${key}: posters and full-frame art are letterboxed, never cropped, so they take no focal point`);
  if (image.shotAt !== undefined && !(DATE.test(image.shotAt) && image.ownShot)) errors.push(`${key}: shotAt is the YYYY-MM-DD capture date of an own shot (ownShot: true)`);
  if (image.ownShot && !image.shotAt) errors.push(`${key}: an own shot needs its shotAt capture date`);
  return errors;
}

/**
 * Images registered after 2026-10-09 (keys not in scripts/data/media-rights-baseline.json) need a structured rights
 * record and an explicit coverOk; older images only warn until CNT-MEDIA reviews them in media-rights-overlay.json.
 */
export function mediaRightsReview(images: Readonly<Record<string, MediaFacts>>, legacy: ReadonlySet<string>) {
  const issues: string[] = [];
  const prose: string[] = [];
  const unreviewed: string[] = [];
  for (const [key, image] of Object.entries(images)) {
    issues.push(...mediaFactErrors(key, image));
    const structured = !!image.rights && typeof image.rights === 'object';
    const missing = [!structured && 'a structured rights record', typeof image.coverOk !== 'boolean' && 'coverOk'].filter(Boolean);
    if (!missing.length) continue;
    if (legacy.has(key)) {
      if (!structured) prose.push(key);
      if (typeof image.coverOk !== 'boolean') unreviewed.push(key);
    } else {
      issues.push(`${key}: a new image needs ${missing.join(' and ')} (add them to its record or to src/data/media-rights-overlay.json)`);
    }
  }
  const sample = (keys: string[]) => keys.slice(0, 8).join(', ') + (keys.length > 8 ? ', …' : '');
  const warnings = [
    prose.length ? `${prose.length} older images have prose rights only (e.g. ${sample(prose)})` : '',
    unreviewed.length ? `${unreviewed.length} older images have no coverOk review (e.g. ${sample(unreviewed)})` : '',
  ].filter(Boolean);
  return { issues, warnings };
}

/** Audits the published editorial catalog and every registered responsive image. */
export function auditMediaCoverage() {
  const catalogs = publishedMediaCatalogs();
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
  const registered: Record<string, GuideImage> = { ...GUIDE_IMAGES, ...Object.fromEntries(SCENE3D_POSTCARDS.map(postcard => [postcard.key, postcard])) };
  for (const [key, image] of Object.entries(registered)) {
    if (!image.alt.trim() || !image.caption.trim() || !image.credit.trim()) issues.push(`${key}: missing description or provenance`);
    if (!(image.width > 0 && image.height > 0)) issues.push(`${key}: missing intrinsic dimensions`);
    checkFile(image.src, key);
    if (!image.srcSet) issues.push(`${key}: missing responsive image sources`);
    for (const candidate of image.srcSet?.split(',') || []) checkFile(candidate.trim().split(/\s+/)[0], `${key} srcSet`);
  }
  const rights = mediaRightsReview(registered, new Set(legacyMediaKeys));
  issues.push(...rights.issues);
  for (const [kind, rows] of Object.entries(catalogs)) {
    for (const row of rows) if (!row.image && !row.textOnly) issues.push(`${kind}/${row.id}: no registered image`);
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
    missing: rows.filter(row => !row.image && !row.textOnly).length,
    textOnly: rows.filter(row => row.textOnly).length,
    photos: rows.filter(row => row.image?.kind === 'photo').length,
    illustrations: rows.filter(row => row.image?.kind === 'illustration').length,
    posters: rows.filter(row => row.image?.kind === 'poster').length,
  }]));
  return { summary, registeredImages: Object.keys(GUIDE_IMAGES).length, verifiedFiles: verifiedFiles.size, issues, warnings: rights.warnings };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = auditMediaCoverage();
  console.log(JSON.stringify(report, null, 2));
  if (report.issues.length) process.exitCode = 1;
}
