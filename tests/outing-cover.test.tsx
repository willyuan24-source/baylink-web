import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { guides as GUIDES } from '../src/data/guides';
import { GUIDE_IMAGES, getGuideMedia } from '../src/data/guide-media';
import { discoveryShare, localDiscoveries } from '../src/data/local-discoveries';
import { coverFromSearchParams, getOutingCoverChoices, outingCoverHref, resolveOutingCover, type OutingCoverInput } from '../src/features/outings/outing-cover';
import type { OutingCoverSelection } from '../src/lib/outings';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/together' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { OutingCover } = await import('../src/features/outings/OutingCover');
const { OutingCoverPicker } = await import('../src/features/outings/OutingCoverPicker');
const { setLocale } = await import('../src/i18n/locale');
const outing: OutingCoverInput = { title: '周六一起看海', eventId: null, date: '2026-10-17', startTime: '14:00', city: 'Half Moon Bay' };
beforeEach(async () => { await setLocale('zh-Hans'); });
afterEach(() => cleanup());
after(() => dom.window.close());

test('automatic cover uses only the exact linked event and never infers from free text', () => {
  const event = localDiscoveries.find(item => item.kind === 'event'); assert.ok(event?.kind === 'event');
  const found = resolveOutingCover({ eventId: event.event.id });
  assert.equal(found?.kind, 'event'); assert.equal(found?.image, GUIDE_IMAGES[event.event.imageKey]);
  assert.equal(resolveOutingCover({ eventId: null }), null);
  assert.equal(resolveOutingCover({ eventId: 'unknown-event' }), null);
  assert.equal(resolveOutingCover({ eventId: event.event.id, cover: { kind: 'card' } }), null);
});

test('explicit cover references preserve exact catalog media and attribution for all source types', () => {
  for (const kind of ['event', 'offer', 'opening'] as const) {
    const source = localDiscoveries.find(item => item.kind === kind); assert.ok(source);
    const shared = discoveryShare(source);
    const item = source.kind === 'event' ? source.event : source.kind === 'offer' ? source.offer : source.shop;
    const resolved = resolveOutingCover({ eventId: null, cover: { kind, id: shared.id } });
    assert.equal(resolved?.path, shared.path); assert.equal(resolved?.image, GUIDE_IMAGES[item.imageKey]);
    assert.equal(resolved?.image.credit, GUIDE_IMAGES[item.imageKey].credit);
    assert.equal(resolved?.image.licenseUrl, GUIDE_IMAGES[item.imageKey].licenseUrl);
  }
  const guide = GUIDES[0], cover = { kind: 'guide' as const, id: guide.slug };
  assert.equal(resolveOutingCover({ eventId: null, cover })?.image, getGuideMedia(guide).cover);
  assert.equal(outingCoverHref(cover), `/guides/${guide.slug}`);
  assert.equal(resolveOutingCover({ eventId: null, cover: { kind: 'guide', id: 'https://example.com/unreviewed.jpg' } }), null);
});

test('search is bounded and source URL parameters accept existing catalog references only', () => {
  assert.equal(getOutingCoverChoices().length, 6); assert.equal(getOutingCoverChoices('', 500).length, 12);
  assert.equal(getOutingCoverChoices('ZZZ-definitely-no-content-match-XYZ').length, 0);
  const guide = GUIDES[0]; assert.ok(getOutingCoverChoices(guide.title).some(item => item.id === guide.slug));
  assert.deepEqual(coverFromSearchParams(new URLSearchParams({ coverKind: 'guide', coverId: guide.slug })), { kind: 'guide', id: guide.slug });
  assert.equal(coverFromSearchParams(new URLSearchParams({ coverKind: 'guide', coverId: 'missing' })), undefined);
  assert.equal(coverFromSearchParams(new URLSearchParams({ coverKind: 'auto' })), undefined);
  assert.equal(coverFromSearchParams(new URLSearchParams({ coverKind: 'photo', coverId: 'https://example.com' })), undefined);
});

test('renderer preserves reference semantics, credit and license and degrades failed images into designed cards', () => {
  const guide = GUIDES.find(item => getGuideMedia(item).cover.licenseUrl); assert.ok(guide);
  const media = getGuideMedia(guide).cover;
  const view = render(<OutingCover outing={{ ...outing, cover: { kind: 'guide', id: guide.slug } }} variant="preview" />);
  assert.equal(view.getByRole('img').getAttribute('alt'), media.alt);
  assert.ok(view.getByRole('link', { name: new RegExp(`参考内容`) }));
  assert.equal(view.getByRole('link', { name: '授权说明', hidden: true }).getAttribute('href'), media.licenseUrl);
  assert.ok(view.getByText(media.credit)); assert.ok(view.getByText(/不是小队合照/));
  fireEvent.error(view.getByRole('img'));
  assert.equal(view.queryByRole('img'), null);
  assert.ok(view.getByText(outing.title)); assert.ok(view.getByText('10 / 17 · 14:00'));
  assert.ok(view.getByRole('link', { name: /参考内容/ }), 'source link survives image failure');
});

test('poster and full-frame media are rendered uncropped', () => {
  const selected = localDiscoveries.find(item => {
    const value = item.kind === 'event' ? item.event : item.kind === 'offer' ? item.offer : item.shop;
    return GUIDE_IMAGES[value.imageKey]?.kind === 'poster' || GUIDE_IMAGES[value.imageKey]?.fullFrame;
  }); assert.ok(selected);
  const source = discoveryShare(selected);
  const view = render(<OutingCover outing={{ ...outing, cover: { kind: source.kind, id: source.id } }} />);
  assert.ok(view.getByRole('img').parentElement?.classList.contains('is-full-frame'));
});

test('picker exposes only deliberate cover choices and preserves user schedule and title', () => {
  const changed: OutingCoverSelection[] = [], original = structuredClone(outing);
  const view = render(<OutingCoverPicker outing={outing} onChange={value => changed.push(value)} />);
  assert.equal(view.queryByRole('searchbox'), null);
  fireEvent.click(view.getByRole('button', { name: '从攻略与资讯选图' }));
  assert.ok(view.getByRole('searchbox'));
  fireEvent.change(view.getByRole('searchbox'), { target: { value: GUIDES[0].title } });
  fireEvent.click(view.getByRole('button', { name: new RegExp(GUIDES[0].title) }));
  assert.deepEqual(changed, [{ kind: 'guide', id: GUIDES[0].slug }]);
  assert.equal(view.queryByRole('searchbox'), null); assert.deepEqual(outing, original);
  fireEvent.click(view.getByRole('button', { name: '文字卡片' }));
  assert.deepEqual(changed[1], { kind: 'card' });
});

test('cover controls render English and traditional Chinese without changing personal content', async () => {
  await setLocale('en');
  const view = render(<OutingCoverPicker outing={outing} onChange={() => {}} />);
  assert.ok(view.getByRole('button', { name: 'Choose from BAYLINK' })); assert.ok(view.getByText(outing.title));
  await act(async () => { await setLocale('zh-Hant'); });
  assert.ok(view.getByRole('button', { name: '從攻略與資訊選圖' })); assert.ok(view.getByText(outing.title));
});

test('removed catalog references show a visible recovery hint and still allow text cards', () => {
  const changed: OutingCoverSelection[] = [];
  const view = render(<OutingCoverPicker outing={{ ...outing, cover: { kind: 'guide', id: 'removed-guide' } }} onChange={value => changed.push(value)} />);
  assert.ok(view.getByRole('status').textContent?.includes('原参考内容暂不可用'));
  assert.ok(view.getByText(outing.title));
  fireEvent.click(view.getByRole('button', { name: '文字卡片' }));
  assert.deepEqual(changed, [{ kind: 'card' }]);
});

test('list cover links open the gathering without wrapping reference and credit links', async () => {
  const { MemoryRouter } = await import('react-router-dom');
  const guide = GUIDES[0];
  const view = render(<MemoryRouter><OutingCover outing={{ ...outing, cover: { kind: 'guide', id: guide.slug } }} to="/together?outing=test" /></MemoryRouter>);
  assert.equal(view.getByRole('link', { name: `查看小队: ${outing.title}` }).getAttribute('href'), '/together?outing=test');
  assert.equal(view.container.querySelectorAll('a a').length, 0);
  assert.ok(view.getByRole('link', { name: /参考内容/ }));
});
