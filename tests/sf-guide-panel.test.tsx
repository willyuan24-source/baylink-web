import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/play' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, fireEvent, waitFor } = await import('@testing-library/react');
const { default: SfGuidePanel } = await import('../src/features/little-bay/SfGuidePanel');
const { loadSfGuidePreview } = await import('../src/features/little-bay/sf-guide-preview');
const { SF_LANDMARKS } = await import('../src/features/little-bay/sf-world');
const { getGuideBySlug } = await import('../src/data/guides');
const { loadLocale, translateText } = await import('../src/i18n/locale');

afterEach(() => { cleanup(); document.body.replaceChildren(); });

test('mapped landmarks preview only real existing guide content and preserve article identity', async () => {
  for (const place of SF_LANDMARKS.filter(landmark => landmark.guideSlug)) {
    const guide = getGuideBySlug(place.guideSlug!)!;
    assert.ok(guide, `${place.id} has an existing guide`);
    const preview = await loadSfGuidePreview(place.guideSlug!, 'zh-Hans');
    assert.ok(preview);
    assert.equal(preview.title, guide.title);
    assert.equal(preview.summary, guide.summary);
    assert.equal(preview.updatedAt, guide.updatedAt);
    assert.equal(preview.href, `/guides/${guide.slug}`);
    assert.ok(preview.highlights.length > 0 && preview.highlights.length <= 3);
    for (const excerpt of preview.highlights) assert.ok(JSON.stringify(guide.blocks).includes(excerpt.text), 'excerpts come from the actual article blocks');
  }
  assert.equal(await loadSfGuidePreview('not-a-real-article', 'en'), undefined);
});

test('in-game reader loads the article, traps focus, closes on Escape and restores the trigger', async () => {
  const trigger = document.createElement('button');
  trigger.textContent = 'Read nearby guide';
  document.body.append(trigger);
  trigger.focus();
  let closed = 0;
  const park = SF_LANDMARKS.find(place => place.id === 'park')!;
  const view = render(<SfGuidePanel landmark={park} locale="zh-Hans" onClose={() => { closed += 1; }} />);
  const close = view.getByRole('button', { name: '关闭攻略，返回探索' });
  assert.equal(document.activeElement, close);
  await waitFor(() => assert.ok(view.getByRole('link', { name: '阅读全文' })));
  const fullArticle = view.getByRole('link', { name: '阅读全文' });
  assert.equal(fullArticle.getAttribute('href'), `/guides/${park.guideSlug}`);
  assert.equal(fullArticle.getAttribute('target'), '_blank');
  assert.match(fullArticle.getAttribute('rel') || '', /noopener/);
  assert.equal(view.getByRole('dialog').getAttribute('aria-modal'), 'true');
  assert.ok(view.getByRole('heading', { name: getGuideBySlug(park.guideSlug!)!.title }));
  assert.match(view.container.querySelector('.sf-guide-source')?.textContent || '', /BAYLINK 现有攻略/);
  const last = view.getByRole('button', { name: '继续探索' });
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  assert.equal(document.activeElement, last);
  fireEvent.keyDown(last, { key: 'Tab' });
  assert.equal(document.activeElement, close);
  fireEvent.keyDown(close, { key: 'Escape' });
  assert.equal(closed, 1);
  view.unmount();
  assert.equal(document.activeElement, trigger);
});

test('English reader uses existing editorial translations and carries language into the article link', async () => {
  await loadLocale('en');
  const bridge = SF_LANDMARKS.find(place => place.id === 'bridge')!;
  const guide = getGuideBySlug(bridge.guideSlug!)!;
  const view = render(<SfGuidePanel landmark={bridge} locale="en" onClose={() => {}} />);
  await waitFor(() => assert.ok(view.getByRole('link', { name: 'Read full guide' })));
  assert.ok(view.getByRole('heading', { name: translateText(guide.title, 'en') }));
  assert.doesNotMatch(view.container.querySelector('.sf-guide-summary')?.textContent || '', /[\u3400-\u9fff]/);
  assert.equal(view.getByRole('link', { name: 'Read full guide' }).getAttribute('href'), `/guides/${bridge.guideSlug}?lang=en`);
});

test('places without a mapped article offer official information without a fabricated guide link', () => {
  const ferry = SF_LANDMARKS.find(place => place.id === 'ferry')!;
  const view = render(<SfGuidePanel landmark={ferry} locale="en" onClose={() => {}} />);
  assert.equal(view.queryByRole('link', { name: 'Read full guide' }), null);
  assert.equal(view.getByRole('link', { name: 'Official info' }).getAttribute('href'), ferry.sourceUrl);
  assert.match(view.getByRole('dialog').textContent || '', /preview is not available/);
  assert.equal(view.queryByRole('status'), null);
});
