// W5-INT (H35 follow-up, found in the W5-INT review): with /this-month a 301 to /events, the guides' data links
// /this-month?when=october|november land on /events?when=october|november, which lists that month. The browser tab and a
// shared link now name the month, not 本周末; an unknown or retired ?when= (九月回顾) is titled as the list reads it (全部日期).
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/events' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { render, cleanup } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { default: EventsPage } = await import('../src/pages/EventsPage');
const { eventsViewMetadata, EVENTS_METADATA } = await import('../src/lib/monthly-metadata');
const { redirectLocation } = await import('../src/app/route-table');
const { ENGLISH_TITLE_LIMIT } = await import('../src/lib/seo');
afterEach(() => cleanup());

const titleAt = (location: string) => {
  render(<MemoryRouter initialEntries={[location]}><EventsPage /></MemoryRouter>);
  const title = document.title;
  cleanup();
  return title;
};

test('the October and November views have their own titles in Chinese and English', () => {
  assert.equal(eventsViewMetadata('october').title, '十月湾区活动与官方来源｜BAYLINK');
  assert.equal(eventsViewMetadata('november').title, '十一月湾区活动与官方来源｜BAYLINK');
  for (const view of ['october', 'november'] as const) {
    const metadata = eventsViewMetadata(view);
    assert.equal(metadata.path, '/events', `${view}: one canonical page`);
    assert.doesNotMatch(metadata.english!.title!, /[㐀-鿿]/, view);
    assert.ok(metadata.english!.title!.length <= ENGLISH_TITLE_LIMIT, `${view}: ${metadata.english!.title}`);
  }
});

test('a guide link through the /this-month 301 lands on a page titled with its month', () => {
  const landed = redirectLocation('/this-month', '?when=november');
  assert.ok(landed, '/this-month still redirects (H35)');
  assert.equal(`${landed.pathname}${landed.search}`, '/events?when=november');
  assert.equal(titleAt('/events?when=november'), '十一月湾区活动与官方来源｜BAYLINK');
  assert.equal(titleAt('/events?when=october&region=sf'), '十月湾区活动与官方来源｜BAYLINK');
  assert.equal(titleAt('/events'), EVENTS_METADATA.title, '本周末 keeps the page title');
  assert.equal(titleAt('/events?when=today'), eventsViewMetadata('today').title);
  assert.equal(titleAt('/events?when=september'), eventsViewMetadata('all').title, 'the retired 九月回顾 lists 全部日期');
  assert.equal(titleAt('/events?view=perks&when=november'), eventsViewMetadata('perks').title, 'a board keeps its own title');
});
