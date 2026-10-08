import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './ui.css';
import { cx } from './ui-copy';

export type FilterChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  selected: boolean;
  /** Result count shown after the label ("免费 26"); hidden when undefined. */
  count?: number;
  icon?: ReactNode;
  children: ReactNode;
};
/** A toggle filter: 40px tall (44px hit), white when off, ink when on, `aria-pressed` carries the state. */
export function FilterChip({ selected, count, icon, children, className, type = 'button', ...rest }: FilterChipProps) {
  return <button type={type} aria-pressed={selected} className={cx('ui-chip', className)} {...rest}>
    {icon}{children}{count !== undefined && <> <span className="ui-chip__count">{count}</span></>}
  </button>;
}

/** A horizontally scrolling row of chips on phones; wraps on desktop. */
export function ChipRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <div role="group" aria-label={label} className={cx('ui-chip-row', className)}>{children}</div>;
}
