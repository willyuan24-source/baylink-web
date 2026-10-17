import { useUiCopy } from '../../components/ui/ui-copy';
import type { GuideImage } from '../../data/guide-media';
import { getImageProvenance } from '../../lib/image-provenance';

const isWebLink = (url?: string) => !!url && /^https?:\/\//i.test(url);

/**
 * 本页图片来源 (design.md §4.5 ProvenanceBadge): the cover badge says what kind of picture it is; credit, licence and caption
 * for every picture shown on the page are listed once here, under the sources.
 */
export function GuidePageImageCredits({ images }: { images: readonly GuideImage[] }) {
  const { t, english } = useUiCopy();
  const shown = images.filter((image, index) => images.findIndex(other => other.src === image.src) === index);
  if (!shown.length) return null;
  return <details className="gd-credits">
    <summary>{t(`本页图片来源（${shown.length}）`, `Image credits (${shown.length})`)}</summary>
    <ul>{shown.map(image => <li key={image.src}>
      <span className="gd-credits__kind">{getImageProvenance(image, english)}</span>
      <span className="gd-credits__caption">{image.caption}</span>
      {isWebLink(image.creditUrl) ? <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{image.credit}</a> : <span>{image.credit}</span>}
      {isWebLink(image.licenseUrl) && <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">{t('图片授权', 'License')}</a>}
    </li>)}</ul>
  </details>;
}
