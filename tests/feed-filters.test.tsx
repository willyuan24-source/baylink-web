import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { useLayoutEffect } from 'react';
import { JSDOM } from 'jsdom';
import type { NavigateFunction } from 'react-router-dom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, act, cleanup } = await import('@testing-library/react');
const { MemoryRouter, useLocation, useNavigate } = await import('react-router-dom');
const { useFeedFilters, parseFeedFilters } = await import('../src/app/useFeedFilters');
afterEach(cleanup);
let navigate: NavigateFunction;
function Filters() {
  const location = useLocation();
  const nav = useNavigate();
  useLayoutEffect(() => { navigate = nav; }, [nav]);
  const filters = useFeedFilters(location, nav);
  return <><input aria-label="query" value={filters.keyword} onChange={(event) => filters.setKeyword(event.target.value)} />
    <button onClick={() => filters.setRegionFilter('东湾')}>east</button>
    <button onClick={() => { filters.setKeyword(''); filters.setRegionFilter('全部'); nav(filters.feedLocation('/category/rent')); }}>category</button>
    <button onClick={() => nav(filters.feedLocation('/', { keyword: '搬家' }))}>search from elsewhere</button>
    <output data-testid="state">{JSON.stringify({ path: location.pathname, query: filters.keyword, region: filters.regionFilter, type: filters.feedType, search: location.search })}</output></>;
}
const state = (view: ReturnType<typeof render>) => JSON.parse(view.getByTestId('state').textContent || '{}');

test('shared filter links initialize correctly, typing stays in sync, and browser Back restores the previous search', () => {
  const view = render(<MemoryRouter initialEntries={['/?q=租房&region=东湾&type=client']}><Filters /></MemoryRouter>);
  assert.equal(state(view).query, '租房');
  assert.equal(state(view).region, '东湾');
  assert.equal(state(view).type, 'client');
  fireEvent.change(view.getByLabelText('query'), { target: { value: 'San Mateo 租房' } });
  assert.equal(state(view).query, 'San Mateo 租房');
  assert.equal(new URLSearchParams(state(view).search).get('q'), 'San Mateo 租房');
  act(() => navigate('/?q=维修'));
  assert.equal(state(view).query, '维修');
  assert.equal(state(view).region, '全部');
  act(() => navigate(-1));
  assert.equal(state(view).query, 'San Mateo 租房');
  assert.equal(state(view).region, '东湾');
});

test('combined category navigation uses the latest filter changes and other pages keep their own query parameters', () => {
  const view = render(<MemoryRouter initialEntries={['/?q=old&region=东湾']}><Filters /></MemoryRouter>);
  fireEvent.click(view.getByRole('button', { name: 'category', exact: true }));
  assert.equal(state(view).path, '/category/rent');
  assert.equal(state(view).query, '');
  assert.equal(state(view).region, '全部');
  assert.equal(state(view).search, '');
  act(() => navigate('/guides?q=打印'));
  assert.equal(state(view).search, '?q=打印');
  fireEvent.click(view.getByRole('button', { name: 'search from elsewhere' }));
  assert.equal(state(view).path, '/');
  assert.equal(state(view).query, '搬家');
});

test('unknown region and type values safely fall back and oversized search values are bounded', () => {
  assert.deepEqual(parseFeedFilters('?region=Atlantis&type=admin'), { keyword: '', regionFilter: '全部', feedType: 'provider' });
  assert.equal(parseFeedFilters(`?q=${'x'.repeat(200)}`).keyword.length, 80);
});

test('a refreshed post overlay restores filters from its preserved category background', () => {
  const backgroundLocation = { pathname: '/category/rent', search: '?q=Studio&region=东湾&type=client', hash: '', key: 'background', state: null };
  const view = render(<MemoryRouter initialEntries={[{ pathname: '/posts/example', state: { backgroundLocation } }]}><Filters /></MemoryRouter>);
  assert.equal(state(view).query, 'Studio');
  assert.equal(state(view).region, '东湾');
  assert.equal(state(view).type, 'client');
  fireEvent.click(view.getByRole('button', { name: 'category', exact: true }));
  assert.equal(state(view).path, '/category/rent');
  assert.equal(state(view).query, '');
});
