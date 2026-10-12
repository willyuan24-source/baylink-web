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
const { ACCOUNT_SHELL_FILE } = await import('../src/app/account-shell');
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

test('the prerender writes the shell in three languages as noindex, without canonical or hreflang', () => {
  const script = readFileSync('scripts/prerender.tsx', 'utf8');
  assert.ok(script.includes(`renderPage({ title: 'BAYLINK', description: homeDescription, path: '/me', noindex: true }, <AccountShell />, ACCOUNT_SHELL_FILE)`));
  // The canonical link is taken out of each language's file (the same pattern the prerender uses, applied to its output).
  const strip = (html: string) => html.replace(/\s*<link rel="canonical" href="[^"]*" \/>/, '');
  assert.ok(script.includes(String(/\s*<link rel="canonical" href="[^"]*" \/>/)), 'the prerender strips the canonical link');
  assert.equal(strip('<title>BAYLINK</title>\n    <link rel="canonical" href="https://www.baylink.us/me" />\n    <meta name="robots" content="noindex, follow" />'), '<title>BAYLINK</title>\n    <meta name="robots" content="noindex, follow" />');
  assert.equal(ACCOUNT_SHELL_FILE, 'account-shell.html');
});
