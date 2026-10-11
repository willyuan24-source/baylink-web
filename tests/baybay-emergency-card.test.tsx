import { mockBayBayFetch } from './baybay-test-transport';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () { return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList; };
const { render, cleanup, within } = await import('@testing-library/react');
const { BayBayAssistantEntry } = await import('../src/components/BayBayAssistantEntry');
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });
const noop = () => {};
const props = { variant: 'headless' as const, panelOpen: true, onPanelOpenChange: noop, onNavigate: noop, onCreatePostClick: noop };

/** The API's emergency card (api lib/safetyRouting.js emergencyResponse), per locale. */
const emergency = (locale: 'zh-Hans' | 'zh-Hant' | 'en') => {
  const pick = (zh: string, hant: string, en: string) => locale === 'en' ? en : locale === 'zh-Hant' ? hant : zh;
  return { ok: true, responseMode: 'safety', safetyRoute: 'emergency', emergencyTopic: 'stroke', degraded: false,
    answer: pick('请立即拨打 911。记下症状开始的时间。疑似中毒可联系 Poison Control：1-800-222-1222。', '請立即撥打 911。記下症狀開始的時間。疑似中毒可聯絡 Poison Control：1-800-222-1222。', 'Call 911 now. Note the time the symptoms started. For a possible poisoning, call Poison Control at 1-800-222-1222.'),
    safety: { kind: 'emergency', topic: 'stroke', title: pick('现在就打 911', '現在就打 911', 'Call 911 now'), hideFollowups: true, hideFeedback: true,
      actions: [{ id: 'call-911', label: pick('拨打 911', '撥打 911', 'Call 911'), href: 'tel:911', primary: true }, { id: 'call-poison-control', label: 'Poison Control 1-800-222-1222', href: 'tel:+18002221222' }, { id: 'call-988', label: pick('988 危机热线', '988 危機熱線', '988 crisis line'), href: 'tel:988' }] },
    sources: [{ id: 'safety-911', title: '911', url: 'https://www.911.gov/' }], suggestedGuides: [], suggestedActions: [], matchingPosts: [], interactiveCards: [], followups: [] };
};

test('an emergency answer is a red card with a 56px tel:911 button first, without feedback, follow-ups or a site-reference label', async t => {
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    await setLocale(locale, false);
    mockBayBayFetch(t, async () => Response.json(emergency(locale)));
    const view = render(<BayBayAssistantEntry {...props} pendingQuestion="我妈说话突然含糊不清，一边嘴角往下歪" pendingQuestionId={1} />);
    const card = await view.findByRole('alert');
    assert.equal(card.getAttribute('data-safety'), 'emergency');
    const title = within(card).getByRole('heading');
    assert.ok(title.id && card.getAttribute('aria-labelledby') === title.id, 'the card is named by its own heading (one id per card)');
    const links = within(card).getAllByRole('link');
    assert.equal(links[0].getAttribute('href'), 'tel:911', '911 is the first action');
    assert.ok(links[0].classList.contains('bb-emergency__call'), 'the large 56px call button');
    assert.deepEqual(links.slice(1).map(link => link.getAttribute('href')), ['tel:+18002221222', 'tel:988']);
    assert.match(card.textContent || '', locale === 'en' ? /Call 911 now/ : /911/);
    const answer = card.closest('.member-baybay-answer')!;
    assert.equal(answer.firstElementChild, card, 'nothing comes before the emergency card');
    assert.equal(answer.querySelector('.baybay-feedback'), null, 'no feedback buttons');
    assert.equal(answer.querySelector('.member-baybay-answer-label'), null, 'no "BayBay 建议" or site-reference label');
    assert.doesNotMatch(answer.textContent || '', /参考站内资料|參考站內資料|Site references/);
    assert.equal(view.baseElement.querySelector('.baybay-followups:not([role])'), null, 'no follow-up chips under an emergency');
    cleanup();
  }
});

test('a degraded emergency answer still shows the 911 card, and a card without tel:911 falls back to the plain text', async t => {
  mockBayBayFetch(t, async () => Response.json({ ...emergency('zh-Hans'), degraded: true }));
  let view = render(<BayBayAssistantEntry {...props} pendingQuestion="孩子误吞了纽扣电池怎么办" pendingQuestionId={1} />);
  assert.equal((await view.findByRole('alert')).querySelector('a')?.getAttribute('href'), 'tel:911');
  cleanup();
  const forged = emergency('zh-Hans');
  forged.safety.actions = [{ id: 'call-1', label: 'Call', href: 'tel:5551234', primary: true }];
  mockBayBayFetch(t, async () => Response.json(forged));
  view = render(<BayBayAssistantEntry {...props} pendingQuestion="孩子误吞了纽扣电池怎么办" pendingQuestionId={2} />);
  await view.findByText(/请立即拨打 911/);
  assert.equal(view.baseElement.querySelector('[data-safety="emergency"]'), null);
});

test('a professional topic shows the official resource card with tap-to-call numbers and the pillar guide', async t => {
  const paths: string[] = [];
  mockBayBayFetch(t, async () => Response.json({ ok: true, responseMode: 'assistant', safetyRoute: 'professional', safetyTopic: 'medicare',
    lead: 'A 部分管住院，B 部分管看医生和门诊，多数人两部分都有。', points: [{ text: '选哪种计划取决于你的保险、医生和用药，可请 HICAP 免费比较。', cardIds: [] }],
    answer: 'A 部分管住院，B 部分管看医生和门诊，多数人两部分都有。\n\n1. 选哪种计划取决于你的保险、医生和用药，可请 HICAP 免费比较。', sources: [], evidence: [],
    safety: { kind: 'professional', topic: 'medicare', topics: ['medicare'], resources: [{ id: 'hicap', title: 'California Department of Aging: HICAP', url: 'https://aging.ca.gov/Programs_and_Services/Medicare_Counseling/', phone: '1-800-434-0222', href: 'tel:+18004340222' }],
      guides: [{ slug: 'bay-area-medicare-hicap-medi-cal-guide', title: 'Medicare、Medi-Cal 与 HICAP 咨询准备', url: '/guides/bay-area-medicare-hicap-medi-cal-guide' }] } }));
  const view = render(<BayBayAssistantEntry {...props} onNavigate={path => paths.push(path)} pendingQuestion="Medicare A 部分和 B 部分有什么区别？" pendingQuestionId={1} />);
  const card = await view.findByRole('region', { name: '官方求助渠道' });
  assert.equal(within(card).getByRole('link', { name: /拨打 California Department of Aging: HICAP 1-800-434-0222/ }).getAttribute('href'), 'tel:+18004340222');
  within(card).getByRole('link', { name: /Medicare、Medi-Cal 与 HICAP/ }).click();
  assert.deepEqual(paths, ['/guides/bay-area-medicare-hicap-medi-cal-guide']);
  assert.match(card.textContent || '', /不判断个人资格/);
  const lead = view.getByText(/A 部分管住院/);
  assert.ok(lead.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING, 'the answer comes first, then the resource card');
});

test('an answer notice shows above the answer: paused kinds lead with 911 / 211, reduced mode does not', async t => {
  for (const [notice, calls] of [
    [{ kind: 'ai_daily_budget', text: '今日 AI 名额已满，以下为站内资料；明天会恢复。', resumesAt: '2026-10-10T07:00:00.000Z' }, ['tel:911', 'tel:211']],
    [{ kind: 'ai_paused', text: 'AI 助手暂停，以下为站内资料。' }, ['tel:911', 'tel:211']],
    [{ kind: 'ai_budget_reduced', text: '今天 AI 用量较高：先用站内资料快速回答，暂不联网查询。' }, []],
  ] as const) {
    mockBayBayFetch(t, async () => Response.json({ ok: true, degraded: notice.kind !== 'ai_budget_reduced', answer: '以下是站内资料：Fleet Week 10 月 10–11 日有飞行表演。', notice,
      fallbackHelp: { actions: [{ id: 'call-911', label: '911', href: 'tel:911' }, { id: 'call-211', label: '211', href: 'tel:211' }] } }));
    const view = render(<BayBayAssistantEntry {...props} pendingQuestion="蓝天使这周末飞吗" pendingQuestionId={1} />);
    const text = await view.findByText(notice.text);
    const box = text.closest('[data-notice]')!;
    assert.equal(box.getAttribute('data-notice'), notice.kind);
    assert.deepEqual(within(box as HTMLElement).queryAllByRole('link').map(link => link.getAttribute('href')), calls);
    const answer = view.getByText(/以下是站内资料：Fleet Week/);
    assert.ok(box.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING, 'the notice sits above the answer');
    cleanup();
  }
});
