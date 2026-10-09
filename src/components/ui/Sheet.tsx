import { useId, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import './ui.css';
import { ModalShell } from './Modal';
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
};

/**
 * Bottom sheet on phones (r24 top, 85dvh), 480px right drawer on desktop. Built on ModalShell, so the focus
 * trap, Esc, backdrop close, scroll lock and focus return are the site's existing, tested behaviour.
 */
export function Sheet({ open, onClose, title, children, footer, status, initialFocusRef }: SheetProps) {
  const titleId = useId();
  const { t } = useUiCopy();
  if (!open) return null;
  return <ModalShell onClose={onClose} className="ui-sheet-backdrop" labelledBy={titleId} initialFocusRef={initialFocusRef}>
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
