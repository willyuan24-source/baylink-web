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
import { getImageProvenance } from '../src/lib/image-provenance';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, within } = await import('@testing-library/react');
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

const singleImageGuides: Record<string, string> = {
  'bay-area-birthday-perks': 'freebie-sephora-birthday',
  'bart-october-access-parking-update-2026': 'guide-bart-update-context',
  'bay-area-october-library-museum-pass-guide-2026': 'library',
  // Each October 7 route has one verified photograph of its actual destination.
  // Repeating the cover inside the same article would add no visual evidence.
  'east-bay-redwoods-green-friday-2026': 'redwoods',
  'half-moon-bay-autumn-coast-2026': 'coast',
  'alviso-autumn-wetlands-2026': 'autumn-alviso',
  'sonoma-autumn-art-plaza-2026': 'octnov-sonoma-plaza-context',
};

type PhotoCredit = {
  key: string; src: string; author: string; license: string; licenseUrl: string;
  sourceUrl: string; originalUrl: string; captured: string; changes: string;
};
const photoCredits = JSON.parse(readFileSync(new URL('../public/guides/editorial/photo-credits.json', import.meta.url), 'utf8')) as PhotoCredit[];
const distinctAssets = ['guide-photo-assets', 'event-media-assets', 'art-media-assets', 'deal-promo-assets', 'community-freebie-media', 'everyday-freebie-media', 'target-freebie-media', 'reading-route-media', 'attractions-sf-media', 'attractions-regions-media', 'attractions-expanded-inland-media', 'attractions-expanded-coast-media', 'fresh-september-media', 'september-update-media', 'october-media', 'community-editorial-media', 'community-opening-media', 'community-place-media', 'autumn-guide-media', 'content-coverage-media', 'daily-life-media', 'schools-media', 'schools-campus-media', 'september-refresh-media', 'shopping-media', 'city-roundup-media', 'city-roundup-extra-media-east', 'city-roundup-extra-media-south', 'city-roundup-extra-media-north', 'official-offer-media-2026-10', 'octnov-2026-media', 'octnov-2026-extra-media', 'octnov-2026-event-media', 'federal-pd-media', 'official-event-media'].flatMap(name =>
  (() => { const records = JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8')); return (Array.isArray(records) ? records : Object.entries(records).map(([key, value]) => ({ key, ...(value as object) }))) as (GuideImage & { key: string })[]; })());
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
    assert.ok(view.getByText(mood.kind === 'photo' ? getImageProvenance(cover) : 'AI 原创插图'));
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

test('all published guides and the complete media registry have usable local images and accurately sized responsive assets', () => {
  assert.ok(guides.length >= 37);
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
    // The D8 ladder (src/data/image-ladder.ts): 480 `-small`, an optional `-800`, then the original or its `-1200`.
    const candidates = image.srcSet!.split(',').map(candidate => candidate.trim().split(/\s+/));
    assert.ok(candidates.length >= 1 && candidates.length <= 3, image.src);
    const smallWidth = Math.min(480, image.width);
    const small = candidates.find(([, width]) => width === `${smallWidth}w`);
    assert.ok(small, image.src);
    assert.equal(small[0], image.width <= 480 ? image.src : image.src.replace(/\.webp$/, '-small.webp'));
    for (const [file, descriptor] of candidates) {
      assert.ok([image.src, ...['-small', '-800', '-1200'].map(rung => image.src.replace(/\.webp$/, `${rung}.webp`))].includes(file), `${image.src}: ${file}`);
      const size = dimensions(file);
      assert.equal(`${size.width}w`, descriptor, file);
      assert.ok(size.width <= image.width, `${file} is never upscaled`);
      assert.ok(Math.abs(size.height - image.height * size.width / image.width) <= 1, `${file} keeps the original framing`);
    }
    const largest = candidates.at(-1)!;
    assert.ok(largest[0] === image.src ? largest[1] === `${image.width}w` : largest[0] === image.src.replace(/\.webp$/, '-1200.webp'), image.src);
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
    if (Object.hasOwn(singleImageGuides, guide.slug)) {
      // These guides have one matching photograph/poster; do not repeat it as an inline filler.
      assert.equal(media.cover, GUIDE_IMAGES[singleImageGuides[guide.slug]]);
      assert.notEqual(media.cover.kind, 'illustration');
      assert.deepEqual(media.inline, []);
    } else assert.ok(media.inline.length > 0, guide.slug);
    for (const inline of media.inline) {
      assert.ok(inline.afterHeading >= 1 && inline.afterHeading <= guide.blocks.filter(block => block.type === 'heading').length, guide.slug);
      checkImage(inline.image);
    }
  }
  // The monthly edition also registers assets which are not guide cover or inline images.
  for (const image of Object.values(GUIDE_IMAGES)) checkImage(image);
  assert.equal(checked.size, new Set(Object.values(GUIDE_IMAGES).map(image => image.src)).size);
});

test('reviewed small October-November source images retain their real pixels without fabricated 480w variants', () => {
  // These are exact reviewed source files, not a blanket exception for new low-resolution media.
  const reviewed = [
    { key: 'octnov-petaluma-instruments', width: 180, height: 180, kind: 'poster', source: 'https://events.sonomalibrary.org/event/ancestral-sounds-mesoamerica-kids-117141' },
    { key: 'octnov-healdsburg-tech', width: 220, height: 180, kind: 'poster', source: 'https://events.sonomalibrary.org/event/one-one-tech-help-110761' },
    { key: 'octnov-los-altos-context', width: 330, height: 210, kind: 'photo', source: 'https://commons.wikimedia.org/wiki/File:Los_Altos_Main_Street_2.jpg' },
  ] as const;
  for (const expected of reviewed) {
    const image = GUIDE_IMAGES[expected.key];
    assert.ok(image, expected.key);
    assert.deepEqual(dimensions(image.src), { width: expected.width, height: expected.height }, expected.key);
    assert.equal(image.width, expected.width, expected.key);
    assert.equal(image.height, expected.height, expected.key);
    assert.equal(image.kind, expected.kind, expected.key);
    assert.equal(image.creditUrl, expected.source, expected.key);
    assert.equal(image.srcSet, `${image.src} ${expected.width}w`, expected.key);
    if (expected.kind === 'poster') assert.equal(image.fullFrame, true, expected.key);
  }
});

const firstVisitCoverReuse = new Set([
  'bay-area-useful-apps-platforms-guide',
  'bay-area-101-city-exploration-living-guide',
  'bay-area-city-utilities-internet-phone-directory',
  'bay-area-visitor-coast-redwoods-return-plan-2026',
  'sf-visitor-luggage-restrooms-lost-property-2026',
  'sf-visitor-meals-markets-dietary-booking-2026',
  'bay-area-first-doctor-insurance-network-guide',
  'bay-area-k12-midyear-enrollment-guide',
  'bay-area-phone-bank-first-bill-guide',
  'bay-area-household-bills-annual-review-2026',
  'bay-area-build-recurring-community-routine-2026',
  'bay-area-borrow-tools-repair-before-buying-2026',
  'sf-first-72-hours-car-free-october-2026', 'bay-area-airport-first-night-decision-october-2026',
  'bay-area-first-7-30-days-action-plan-october-2026', 'bay-area-cross-bay-commute-home-base-october-2026',
  'sf-first-visit-tickets-waterfront-october-2026', 'sf-free-culture-eligibility-october-2026',
  'sf-family-rain-fog-car-free-october-2026',
  // These perks guides may share their specifically sourced product imagery.
  // Their original, dated social posters are separate downloadable artwork.
  'bay-area-birthday-perks',
  'bay-area-everyday-free-perks',
]);
const officialPerksCoverReuse = new Set([
  'bay-area-retail-freebies-family-deals',
  'bay-area-freebies-deals-2026-10',
  'bay-area-freebies-deals-2026-11',
]);
const factualReferenceCoverReuse: Record<string, { key: string; source: string; caption: RegExp }> = {
  // Reviewed October 7: these follow-up routes revisit the exact same named places
  // as the existing first-visit guides. Their dated photographs do not certify live conditions.
  'east-bay-redwoods-green-friday-2026': {
    key: 'redwoods',
    source: 'https://commons.wikimedia.org/wiki/File:Reinhardt_Redwood_Regional_Park.jpg',
    caption: /Reinhardt Redwood Regional Park.*2026.*不表示某段步道当前开放/,
  },
  'half-moon-bay-autumn-coast-2026': {
    key: 'coast',
    source: 'https://commons.wikimedia.org/wiki/File:Half_Moon_Bay_State_Beach_from_bluff.jpg',
    caption: /Half Moon Bay State Beach.*2014.*当天开放情况以公园公告为准/,
  },
  'alviso-autumn-wetlands-2026': {
    key: 'autumn-alviso',
    source: 'https://commons.wikimedia.org/wiki/File:Alviso_Marina_County_Park_View_At_Sunset.jpg',
    caption: /Alviso Marina County Park.*2013.*资料照片.*不代表当前步道畅通/,
  },
  'bay-area-birthday-perks': {
    key: 'freebie-sephora-birthday',
    source: 'https://newsroom.sephora.com/sephora-unwraps-another-year-of-beauty-with-its-2026-beauty-insider-birthday-gift-offerings/',
    caption: /2026.*生日礼.*不代表九月门店库存/,
  },
  'bay-area-everyday-free-perks': {
    key: 'library',
    source: 'https://commons.wikimedia.org/wiki/File:San_Francisco_Public_Library_-_Main_Branch,_6th_floor,_looking_straight.jpg',
    caption: /旧金山公共图书馆总馆.*2013.*资料照片/,
  },
  'bay-area-october-library-museum-pass-guide-2026': {
    key: 'library',
    source: 'https://commons.wikimedia.org/wiki/File:San_Francisco_Public_Library_-_Main_Branch,_6th_floor,_looking_straight.jpg',
    caption: /旧金山公共图书馆总馆.*2013.*资料照片/,
  },
  'sf-free-culture-eligibility-october-2026': {
    key: 'ggp-conservatory',
    source: 'https://commons.wikimedia.org/wiki/File:Exterior_of_the_Conservatory_of_Flowers_1_2016-11-13.jpg',
    caption: /Conservatory of Flowers.*2016.*入场条件不同/,
  },
  'bart-october-access-parking-update-2026': {
    key: 'guide-bart-update-context',
    source: 'https://commons.wikimedia.org/wiki/File:Orange_Line_BART_Fleet_of_the_Future_Train_at_Coliseum_station.jpg',
    caption: /Coliseum.*2024.*不是 Mission 电梯、West Oakland 停车场或 Pleasant Hill 施工现场/,
  },
};
// Reviewed October 5: these dated roundups deliberately use labeled context art.
// Pin each exact source path; a new guide or an unrelated replacement still fails.
// The Ferry Building photograph is the actual market venue, not the 2026 event.
const novemberCoverReuse: Record<string, string> = {
  'east-bay-november-nature-programs-2026': '/guides/november/autumn-community.webp',
  'san-francisco-autumn-food-markets-2026': '/guides/distinct/ferry-market.webp',
  'peninsula-south-bay-november-nature-walks-2026': '/guides/community-2026/garden-walk.webp',
  'peninsula-south-bay-autumn-farmers-markets-2026': '/guides/november/autumn-community.webp',
  'north-bay-markets-nature-culture-through-november-15-2026': '/guides/november/autumn-community.webp',
  'bay-area-november-first-half-planner-2026': '/guides/editorial/weekend-illustration.webp',
  'bay-area-november-resident-dates-2026': '/guides/editorial/everyday-illustration.webp',
};

test('guide covers remain distinct except specifically reviewed reference photographs and illustrations', () => {
  assert.ok(guides.length >= 37);
  const paths = new Set<string>();
  const fingerprints = new Map<string, string>();
  for (const guide of guides) {
    const { cover } = getGuideMedia(guide);
    assert.ok(cover, guide.slug);
    if (Object.hasOwn(factualReferenceCoverReuse, guide.slug)) {
      const expected = factualReferenceCoverReuse[guide.slug];
      assert.equal(cover, GUIDE_IMAGES[expected.key]);
      assert.notEqual(cover.kind, 'illustration');
      assert.equal(cover.creditUrl, expected.source);
      assert.match(cover.caption, expected.caption);
      continue;
    }
    if (officialPerksCoverReuse.has(guide.slug)) {
      assert.equal(cover.src, '/guides/official-offers/lowes-firefighting-plane.webp');
      assert.equal(cover, GUIDE_IMAGES['official-lowes-firefighting-plane-2026']);
      assert.equal(cover.kind, 'photo');
      assert.equal(cover.creditUrl, 'https://www.lowes.com/events/register/firefighting-plane');
      assert.match(cover.caption, /2026 年 10 月 17 日/);
      assert.match(cover.caption, /不是活动当天/);
      continue;
    }
    if (Object.hasOwn(novemberCoverReuse, guide.slug)) {
      assert.equal(cover.src, novemberCoverReuse[guide.slug], `${guide.slug} must keep its reviewed context image`);
      assert.match(cover.caption, /不代表|不是/, `${guide.slug} must disclose that the image is not the event`);
      continue;
    }
    if (firstVisitCoverReuse.has(guide.slug)) continue;
    assert.equal(paths.has(cover.src), false, `${guide.slug} reuses a previous guide cover path`);
    paths.add(cover.src);
    const fingerprint = createHash('sha256').update(asset(cover.src)).digest('hex');
    assert.equal(fingerprints.has(fingerprint), false, `${guide.slug} duplicates the image bytes used by ${fingerprints.get(fingerprint)}`);
    fingerprints.set(fingerprint, guide.slug);
  }
  const distinctCount = guides.filter(guide => !firstVisitCoverReuse.has(guide.slug) && !officialPerksCoverReuse.has(guide.slug) && !Object.hasOwn(factualReferenceCoverReuse, guide.slug) && !Object.hasOwn(novemberCoverReuse, guide.slug)).length;
  assert.equal(paths.size, distinctCount);
  assert.equal(fingerprints.size, distinctCount, 'renaming the same illustration must not satisfy the distinct-cover requirement');
});

test('the visible credits retain every photograph and poster source without inventing license links', () => {
  const view = render(<GuideImageCredits />);
  assert.ok(view.getByText('关于图片与授权'));
  const images = [...new Map(Object.values(GUIDE_IMAGES)
    .filter(image => image.kind === 'photo' || image.kind === 'poster')
    .map(image => [JSON.stringify([image.src, image.creditUrl, image.credit, image.licenseUrl]), image])).values()];
  const details = view.container.querySelector('details')!;
  details.open = true;
  const rows = details.querySelectorAll('li');
  assert.equal(rows.length, images.length);
  for (const [index, image] of images.entries()) {
    const row = rows[index];
    const source = within(row).getByRole('link', { name: image.alt, exact: true });
    assert.equal(source.getAttribute('href'), image.creditUrl);
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
  assert.ok(guideRoutes.length >= 1);
  const sources = guideRoutes.map(route => route.src!);
  const routeSlugs = sources.flatMap(source => {
    assert.ok(source.length <= 4096);
    assert.ok(source.startsWith('^/guides/(') && source.endsWith(')/?$'));
    return source.slice('^/guides/('.length, source.lastIndexOf(')')).split('|');
  });
  assert.equal(new Set(routeSlugs).size, routeSlugs.length);
  assert.deepEqual([...routeSlugs].sort(), guides.map(guide => guide.slug).sort());
  for (const { slug } of moods) {
    assert.equal(guides.filter(guide => guide.slug === slug).length, 1);
    assert.equal(routeSlugs.filter(item => item === slug).length, 1);
    for (const path of [`/guides/${slug}`, `/guides/${slug}/`]) {
      const matches = sources.map(source => new RegExp(source).exec(path)).filter(match => match !== null);
      assert.equal(matches.length, 1);
      assert.equal(matches[0][1], slug);
    }
  }
  assert.equal(sources.some(source => new RegExp(source).test('/guides/a-guide-that-was-never-published')), false);
});

test('guide social metadata uses a branded share card while article photos and original posters remain preserved', () => {
  for (const guide of guides) {
    const cover = getGuideMedia(guide).cover;
    const metadata = getGuideMetadata(guide);
    assert.equal(metadata.image, `/share-cards/guide-${guide.slug}.png`);
    const article = metadata.structuredData!.find(item => item['@type'] === 'Article')!;
    assert.equal(article.image, SITE_URL + cover.src);
    assert.equal(article.headline, guide.title);
    assert.equal(article.dateModified, guide.updatedAt);
  }
  for (const slug of ['san-francisco-guide', 'san-jose-guide']) {
    const guide = getGuideBySlug(slug)!;
    // The original posters, re-encoded once from PNG to WebP at their own 1055 × 1491 size (WEB-IMAGES).
    assert.equal(guide.cover, `/guides/${slug}.webp`);
    assert.notEqual(getGuideMetadata(guide).image, guide.cover);
    assert.deepEqual(dimensions(guide.cover!), { width: 1055, height: 1491 });
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
