// W9-E-switch · /play becomes the 3D San Francisco game (the owner, 2026-10-01: "当OPUS-BAY没问题的时候，就可以替代PLAY了"; the
// switch is gated by W9-Z, who reverts the W9-E-switch commits alone if the gate fails — sf-w9-lead.md §6). The homepage
// card and the sidebar's 小小湾区 open /opus-bay (with from=), /play redirects there keeping ?lang, an old shared weekend
// ticket (/play?date=&stops=&places=) opens the same plan in the site's planner, /play is out of the sitemap and its
// prerendered page is the game's shell with canonical /opus-bay. LittleBayPage stays in the repo, unrouted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup } = await import('@testing-library/react');
const { MemoryRouter, Route, Routes, StaticRouter, useLocation } = await import('react-router-dom');
const { PlayRedirect } = await import('../src/components/PlayRedirect');
const { playRedirectTarget } = await import('../src/lib/opus-bay-metadata');
const { HomeDiscovery } = await import('../src/components/HomeDiscovery');
const { SiteNavigation } = await import('../src/components/SiteNavigation');
const { parseSharedPlan } = await import('../src/lib/planner');
afterEach(() => cleanup());

test('W9-E-switch: /play → /opus-bay?from=play keeping lang; an old shared ticket → /plan with the same date / stops / places (and lang)', () => {
  assert.equal(playRedirectTarget(''), '/opus-bay?from=play');
  assert.equal(playRedirectTarget('?lang=en'), '/opus-bay?lang=en&from=play');
  assert.equal(playRedirectTarget('?lang=zh-Hant&view=places'), '/opus-bay?lang=zh-Hant&from=play', 'the old page\'s own view= is dropped');
  assert.equal(playRedirectTarget('?from=nav'), '/opus-bay?from=play');
  const ticket = '?date=2026-10-03&stops=place%3Agolden-gate%2Cevent%3Asf-castro-street-fair-2026&lang=en';
  const to = playRedirectTarget(ticket);
  assert.equal(to, '/plan?date=2026-10-03&stops=place%3Agolden-gate%2Cevent%3Asf-castro-street-fair-2026&lang=en');
  assert.deepEqual(parseSharedPlan(new URL(to, 'https://www.baylink.us').search), parseSharedPlan(ticket), 'the planner reads the same plan');
  assert.equal(playRedirectTarget('?places=golden-gate,coit-tower'), '/plan?places=golden-gate%2Ccoit-tower');
  assert.equal(playRedirectTarget('?date=2026-10-03'), '/plan?date=2026-10-03');
});

function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname + l.search + l.hash}</output>; }
const at = (entry: string) => {
  const view = render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/play" element={<PlayRedirect />} /><Route path="*" element={<Where />} /></Routes></MemoryRouter>);
  const where = view.getByTestId('where').textContent;
  view.unmount();
  return where;
};

test('W9-E-switch: the /play route lands where it should (zh, zh-Hant, en; tickets)', () => {
  assert.equal(at('/play'), '/opus-bay?from=play');
  assert.equal(at('/play?lang=zh-Hant'), '/opus-bay?lang=zh-Hant&from=play');
  assert.equal(at('/play?lang=en#x'), '/opus-bay?lang=en&from=play#x');
  assert.equal(at('/play?date=2026-10-03&stops=place%3Agolden-gate&lang=en'), '/plan?date=2026-10-03&stops=place%3Agolden-gate&lang=en');
});

test('W9-E-switch: the redirect shows the game\'s shell meanwhile (no site chrome), the ticket redirect nothing', () => {
  const html = renderToStaticMarkup(<StaticRouter location="/play"><PlayRedirect /></StaticRouter>);
  assert.match(html, /id="opus-bay-shell"/);
  assert.doesNotMatch(html, /site-sidebar|home-discovery/);
  assert.equal(renderToStaticMarkup(<StaticRouter location="/play?stops=place:golden-gate"><PlayRedirect /></StaticRouter>), '');
});

test('W9-E-switch: the homepage card says what it is and opens the game with from=home', async () => {
  const { setLocale } = await import('../src/i18n/locale');
  // the prerendered homepage (server HTML: the Simplified edition)
  const html = renderToStaticMarkup(<StaticRouter location="/"><HomeDiscovery onAskBayBay={() => {}} onBrowseCommunity={() => {}} today="2026-10-02" /></StaticRouter>);
  const doc = new JSDOM(html).window.document;
  assert.match(doc.querySelector('a[href="/opus-bay?from=home"]')!.textContent!, /逛一圈 3D 旧金山/);
  assert.equal(doc.querySelector('a[href="/play"]'), null, 'server HTML: no link to /play');
  // in the browser, each edition (useLocale reads the server snapshot during renderToStaticMarkup, so render for real)
  for (const [locale, label] of [['zh-Hans', /逛一圈 3D 旧金山/], ['en', /Explore 3D San Francisco/]] as const) {
    await setLocale(locale, false);
    const view = render(<MemoryRouter initialEntries={['/']}><HomeDiscovery onAskBayBay={() => {}} onBrowseCommunity={() => {}} today="2026-10-02" /></MemoryRouter>);
    const card = view.container.querySelector('a[href="/opus-bay?from=home"]');
    assert.ok(card, `${locale}: the card links the game`);
    assert.match(card!.textContent!, label);
    assert.equal(view.container.querySelector('a[href="/play"]'), null, `${locale}: no link to /play`);
    view.unmount();
  }
  await setLocale('zh-Hans', false);
});

test('W9-E-switch: the sidebar\'s 小小湾区 · Little Bay opens /opus-bay?from=nav (active on /opus-bay and on the /play redirect)', () => {
  const nav = (path: string) => new JSDOM(renderToStaticMarkup(<StaticRouter location={path}><SiteNavigation active="explore" category="全部" homeActive={false} user={null} notification={false} notificationCount={0} onCreate={() => {}} onAsk={() => {}} onAccount={() => {}} /></StaticRouter>)).window.document;
  for (const path of ['/opus-bay', '/play', '/explore']) {
    const link = nav(path).querySelector('a[href="/opus-bay?from=nav"]');
    assert.ok(link, path);
    assert.match(link!.textContent!, /小小湾区/);
    assert.equal(link!.getAttribute('aria-current'), path === '/explore' ? null : 'page', path);
  }
  assert.equal(nav('/').querySelector('a[href="/play"]'), null);
});

test('W9-E-switch: routes, prerender, sitemap — /play is the redirect (LittleBayPage unrouted, kept), play.html is the game shell with canonical /opus-bay, /play out of the sitemap', () => {
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  assert.match(app, /<Route path="\/play" element=\{<PlayRedirect \/>\} \/>/);
  assert.doesNotMatch(app, /<LittleBayPage \/>/);
  assert.ok(fs.existsSync('src/pages/LittleBayPage.tsx'), 'kept in the repo for an easy revert');
  const prerender = fs.readFileSync('scripts/prerender.tsx', 'utf8');
  assert.match(prerender, /writeFile\(join\(outputDir, 'play\.html'\), opusBayDocument\(opusBayMetadata\(buildDate\)\)\)/);
  assert.doesNotMatch(prerender, /'\/play'/, 'not in the sitemap paths');
  const sitemap = fs.readFileSync('public/sitemap.xml', 'utf8');
  assert.ok(!sitemap.includes('/play</loc>'));
  assert.ok(sitemap.includes('/opus-bay</loc>'));
});

test('W9-E-switch: three.js + react-three-fiber keep their own chunk (once shared with /play\'s scene; without it Rollup put them into GameRoot)', async () => {
  const config = (await import('../vite.config')).default as { build: { rollupOptions: { output: { manualChunks: (id: string) => string | undefined } } } };
  const chunk = config.build.rollupOptions.output.manualChunks;
  for (const id of ['C:/x/node_modules/three/build/three.module.js', '/x/node_modules/three/build/three.core.js', '/x/node_modules/@react-three/fiber/dist/react-three-fiber.esm.js',
    '/x/node_modules/@react-three/fiber/dist/events-abc.esm.js', '/x/node_modules/react-reconciler/cjs/react-reconciler.production.min.js', '/x/node_modules/its-fine/dist/index.js', '/x/node_modules/suspend-react/dist/index.js']) assert.equal(chunk(id), 'three-vendor', id);
  for (const id of ['/x/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js', '/x/src/opus-bay/game/GameRoot.tsx', '/x/src/App.tsx', '/x/node_modules/zustand/esm/vanilla.mjs', '/x/node_modules/maplibre-gl/dist/maplibre-gl.js']) assert.equal(chunk(id), undefined, id);
  assert.equal(chunk('/x/node_modules/react-dom/client.js'), 'react-vendor');
  assert.equal(chunk('/x/node_modules/@react-three/fiber/node_modules/scheduler/index.js'), 'react-vendor', 'as before: the nested scheduler goes with React');
});
