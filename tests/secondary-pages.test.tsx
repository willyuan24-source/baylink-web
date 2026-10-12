import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { JSDOM } from 'jsdom';
import { within } from '@testing-library/react';
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
const page = (document: Document) => within(document.body);
const hrefOf = (link: Element) => new URL(link.getAttribute('href')!, 'https://www.baylink.us');
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

test('/explore: the 3D module shows labelled SF postcards that open /opus-bay?from=explore; place cards keep from=guide', async () => {
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    const document = await render(locale, '/explore?region=sf', createElement(AttractionExplorer));
    const module = page(document).getByRole('region', { name: /3D/ });
    const tiles = within(module).getAllByRole('link').filter(link => link.querySelector('img'));
    assert.ok(tiles.length >= 5, `${locale}: at least five postcards`);
    for (const tile of tiles) {
      const url = hrefOf(tile);
      assert.equal(url.pathname, languagePath('/opus-bay', locale));
      assert.equal(url.searchParams.get('from'), 'explore');
      assert.ok(Object.values(OPUS_BAY_ATTRACTION_ENTRIES).some(entry => entry.target === url.searchParams.get('at')), url.search);
      assert.match(tile.querySelector('img')!.getAttribute('src')!, /^\/guides\/3d\//, 'postcards come through the image pipeline copy, never public/opus-bay');
      assert.equal(tile.querySelector('[data-provenance]')?.textContent, locale === 'en' ? '3D scene illustration' : locale === 'zh-Hant' ? '3D 場景插圖' : '3D 场景插图');
    }
    assert.match(module.textContent!, locale === 'en' ? /about 8 MB, best opened on Wi-Fi/ : /约 8MB，建议用 Wi-Fi 打开|約 8MB，建議用 Wi-Fi 打開/);
    const open = within(module).getByRole('link', { name: locale === 'en' ? 'Open 3D San Francisco' : /^打[开開] 3D [旧舊]金山$/ });
    assert.equal(hrefOf(open).searchParams.get('from'), 'explore');
    // Every place card names its picture with the provenance vocabulary; none is an AI picture.
    const cards = page(document).getAllByRole('article');
    assert.ok(cards.length >= 7);
    for (const card of cards) {
      const label = card.querySelector('[data-provenance]')?.textContent || '';
      assert.ok(label, 'each card cover carries its provenance badge');
      assert.doesNotMatch(label, /AI/);
    }
    // The cards' 3D links are the published guide entries, which the game already counts as from=guide (OPUS contract).
    const chips = cards.flatMap(card => within(card).getAllByRole('link')).filter(link => link.getAttribute('href')?.includes('/opus-bay?'));
    assert.equal(chips.length, 7);
    for (const chip of chips) assert.equal(hrefOf(chip).searchParams.get('from'), 'guide');
    if (locale === 'en') assert.deepEqual(englishLeaks(document), []);
  }
  const north = await render('zh-Hans', '/explore?region=north-bay', createElement(AttractionExplorer));
  assert.equal(page(north).queryByRole('region', { name: /3D/ }), null, 'no SF postcards on a North Bay list');
  assert.equal(page(north).getAllByRole('heading', { level: 1 }).length, 1);
});

test('About carries the positioning line in its title, H1 and lede, in English too', async () => {
  const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  await setLocale('zh-Hans', false);
  assert.equal(ABOUT_METADATA.title, '关于 BAYLINK｜湾区去哪、怎么办——有来源的中文答案');
  const zh = await render('zh-Hans', '/about', createElement(AboutContent));
  assert.equal(page(zh).getByRole('heading', { level: 1 }).textContent, '湾区去哪、怎么办');
  assert.ok(page(zh).getByText(/^有来源的中文答案/));
  assert.ok(zh.querySelectorAll('[data-provenance]').length >= 7, 'every image label is explained, drawn by getImageProvenance');
  const en = await render('en', '/about', createElement(AboutContent));
  assert.equal(page(en).getByRole('heading', { level: 1 }).textContent, 'Where to go and how to get it done in the Bay');
  assert.deepEqual(englishLeaks(en), []);
  const head = new JSDOM(renderHtmlDocument(template, ABOUT_METADATA, '')).window.document;
  assert.doesNotMatch(head.title, HAN, 'the English About title is English');
  assert.match(head.title, /with sources/);
});

test('legal pages show English readers only English, and Chinese readers the summaries and Chinese sections', async () => {
  for (const [path, view, zhTitle, title] of [['/privacy', PrivacyPolicyView, '隐私政策', 'Privacy Policy'], ['/terms', TermsView, '服务条款', 'Terms of Service'], ['/sms-consent', SmsConsentView, '短信同意说明', 'SMS Consent']] as const) {
    const en = await render('en', path, createElement(view));
    assert.equal(page(en).getByRole('heading', { level: 1 }).textContent, title);
    assert.deepEqual(englishLeaks(en), [], path);
    assert.match(page(en).getByText(/^Last updated:/).textContent!, /^Last updated: [A-Z][a-z]+ \d{1,2}, 2026$/);
    // Chinese pages keep the English title and date: the bodies are English-first, and carrier reviewers open the unprefixed URL.
    const zh = await render('zh-Hans', path, createElement(view));
    assert.equal(page(zh).getByRole('heading', { level: 1 }).textContent, `${zhTitle} · ${title}`, `${path}: the Chinese H1 keeps the English title`);
    assert.match(zh.body.textContent!, path === '/sms-consent' ? /中文说明：何时会发送短信/ : /中文阅读要点/);
    assert.match(page(zh).getByText(/^更新日期：/).textContent!, /^更新日期：2026年\d{1,2}月\d{1,2}日 · Last updated: [A-Z][a-z]+ \d{1,2}, 2026$/);
  }
  const privacy = await render('zh-Hans', '/privacy', createElement(PrivacyPolicyView));
  assert.match(privacy.body.textContent!, /Cloudflare/, 'the API network edge is named (ENGSEC-11)');
  // The quoted button label: marked as Chinese on /en only; Chinese pages show it as their own button reads.
  const sms = await render('en', '/sms-consent', createElement(SmsConsentView));
  const marked = [...sms.querySelectorAll('[lang="zh-Hans"]')];
  assert.ok(marked.length > 0 && marked.every(node => node.textContent === '发送验证码' && node.getAttribute('translate') === 'no'), 'only the quoted button label is Chinese, and it is marked');
  const hant = await render('zh-Hant', '/sms-consent', createElement(SmsConsentView));
  assert.equal(hant.querySelectorAll('[lang="zh-Hans"]').length, 0);
  assert.match(hant.body.textContent!, /發送驗證碼 \/ Send verification code/);
  assert.equal(page(hant).getByRole('heading', { level: 1 }).textContent, '簡訊同意說明 · SMS Consent');
  assert.match(page(hant).getByText(/^更新日期：/).textContent!, / · Last updated: September 30, 2026$/);
  assert.doesNotMatch(hant.body.textContent!, /发送验证码/);
});

test('the 404 page offers a guide search and the four usual places in three languages', async () => {
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    const document = await render(locale, '/missing-page', createElement(NotFoundPage));
    assert.equal(page(document).getAllByRole('heading', { level: 1 }).length, 1);
    const search = within(page(document).getByRole('search')).getByRole('searchbox');
    assert.match(search.getAttribute('placeholder')!, /指南|guide/, 'the placeholder promises what the search covers: guides');
    const places = page(document).getByRole('navigation', { name: locale === 'en' ? 'Popular places' : '常用入口' });
    const hrefs = within(places).getAllByRole('link').map(link => link.getAttribute('href'));
    for (const path of ['/events', '/guides', '/guides?topic=elders', '/explore']) assert.ok(hrefs.includes(languagePath(path, locale)), `${locale} ${path}`);
    if (locale === 'en') assert.deepEqual(englishLeaks(document), []);
  }
});

test('/tools has one H1 at the title spec and the eight tools; the AI page says plainly that both weeks are over', async () => {
  const tools = await render('zh-Hans', '/tools', createElement(ToolsHub, { storageScope: 'guest:test', onToast: () => {} }));
  assert.equal(page(tools).getByRole('heading', { level: 1 }).textContent, '生活工具箱');
  assert.equal(within(page(tools).getByRole('navigation', { name: '选择生活工具' })).getAllByRole('link').length, 8);
  const toolsEn = await render('en', '/tools', createElement(ToolsHub, { storageScope: 'guest:test', onToast: () => {} }));
  assert.equal(page(toolsEn).getByRole('heading', { level: 1 }).textContent, 'Everyday tools');
  const later = await render('zh-Hans', '/ai-in-the-bay', createElement(AiLocalPage, { today: '2026-10-12' }));
  assert.match(page(later).getByRole('note').textContent!, /都已结束/);
  assert.ok(page(later).getAllByRole('article').length >= 8, 'past sessions stay readable as past records');
  assert.equal(page(later).queryAllByRole('main').length, 0, 'no <main> inside the site <main>');
  const during = await render('zh-Hans', '/ai-in-the-bay', createElement(AiLocalPage, { today: '2026-10-05' }));
  assert.equal(page(during).queryByRole('note'), null);
});
