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
  // (W9-E-review, E-RC-2) BufferGeometryUtils was pinned to no chunk here; it has its own again (as before the switch): with
  // no chunk rule Rollup folded it into GameRoot, +1.25 KB gzip over W9-Z's 258.5 KB guard
  assert.equal(chunk('/x/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js'), 'BufferGeometryUtils');
  assert.equal(chunk('C:\\x\\node_modules\\three\\examples\\jsm\\utils\\BufferGeometryUtils.js'), 'BufferGeometryUtils');
  for (const id of ['/x/src/opus-bay/game/GameRoot.tsx', '/x/src/App.tsx', '/x/node_modules/zustand/esm/vanilla.mjs', '/x/node_modules/maplibre-gl/dist/maplibre-gl.js']) assert.equal(chunk(id), undefined, id);
  assert.equal(chunk('/x/node_modules/react-dom/client.js'), 'react-vendor');
  assert.equal(chunk('/x/node_modules/@react-three/fiber/node_modules/scheduler/index.js'), 'react-vendor', 'as before: the nested scheduler goes with React');
});

test('W9-E-review (E-RC-3): the homepage card and the sidebar enter the game with a full page load, never client-side', async () => {
  // a client-side entry left the game's store (phase 'playing') and its window / document listeners behind after Back, and
  // the next entry remounted straight into the paused world: no title, no Start, the sound never unlocked
  const { fireEvent } = await import('@testing-library/react');
  const view = render(<MemoryRouter initialEntries={['/']}><HomeDiscovery onAskBayBay={() => {}} onBrowseCommunity={() => {}} today="2026-10-02" /><SiteNavigation active="home" category="全部" homeActive user={null} notification={false} notificationCount={0} onCreate={() => {}} onAsk={() => {}} onAccount={() => {}} /><Where /></MemoryRouter>);
  for (const href of ['/opus-bay?from=home', '/opus-bay?from=nav']) {
    const a = view.container.querySelector(`a[href="${href}"]`);
    assert.ok(a, href);
    assert.equal(fireEvent.click(a!), true, `${href}: the browser's own navigation (not prevented)`);
    assert.equal(view.getByTestId('where').textContent, '/', `${href}: the router did not move`);
  }
  // the other links stay client-side (the control: this test sees a router move)
  fireEvent.click(view.container.querySelector('a[href="/calendar"]')!);
  assert.equal(view.getByTestId('where').textContent, '/calendar');
});

test('W9-E-review (E-RP-1 / E-RC-4): an old ticket is served the planner\'s page (first paint, link preview), and no game head tags reach /plan', async () => {
  // vercel.json: the first route (before the filesystem) whose src and `has` queries match
  type RouteRule = { src?: string; dest?: string; handle?: string; continue?: boolean; has?: { type: string; key: string }[] };
  const routes = (JSON.parse(fs.readFileSync('vercel.json', 'utf8')) as { routes: RouteRule[] }).routes;
  const served = (url: string) => {
    const u = new URL(url, 'https://www.baylink.us');
    for (const r of routes) {
      if (r.handle) break;
      const m = r.src && r.dest && !r.continue ? new RegExp(r.src).exec(u.pathname) : null; // (the headers rule continues)
      if (!m) continue;
      if (r.has && !r.has.every(h => h.type === 'query' && u.searchParams.has(h.key))) continue;
      return r.dest!.replace(/\$(\d)/g, (_, i: string) => m[Number(i)]);
    }
    return undefined;
  };
  for (const t of ['/play?date=2026-10-10&stops=place:golden-gate', '/play?date=2026-10-10&places=ferry-building,coit-tower&lang=zh-Hant', '/play/?stops=a']) assert.equal(served(t), '/plan.html', t);
  for (const g of ['/play', '/play?lang=en', '/play?from=nav']) assert.equal(served(g), '/play.html', g);
  assert.equal(served('/opus-bay?lang=zh-Hant'), '/opus-bay.html');
  assert.equal(served('/plan?stops=a'), '/plan.html');
  // where play.html is served anyway (a host without the route), the game's extra head tags leave with the visitor
  const { opusBayHeadExtras } = await import('../src/lib/opus-bay-metadata');
  const reset = () => { document.head.innerHTML = opusBayHeadExtras(); return document.head.querySelectorAll('meta').length; };
  assert.ok(reset() >= 4);
  let view = render(<MemoryRouter initialEntries={['/play?date=2026-10-10&stops=place:golden-gate']}><Routes><Route path="/play" element={<PlayRedirect />} /><Route path="/plan" element={<p>plan</p>} /></Routes></MemoryRouter>);
  assert.equal(view.container.textContent, 'plan');
  assert.equal(document.head.querySelectorAll('meta').length, 0, 'og:image:* / og:locale:alternate removed for /plan');
  view.unmount();
  reset();
  view = render(<MemoryRouter initialEntries={['/play?lang=en']}><Routes><Route path="/play" element={<PlayRedirect />} /><Route path="/opus-bay" element={<p>game</p>} /></Routes></MemoryRouter>);
  assert.equal(view.container.textContent, 'game');
  assert.ok(document.head.querySelectorAll('meta').length >= 4, 'kept for the game');
  document.head.innerHTML = '';
});
