import { useRef, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import './ui.css';
import { cx } from './ui-copy';

export type SegmentItem = { id: string; label: string; to?: string };

/** ←/→/Home/End move between siblings; returns the index to focus, or -1. */
function arrowTarget(event: KeyboardEvent, index: number, count: number): number {
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') return (index + 1) % count;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') return (index - 1 + count) % count;
  if (event.key === 'Home') return 0;
  if (event.key === 'End') return count - 1;
  return -1;
}

export type SegmentedTabsProps = {
  label: string;
  items: SegmentItem[];
  value: string;
  /** Without `to` on the items the tabs switch an in-page panel (role=tablist); with `to` they are route links. */
  onChange?: (id: string) => void;
  /** id of the panel the tabs control (tablist mode). */
  panelId?: string;
  /** Sticks under the header. */
  sticky?: boolean;
  className?: string;
};

/**
 * Column switch (本周末 | 日历·地图 | 免费与优惠 | 新店). Route items render a <nav> of links with `aria-current`;
 * in-page items render an ARIA tablist with roving focus and arrow keys.
 */
export function SegmentedTabs({ label, items, value, onChange, panelId, sticky, className }: SegmentedTabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const sharedClass = cx('ui-tabs', className);
  if (items.some(item => item.to)) {
    return <nav aria-label={label} className={sharedClass} data-sticky={sticky ? '' : undefined}>
      {items.map(item => <Link key={item.id} to={item.to || '#'} className="ui-tabs__item" aria-current={item.id === value ? 'page' : undefined} onClick={() => onChange?.(item.id)}>{item.label}</Link>)}
    </nav>;
  }
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const next = arrowTarget(event, index, items.length);
    if (next < 0) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChange?.(items[next].id);
  };
  return <div role="tablist" aria-label={label} className={sharedClass} data-sticky={sticky ? '' : undefined}>
    {items.map((item, index) => {
      const selected = item.id === value;
      return <button key={item.id} ref={element => { refs.current[index] = element; }} type="button" role="tab" className="ui-tabs__item"
        aria-selected={selected} aria-controls={panelId} tabIndex={selected ? 0 : -1}
        onClick={() => onChange?.(item.id)} onKeyDown={event => onKeyDown(event, index)}>{item.label}</button>;
    })}
  </div>;
}

export type SegmentedControlProps = {
  label: string;
  items: SegmentItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
};

/** DayToggle (周六 10/10 | 周日 10/11 | 整个周末): a radio group with a white thumb; each radio's hit area is the full 44px track height (48 in simple mode); arrow keys select. */
export function SegmentedControl({ label, items, value, onChange, className }: SegmentedControlProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return <div role="radiogroup" aria-label={label} className={cx('ui-segmented', className)}>
    {items.map((item, index) => {
      const checked = item.id === value;
      return <button key={item.id} ref={element => { refs.current[index] = element; }} type="button" role="radio" className="ui-segmented__item"
        aria-checked={checked} tabIndex={checked ? 0 : -1} onClick={() => onChange(item.id)}
        onKeyDown={event => {
          const next = arrowTarget(event, index, items.length);
          if (next < 0) return;
          event.preventDefault();
          refs.current[next]?.focus();
          onChange(items[next].id);
        }}><span className="ui-segmented__label">{item.label}</span></button>;
    })}
  </div>;
}
