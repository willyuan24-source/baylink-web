import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { guides, type Guide } from '../src/data/guides';
import { GUIDE_IMAGES, getGuideMedia } from '../src/data/guide-media';
import { getBayAreaToday } from '../src/lib/monthly';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter } = await import('react-router-dom');
const { MonthlyDealsSpotlight, GuideEditionNotice } = await import('../src/components/MonthlyDealsSpotlight');
const { GuideDetail } = await import('../src/components/GuideDetail');
const { GuidesHome } = await import('../src/components/GuidesHome');
const { MonthlyEdition } = await import('../src/components/MonthlyEdition');

const slug = 'bay-area-freebies-deals-2026-09';
const fixture: Guide = {
  ...guides[0], slug, title: '九月咖啡与甜点优惠领取指南', editionMonth: '2026-09', updatedAt: '2026-09-08',
  cover: undefined, blocks: [
    { type: 'heading', text: '先看领取条件' },
    { type: 'paragraph', text: '领取时间、门店范围和会员要求都需要先确认。' },
    { type: 'link', title: '品牌官方领取说明', text: '查看参与门店和有效期。', url: 'https://example.com/rewards' },
    { type: 'link', title: '无效来源仍保留说明', text: '链接异常时保留可读文本。', url: 'javascript:alert(1)' },
  ],
};
const previousGuide = guides.find(guide => guide.slug === slug);
const previousArt = GUIDE_IMAGES['september-freebies'];
function installFixture() {
  const index = guides.findIndex(guide => guide.slug === slug);
  if (index >= 0) guides.splice(index, 1, fixture); else guides.push(fixture);
  GUIDE_IMAGES['september-freebies'] = { ...GUIDE_IMAGES.settling, src: '/test/freebies.webp', alt: '咖啡与甜点的专属优惠插图' };
}
afterEach(() => {
  cleanup();
  const index = guides.findIndex(guide => guide.slug === slug);
  if (index >= 0) {
    if (previousGuide) guides.splice(index, 1, previousGuide); else guides.splice(index, 1);
  }
  if (previousArt) GUIDE_IMAGES['september-freebies'] = previousArt; else delete GUIDE_IMAGES['september-freebies'];
});
const actions = { onBack: () => {}, onOpenGuide: () => {}, onNavigate: () => {}, onOpenPost: () => {} };

test('deals spotlight reads the published guide and becomes an archive after its edition month', () => {
  installFixture();
  const opened: string[] = [];
  const view = render(<MemoryRouter><MonthlyDealsSpotlight today="2026-09-30" onOpenGuide={value => opened.push(value)} /></MemoryRouter>);
  const link = view.getByRole('link', { name: `阅读${fixture.title}` });
  assert.equal(link.getAttribute('href'), `/guides/${slug}`);
  assert.ok(view.getByRole('heading', { name: fixture.title }));
  assert.ok(view.getByText('2026 年 9 月 · 优惠领取指南'));
  assert.ok(view.getByText('从免费小蛋糕到 $1 冷萃，连同 Target、亲子手工和会员折扣，按日期与条件挑。'));
  assert.equal(view.container.querySelector('img')?.getAttribute('src'), getGuideMedia(fixture).cover.src);
  assert.equal(view.container.querySelector('time')?.dateTime, fixture.updatedAt);
  fireEvent.click(link);
  assert.deepEqual(opened, [slug]);
  view.rerender(<MemoryRouter><MonthlyDealsSpotlight today="2026-10-01" /></MemoryRouter>);
  assert.ok(view.getByText('2026 年 9 月 · 往期优惠攻略'));
  assert.ok(view.getByText(/不能当作实时优惠/));
  assert.ok(view.getByText('查看往期'));
  assert.doesNotMatch(view.container.textContent || '', /本月|看看怎么领/);
});

test('edition notice changes at Los Angeles midnight and preserves the explicit checked date', () => {
  const before = getBayAreaToday(new Date('2026-10-01T06:59:59Z'));
  const after = getBayAreaToday(new Date('2026-10-01T07:00:00Z'));
  assert.equal(before, '2026-09-30');
  assert.equal(after, '2026-10-01');
  const view = render(<GuideEditionNotice editionMonth="2026-09" checkedAt="2026-09-08" today={before} />);
  assert.ok(view.getByRole('complementary', { name: '攻略期次与核对日期' }));
  assert.ok(view.getByText('2026 年 9 月 · 本期攻略'));
  assert.equal(view.queryByText(/往期攻略/), null);
  assert.equal(view.container.querySelector('time')?.dateTime, '2026-09-08');
  view.rerender(<GuideEditionNotice editionMonth="2026-09" checkedAt="2026-09-08" today={after} />);
  assert.ok(view.getByText('往期攻略 · 2026 年 9 月'));
  assert.ok(view.getByText(/不能当作实时优惠/));
});

test('monthly guide includes its edition notice and safe inline official links in both interactive and server HTML', () => {
  installFixture();
  const view = render(<MemoryRouter><GuideDetail slug={slug} today="2026-10-01" {...actions} /></MemoryRouter>);
  assert.ok(view.getByText('往期攻略 · 2026 年 9 月'));
  const source = view.getByRole('link', { name: /品牌官方领取说明/ });
  assert.equal(source.getAttribute('href'), 'https://example.com/rewards');
  assert.equal(source.getAttribute('target'), '_blank');
  assert.equal(source.getAttribute('rel'), 'noopener noreferrer');
  assert.ok(view.getByText('无效来源仍保留说明'));
  assert.equal(view.queryByRole('link', { name: /无效来源仍保留说明/ }), null);
  const html = renderToStaticMarkup(<StaticRouter location={`/guides/${slug}`}><GuideDetail slug={slug} today="2026-10-01" {...actions} /></StaticRouter>);
  const server = new JSDOM(html).window.document;
  assert.match(server.querySelector('.bl-guide-edition-notice')?.textContent || '', /不能当作实时优惠/);
  assert.equal(server.querySelector('.bl-guide-source-link a')?.getAttribute('href'), 'https://example.com/rewards');
  assert.equal(server.querySelector('[href^="javascript:"]'), null);
  view.rerender(<MemoryRouter><GuideDetail slug="san-francisco-guide" today="2026-10-01" {...actions} /></MemoryRouter>);
  assert.equal(view.queryByRole('complementary', { name: '攻略期次与核对日期' }), null, 'evergreen guides must not receive a monthly-offer notice');
});

test('guide home and monthly edition both expose the new guide as an SSR-readable compact entry', () => {
  installFixture();
  const pages = [
    <StaticRouter location="/guides"><GuidesHome onOpenGuide={() => {}} /></StaticRouter>,
    <StaticRouter location="/this-month"><MonthlyEdition today="2026-10-01" /></StaticRouter>,
  ];
  for (const page of pages) {
    const server = new JSDOM(renderToStaticMarkup(page)).window.document;
    const cards = server.querySelectorAll('.bl-monthly-deals');
    assert.equal(cards.length, 1);
    assert.equal(cards[0].getAttribute('href'), `/guides/${slug}`);
    assert.ok(cards[0].textContent?.includes(fixture.title));
    assert.equal(cards[0].querySelector('time')?.getAttribute('datetime'), fixture.updatedAt);
  }
});

test('the actual September deals guide renders its dedicated art and each inline merchant source', () => {
  assert.ok(previousGuide, 'the published September guide must be registered');
  assert.equal(previousGuide.editionMonth, '2026-09');
  const media = getGuideMedia(previousGuide);
  assert.equal(media.cover.src, GUIDE_IMAGES['september-freebies'].src);
  const sourceBlocks = previousGuide.blocks.filter(block => block.type === 'link');
  assert.ok(sourceBlocks.length >= 1, 'readers should find merchant sources beside the offer descriptions');
  const html = renderToStaticMarkup(<StaticRouter location={`/guides/${slug}`}><GuideDetail slug={slug} today="2026-10-01" {...actions} /></StaticRouter>);
  const server = new JSDOM(html).window.document;
  assert.equal(server.querySelector('h1')?.textContent, previousGuide.title);
  assert.equal(server.querySelector('.guide-figure--cover img')?.getAttribute('src'), media.cover.src);
  assert.match(server.querySelector('.bl-guide-edition-notice')?.textContent || '', /往期攻略 · 2026 年 9 月/);
  const sourceCards = [...server.querySelectorAll('.bl-guide-source-link')];
  assert.equal(sourceCards.length, sourceBlocks.length);
  for (const [index, block] of sourceBlocks.entries()) {
    assert.match(block.url, /^https:\/\//);
    const sourceLink = sourceCards[index].querySelector('a');
    assert.equal(sourceLink?.getAttribute('href'), block.url);
    assert.equal(sourceLink?.getAttribute('target'), '_blank');
    assert.equal(sourceLink?.getAttribute('rel'), 'noopener noreferrer');
    assert.ok(sourceCards[index].textContent?.includes(block.title));
    assert.ok(sourceCards[index].textContent?.includes(block.text));
  }
});
