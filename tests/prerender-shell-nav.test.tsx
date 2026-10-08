import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });

const { render, cleanup, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { setLocale, translateText } = await import('../src/i18n/locale');
const { languagePath } = await import('../src/lib/language-path');
const { SiteMobileNavigation } = await import('../src/components/SiteMobileNavigation');
const { Shell } = await import('../scripts/prerender-shell');

afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });

const links = (nav: HTMLElement) => within(nav).getAllByRole('link').map(link => [link.getAttribute('href') ?? '', link.textContent?.trim() ?? '']);

// REG-06: the prerendered first paint labelled /plan as 问 BayBay. The static shell must offer the same links, with the
// same names, as the app's navigation in every edition; BayBay is a panel button in the app, not a page.
for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
  test(`prerender shell navigation matches the app's links and names (${locale})`, async () => {
    await setLocale(locale, false);
    const shell = render(<Shell locale={locale}><p>body</p></Shell>);
    const shellNav = links(shell.getByRole('navigation'));
    const app = render(<MemoryRouter><SiteMobileNavigation pathname="/" notificationCount={0} onAsk={() => {}} /></MemoryRouter>);
    const appNav = links(app.getByRole('navigation', { name: locale === 'en' ? 'Main navigation' : translateText('手机导航', locale) }))
      .map(([path, label]) => [languagePath(path, locale), translateText(label, locale)]);

    assert.ok(appNav.length >= 4, 'reads the app navigation');
    assert.deepEqual(shellNav, appNav);
    assert.ok(!shellNav.some(([path]) => path.endsWith('/plan')), 'no page link stands in for the BayBay panel');
    assert.ok(app.getByRole('button', { name: locale === 'en' ? 'Ask BayBay' : translateText('问 BayBay', locale) }));
  });
}
