/**
 * What the reader did on 行程's prerendered form before the workspace was in (H20, WEB-PERF-3 review): the question typed
 * so far (a tap on an example question fills it with the chip's words) and whether the box had the focus (with the caret).
 * From the moment 行程's route code runs (PlanWorkspaceSlot captures the prerendered page) until the workspace mounts, one
 * listener on the document records it from whichever copy of the form is on screen: the prerendered page's own, the
 * boot copy (app/boot-main.ts) or the slot's (PlanWorkspaceSlot). Each copy the slot draws again puts it back; the
 * workspace reads it in its first render, then stops the listener and clears it, so the swap from the prerendered page
 * to the live one never erases a word or drops the focus. A native submit (帮我挑选方案) meanwhile would reload the page and
 * lose the words: it is held, and the workspace is asked for.
 */
export type BootCarry = { message?: string; focused?: boolean; start?: number | null; end?: number | null };

let carry: BootCarry = {};
let stop: (() => void) | undefined;

/** What the prerendered form holds so far. */
export const bootCarry = (): BootCarry => carry;
/** Record a change on the prerendered form. */
export const recordBootCarry = (next: BootCarry): void => { carry = { ...carry, ...next }; };

const questionBox = (target: EventTarget | null) => {
  const element = target as HTMLTextAreaElement | null;
  return element?.tagName === 'TEXTAREA' && element.closest('.planner-question') ? element : null;
};

/**
 * Start recording (PlanWorkspaceSlot, when it captures the prerendered page). `onAct` is the reader's tap on an example or
 * on 帮我挑选方案: the workspace is wanted now.
 */
export function watchBootForm(doc: Document, onAct: () => void): void {
  if (stop) return;
  const box = doc.querySelector<HTMLTextAreaElement>('.planner-question textarea');
  // Typed before this code ran (the page was only HTML then).
  if (box && box.value !== box.defaultValue) carry = { ...carry, message: box.value };
  if (box && doc.activeElement === box) carry = { ...carry, focused: true, start: box.selectionStart, end: box.selectionEnd };
  const onInput = (event: Event) => { const field = questionBox(event.target); if (field) carry = { ...carry, message: field.value, focused: true, start: field.selectionStart, end: field.selectionEnd }; };
  const onFocus = (event: Event) => { if (questionBox(event.target)) carry = { ...carry, focused: true }; };
  // A box taken out of the page (the next copy replaces it) keeps the focus for that copy; a blur in the page drops it.
  const onBlur = (event: Event) => { const field = questionBox(event.target); if (field && field.isConnected) carry = { ...carry, focused: false }; };
  const onClick = (event: Event) => {
    const chip = (event.target as Element | null)?.closest?.('.planner-examples button');
    const field = chip?.closest('form')?.querySelector<HTMLTextAreaElement>('.planner-question textarea');
    if (!chip || !field) return;
    field.value = chip.textContent ?? '';
    carry = { ...carry, message: field.value };
    onAct();
  };
  const onSubmit = (event: Event) => { if ((event.target as Element | null)?.closest?.('.planner-form')) { event.preventDefault(); onAct(); } };
  doc.addEventListener('input', onInput, true);
  doc.addEventListener('focusin', onFocus, true);
  doc.addEventListener('focusout', onBlur, true);
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('submit', onSubmit, true);
  stop = () => {
    doc.removeEventListener('input', onInput, true);
    doc.removeEventListener('focusin', onFocus, true);
    doc.removeEventListener('focusout', onBlur, true);
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('submit', onSubmit, true);
  };
}

/** The workspace has read it (its first render) and taken the focus: stop recording and forget it. */
export const clearBootCarry = (): void => { stop?.(); stop = undefined; carry = {}; };
