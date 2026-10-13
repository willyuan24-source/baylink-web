// G70 (CW-03, I18N-SEO-14): the signed-in pages' first paint is the site chrome around a neutral skeleton, never the
// homepage. scripts/prerender.tsx writes it as account-shell.html in each language; tests/legacy-urls.test.ts covers hosting.
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import '../src/i18n/router';
import { setLocale } from '../src/i18n/locale';

const { StaticRouter } = await import('react-router-dom');
const { AnonymousSiteChrome } = await import('../src/components/SiteChrome');
const { AccountShell } = await import('../src/components/AccountShell');
const { ACCOUNT_SHELL_FILE, withoutPageAddress } = await import('../src/app/account-shell');
const { renderHtmlDocument } = await import('../src/lib/seo');
after(async () => { await setLocale('zh-Hans', false); });

const shell = (prefix = '') => new JSDOM(renderToStaticMarkup(<StaticRouter basename={prefix || undefined} location={`${prefix}/me`}><AnonymousSiteChrome pathname="/me"><AccountShell /></AnonymousSiteChrome></StaticRouter>)).window.document;

test('the account shell is the chrome around a fixed-height skeleton: no heading, no homepage content, one loading line', async () => {
  for (const [locale, prefix, loading] of [['zh-Hans', '', '正在加载'], ['en', '/en', 'Loading']] as const) {
    await setLocale(locale, false);
    const document = shell(prefix);
    const main = document.querySelector('main')!;
    assert.equal(main.querySelector('h1'), null, 'each signed-in page brings its own H1');
    assert.equal(main.querySelector('[aria-busy="true"] [role="status"]')?.textContent, loading);
    assert.equal(main.querySelectorAll('.ui-row-card').length, 4, 'fixed-height rows, so nothing jumps when the page arrives');
    assert.doesNotMatch(main.textContent || '', /这个周末|湾区去哪|This weekend/);
    assert.ok(document.querySelector('header.site-topbar') && document.querySelector('footer.site-footer') && document.querySelector('nav.site-mobile-nav'));
  }
});

test('the prerender writes the shell in three languages as noindex, naming no page: no canonical, og:url or hreflang', () => {
  const script = readFileSync('scripts/prerender.tsx', 'utf8');
  assert.ok(script.includes(`renderPage({ title: 'BAYLINK', description: homeDescription, path: '/me', noindex: true }, <AccountShell />, ACCOUNT_SHELL_FILE)`));
  assert.ok(script.includes('writeFile(file, withoutPageAddress(await readFile(file, \'utf8\')))'), 'each language\'s file goes through withoutPageAddress');
  // The head renderHtmlDocument writes for the shell (it serves /messages, /my-week and /together too, not only /me).
  const template = '<html><head><!--baylink-meta-start--><!--baylink-meta-end--></head><body><!--baylink-app-start--><!--baylink-app-end--></body></html>';
  const html = withoutPageAddress(renderHtmlDocument(template, { title: 'BAYLINK', description: '湾区活动', path: '/me', noindex: true }, '<main></main>'));
  const head = new JSDOM(html).window.document.head;
  assert.equal(head.querySelector('meta[name="robots"]')?.getAttribute('content'), 'noindex, follow');
  assert.equal(head.querySelector('link[rel="canonical"]'), null);
  assert.equal(head.querySelector('meta[property="og:url"]'), null);
  assert.equal(head.querySelector('link[rel="alternate"]'), null);
  assert.ok(head.querySelector('meta[property="og:title"]'), 'the rest of the head stays');
  assert.equal(ACCOUNT_SHELL_FILE, 'account-shell.html');
});
