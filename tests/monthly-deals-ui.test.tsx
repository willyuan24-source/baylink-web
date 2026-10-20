import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { guides, type Guide } from '../src/data/guides';
import { GUIDE_IMAGES, getGuideMedia } from '../src/data/guide-media';
import { discoveryShare, getLocalDiscovery } from '../src/data/local-discoveries';
import { getBayAreaToday } from '../src/lib/monthly';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// The events column imports its stylesheet; here CSS loads as an empty module.
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { render, cleanup } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter } = await import('react-router-dom');
const { GuideEditionNotice } = await import('../src/components/GuideEditionNotice');
const { GuideDetail } = await import('../src/components/GuideDetail');
const { GuidesHome } = await import('../src/components/GuidesHome');
const { default: PerksView } = await import('../src/features/events/PerksView');
// WEB-DATA-SPLIT: an article renders its generated record; a fixture guide gets a record built the same way, and the deals
// board is a chunk the article loads with its record (the page waits for it, so do the tests).
const { guideRecordOf } = await import('../src/features/guides/guide-data');
await (await import('../src/features/guides/guide-blocks')).preloadAllGuideBlocks();
const recordFor = (guide: Guide) => guideRecordOf(guide, item => ({ 'zh-Hans': getGuideMedia(item).cover }));

const slug = 'bay-area-freebies-deals-2026-11';
const fixture: Guide = {
  ...guides[0], slug, title: '九月咖啡与甜点优惠领取指南', editionMonth: '2026-09', editionStartDate: undefined, editionThroughDate: undefined, updatedAt: '2026-09-08',
  cover: undefined, blocks: [
    { type: 'heading', text: '先看领取条件' },
    { type: 'paragraph', text: '领取时间、门店范围和会员要求都需要先确认。' },
    { type: 'link', title: '品牌官方领取说明', text: '查看参与门店和有效期。', url: 'https://example.com/rewards' },
    { type: 'link', title: '无效来源仍保留说明', text: '链接异常时保留可读文本。', url: 'javascript:alert(1)' },
  ],
};
const previousGuide = guides.find(guide => guide.slug === slug);
const previousArt = GUIDE_IMAGES['sep26-peets-orange'];
function installFixture() {
  const index = guides.findIndex(guide => guide.slug === slug);
  if (index >= 0) guides.splice(index, 1, fixture); else guides.push(fixture);
  GUIDE_IMAGES['sep26-peets-orange'] = { ...GUIDE_IMAGES.settling, src: '/test/freebies.webp', alt: '咖啡与甜点的专属优惠插图' };
}
afterEach(() => {
  cleanup();
  const index = guides.findIndex(guide => guide.slug === slug);
  if (index >= 0) {
    if (previousGuide) guides.splice(index, 1, previousGuide); else guides.splice(index, 1);
  }
  if (previousArt) GUIDE_IMAGES['sep26-peets-orange'] = previousArt; else delete GUIDE_IMAGES['sep26-peets-orange'];
});
const actions = { onBack: () => {}, onOpenGuide: () => {}, onNavigate: () => {}, onOpenPost: () => {} };

test('the 免费与优惠 board sends readers to the current deals guide, which the guide library still lists', () => {
  const view = render(<MemoryRouter><PerksView today="2026-10-09" region="all" /></MemoryRouter>);
  assert.equal(view.getByRole('link', { name: '这一期的优惠怎么领' }).getAttribute('href'), `/guides/${slug}`);
  assert.ok(guides.some(guide => guide.slug === slug && guide.editionMonth), 'the linked deals guide is published as a monthly edition');
});

test('edition notice changes at Los Angeles midnight and preserves the explicit checked date', () => {
  const before = getBayAreaToday(new Date('2026-10-01T06:59:59Z'));
  const after = getBayAreaToday(new Date('2026-10-01T07:00:00Z'));
  assert.equal(before, '2026-09-30');
  assert.equal(after, '2026-10-01');
  const view = render(<GuideEditionNotice editionMonth="2026-09" checkedAt="2026-09-08" today={before} />);
  assert.ok(view.getByRole('complementary', { name: '攻略期次与内容日期' }));
  assert.ok(view.getByText('2026 年 9 月 · 本期攻略'));
  assert.equal(view.queryByText(/往期攻略/), null);
  assert.equal(view.container.querySelector('time')?.dateTime, '2026-09-08');
  view.rerender(<GuideEditionNotice editionMonth="2026-09" checkedAt="2026-09-08" today={after} />);
  assert.ok(view.getByText('往期攻略 · 2026 年 9 月'));
  assert.ok(view.getByText(/不能当作实时优惠/));
});

test('monthly guide includes its edition notice and safe inline official links in both interactive and server HTML', () => {
  installFixture();
  const view = render(<MemoryRouter><GuideDetail slug={slug} record={recordFor(fixture)} today="2026-10-01" {...actions} /></MemoryRouter>);
  assert.ok(view.getByText('往期攻略 · 2026 年 9 月'));
  const source = view.getByRole('link', { name: /品牌官方领取说明/ });
  assert.equal(source.getAttribute('href'), 'https://example.com/rewards');
  assert.equal(source.getAttribute('target'), '_blank');
  assert.equal(source.getAttribute('rel'), 'noopener noreferrer');
  assert.ok(view.getByText('无效来源仍保留说明'));
  assert.equal(view.queryByRole('link', { name: /无效来源仍保留说明/ }), null);
  const html = renderToStaticMarkup(<StaticRouter location={`/guides/${slug}`}><GuideDetail slug={slug} record={recordFor(fixture)} today="2026-10-01" {...actions} /></StaticRouter>);
  const server = new JSDOM(html).window.document;
  assert.match(server.querySelector('.bl-guide-edition-notice')?.textContent || '', /不能当作实时优惠/);
  assert.equal(server.querySelector('.bl-guide-source-link a')?.getAttribute('href'), 'https://example.com/rewards');
  assert.equal(server.querySelector('[href^="javascript:"]'), null);
  view.rerender(<MemoryRouter><GuideDetail slug="san-francisco-guide" today="2026-10-01" {...actions} /></MemoryRouter>);
  assert.equal(view.queryByRole('complementary', { name: '攻略期次与内容日期' }), null, 'evergreen guides must not receive a monthly-offer notice');
});

test('the compact guide library retains the published deal guide and shows no promotional card', () => {
  // The library renders the generated index (WEB-DATA-SPLIT): the published deals guide, not a fixture, is what it lists.
  const published = previousGuide!;
  const library = new JSDOM(renderToStaticMarkup(<StaticRouter location="/guides"><GuidesHome onOpenGuide={() => {}} /></StaticRouter>)).window.document;
  assert.equal(library.querySelector('.bl-monthly-deals'), null);
  assert.ok(library.querySelector(`a[href="/guides/${slug}"]`)?.textContent?.includes(published.title));
});

test('the actual October deals guide uses official photography and preserves local discovery entries and safe sources', () => {
  const slug = 'bay-area-freebies-deals-2026-10';
  const previousGuide = guides.find(guide => guide.slug === slug);
  assert.ok(previousGuide, 'the published October guide must be registered');
  assert.equal(previousGuide.editionMonth, '2026-10');
  const media = getGuideMedia(previousGuide);
  assert.equal(media.cover.src, GUIDE_IMAGES['official-lowes-firefighting-plane-2026'].src);
  assert.equal(media.cover.kind, 'photo');
  assert.equal(media.cover.creditUrl, 'https://www.lowes.com/events/register/firefighting-plane');
  assert.equal(media.inline[0].image.src, GUIDE_IMAGES['freebie-ikea-coffee'].src);
  assert.equal(media.inline[0].image.kind, 'poster');
  assert.equal(media.inline[0].image.fullFrame, true, 'the IKEA photo-based promotional artwork keeps its complete frame');
  assert.equal(media.inline[0].image.creditUrl, 'https://www.ikea.com/us/en/ikea-family/');
  const sourceBlocks = previousGuide.blocks.filter(block => block.type === 'link');
  assert.ok(sourceBlocks.length >= 1, 'readers should find merchant sources beside the offer descriptions');
  assert.equal(sourceBlocks.filter(block => block.url.startsWith('/')).length, 4, 'the four new discovery entries must remain present');
  const html = renderToStaticMarkup(<StaticRouter location={`/guides/${slug}`}><GuideDetail slug={slug} today="2026-10-01" {...actions} /></StaticRouter>);
  const server = new JSDOM(html).window.document;
  assert.equal(server.querySelector('h1')?.textContent, previousGuide.title);
  assert.equal(server.querySelector('.gd-cover img:not(.ui-cover__backdrop)')?.getAttribute('src'), media.cover.src);
  assert.match(server.querySelector('.gd-meta [data-edition]')?.textContent || '', /2026 年 10 月本期/, 'a current edition says so in the head meta line (UI9-GUIDES)');
  const sourceCards = [...server.querySelectorAll('.bl-guide-source-link')];
  assert.equal(sourceCards.length, sourceBlocks.length);
  for (const [index, block] of sourceBlocks.entries()) {
    const sourceLink = sourceCards[index].querySelector('a');
    assert.equal(sourceLink?.getAttribute('href'), block.url);
    if (block.url.startsWith('/')) {
      const route = /^\/(events|offers)\/([a-z0-9-]+)$/.exec(block.url);
      assert.ok(route, 'local entries must use an actual discovery detail route');
      const discovery = getLocalDiscovery(route[1] === 'events' ? 'event' : 'offer', route[2]);
      assert.ok(discovery, `${block.url} must resolve to published local content`);
      assert.equal(discoveryShare(discovery).path, block.url);
      assert.equal(sourceLink?.getAttribute('target'), null, 'local entries must stay in the current browsing context');
    } else {
      assert.match(block.url, /^https:\/\//);
      assert.equal(sourceLink?.getAttribute('target'), '_blank');
      assert.equal(sourceLink?.getAttribute('rel'), 'noopener noreferrer');
    }
    assert.ok(sourceCards[index].textContent?.includes(block.title));
    assert.ok(sourceCards[index].textContent?.includes(block.text));
  }
});
