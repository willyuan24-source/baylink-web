import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

// H13 (GR-04): the template caution is said once per guide, not on every slide, and the page's template notes
// ([data-template-note]: the source list's 核对原始资料 line, the cover slide's 以机构确认为准, the edition box, the template
// block's note) are not counted as the article's own hedging. The audit's regex, on the rendered article text.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/guides', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { renderToStaticMarkup } = await import('react-dom/server');
const { StaticRouter } = await import('react-router');
const { GuideDetail } = await import('../src/components/GuideDetail');
const { GUIDE_EDITORIAL } = await import('../src/data/guide-editorial');

const HEDGE = /确认|核对|核实|不能|不要|不等于|不代表|不保证|不承诺|为准|可能|另付|另计/gu;
const han = (text: string) => (text.match(/[㐀-鿿]/gu) || []).length;
const noop = () => {};
const article = (slug: string) => {
  const html = renderToStaticMarkup(<StaticRouter location={`/guides/${slug}`}><GuideDetail slug={slug} today="2026-10-13" onOpenGuide={noop} onNavigate={noop} onOpenPost={noop} /></StaticRouter>);
  return new JSDOM(html).window.document.querySelector('article')!;
};
const textWithout = (root: Element, selector: string) => {
  const copy = root.cloneNode(true) as Element;
  copy.querySelectorAll(selector).forEach(element => element.remove());
  return copy.textContent ?? '';
};

test('以机构确认为准 appears once on a pilot page, on the cover slide, marked as a template note', () => {
  for (const slug of Object.keys(GUIDE_EDITORIAL)) {
    const page = article(slug);
    const text = page.textContent ?? '';
    assert.equal(text.split('以机构确认为准').length - 1, 1, `${slug}: the caution is said once`);
    const cover = page.querySelector('.gd-slide--cover .gd-slide__source');
    assert.ok(cover?.hasAttribute('data-template-note') && cover.textContent!.includes('以机构确认为准'), slug);
    for (const footer of page.querySelectorAll('.gd-slide:not(.gd-slide--cover) .gd-slide__source')) assert.doesNotMatch(footer.textContent!, /以机构确认为准/, slug);
    const sources = page.querySelector('#guide-sources')?.nextElementSibling;
    assert.ok(sources?.hasAttribute('data-template-note'), `${slug}: the source list's caution is a template note`);
  }
});

test('hedging on the rendered pilot pages, template notes excluded, stays at most 12 per 1,000 characters', () => {
  const rows: string[] = [];
  for (const slug of Object.keys(GUIDE_EDITORIAL)) {
    const page = article(slug);
    const all = page.textContent ?? '', body = textWithout(page, '[data-template-note]');
    const perK = (text: string) => 1000 * (text.match(HEDGE) || []).length / Math.max(1, han(text));
    rows.push(`${slug} ${perK(all).toFixed(1)} → ${perK(body).toFixed(1)}`);
    assert.ok(perK(body) < perK(all), `${slug}: the template notes are left out of the count`);
    assert.ok(perK(body) <= 12, `${slug}: ${perK(body).toFixed(1)} hedges per 1,000 characters`);
  }
  console.log(rows.join('\n'));
});
