import { useId, type ReactNode, type Ref, type RefObject, type UIEventHandler } from 'react';
import './ui.css';
import './covers.css';
import './cards.css';
import { ModalShell } from './Modal';
import { useExit } from '../../lib/reading-preferences';
import { CloseButton } from './CloseButton';
import { cx } from './ui-copy';

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  /** The heading of the default header; with a custom `header` and no `labelledBy`, the dialog's accessible name. */
  title: string;
  children: ReactNode;
  /** Sticky footer: [清除] text button + [显示 23 场] primary, full width. */
  footer?: ReactNode;
  /** Polite live text for the footer's result count ("显示 23 场"). */
  status?: string;
  initialFocusRef?: RefObject<HTMLElement>;
  /** false for a form a stray tap must not throw away (sign-in, password, report text): only ✕ and Esc close it. */
  closeOnBackdrop?: boolean;
  /** The opener to return focus to when it is not the element focused at mount (a dialog behind a loading fallback). */
  restoreFocusRef?: RefObject<HTMLElement>;
  // The optional hooks below (UI9-PREP) let the UI-9 lanes put their dialogs on this one Sheet without editing it. Unset,
  // the Sheet renders exactly as before.
  /** One more class on the panel (`.ui-sheet`), for a dialog's own frame. */
  className?: string;
  /** One more class on the backdrop (`.ui-sheet-backdrop`), e.g. a transparent desktop backdrop that still closes on a tap. */
  backdropClassName?: string;
  /** Replaces the default header (the title and ✕). It must name the dialog: give its heading an id and pass `labelledBy`;
   *  without `labelledBy` the dialog is named by `title`. A custom header brings its own close button (CloseButton). */
  header?: ReactNode;
  /** The id of the element in `header` that names the dialog (ignored without `header`). */
  labelledBy?: string;
  /** The scrolling body (`.ui-sheet__body`), e.g. to keep a conversation at its end. */
  bodyRef?: Ref<HTMLDivElement>;
  onBodyScroll?: UIEventHandler<HTMLDivElement>;
  /** One more class on the body (`.ui-sheet__body`). */
  bodyClassName?: string;
};

/**
 * Bottom sheet on phones (r24 top, 85dvh), 480px right drawer on desktop. Built on ModalShell, so the focus
 * trap, Esc, backdrop close, scroll lock and focus return are the site's existing, tested behaviour.
 */
export function Sheet({ open, onClose, title, children, footer, status, initialFocusRef, closeOnBackdrop = true, restoreFocusRef, className, backdropClassName, header, labelledBy, bodyRef, onBodyScroll, bodyClassName }: SheetProps) {
  const titleId = useId();
  // One overlay primitive with an enter and an exit: after open turns false the sheet stays for its exit animation
  // (useExit, lib/reading-preferences.ts).
  const shown = useExit(open);
  if (!shown) return null;
  const custom = header !== undefined;
  return <ModalShell onClose={onClose} className={cx('ui-sheet-backdrop', !open && 'is-closing', backdropClassName)} labelledBy={custom ? labelledBy : titleId} label={custom && !labelledBy ? title : undefined} initialFocusRef={initialFocusRef} closeOnBackdrop={closeOnBackdrop} restoreFocusRef={restoreFocusRef}>
    <div className={cx('ui-sheet', className)}>
      <div className="ui-sheet__handle" aria-hidden="true" />
      {custom ? header : <div className="ui-sheet__header">
        <h2 id={titleId} className="ui-sheet__title">{title}</h2>
        <CloseButton onClick={onClose} />
      </div>}
      <div ref={bodyRef} className={cx('ui-sheet__body', bodyClassName)} onScroll={onBodyScroll}>{children}</div>
      {footer && <div className="ui-sheet__footer">{footer}</div>}
      {status !== undefined && <p className="ui-visually-hidden" role="status" aria-live="polite">{status}</p>}
    </div>
  </ModalShell>;
}
