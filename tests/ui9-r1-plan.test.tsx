import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';

// UI9-R1-PLAN (first cold review, lanes/UI9-P4/r1): 行程's structure — one 更多方式 block, a bounded first page that shows
// both kinds, two-line descriptions with 展开, the UI Button looks with one primary per section, and the CSS rules behind
// N05 / N10 / N13 / N15 and DECISIONS 13.
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/plan' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, fireEvent, act, within } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, useLocation } = await import('react-router-dom');
const { default: PlannerPage } = await import('../src/pages/PlannerPage');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const originalRequest = api.request;
type View = ReturnType<typeof render>;

const LocationProbe = () => <span data-testid="planner-location">{useLocation().search}</span>;
async function openPlanner(search = '') {
  let view!: View;
  await act(async () => {
    view = render(<MemoryRouter initialEntries={['/plan' + search]}><LocationProbe /><Routes><Route path="/plan" element={<PlannerPage />} /></Routes></MemoryRouter>);
  });
  return view;
}
const rows = (view: View) => [...view.container.querySelectorAll<HTMLElement>('.planner-catalog .planner-place')];
const kinds = (view: View) => rows(view).map(row => row.id.startsWith('catalog-event:') ? 'event' : 'place');

beforeEach(context => {
  context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-23T19:00:00Z') });
  localStorage.clear();
  api.request = async () => { throw new Error('Unexpected API call in guest planner test'); };
});
afterEach(() => { cleanup(); api.request = originalRequest; localStorage.clear(); setLocale('zh-Hans'); delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver; });

test('更多方式 holds 站外搜索 and the screenshot import as two rows of one section, under one h2', async () => {
  const view = await openPlanner();
  const more = view.getByRole('region', { name: '更多方式' });
  assert.equal(more.querySelector('h2')?.textContent, '更多方式');
  const ways = within(more);
  assert.ok(ways.getByRole('heading', { level: 3, name: '再找找站外资料' }));
  assert.ok(ways.getByRole('heading', { level: 3, name: '看到喜欢的活动，先留住' }));
  assert.ok(ways.getByRole('button', { name: '登录 / 注册后搜索' }));
  assert.ok(ways.getByRole('button', { name: '导入活动截图' }));
  // N02: the old import panel's 16/17px h2 is gone; every h2 on the page is a section heading.
  assert.equal(view.container.querySelector('.event-import-entry'), null);
  const h2s = [...view.container.querySelectorAll('h2')].map(h => h.textContent);
  assert.ok(!h2s.includes('看到喜欢的活动，先留住。'), h2s.join(' | '));
});

test('the import row opens the screenshot dialog, and ?import=event still opens it and is cleared on close', async () => {
  const view = await openPlanner();
  assert.equal(view.queryByRole('dialog'), null);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '导入活动截图' })); });
  assert.ok(view.getByRole('dialog'));
  cleanup();
  const linked = await openPlanner('?import=event');
  assert.ok(linked.getByRole('dialog'));
  await act(async () => { fireEvent.click(within(linked.getByRole('dialog')).getByRole('button', { name: '关闭' })); });
  assert.equal(linked.queryByRole('dialog'), null);
  assert.equal(linked.getByTestId('planner-location').textContent, '');
});

test('the list opens on eight rows — the next four events, then places — and 继续看更多地点 adds twelve in that order', async () => {
  const view = await openPlanner();
  assert.equal(rows(view).length, 8);
  assert.deepEqual(kinds(view), ['event', 'event', 'event', 'event', 'place', 'place', 'place', 'place']);
  const first = rows(view).map(row => row.id);
  fireEvent.click(view.getByRole('button', { name: '继续看更多地点' }));
  const next = rows(view).map(row => row.id);
  assert.equal(next.length, 20);
  assert.deepEqual(next.slice(0, 8), first, 'the first page keeps its place');
  assert.equal(new Set(next).size, next.length, 'no row twice');
  // 景点 only: places from the first row
  fireEvent.click(view.getByRole('button', { name: '景点', exact: true }));
  assert.ok(rows(view).length > 0 && rows(view).length <= 8);
  assert.ok(kinds(view).every(kind => kind === 'place'));
});

test('a description longer than two lines gets 展开介绍, which opens and closes it; a short one gets no toggle', async () => {
  // jsdom has no layout: every summary reports 3 lines of text in a 2-line box, except the first row's.
  const proto = dom.window.HTMLElement.prototype;
  const scroll = Object.getOwnPropertyDescriptor(proto, 'scrollHeight'), client = Object.getOwnPropertyDescriptor(proto, 'clientHeight');
  Object.defineProperty(proto, 'scrollHeight', { configurable: true, get() { return this.classList.contains('planner-place-summary') && !this.closest('.planner-place')?.matches(':first-child') ? 72 : 48; } });
  Object.defineProperty(proto, 'clientHeight', { configurable: true, get() { return 48; } });
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} disconnect() {} };
  try {
    const view = await openPlanner();
    const [short, long] = rows(view);
    assert.ok(short.querySelector('.planner-place-summary'));
    assert.equal((short.querySelector('.planner-place-more') as HTMLButtonElement).hidden, true, 'a description that fits has no toggle');
    const toggle = within(long).getByRole('button', { name: '展开介绍' });
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.ok(toggle.classList.contains('ui-button'));
    await act(async () => { fireEvent.click(toggle); });
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(toggle.textContent, '收起介绍');
    await act(async () => { fireEvent.click(toggle); });
    assert.equal(toggle.textContent, '展开介绍');
  } finally {
    if (scroll) Object.defineProperty(proto, 'scrollHeight', scroll); else delete (proto as { scrollHeight?: number }).scrollHeight;
    if (client) Object.defineProperty(proto, 'clientHeight', client); else delete (proto as { clientHeight?: number }).clientHeight;
  }
});

test('N12: the page renders the UI Button looks only — no planner-primary or planner-web-button — and one primary per section', async () => {
  const view = await openPlanner();
  assert.equal(view.container.querySelectorAll('.planner-primary, .planner-web-button, .planner-edit-preview-button, .planner-web-cancel').length, 0);
  for (const section of view.container.querySelectorAll('header, section, aside, form')) {
    const own = [...section.querySelectorAll('[data-variant=primary]')].filter(button => button.closest('header, section, aside, form') === section);
    assert.ok(own.length <= 1, `${section.className || section.tagName}: ${own.length} primaries`);
  }
  assert.equal(view.container.querySelectorAll('[data-variant=primary]').length, 1, 'the header keeps the page’s one primary (问 BayBay 排一天)');
});

test('English: the 更多方式 rows read in English, with no Chinese left in them', async () => {
  setLocale('en');
  const view = await openPlanner();
  const more = view.getByRole('region', { name: 'More ways to plan' });
  assert.ok(within(more).getByRole('button', { name: 'Sign in / register to search' }));
  assert.ok(within(more).getByRole('button', { name: 'Import an event screenshot' }));
  assert.doesNotMatch(more.textContent!, /[㐀-鿿]/);
});

const rules = (file: string) => { const found: { selector: string; media: string; decls: Record<string, string> }[] = []; postcss.parse(readFileSync(file, 'utf8')).walkRules(rule => { const decls: Record<string, string> = {}; rule.walkDecls(decl => { decls[decl.prop] = decl.value; }); const media = rule.parent?.type === 'atrule' ? String((rule.parent as unknown as { params: string }).params) : ''; found.push({ selector: rule.selector.replace(/\s+/g, ' '), media, decls }); }); return found; };

test('CSS: no bespoke button looks, no native marker or grip, measure caps, section gaps and no font-size literals', () => {
  const planner = rules('src/styles/planner.css'), library = rules('src/components/planner-web-library.css');
  const all = [...planner, ...library];
  assert.ok(!all.some(rule => /planner-primary|planner-web-button|planner-edit-preview-button|planner-web-cancel|planner-launch-links/.test(rule.selector)), 'the bespoke button rules are gone (N12)');
  // N13: one rule hides the default ▶ marker on every disclosure of 行程 (not My Week's legacy .planner-page blocks), the
  // + / − mark is silent to screen readers, and no textarea is resizable.
  const scope = '.planner-page:where(.ui-container)';
  assert.ok(planner.some(rule => rule.selector === `${scope} summary` && rule.decls['list-style'] === 'none'));
  assert.ok(planner.some(rule => rule.selector === `${scope} summary::-webkit-details-marker` && rule.decls.display === 'none'));
  assert.ok(planner.some(rule => rule.selector === `${scope} summary::after` && rule.decls.content === "'+' / ''"));
  assert.ok(planner.some(rule => rule.selector === `${scope} :where([open])>summary::after` && rule.decls.content === "'−' / ''"));
  assert.ok(planner.some(rule => rule.selector === `${scope} textarea` && rule.decls.resize === 'none'));
  assert.ok(!all.some(rule => /^\.planner-page (summary|textarea)/.test(rule.selector)), 'no N13 rule reaches My Week');
  assert.doesNotMatch(readFileSync('src/components/PlannerTravelCheck.tsx', 'utf8'), /ChevronDown/, 'the travel check uses the shared + / −, not a second mark');
  assert.ok(!all.some(rule => rule.decls.resize && rule.decls.resize !== 'none'));
  // N10: the conflict edge is a border, not an inset shadow.
  assert.ok(!all.some(rule => /inset/.test(rule.decls['box-shadow'] || '')));
  // N15: sections sit --section-gap apart; the page keeps no bottom padding of its own.
  // The slot's notices keep their own margins: they are its only paragraphs (the rule skips p children).
  assert.ok(planner.some(rule => rule.selector === '.planner-page :is(.plan-weekend,.planner-data-slot>:where(:not(p)))' && rule.decls['margin-block'] === 'var(--section-gap) 0'));
  for (const file of ['src/features/plan/PlannerWorkspace.tsx', 'src/features/plan/PlanWorkspaceSlot.tsx']) {
    const slots = [...readFileSync(file, 'utf8').matchAll(/return <div className="planner-data-slot"[\s\S]*?\n {2}<\/div>;/g)].map(match => match[0]).join('\n');
    const paragraphs = [...slots.matchAll(/^ {4}(?:\{[^\n]*?)?<p className="([^"]+)"/gm)].map(match => match[1]);
    assert.ok(paragraphs.includes('planner-offline'), file);
    assert.deepEqual(paragraphs.filter(name => !/^planner-(offline|error)$/.test(name)), [], `${file}: a paragraph in the slot is a notice`);
  }
  assert.ok(planner.some(rule => rule.selector === 'main .planner-page.ui-container' && rule.decls['padding-bottom'] === '0'));
  assert.ok(planner.some(rule => /home-section-head__more/.test(rule.selector) && rule.decls['margin-block'] === '-8px'), 'the head link does not make the head row taller than its h2');
  // N05: the wrapped copy has a measure.
  assert.ok(planner.some(rule => /\.planner-place-summary/.test(rule.selector) && rule.decls['max-width'] === 'var(--plan-measure)'));
  assert.ok(planner.some(rule => rule.selector === '.planner-page .planner-place-when' && rule.decls['max-width'] === '25em'));
  // DECISIONS 13: no font-size literal in a sheet this lane touched.
  for (const rule of all) if (rule.decls['font-size']) assert.match(rule.decls['font-size'], /^var\(--/, `${rule.selector}: ${rule.decls['font-size']}`);
});
