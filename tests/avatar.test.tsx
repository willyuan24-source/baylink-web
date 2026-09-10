import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import Avatar from '../src/components/Avatar';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
const { render, fireEvent, cleanup } = await import('@testing-library/react');
afterEach(cleanup);

test('unavailable avatars fall back to identity and a replacement URL gets a new attempt', () => {
  const view = render(<Avatar src="/broken.jpg" name="Maya Chen" theme="sunset" />);
  fireEvent.error(view.container.querySelector('img')!);
  assert.equal(view.getByRole('img', { name: 'Maya Chen' }).textContent, 'MC');
  view.rerender(<Avatar src="/replacement.jpg" name="Maya Chen" theme="sunset" />);
  assert.equal(view.container.querySelector('img')?.getAttribute('src'), '/replacement.jpg');
});

test('initials preserve a full emoji grapheme and use the selected profile theme', () => {
  const view = render(<Avatar name="👩🏽‍💻 Maya" theme="lavender" />);
  const fallback = view.getByRole('img');
  assert.equal(fallback.textContent, '👩🏽‍💻');
  assert.equal(fallback.getAttribute('translate'), 'no');
  assert.ok(fallback.getAttribute('style')?.includes('linear-gradient'));
});
