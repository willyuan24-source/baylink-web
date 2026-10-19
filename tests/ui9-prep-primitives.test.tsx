import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import postcss from 'postcss';

// UI9-F2 primitives added by UI9-PREP: Disclosure (one expander), CloseButton (one ✕) and TextLink / MoreLink (two link
// looks, one underline offset). No call site uses them yet; the area lanes migrate to them.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { render, cleanup, fireEvent, act } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter } = await import('react-router-dom');
const ui = { ...await import('../src/components/ui/Disclosure'), ...await import('../src/components/ui/CloseButton'), ...await import('../src/components/ui/TextLink') };
const { setLocale } = await import('../src/i18n/locale');

afterEach(async () => { cleanup(); document.body.innerHTML = ''; await setLocale('zh-Hans', false); });
const css = postcss.parse(['ui', 'disclosure', 'links'].map(name => readFileSync(`src/components/ui/${name}.css`, 'utf8')).join('\n'));
const declarations = (selector: string) => {
  const found = new Map<string, string>();
  css.walkRules(rule => { if (rule.selector === selector) rule.walkDecls(decl => { found.set(decl.prop, decl.value); }); });
  return found;
};

test('Disclosure: a native details / summary with one chevron, closed by default, aria-expanded following the element', async () => {
  const toggles: boolean[] = [];
  const view = render(<ui.Disclosure summary="怎么报名" onToggle={open => toggles.push(open)}><p>先在官网注册。</p></ui.Disclosure>);
  const details = view.container.querySelector('details')!;
  const summary = details.querySelector(':scope > summary')!;
  assert.ok(details.classList.contains('ui-disclosure') && summary.classList.contains('ui-disclosure__summary'));
  assert.equal(details.open, false);
  assert.equal(summary.getAttribute('aria-expanded'), 'false');
  assert.equal(summary.querySelectorAll('svg').length, 1, 'one chevron');
  assert.equal(summary.querySelector('svg')!.getAttribute('aria-hidden'), 'true');
  assert.equal(summary.textContent, '怎么报名');
  // The browser opens it on a click, Enter or Space on the summary and fires toggle (a task later); the summary follows.
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  await act(async () => { details.open = true; await tick(); });
  assert.equal(summary.getAttribute('aria-expanded'), 'true');
  await act(async () => { details.open = false; await tick(); });
  assert.equal(summary.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(toggles, [true, false]);
});

test('Disclosure: a client render with defaultOpen does not report a toggle the reader did not make', async () => {
  // Setting `open` queues a toggle event; the mount's one carries no change and must not reach onToggle.
  const toggles: boolean[] = [];
  const view = render(<ui.Disclosure summary="开放时间" defaultOpen onToggle={open => toggles.push(open)}><p>9–5</p></ui.Disclosure>);
  const details = view.container.querySelector('details')!;
  const summary = details.querySelector(':scope > summary')!;
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  await act(async () => { await tick(); await tick(); });
  assert.equal(details.open, true);
  assert.equal(summary.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(toggles, [], 'no toggle on mount');
  await act(async () => { details.open = false; await tick(); });
  assert.equal(summary.getAttribute('aria-expanded'), 'false');
  await act(async () => { details.open = true; await tick(); });
  assert.equal(summary.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(toggles, [false, true], 'the reader closing and reopening it');
});

test('Disclosure: defaultOpen is open in the prerendered HTML, and the panel is in the DOM either way', () => {
  const open = JSDOM.fragment(renderToStaticMarkup(<ui.Disclosure summary="Hours" defaultOpen><p>9–5</p></ui.Disclosure>));
  assert.ok(open.querySelector('details[open]'));
  assert.equal(open.querySelector('summary')!.getAttribute('aria-expanded'), 'true');
  const closed = JSDOM.fragment(renderToStaticMarkup(<ui.Disclosure summary="Hours"><p>9–5</p></ui.Disclosure>));
  assert.equal(closed.querySelector('details')!.hasAttribute('open'), false);
  assert.equal(closed.querySelector('.ui-disclosure__panel')!.textContent, '9–5');
});

test('Disclosure CSS: no native marker, a 44px summary (48 in 简洁显示), the chevron turns on a --dur token', () => {
  const summary = declarations('.ui-disclosure__summary');
  assert.equal(summary.get('list-style'), 'none');
  assert.equal(summary.get('min-height'), 'var(--control-height)');
  assert.equal(declarations('.ui-disclosure__summary::-webkit-details-marker').get('display'), 'none');
  assert.equal(declarations('.ui-disclosure__summary::marker').get('content'), '""');
  assert.match(declarations('.ui-disclosure__chevron').get('transition')!, /^rotate var\(--dur-\d\) var\(--ease-/);
  assert.equal(declarations('.ui-disclosure[open]>.ui-disclosure__summary>.ui-disclosure__chevron').get('rotate'), '180deg');
  assert.equal(declarations('html[data-simple] .ui-disclosure__summary').get('min-height'), '3rem');
  assert.equal(declarations('html[data-simple] :is(.ui-link[data-standalone],.ui-more)').get('min-height'), '3rem');
});

test('CloseButton: one look (the 44px icon button), named 关闭 / 關閉 / Close, or a given name', async () => {
  let closed = 0;
  const names: string[] = [];
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    await setLocale(locale, false);
    const view = render(<ui.CloseButton onClick={() => { closed++; }} />);
    const button = view.getByRole('button');
    names.push(button.getAttribute('aria-label')!);
    assert.ok(button.classList.contains('ui-icon-button') && button.classList.contains('ui-close'));
    assert.equal(button.getAttribute('type'), 'button');
    assert.equal(button.querySelectorAll('svg').length, 1);
    fireEvent.click(button);
    cleanup();
  }
  assert.deepEqual(names, ['关闭', '關閉', 'Close']);
  assert.equal(closed, 3);
  await setLocale('zh-Hans', false);
  const ref = React.createRef<HTMLButtonElement>();
  const view = render(<ui.CloseButton label="关闭筛选" buttonRef={ref} />);
  assert.equal(view.getByRole('button', { name: '关闭筛选' }), ref.current);
  assert.equal(declarations('.ui-icon-button').get('width'), 'var(--control-height)', 'the icon button is the 44px target');
});

test('TextLink and MoreLink: router links for `to`, anchors for `href`, two looks with one underline offset', () => {
  const view = render(<MemoryRouter>
    <p>先看 <ui.TextLink to="/about#about-method-title">我们怎么核对</ui.TextLink>。</p>
    <ui.TextLink href="https://www.sfpl.org/" standalone>SFPL 官网</ui.TextLink>
    <ui.MoreLink to="/events">看全部活动</ui.MoreLink>
  </MemoryRouter>);
  const inText = view.getByRole('link', { name: '我们怎么核对' });
  assert.equal(inText.getAttribute('href'), '/about#about-method-title');
  assert.equal(inText.className, 'ui-link');
  assert.equal(inText.hasAttribute('data-standalone'), false);
  const standalone = view.getByRole('link', { name: 'SFPL 官网' });
  assert.equal(standalone.getAttribute('href'), 'https://www.sfpl.org/');
  assert.equal(standalone.getAttribute('data-standalone'), '');
  const more = view.getByRole('link', { name: '看全部活动' });
  assert.equal(more.className, 'ui-more');
  assert.equal(more.querySelector('svg')!.getAttribute('aria-hidden'), 'true', 'the arrow is decoration');
  // One underline offset for both looks, the same as the hover underline in tokens.css.
  const offsets = new Set<string>();
  css.walkDecls('text-underline-offset', decl => { if (/\.ui-(?:link|more)\b/.test((decl.parent as postcss.Rule).selector)) offsets.add(decl.value); });
  assert.deepEqual([...offsets], ['.2em']);
  assert.match(readFileSync('src/tokens.css', 'utf8'), /text-underline-offset:\.2em/);
  assert.equal(declarations(':is(.ui-link[data-standalone],.ui-more)').get('min-height'), 'var(--control-height)');
  assert.equal(declarations('.ui-link').get('text-decoration'), 'underline 1px', 'underlined at rest');
  assert.equal(declarations('.ui-more').get('text-decoration'), undefined, 'underlined on hover only');
});

test('the links render on the server too (prerendered pages)', () => {
  const html = renderToStaticMarkup(<StaticRouter location="/"><ui.MoreLink to="/guides">看全部指南</ui.MoreLink></StaticRouter>);
  assert.match(html, /^<a class="ui-more" href="\/guides"|^<a href="\/guides"[^>]*class="ui-more"/);
});
