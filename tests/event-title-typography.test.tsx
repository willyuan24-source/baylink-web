import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import postcss, { type AtRule, type Rule } from 'postcss';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/calendar' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// The events column imports its stylesheet; here CSS loads as an empty module.
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { render, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { default: CalendarPage } = await import('../src/pages/CalendarPage');
const { MonthlyEdition } = await import('../src/components/MonthlyEdition');
afterEach(() => cleanup());

const SCOPES = ':is(.event-calendar-page,.bl-monthly,.planner-page,.local-discovery-detail,.baybay-conversation)';
const CONTROLS = `${SCOPES} :is(button,a,select,input,textarea)`;
const HEADING_LINKS = `${SCOPES} :is(h1,h2,h3,h4,h5,h6) a`;
const rules: Rule[] = [];
postcss.parse(readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8')).each(node => { if (node.type === 'rule') rules.push(node); });
const declarations = (rule: Rule) => new Map(rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value + (node.important ? '!important' : '')]));
const matching = (element: Element) => rules.filter(rule => element.matches(rule.selector));

// jsdom has no cascade; these assertions pin the rules, and the computed-style probe on a real browser is the proof.
test('title links in event and calendar cards take the heading size while card actions keep the shared control size', async () => {
  const controls = rules.find(rule => rule.selector === CONTROLS);
  const headingLinks = rules.find(rule => rule.selector === HEADING_LINKS);
  assert.ok(controls && headingLinks, 'both rules exist in tokens.css');
  assert.deepEqual([...declarations(controls)], [['min-height', 'var(--control-height)'], ['font-size', 'var(--text-fact)']]);
  // :is() counts its most specific argument: (0,1,2) for heading links outranks (0,1,1) for controls in any order.
  assert.deepEqual([...declarations(headingLinks)], [['font-size', 'inherit'], ['min-height', '0']]);

  // The events column (WEB-EVENTS) renders its titles through the WEB-UI card primitives, outside these legacy scopes:
  // the title link is `.ui-card-link` (no size of its own, so it inherits), its heading takes the card title size from
  // ui.css, and no tokens.css or events.css rule gives a card title link the shared control size.
  let calendar!: ReturnType<typeof render>;
  await act(async () => { calendar = render(<MemoryRouter initialEntries={['/calendar?date=2026-10-10']}><Routes><Route element={<Outlet context={{ openBayBay: () => {} }} />}><Route path="/calendar" element={<CalendarPage today="2026-10-07" />} /></Route></Routes></MemoryRouter>); });
  const monthly = render(<MemoryRouter><MonthlyEdition today="2026-10-07" /></MemoryRouter>);
  const titles = [...calendar.container.querySelectorAll('.ui-row-card__title a'), ...monthly.container.querySelectorAll('.ui-feed-card__title a')];
  assert.ok(calendar.container.querySelector('.ui-row-card__title a') && monthly.container.querySelector('.ui-feed-card__title a'), 'both card kinds render a title link');
  const sheetRules = (path: string) => { const list: Rule[] = []; postcss.parse(readFileSync(new URL(path, import.meta.url), 'utf8')).each(node => { if (node.type === 'rule') list.push(node); }); return list; };
  const uiRules = sheetRules('../src/components/ui/ui.css');
  const eventsRules = sheetRules('../src/features/events/events.css');
  // Pseudo-element and :focus-visible selectors never match an element at rest, and jsdom may not parse them.
  const matches = (list: Rule[], element: Element) => list.filter(rule => { try { return element.matches(rule.selector); } catch { return false; } });
  const CARD_TITLE_SIZES: Record<string, string> = { 'ui-feed-card__title': '.9375rem', 'ui-row-card__title': '1.0625rem' };
  for (const title of titles) {
    const linkRules = matches(uiRules, title);
    assert.ok(linkRules.some(rule => rule.selector === '.ui-card-link'), `${title.textContent}: the title is the card link`);
    for (const rule of [...linkRules, ...matching(title), ...matches(eventsRules, title)]) assert.equal(declarations(rule).get('font-size'), undefined, `${rule.selector} sets a size on ${title.textContent}`);
    const heading = title.closest('.ui-feed-card__title, .ui-row-card__title')!;
    const kind = [...heading.classList].find(name => name in CARD_TITLE_SIZES)!;
    const own = matches(uiRules, heading).find(rule => rule.selector === `.${kind}`);
    assert.equal(own && declarations(own).get('font-size'), CARD_TITLE_SIZES[kind], `${title.textContent}: the heading takes the card title size`);
    assert.equal(matches(eventsRules, heading).find(rule => declarations(rule).has('font-size')), undefined, `the events column leaves ${kind} at its size`);
  }
});

test('the category heading suffix stays on the line of the category name, so a phone line never starts with its comma', () => {
  const suffixRules: Rule[] = [];
  postcss.parse(readFileSync(new URL('../src/design.css', import.meta.url), 'utf8')).walkRules(rule => { if (rule.selectors.includes('.bay-category-header h1>span')) suffixRules.push(rule); });
  assert.ok(suffixRules.length >= 2, 'the shared rule and the phone rule');
  for (const rule of suffixRules) assert.ok(!declarations(rule).has('display') && !declarations(rule).has('margin-top'), `${rule.selector} keeps ，就在你身边。 inline`);
});

test('detail title units stay whole from 360px and may wrap on narrower phones', () => {
  const sheet = postcss.parse(readFileSync(new URL('../src/components/local-discovery-detail.css', import.meta.url), 'utf8'));
  const keep = (inMedia: string | undefined) => {
    let found: Rule | undefined;
    sheet.walkRules('.local-discovery-detail .discovery-detail-header h1 .title-keep', rule => { if ((rule.parent?.type === 'atrule' ? (rule.parent as AtRule).params : undefined) === inMedia) found = rule; });
    return found && declarations(found).get('white-space');
  };
  assert.equal(keep(undefined), 'nowrap');
  assert.equal(keep('(max-width:359px)'), 'normal');
});
