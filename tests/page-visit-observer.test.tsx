import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { PageVisitObserver, visitSource } from '../src/components/PageVisitObserver';
import { MemoryRouter, useNavigate } from 'react-router-dom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://www.baylink.us/en/?utm_source=wechat&email=private@example.test' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup } = await import('@testing-library/react');
afterEach(cleanup);

test('source attribution maps only fixed categories and never returns raw UTM or referrer content', () => {
  assert.equal(visitSource('?utm_source=wechat&token=secret'), 'site_source_wechat');
  assert.equal(visitSource('?utm_source=xhs'), 'site_source_social');
  assert.equal(visitSource('?utm_source=private@example.test'), 'site_source_other');
  assert.equal(visitSource('', 'https://www.google.com/search?q=private'), 'site_source_search');
  assert.equal(visitSource('', 'https://evilgoogle.com/private'), 'site_source_other');
  assert.equal(visitSource('?from=card-sf&utm_source=unknown'), 'site_source_card');
  assert.equal(visitSource('?from=opus-return'), 'site_source_opus');
  assert.equal(visitSource(''), 'site_source_direct');
});

test('real SPA path changes count once, query/filter changes do not and all request bodies remain anonymous', context => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  function Navigation() {
    const navigate = useNavigate();
    return <><button onClick={() => navigate('/guides')}>guides</button><button onClick={() => navigate('/guides?q=private')}>filter</button><button onClick={() => navigate('/')}>home</button></>;
  }
  const view = render(<React.StrictMode><MemoryRouter initialEntries={['/?utm_source=wechat&email=private@example.test']}><PageVisitObserver /><Navigation /></MemoryRouter></React.StrictMode>);
  fireEvent.click(view.getByRole('button', { name: 'guides' }));
  fireEvent.click(view.getByRole('button', { name: 'filter' }));
  fireEvent.click(view.getByRole('button', { name: 'home' }));
  const bodies = fetch.mock.calls.map(call => JSON.parse(String(call.arguments[1]?.body)));
  assert.deepEqual(bodies.map(body => body.event), ['page_view', 'site_source_wechat', 'page_view', 'page_view']);
  assert.ok(bodies.every(body => Object.keys(body).sort().join(',') === 'event,locale'));
  assert.equal(JSON.stringify(bodies).includes('private'), false);
});
