import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { loadLocale, translateText } from '../src/i18n/locale';
import { localDiscoveries } from '../src/data/local-discoveries';
import { guides } from '../src/data/guides';
import { GUIDE_IMAGES, type GuideImage } from '../src/data/guide-media';
import { LIFE_TOOLS } from '../src/data/tool-catalog';
import { discoveryCardModel, guideCardModel, hubCardModel, HUB_CARD_NAMES, promoPhoto, type CardLocale } from '../src/lib/share-card-model';
import { renderHubCardSvg, renderShareCardSvg } from '../src/lib/share-card-svg';
import { localizedSocialImage } from '../src/lib/seo';
import { shareCardPath } from '../src/lib/editorial-share';
import { simplifiedOnlyCharacters } from '../scripts/i18n-html-check.mjs';

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
