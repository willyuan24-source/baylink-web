import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { Toast } from '../src/components/Toast';
const dom = new JSDOM('<!doctype html><body></body>');
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
afterEach(cleanup);

test('an actionable error remains until the reader explicitly dismisses it', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let closed = 0;
  const view = render(<Toast type="error" message="保存失败，请重试" onClose={() => closed++} />);
  act(() => context.mock.timers.tick(60000));
  assert.equal(closed, 0);
  assert.equal(view.getByRole('alert').getAttribute('aria-live'), 'assertive');
  fireEvent.click(view.getByRole('button', { name: '关闭提示' }));
  assert.equal(closed, 1);
});

test('a non-error notice closes after six seconds using the latest callback without extending its timer', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let first = 0, latest = 0;
  const view = render(<Toast type="success" message="已保存" onClose={() => first++} />);
  act(() => context.mock.timers.tick(3000));
  view.rerender(<Toast type="success" message="已保存" onClose={() => latest++} />);
  act(() => context.mock.timers.tick(2999));
  assert.equal(latest, 0);
  act(() => context.mock.timers.tick(1));
  assert.equal(first, 0);
  assert.equal(latest, 1);
});
