import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import './disclosure.css';
import { cx } from './ui-copy';

export type DisclosureProps = {
  /** The line that is always shown and opens the panel (the <summary>). */
  summary: ReactNode;
  children: ReactNode;
  /** Open in the first render, and so in the prerendered page. */
  defaultOpen?: boolean;
  /** After the reader opens or closes it; not for the open state it was rendered with (defaultOpen). */
  onToggle?: (open: boolean) => void;
  id?: string;
  className?: string;
  summaryClassName?: string;
  panelClassName?: string;
};

/**
 * One expander site-wide (UI9-F2): a native <details>, so it opens before the app boots and without JS, and the browser
 * gives it Enter / Space; no native ▶ marker, one chevron that turns on --dur-2; the summary is the 44px target (48 in
 * 简洁显示) and states aria-expanded, kept in step with the element (also after a tap that came before hydration).
 */
export function Disclosure({ summary, children, defaultOpen = false, onToggle, id, className, summaryClassName, panelClassName }: DisclosureProps) {
  const details = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  // The last open state seen. Setting `open` queues a toggle event, so a client render with defaultOpen fires one on
  // mount with nothing changed (a prerendered page's fires at parse time, before hydration, and is lost): only a change
  // from this state is the reader's.
  const known = useRef(defaultOpen);
  // A tap before the app hydrated opened or closed the element natively: read its state once mounted.
  useEffect(() => { if (details.current) { known.current = details.current.open; setOpen(details.current.open); } }, []);
  return <details ref={details} id={id} className={cx('ui-disclosure', className)} open={defaultOpen || undefined}
    onToggle={event => {
      const next = event.currentTarget.open;
      if (next === known.current) return;
      known.current = next;
      setOpen(next);
      onToggle?.(next);
    }}>
    <summary className={cx('ui-disclosure__summary', summaryClassName)} aria-expanded={open}>
      <span className="ui-disclosure__label">{summary}</span>
      <ChevronDown className="ui-disclosure__chevron" aria-hidden="true" strokeWidth={1.75} />
    </summary>
    <div className={cx('ui-disclosure__panel', panelClassName)}>{children}</div>
  </details>;
}
