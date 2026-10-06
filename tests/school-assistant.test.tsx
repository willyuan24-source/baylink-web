import { mockBayBayFetch } from './baybay-test-transport';
import assert from 'node:assert/strict';
import test, { after, afterEach, before } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { Guide } from '../src/data/guides';
import assistantEnglish from '../src/data/schools-assistant-en.json';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () { return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList; };
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { BayBayAssistantEntry } = await import('../src/components/BayBayAssistantEntry');
const { guides } = await import('../src/data/guides');
const { currentBayBayGuide, fetchBayBayReply, bayBayPageQuestions, bayBayReferenceGuides, bayBayGuideSources,
  isBayBayPlanRequest, bayBayFollowups, BAYBAY_SCHOOL_NOTE, BAYBAY_SCHOOL_STARTER } = await import('../src/lib/baybay-conversation');
const { loadLocale, setLocale, translateText } = await import('../src/i18n/locale');

// A catalog fixture isolates assistant behavior from future editorial title changes.
const school: Guide = { ...guides[0], slug: 'school-assistant-test-fixture', title: '测试学校入学指南', tags: ['学校与学区'],
  sources: [{ title: 'California Department of Education', url: 'https://www.cde.ca.gov/', description: 'Official source fixture' }] };
const path = `/guides/${school.slug}`;
const noop = () => {};
const props = { variant: 'headless' as const, panelOpen: true, onPanelOpenChange: noop, onNavigate: noop, onCreatePostClick: noop };
type RequestBody = { message: string; context: { currentPath: string; categoryHint?: string }; history: { role: string; content: string }[]; locale: string };
before(() => { guides.push(school); });
after(() => { guides.splice(guides.indexOf(school), 1); });
afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });

test('shared guide URLs send the canonical article path through the real API contract', async t => {
  const requests: RequestBody[] = [];
  mockBayBayFetch(t, async (_url: unknown, options: RequestInit) => {
    requests.push(JSON.parse(String(options.body)));
    return Response.json({ ok: true, answer: '请先到这篇指南列出的官方学区入口核验。' });
  });
  const sharedPath = `${path}/?lang=en&from=share#enrollment`;
  assert.equal(currentBayBayGuide(sharedPath)?.slug, school.slug);
  for (const invalid of ['https://evil.test' + path, '//evil.test' + path, '/guides/%E0%A4%A', '/guides/not-published']) {
    assert.equal(currentBayBayGuide(invalid), undefined, invalid);
  }
  const history = [{ role: 'user' as const, content: '地区是东湾，准备入读三年级' }, { role: 'assistant' as const, content: '先核对学区的官方入学入口。' }];
  await fetchBayBayReply('请根据这篇指南继续整理', { currentPath: sharedPath }, history, new AbortController().signal);
  assert.equal(requests[0].message, '请根据这篇指南继续整理');
  assert.deepEqual(requests[0].context, { currentPath: path });
  assert.deepEqual(requests[0].history, history);
  assert.equal(requests[0].locale, 'zh-Hans');
});

test('school page prompts use the current guide, explain privacy and expose only catalog sources', async t => {
  const requests: RequestBody[] = [];
  const navigated: string[] = [];
  mockBayBayFetch(t, async (_url: unknown, options: RequestInit) => {
    requests.push(JSON.parse(String(options.body)));
    return Response.json({ ok: true, answer: '请告诉我地区与拟入读年级，再到官方学区入口自行核验。', suggestedGuides: [
      { slug: school.slug, title: '伪造的学校保证录取排名', url: path },
      { slug: 'invented-school', title: '虚构的学校指南', url: '/guides/invented-school' },
    ] });
  });
  const view = render(<BayBayAssistantEntry {...props} currentPath={path} onNavigate={value => navigated.push(value)} />);
  const input = view.getByRole('textbox', { name: '向 BayBay 提问' });
  assert.equal(input.getAttribute('aria-describedby'), 'baybay-school-privacy');
  assert.equal(view.getByText(BAYBAY_SCHOOL_NOTE).id, 'baybay-school-privacy');
  assert.match(input.getAttribute('placeholder') || '', /Fremont.*三年级/);
  fireEvent.click(view.getByRole('button', { name: '先核对学区' }));
  await view.findByText('请告诉我地区与拟入读年级，再到官方学区入口自行核验。');
  assert.equal(requests[0].context.currentPath, path);
  assert.match(requests[0].message, /只问我地区与拟入读年级/);
  assert.match(requests[0].message, /不索取孩子实名、生日或完整住址/);
  assert.match(requests[0].message, /不凭城市保证分配学校.*不做学校排名/);
  assert.deepEqual(navigated, []);
  assert.equal(view.queryByText('伪造的学校保证录取排名'), null);
  assert.equal(view.queryByText('虚构的学校指南'), null);
  assert.ok(view.getByText('以下是站内指南列出的参考资料，不表示已实时核验。'));
  assert.equal(view.getByRole('link', { name: 'California Department of Education', hidden: true }).getAttribute('href'), school.sources[0].url);
  const references = bayBayReferenceGuides({ ok: true, suggestedGuides: [
    { slug: school.slug, title: 'invented', url: path }, { slug: school.slug, title: 'invented duplicate', url: path },
    { slug: school.slug, title: 'offsite', url: 'https://evil.test/' },
  ] });
  assert.deepEqual(references.map(item => item.title), [school.title]);
  assert.deepEqual(bayBayGuideSources({ ...school, sources: [...school.sources, ...school.sources,
    { title: 'bad', url: 'javascript:alert(1)', description: '' }, { title: 'credentials', url: 'https://user:pass@example.com', description: '' }] }), school.sources);
});

test('answers, follow-ups and retries retain their guide after navigation, while new input uses the new page', async t => {
  const requests: RequestBody[] = [];
  const resolves: ((response: Response) => void)[] = [];
  mockBayBayFetch(t, (_url: unknown, options: RequestInit) => {
    requests.push(JSON.parse(String(options.body)));
    return new Promise<Response>(resolve => resolves.push(resolve));
  });
  const other = guides.find(guide => guide.slug !== school.slug && !guide.tags.includes('学校与学区'))!;
  const view = render(<BayBayAssistantEntry {...props} currentPath={path} />);
  fireEvent.click(view.getByRole('button', { name: '整理入学步骤' }));
  view.rerender(<BayBayAssistantEntry {...props} currentPath={`/guides/${other.slug}`} />);
  await act(async () => resolves[0](Response.json({ ok: true, answer: '原学校指南的核验步骤。' })));
  assert.ok(view.getByText('提问时阅读的指南'));
  assert.ok(view.getByRole('button', { name: school.title }));
  fireEvent.click(view.getByRole('button', { name: '按已经提供的地区与年级，帮我列出需要向学区核实的事项' }));
  assert.equal(requests[1].context.currentPath, path, 'a follow-up belongs to the answer it follows');
  assert.equal(requests[1].history[0].content, requests[0].message);
  await act(async () => resolves[1](Response.json({ ok: true, answer: '继续原学校指南的核验步骤。' })));
  fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: '现在请整理我刚打开的这篇攻略' } });
  fireEvent.click(view.getByRole('button', { name: '问一下' }));
  assert.equal(requests[2].context.currentPath, `/guides/${other.slug}`, 'new input follows the current page');
  await act(async () => resolves[2](Response.json({ ok: false, error: '暂时无法完成这次测试请求。' }, { status: 503 })));
  view.rerender(<BayBayAssistantEntry {...props} currentPath="/" />);
  fireEvent.click(view.getByRole('button', { name: '重试这个问题' }));
  assert.equal(requests[3].context.currentPath, `/guides/${other.slug}`, 'retry uses the failed request article, not the current route');
  await act(async () => resolves[3](Response.json({ ok: true, answer: '这是新页面重试后的阅读建议。' })));
});

test('school questions stay in chat and the school starter is editable before anything is sent', async t => {
  for (const question of ['周六带 6 岁孩子了解学区，帮我安排入学计划', 'Plan school enrollment for my child this weekend', '週六安排孩子入學，想核對學區']) {
    assert.equal(isBayBayPlanRequest(question), false, question);
  }
  assert.ok(isBayBayPlanRequest('周六带五岁孩子，从 Fremont 出发，预算 $50'));
  for (const question of ['孩子学校怎么报名', 'School enrollment for grade 3']) {
    assert.deepEqual(bayBayFollowups(question, false), ['按已经提供的地区与年级，帮我列出需要向学区核实的事项', '帮我写一段不含孩子个人资料的入学咨询模板']);
  }
  const requests: RequestBody[] = [];
  mockBayBayFetch(t, async (_url: unknown, options: RequestInit) => {
    requests.push(JSON.parse(String(options.body)));
    return Response.json({ ok: true, answer: '请用官方入口核对地区与年级对应的申请步骤。' });
  });
  const view = render(<BayBayAssistantEntry {...props} currentPath="/" />);
  fireEvent.click(view.getByRole('button', { name: /学校与入学/ }));
  const input = view.getByRole('textbox', { name: '向 BayBay 提问' }) as HTMLInputElement;
  assert.equal(input.value, BAYBAY_SCHOOL_STARTER);
  assert.equal(document.activeElement, input);
  assert.equal(requests.length, 0, 'choosing a starter must not submit unedited placeholders');
  fireEvent.change(input, { target: { value: '我在东湾 Fremont，准备入读三年级，想了解入学步骤。' } });
  fireEvent.click(view.getByRole('button', { name: '问一下' }));
  await view.findByText('请用官方入口核对地区与年级对应的申请步骤。');
  assert.equal(requests[0].message, '我在东湾 Fremont，准备入读三年级，想了解入学步骤。');
});

test('a question queued while busy keeps the guide that was open when it arrived', async t => {
  const requests: RequestBody[] = [];
  const resolves: ((response: Response) => void)[] = [];
  mockBayBayFetch(t, (_url: unknown, options: RequestInit) => {
    requests.push(JSON.parse(String(options.body)));
    return new Promise<Response>(resolve => resolves.push(resolve));
  });
  const view = render(<BayBayAssistantEntry {...props} currentPath="/" pendingQuestion="先处理这个生活问题" pendingQuestionId={1} />);
  view.rerender(<BayBayAssistantEntry {...props} currentPath={path} pendingQuestion="根据这篇学校指南整理入学步骤" pendingQuestionId={2} />);
  view.rerender(<BayBayAssistantEntry {...props} currentPath="/guides" pendingQuestion="根据这篇学校指南整理入学步骤" pendingQuestionId={2} />);
  assert.equal(requests.length, 1);
  await act(async () => resolves[0](Response.json({ ok: true, answer: '第一个生活问题已回答。' })));
  assert.equal(requests.length, 2);
  assert.equal(requests[1].context.currentPath, path);
  await act(async () => resolves[1](Response.json({ ok: true, answer: '这是入队时那篇学校指南的入学步骤。' })));
  assert.ok(view.getByRole('button', { name: school.title }));
});

test('school prompts and new source labels are translated by the real English runtime', async () => {
  await loadLocale('en');
  for (const [source, expected] of Object.entries(assistantEnglish)) {
    assert.equal(translateText(source, 'en'), expected, source);
    assert.doesNotMatch(expected, /[\u3400-\u9fff]/);
  }
  for (const prompt of bayBayPageQuestions(path)) {
    assert.ok(prompt.question.length <= 500);
    const english = translateText(prompt.question, 'en');
    assert.doesNotMatch(english, /[\u3400-\u9fff]/);
    assert.ok(english.length <= 500, `${prompt.label}: exceeds the API message limit in English`);
  }
});
