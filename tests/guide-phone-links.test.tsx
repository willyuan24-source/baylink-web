import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// G14 mount: guide prose (paragraph, list, tip and source-link text) shows tap-to-call chips; RC-11(i) on /en.
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { StaticRouter } = await import('react-router');
await import('../src/i18n/router');
const { setLocale, translateText } = await import('../src/i18n/locale');
const { findPhoneNumbers } = await import('../src/lib/phone-numbers');
const { GuideDetail } = await import('../src/components/GuideDetail');
const { getGuideBySlug } = await import('../src/data/guides');

afterEach(async () => { await setLocale('zh-Hans', false); });
const tels = (text: string) => findPhoneNumbers(text).map(match => match.tel);
const chinese = /[\u3400-\u9fff]/u;

const seniorSlug = 'bay-area-chinese-senior-services-referral-guide';
const renderGuide = (slug: string, prefix = '') => new JSDOM(renderToStaticMarkup(<StaticRouter location={`${prefix}/guides/${slug}`}>
  <GuideDetail slug={slug} today="2026-10-08" onBack={() => {}} onOpenGuide={() => {}} onNavigate={() => {}} onOpenPost={() => {}} />
</StaticRouter>)).window.document;
const proseTexts = (slug: string) => getGuideBySlug(slug)!.blocks.flatMap(block =>
  block.type === 'paragraph' || block.type === 'tip' || block.type === 'link' ? [block.text] : block.type === 'list' ? block.items : []);

for (const [locale, prefix] of [['zh-Hans', ''], ['zh-Hant', '/zh-Hant'], ['en', '/en']] as const) {
  test(`the senior services guide calls every number it shows (${locale}), with county lines in one grid`, async () => {
    await setLocale(locale, false);
    const document = renderGuide(seniorSlug, prefix);
    const expected = proseTexts(seniorSlug).flatMap(text => tels(translateText(text, locale)));
    assert.equal(expected.length, 12, 'AAA line, 8 county lines and 3 program numbers');
    const links = [...document.querySelectorAll('a[href^="tel:"]')].map(link => link.getAttribute('href')!.slice(4));
    assert.deepEqual(links.sort(), [...expected].sort());
    const grid = document.querySelector('.phone-directory')!;
    assert.ok(grid, 'the county list renders as a directory grid');
    assert.equal(grid.querySelectorAll('li').length, 8);
    assert.deepEqual([...grid.querySelectorAll('.phone-directory-label')].map(label => label.textContent).slice(0, 3), ['San Francisco', 'San Mateo', 'Santa Clara']);
    for (const link of grid.querySelectorAll('a')) assert.match(link.getAttribute('aria-label')!, locale === 'en' ? /^Call [A-Za-z /]+ \d{3}-\d{3}-\d{4}$/ : /^[拨撥]打 /);
  });
}

test('RC-11(i): on /en the linkified paragraphs are the English translation, not the Chinese source split into pieces', async () => {
  await setLocale('en', false);
  const document = renderGuide(seniorSlug, '/en');
  const guide = getGuideBySlug(seniorSlug)!;
  const withPhones = guide.blocks.filter(block => block.type === 'paragraph' && findPhoneNumbers(block.text).length) as { text: string }[];
  assert.ok(withPhones.length >= 3);
  const paragraphs = [...document.querySelectorAll('p')].map(p => p.textContent);
  for (const block of withPhones) {
    const english = translateText(block.text, 'en');
    assert.doesNotMatch(english, chinese, 'the dictionary has this paragraph in English');
    assert.ok(paragraphs.includes(english), english.slice(0, 60));
  }
  for (const p of document.querySelectorAll('p')) if (p.querySelector('a.phone-chip')) assert.doesNotMatch(p.textContent!, chinese, p.textContent!.slice(0, 60));
});

