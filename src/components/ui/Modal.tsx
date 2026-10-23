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
// so a lock on body left the page scrolling under an open dialog. The lock sets overflow:hidden on <html> and keeps a classic
// scrollbar's gutter (scrollbar-gutter: stable), so nothing moves sideways. Body is left alone: overflow:hidden there makes
// body the scroll container of the sticky top bar, which then jumps off the screen behind the dialog. For the same reason
// #scroll-container (the guide rails, the detail actions) is locked only when it really scrolls.
type PageState = {
  html: HTMLElement; htmlOverflow: string; htmlGutter: string;
  scroller: HTMLElement | null; scrollerOverflow: string;
  appRoot: HTMLElement | null; appRootInert: boolean;
  focusedElement: HTMLElement | null;
};
let scrollLockCount = 0;
let originalPageState: PageState | null = null;
// DialogWait hands its lock to the dialog that replaces it. The Suspense commit removes the wait before the dialog's layout
// effect runs, so the wait's release is put off to a microtask and the dialog takes the lock over: no unlock and relock, and
// the opener the wait kept stays the one focus returns to.
let handOffPending = false;

const scrolls = (element: HTMLElement) => {
  const style = window.getComputedStyle(element);
  return [style.overflow, style.overflowX, style.overflowY].some(value => /auto|scroll/.test(value || ''));
};

const lockScroll = (focusedElement: HTMLElement | null) => {
  if (++scrollLockCount !== 1) return;
  if (handOffPending && originalPageState) { handOffPending = false; return; }
  const html = document.documentElement;
  const found = document.getElementById('scroll-container');
  const scroller = found && scrolls(found) ? found : null;
  const appRoot = document.getElementById('root');
  // A classic scrollbar (not the overlay kind of phones and macOS) is innerWidth - clientWidth wide; jsdom has no layout.
  const scrollbar = html.clientWidth > 0 && window.innerWidth > html.clientWidth;
  originalPageState = { html, htmlOverflow: html.style.overflow, htmlGutter: html.style.getPropertyValue('scrollbar-gutter'),
    scroller, scrollerOverflow: scroller?.style.overflow || '', appRoot, appRootInert: !!appRoot?.inert, focusedElement };
  if (scrollbar) html.style.setProperty('scrollbar-gutter', 'stable');
  html.style.overflow = 'hidden';
  if (scroller) scroller.style.overflow = 'hidden';
  if (appRoot) appRoot.inert = true;
};
const restorePage = () => {
  if (!originalPageState) return;
  const { html, htmlOverflow, htmlGutter, scroller, scrollerOverflow, appRoot, appRootInert } = originalPageState;
  html.style.overflow = htmlOverflow;
  if (htmlGutter) html.style.setProperty('scrollbar-gutter', htmlGutter); else html.style.removeProperty('scrollbar-gutter');
  if (scroller) scroller.style.overflow = scrollerOverflow;
  if (appRoot) appRoot.inert = appRootInert;
  originalPageState = null;
};
const unlockScroll = () => {
  if (--scrollLockCount !== 0) return;
  restorePage();
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

// Older iOS Safari can still pan the page under overflow:hidden. A one-finger drag on the scrim itself is stopped there; the
// dialog's own content (and a scrim that scrolls) keeps its scrolling, and two fingers still zoom.
const guardScrimTouch = (scrim: HTMLElement, wholeLayer = false) => {
  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length !== 1 || (!wholeLayer && e.target !== scrim) || scrolls(scrim)) return;
    if (e.cancelable) e.preventDefault();
  };
  scrim.addEventListener('touchmove', onTouchMove, { passive: false });
  return () => scrim.removeEventListener('touchmove', onTouchMove);
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
 * opener is kept with the lock. The dialog that replaces the wait takes the lock over; a wait that ends without one (the
 * opener went away, the chunk failed) releases the page a microtask later and gives focus back to the opener if it was lost.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useDialogWaitLock(scrimRef: React.RefObject<HTMLElement>) {
  useIsomorphicLayoutEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    lockScroll(active && active !== document.body ? active : null);
    const scrim = scrimRef.current;
    const stopTouch = scrim ? guardScrimTouch(scrim, true) : undefined;
    return () => {
      stopTouch?.();
      if (scrollLockCount !== 1 || !originalPageState) { unlockScroll(); return; }
      scrollLockCount = 0;
      handOffPending = true;
      const opener = originalPageState.focusedElement;
      queueMicrotask(() => {
        if (!handOffPending) return;
        handOffPending = false;
        restorePage();
        if (!document.activeElement || document.activeElement === document.body) restoreFocus(opener);
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
    // Taking over DialogWait's lock: its inert page may have moved focus to <body> (Chrome) before this dialog rendered.
    if (!previouslyFocused || previouslyFocused === document.body) previouslyFocused = originalPageState?.focusedElement || previouslyFocused;
    const stopTouch = guardScrimTouch(container);

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
      stopTouch();
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
