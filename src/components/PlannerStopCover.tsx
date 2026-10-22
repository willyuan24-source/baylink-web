import type { ImageCover, ResolvedCover } from '../lib/cover';
import { translateText } from '../i18n/locale';
import type { Stop } from '../lib/planner-core';
import { Cover, creditAfterLabel, useTierLabel } from './ui/CoverImage';
import { COVER_SIZES } from './ui/cover-sizes';
import { useUiCopy } from './ui/ui-copy';

/** The 88px thumbnail: the stop's picture (plan-stop-cover.ts, UI9-IMAGES DECISIONS 21/22; decorative, the row reads the title). */
export function PlannerStopThumb({ stop, cover }: { stop: Stop; cover: ResolvedCover; today?: string; day?: string }) {
  return <Cover cover={cover} sizes={COVER_SIZES.thumb} decorative kind={stop.kind} />;
}

/** The picture on a suggestion card (按条件挑选 results): the stop's picture through the same ladder as its row. */
export function PlannerOptionCover({ cover }: { cover?: ResolvedCover }) {
  if (!cover || cover.tier === 'type') return null;
  return <div className="planner-option-media"><Cover cover={cover} ratio="16:9" sizes={COVER_SIZES.single} decorative /></div>;
}

/**
 * 本页图片来源: who made each picture on the page and under which licence (the badge on a cover says what it is; credit and
 * licence sit here, as on the events column).
 */
export function PlannerImageCredits({ covers }: { covers: readonly ResolvedCover[] }) {
  const { t, locale } = useUiCopy();
  const label = useTierLabel();
  const seen = new Set<string>();
  const images = covers.filter((cover): cover is ImageCover => cover.tier !== 'type' && !seen.has(cover.image.src) && !!seen.add(cover.image.src));
  if (!images.length) return null;
  return <details className="planner-credits">
    <summary>{t(`本页图片来源（${images.length}）`, `Image credits (${images.length})`)}</summary>
    <ul>{images.map(cover => { const words = label(cover), credit = creditAfterLabel(words, translateText(cover.image.credit, locale)); return <li key={cover.image.src}>
      <span>{words}</span>
      {cover.image.creditUrl ? <a href={cover.image.creditUrl} target="_blank" rel="noopener noreferrer">{credit}</a> : <span>{credit}</span>}
      {cover.image.licenseUrl && <a href={cover.image.licenseUrl} target="_blank" rel="noopener noreferrer">{t('许可', 'License')}</a>}
    </li>; })}</ul>
  </details>;
}
