// WEB-SHELL2 review: the REG-15 chunk guard, dialogs that load again after a failure, the boot retry bar (REG+2) and the
// prerendered <main> kept on screen at boot (boot-main.ts).
import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import React, { Suspense, useState } from 'react';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const hooks = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context);
} });
const { render, cleanup, act, fireEvent, waitFor } = await import('@testing-library/react');
const { settleChunk, chunkLoader, lazyChunk, isChunkLoadFailure, forgetLostChunks, lostChunkUrl, chunkRefetch } = await import('../src/lib/chunk-recovery');
const { OverlayBoundary } = await import('../src/app/OverlayHost');
const { useReopenAfterFailure } = await import('../src/app/useReopenAfterFailure');
const { bootApp, showBootRetryBar } = await import('../src/app/boot');
const { captureBootMain, bootMainFallback, hasBootMain, BootMainSettled } = await import('../src/app/boot-main');
after(() => { hooks.deregister(); });
const nodeImport = chunkRefetch.import;
afterEach(() => { cleanup(); document.body.innerHTML = ''; forgetLostChunks(); chunkRefetch.import = nodeImport; delete (globalThis as { location?: Location }).location; });
/** The page's location, so a lost chunk's URL can be checked as this site's own (Node has no `location`). */
const onSite = () => Object.defineProperty(globalThis, 'location', { configurable: true, value: dom.window.location });

const never = Symbol('pending');
/** The promise's value, or `never` if it is still pending after a few ticks. */
const within = <T,>(promise: Promise<T>, ms = 30) => Promise.race([promise, new Promise<typeof never>(resolve => setTimeout(() => resolve(never), ms))]);
const lostChunkError = () => new TypeError('Failed to fetch dynamically imported module: https://www.baylink.us/assets/ReportModal-x1.js');

test('settleChunk: a module passes through; `undefined` (a recovery reload is scheduled) never settles', async () => {
  const module = { default: 'page' };
  assert.equal(settleChunk(module), module);
  assert.equal(await within(Promise.resolve(undefined).then(settleChunk)), never);
});

test('a loader that picks a named export settles the module first: no TypeError before the reload (REG-15)', async () => {
  let picked = 0;
  const load = chunkLoader(async () => undefined as unknown as { Dialog: string }, module => { picked += 1; return module.Dialog; }, 1);
  assert.equal(await within(load()), never, 'waits for the reload instead of throwing on undefined.Dialog');
  assert.equal(picked, 0);
  // The unguarded pattern this replaces throws first: Vite's `undefined` reaches the pick.
  await assert.rejects(Promise.resolve(undefined as unknown as { Dialog: string }).then(m => ({ default: m.Dialog })).then(settleChunk), TypeError);
  assert.equal(await chunkLoader(async () => ({ Dialog: 'ok' }), m => m.Dialog, 1)(), 'ok');
});

test('every named-export loader in the shell is guarded before it picks (OverlayHost, route-loaders)', () => {
  const overlays = readFileSync('src/app/OverlayHost.tsx', 'utf8');
  assert.doesNotMatch(overlays, /\.then\(m => \(\{ default:/, 'dialogs pick through lazyChunk(load, pick)');
  assert.ok((overlays.match(/= lazyChunk\(\(\) => import\('[^']+'\), m => m\.\w+\);/g) || []).length >= 15);
  const routes = readFileSync('src/route-loaders.ts', 'utf8');
  const named = routes.split('\n').filter(line => line.includes('({ default: m.'));
  assert.equal(named.length, 3, 'privacy, terms, sms');
  for (const line of named) assert.match(line, /import\('[^']+'\)\.then\(settleChunk\)\.then\(m => \(\{ default: m\.\w+ \}\)\)/, line);
});

test('a lost chunk is named from the browser message only when it is one of this site’s own scripts', () => {
  assert.equal(lostChunkUrl(lostChunkError()), null, 'no location (Node): never');
  onSite();
  assert.equal(lostChunkUrl(lostChunkError()), 'https://www.baylink.us/assets/ReportModal-x1.js', 'Chrome');
  assert.equal(lostChunkUrl(new TypeError('error loading dynamically imported module: https://www.baylink.us/assets/Chat-Ab_9.js?retry=12')), 'https://www.baylink.us/assets/Chat-Ab_9.js', 'Firefox; an earlier retry query dropped');
  assert.equal(lostChunkUrl(new TypeError('Importing a module script failed.')), null, 'Safari names no URL');
  assert.equal(lostChunkUrl(new TypeError('Failed to fetch dynamically imported module: https://cdn.example.com/assets/x.js')), null, 'another origin');
  assert.equal(lostChunkUrl(new TypeError('Failed to fetch dynamically imported module: https://www.baylink.us/sw.js')), null, 'not a built chunk');
  assert.equal(lostChunkUrl('offline'), null);
});

test('the retry asks for a lost chunk under a new URL (the browser keeps a failed import), and fails with the first error', async () => {
  onSite();
  const asked: string[] = [];
  let loads = 0;
  const error = lostChunkError();
  chunkRefetch.import = async url => { asked.push(url); return { Dialog: 'fresh' }; };
  assert.equal(await chunkLoader(async () => { loads += 1; throw error; }, (m: { Dialog: string }) => m.Dialog, 1)(), 'fresh');
  assert.equal(loads, 1, 'the cached failure is not asked again');
  assert.match(asked[0], /^https:\/\/www\.baylink\.us\/assets\/ReportModal-x1\.js\?retry=\d+$/);
  chunkRefetch.import = async url => { asked.push(url); throw new TypeError(`Failed to fetch dynamically imported module: ${url}`); };
  await assert.rejects(chunkLoader(async () => { throw error; }, module => module, 1)(), (caught: unknown) => caught === error && isChunkLoadFailure(caught));
  assert.equal(asked.length, 2);
});

test('without a URL in the error (Safari) the retry loads once more; a load that fails twice is marked as a lost chunk', async () => {
  let calls = 0;
  const error = new TypeError('Importing a module script failed.');
  const load = chunkLoader(async () => { calls += 1; throw error; }, module => module, 1);
  await assert.rejects(load(), (caught: unknown) => caught === error && isChunkLoadFailure(caught));
  assert.equal(calls, 2);
  assert.equal(isChunkLoadFailure(new Error('a crash')), false);
  let flaky = 0;
  assert.equal(await chunkLoader(async () => { flaky += 1; if (flaky === 1) throw new TypeError('Importing a module script failed.'); return 'second try'; }, module => module, 1)(), 'second try');
});

function DialogHost({ Dialog, onFail }: { Dialog: React.ComponentType<{ text: string }>; onFail: (lost: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return <div>
    <p>page</p>
    <button type="button" onClick={() => setOpen(true)}>open</button>
    {open && <OverlayBoundary onFail={lost => { setOpen(false); onFail(lost); }}><Suspense fallback={<p>loading</p>}><Dialog text="dialog" /></Suspense></OverlayBoundary>}
  </div>;
}

test('a dialog whose chunk failed loads again the next time it opens (React.lazy and the browser alone keep the failure)', async t => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  onSite();
  // As in the browser: once the chunk failed, its import keeps failing at once; only a new URL is fetched again.
  let loads = 0;
  const refetches: string[] = [];
  let online = false;
  chunkRefetch.import = async url => { refetches.push(url); if (!online) throw new TypeError(`Failed to fetch dynamically imported module: ${url}`); return { Named: ({ text }: { text: string }) => <p>{text}</p> }; };
  const Dialog = lazyChunk(async (): Promise<{ Named: React.ComponentType<{ text: string }> }> => { loads += 1; throw lostChunkError(); }, m => m.Named, 1);
  const failures: boolean[] = [];
  const view = render(<DialogHost Dialog={Dialog} onFail={lost => failures.push(lost)} />);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'open' })); });
  await waitFor(() => assert.deepEqual(failures, [true]), { timeout: 500 });
  assert.deepEqual([loads, refetches.length], [1, 1], 'the first load and its one retry; no loop of fresh loads while it fails');
  assert.equal(view.container.textContent, 'pageopen', 'the page stays; the dialog closed');
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.deepEqual([loads, refetches.length], [1, 1], 'nothing loads again until the reader asks');
  online = true;
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'open' })); });
  await waitFor(() => assert.equal(view.container.textContent, 'pageopendialog'), { timeout: 500 });
  assert.deepEqual([loads, refetches.length], [2, 2]);
  assert.notEqual(refetches[0], refetches[1], 'each retry is a new URL');
});

test('a loader that resolves undefined keeps the dialog loading (the reload replaces the page); the boundary never trips', async () => {
  let failed = 0;
  const Dialog = lazyChunk(async () => undefined as unknown as { Named: React.ComponentType<{ text: string }> }, m => m.Named, 1);
  const view = render(<DialogHost Dialog={Dialog} onFail={() => { failed += 1; }} />);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'open' })); await new Promise(resolve => setTimeout(resolve, 30)); });
  assert.equal(view.container.textContent, 'pageopenloading');
  assert.equal(failed, 0);
});

test('a dialog kept mounted after its first open (BayBay) unmounts after a failure and gets a fresh boundary when reopened', async t => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  // React 18 renders once more after an error before it gives up, so the panel keeps crashing until the second ask.
  let crashing = true;
  const Panel = ({ open }: { open: boolean }) => { if (crashing) throw new Error('BayBay crashed'); return <p>{open ? 'panel open' : 'panel closed'}</p>; };
  function Host() {
    const [open, setOpen] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const attempt = useReopenAfterFailure(open);
    return <div>
      <button type="button" onClick={() => { setOpen(true); setLoaded(true); }}>ask</button>
      <button type="button" onClick={() => setOpen(false)}>close</button>
      {(open || (loaded && !attempt.failed)) && <OverlayBoundary key={attempt.key} onFail={() => { attempt.fail(); setOpen(false); }}><Panel open={open} /></OverlayBoundary>}
    </div>;
  }
  const view = render(<Host />);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'ask' })); });
  assert.equal(view.container.textContent, 'askclose', 'the crash closed the panel; nothing stays mounted');
  crashing = false;
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'ask' })); });
  assert.equal(view.container.textContent, 'askclosepanel open', 'asking again works');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'close' })); });
  assert.equal(view.container.textContent, 'askclosepanel closed', 'kept mounted after a good open (the conversation survives)');
});

const steps = (overrides: Partial<Parameters<typeof bootApp>[0]> = {}) => {
  const calls = { render: 0, bar: 0, settled: 0 };
  return {
    calls,
    options: {
      locale: Promise.resolve(), loadPage: async () => ({}), language: 'zh-Hans' as const, prerendered: true, rootHasContent: () => true, retryMs: 1,
      renderApp: () => { calls.render += 1; }, showRetryBar: () => { calls.bar += 1; }, onSettled: () => { calls.settled += 1; },
      ...overrides,
    },
  };
};

test('boot: everything loads → the app; the page code fails once → one retry, then the app', async () => {
  const ok = steps();
  assert.equal(await bootApp(ok.options), 'app');
  assert.deepEqual(ok.calls, { render: 1, bar: 0, settled: 1 });
  let tries = 0;
  const flaky = steps({ loadPage: async () => { tries += 1; if (tries === 1) throw lostChunkError(); return {}; } });
  assert.equal(await bootApp(flaky.options), 'app');
  assert.equal(tries, 2);
  assert.equal(flaky.calls.bar, 0);
});

test('boot: the page code is lost → the prerendered page stays under the retry bar; with nothing prerendered, the app renders', async () => {
  const lost = steps({ loadPage: async () => { throw lostChunkError(); } });
  assert.equal(await bootApp(lost.options), 'prerender+bar');
  assert.deepEqual(lost.calls, { render: 0, bar: 1, settled: 1 });
  const empty = steps({ loadPage: async () => { throw lostChunkError(); }, rootHasContent: () => false, prerendered: false });
  assert.equal(await bootApp(empty.options), 'app+bar');
  assert.deepEqual(empty.calls, { render: 1, bar: 1, settled: 1 });
});

test('boot: only the dictionary failed → 简体 app with the bar, but a 繁體 / English page prerendered for this URL stays readable', async () => {
  const failed = Promise.reject(new Error('dictionary'));
  failed.catch(() => {});
  const zh = steps({ locale: failed });
  assert.equal(await bootApp(zh.options), 'app+bar');
  assert.equal(zh.calls.render, 1);
  for (const language of ['en', 'zh-Hant'] as const) {
    const kept = steps({ locale: failed, language });
    assert.equal(await bootApp(kept.options), 'prerender+bar', language);
    assert.deepEqual(kept.calls, { render: 0, bar: 1, settled: 1 });
  }
  // An app-only URL (/en/me is served another page's HTML): the app, in 简体, with the bar.
  const spa = steps({ locale: failed, language: 'en', prerendered: false });
  assert.equal(await bootApp(spa.options), 'app+bar');
});

test('boot: a page chunk lost to a newer deploy (settleChunk pending) waits for the reload; nothing renders over the prerender', async () => {
  const stale = steps({ loadPage: () => Promise.resolve(undefined).then(settleChunk) });
  assert.equal(await within(bootApp(stale.options)), never);
  assert.deepEqual(stale.calls, { render: 0, bar: 0, settled: 0 });
});

test('the retry bar speaks the URL\'s language, is an alert, and is shown once', () => {
  showBootRetryBar('/en/guides');
  showBootRetryBar('/en/guides');
  const bars = document.querySelectorAll('.site-boot-retry');
  assert.equal(bars.length, 1);
  assert.equal(bars[0].getAttribute('role'), 'alert');
  assert.equal(bars[0].textContent, 'Some features did not loadRetry');
  assert.equal(bars[0].querySelector('button')!.type, 'button');
  document.body.innerHTML = '';
  showBootRetryBar('/zh-Hant/guides');
  assert.equal(document.querySelector('.site-boot-retry')!.textContent, '部分功能沒載入完重試');
});

test('boot-main: the prerendered <main> is the fallback only for its own URL, and only until the first route has rendered', async () => {
  dom.reconfigure({ url: 'https://www.baylink.us/guides' });
  document.body.innerHTML = '<div id="root"><main data-prerender-path="/guides"><h1>湾区生活指南</h1></main></div>';
  captureBootMain();
  assert.equal(hasBootMain(), true);
  let resolvePage!: () => void;
  let loaded = false;
  const ready = new Promise<void>(resolve => { resolvePage = resolve; }).then(() => { loaded = true; });
  const Page = () => { if (!loaded) throw ready; return <p>page</p>; };
  document.body.innerHTML = '';
  const view = render(<Suspense fallback={bootMainFallback('/guides')}><BootMainSettled /><Page /></Suspense>);
  assert.equal(view.container.querySelector('.site-boot-main h1')!.textContent, '湾区生活指南', 'no spinner, no blank frame');
  assert.equal(hasBootMain(), true, 'kept while the first route is suspended');
  await act(async () => { resolvePage(); await ready; });
  assert.equal(view.container.textContent, 'page');
  assert.equal(hasBootMain(), false, 'the first route committed: later suspensions show the spinner');
  assert.equal(bootMainFallback('/guides'), null);

  // Another URL than the one prerendered (an app-only route served the home page's HTML): never the snapshot.
  dom.reconfigure({ url: 'https://www.baylink.us/me' });
  document.body.innerHTML = '<div id="root"><main data-prerender-path="/"><h1>home</h1></main></div>';
  captureBootMain();
  assert.equal(hasBootMain(), false);
  // A different path at render time resets it too.
  dom.reconfigure({ url: 'https://www.baylink.us/about' });
  document.body.innerHTML = '<div id="root"><main data-prerender-path="/about"><h1>about</h1></main></div>';
  captureBootMain();
  assert.equal(bootMainFallback('/guides'), null);
  assert.equal(hasBootMain(), false);
  dom.reconfigure({ url: 'https://www.baylink.us/' });
});

test('boot-main: the account shell and the 404 stand in for the URLs they are served for, without counting as their page', () => {
  const snapshot = (pathname: string) => String(bootMainFallback(pathname)?.props.dangerouslySetInnerHTML.__html ?? '');
  // The account shell (account-shell.html, prerendered once for /me, served for every account page): the first route's
  // fallback on /my-week too, so its skeleton stays instead of the empty route-wait box. It is not /my-week's page, so
  // boot.ts would not keep it on screen when only the dictionary failed (it would stay for good: hasBootMain false).
  const shell = '<div id="root"><main data-prerender-path="/me"><div class="ui-container account-shell" data-size="content"><div aria-busy="true"></div></div></main></div>';
  for (const url of ['/my-week', '/me/bookings', '/messages', '/together', '/en/together', '/zh-Hant/my-week']) {
    dom.reconfigure({ url: `https://www.baylink.us${url}` });
    document.body.innerHTML = shell;
    captureBootMain();
    assert.equal(hasBootMain(), false, url);
    assert.match(snapshot(url), /account-shell/, url);
  }
  // On /me itself it is that URL's page.
  dom.reconfigure({ url: 'https://www.baylink.us/me' });
  document.body.innerHTML = shell;
  captureBootMain();
  assert.equal(hasBootMain(), true);

  // 404.html (prerendered for /404, served for any path that is not an app page): kept when the route table resolves the URL
  // to no page (the router's * route renders the same NotFoundPage), in every language, but not as this URL's page.
  const notFound = '<div id="root"><main data-prerender-path="/404"><div class="nf-page"><h1 id="nf-title">404</h1></div></main></div>';
  for (const url of ['/this-page-does-not-exist', '/en/this-page-does-not-exist', '/zh-Hant/a/b/c', '/guides/a/b']) {
    dom.reconfigure({ url: `https://www.baylink.us${url}` });
    document.body.innerHTML = notFound;
    captureBootMain();
    assert.equal(hasBootMain(), false, url);
    assert.match(snapshot(url), /nf-page/, url);
  }
  // /404 itself is the page it was prerendered for.
  dom.reconfigure({ url: 'https://www.baylink.us/404' });
  document.body.innerHTML = notFound;
  captureBootMain();
  assert.equal(hasBootMain(), true);
  // A route the table knows (an event id the build has no page for, an unknown category: that page renders the 404 itself
  // once it knows) keeps no 404 snapshot.
  for (const url of ['/events/no-such-event', '/category/no-such-category', '/guides']) {
    dom.reconfigure({ url: `https://www.baylink.us${url}` });
    document.body.innerHTML = notFound;
    captureBootMain();
    assert.equal(hasBootMain(), false, url);
    assert.equal(bootMainFallback(url), null, url);
  }
  // The shell or the 404 markup deeper than <main>'s own child does not count; an empty <main> never does.
  dom.reconfigure({ url: 'https://www.baylink.us/my-week' });
  document.body.innerHTML = '<div id="root"><main data-prerender-path="/"><section><div class="account-shell"></div><div class="nf-page"></div></section></main></div>';
  captureBootMain();
  assert.equal(bootMainFallback('/my-week'), null);
  document.body.innerHTML = '<div id="root"><main data-prerender-path="/me">  </main></div>';
  captureBootMain();
  assert.equal(bootMainFallback('/my-week'), null);
  document.body.innerHTML = '';
  dom.reconfigure({ url: 'https://www.baylink.us/' });
});
