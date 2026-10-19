import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { CoverCredit } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import type { ImageCover, ResolvedCover } from '../../lib/cover';

/**
 * The page's last line (UI9-HOME, G12): "本页图片来源 (N)" — credit and licence for every photo cover shown on the home (the
 * badge says what an image is; who made it and under which licence sits here, design.md §4.5) — then 邻里信息 → and, once,
 * what an information card is. `#page-credits` with `data-count` is what the footer's 本页图片来源 link opens and reads;
 * `data-credits-at-end` tells the footer this page already ends with the line, so it prints no second one.
 */
export function HomeImageCredits({ covers, children }: { covers: readonly ResolvedCover[]; children?: ReactNode }) {
  const { t, pick, locale } = useUiCopy();
  const seen = new Set<string>();
  const images = covers.filter((cover): cover is ImageCover => cover.tier !== 'type' && !seen.has(cover.image.src) && !!seen.add(cover.image.src));
  return <div className="home-credits" id="page-credits" data-count={images.length} data-credits-at-end="">
    {images.length > 0 && <details>
      <summary>{t(`本页图片来源（${images.length}）`, `Image credits (${images.length})`)}<ChevronDown aria-hidden="true" strokeWidth={1.75} /></summary>
      <ul>{images.map(cover => <li key={cover.image.src}>
        <span className="home-credits__label">{pick(cover.label)}</span>
        {cover.image.creditUrl ? <a href={cover.image.creditUrl} target="_blank" rel="noopener noreferrer">{translateText(cover.image.credit, locale)}</a> : <span>{translateText(cover.image.credit, locale)}</span>}
        {cover.image.licenseUrl && <a href={cover.image.licenseUrl} target="_blank" rel="noopener noreferrer">{t('许可', 'License')}</a>}
      </li>)}</ul>
    </details>}
    {children}
    {covers.some(cover => cover.tier === 'type') && <CoverCredit />}
  </div>;
}
