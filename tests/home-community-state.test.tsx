import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter, Routes, Route, Outlet } from 'react-router-dom';
import HomePage from '../src/pages/HomePage';
import type { AppContextValue } from '../src/app/context';
import type { PostData } from '../src/lib/types';
import { setLocale } from '../src/i18n/locale';

afterEach(async () => { await setLocale('zh-Hans', false); });

function home(feedError: boolean, location = '/', overrides: Partial<AppContextValue> = {}) {
  const context = { user: null, posts: [], feedType: 'provider', keyword: '', regionFilter: '全部', categoryFilter: '全部', feedError, isInitialLoading: false, isLoadingMore: false, hasMore: false, blockedUserIds: [], retryFeed() {}, ...overrides } as unknown as AppContextValue;
  return renderToStaticMarkup(<StaticRouter location={location}><Routes><Route element={<Outlet context={context} />}><Route index element={<HomePage />} /></Route></Routes></StaticRouter>);
}

test('a failed initial community fetch remains unknown and exposes its retry without opening the board', () => {
  const html = home(true);
  assert.ok(html.includes('邻里信息暂时无法读取，请稍后重试。'));
  assert.ok(!html.includes('筛选结果 0 条'));
  assert.ok(!html.includes('共 0 条信息'));
  assert.ok(!html.includes('这里还在起步'));
  assert.ok(html.includes('home-feed-section'));
  assert.ok(html.includes('重新加载'));
});

test('a successful empty community result honestly shows zero and the starting-stage explanation', () => {
  const html = home(false);
  assert.ok(html.includes('筛选结果 0 条'));
  assert.ok(html.includes('这里还在起步'));
  assert.ok(!html.includes('邻里信息暂时无法读取'));
  assert.ok(!html.includes('id="home-feed-section"'), 'the default empty discovery page keeps secondary community content folded');
});

test('the published neighborhood anchor reveals its target even when the community has no recent posts', () => {
  const html = home(false, '/#home-feed-section');
  assert.ok(html.includes('id="home-feed-section"'));
  assert.ok(html.includes('搜索本地信息'));
  assert.ok(html.includes('这里还在起步'));
  assert.ok(!html.includes('id="home-feed-section"', html.indexOf('id="home-feed-section"') + 1));
  assert.ok(!home(false, '/#unrelated-section').includes('id="home-feed-section"'));
});

test('English neighborhood copy distinguishes filtered and partial counts, loading and unavailable results', async () => {
  await setLocale('en', false);
  const posts = [{ id: 'old-fixture', title: '保留作者原文', createdAt: 0 }] as PostData[];
  const saved = structuredClone(posts);
  const intro = (feedError: boolean, overrides: Partial<AppContextValue> = {}) => JSDOM.fragment(home(feedError, '/', overrides)).querySelector('.bay-community-intro p')!.textContent!;
  const explanation = 'This board is just getting started. Contact the author to confirm older listings are still available.';
  assert.equal(intro(false, { posts }), `Matching listings: 1; posted in the past 30 days: 0. ${explanation}`);
  assert.equal(intro(false, { posts, hasMore: true }), `Listings loaded so far: 1; posted in the past 30 days: 0. ${explanation}`);
  assert.equal(intro(false, { isInitialLoading: true }), 'Loading current neighborhood listings…');
  const unavailable = intro(true);
  assert.doesNotMatch(unavailable, /[\u3400-\u9fff]|\d/);
  assert.ok(!unavailable.includes(explanation), 'a failed read must not claim the board is empty or just starting');
  assert.deepEqual(posts, saved, 'interface copy must not rewrite the author’s post');
});
