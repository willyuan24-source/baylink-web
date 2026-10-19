import type { ButtonHTMLAttributes, Ref } from 'react';
import { X } from 'lucide-react';
import './ui.css';
import './covers.css';
import './cards.css';
import { IconButton } from './Button';
import { cx, useUiCopy } from './ui-copy';

export type CloseButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> & {
  /** The accessible name; 关闭 / 關閉 / Close by default. */
  label?: string;
  buttonRef?: Ref<HTMLButtonElement>;
};

/**
 * The one close button (UI9-F2): the icon button's look and 44px target (48 in 简洁显示) with a ✕, named 关闭 / 關閉 /
 * Close in the reader's language. Sheets, dialogs, menus and panels use it instead of a local ✕.
 */
export function CloseButton({ label, className, buttonRef, ...rest }: CloseButtonProps) {
  const { t } = useUiCopy();
  return <IconButton ref={buttonRef} label={label ?? t('关闭', 'Close')} className={cx('ui-close', className)} {...rest}><X aria-hidden="true" strokeWidth={1.75} /></IconButton>;
}
