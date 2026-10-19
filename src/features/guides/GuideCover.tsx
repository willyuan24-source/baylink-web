import type { ComponentType } from 'react';
import { Cover } from '../../components/ui/CoverImage';
import type { GuideTypeCoverProps } from '../../components/ui/cover-guide';
import type { CoverRatio } from '../../components/ui/CoverImage';
import { useUiCopy } from '../../components/ui/ui-copy';
import { guideTopicOf } from '../../data/guide-topics';
import { translateText } from '../../i18n/locale';
import type { ResolvedCover } from '../../lib/cover';
import { guideCardHook, type GuideHookFields } from '../../lib/guide-hook-highlight';
import { topicCopy } from './guide-facts';
import type { GuideCard } from './guide-records';

export type GuideCoverProps = {
  /** A guide card from the generated index or a record's "Read next" (guide-records.ts), with its answered hook when it has one. */
  guide: Pick<GuideCard, 'slug' | 'category' | 'title' | 'sourceCount'> & GuideHookFields;
  /** From `guideCover()` (the honesty ladder); a `type` result renders the guide's headline or number cover. */
  cover: ResolvedCover;
  ratio?: CoverRatio;
  sizes?: string;
  priority?: boolean;
  /** Row thumbnail (≤ 140 px): a type cover shows its topic mark only, never a phone number. */
  mini?: boolean;
  /**
   * The headline / number family: GuideTypeCover (cover-guide.tsx) where guide covers are on the first screen (/guides), or
   * DeferredGuideTypeCover (cover-defer.tsx) where they load after the page (a guide's 接下来 rail).
   */
  face: ComponentType<GuideTypeCoverProps>;
};

/**
 * A guide's cover: its photo with the provenance chip, or (UI9-C, G19) the deep-green slide with the guide's hook and one
 * lime phrase, or the number plate when the hook is a phone number. The hook is the pilot guide's one-line answer (carried
 * into the card at generate time), else the title after its colon; the card's caption then shows the head only
 * (guideCardHook), so the cover never repeats the caption.
 */
export function GuideCover({ guide, cover, ratio, sizes, priority, mini, face: Face }: GuideCoverProps) {
  const { pick, locale } = useUiCopy();
  const topic = guideTopicOf(guide);
  const { hook, hi } = guideCardHook(guide, translateText(guide.title, locale), locale, zh => translateText(zh, locale));
  const fallback = <Face slug={guide.slug} topic={topic} topicLabel={pick(topicCopy(topic))} hook={hook} hi={hi} ratio={ratio} size={mini ? 'mini' : undefined} ariaHidden />;
  return <Cover cover={cover} kind="guide" fallback={fallback} ratio={ratio} sizes={sizes} priority={priority} decorative />;
}

/** The caption a guide card shows beside its cover (FeedCard `titleShown`): the head, '' for none, undefined for the title. */
export const guideCaption = (guide: GuideHookFields & { title: string }, locale: 'zh-Hans' | 'zh-Hant' | 'en', cover: ResolvedCover) =>
  cover.tier === 'type' ? guideCardHook(guide, translateText(guide.title, locale), locale, zh => translateText(zh, locale)).caption : undefined;
