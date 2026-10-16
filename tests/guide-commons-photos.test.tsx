import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

// CNT-MEDIA-4 (owner approval in chat 2026-10-16): the ten Wikimedia Commons photos of gpt/out-1016c/guide-image-candidates.md
// on eight 办事 / 长辈 guides. Each shows its author, licence and licence link; the two outside California (an SSA office in
// New York, HHS in Washington, D.C.) are labelled 示意图 and are never a list cover. In a pilot guide the photos stand outside
// the step folds, so a reader sees them without opening 展开原文与来源.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/guides', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { renderToStaticMarkup } = await import('react-dom/server');
const { StaticRouter } = await import('react-router');
const { GuideDetail } = await import('../src/components/GuideDetail');
const { getGuideBySlug, guides } = await import('../src/data/guides');
const { GUIDE_EXTRA_INLINE, GUIDE_IMAGES, getGuideMedia } = await import('../src/data/guide-media');
const { guideInlineImages } = await import('../src/features/guides/guide-data');
const { guideEditorialAnswer } = await import('../src/data/guide-editorial/answers');
const { peekGuide } = await import('../src/features/guides/guide-store');
const { getCover } = await import('../src/lib/cover');
const { getImageProvenance } = await import('../src/lib/image-provenance');
const { loadLocale, setLocale, translateEditorial, translateText } = await import('../src/i18n/locale');
const { guideBodyStretches } = await import('./support/guide-rhythm');
const records = JSON.parse(readFileSync(new URL('../src/data/guide-commons-photos-2026-10.json', import.meta.url), 'utf8')) as {
  key: string; src: string; width: number; height: number; kind: string; focal: number[]; alt: string; caption: string; credit: string;
  creditUrl: string; licenseUrl: string; photoDate: string; rights: { basis: string; evidenceUrl: string; scope: string };
}[];
const downloads = JSON.parse(readFileSync(new URL('../scripts/data/guide-commons-photos-downloads.json', import.meta.url), 'utf8')) as Record<string, {
  title: string; author: string; license: string; originalUrl: string; retrievedAt: string; bytes: number; sha256: string; sha1: string; changes: string;
}>;
const overlay = JSON.parse(readFileSync(new URL('../src/data/media-rights-overlay.json', import.meta.url), 'utf8')) as Record<string, { coverOk?: boolean }>;

// author, licence and licence link exactly as the approved list gives them
const APPROVED: Record<string, [string, string, string]> = {
  'commons-dmv-sacramento-hq': ['Coolcaesar', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'],
  'commons-dmv-eureka-office': ['Ellin Beltz', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0/'],
  'commons-ssa-corning-ny': ['J. Passepartout', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'],
  'commons-dhcs-sacramento': ['Sarbjit Bahga', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'],
  'commons-hhs-washington-dc': ['Gunnar Klack', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'],
  'commons-clipper-embarcadero': ['Fullmetal2887', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'],
  'commons-nema-sf': ['Dead.rabbit', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'],
  'commons-ggp-senior-center-front': ['Daderot', 'CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'],
  'commons-ggp-senior-center-side': ['Pi.1415926535', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'],
  'commons-chinatown-ywca-chsa': ['Gary Stevens', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0/'],
};
const ILLUSTRATIVE = new Set(['commons-ssa-corning-ny', 'commons-hhs-washington-dc']);
const noop = () => {};
const render = (slug: string) => {
  const html = renderToStaticMarkup(<StaticRouter location={`/guides/${slug}`}><GuideDetail slug={slug} record={peekGuide(slug)} today="2026-10-16" onOpenGuide={noop} onNavigate={noop} onOpenPost={noop} /></StaticRouter>);
  return new JSDOM(html).window.document.querySelector('article')!;
};
const webpSize = (src: string) => {
  const data = readFileSync(new URL(`../public${src}`, import.meta.url));
  assert.equal(data.toString('ascii', 8, 12), 'WEBP', src);
  const kind = data.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 };
  assert.equal(kind, 'VP8 ', src);
  return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
};

test('the ten approved Commons photos keep their author, licence, licence link, download record and an honest caption', () => {
  assert.deepEqual(records.map(record => record.key).sort(), Object.keys(APPROVED).sort());
  assert.deepEqual(Object.keys(downloads), records.map(record => record.key), 'one download record per photo, in registry order');
  for (const record of records) {
    const [author, licence, licenseUrl] = APPROVED[record.key];
    const image = GUIDE_IMAGES[record.key];
    assert.ok(image, record.key);
    assert.equal(image.kind, 'photo');
    assert.equal(image.licenseUrl, licenseUrl, `${record.key}: licence link as approved`);
    assert.equal(image.credit, `${author} / ${record.key === 'commons-chinatown-ywca-chsa' ? 'Flickr，经 Wikimedia Commons' : 'Wikimedia Commons'} · ${licence} · 已缩放压缩，按版面裁切`);
    assert.match(image.creditUrl!, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    assert.deepEqual(image.rights, { basis: 'cc', evidenceUrl: image.creditUrl, scope: 'guide context photo; author, licence and changes credited where shown' });
    assert.match(record.photoDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(image.caption.includes(`${record.photoDate.slice(0, 4)} 年`), `${record.key}: the caption dates the photo`);
    assert.match(image.caption, /不是|不表示|没有核对|无关/, `${record.key}: the caption says what the photo is not`);
    assert.equal(getImageProvenance(image).startsWith('官方图'), false, 'a Commons photo is never 官方图');
    const size = webpSize(record.src);
    assert.deepEqual(size, { width: record.width, height: record.height }, record.key);
    assert.ok(record.width <= (record.height > record.width ? 800 : 1280), `${record.key}: resized, never upscaled past the cap`);
    const download = downloads[record.key];
    assert.equal(download.author, author);
    assert.equal(download.license, licence);
    assert.match(download.originalUrl, /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//);
    assert.match(download.retrievedAt, /^2026-10-16T\d{2}:\d{2}:\d{2}-07:00$/);
    assert.match(download.sha256, /^[0-9a-f]{64}$/);
    assert.match(download.sha1, /^[0-9a-f]{40}$/);
    assert.equal(`https://commons.wikimedia.org/wiki/${download.title.replace(/ /g, '_')}`, image.creditUrl, `${record.key}: the title is the Commons file page`);
    assert.equal(overlay[record.key]?.coverOk, !ILLUSTRATIVE.has(record.key), `${record.key}: coverOk`);
  }
});

test('the SSA office in New York and HHS in Washington, D.C. are labelled 示意图 and never a list cover', async () => {
  for (const key of ILLUSTRATIVE) {
    const image = GUIDE_IMAGES[key];
    assert.ok(image.caption.startsWith('示意图：') && image.alt.startsWith('示意图：'), key);
    assert.equal(image.coverOk, false, key);
    assert.deepEqual(guides.filter(guide => getGuideMedia(guide).cover.src === image.src).map(guide => guide.slug), [], `${key} is no guide's cover`);
    const cover = getCover({ kind: 'guide', id: 'any', imageKey: key }, { images: GUIDE_IMAGES, today: '2026-10-16' });
    assert.equal(cover.tier, 'type', `${key}: a cover resolver vetoes it`);
  }
  await loadLocale('en');
  for (const key of ILLUSTRATIVE) {
    const translated = translateEditorial({ image: GUIDE_IMAGES[key] }, 'en').image;
    assert.match(translated.caption, /^Illustrative photo: /);
    assert.match(translated.alt, /^Illustrative photo: /);
  }
  await loadLocale('zh-Hant');
  for (const key of ILLUSTRATIVE) assert.match(translateText(GUIDE_IMAGES[key].caption, 'zh-Hant'), /^示意圖：/);
});

test('their text is complete in English, and no guide takes one as its list cover', async () => {
  await loadLocale('en');
  for (const record of records) {
    const translated = translateEditorial({ image: GUIDE_IMAGES[record.key] }, 'en').image;
    assert.doesNotMatch(JSON.stringify([translated.alt, translated.caption, translated.credit]), /\p{Script=Han}/u, record.key);
    assert.match(translated.credit, /resized and compressed; cropped to fit the layout$/);
  }
  // These pilot guides' coded covers print the guide's first answer ("先打 800-510-2020"); a photo cover would drop it.
  assert.deepEqual(guides.filter(guide => getGuideMedia(guide).cover.src.startsWith('/guides/commons/')).map(guide => guide.slug), []);
  for (const slug of Object.keys(GUIDE_EXTRA_INLINE)) assert.ok(guideEditorialAnswer(slug, 'zh-Hans'), `${slug} keeps its answer cover`);
});

test('each guide shows its photos in the step they belong to, outside the step fold, with credit and licence link', async () => {
  await setLocale('zh-Hans', false);
  for (const [slug, placed] of Object.entries(GUIDE_EXTRA_INLINE)) {
    const guide = getGuideBySlug(slug)!;
    assert.ok(guide, slug);
    const inline = guideInlineImages(guide);
    for (const [afterHeading, key] of placed) {
      assert.ok(inline.some(item => item.afterHeading === afterHeading && item.image === GUIDE_IMAGES[key]), `${slug}: ${key} after heading ${afterHeading}`);
    }
    const article = render(slug);
    const steps = [...article.querySelectorAll('section.gd-step')];
    for (const [afterHeading, key] of placed) {
      const image = GUIDE_IMAGES[key];
      const img = [...article.querySelectorAll('img.guide-figure-image')].find(element => element.getAttribute('src') === image.src);
      assert.ok(img, `${slug}: ${key} is on the page`);
      assert.equal(img.closest('details'), null, `${slug}: ${key} is not folded`);
      assert.equal(img.closest('section.gd-step'), steps[afterHeading - 1], `${slug}: ${key} stands in step ${afterHeading}`);
      const figure = img.closest('figure')!;
      const links = [...figure.querySelectorAll('figcaption a')].map(link => link.getAttribute('href'));
      assert.ok(links.includes(image.creditUrl!) && links.includes(image.licenseUrl!), `${slug}: ${key} links its source and licence`);
      assert.ok(figure.textContent!.includes(image.credit), `${slug}: ${key} names its author and licence`);
    }
    // Every photo the page shows is in 本页图片来源 once.
    const credits = article.querySelector('.gd-credits')!;
    for (const [, key] of placed) assert.equal([...credits.querySelectorAll('li')].filter(li => li.textContent!.includes(GUIDE_IMAGES[key].credit)).length, 1, `${slug}: ${key} credited once`);
  }
});

test('a tall photo is cut to 4:5 around its focus in the article, and the guides with photos stay within the image rhythm', async () => {
  await setLocale('zh-Hans', false);
  const article = render('bay-area-rental-scam-guide');
  const img = [...article.querySelectorAll('img.guide-figure-image')].find(element => element.getAttribute('src') === GUIDE_IMAGES['commons-nema-sf'].src)!;
  assert.equal(img.hasAttribute('data-portrait'), true);
  assert.match(img.getAttribute('style') ?? '', /object-position:\s*50% 42%/);
  const css = readFileSync(new URL('../src/components/guide-visuals.css', import.meta.url), 'utf8');
  assert.match(css, /\.guide-figure--inline \.guide-figure-image\[data-portrait\] \{ aspect-ratio:4\/5; max-height:min\(72vh,620px\); object-fit:cover; \}/);
  for (const slug of ['bay-area-social-security-retirement-preparation-guide', 'bay-area-medicare-hicap-medi-cal-guide', 'california-driver-license-id-preparation-guide', 'bay-area-chinese-senior-services-referral-guide']) {
    const { longest } = guideBodyStretches(render(slug));
    assert.ok(longest <= 2.5, `${slug}: ${longest} screens without a picture`);
  }
});
