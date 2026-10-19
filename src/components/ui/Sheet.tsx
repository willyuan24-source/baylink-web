import { useId, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import './ui.css';
import './covers.css';
import './cards.css';
import { ModalShell } from './Modal';
import { useExit } from '../../lib/reading-preferences';
import { IconButton } from './Button';
import { useUiCopy } from './ui-copy';

export type SheetProps = {
  open: boolean;
  onClose: () => void;
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
};

/**
 * Bottom sheet on phones (r24 top, 85dvh), 480px right drawer on desktop. Built on ModalShell, so the focus
 * trap, Esc, backdrop close, scroll lock and focus return are the site's existing, tested behaviour.
 */
export function Sheet({ open, onClose, title, children, footer, status, initialFocusRef, closeOnBackdrop = true, restoreFocusRef }: SheetProps) {
  const titleId = useId();
  const { t } = useUiCopy();
  // One overlay primitive with an enter and an exit: after open turns false the sheet stays for its exit animation
  // (useExit, lib/reading-preferences.ts).
  const shown = useExit(open);
  if (!shown) return null;
  return <ModalShell onClose={onClose} className={open ? 'ui-sheet-backdrop' : 'ui-sheet-backdrop is-closing'} labelledBy={titleId} initialFocusRef={initialFocusRef} closeOnBackdrop={closeOnBackdrop} restoreFocusRef={restoreFocusRef}>
    <div className="ui-sheet">
      <div className="ui-sheet__handle" aria-hidden="true" />
      <div className="ui-sheet__header">
        <h2 id={titleId} className="ui-sheet__title">{title}</h2>
        <IconButton label={t('关闭', 'Close')} onClick={onClose}><X aria-hidden="true" strokeWidth={1.75} /></IconButton>
      </div>
      <div className="ui-sheet__body">{children}</div>
      {footer && <div className="ui-sheet__footer">{footer}</div>}
      {status !== undefined && <p className="ui-visually-hidden" role="status" aria-live="polite">{status}</p>}
    </div>
  </ModalShell>;
}
