// 弹层原语：portal + 焦点陷阱 + Esc 关闭 + 背景滚动锁 + aria-modal
// ModalShell 不带任何视觉样式（className 由调用方给），保证既有弹层迁移时逐像素不变。
import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// 弹层栈：嵌套弹层时只有最上层响应 Esc
type ModalEntry = { id: symbol; container: HTMLElement };
const modalStack: ModalEntry[] = [];
const syncModalStack = () => {
  modalStack.forEach(({ container }, index) => {
    container.style.zIndex = String(200 + (index + 1) * 10);
    container.inert = index !== modalStack.length - 1;
  });
};

// 页面锁（滚动 + inert）计数：嵌套弹层全部关闭后才解锁。
// The viewport takes its overflow from <html>: design.css's `html { overflow-x:clip }` keeps body's value from reaching it,
// so the old lock on body (and on #scroll-container, a <main> in the page flow, not a scroller) left the page scrolling
// under an open dialog. The lock sets overflow:hidden on <html> and keeps a classic scrollbar's gutter (scrollbar-gutter:
// stable), so nothing moves sideways. Body and <main> are left alone: overflow:hidden on them makes them the scroll container
// of the sticky top bar and the guide rails, which then jump off the screen behind the dialog.
let scrollLockCount = 0;
let originalPageState: { style: CSSStyleDeclaration; overflow: string; gutter: string; appRoot: HTMLElement | null; appRootInert: boolean; focusedElement: HTMLElement | null } | null = null;

const lockScroll = (focusedElement: HTMLElement | null) => {
  if (++scrollLockCount !== 1) return;
  const html = document.documentElement;
  const { style } = html;
  const appRoot = document.getElementById('root');
  originalPageState = { style, overflow: style.overflow, gutter: style.scrollbarGutter, appRoot, appRootInert: !!appRoot?.inert, focusedElement };
  // A classic scrollbar (not the overlay kind of phones and macOS) is innerWidth - clientWidth wide; jsdom has no layout.
  if (html.clientWidth > 0 && window.innerWidth > html.clientWidth) style.scrollbarGutter = 'stable';
  style.overflow = 'hidden';
  if (appRoot) appRoot.inert = true;
};
const unlockScroll = () => {
  if (--scrollLockCount !== 0 || !originalPageState) return;
  const { style, overflow, gutter, appRoot, appRootInert } = originalPageState;
  style.overflow = overflow;
  style.scrollbarGutter = gutter;
  if (appRoot) appRoot.inert = appRootInert;
  originalPageState = null;
};

const canRestoreFocus = (element: HTMLElement | null): element is HTMLElement => {
  if (!element?.isConnected || element.matches(':disabled') || element.getClientRects().length === 0) return false;
  for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
    if (parent.inert || parent.hidden) return false;
  }
  if (window.getComputedStyle(element).visibility === 'hidden') return false;
  return true;
};

const restoreFocus = (element: HTMLElement | null) => {
  if (!canRestoreFocus(element)) return false;
  element.focus({ preventScroll: true });
  return document.activeElement === element;
};

// The scroll lock, inert background and initial focus must land in the same commit
// that shows the dialog. A passive effect can run a frame later when the dialog
// mounts through a non-sync update (e.g. a lazy dialog resolving its Suspense
// boundary), leaving a visible dialog over a scrollable, focusable page.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const getFocusable = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((el) => el.getClientRects().length > 0);

/**
 * DialogWait's hold on the page while a dialog's chunk loads: the dialogs' own lock (no scrolling, an inert #root), taken in
 * the commit that shows the scrim. Focus is not moved (Chrome itself moves it off an opener that turns inert, to <body>); the
 * opener is kept with the lock. The Suspense commit removes the wait before the dialog's layout effect runs, so the wait lets
 * go a microtask later: the dialog's lock nests inside it and the page is locked once, and the opener the wait kept is the
 * one focus returns to. A wait that ends without a dialog (the opener went away, the chunk failed) releases the page and gives
 * focus back to the opener if the inert page dropped it.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useDialogWaitLock() {
  useIsomorphicLayoutEffect(() => {
    lockScroll(document.activeElement as HTMLElement | null);
    return () => {
      const opener = originalPageState?.focusedElement || null;
      queueMicrotask(() => {
        unlockScroll();
        if (!scrollLockCount && document.activeElement === document.body) restoreFocus(opener);
      });
    };
  }, []);
}

/** 弹层行为 hook：挂载期间锁滚动、陷住 Tab 焦点、Esc 触发 onClose、卸载时还原焦点。 */
export function useModalBehavior(onClose?: () => void, initialFocusRef?: React.RefObject<HTMLElement>, restoreFocusRef?: React.RefObject<HTMLElement>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // React commits descendant autoFocus before a parent's effects or ref callback.
  // Capture the opener during the initial render, before any portal child can focus.
  const openerRef = useRef<HTMLElement | null>(typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null);
  const initialFocusRefAtMount = useRef(initialFocusRef);
  const restoreFocusRefAtMount = useRef(restoreFocusRef);
  const initialFocusTargetRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const stackId = Symbol('modal');
    modalStack.push({ id: stackId, container });
    // The latest mounted portal is always above its parent, independent of legacy z-* classes.
    // Only registered dialogs belong to the stack. Querying every portal in the DOM
    // would disable siblings whose mount effects have not run yet.
    syncModalStack();
    let previouslyFocused = restoreFocusRefAtMount.current?.current || openerRef.current;

    lockScroll(previouslyFocused);
    // Inside DialogWait's lock, whose inert page may have moved focus to <body> (Chrome) before this dialog rendered.
    if (previouslyFocused === document.body) previouslyFocused = originalPageState?.focusedElement || previouslyFocused;

    // Prefer a declared initial target; otherwise preserve a child's existing focus.
    // Remember a child's selected target across StrictMode's effect cleanup/replay.
    const initialFocus = initialFocusRefAtMount.current?.current || initialFocusTargetRef.current;
    if (initialFocus && getFocusable(container).includes(initialFocus)) {
      initialFocus.focus();
    } else if (!container.contains(document.activeElement)) {
      (getFocusable(container)[0] || container).focus?.();
    }
    initialFocusTargetRef.current = container.contains(document.activeElement) ? document.activeElement as HTMLElement : null;

    const onKeyDown = (e: KeyboardEvent) => {
      // 输入法组合中（拼音候选等）按 Esc/Enter 是在操作输入法，不能当成弹层快捷键
      if (e.isComposing || e.keyCode === 229) return;
      if (modalStack[modalStack.length - 1]?.id !== stackId) return; // 只有最上层弹层响应
      if (e.key === 'Escape') {
        if (onCloseRef.current) {
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const list = getFocusable(container);
      if (list.length === 0) { e.preventDefault(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !container.contains(active)) { e.preventDefault(); last.focus(); }
      } else {
        if (active === last || !container.contains(active)) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const wasTop = modalStack[modalStack.length - 1]?.id === stackId;
      const originalPageFocus = originalPageState?.focusedElement || null;
      const idx = modalStack.findIndex((entry) => entry.id === stackId);
      if (idx >= 0) modalStack.splice(idx, 1);
      syncModalStack();
      unlockScroll();
      // A background route may unmount before its child dialog. That must not steal
      // focus from the still-open top dialog or reactivate a covered parent.
      if (wasTop) {
        const nextTop = modalStack[modalStack.length - 1]?.container;
        if (nextTop) {
          if (!nextTop.contains(previouslyFocused) || !restoreFocus(previouslyFocused)) {
            (getFocusable(nextTop)[0] || nextTop).focus({ preventScroll: true });
          }
        } else if (!restoreFocus(previouslyFocused) && !restoreFocus(originalPageFocus)) {
          // A route change can remove the opener. Return to the app's main
          // content only after the final modal has released the background.
          restoreFocus(document.getElementById('scroll-container'));
        }
      }
    };
  }, []);

  return containerRef;
}

export type ModalShellProps = {
  /** Esc / 点击遮罩时调用；不传则禁用两者 */
  onClose?: () => void;
  /** 遮罩（最外层容器）的完整样式，与既有弹层保持一致 */
  className?: string;
  /** 点击遮罩空白处是否关闭（默认 true，需要 onClose） */
  closeOnBackdrop?: boolean;
  label?: string;
  labelledBy?: string;
  /** Initial focus is applied after the opener has been saved. */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Share the original opener across a loading fallback and its resolved dialog. */
  restoreFocusRef?: React.RefObject<HTMLElement>;
  children: React.ReactNode;
};

export const ModalShell = ({ onClose, className, closeOnBackdrop = true, label, labelledBy, initialFocusRef, restoreFocusRef, children }: ModalShellProps) => {
  const containerRef = useModalBehavior(onClose, initialFocusRef, restoreFocusRef);
  const handleBackdropClick = closeOnBackdrop && onClose
    ? (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); }
    : undefined;
  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className={className}
      onClick={handleBackdropClick}
    >
      {children}
    </div>,
    document.body,
  );
};
