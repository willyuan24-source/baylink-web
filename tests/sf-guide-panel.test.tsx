import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { existsSync } from 'node:fs';
import path from 'node:path';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/play' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, fireEvent, waitFor } = await import('@testing-library/react');
const { default: SfGuidePanel } = await import('../src/features/little-bay/SfGuidePanel');
const { loadSfGuidePreview } = await import('../src/features/little-bay/sf-guide-preview');
const { SF_LANDMARKS } = await import('../src/features/little-bay/sf-world');
const { getGuideBySlug } = await import('../src/data/guides');
const { loadLocale, translateText } = await import('../src/i18n/locale');
const { getSfLandmarkPhoto } = await import('../src/features/little-bay/sf-landmark-photos');

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

test('every SF map anchor has an attributed real photograph and available responsive files', () => {
  for (const landmark of SF_LANDMARKS) {
    const photo = getSfLandmarkPhoto(landmark.id, 'en');
    assert.ok(photo, `${landmark.id} has an explicit image`);
    assert.equal(photo.kind, 'photo');
    assert.ok(photo.width >= 1000 && photo.height > 300);
    assert.match(photo.creditUrl || '', /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    assert.match(photo.licenseUrl || '', /^https:\/\/creativecommons\.org\//);
    assert.doesNotMatch(`${photo.alt} ${photo.caption} ${photo.credit}`, /[\u3400-\u9fff]/);
    assert.ok(existsSync(path.join(process.cwd(), 'public', photo.src)));
    for (const source of photo.srcSet!.split(',')) assert.ok(existsSync(path.join(process.cwd(), 'public', source.trim().split(' ')[0])));
  }
  const gardenIds = ['park', 'japanese-tea-garden', 'academy', 'de-young'];
  assert.equal(new Set(gardenIds.map(id => getSfLandmarkPhoto(id, 'en')!.src)).size, 4, 'nearby places that share a guide keep their own photographs');
  assert.equal(getSfLandmarkPhoto('unknown-place', 'en'), undefined);
});

test('photo enlargement stays inside the scene dialog and Escape closes only the current view', () => {
  let closed = 0;
  let movementKeys = 0;
  const sceneKey = (event: KeyboardEvent) => { if (event.key === 'ArrowUp') movementKeys += 1; };
  window.addEventListener('keydown', sceneKey);
  try {
    const landmark = SF_LANDMARKS.find(place => place.id === 'japanese-tea-garden')!;
    const view = render(<SfGuidePanel landmark={landmark} locale="en" onClose={() => { closed += 1; }} />);
    fireEvent.click(view.getByRole('button', { name: /Enlarge attraction photograph/ }));
    assert.equal(view.getAllByRole('dialog').length, 1);
    assert.ok(view.container.contains(view.getByRole('img')), 'the image remains in the full-screen scene subtree');
    const closePhoto = view.getByRole('button', { name: 'Close photograph and return to place' });
    assert.equal(document.activeElement, closePhoto);
    fireEvent.keyDown(closePhoto, { key: 'ArrowUp' });
    assert.equal(movementKeys, 0);
    fireEvent.keyDown(closePhoto, { key: 'Escape' });
    assert.equal(closed, 0);
    assert.ok(view.getByRole('button', { name: /Enlarge attraction photograph/ }));
    fireEvent.click(view.getByRole('button', { name: /Enlarge attraction photograph/ }));
    const back = view.getByRole('button', { name: 'Back to place details' });
    back.focus();
    fireEvent.click(back);
    assert.equal(document.activeElement, view.getByRole('button', { name: 'Close guide and return to exploring' }), 'returning from the photograph restores focus inside the reader');
    fireEvent.keyDown(view.getByRole('button', { name: 'Close guide and return to exploring' }), { key: 'Escape' });
    assert.equal(closed, 1);
  } finally {
    window.removeEventListener('keydown', sceneKey);
  }
});

test('an unavailable photo offers retry without hiding the official information', () => {
  const landmark = SF_LANDMARKS.find(place => place.id === 'ferry')!;
  const view = render(<SfGuidePanel landmark={landmark} locale="en" onClose={() => {}} />);
  fireEvent.error(view.getByRole('img'));
  assert.match(view.getByRole('status').textContent || '', /photograph could not load/);
  assert.ok(view.getByRole('link', { name: 'Official info' }));
  fireEvent.click(view.getByRole('button', { name: 'Try again' }));
  assert.equal(view.queryByRole('status'), null);
  assert.equal(view.getByRole('img').getAttribute('src'), getSfLandmarkPhoto('ferry', 'en')!.src);
  assert.equal(document.activeElement, view.getByRole('button', { name: /Enlarge attraction photograph/ }));
  fireEvent.click(view.getByRole('button', { name: /Enlarge attraction photograph/ }));
  fireEvent.error(view.getByRole('img'));
  fireEvent.click(view.getByRole('button', { name: 'Try again' }));
  assert.equal(document.activeElement, view.getByRole('button', { name: 'Close photograph and return to place' }));
});
