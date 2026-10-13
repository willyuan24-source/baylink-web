import { Cover } from '../../components/ui/Cover';
import { TypeCover } from '../../components/ui/TypeCover';
import type { CoverRatio } from '../../components/ui/CoverImage';
import { useUiCopy } from '../../components/ui/ui-copy';
import { guideTopicOf } from '../../data/guide-topics';
import type { ResolvedCover } from '../../lib/cover';
import type { CoverTone } from '../../lib/event-facts';
import { TOPIC_COVER, topicCopy } from './guide-facts';
import type { GuideCard } from './guide-records';

export type GuideCoverProps = {
  /** A guide card from the generated index or a record's "Read next" (guide-records.ts). */
  guide: Pick<GuideCard, 'slug' | 'category' | 'title' | 'sourceCount'>;
  /** From `guideCover()` (the honesty ladder); a `type` result renders the guide's family C TypeCover. */
  cover: ResolvedCover;
  ratio?: CoverRatio;
  sizes?: string;
  priority?: boolean;
  /** Palette from `distinctNeighbourTones`, so two coded covers side by side never share a colour. */
  tone?: CoverTone;
  /** A one-line answer printed on a coded cover (pilot guides: "先打 800-510-2020"). */
  answer?: string;
  /** 88px row thumbnail: a coded cover shows its palette and topic only. */
  mini?: boolean;
};

/**
 * A guide's cover: its photo with the provenance badge, or a coded cover with the topic and, on a pilot guide, its one-line
 * answer set large ("先打 800-510-2020"). The card's caption right under it already carries the title and the source count,
 * so the coded cover does not repeat them (PROD-W3 review: every coded guide card said both twice).
 */
export function GuideCover({ guide, cover, ratio, sizes, priority, tone, answer, mini }: GuideCoverProps) {
  const { pick } = useUiCopy();
  const topic = guideTopicOf(guide);
  // The answer's phone number keeps one line (non-breaking hyphens): "1-800- / 434-0222" broke at a hyphen in English.
  const fallback = <TypeCover family="guide" tone={tone ?? TOPIC_COVER[topic].tone} icon={TOPIC_COVER[topic].icon} label={pick(topicCopy(topic))}
    title={answer?.replace(/(\d)-(?=\d)/g, '$1\u2011')} ratio={ratio} size={mini ? 'mini' : undefined} ariaHidden />;
  return <Cover cover={cover} fallback={fallback} ratio={ratio} sizes={sizes} priority={priority} decorative />;
}
