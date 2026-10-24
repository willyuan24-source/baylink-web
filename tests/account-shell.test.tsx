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
const { ACCOUNT_SHELL_FILE, ACCOUNT_SHELLS, withoutPageAddress } = await import('../src/app/account-shell');
const { renderHtmlDocument } = await import('../src/lib/seo');
after(async () => { await setLocale('zh-Hans', false); });

type ShellPage = (typeof ACCOUNT_SHELLS)[number]['page'];
const shell = (prefix = '', page?: ShellPage) => new JSDOM(renderToStaticMarkup(<StaticRouter basename={prefix || undefined} location={`${prefix}/me`}><AnonymousSiteChrome pathname="/me"><AccountShell page={page} /></AnonymousSiteChrome></StaticRouter>)).window.document;

test('the account shell is the chrome around a fixed-height skeleton: no heading, no homepage content, one loading line', async () => {
  for (const [locale, prefix, loading] of [['zh-Hans', '', '正在加载'], ['en', '/en', 'Loading']] as const) {
    await setLocale(locale, false);
    for (const { page } of ACCOUNT_SHELLS) {
      const document = shell(prefix, page);
      const main = document.querySelector('main')!;
      assert.equal(main.querySelector('h1'), null, 'each signed-in page brings its own H1');
      assert.equal(main.querySelector('[aria-busy="true"] [role="status"]')?.textContent, loading);
      assert.equal(main.querySelector(`.account-shell__page[data-page="${page}"]`)?.getAttribute('aria-busy'), 'true');
      assert.ok(main.querySelector('.ui-container.account-shell[data-size="wide"]'), 'on the pages\' wide frame (x = 112 at 1440)');
      assert.doesNotMatch(main.textContent || '', /这个周末|湾区去哪|This weekend/);
      assert.ok(document.querySelector('header.site-topbar') && document.querySelector('footer.site-footer') && document.querySelector('nav.site-mobile-nav'));
    }
  }
});

test('DECISIONS 41: each shell is shaped like its page, not four generic rows', async () => {
  await setLocale('zh-Hans', false);
  const blocks = (page: ShellPage) => [...shell('', page).querySelectorAll('main [data-block]')].map(block => block.getAttribute('data-block'));
  assert.deepEqual(blocks('me'), ['band', 'avatar', 'title', 'line', 'tile', 'tile', 'tile', 'tile', 'section', 'list'], '/me: band, head, 2 x 2 tiles, settings');
  const week = shell('', 'week');
  assert.deepEqual(blocks('week'), ['title', 'line', 'notice', 'section', 'empty', 'section'], '/my-week: its sections');
  assert.equal(week.querySelectorAll('main .ui-skeleton-card').length, 4, '/my-week: the picture strip under 行程');
  assert.equal(week.querySelectorAll('main .ui-row-card').length, 2);
  assert.deepEqual(blocks('together'), ['band', 'title', 'lede', 'field', 'chip', 'state'], '/together: band, head, the search field and 筛选');
  assert.equal(shell('', 'list').querySelectorAll('main .ui-row-card').length, 4, 'the list pages keep their rows');
  assert.deepEqual(ACCOUNT_SHELLS.map(entry => [entry.page, entry.file]), [['me', ACCOUNT_SHELL_FILE], ['week', 'account-shell-week.html'], ['together', 'account-shell-together.html'], ['list', 'account-shell-list.html']]);
});

test('the prerender writes the shell in three languages as noindex, naming no page: no canonical, og:url or hreflang', () => {
  const script = readFileSync('scripts/prerender.tsx', 'utf8');
  assert.ok(script.includes(`renderPage({ title: 'BAYLINK', description: homeDescription, path: '/me', noindex: true }, <AccountShell page={shell.page} />, shell.file)`));
  assert.ok(script.includes('const file = join(outputDir, locale, shell.file);') && script.includes('writeFile(file, withoutPageAddress(await readFile(file, \'utf8\')))'), 'each shape\'s file in each language goes through withoutPageAddress');
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
