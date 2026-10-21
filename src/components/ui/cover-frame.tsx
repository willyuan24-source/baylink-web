import type { ReactNode } from 'react';
import { ProvenanceBadge } from './Badges';
import { cx, useUiCopy } from './ui-copy';
import type { CoverLayout } from './CoverImage';
import type { CoverFamily } from '../../lib/cover-family';
import { typeCoverProvenance } from '../../lib/image-provenance';
import type { CoverTone } from '../../lib/event-facts';

const HAN = /[㐀-鿿]/;
/** `lang="en"` for a Latin line on a Chinese page. */
export const latinLang = (text: string) => HAN.test(text) ? undefined : 'en';

/**
 * The type-cover frame (UI9-C), shared by the five type families. It carries `data-cover="type"` (the image-area probe
 * counts it as cover area, not photo area; RC-31), the family, kind, mark and key fact, the category tone and the BAYLINK
 * 信息卡 chip (typeCoverProvenance; a list that names the info card once hides it visually, cards.css). It lives with the
 * families, not with the photo frame (UI9-IMG-A0): the families load after the page on home and the listings, so the
 * frame's code leaves those routes with them; CoverImage.tsx keeps the empty frame (PendingCover) they show until then.
 */
export function TypeFrame({ family, kind, mark, keyFact, tone, ratio, ratioLock, size, ariaHidden, className, children }: Omit<CoverLayout, 'tone'> & { family: CoverFamily; kind: string; mark: string; keyFact: string; tone?: CoverTone; children: ReactNode }) {
  const { english } = useUiCopy();
  return <div className={cx('ui-type-cover', className)} data-cover="type" data-family={family} data-kind={kind} data-mark={mark} data-key={keyFact} data-tone={tone}
    data-ratio={ratio} data-ratio-lock={ratioLock ? '' : undefined} data-size={size} aria-hidden={ariaHidden || undefined}>
    {size !== 'mini' && <ProvenanceBadge label={typeCoverProvenance(english)} />}
    {children}
  </div>;
}
