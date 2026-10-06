import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter, Routes, Route, Outlet } from 'react-router-dom';
import HomePage from '../src/pages/HomePage';
import type { AppContextValue } from '../src/app/context';

function home(feedError: boolean) {
  const context = { user: null, posts: [], feedType: 'provider', keyword: '', regionFilter: '全部', categoryFilter: '全部', feedError, isInitialLoading: false, isLoadingMore: false, hasMore: false, blockedUserIds: [], retryFeed() {} } as unknown as AppContextValue;
  return renderToStaticMarkup(<StaticRouter location="/"><Routes><Route element={<Outlet context={context} />}><Route index element={<HomePage />} /></Route></Routes></StaticRouter>);
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
});
