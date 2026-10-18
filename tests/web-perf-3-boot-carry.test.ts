import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

/**
 * WEB-PERF-3 move review (H20): what the reader types on 行程's prerendered form survives each swap in a real browser.
 * - Chrome sends focusout to the focused box as the app removes it, while it is still connected (jsdom sends none): the
 *   focus must stay with the next copy, not drop to the page, or every later key goes nowhere.
 * - The boot copy (app/boot-main.ts) draws the prerendered page again as it was built: the words, the focus and the caret
 *   go back into its box as it appears (src/features/plan/boot-carry.ts).
 */
const FORM = '<form class="planner-form"><label class="planner-question">这次想怎么过？<textarea maxlength="800"></textarea></label></form>';
const dom = new JSDOM(`<!doctype html><html><head></head><body><div id="root"><main data-prerender-path="/plan">${FORM}</main></div></body></html>`, { url: 'https://www.baylink.us/plan', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, MutationObserver: dom.window.MutationObserver });
const { bootCarry, clearBootCarry, watchBootForm } = await import('../src/features/plan/boot-carry');
const doc = dom.window.document;
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test('the words, the focus and the caret go from the prerendered box into the boot copy, through Chrome’s focusout on removal', async () => {
  watchBootForm(doc, () => {});
  const first = doc.querySelector('textarea')!;
  first.focus();
  first.value = '周六带孩子';
  first.setSelectionRange(5, 5);
  first.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.deepEqual(bootCarry(), { message: '周六带孩子', focused: true, start: 5, end: 5 });
  // The app's first commit: Chrome fires focusout while the box is still in the page, then removes it and draws the boot copy.
  const root = doc.querySelector('#root')!;
  first.dispatchEvent(new dom.window.FocusEvent('focusout', { bubbles: true }));
  root.innerHTML = `<main><div class="site-boot-main">${FORM}</div></main>`;
  await settle();
  assert.equal(bootCarry().focused, true, 'a box taken out of the page keeps the focus for the next copy');
  const boot = doc.querySelector<HTMLTextAreaElement>('.site-boot-main textarea')!;
  assert.equal(boot.value, '周六带孩子', 'the boot copy has the words');
  assert.equal(doc.activeElement, boot, 'and the focus');
  assert.equal(boot.selectionStart, 5, 'and the caret');
  // A real blur (the box stays in the page) drops the focus.
  boot.dispatchEvent(new dom.window.FocusEvent('focusout', { bubbles: true }));
  await settle();
  assert.equal(bootCarry().focused, false);
  clearBootCarry();
  assert.deepEqual(bootCarry(), {});
});
