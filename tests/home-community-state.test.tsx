import assert from 'node:assert/strict';
import test, { afterEach, before } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter, Routes, Route, Outlet } from 'react-router-dom';
import HomePage from '../src/pages/HomePage';
import type { AppContextValue } from '../src/app/context';
import type { PostData } from '../src/lib/types';
import { setLocale } from '../src/i18n/locale';
import { loadCommunityBoard } from '../src/pages/community-board-loader';

// The board is its own chunk (WEB-HOMEPREP); a static render shows it once it has loaded, as the app does after its
// first request.
before(async () => { await loadCommunityBoard(); });
afterEach(async () => { await setLocale('zh-Hans', false); });

function home(feedError: boolean, location = '/', overrides: Partial<AppContextValue> = {}) {
  const context = { user: null, posts: [], feedType: 'provider', keyword: '', regionFilter: '全部', categoryFilter: '全部', feedError, isInitialLoading: false, isLoadingMore: false, hasMore: false, blockedUserIds: [], retryFeed() {}, ...overrides } as unknown as AppContextValue;
  return renderToStaticMarkup(<StaticRouter location={location}><Routes><Route element={<Outlet context={context} />}><Route index element={<HomePage />} /></Route></Routes></StaticRouter>);
}
const recentPosts = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `fresh-${index}`, title: `fresh ${index}`, createdAt: Date.now() - index * 60_000 })) as unknown as PostData[];

test('until the board has four fresh posts, the home shows one quiet line instead of counts (1007 §4.2 ⑨, HOMEIA-02)', () => {
  for (const [label, html] of [['empty', home(false)], ['failed', home(true)], ['loading', home(false, '/', { isInitialLoading: true })], ['three fresh', home(false, '/', { posts: recentPosts(3) })]] as const) {
    const doc = JSDOM.fragment(html);
    assert.equal(doc.querySelector('.home-community button')?.textContent, '邻里信息（测试中）· 去看看', label);
    assert.equal(doc.querySelector('#home-feed-section'), null, `${label}: the board stays folded`);
    for (const text of ['筛选结果', '近 30 天发布', '这里还在起步', '发布需求', '邻里信息暂时无法读取']) assert.ok(!html.includes(text), `${label}: no "${text}" on the home`);
  }
  assert.equal(JSDOM.fragment(home(false)).querySelector('.bay-home-footer'), null, 'the site footer closes the home; no second footer');
});

test('the published neighborhood anchor opens the board (four fresh posts open it too: tests/home-community-board-failure)', () => {
  const anchored = home(false, '/#home-feed-section');
  assert.ok(anchored.includes('id="home-feed-section"'));
  assert.ok(!anchored.includes('id="home-feed-section"', anchored.indexOf('id="home-feed-section"') + 1), 'one board');
  assert.ok(!home(false, '/#unrelated-section').includes('id="home-feed-section"'));
});

test('English: the neighborhood line is English', async () => {
  await setLocale('en', false);
  const line = JSDOM.fragment(home(false)).querySelector('.home-community button')!.textContent!;
  assert.equal(line, 'Neighborhood board (beta) · Take a look');
  assert.doesNotMatch(line, /[㐀-鿿]/);
});
