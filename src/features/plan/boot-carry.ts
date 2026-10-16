/**
 * What the reader did on 行程's prerendered form before the workspace was in (H20, WEB-PERF-3 review): the question typed
 * so far (a tap on an example question fills it with the chip's words) and whether the box had the focus (with the caret).
 * PlanWorkspaceSlot records it on the prerendered form and puts it back each time that form is drawn again; the workspace
 * reads it in its first render and then clears it, so the swap from the prerendered page to the live one never erases a
 * word or drops the focus.
 */
export type BootCarry = { message?: string; focused?: boolean; start?: number | null; end?: number | null };

let carry: BootCarry = {};

/** What the prerendered form holds so far (PlanWorkspaceSlot). */
export const bootCarry = (): BootCarry => carry;
/** Record a change on the prerendered form. */
export const recordBootCarry = (next: BootCarry): void => { carry = { ...carry, ...next }; };
/** The workspace has read it (its first render) and taken the focus: forget it. */
export const clearBootCarry = (): void => { carry = {}; };
