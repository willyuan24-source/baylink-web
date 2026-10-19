import { Disclosure } from '../../components/ui/Disclosure';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import type { ImageCover, ResolvedCover } from '../../lib/cover';

/**
 * "本页图片来源": credit and licence for every photo cover on the page (design.md §4.5 ProvenanceBadge: the badge says
 * what an image is; who made it and under which licence sits here), in PREP's shared Disclosure. The one line that says what
 * a coded cover is (没有照片的条目用 BAYLINK 信息卡) is printed here once for the whole page, on every view of the column,
 * instead of under each list (FeedGrid coverCredit={false}; events.css hides the boards' own line).
 * G12: #page-credits with data-count (the number of credited images) and data-credits-at-end is what NAV's footer link reads.
 */
export function ImageCredits({ covers }: { covers: readonly ResolvedCover[] }) {
  const { t, pick, locale } = useUiCopy();
  const seen = new Set<string>();
  const images = covers.filter((cover): cover is ImageCover => cover.tier !== 'type' && !seen.has(cover.image.src) && !!seen.add(cover.image.src));
  const coded = covers.some(cover => cover.tier === 'type');
  if (!images.length && !coded) return null;
  return <section id="page-credits" className="ev-credits" data-count={images.length} data-credits-at-end="" aria-label={t('本页图片来源', 'Image credits')}>
    {images.length > 0 && <Disclosure summary={t(`本页图片来源（${images.length}）`, `Image credits (${images.length})`)} className="ev-credits__list">
      <ul>{images.map(cover => <li key={cover.image.src}>
        <span className="ev-credits__label">{pick(cover.label)}</span>
        {cover.image.creditUrl ? <a href={cover.image.creditUrl} target="_blank" rel="noopener noreferrer">{translateText(cover.image.credit, locale)}</a> : <span>{translateText(cover.image.credit, locale)}</span>}
        {cover.image.licenseUrl && <a href={cover.image.licenseUrl} target="_blank" rel="noopener noreferrer">{t('许可', 'License')}</a>}
      </li>)}</ul>
    </Disclosure>}
    {coded && <p className="ev-credits__note">{t('没有照片的条目用 BAYLINK 信息卡。', 'No photo: a BAYLINK info card.')}</p>}
  </section>;
}
