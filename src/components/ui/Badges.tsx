import type { ReactNode } from 'react';
import './ui.css';
import './covers.css';
import './cards.css';
import { cx } from './ui-copy';

/**
 * The provenance chip. The text must come from getImageProvenance() / typeCoverProvenance(). `plain`: the badge exactly as it
 * was before UI9-C, without the attribute the cover system's chip look keys on (covers.css `.ui-provenance[data-chip]`): the
 * AI 3D postcards (captain decision 1) and the pictures outside the listing feeds (/explore, which this phase leaves as is).
 */
export function ProvenanceBadge({ label, className, plain }: { label: string; className?: string; plain?: boolean }) {
  return <span className={cx('ui-provenance', className)} data-provenance data-chip={plain ? undefined : ''}>{label}</span>;
}

export type StickerTone = 'date' | 'free' | 'mixed' | 'price' | 'paid' | 'danger' | 'warning' | 'success' | 'neutral';
/** A fact printed on a member's photo (community posts). Listing covers carry no stickers since UI9-C (N22). */
export function Sticker({ tone = 'date', slot, children, className }: { tone?: StickerTone; slot?: 'start' | 'end'; children: ReactNode; className?: string }) {
  return <span className={cx('ui-sticker', className)} data-tone={tone} data-slot={slot}>{children}</span>;
}

/** The bottom sticker row on a community post's photo. */
export function StickerRow({ children }: { children: ReactNode }) {
  return <span className="ui-stickers">{children}</span>;
}

// The status map lives in ./Status (no stylesheet import of its own: covers.css carries .ui-status), so a page that shows a
// provenance chip but no status does not load it. Its names stay importable from here.
export { LEGACY_STATUS_TONES, StatusChip, statusLook, type LegacyStatusTone, type StatusLook, type StatusTone } from './Status';
