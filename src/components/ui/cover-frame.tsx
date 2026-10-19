import type { ReactNode } from 'react';
import './ui.css';
import './covers.css';
import './cards.css';
import { ProvenanceBadge } from './Badges';
import { cx, useUiCopy } from './ui-copy';
import type { CoverRatio } from './CoverImage';
import { typeCoverProvenance } from '../../lib/image-provenance';
import type { CoverFamily } from '../../lib/cover-family';
import type { CoverTone } from '../../lib/event-facts';

/**
 * The type-cover frame (UI9-C), shared by the five type families (cover-date, cover-ticket, cover-guide, cover-shop). Each
 * family lives in its own module so a route loads only the families it draws (the guide pages never load the calendar page,
 * the ticket or the shopfront). The frame carries `data-cover="type"` (the image-area probe counts it as cover area, not photo
 * area; RC-31), the family, kind, mark and key fact, the category tone and the BAYLINK 信息卡 chip (typeCoverProvenance; a list
 * that names the info card once hides it visually, cards.css).
 */
export type CoverLayout = {
  ratio?: CoverRatio;
  ratioLock?: boolean;
  /** Row thumbnail (≤ 140 px): the key fact only. */
  size?: 'mini';
  /** Hide from assistive tech when the surrounding card already reads the same facts. */
  ariaHidden?: boolean;
  className?: string;
  /** Accepted for older callers and ignored: a cover keeps its own category colour (UI9-C removed the neighbour rotation). */
  tone?: CoverTone;
};

const HAN = /[㐀-鿿]/;
/** `lang="en"` for a Latin line on a Chinese page. */
export const latinLang = (text: string) => HAN.test(text) ? undefined : 'en';

export function TypeFrame({ family, kind, mark, keyFact, tone, ratio, ratioLock, size, ariaHidden, className, children }: Omit<CoverLayout, 'tone'> & { family: CoverFamily; kind: string; mark: string; keyFact: string; tone?: CoverTone; children: ReactNode }) {
  const { english } = useUiCopy();
  return <div className={cx('ui-type-cover', className)} data-cover="type" data-family={family} data-kind={kind} data-mark={mark} data-key={keyFact} data-tone={tone}
    data-ratio={ratio} data-ratio-lock={ratioLock ? '' : undefined} data-size={size} aria-hidden={ariaHidden || undefined}>
    {size !== 'mini' && <ProvenanceBadge label={typeCoverProvenance(english)} />}
    {children}
  </div>;
}
