import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import postcss, { type AtRule, type Rule } from 'postcss';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/calendar' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
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

  let calendar!: ReturnType<typeof render>;
  await act(async () => { calendar = render(<MemoryRouter initialEntries={['/calendar?date=2026-10-10']}><Routes><Route element={<Outlet context={{ openBayBay: () => {} }} />}><Route path="/calendar" element={<CalendarPage today="2026-10-07" />} /></Route></Routes></MemoryRouter>); });
  const monthly = render(<MemoryRouter><MonthlyEdition today="2026-10-07" /></MemoryRouter>);
  const titles = [...calendar.container.querySelectorAll('.ec-event-card h3 a'), ...monthly.container.querySelectorAll('.bl-monthly-event h3 a')];
  const actions = [...calendar.container.querySelectorAll('.ec-event-actions a'), ...monthly.container.querySelectorAll('.bl-monthly-event-actions a')];
  assert.ok(calendar.container.querySelector('.ec-event-card h3 a') && monthly.container.querySelector('.bl-monthly-event h3 a'), 'both card kinds render a title link');
  assert.ok(actions.length > 0);
  for (const title of titles) {
    const matched = matching(title);
    assert.ok(matched.includes(headingLinks), `${title.textContent}: the heading-link rule applies`);
    for (const rule of matched) {
      const size = declarations(rule).get('font-size');
      assert.ok(!size?.endsWith('!important'), `${rule.selector} must not force a title size`);
      assert.ok(size === undefined || rule === headingLinks || rule === controls, `${rule.selector} sets ${size} on a title link`);
    }
  }
  for (const action of actions) {
    assert.ok(matching(action).includes(controls) && !matching(action).includes(headingLinks), `${action.textContent}: actions stay controls`);
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
