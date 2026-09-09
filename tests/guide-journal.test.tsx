import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { guides, getGuideBySlug } from '../src/data/guides';
import { GUIDE_IMAGES, getGuideMedia, type GuideImage } from '../src/data/guide-media';
import { guideBlockText } from '../src/lib/guide-content';
import { getGuideMetadata } from '../src/lib/guide-metadata';
import { searchGuides } from '../src/lib/guide-search';
import { SITE_URL } from '../src/lib/seo';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { GuideExplorer, GuideImageCredits } = await import('../src/components/GuideExplorer');
afterEach(() => cleanup());

const moods = [
  { label: '去海边', slug: 'half-moon-bay-coastal-half-day-guide', heading: '风有点大，日程可以慢一点。', kind: 'photo' },
  { label: '走进树林', slug: 'reinhardt-redwood-first-walk-guide', heading: '把脚步放轻，把绿色看仔细。', kind: 'photo' },
  { label: '买点新鲜的', slug: 'bay-area-farmers-market-shopping-guide', heading: '让一袋新鲜食材，安排这周的餐桌。', kind: 'photo' },
  { label: '雨天也出门', slug: 'rainy-day-museum-family-guide', heading: '换一种天气，也换一种发现。', kind: 'photo' },
  { label: '铺开野餐垫', slug: 'presidio-picnic-day-guide', heading: '坐在草地上，也算认真过周末。', kind: 'photo' },
  { label: '带狗一起走', slug: 'bay-area-dog-park-first-outing-guide', heading: '出门前，先读懂这片公园的规则。', kind: 'photo' },
] as const;

type PhotoCredit = {
  key: string; src: string; author: string; license: string; licenseUrl: string;
  sourceUrl: string; originalUrl: string; captured: string; changes: string;
};
const photoCredits = JSON.parse(readFileSync(new URL('../public/guides/editorial/photo-credits.json', import.meta.url), 'utf8')) as PhotoCredit[];
const distinctAssets = ['guide-photo-assets', 'event-media-assets', 'art-media-assets'].flatMap(name =>
  JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8')) as (GuideImage & { key: string })[]);
const asset = (src: string) => {
  assert.match(src, /^\/guides\/[a-z0-9/.-]+$/);
  assert.equal(src.includes('..'), false, 'public asset paths must stay inside the guides directory');
  return readFileSync(new URL(`../public${src}`, import.meta.url));
};

// Read only the documented WebP container dimensions; no native image library or decoding needed.
const dimensions = (src: string): { width: number; height: number } => {
  const data = asset(src);
  assert.equal(data.toString('ascii', 0, 4), 'RIFF', src);
  assert.equal(data.toString('ascii', 8, 12), 'WEBP', src);
  assert.equal(data.readUInt32LE(4) + 8, data.length, `${src} must be a complete WebP file`);
  const kind = data.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 };
  if (kind === 'VP8L') {
    assert.equal(data[20], 0x2f, src);
    const bits = data.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  assert.equal(kind, 'VP8 ', `${src}: unsupported WebP header`);
  assert.deepEqual([...data.subarray(23, 26)], [0x9d, 0x01, 0x2a], src);
  return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
};

test('six weekend moods show the intended headline, published guide links and honest image labels', () => {
  const opened: string[] = [];
  const view = render(<MemoryRouter><GuideExplorer onOpenGuide={slug => opened.push(slug)} /></MemoryRouter>);
  assert.ok(view.getByRole('heading', { level: 2, name: '今天，想怎么过？' }));
  const picker = view.getByRole('group', { name: '选择周末灵感' });
  assert.equal(picker.querySelectorAll('button').length, moods.length);
  assert.equal(view.getByRole('button', { name: moods[0].label }).getAttribute('aria-pressed'), 'true');
  for (const mood of moods) {
    fireEvent.click(view.getByRole('button', { name: mood.label }));
    const guide = getGuideBySlug(mood.slug)!;
    assert.ok(guide, mood.slug);
    const cover = getGuideMedia(guide).cover;
    assert.equal(cover.kind, mood.kind);
    assert.equal(picker.querySelectorAll('[aria-pressed="true"]').length, 1);
    assert.equal(view.getByRole('button', { name: mood.label }).getAttribute('aria-pressed'), 'true');
    assert.ok(view.getByRole('heading', { level: 3, name: mood.heading }));
    assert.ok(view.getByText(guide.summary));
    const imageLink = view.getByRole('link', { name: `阅读${guide.title}`, exact: true });
    const readingLink = view.getByRole('link', { name: '读这篇攻略' });
    assert.equal(imageLink.getAttribute('href'), `/guides/${mood.slug}`);
    assert.equal(readingLink.getAttribute('href'), `/guides/${mood.slug}`);
    const image = view.getByRole('img', { name: cover.alt });
    assert.equal(image.getAttribute('src'), cover.src);
    assert.equal(image.getAttribute('srcset'), cover.srcSet);
    assert.equal(image.getAttribute('width'), String(cover.width));
    assert.equal(image.getAttribute('height'), String(cover.height));
    assert.ok(view.getByText(mood.kind === 'photo' ? '实景照片' : 'AI 原创插图'));
    fireEvent.click(readingLink);
    assert.equal(opened.at(-1), mood.slug);
  }
  assert.deepEqual(opened, moods.map(mood => mood.slug));
});

test('guide explorer keeps modifier and non-primary clicks native while ordinary clicks use the app callback', () => {
  const opened: string[] = [];
  const view = render(<MemoryRouter><GuideExplorer onOpenGuide={slug => opened.push(slug)} /></MemoryRouter>);
  const guide = getGuideBySlug(moods[0].slug)!;
  const links = [view.getByRole('link', { name: `阅读${guide.title}`, exact: true }), view.getByRole('link', { name: '读这篇攻略' })];
  const modifiers = [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }];
  for (const link of links) {
    for (const modifier of modifiers) {
      let appPreventedDefault: boolean | undefined;
      // Observe after React's root listener, then suppress jsdom's unimplemented real navigation.
      const observe = (event: Event) => { appPreventedDefault = event.defaultPrevented; event.preventDefault(); };
      document.addEventListener('click', observe, { once: true });
      fireEvent(link, new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...modifier }));
      assert.equal(appPreventedDefault, false, JSON.stringify(modifier));
      assert.deepEqual(opened, []);
      assert.equal(link.getAttribute('href'), `/guides/${guide.slug}`);
    }
  }
  fireEvent.click(links[0]);
  assert.deepEqual(opened, [guide.slug]);
});

test('all 36 guides and the complete media registry have usable local images and real 480-pixel responsive assets', () => {
  assert.equal(guides.length, 36);
  const checked = new Set<string>();
  const checkImage = (image: GuideImage) => {
    assert.ok(image, 'every published image key resolves to an asset');
    assert.ok(image.alt.trim().length >= 5, image.src);
    assert.ok(image.caption.trim().length >= 10, image.src);
    assert.ok(image.credit.trim().length >= 5, image.src);
    assert.ok(['photo', 'illustration', 'poster'].includes(image.kind));
    if (checked.has(image.src)) return;
    checked.add(image.src);
    assert.deepEqual(dimensions(image.src), { width: image.width, height: image.height });
    const candidates = image.srcSet!.split(',').map(candidate => candidate.trim().split(/\s+/));
    assert.equal(candidates.length, 2);
    const small = candidates.find(([, width]) => width === '480w');
    assert.ok(small, image.src);
    assert.equal(small[0], image.src.replace(/\.webp$/, '-small.webp'));
    const smallSize = dimensions(small[0]);
    assert.equal(smallSize.width, 480);
    assert.ok(Math.abs(smallSize.height - image.height * 480 / image.width) <= 1, image.src);
    assert.ok(candidates.some(([src, width]) => src === image.src && width === `${image.width}w`));
    if (image.kind === 'illustration') {
      assert.match(image.credit, /AI/);
      assert.match(image.caption, /插图|插画|示意/);
    } else {
      const credit = photoCredits.find(item => item.src === image.src);
      assert.ok(image.creditUrl, `${image.src} needs a source link`);
      assert.equal(new URL(image.creditUrl).protocol, 'https:');
      if (image.licenseUrl) assert.equal(new URL(image.licenseUrl).protocol, 'https:');
      if (credit) {
        for (const field of ['author', 'license', 'captured', 'changes'] as const) assert.ok(credit[field].trim(), `${image.src}: ${field}`);
        assert.equal(image.creditUrl, credit.sourceUrl);
        assert.equal(image.licenseUrl, credit.licenseUrl.replace(/^http:/, 'https:'));
        assert.ok(image.credit.includes(credit.author) && image.credit.includes(credit.license));
        assert.equal(new URL(credit.originalUrl).protocol, 'https:');
      } else {
        const record = distinctAssets.find(item => item.src === image.src);
        assert.ok(record, `${image.src} needs its original attribution record`);
        for (const field of ['kind', 'alt', 'caption', 'credit', 'creditUrl', 'licenseUrl'] as const) {
          assert.equal(image[field], record[field], `${image.src}: ${field} must retain the source record`);
        }
      }
    }
  };
  for (const guide of guides) {
    const media = getGuideMedia(guide);
    checkImage(media.cover);
    assert.ok(media.inline.length > 0, guide.slug);
    for (const inline of media.inline) {
      assert.ok(inline.afterHeading >= 1 && inline.afterHeading <= guide.blocks.filter(block => block.type === 'heading').length, guide.slug);
      checkImage(inline.image);
    }
  }
  // The monthly edition also registers assets which are not guide cover or inline images.
  for (const image of Object.values(GUIDE_IMAGES)) checkImage(image);
  assert.equal(checked.size, new Set(Object.values(GUIDE_IMAGES).map(image => image.src)).size);
});

test('all 36 guide covers use different source files and different actual image bytes', () => {
  assert.equal(guides.length, 36);
  const paths = new Set<string>();
  const fingerprints = new Map<string, string>();
  for (const guide of guides) {
    const { cover } = getGuideMedia(guide);
    assert.ok(cover, guide.slug);
    assert.equal(paths.has(cover.src), false, `${guide.slug} reuses a previous guide cover path`);
    paths.add(cover.src);
    const fingerprint = createHash('sha256').update(asset(cover.src)).digest('hex');
    assert.equal(fingerprints.has(fingerprint), false, `${guide.slug} duplicates the image bytes used by ${fingerprints.get(fingerprint)}`);
    fingerprints.set(fingerprint, guide.slug);
  }
  assert.equal(paths.size, 36);
  assert.equal(fingerprints.size, 36, 'renaming the same illustration must not satisfy the distinct-cover requirement');
});

test('the visible credits retain every photograph and poster source without inventing license links', () => {
  const view = render(<GuideImageCredits />);
  assert.ok(view.getByText('关于图片与授权'));
  const images = Object.values(GUIDE_IMAGES).filter(image => image.kind === 'photo' || image.kind === 'poster');
  const details = view.container.querySelector('details')!;
  details.open = true;
  assert.equal(details.querySelectorAll('li').length, images.length);
  for (const image of images) {
    const source = view.getByRole('link', { name: image.alt, exact: true });
    assert.equal(source.getAttribute('href'), image.creditUrl);
    const row = source.closest('li')!;
    assert.ok(row.textContent!.includes(image.credit));
    const license = [...row.querySelectorAll('a')].find(link => link.textContent!.includes('查看图片授权'));
    if (image.licenseUrl) {
      assert.ok(license, `${image.src} must show its recorded license`);
      assert.equal(license.getAttribute('href'), image.licenseUrl);
    } else assert.equal(license, undefined, `${image.src} must not fabricate permission from a source credit`);
    for (const link of row.querySelectorAll('a')) {
      assert.equal(link.getAttribute('target'), '_blank');
      assert.match(link.getAttribute('rel')!, /noopener/);
      assert.match(link.getAttribute('rel')!, /noreferrer/);
    }
  }
});

test('six new slugs occur once in data and explicit hosting routes, and all published routes stay in sync', () => {
  assert.equal(new Set(guides.map(guide => guide.slug)).size, guides.length);
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as { routes: { src?: string; dest?: string }[] };
  const guideRoutes = config.routes.filter(route => route.dest === '/guides/$1.html');
  assert.equal(guideRoutes.length, 1);
  const source = guideRoutes[0].src!;
  assert.ok(source.startsWith('^/guides/(') && source.endsWith(')/?$'));
  const routeSlugs = source.slice('^/guides/('.length, source.lastIndexOf(')')).split('|');
  assert.equal(new Set(routeSlugs).size, routeSlugs.length);
  assert.deepEqual([...routeSlugs].sort(), guides.map(guide => guide.slug).sort());
  for (const { slug } of moods) {
    assert.equal(guides.filter(guide => guide.slug === slug).length, 1);
    assert.equal(routeSlugs.filter(item => item === slug).length, 1);
    assert.equal(new RegExp(source).exec(`/guides/${slug}`)?.[1], slug);
    assert.equal(new RegExp(source).exec(`/guides/${slug}/`)?.[1], slug);
  }
  assert.equal(new RegExp(source).test('/guides/a-guide-that-was-never-published'), false);
});

test('every guide metadata uses its editorial cover while the two original posters remain preserved', () => {
  for (const guide of guides) {
    const cover = getGuideMedia(guide).cover;
    const metadata = getGuideMetadata(guide);
    assert.equal(metadata.image, cover.src);
    assert.match(metadata.image!, /^\/guides\/(editorial|distinct)\/[a-z0-9-]+\.webp$/);
    const article = metadata.structuredData!.find(item => item['@type'] === 'Article')!;
    assert.equal(article.image, SITE_URL + cover.src);
    assert.equal(article.headline, guide.title);
    assert.equal(article.dateModified, guide.updatedAt);
  }
  for (const slug of ['san-francisco-guide', 'san-jose-guide']) {
    const guide = getGuideBySlug(slug)!;
    assert.equal(guide.cover, `/guides/${slug}.png`);
    assert.notEqual(getGuideMetadata(guide).image, guide.cover);
    assert.deepEqual([...asset(guide.cover!).subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
});

test('route stop titles and instructions remain searchable even when absent from the route summary', () => {
  const examples = [
    { slug: 'half-moon-bay-coastal-half-day-guide', query: '不踩沙丘捷径' },
    { slug: 'reinhardt-redwood-first-walk-guide', query: '拍下入口名称与公告牌' },
    { slug: 'presidio-picnic-day-guide', query: '包装、餐具和外套' },
  ];
  for (const { slug, query } of examples) {
    const guide = getGuideBySlug(slug)!;
    const route = guide.blocks.find(block => block.type === 'route')!;
    assert.equal(route.text.includes(query), false, 'the regression phrase must really come from a route stop');
    const text = guideBlockText(route);
    assert.ok(text.includes(route.title) && text.includes(route.text));
    for (const stop of route.stops) {
      assert.ok(text.includes(stop.title) && text.includes(stop.text));
      if (stop.mapUrl) assert.equal(text.includes(stop.mapUrl), false, 'map URLs should not pollute the readable search passage');
    }
    const matches = searchGuides(guides, { query });
    assert.deepEqual(matches.map(result => result.guide.slug), [slug]);
    assert.ok(matches[0].snippet!.includes(query));
    assert.ok(matches[0].section);
  }
});
