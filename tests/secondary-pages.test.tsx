import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { JSDOM } from 'jsdom';
import '../src/i18n/router';
import { setLocale, type Locale } from '../src/i18n/locale';
import { languagePath, languagePrefix } from '../src/lib/language-path';
import { renderHtmlDocument } from '../src/lib/seo';
import { AttractionExplorer } from '../src/components/AttractionExplorer';
import { AboutContent } from '../src/components/AboutContent';
import { ABOUT_METADATA } from '../src/lib/about-metadata';
import { PrivacyPolicyView } from '../src/components/PrivacyPolicyView';
import { TermsView } from '../src/components/TermsView';
import { SmsConsentView } from '../src/components/SmsConsentView';
import { ToolsHub } from '../src/components/tools/ToolsHub';
import NotFoundPage from '../src/pages/NotFoundPage';
import AiLocalPage from '../src/pages/AiLocalPage';
import { OPUS_BAY_ATTRACTION_ENTRIES } from '../src/lib/opus-bay-attraction-entry';

// WEB-SECONDARY: the secondary templates in three languages (rendered as the prerender does: static markup in a router).
const HAN = /[㐀-鿿]/;
const render = async (locale: Locale, path: string, element: ReactElement) => {
  await setLocale(locale, false, path);
  const html = renderToStaticMarkup(createElement(StaticRouter, { location: languagePath(path, locale), basename: languagePrefix(locale) || undefined }, element));
  return new JSDOM(`<!doctype html><body>${html}</body>`).window.document;
};
/** Visible text an English reader would see as Chinese: outside [lang^=zh] and translate="no" islands. */
const englishLeaks = (document: Document) => {
  const leaks: string[] = [];
  const walker = document.createTreeWalker(document.body, 4);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim() || '';
    if (!HAN.test(text) || node.parentElement?.closest('[lang^="zh"],[translate="no"]')) continue;
    leaks.push(text.slice(0, 40));
  }
  return leaks;
};
afterEach(async () => { await setLocale('zh-Hans', false); });

test('/explore shows the SF postcards as labelled 3D scene illustrations that open /opus-bay?from=explore', async () => {
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    const document = await render(locale, '/explore?region=sf', createElement(AttractionExplorer));
    const module = document.querySelector('.xp-3d');
    assert.ok(module, `${locale}: the 3D module is on the SF results`);
    const tiles = [...module!.querySelectorAll('a')].filter(anchor => anchor.querySelector('img'));
    assert.ok(tiles.length >= 5, `${locale}: at least five postcards`);
    for (const tile of tiles) {
      const url = new URL(tile.getAttribute('href')!, 'https://www.baylink.us');
      assert.equal(url.pathname, languagePath('/opus-bay', locale));
      assert.equal(url.searchParams.get('from'), 'explore');
      assert.ok(Object.values(OPUS_BAY_ATTRACTION_ENTRIES).some(entry => entry.target === url.searchParams.get('at')), url.search);
      assert.match(tile.querySelector('img')!.getAttribute('src')!, /^\/guides\/3d\//, 'postcards come through the image pipeline copy, never public/opus-bay');
      assert.equal(tile.querySelector('[data-provenance]')?.textContent, locale === 'en' ? '3D scene illustration' : locale === 'zh-Hant' ? '3D 場景插圖' : '3D 场景插图');
    }
    assert.match(module!.textContent!, locale === 'en' ? /about 8 MB, best opened on Wi-Fi/ : /约 8MB，建议用 Wi-Fi 打开|約 8MB，建議用 Wi-Fi 打開/);
    const open = [...module!.querySelectorAll('a')].find(anchor => !anchor.querySelector('img'))!;
    assert.equal(new URL(open.getAttribute('href')!, 'https://www.baylink.us').searchParams.get('from'), 'explore');
    // Every place card names its picture with the provenance vocabulary; none is an AI picture.
    const cards = [...document.querySelectorAll('.attraction-card')];
    assert.ok(cards.length >= 7);
    for (const card of cards) {
      const label = card.querySelector('[data-provenance]')?.textContent || '';
      assert.ok(label, 'each card cover carries its provenance badge');
      assert.doesNotMatch(label, /AI/);
    }
    const chips = [...document.querySelectorAll('.attraction-card a')].filter(anchor => anchor.getAttribute('href')?.includes('/opus-bay?'));
    assert.equal(chips.length, 7);
    for (const chip of chips) assert.equal(new URL(chip.getAttribute('href')!, 'https://www.baylink.us').searchParams.get('from'), 'explore');
    if (locale === 'en') assert.deepEqual(englishLeaks(document), []);
  }
  const north = await render('zh-Hans', '/explore?region=north-bay', createElement(AttractionExplorer));
  assert.equal(north.querySelector('.xp-3d'), null, 'no SF postcards on a North Bay list');
  assert.equal(north.querySelectorAll('h1').length, 1);
});

test('About carries the positioning line in its title, H1 and lede, in English too', async () => {
  const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  await setLocale('zh-Hans', false);
  assert.equal(ABOUT_METADATA.title, '关于 BAYLINK｜湾区去哪、怎么办——有来源的中文答案');
  const zh = await render('zh-Hans', '/about', createElement(AboutContent));
  assert.equal(zh.querySelector('h1')?.textContent, '湾区去哪、怎么办');
  assert.match(zh.querySelector('.ui-page-header__lede')!.textContent!, /^有来源的中文答案/);
  assert.ok(zh.querySelectorAll('[data-provenance]').length >= 7, 'every image label is explained, drawn by getImageProvenance');
  const en = await render('en', '/about', createElement(AboutContent));
  assert.equal(en.querySelector('h1')?.textContent, 'Where to go and how to get it done in the Bay');
  assert.deepEqual(englishLeaks(en), []);
  const page = new JSDOM(renderHtmlDocument(template, ABOUT_METADATA, '')).window.document;
  assert.doesNotMatch(page.title, HAN, 'the English About title is English');
  assert.match(page.title, /with sources/);
});

test('legal pages show English readers only English, and Chinese readers the summaries and Chinese sections', async () => {
  for (const [path, view, title] of [['/privacy', PrivacyPolicyView, 'Privacy Policy'], ['/terms', TermsView, 'Terms of Service'], ['/sms-consent', SmsConsentView, 'SMS Consent']] as const) {
    const en = await render('en', path, createElement(view));
    assert.equal(en.querySelector('h1')?.textContent, title);
    assert.deepEqual(englishLeaks(en), [], path);
    assert.match(en.querySelector('.ui-page-header__lede')!.textContent!, /^Last updated: [A-Z][a-z]+ \d{1,2}, 2026$/);
    const zh = await render('zh-Hans', path, createElement(view));
    assert.doesNotMatch(zh.querySelector('h1')!.textContent!, /[A-Za-z]{4}/, `${path}: the Chinese H1 is Chinese`);
    assert.match(zh.body.textContent!, path === '/sms-consent' ? /中文说明：何时会发送短信/ : /中文阅读要点/);
    assert.match(zh.querySelector('.ui-page-header__lede')!.textContent!, /^更新日期：2026年/);
  }
  const privacy = await render('zh-Hans', '/privacy', createElement(PrivacyPolicyView));
  assert.match(privacy.body.textContent!, /Cloudflare/, 'the API network edge is named (ENGSEC-11)');
  const sms = await render('en', '/sms-consent', createElement(SmsConsentView));
  assert.ok([...sms.querySelectorAll('[lang="zh-Hans"]')].every(node => node.textContent === '发送验证码'), 'only the quoted button label is Chinese, and it is marked');
});

test('the 404 page offers a search and the four usual places in three languages', async () => {
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    const document = await render(locale, '/missing-page', createElement(NotFoundPage));
    assert.equal(document.querySelectorAll('h1').length, 1);
    assert.ok(document.querySelector('form[role="search"] input[type="search"]'));
    const hrefs = [...document.querySelectorAll('.nf-links a')].map(anchor => anchor.getAttribute('href'));
    for (const path of ['/events', '/guides', '/guides?topic=elders', '/explore']) assert.ok(hrefs.includes(languagePath(path, locale)), `${locale} ${path}`);
    if (locale === 'en') assert.deepEqual(englishLeaks(document), []);
  }
});

test('/tools has one H1 at the title spec and the eight tools; the AI page says plainly that both weeks are over', async () => {
  const tools = await render('zh-Hans', '/tools', createElement(ToolsHub, { storageScope: 'guest:test', onToast: () => {} }));
  assert.equal(tools.querySelector('h1')?.textContent, '生活工具箱');
  assert.equal(tools.querySelectorAll('.tools-picker a').length, 8);
  const toolsEn = await render('en', '/tools', createElement(ToolsHub, { storageScope: 'guest:test', onToast: () => {} }));
  assert.equal(toolsEn.querySelector('h1')?.textContent, 'Everyday tools');
  const later = await render('zh-Hans', '/ai-in-the-bay', createElement(AiLocalPage, { today: '2026-10-12' }));
  assert.match(later.querySelector('.bl-ai-ended')!.textContent!, /都已结束/);
  assert.ok(later.querySelectorAll('.bl-ai-event').length >= 8, 'past sessions stay readable as past records');
  assert.equal(later.querySelectorAll('main').length, 0, 'no <main> inside the site <main>');
  const during = await render('zh-Hans', '/ai-in-the-bay', createElement(AiLocalPage, { today: '2026-10-05' }));
  assert.equal(during.querySelector('.bl-ai-ended'), null);
});
