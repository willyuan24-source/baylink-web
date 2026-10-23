import { Cover } from '../../components/ui/CoverImage';
import type { CoverRatio } from '../../components/ui/CoverImage';
import type { ResolvedCover } from '../../lib/cover';
import type { GuideHookFields } from '../../lib/guide-hook-highlight';
import type { GuideCard } from './guide-records';

export type GuideCoverProps = {
  /** A guide card from the generated index or a record's "Read next" (guide-records.ts). */
  guide: Pick<GuideCard, 'slug' | 'category' | 'title' | 'sourceCount'> & GuideHookFields;
  /** From `guideCover()`: the guide's own picture, else a ③ 示意图 of its topic (guide-data.ts guideStockCover). */
  cover: ResolvedCover;
  ratio?: CoverRatio;
  sizes?: string;
  priority?: boolean;
  /** Row thumbnail (≤ 140 px somewhere): the short English badge, whatever `sizes` says (CoverSlot `short`). */
  mini?: boolean;
};

/**
 * A guide's cover: its picture with its badge (UI9-IMAGES DECISIONS 21: never a title plate or number plate). The card's
 * caption prints the whole title.
 */
export function GuideCover({ cover, ratio, sizes, priority, mini }: GuideCoverProps) {
  return <Cover cover={cover} kind="guide" ratio={ratio} sizes={sizes} priority={priority} short={mini} decorative />;
}
