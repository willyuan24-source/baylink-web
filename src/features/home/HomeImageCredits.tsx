import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { creditAfterLabel, useTierLabel } from '../../components/ui/CoverImage';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import type { ImageCover, ResolvedCover } from '../../lib/cover';
import type { HomeTilePhoto } from '../../lib/home-catalog';

/**
 * The page's last line (UI9-HOME, G12): "本页图片来源 (N)" — credit and licence for every photo cover shown on the home (the
 * badge says what an image is; who made it and under which licence sits here, design.md §4.5) — then 邻里信息 →.
 * `#page-credits` with `data-count` is what the footer's 本页图片来源 link opens and reads;
 * `data-credits-at-end` tells the footer this page already ends with the line, so it prints no second one.
 */
export function HomeImageCredits({ covers, tiles = [], children }: { covers: readonly ResolvedCover[]; tiles?: readonly HomeTilePhoto[]; children?: ReactNode }) {
  const { t, locale } = useUiCopy();
  const label = useTierLabel();
  const seen = new Set<string>();
  const images = covers.filter((cover): cover is ImageCover => cover.tier !== 'type' && !seen.has(cover.image.src) && !!seen.add(cover.image.src));
  // The entry tiles' photos (DECISIONS 27): navigation pictures, credited here under their own words (入口配图), never 示意图.
  const entries = [...images.map(cover => ({ key: cover.image.src, label: label(cover), image: cover.image })),
    ...tiles.filter(tile => !seen.has(tile.src) && !!seen.add(tile.src)).map(tile => ({ key: tile.src, label: t('入口配图', 'Entry photo'), image: tile }))];
  return <div className="home-credits" id="page-credits" data-count={entries.length} data-credits-at-end="">
    {entries.length > 0 && <details>
      <summary>{t(`本页图片来源（${entries.length}）`, `Image credits (${entries.length})`)}<ChevronDown aria-hidden="true" strokeWidth={1.75} /></summary>
      <ul>{entries.map(({ key, label: words, image }) => <li key={key}>
        <span className="home-credits__label">{words}</span>
        {image.creditUrl ? <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{creditAfterLabel(words, translateText(image.credit, locale))}</a> : <span>{creditAfterLabel(words, translateText(image.credit, locale))}</span>}
        {image.licenseUrl && <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">{t('许可', 'License')}</a>}
      </li>)}</ul>
    </details>}
    {children}
  </div>;
}
