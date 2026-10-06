// 弹层原语：portal + 焦点陷阱 + Esc 关闭 + 背景滚动锁 + aria-modal
// ModalShell 不带任何视觉样式（className 由调用方给），保证既有弹层迁移时逐像素不变。
import React, { useEffect, useRef } from 'react';
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

// 滚动锁计数：body 和内部滚动容器（#scroll-container）一起锁，嵌套弹层全部关闭后才解锁
let scrollLockCount = 0;
let originalPageState: {
  body: HTMLElement; bodyOverflow: string;
  scroller: HTMLElement | null; scrollerOverflow: string;
  appRoot: HTMLElement | null; appRootInert: boolean;
  focusedElement: HTMLElement | null;
} | null = null;
const lockScroll = (focusedElement: HTMLElement | null) => {
  if (++scrollLockCount !== 1) return;
  const body = document.body;
  const scroller = document.getElementById('scroll-container');
  const appRoot = document.getElementById('root');
  originalPageState = { body, bodyOverflow: body.style.overflow, scroller,
    scrollerOverflow: scroller?.style.overflow || '', appRoot, appRootInert: !!appRoot?.inert,
    focusedElement };
  body.style.overflow = 'hidden';
  if (scroller) scroller.style.overflow = 'hidden';
  if (appRoot) appRoot.inert = true;
};
const unlockScroll = () => {
  if (--scrollLockCount !== 0 || !originalPageState) return;
  const { body, bodyOverflow, scroller, scrollerOverflow, appRoot, appRootInert } = originalPageState;
  body.style.overflow = bodyOverflow;
  if (scroller) scroller.style.overflow = scrollerOverflow;
  if (appRoot) appRoot.inert = appRootInert;
  originalPageState = null;
};

const canRestoreFocus = (element: HTMLElement | null): element is HTMLElement => {
  if (!element?.isConnected) return false;
  for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
    if (parent.inert) return false;
  }
  return true;
};

const getFocusable = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((el) => el.getClientRects().length > 0);

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const stackId = Symbol('modal');
    modalStack.push({ id: stackId, container });
    // The latest mounted portal is always above its parent, independent of legacy z-* classes.
    // Only registered dialogs belong to the stack. Querying every portal in the DOM
    // would disable siblings whose mount effects have not run yet.
    syncModalStack();
    const previouslyFocused = restoreFocusRefAtMount.current?.current || openerRef.current;

    lockScroll(previouslyFocused);

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
        if (canRestoreFocus(previouslyFocused) && (!nextTop || nextTop.contains(previouslyFocused))) {
          previouslyFocused.focus();
        } else if (nextTop) {
          (getFocusable(nextTop)[0] || nextTop).focus();
        } else if (canRestoreFocus(originalPageFocus)) {
          originalPageFocus.focus();
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
