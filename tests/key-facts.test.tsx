import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
});
// In-memory clipboard double: tests never touch a real clipboard.
const clipboard = { writes: [] as string[], writeText: async (text: string) => { clipboard.writes.push(text); } };
Object.defineProperty(dom.window.navigator, 'clipboard', { configurable: true, value: clipboard });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, within, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { GuideDetail } = await import('../src/components/GuideDetail');
// The article’s block renderers (the fallback 30 秒看懂 among them) load with its record in the app (guide-blocks.ts).
await (await import('../src/features/guides/guide-blocks')).preloadAllGuideBlocks();
const { getGuideBySlug } = await import('../src/data/guides');
const { getGuideEditorial } = await import('../src/data/guide-editorial');
const { READER_LIBRARY_KEY } = await import('../src/lib/reader-library');

afterEach(() => { cleanup(); clipboard.writes.length = 0; window.localStorage.clear(); });
const props = { onOpenGuide: () => {}, onNavigate: () => {}, onOpenPost: () => {} };
const article = (slug: string, extra: { onAsk?: (question: string) => void } = {}) =>
  render(<MemoryRouter initialEntries={[`/guides/${slug}`]}><GuideDetail slug={slug} today="2026-10-10" {...props} {...extra} /></MemoryRouter>);

test('30 秒看懂: three to five rows, phone values are tap-to-call, ① marks jump to the source list', () => {
  for (const slug of ['bay-area-chinese-senior-services-referral-guide', 'bay-area-medicare-hicap-medi-cal-guide', 'california-driver-license-id-preparation-guide']) {
    const view = article(slug);
    const card = view.getByRole('heading', { name: '30 秒看懂' }).closest('section')!;
    const rows = card.querySelectorAll('li');
    assert.equal(rows.length, getGuideEditorial(slug)!.keyFacts.length, slug);
    assert.ok(rows.length >= 3 && rows.length <= 5);
    for (const mark of card.querySelectorAll('a.gd-source-mark')) {
      const target = mark.getAttribute('href')!.slice(1);
      assert.ok(view.container.querySelector(`#${target}`), `${slug}: ${target} exists in the source list`);
    }
    cleanup();
  }
  const view = article('bay-area-medicare-hicap-medi-cal-guide');
  const card = view.getByRole('heading', { name: '30 秒看懂' }).closest('section')!;
  assert.ok(within(card).getByRole('link', { name: '拨打 1-800-434-0222' }));
});

test('contact cards: the number large and whole, [拨打] dials it, [复制] copies it, an address opens the map', async () => {
  const view = article('bay-area-chinese-senior-services-referral-guide');
  const contacts = view.getByRole('heading', { name: '联系电话' }).closest('section')!;
  const cards = contacts.querySelectorAll('article');
  assert.equal(cards.length, getGuideEditorial('bay-area-chinese-senior-services-referral-guide')!.contacts!.length);
  const selfHelp = [...cards].find(card => card.textContent?.includes('415-677-7556'))!;
  assert.equal(within(selfHelp as HTMLElement).getByRole('link', { name: '拨打 安老自助处 成人日间照护 415-677-7556' }).getAttribute('href'), 'tel:+14156777556');
  assert.deepEqual([...selfHelp.querySelectorAll('.ui-status')].map(chip => chip.textContent), ['普通话', '粤语', '台山话']);
  assert.match(within(selfHelp as HTMLElement).getByRole('link', { name: '在地图打开' }).getAttribute('href')!, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Jackie/);
  await act(async () => { fireEvent.click(within(selfHelp as HTMLElement).getByRole('button', { name: '复制号码 415-677-7556' })); });
  assert.deepEqual(clipboard.writes, ['415-677-7556']);
  assert.ok(within(selfHelp as HTMLElement).getByText('已复制'));
});

test('a contact with two places gets one map link per address, never both addresses in one search', () => {
  const view = article('bay-area-chinese-senior-services-referral-guide');
  const hongLok = [...view.getByRole('heading', { name: '联系电话' }).closest('section')!.querySelectorAll('article')].find(card => card.textContent?.includes('510-763-9017')) as HTMLElement;
  const maps = within(hongLok).getAllByRole('link', { name: /^在地图打开/ });
  assert.deepEqual(maps.map(link => new URL(link.getAttribute('href')!).searchParams.get('query')), ['168 11th Street, Oakland', '388 9th Street #290, Oakland']);
  assert.ok(maps.every(link => link.getAttribute('target') === '_blank' && link.getAttribute('rel') === 'noopener noreferrer'));
  assert.equal(hongLok.querySelectorAll('.gd-contact__actions a[href*="google.com/maps"]').length, 0, 'no third map button that searches both');
});

test('step cards: each H2 keeps its anchor, gains a number and a conclusion, and the original text folds under 展开原文与来源', () => {
  const slug = 'bay-area-chinese-senior-services-referral-guide';
  const guide = getGuideBySlug(slug)!;
  const view = article(slug);
  const headings = guide.blocks.flatMap((block, index) => block.type === 'heading' ? [{ text: block.text, index }] : []);
  const steps = view.container.querySelectorAll('.gd-step');
  assert.equal(steps.length, headings.length);
  headings.forEach(({ text, index }, order) => {
    const step = steps[order];
    assert.equal(step.querySelector('h2')?.id, `guide-section-${index}`);
    assert.equal(step.querySelector('h2')?.textContent, text);
    assert.equal(step.querySelector('.gd-step__number')?.textContent, String(order + 1));
    assert.ok(step.querySelector('.gd-step__conclusion')?.textContent);
    const details = step.querySelector('details');
    assert.ok(details && !details.open, 'the original text starts folded');
    assert.equal(details.querySelector('summary')?.textContent, '展开原文与来源');
    assert.ok(view.container.querySelector(`a[href="#guide-section-${index}"]`), 'the contents still link to the section');
  });
  // Numbers in a conclusion are tap-to-call too.
  assert.ok(steps[1].querySelector('.gd-step__conclusion a[href="tel:+18005102020"]'));
});

test('three actions in one row: 收藏 saves to the reader library, 问 BayBay asks about this guide', () => {
  const asked: string[] = [];
  const view = article('bay-area-medicare-hicap-medi-cal-guide', { onAsk: question => asked.push(question) });
  const actions = view.getByRole('group', { name: '文章操作' });
  assert.deepEqual(within(actions).getAllByRole('button').map(button => button.textContent), ['收藏', '发给家人', '问 BayBay']);
  fireEvent.click(within(actions).getByRole('button', { name: '收藏' }));
  assert.equal(within(actions).getByRole('button', { name: '已收藏' }).getAttribute('aria-pressed'), 'true');
  // The save store is main's today and WEB-SAVES' one model after it merges; the reading history stays in the reader library.
  assert.deepEqual(JSON.parse(window.localStorage.getItem(READER_LIBRARY_KEY)!).recent, ['bay-area-medicare-hicap-medi-cal-guide'], 'opening a guide records it in 最近读过');
  fireEvent.click(within(actions).getByRole('button', { name: '问 BayBay' }));
  assert.equal(asked.length, 1);
  assert.match(asked[0], /^我正在读《在湾区弄清 Medicare、Medi-Cal：先找免费 HICAP 咨询》。.*第一步/);
  assert.doesNotMatch(asked[0], /出发前/);
});

test('问 BayBay on a school guide asks for enrollment steps and only area and grade, never a child’s details', () => {
  const asked: string[] = [];
  const view = article('sf-school-district-enrollment-guide', { onAsk: question => asked.push(question) });
  fireEvent.click(within(view.getByRole('group', { name: '文章操作' })).getByRole('button', { name: '问 BayBay' }));
  assert.equal(asked.length, 1);
  assert.match(asked[0], /^我正在读《.+》。根据这篇学校与学区指南，帮我整理入学步骤/);
  assert.match(asked[0], /只需了解地区与年级，不要让我在聊天中提交孩子个人资料或证件/);
});

test('发给家人 copies a link that opens at 特大 with 简洁显示', async () => {
  const view = article('bay-area-chinese-senior-services-referral-guide');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '发给家人' })); });
  assert.equal(clipboard.writes.length, 1);
  const link = clipboard.writes[0].split('\n').pop()!;
  const url = new URL(link);
  assert.equal(url.pathname, '/guides/bay-area-chinese-senior-services-referral-guide');
  assert.equal(url.searchParams.get('reading'), 'extra-large');
  assert.equal(url.searchParams.get('simple'), '1');
  assert.ok(view.getByText(/链接已复制/));
});
