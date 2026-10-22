import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import './select.css';
import { cx } from './ui-copy';

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'multiple' | 'size'> & {
  /** The options (<option> / <optgroup>). */
  children: ReactNode;
  /** One more class on the wrapper (`.ui-select`), for a form's own layout. */
  wrapperClassName?: string;
};

/**
 * The one styled select (UI9-R1, N13 "24 native controls"): a native <select> — the phone's own picker, the keyboard and
 * the screen reader keep working — in the chip look (white pill, line-control edge, 44px, 48 in 简洁显示) with the same
 * chevron everywhere (lucide ChevronDown, 1.75 stroke). Name it with a <label htmlFor> or aria-label as any select.
 * Route-local: import it from a lazily loaded form, never from the entry (tests/ui9-r1-foundation.test.ts).
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ children, className, wrapperClassName, ...rest }, ref) {
  return <span className={cx('ui-select', wrapperClassName)} data-disabled={rest.disabled ? '' : undefined}>
    <select ref={ref} className={cx('ui-select__field', className)} {...rest}>{children}</select>
    <ChevronDown className="ui-select__icon" aria-hidden="true" strokeWidth={1.75} />
  </span>;
});
