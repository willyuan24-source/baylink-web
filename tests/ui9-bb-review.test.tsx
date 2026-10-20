// UI9-BB review fixes: the 简洁显示 row cards keep C's provenance credit and the ✓ line, the ✓ line names a press source on
// every card kind, the cards stack at 特大, a card tap stays in the app, plan citations collapse per page and name their
// owner, a plan answer reads lead → calls → plan, the header stays one row, and a 911 turn has no guest sign-in note.
import { mockBayBayFetch } from './baybay-test-transport';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, location: dom.window.location, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
dom.window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof dom.window.matchMedia;

const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { BayBayAssistantEntry } = await import('../src/components/BayBayAssistantEntry');
const { BayBayAssistantPlanCard } = await import('../src/components/BayBayAssistantPlan');
const { stopCitations } = await import('../src/features/baybay/plan-citations');
const { parseBayBayAssistantFields } = await import('../src/lib/baybay-assistant');
const { BayBayCardRailView } = await import('../src/features/baybay/BayBayCards');
const { bayBayCardModels } = await import('../src/features/baybay/answer-cards');
const { cardCheck, pressSource } = await import('../src/features/baybay/card-check');
const { bayBayPageKey } = await import('../src/features/baybay/site-path');
const { setSimpleDisplay, setReadingSize } = await import('../src/lib/reading-preferences');
const { resetSaveStore } = await import('../src/lib/saves');
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); localStorage.clear(); resetSaveStore(); setSimpleDisplay(false); setReadingSize('standard'); await setLocale('zh-Hans', false); });
const noop = () => {};
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const TODAY = '2026-10-09';
const zh = (text: string) => text;
const live = JSON.parse(readFileSync(new URL('./support/baybay-l07-plan.json', import.meta.url), 'utf8'));
const CARDS = [
  { kind: 'event', id: 'ferry-plaza-farmers-market-2026-autumn', title: 'Ferry Plaza 农夫市集：海边逛一圈', url: '/events/ferry-plaza-farmers-market-2026-autumn', summary: '', date: '2026-10-10', temporalStatus: 'upcoming' },
  { kind: 'event', id: 'santa-clara-library-comic-con-2026', title: 'Santa Clara 图书馆免费 Comic Con', url: '/events/santa-clara-library-comic-con-2026', summary: '', date: '2026-10-10', temporalStatus: 'upcoming' },
  { kind: 'event', id: 'mountain-view-oktoberfest-2026', title: 'Mountain View Oktoberfest', url: '/events/mountain-view-oktoberfest-2026', summary: '', date: '2026-10-10', temporalStatus: 'upcoming' },
  { kind: 'offer', id: 'apple-kids-earth-comics', title: '免费亲子课：用 iPad 做地球主题漫画', url: '/offers/apple-kids-earth-comics', summary: '' },
] as const;

test('简洁显示: at most two row cards, no ♡; a photo keeps its provenance as the credit line, a type cover is the mini family; every row has its ✓ line', async () => {
  await act(async () => { setSimpleDisplay(true); });
  const models = bayBayCardModels(CARDS as never, TODAY);
  const view = render(<BayBayCardRailView cards={CARDS as never} today={TODAY} onNavigate={noop} />);
  const list = view.container.querySelector('.bb-cards')!;
  assert.equal(list.getAttribute('data-layout'), 'rows');
  const rows = [...list.querySelectorAll('.ui-row-card')];
  assert.equal(rows.length, 2, 'at most two');
  assert.equal(list.querySelector('.ui-save'), null, 'no ♡ in 简洁显示');
  rows.forEach((row, index) => {
    const model = models[index];
    const credit = row.querySelector('.ui-row-card__credit');
    if (model.cover.tier === 'type') {
      assert.equal(credit, null, `${model.key}: a type cover has no photo to credit`);
      assert.ok(row.querySelector('.ui-row-card__thumb [data-size="mini"]'), `${model.key}: the mini family, never the full cover cropped`);
    } else {
      assert.equal(credit?.textContent, model.cover.label.zh, `${model.key}: the photo's provenance (官方图 …) as the row's credit`);
    }
    const check = row.querySelector('.ui-row-card__meta .bb-card__check');
    assert.match(check?.textContent || '', /^官网核对 \d{1,2}\/\d{1,2}$/, `${model.key}: the ✓ line stays (decisions 3, 17)`);
    assert.ok(check?.querySelector('svg'), 'with the check mark');
  });
  assert.deepEqual(models.slice(0, 2).map(model => model.cover.tier === 'type'), [false, true], 'the fixture covers a photo and a type cover');
});

test('the ✓ line reads 媒体报道 · M/D 核对 for a press source on events, offers and openings; 官网核对 otherwise', () => {
  const t = zh as (zh: string, en: string) => string;
  const [ross] = bayBayCardModels([{ kind: 'event', id: 'r2-santarosa-ross-street-sundays-2026', title: 'Ross Street', url: '/events/r2-santarosa-ross-street-sundays-2026', summary: '' }] as never, '2026-10-01');
  assert.ok(ross, 'the live event with a 媒体报道 source label');
  assert.match(cardCheck(ross, t, false) || '', /^媒体报道 · \d{1,2}\/\d{1,2} 核对$/);
  const [offer] = bayBayCardModels([{ kind: 'offer', id: 'pacific-catch-aloha-corte-madera-20261005', title: 'Aloha Hour', url: '/offers/pacific-catch-aloha-corte-madera-20261005', summary: '' }] as never, '2026-10-01');
  assert.ok(offer, 'the live offer whose source label is 媒体报道 · visitmarin.org');
  assert.equal(cardCheck(offer, t, false), '媒体报道 · 9/28 核对');
  assert.equal(cardCheck(offer, (_zh, en) => en, true), 'News report · checked Sep 28');
  const shop = { kind: 'opening', key: 'opening:x', id: 'x', url: '/openings/x', title: 'x', ended: false, cover: { tier: 'type' }, shop: { verifiedAt: '2026-10-02', sourceLabel: 'SFGATE 报道' } } as never;
  assert.equal(cardCheck(shop, t, false), '媒体报道 · 10/2 核对');
  const official = { ...(shop as object), shop: { verifiedAt: '2026-10-02', sourceLabel: '主办方官网' } } as never;
  assert.equal(cardCheck(official, t, false), '官网核对 10/2');
  assert.equal(pressSource('媒體報導 · sfchronicle.com'), true, 'Traditional spelling');
  assert.equal(pressSource(undefined), false);
});

test('特大: the rail stacks (no sideways scroller); the stacking rule keys on the html reading attribute', async () => {
  await act(async () => { setReadingSize('extra-large'); });
  assert.equal(document.documentElement.getAttribute('data-reading'), 'extra-large');
  const view = render(<BayBayCardRailView cards={CARDS as never} today={TODAY} onNavigate={noop} />);
  assert.equal(view.container.querySelector('.bb-cards')?.getAttribute('data-layout'), 'rail', '特大 keeps the feed cards, stacked by CSS');
  assert.equal(view.container.querySelectorAll('.ui-feed-card').length, 4);
  const css = readFileSync('src/features/baybay/baybay-answer.css', 'utf8');
  assert.match(css, /html:is\(\[data-reading=extra-large\],\[data-simple\]\) \.baybay-conversation \.bb-cards,\.baybay-conversation \.bb-cards\[data-layout=rows\] \{ flex-direction:column; overflow:visible; scroll-snap-type:none; \}/);
  assert.match(css, /html:is\(\[data-reading=extra-large\],\[data-simple\]\) \.baybay-conversation \.bb-card \{ flex-basis:auto; \}/);
});

test('a card tap opens the page in the app (onNavigate, no document load); a modified click is left to the browser', () => {
  const paths: string[] = [];
  const view = render(<BayBayCardRailView cards={CARDS.slice(0, 1) as never} today={TODAY} onNavigate={path => paths.push(path)} />);
  const link = view.container.querySelector('.ui-card-link')!;
  assert.equal(fireEvent.click(link), false, 'the default (a full page load) is prevented');
  assert.deepEqual(paths, ['/events/ferry-plaza-farmers-market-2026-autumn']);
  assert.equal(fireEvent.click(link, { ctrlKey: true }), true, 'ctrl-click: a new tab, as usual');
  assert.deepEqual(paths, ['/events/ferry-plaza-farmers-market-2026-autumn']);
});

const evidence = (id: string, url: string, title = 'Source', verification = 'catalog') => ({ id, kind: 'web', title, url, checkedAt: '2026-10-02', verification });
function planWith(stop: Record<string, unknown>, sources: ReturnType<typeof evidence>[]) {
  const parsed = parseBayBayAssistantFields({ ...live, evidence: [...live.evidence, ...sources], assistantPlan: { ...live.assistantPlan, stops: [{ ...live.assistantPlan.stops[0], ...stop }] } });
  return parsed;
}

test('plan citations: one per page (www, trailing slash and relative site links compare equal); the admission source is the one kept', () => {
  assert.equal(bayBayPageKey('https://www.example.org/visit/'), bayBayPageKey('https://example.org/visit'));
  assert.equal(bayBayPageKey('https://www.baylink.us/guides/x/'), bayBayPageKey('/guides/x'));
  // The same page under two ids; the second is the admission source.
  const parsed = planWith({ sourceIds: ['a', 'b'], admissionFacts: {
    status: 'complete', basis: 'catalog-snapshot', knownTotalUsd: 0, sourceUrl: 'https://www.example.org/visit/', checkedAt: '2026-10-04', sourceIds: ['b'],
    breakdown: [{ category: 'group', quantity: 1, unitUsd: 0, subtotalUsd: 0 }], applicability: { date: '2026-10-17', dateStatus: 'regular-unconfirmed', feesIncluded: true }, unknowns: [],
  } }, [evidence('a', 'https://example.org/visit', 'Visit page'), evidence('b', 'https://www.example.org/visit/', 'Visit page (prices)')]);
  const kept = stopCitations(parsed.assistantPlan!.stops[0], new Map(parsed.evidence!.map(item => [item.id, item])));
  assert.deepEqual(kept.map(item => item.id), ['b'], 'one citation, the one that carries the admission stamp');
  assert.ok(kept[0].priceSource);
  const view = render(<BayBayAssistantPlanCard plan={parsed.assistantPlan!} evidence={parsed.evidence!} disabled={false} onAsk={noop} onNavigate={noop} />);
  const links = [...view.container.querySelectorAll('.baybay-plan-stops > li:first-child .baybay-plan-citations a')];
  assert.equal(links.length, 1);
  assert.match(links[0].textContent || '', /门票依据：资料快照 · 2026-10-04/);
});

test('plan citations: the stop\'s own page is not repeated under it while another source remains; each line names its owner', () => {
  const parsed = planWith({ path: '/guides/sf-chinatown-north-beach-walk-guide', sourceIds: ['own', 'other'], admissionFacts: undefined }, [
    evidence('own', 'https://www.baylink.us/guides/sf-chinatown-north-beach-walk-guide/', '唐人街与 North Beach', 'site-record'),
    evidence('other', 'https://www.sftravel.com/neighborhoods/visit-chinatown', '唐人街与 North Beach'),
  ]);
  const stop = parsed.assistantPlan!.stops[0];
  assert.ok(stop.link, 'the stop links its own guide page');
  assert.deepEqual(stopCitations(stop, new Map(parsed.evidence!.map(item => [item.id, item]))).map(item => item.id), ['other']);
  // Alone, the stop's own page stays (never "no usable source"), labelled as a BAYLINK guide.
  const alone = planWith({ path: '/guides/sf-chinatown-north-beach-walk-guide', sourceIds: ['own'], admissionFacts: undefined }, [evidence('own', 'https://www.baylink.us/guides/sf-chinatown-north-beach-walk-guide', '唐人街与 North Beach', 'site-record')]);
  const view = render(<BayBayAssistantPlanCard plan={alone.assistantPlan!} evidence={alone.evidence!} disabled={false} onAsk={noop} onNavigate={noop} />);
  assert.equal(view.container.querySelector('.baybay-plan-stops > li:first-child .baybay-plan-citation-host')?.textContent, '· BAYLINK 指南');
  cleanup();
  // The live L07 reply: stop 3's guide page and sftravel.com share one title; the reader now sees one line, with its host.
  const l07 = parseBayBayAssistantFields(live);
  const card = render(<BayBayAssistantPlanCard plan={l07.assistantPlan!} evidence={l07.evidence!} disabled={false} onAsk={noop} onNavigate={noop} />);
  const third = card.container.querySelectorAll('.baybay-plan-stops > li')[2];
  const lines = [...third.querySelectorAll('.baybay-plan-citations a')].map(link => link.querySelector('span')?.textContent);
  assert.deepEqual(lines, ['唐人街与 North Beach· sftravel.com']);
  // Same title, different hosts: both stay, told apart by their host.
  const twin = planWith({ sourceIds: ['x', 'y'], admissionFacts: undefined }, [evidence('x', 'https://a.example.org/p', 'Same title'), evidence('y', 'https://b.example.org/p', 'Same title')]);
  cleanup();
  const twins = render(<BayBayAssistantPlanCard plan={twin.assistantPlan!} evidence={twin.evidence!} disabled={false} onAsk={noop} onNavigate={noop} />);
  assert.deepEqual([...twins.container.querySelectorAll('.baybay-plan-stops > li:first-child .baybay-plan-citation-host')].map(host => host.textContent), ['· a.example.org', '· b.example.org']);
});

test('the 待核实 line separates its label in text ("待核实：…" / "To check: …"), so a screen reader never runs them together', async () => {
  const l07 = parseBayBayAssistantFields(live);
  const view = render(<BayBayAssistantPlanCard plan={l07.assistantPlan!} evidence={l07.evidence!} disabled={false} onAsk={noop} onNavigate={noop} />);
  assert.match(view.container.querySelector('.baybay-plan-stop-unknown')?.textContent || '', /^待核实：\S/);
  cleanup();
  await setLocale('en', false);
  const en = render(<BayBayAssistantPlanCard plan={l07.assistantPlan!} evidence={l07.evidence!} disabled={false} onAsk={noop} onNavigate={noop} />);
  assert.match(en.container.querySelector('.baybay-plan-stop-unknown dt')?.textContent || '', /^To check:$/);
});

const props = { variant: 'headless' as const, panelOpen: true, onPanelOpenChange: noop, onNavigate: noop, onCreatePostClick: noop };

test('a plan answer with safety calls reads lead → calls → plan, and each call shows once', async t => {
  const floor = { actions: [{ id: 'call-911', label: '911', href: 'tel:911' }, { id: 'call-211', label: '211', href: 'tel:211' }] };
  assert.ok(live.lead && live.points, 'the L07 reply is a v2 answer');
  mockBayBayFetch(t, async () => Response.json({ ...live, fallbackHelp: floor }));
  render(<BayBayAssistantEntry {...props} pendingQuestion="周六带长辈去旧金山半天怎么安排" pendingQuestionId={1} />);
  await act(async () => { await sleep(30); });
  const answer = document.querySelector('.bb-answer[data-plan]')!;
  assert.ok(answer, 'the plan sits in the answer body');
  const order = [...answer.children].map(child => child.classList.contains('bb-lead') ? 'lead' : child.classList.contains('bb-call-actions') ? 'calls' : child.classList.contains('baybay-assistant-plan') ? 'plan' : child.className.split(' ')[0]);
  assert.deepEqual(order.slice(0, 3), ['lead', 'calls', 'plan'], order.join(' → '));
  assert.equal(document.querySelectorAll('a[href="tel:911"]').length, 1, '911 once');
  assert.equal(document.querySelectorAll('a[href="tel:211"]').length, 1, '211 once');
});

test('the header: 新对话 keeps its words in Chinese at 标准; English, 特大 and 简洁显示 make it a named icon on the same row', async t => {
  mockBayBayFetch(t, async () => Response.json({ ok: true, answer: '好的。' }));
  const first = render(<BayBayAssistantEntry {...props} pendingQuestion="周末去哪" pendingQuestionId={1} />);
  await first.findByText('好的。');
  const head = document.querySelector('.bb-head')!;
  assert.equal(head.hasAttribute('data-compact'), false);
  assert.equal(first.getByRole('button', { name: '新对话' }).querySelector('.bb-head__new-label')?.textContent, '新对话');
  cleanup();
  await act(async () => { setReadingSize('extra-large'); });
  const xl = render(<BayBayAssistantEntry {...props} pendingQuestion="周末去哪" pendingQuestionId={2} />);
  await xl.findByText('好的。');
  assert.equal(document.querySelector('.bb-head')?.hasAttribute('data-compact'), true);
  assert.ok(xl.getByRole('button', { name: '新对话' }).querySelector('svg'), 'an icon with the same accessible name');
  const css = readFileSync('src/features/baybay/baybay-panel.css', 'utf8');
  assert.match(css, /\.bb-head h2 \{[^}]*white-space:nowrap; \}/, 'the title never breaks into 问 / BayBay');
  assert.doesNotMatch(css, /"otter new close"/, '新对话 no longer takes a second header row');
  assert.match(css, /@media \(max-width:359px\) \{[^@]*\.bb-head__new-label \{ position:absolute;/, 'below 360px every locale uses the icon');
});

test('a 911 turn shows the emergency card with no guest sign-in note above it', async t => {
  mockBayBayFetch(t, async () => Response.json({ ok: true, responseMode: 'safety', safetyRoute: 'emergency', answer: '如果有人突然说话不清，请马上打 911。', safety: { kind: 'emergency', topic: 'stroke', title: '现在就打 911', hideFollowups: true, hideFeedback: true, actions: [{ id: 'call-911', label: '拨打 911', href: 'tel:911', primary: true }] }, sources: [], followups: [] }));
  const view = render(<BayBayAssistantEntry {...props} onLoginNeeded={noop} pendingQuestion="我爸说话不清" pendingQuestionId={1} />);
  await act(async () => { await sleep(30); });
  assert.ok(document.querySelector('.member-baybay-answer[data-safety="emergency"]'));
  assert.equal(document.querySelector('.bb-guest-note'), null);
  assert.equal(view.queryByRole('button', { name: '登录 / 注册，开启联网' }), null);
});

test('/plan?baybayDraft: 查看全部原始条件 draws the shared chevron, so it reads as an expander', () => {
  const css = readFileSync('src/features/baybay/baybay-imported.css', 'utf8');
  assert.match(css, /\.baybay-imported-requirements summary::after \{ content:""; [^}]*rotate:45deg;/);
  assert.match(css, /details\[open\]>summary::after \{ rotate:225deg;/);
  assert.match(css, /summary::-webkit-details-marker \{ display:none; \}/);
});
