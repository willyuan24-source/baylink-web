import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import React, { useEffect, useState } from 'react';
import { JSDOM } from 'jsdom';
import type { Locale } from '../src/i18n/locale';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/en/opus-bay?world=city', pretendToBeVisual: true });
const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true };
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const { render, cleanup, act } = await import('@testing-library/react');
const { Routes, Route, useLocation } = await import('react-router-dom');
const { LanguageRouter } = await import('../src/components/LanguageRouter');
const { chooseGameLocale } = await import('../src/opus-bay/ui/langChoice');
const { setLocale, useLocale } = await import('../src/i18n/locale');
const { languagePath, pathLanguage } = await import('../src/lib/language-path');
type LangEnv = import('../src/opus-bay/ui/langChoice').LangEnv;

afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });
after(() => {
  dom.window.close();
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

test('game choices replace conflicting language prefixes and legacy lang, keeping all other query values and the hash', async () => {
  for (const before of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    for (const selected of ['zh-Hans', 'zh-Hant', 'en'] as const) {
      const replaced: string[] = [];
      const saved: [Locale, boolean][] = [];
      const env: LangEnv = {
        set: async (locale, persist) => { saved.push([locale, persist]); return true; },
        location: { pathname: languagePath('/opus-bay', before), search: '?world=city&from=home&lang=en&at=ll%3A37.8024%2C-122.4058&start=free', hash: '#map' },
        replace: url => { replaced.push(url); },
      };
      assert.equal(await chooseGameLocale(selected, env), true);
      assert.deepEqual(saved, [[selected, true]]);
      assert.equal(replaced.length, 1, 'a legacy language query is removed even when the selected prefix already matches');
      const url = new URL(replaced[0], 'https://www.baylink.us');
      assert.equal(url.pathname, languagePath('/opus-bay', selected));
      assert.equal(pathLanguage(url.pathname), selected, 'the chosen edition survives reload prefix detection');
      assert.equal(url.searchParams.get('lang'), null);
      assert.equal(url.searchParams.get('world'), 'city');
      assert.equal(url.searchParams.get('from'), 'home');
      assert.equal(url.searchParams.get('at'), 'll:37.8024,-122.4058');
      assert.equal(url.searchParams.get('start'), 'free');
      assert.equal(url.hash, '#map');
    }
  }
});

test('the browser language choice notifies LanguageRouter without remounting the active world', async () => {
  dom.window.history.replaceState({ checkpoint: 'keep' }, '', '/en/opus-bay?world=city&from=home&lang=en#map');
  await setLocale('en', false);
  let mounts = 0;
  let unmounts = 0;
  let navigationEvents = 0;
  const onPopState = () => { navigationEvents++; };
  dom.window.addEventListener('popstate', onPopState);
  function ActiveWorld() {
    const [identity] = useState(() => ++mounts);
    const locale = useLocale();
    const location = useLocation();
    useEffect(() => () => { unmounts++; }, []);
    return <output data-testid="active-world" data-world-instance={identity}>{locale}:{location.pathname}:{location.hash}</output>;
  }
  try {
    const view = render(<LanguageRouter><Routes><Route path="/opus-bay" element={<ActiveWorld />} /></Routes></LanguageRouter>);
    const world = view.getByTestId('active-world');
    for (const selected of ['zh-Hans', 'zh-Hant', 'en'] as const) {
      await act(async () => { assert.equal(await chooseGameLocale(selected), true); });
      assert.equal(dom.window.location.pathname, languagePath('/opus-bay', selected));
      assert.equal(dom.window.location.search, '?world=city&from=home');
      assert.equal(dom.window.location.hash, '#map');
      assert.equal(dom.window.history.state.checkpoint, 'keep');
      assert.equal(view.container.querySelector('[data-testid="active-world"]') === world, true, 'world DOM stays mounted');
      assert.equal(world.textContent, `${selected}:/opus-bay:#map`);
      assert.equal(mounts, 1);
      assert.equal(unmounts, 0);
    }
    assert.equal(navigationEvents, 3);
  } finally { dom.window.removeEventListener('popstate', onPopState); }
});
