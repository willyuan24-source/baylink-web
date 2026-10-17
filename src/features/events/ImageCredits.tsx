import { ChevronDown } from 'lucide-react';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import type { ImageCover, ResolvedCover } from '../../lib/cover';

/**
 * "本页图片来源": credit and licence for every photo cover on the page (design.md §4.5 ProvenanceBadge: the badge says
 * what an image is; who made it and under which licence sits here). Information cards need no credit.
 */
export function ImageCredits({ covers }: { covers: readonly ResolvedCover[] }) {
  const { t, pick, locale } = useUiCopy();
  const seen = new Set<string>();
  const images = covers.filter((cover): cover is ImageCover => cover.tier !== 'type' && !seen.has(cover.image.src) && !!seen.add(cover.image.src));
  if (!images.length) return null;
  return <details className="ev-credits">
    <summary>{t(`本页图片来源（${images.length}）`, `Image credits (${images.length})`)}<ChevronDown aria-hidden="true" strokeWidth={1.75} /></summary>
    <ul>{images.map(cover => <li key={cover.image.src}>
      <span className="ev-credits__label">{pick(cover.label)}</span>
      {cover.image.creditUrl ? <a href={cover.image.creditUrl} target="_blank" rel="noopener noreferrer">{translateText(cover.image.credit, locale)}</a> : <span>{translateText(cover.image.credit, locale)}</span>}
      {cover.image.licenseUrl && <a href={cover.image.licenseUrl} target="_blank" rel="noopener noreferrer">{t('许可', 'License')}</a>}
    </li>)}</ul>
  </details>;
}
