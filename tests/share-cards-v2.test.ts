import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { loadLocale, translateText } from '../src/i18n/locale';
import { localDiscoveries } from '../src/data/local-discoveries';
import { guides } from '../src/data/guides';
import { GUIDE_IMAGES, type GuideImage } from '../src/data/guide-media';
import { LIFE_TOOLS } from '../src/data/tool-catalog';
import { EVENT_CONTEXT_PHOTOS } from '../src/data/event-image-usage';
import { BAYLINK_TAGLINE, cardPhoto, discoveryCardModel, guideCardModel, hubCardModel, HUB_CARD_NAMES, OFFICIAL_IMAGE_ON_OWN_EVENT_CARD, promoPhoto, type CardLocale } from '../src/lib/share-card-model';
import { CARD_INK, cardLines, DEFAULT_TAGLINE, partsLine, PHOTO_BAND, renderHubCardSvg, renderShareCardSvg } from '../src/lib/share-card-svg';
import { localizedSocialImage } from '../src/lib/seo';
import { shareCardPath } from '../src/lib/editorial-share';
import { simplifiedOnlyCharacters } from '../scripts/i18n-html-check.mjs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocalizedHost } from '../src/i18n/host';
import { enableUsEnglishTimes, setLocale } from '../src/i18n/locale';
import { hasTwentyFourHourOrIso } from '../src/lib/english-times';

const require = createRequire(import.meta.url);
const simplifiedOnly = simplifiedOnlyCharacters(require('opencc-js/dict/STCharacters').default, require('opencc-js/dict/TSCharacters').default);
const HAN = /[㐀-鿿]/;
const tr = (locale: CardLocale) => (text: string) => locale === 'zh-Hans' ? text : translateText(text, locale);
const texts = (model: object) => Object.entries(model).filter(([key]) => key !== 'photo').flatMap(([, value]) => Array.isArray(value) ? value.flatMap(item => typeof item === 'string' ? [item] : Object.values(item as object)) : [value]).filter((value): value is string => typeof value === 'string');

test('I18N-SEO-05: a photo fronts a share card only when its rights allow promotion; never AI art', () => {
  const photo: GuideImage = { src: '/x.webp', alt: '', caption: '2025', credit: 'Organiser', kind: 'photo', width: 1200, height: 800 };
  assert.equal(promoPhoto(undefined), undefined);
  assert.equal(promoPhoto(photo), undefined, 'no rights record: coverage only, not promotion');
  assert.equal(promoPhoto({ ...photo, rights: { basis: 'press-kit', promoAllowed: false } }), undefined);
  assert.equal(promoPhoto({ ...photo, rights: { basis: 'public-domain' } }), undefined, 'public domain is not a promotion clearance (DVIDS)');
  assert.ok(promoPhoto({ ...photo, rights: { basis: 'permission', promoAllowed: true } }));
  assert.ok(promoPhoto({ ...photo, ownShot: true }), 'BAYLINK’s own photograph');
  assert.equal(promoPhoto({ ...photo, kind: 'illustration', rights: { basis: 'owner', promoAllowed: true } }), undefined, 'AI art never fronts a card');
  assert.equal(promoPhoto(GUIDE_IMAGES['dvids-blue-angels-sffw-2024']), undefined, 'the DVIDS Fleet Week photo stays off promotion');
});

test('I18N-SEO-05: every card says its listing in the card’s own language (English has no Chinese, 繁體 no Simplified)', async () => {
  await Promise.all([loadLocale('en'), loadLocale('zh-Hant')]);
  const today = '2026-10-12';
  const problems: string[] = [];
  for (const locale of ['en', 'zh-Hant'] as CardLocale[]) {
    const models = [
      ...localDiscoveries.map(item => ({ where: `${item.kind}`, model: discoveryCardModel(item, locale, today, tr(locale)) })),
      ...guides.map(guide => ({ where: guide.slug, model: guideCardModel(guide, locale, tr(locale)) })),
      ...HUB_CARD_NAMES.map(name => ({ where: `hub ${name}`, model: hubCardModel(name, locale, tr(locale), { weekend: [locale === 'en' ? { date: 'Sat 10/17', title: 'Half Moon Bay Pumpkin Festival', city: 'Half Moon Bay' } : { date: tr(locale)('周六 10/17'), title: tr(locale)('Half Moon Bay 南瓜节'), city: 'Half Moon Bay' }], range: '10/17–18', tools: LIFE_TOOLS.map(tool => tool.title), guideCount: guides.length }) })),
    ];
    for (const { where, model } of models) for (const text of texts(model)) {
      if (locale === 'en' && HAN.test(text)) problems.push(`en ${where}: ${text.slice(0, 50)}`);
      if (locale === 'zh-Hant' && [...text].some(character => simplifiedOnly.has(character))) problems.push(`zh-Hant ${where}: ${text.slice(0, 50)}`);
    }
  }
  assert.deepEqual(problems.slice(0, 15), [], `${problems.length} card texts in the wrong language`);
});

test('a link to the weekend card opens the reader’s language edition', async () => {
  const link = (href: string) => renderToStaticMarkup(createElement(LocalizedHost, { tag: 'a', hostProps: { href, children: 'card' }, staticChildren: false }));
  for (const [locale, prefix] of [['zh-Hans', ''], ['zh-Hant', 'zh-Hant/'], ['en', 'en/']] as const) {
    await setLocale(locale, false);
    assert.match(link('/weekly/all-2026-10-12.png'), new RegExp(`href="/weekly/${prefix}all-2026-10-12\\.png"`));
    assert.match(link('/weekly/sf.png'), new RegExp(`href="/weekly/${prefix}sf\\.png"`));
  }
  await setLocale('zh-Hans', false);
});

test('share cards and hub cards are 1200 × 630 SVGs with the QR in the bottom-right corner; each language has its own image', () => {
  const [event] = localDiscoveries;
  const card = renderShareCardSvg(discoveryCardModel(event, 'zh-Hans', '2026-10-12', text => text), { path: 'M0 0h1v1h-1z', size: 21 }, 'data:,');
  const hub = renderHubCardSvg(hubCardModel('home', 'zh-Hans', text => text, { weekend: [], range: '', tools: [], guideCount: 141 }), { path: 'M0 0h1v1h-1z', size: 21 }, 'data:,');
  for (const svg of [card, hub]) {
    assert.match(svg, /viewBox="0 0 1200 630"/);
    const [, x, y] = /<svg x="(\d+)" y="(\d+)" width="\d+" height="\d+" viewBox="-4 -4 29 29"/.exec(svg)!;
    assert.ok(Number(x) >= 900 && Number(y) >= 380, 'the verifier decodes the bottom-right region');
  }
  const path = shareCardPath({ kind: 'event', id: 'a' });
  assert.equal(localizedSocialImage(path, 'zh_CN'), path);
  assert.equal(localizedSocialImage(path, 'en_US'), 'https://www.baylink.us/share-cards/en/event-a.png');
  assert.equal(localizedSocialImage(path, 'zh_TW'), 'https://www.baylink.us/share-cards/zh-Hant/event-a.png');
  assert.equal(shareCardPath({ kind: 'event', id: 'a' }, 'en'), '/share-cards/en/event-a.png');
  assert.equal(localizedSocialImage('https://www.baylink.us/opus-bay/og-key.jpg', 'en_US'), 'https://www.baylink.us/opus-bay/og-key.jpg', 'other images keep their address');
});

test('H45: Chinese cards carry the Chinese tagline, English cards the English one', async () => {
  await Promise.all([loadLocale('en'), loadLocale('zh-Hant')]);
  const [event] = localDiscoveries;
  const [guide] = guides;
  const data = { weekend: [], range: '', tools: [], guideCount: guides.length };
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as CardLocale[]) {
    const models = [discoveryCardModel(event, locale, '2026-10-12', tr(locale)), guideCardModel(guide, locale, tr(locale)), hubCardModel('home', locale, tr(locale), data)];
    for (const model of models) {
      if (locale === 'en') assert.equal(model.tagline, DEFAULT_TAGLINE);
      else assert.ok(model.tagline && HAN.test(model.tagline) && model.tagline !== DEFAULT_TAGLINE, `${locale}: ${model.tagline}`);
    }
  }
  assert.equal(discoveryCardModel(event, 'zh-Hans', '2026-10-12', tr('zh-Hans')).tagline, BAYLINK_TAGLINE.zh);
  assert.equal(discoveryCardModel(event, 'zh-Hant', '2026-10-12', tr('zh-Hant')).tagline, '灣區去哪、怎麼辦 · 有來源的中文答案');
  const svg = renderShareCardSvg(discoveryCardModel(event, 'zh-Hans', '2026-10-12', text => text), { path: 'M0 0h1v1h-1z', size: 21 }, 'data:,');
  assert.ok(svg.includes(BAYLINK_TAGLINE.zh) && !svg.includes(DEFAULT_TAGLINE), 'the zh card draws the Chinese tagline');
  assert.doesNotMatch(svg, new RegExp(`letter-spacing="2">${BAYLINK_TAGLINE.zh}`), 'Chinese is set without letter spacing');
});

test('H45: a photo card puts the photo in the top 55% (1200 × 346) with its label, and keeps the title, date and QR below', () => {
  const event = localDiscoveries.find(item => item.kind === 'event')!;
  const photo: GuideImage = { src: '/x.webp', alt: '', caption: '2025 年活动官方照片', credit: 'Organiser 官方照片', creditUrl: 'https://www.example.org/expo/', kind: 'photo', width: 1280, height: 853, rights: { basis: 'promo-editorial', promoAllowed: true } };
  const model = discoveryCardModel(event, 'zh-Hans', '2026-10-12', text => text, photo);
  assert.equal(model.provenance, event.kind === 'event' && Number(event.event.startDate.slice(0, 4)) > 2025 ? '官方图 · 2025 · example.org' : '官方图 · example.org',
    'an official image names its source, and an earlier edition its year, as the page caption does');
  const english = discoveryCardModel(event, 'en', '2026-10-12', text => text, photo);
  assert.match(english.provenance, /^Official image · (?:2025 · )?example\.org$/);
  const edition = { ...photo, caption: '主办方活动官方照片（2025 往届游行），不是今年的现场' };
  assert.equal(discoveryCardModel(event, 'zh-Hans', '2026-10-12', text => text, edition).provenance, '官方图 · 2025 往届 · example.org', 'a badge that names the edition does not repeat the year');
  assert.equal(discoveryCardModel(event, 'en', '2026-10-12', text => text, edition).provenance, 'Official image · 2025 · example.org');
  assert.equal(PHOTO_BAND.width, 1200);
  assert.equal(PHOTO_BAND.height, Math.floor(630 * .55), 'the band is the top 55% of the card');
  const svg = renderShareCardSvg({ ...model, photo: 'data:image/jpeg;base64,AAAA' }, { path: 'M0 0h1v1h-1z', size: 21 }, 'data:,');
  assert.match(svg, /<image href="data:image\/jpeg;base64,AAAA" width="1200" height="346"/);
  const [, x, y] = /<svg x="(\d+)" y="(\d+)" width="\d+" height="\d+" viewBox="-4 -4 29 29"/.exec(svg)!;
  assert.ok(Number(x) >= 900 && Number(y) >= 380, 'the QR stays where the verifier decodes it');
  assert.ok(svg.includes('官方图 · '), 'the label is on the photo');
  assert.ok(svg.includes(model.title.slice(0, 6)), 'the title is drawn under the photo');
  // without a photo the card is the TypeCover layout
  assert.doesNotMatch(renderShareCardSvg(model, { path: 'M0 0h1v1h-1z', size: 21 }, 'data:,'), /<image href="data:image\/jpeg/);
});

test('UI9-IMG-A1b CI fix: the paper under a bright photo band stays exactly the paper through the palette, on any machine', async () => {
  const { default: sharp } = await import('sharp');
  const { PNG } = await import('pngjs');
  const { Resvg } = await import('@resvg/resvg-js');
  const { cardPng, indexedPng, rgbaKey } = await import('../scripts/share-card-worker.mjs');
  const { createGlyphOutliner } = await import('../scripts/card-glyphs');
  // The 繁體 tenant-rights guide card that lost its paper on the Linux runner (10-22): its ③ picture (white walls, bokeh)
  // a touch brighter, which on this Mac too makes the quantizer dither ~20% of the paper under the band with the photo's
  // near-whites. The rasterizer must put every pixel the drawing paints paper back to the exact paper token.
  const band = await sharp('public/guides/category-stock/stock-guide-housing-2.webp').resize(1200, 346, { fit: 'cover' }).modulate({ brightness: 1.05 }).jpeg({ quality: 82 }).toBuffer();
  const model = { tone: 'family' as const, coverLabel: '住房', big: '辦事指南', provenance: '示意圖', kindLabel: '灣區生活攻略', title: '加州租客權益：押金扣款、維修和驅逐通知怎麼求助', meta: ['租客權益'], scan: '掃碼查看這條詳情', footnote: '日期、領取條件與開放狀態，請以詳情頁和官方入口為準。', tagline: '灣區去哪、怎麼辦 · 有來源的中文答案' };
  const { draw, finish } = (await createGlyphOutliner())();
  const svg = finish(renderShareCardSvg({ ...model, photo: `data:image/jpeg;base64,${band.toString('base64')}` }, { path: 'M0 0h1v1h-1z', size: 21 }, 'data:,', draw));
  const drawn = new Resvg(svg, { font: { loadSystemFonts: false } }).render().pixels;
  const file = await cardPng({ svg, paper: CARD_INK.paper });
  assert.equal(file[25], 3, 'still an 8-bit palette PNG');
  const png = PNG.sync.read(file), paper = rgbaKey(CARD_INK.paper);
  let painted = 0, kept = 0;
  for (let at = 0; at < drawn.length; at += 4) if (drawn.readUInt32BE(at) === paper) { painted++; if (png.data.readUInt32BE(at) === paper) kept++; }
  assert.ok(painted > 200_000, `the card is mostly paper (${painted})`);
  assert.equal(kept, painted, 'every pixel drawn as paper is the exact paper token in the PNG');
  let strip = 0;
  for (let y = 350; y < 366; y++) for (let x = 0; x < 1200; x++) if (png.data.readUInt32BE((y * 1200 + x) * 4) === paper) strip++;
  assert.equal(strip, 1200 * 16, 'the strip verify:share-cards reads under the band is all paper');
  // the indexed encoder keeps every colour as it is (no second quantization); past 256 only the rarest merge, never `keep`
  const colours = Buffer.alloc(300 * 4);
  for (let index = 0; index < 300; index++) colours.writeUInt32BE(((Math.imul(index + 1, 2654435761) & 0xFFFFFF00) | 255) >>> 0, index * 4);
  const exact = PNG.sync.read(indexedPng(colours.subarray(0, 256 * 4), 16, 16));
  assert.deepEqual(Buffer.from(exact.data), Buffer.from(colours.subarray(0, 256 * 4)));
  const keep = colours.readUInt32BE(0), merged = PNG.sync.read(indexedPng(colours, 30, 10, keep));
  assert.equal(merged.data.readUInt32BE(0), keep, 'the kept colour (the paper) never merges');
  assert.ok(new Set(Array.from({ length: 300 }, (_, index) => merged.data.readUInt32BE(index * 4))).size <= 256);
});

test('H45: which photo a listing card may carry', () => {
  const event = localDiscoveries.find(item => item.kind === 'event' && item.event.imageKey)!;
  const offer = localDiscoveries.find(item => item.kind === 'offer')!;
  const photo: GuideImage = { src: '/x.webp', alt: '', caption: '2025', credit: 'Organiser', kind: 'photo', width: 1200, height: 800 };
  assert.ok(cardPhoto(event, { ...photo, rights: { basis: 'permission', promoAllowed: true } }, '2026-10-12'), 'a promotion-cleared photo');
  assert.equal(cardPhoto(event, { ...photo, rights: { basis: 'press-kit', promoAllowed: false } }, '2026-10-12'), undefined);
  assert.equal(cardPhoto(event, { ...photo, kind: 'illustration', rights: { basis: 'owner', promoAllowed: true } }, '2026-10-12'), undefined, 'never AI art');
  assert.equal(cardPhoto(offer, { ...photo, rights: { basis: 'promo-editorial', scope: 'same-event coverage only' } }, '2026-10-12'), undefined, 'an offer’s brand image is not an event’s own image');
  if (!OFFICIAL_IMAGE_ON_OWN_EVENT_CARD) assert.equal(cardPhoto(event, { ...photo, rights: { basis: 'promo-editorial', scope: 'same-event coverage only' } }, '2026-10-12'), undefined, 'without the owner’s rule, coverage-only images stay off the card');
});

test('H45 (owner rule 10-08): an event’s own card carries the organiser’s image its page shows as the official cover', () => {
  assert.equal(OFFICIAL_IMAGE_ON_OWN_EVENT_CARD, true);
  const today = '2026-10-12';
  const events = localDiscoveries.filter(item => item.kind === 'event');
  // An image marked coverOk: false (a small line drawing, UI9-R1 follow-up 12) is not the page's cover, so the card skips it too.
  const promo = events.filter(item => {
    const rights = GUIDE_IMAGES[item.event.imageKey]?.rights;
    return typeof rights === 'object' && rights?.basis === 'promo-editorial';
  });
  const official = promo.filter(item => GUIDE_IMAGES[item.event.imageKey]?.coverOk !== false);
  for (const item of promo.filter(item => GUIDE_IMAGES[item.event.imageKey]?.coverOk === false)) assert.equal(cardPhoto(item, GUIDE_IMAGES[item.event.imageKey], today), undefined, `${item.event.id}: not the page's cover`);
  assert.ok(official.length >= 10, `${official.length} events with the organiser’s own image`);
  for (const item of official) assert.equal(cardPhoto(item, GUIDE_IMAGES[item.event.imageKey], today), GUIDE_IMAGES[item.event.imageKey], item.event.id);
  const photo: GuideImage = { src: '/x.webp', alt: '', caption: '2025', credit: 'Organiser', kind: 'photo', width: 1200, height: 800 };
  const [first] = official;
  assert.equal(cardPhoto(first, { ...photo, rights: { basis: 'press-kit' } }, today), undefined, 'a press kit is not the organiser’s image of this event');
  assert.equal(cardPhoto(first, { ...photo, rights: { basis: 'promo-editorial', promoAllowed: false } }, today), undefined, 'a record that says no promotion');
  assert.equal(cardPhoto(first, { ...photo, rights: { basis: 'public-domain' } }, today), undefined, 'a public-domain photo is coverage, not the organiser’s');
  // a venue photo approved for an event is the venue, not the event's own image; a theme photo is never a cover
  const [venueKey, venue] = Object.entries(EVENT_CONTEXT_PHOTOS).find(([, use]) => use.purpose === 'venue')!;
  const venueEvent = events.find(item => venue.eventIds.includes(item.event.id));
  if (venueEvent && GUIDE_IMAGES[venueKey]) assert.equal(cardPhoto({ kind: 'event', event: { ...venueEvent.event, imageKey: venueKey } }, GUIDE_IMAGES[venueKey], today), undefined, venueKey);
  assert.equal(cardPhoto(first, GUIDE_IMAGES['dvids-blue-angels-sffw-2024'], today), undefined, 'the DVIDS Fleet Week photo stays off promotion');
});

test('H45: a cut meta line never ends on a separator; the photo card keeps whole " · " parts', () => {
  const cut = cardLines('Sat, Oct 17 · 9am–5pm · Lafayette Reservoir Run and Walk', 300, 24, 1)[0];
  assert.ok(cut.endsWith('…') && !/[·,;:]\s*…$/u.test(cut), cut);
  assert.ok(!/[·，、；]…$/u.test(cardLines('10月17日 · 上午9点 · 拉斐特水库环湖跑步与健走活动', 300, 24, 1)[0]));
  const parts = ['Sat, Oct 17', '3:30–5:30pm', 'Berkeley Adaptive Recreation Center and Park'];
  assert.deepEqual(partsLine(['Sat, Oct 17', '3:30–5:30pm', 'Berkeley'], 892, 24), ['Sat, Oct 17 · 3:30–5:30pm · Berkeley'], 'all of it when it fits');
  assert.deepEqual(partsLine(parts, 892, 24), ['Sat, Oct 17 · 3:30–5:30pm'], 'the parts that fit, whole (the place does not)');
  assert.ok(partsLine(['A very long first part that cannot fit on the line at all'], 200, 24)[0].endsWith('…'));
  assert.deepEqual(partsLine(['', 'Oct 17', ''], 300, 24), ['Oct 17']);
  assert.deepEqual(partsLine([], 300, 24), []);
});

test('H41: English cards read times and dates in US style, as the site does (scripts/generate-share-cards.ts switches it on)', async () => {
  await enableUsEnglishTimes();
  await loadLocale('en');
  const today = '2026-10-12';
  const left: string[] = [];
  for (const item of localDiscoveries) for (const text of texts(discoveryCardModel(item, 'en', today, tr('en')))) {
    if (hasTwentyFourHourOrIso(text.replace(/https?:\/\/\S+/g, ''))) left.push(`${item.kind}: ${text.slice(0, 60)}`);
  }
  assert.deepEqual(left.slice(0, 10), [], `${left.length} English card texts with a 24-hour time or an ISO date`);
});
