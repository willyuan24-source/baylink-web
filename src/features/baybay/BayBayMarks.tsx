import type { ReactNode } from 'react';

/** BayBay's one mark (UI9-BB, N13): the otter, as on the tab bar and the desktop nav. Decorative: its text says BayBay. */
export function BayBayOtter({ size }: { size: 20 | 44 }) {
  return <img className="bb-otter" data-size={size} src="/brand/otter.svg" alt="" width={size} height={size} aria-hidden="true" />;
}

/**
 * A turn that is still being answered (N24): three dots that fade on the --dur tokens (still when motion is 0 ms: reduced
 * motion and 简洁显示), next to the phase text. Replaces the animate-spin spinners.
 */
export function BayBayPending({ children, className }: { children: ReactNode; className?: string }) {
  return <p role="status" className={className ? `bb-pending ${className}` : 'bb-pending'} translate="no">
    <span className="bb-dots" aria-hidden="true"><span /><span /><span /></span><span>{children}</span>
  </p>;
}
