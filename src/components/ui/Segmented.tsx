import { useRef, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import './ui.css';
import './covers.css';
import './cards.css';
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
 * in-page items render an ARIA tablist with roving focus and arrow keys. Its look (D3's segmented pill, UI9-EVENTS) is
 * scoped in src/features/events/events.css under the caller's `.ev-tabs` class, so it stays off home's render-blocking CSS;
 * another caller brings its own look (or asks UI9-INT to move the rules back here).
 */
export function SegmentedTabs({ label, items, value, onChange, panelId, sticky, className }: SegmentedTabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const sharedClass = cx('ui-tabs', className);
  if (items.some(item => item.to)) {
    // onChange only for a click the router handles here (a plain primary click): ⌘ / Ctrl / Shift / Alt-click opens a new
    // tab or window and leaves this page where it is.
    return <nav aria-label={label} className={sharedClass} data-sticky={sticky ? '' : undefined}>
      {items.map(item => <Link key={item.id} to={item.to || '#'} className="ui-tabs__item" aria-current={item.id === value ? 'page' : undefined}
        onClick={event => { if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onChange?.(item.id); }}>{item.label}</Link>)}
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

export type DayChipsProps = {
  label: string;
  items: SegmentItem[];
  /** The checked item's id ('' checks none: the first radio then takes the tab stop). */
  value: string;
  onChange: (id: string) => void;
  className?: string;
  /** The items from `from` on sit in their own wrapper (`className`), e.g. a weekend's days after the date scopes: still one
   *  radio group, one checked radio. */
  part?: { from: number; className: string };
};

/**
 * Date chips (UI9-EVENTS, G17: 本周末 · 未来 7 天 · 全部日期 | 周六 10/24 · 周日 10/25 · 两天都开放): one radio group on F's
 * .ui-chip look, so the rail is one row of chips (the checked one takes the chip's ink fill). They behave as radios: a click
 * checks (never unchecks), arrow keys move and select as in SegmentedControl. Import it from './ui/Segmented' (not the barrel).
 */
export function DayChips({ label, items, value, onChange, className, part }: DayChipsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const stop = Math.max(0, items.findIndex(item => item.id === value));
  const radio = (item: SegmentItem, index: number) => <button key={item.id} ref={element => { refs.current[index] = element; }} type="button" role="radio" className="ui-chip"
    aria-checked={item.id === value} tabIndex={index === stop ? 0 : -1} onClick={() => { if (item.id !== value) onChange(item.id); }}
    onKeyDown={event => {
      const next = arrowTarget(event, index, items.length);
      if (next < 0) return;
      event.preventDefault();
      refs.current[next]?.focus();
      if (items[next].id !== value) onChange(items[next].id);
    }}>{item.label}</button>;
  const head = part ? items.slice(0, part.from) : items;
  return <div role="radiogroup" aria-label={label} className={cx('ui-day-chips', className)}>
    {head.map(radio)}
    {part && items.length > part.from && <span className={part.className}>{items.slice(part.from).map((item, index) => radio(item, part.from + index))}</span>}
  </div>;
}

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
