import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { loadLocale, translateText } from '../src/i18n/locale';
import { GUIDE_IMAGES, type GuideImage } from '../src/data/guide-media';
import { LIFE_TOOLS } from '../src/data/tool-catalog';
import { guides } from '../src/data/guides';
import { COVER_TONES } from '../src/lib/event-facts';
import { isAiIllustration, rightsBasisOf, type CoverAsset } from '../src/lib/cover';
import { CLOSE_UP_FACE_IMAGES, RELEASED_CLOSE_UPS } from '../src/lib/close-up-faces';
import { hubCardModel, HUB_CARD_NAMES, shareable, type CardLocale } from '../src/lib/share-card-model';
import { CARD_PALETTE, partsLine, renderHubCardSvg } from '../src/lib/share-card-svg';
import { HUB_PICTURES, hubPictures } from '../scripts/share-card-data';

const HAN = /[㐀-鿿]/;
const tr = (locale: CardLocale) => (text: string) => locale === 'zh-Hans' ? text : translateText(text, locale);
const data = (locale: CardLocale) => ({ weekend: [], range: locale === 'en' ? 'Oct 24–25' : '10/24–25', tools: LIFE_TOOLS.map(tool => tool.title), guideCount: guides.length });
const QR = { path: 'M0 0h1v1h-1z', size: 21 };

test('UI9-R2 N20: every hub card fronts its own ③ picture that promotion allows — never AI art, never a face close-up, never CC BY-SA', () => {
  const pictures = hubPictures();
  const srcs = new Set<string>();
  for (const name of HUB_CARD_NAMES) {
    const image = pictures[name];
    assert.ok(image, `${name} has a picture`);
    assert.ok(shareable(image), `${name}: promotion allows it`);
    assert.equal(rightsBasisOf(image as CoverAsset), 'stock', `${name}: an approved ③ stock picture (OD12) until a ① or ② picture with promotion rights exists`);
    assert.equal(image.rights && typeof image.rights === 'object' ? image.rights.promoAllowed : undefined, true, name);
    assert.ok(!isAiIllustration(image as CoverAsset) && image.kind === 'photo', `${name}: a photograph, not AI art (DECISIONS 24)`);
    assert.ok(existsSync(`public${image.src}`), `${name}: ${image.src} is in the repo`);
    const key = HUB_PICTURES[name].find(picture => GUIDE_IMAGES[picture.key]?.src === image.src)!.key;
    assert.ok(!CLOSE_UP_FACE_IMAGES.has(key) && !RELEASED_CLOSE_UPS.has(key), `${name}: not a close-up face`);
    for (const value of image.focal ?? []) assert.ok(value >= 0 && value <= 100, `${name}: focal in %`);
    srcs.add(image.src);
  }
  assert.equal(srcs.size, HUB_CARD_NAMES.length, 'no two hub cards share a picture');
});

test('UI9-R2 N20: a hub picture that loses its clearance gives way to the hub’s next one, and a picture an earlier hub took is skipped', () => {
  const photo = (src: string, promoAllowed: boolean): GuideImage => ({ src, alt: '', caption: '', credit: '示意图 · 摄影 A / Unsplash', kind: 'photo', width: 1280, height: 853, rights: { basis: 'stock', promoAllowed } });
  const images = { a: photo('/a.webp', false), b: photo('/b.webp', true), c: photo('/c.webp', true), ai: { ...photo('/ai.webp', true), kind: 'illustration' as const } };
  const table = Object.fromEntries(HUB_CARD_NAMES.map(name => [name, [{ key: 'ai' }]])) as unknown as typeof HUB_PICTURES;
  const picked = hubPictures(images, { ...table, home: [{ key: 'a' }, { key: 'b' }], events: [{ key: 'b' }, { key: 'c', focal: [50, 70] }] });
  assert.equal(picked.home?.src, '/b.webp', 'a picture promotion no longer allows is skipped');
  assert.equal(picked.events?.src, '/c.webp', 'home already took /b.webp');
  assert.deepEqual(picked.events?.focal, [50, 70], 'the band’s focal travels with the picture');
  assert.equal(picked.guides, undefined, 'AI art never fronts a hub card');
});

test('UI9-R2 N20: a hub card with a picture draws the photo layout with the picture’s label, its name, one line in its language and the QR', async () => {
  await Promise.all([loadLocale('en'), loadLocale('zh-Hant')]);
  const pictures = hubPictures();
  const labels: Record<CardLocale, string> = { 'zh-Hans': '示意图', 'zh-Hant': '示意圖', en: 'Illustrative photo' };
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as CardLocale[]) for (const name of HUB_CARD_NAMES) {
    const model = hubCardModel(name, locale, tr(locale), data(locale), pictures[name]);
    assert.equal(model.provenance, labels[locale], `${locale} ${name}: the ③ label (DECISIONS 23)`);
    if (locale === 'en') for (const text of [model.eyebrow, model.title, ...model.meta, model.scan]) assert.doesNotMatch(text, HAN, `en ${name}: ${text}`);
    // the line under the title keeps at least its first two parts whole (no "…"), all of them where they fit
    const line = partsLine(model.meta, 940 - 48, 24)[0];
    assert.ok(line && !line.endsWith('…'), `${locale} ${name}: ${line}`);
    assert.ok(model.meta.slice(0, name === 'tools' ? 2 : model.meta.length).filter(Boolean).every(part => line.includes(part)), `${locale} ${name}: ${line}`);
    const svg = renderHubCardSvg({ ...model, photo: 'data:image/jpeg;base64,AAAA' }, QR, 'data:,');
    assert.match(svg, /<image href="data:image\/jpeg;base64,AAAA" width="1200" height="346"/, 'the picture is the 1200 × 346 band');
    assert.ok(svg.includes(`>${labels[locale]}</text>`), 'the label is drawn on the picture');
    assert.ok(svg.includes(model.title.slice(0, 5)), 'the hub’s name under the picture');
    const [, x, y] = /<svg x="(\d+)" y="(\d+)" width="\d+" height="\d+" viewBox="-4 -4 29 29"/.exec(svg)!;
    assert.ok(Number(x) >= 900 && Number(y) >= 380, 'the QR stays where verify:share-cards decodes it');
  }
  const model = hubCardModel('home', 'zh-Hans', text => text, data('zh-Hans'));
  assert.throws(() => renderHubCardSvg({ ...model, photo: 'data:image/jpeg;base64,AAAA' }, QR, 'data:,'), /needs its label/, 'a picture is never drawn without its label');
  assert.doesNotMatch(renderHubCardSvg(model, QR, 'data:,'), /<image href="data:image\/jpeg/, 'without a picture the brand panel stays');
  // the brand card's title is the positioning line, so its brand line says the other half instead of repeating it
  const brand = hubCardModel('brand', 'zh-Hans', text => text, data('zh-Hans'), pictures.brand);
  assert.equal(brand.title, '湾区去哪、怎么办');
  assert.equal(brand.tagline, '有来源的中文答案');
});

test('UI9-R2 N08: the cards’ tones are the token sheet’s one category map, read rather than declared again', () => {
  const sheet = readFileSync('src/tokens.css', 'utf8');
  for (const tone of COVER_TONES) for (const side of ['bg', 'fg'] as const) {
    const token = new RegExp(`--tc-${tone}-${side}:\\s*var\\(--color-([a-z0-9-]+)\\)`).exec(sheet)?.[1];
    assert.ok(token, `--tc-${tone}-${side}`);
    const rgb = new RegExp(`--color-${token}-rgb:\\s*(\\d+) (\\d+) (\\d+)`).exec(sheet)!.slice(1).map(Number);
    assert.equal(CARD_PALETTE[tone][side], `#${rgb.map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`, `${tone} ${side}`);
  }
  const source = readFileSync('src/lib/share-card-svg.ts', 'utf8');
  assert.doesNotMatch(source, /family:\s*\{\s*bg:/, 'no tone table of its own');
  assert.doesNotMatch(source, /'\d{1,3} \d{1,3} \d{1,3}'/, 'no copied colour channels');
});
