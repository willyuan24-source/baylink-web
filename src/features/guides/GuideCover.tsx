import { Cover } from '../../components/ui/Cover';
import { TypeCover } from '../../components/ui/TypeCover';
import type { CoverRatio } from '../../components/ui/CoverImage';
import { useUiCopy } from '../../components/ui/ui-copy';
import { guideTopicOf } from '../../data/guide-topics';
import type { Guide } from '../../data/guides';
import type { ResolvedCover } from '../../lib/cover';
import type { CoverTone } from '../../lib/event-facts';
import { translateText } from '../../i18n/locale';
import { guideSourceCount, splitGuideTitle, TOPIC_COVER, topicCopy } from './guide-facts';

export type GuideCoverProps = {
  guide: Guide;
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

/** A guide's cover: its photo with the provenance badge, or a coded cover with the topic, the short title and the source count. */
export function GuideCover({ guide, cover, ratio, sizes, priority, tone, answer, mini }: GuideCoverProps) {
  const { t, pick, locale } = useUiCopy();
  const topic = guideTopicOf(guide);
  const sources = guideSourceCount(guide);
  const fallback = <TypeCover family="guide" tone={tone ?? TOPIC_COVER[topic].tone} icon={TOPIC_COVER[topic].icon} label={pick(topicCopy(topic))}
    title={splitGuideTitle(translateText(guide.title, locale)).head} note={answer}
    place={sources ? t(`${sources} 个官方来源`, `${sources} official source${sources === 1 ? '' : 's'}`) : undefined} ratio={ratio} size={mini ? 'mini' : undefined} ariaHidden />;
  return <Cover cover={cover} fallback={fallback} ratio={ratio} sizes={sizes} priority={priority} decorative />;
}
