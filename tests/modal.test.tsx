import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { ModalShell } from '../src/components/ui/Modal';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// jsdom has no layout. Expose only connected, visible controls to the focus trap.
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
const { render, fireEvent, cleanup } = await import('@testing-library/react');

beforeEach(() => {
  document.body.innerHTML = '<div id="root"><button id="opener">Open</button><main id="scroll-container"></main></div>';
  document.body.style.overflow = '';
});
afterEach(() => cleanup());

test('modal traps Tab, ignores IME Escape, and restores opener focus on close', () => {
  const opener = document.getElementById('opener')!;
  opener.focus();
  let closed = 0;
  const view = render(<ModalShell label="Dialog" onClose={() => { closed += 1; }}><button>First</button><button>Last</button></ModalShell>);
  const first = view.getByText('First');
  const last = view.getByText('Last');
  assert.ok(document.activeElement === first, "focus remains on the expected control");
  last.focus();
  fireEvent.keyDown(last, { key: 'Tab' });
  assert.ok(document.activeElement === first, "focus remains on the expected control");
  fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
  assert.ok(document.activeElement === last, "focus remains on the expected control");
  fireEvent.keyDown(last, { key: 'Escape', isComposing: true });
  assert.equal(closed, 0);
  fireEvent.keyDown(last, { key: 'Escape' });
  assert.equal(closed, 1);
  view.unmount();
  assert.ok(document.activeElement === opener, "focus remains on the expected control");
});

test('nested dialogs keep only the top interactive and return focus to the parent', () => {
  const closed: string[] = [];
  const base = <ModalShell key="base" label="Base" onClose={() => closed.push('base')}><button>Base button</button></ModalShell>;
  const top = <ModalShell key="top" label="Top" onClose={() => closed.push('top')}><button>Top button</button></ModalShell>;
  const view = render(<>{base}</>);
  const baseButton = view.getByText('Base button');
  view.rerender(<>{base}{top}</>);
  const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')];
  assert.equal(dialogs[0].inert, true);
  assert.equal(!!dialogs[1].inert, false);
  assert.ok(Number(dialogs[1].style.zIndex) > Number(dialogs[0].style.zIndex));
  fireEvent.keyDown(view.getByText('Top button'), { key: 'Escape' });
  assert.deepEqual(closed, ['top']);
  view.rerender(<>{base}</>);
  assert.ok(document.activeElement === baseButton, "focus remains on the expected control");
  assert.equal(dialogs[0].inert, false);
  assert.equal(document.body.style.overflow, 'hidden');
  view.unmount();
  assert.equal(document.body.style.overflow, '');
});

test('simultaneously mounted dialogs do not leave the top inert', () => {
  const view = render(<><ModalShell label="Lower"><button>Lower</button></ModalShell><ModalShell label="Upper"><button>Upper</button></ModalShell></>);
  const upper = view.getByText('Upper').closest<HTMLElement>('[role="dialog"]')!;
  assert.equal(!!upper.inert, false);
  assert.ok(document.activeElement === view.getByText('Upper'), "focus remains on the expected control");
});

test('removing a lower dialog first keeps the remaining dialog focused and page locked', () => {
  document.getElementById('opener')!.focus();
  const base = <ModalShell key="base" label="Base"><button>Base button</button></ModalShell>;
  const top = <ModalShell key="top" label="Top"><button>Top button</button></ModalShell>;
  const view = render(<>{base}</>);
  view.rerender(<>{base}{top}</>);
  const topButton = view.getByText('Top button');
  view.rerender(<>{top}</>);
  assert.ok(document.activeElement === topButton, "focus remains on the expected control");
  assert.equal(document.body.style.overflow, 'hidden');
  assert.equal(document.getElementById('root')!.inert, true);
  view.unmount();
  assert.ok(document.activeElement === document.getElementById('opener'), 'out-of-order cleanup returns to the original page opener');
});

test('removing the middle of three dialogs does not reactivate the bottom dialog', () => {
  const base = <ModalShell key="base" label="Base"><button>Base</button></ModalShell>;
  const middle = <ModalShell key="middle" label="Middle"><button>Middle</button></ModalShell>;
  const top = <ModalShell key="top" label="Top"><button>Top</button></ModalShell>;
  const view = render(<>{base}</>);
  view.rerender(<>{base}{middle}</>);
  view.rerender(<>{base}{middle}{top}</>);
  view.rerender(<>{base}{top}</>);
  assert.equal(view.getByText('Base').closest<HTMLElement>('[role="dialog"]')!.inert, true);
  assert.ok(document.activeElement === view.getByText('Top'), "focus remains on the expected control");
});

test('closing the last dialog restores pre-existing overflow and inert settings', () => {
  const root = document.getElementById('root')!;
  const scroller = document.getElementById('scroll-container')!;
  document.body.style.overflow = 'clip';
  scroller.style.overflow = 'scroll';
  root.inert = true;
  const view = render(<ModalShell label="Temporary"><button>Done</button></ModalShell>);
  view.unmount();
  assert.equal(document.body.style.overflow, 'clip');
  assert.equal(scroller.style.overflow, 'scroll');
  assert.equal(root.inert, true);
});
