import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import type { ImageCover, ResolvedCover } from '../../lib/cover';
import { webLink } from './hero-cover';

/** The hero photo's long caption, in the source section; 简洁显示 leaves it out. */
export function HeroCaption({ cover }: { cover: ResolvedCover }) {
  const { t, locale } = useUiCopy();
  if (cover.tier === 'type' || !cover.image.caption) return null;
  return <p className="detail-caption" data-simple="hide">{t('图片：', 'Photo: ')}{translateText(cover.image.caption, locale)}</p>;
}

/**
 * 本页图片来源 (NAV's footer links here, #page-credits): one collapsed list of every photo on the page (the hero, the venue
 * photo and the rail covers), each with its label, credit and licence; `data-count` is how many. Nothing without a photo.
 */
export function PageCredits({ photos }: { photos: { title: string; cover: ImageCover }[] }) {
  const { t, pick, locale } = useUiCopy();
  if (!photos.length) return null;
  return <details id="page-credits" className="detail-page-credits" data-count={photos.length}>
    <summary>{t(`本页图片来源（${photos.length}）`, `Photo credits on this page (${photos.length})`)}</summary>
    <ul>{photos.map(({ title, cover }) => <li key={`${title}:${cover.image.src}`}>
      {title} · {pick(cover.label)}{cover.image.credit && <> · {webLink(cover.image.creditUrl) ? <a href={cover.image.creditUrl} target="_blank" rel="noopener noreferrer">{translateText(cover.image.credit, locale)}</a> : translateText(cover.image.credit, locale)}</>}
      {webLink(cover.image.licenseUrl) && <> · <a href={cover.image.licenseUrl} target="_blank" rel="noopener noreferrer">{t('图片授权', 'License')}</a></>}
    </li>)}</ul>
  </details>;
}
