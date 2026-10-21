import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Disclosure } from '../../components/ui/Disclosure';
import { useUiCopy } from '../../components/ui/ui-copy';
import type { GuideImage } from '../../data/guide-media';
import { getImageProvenance } from '../../lib/image-provenance';

const isWebLink = (url?: string) => !!url && /^https?:\/\//i.test(url);

/**
 * 本页图片来源 (design.md §4.5 ProvenanceBadge): the cover badge says what kind of picture it is; credit, licence and caption
 * for every picture shown on the page are listed once here, last on the page. `#page-credits` and `data-count` let the site
 * footer link here (NAV); `data-credits-at-end` says the block ends the page, so the footer prints no second entry (NAV
 * request 1, UI9-INT).
 */
export function GuidePageImageCredits({ images }: { images: readonly GuideImage[] }) {
  const { t, english } = useUiCopy();
  const shown = images.filter((image, index) => images.findIndex(other => other.src === image.src) === index);
  if (!shown.length) return null;
  return <div id="page-credits" className="gd-credits" data-count={shown.length} data-credits-at-end="">
    <Disclosure summary={t(`本页图片来源（${shown.length}）`, `Image credits (${shown.length})`)}>
      <ul>{shown.map(image => <li key={image.src}>
        <span className="gd-credits__kind">{getImageProvenance(image, english)}</span>
        <span className="gd-credits__caption">{image.caption}</span>
        {isWebLink(image.creditUrl) ? <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{image.credit}</a> : <span>{image.credit}</span>}
        {isWebLink(image.licenseUrl) && <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">{t('图片授权', 'License')}</a>}
      </li>)}</ul>
    </Disclosure>
  </div>;
}

/**
 * G13: the one 13 px credit line under a guide's lead photo — kind (with the year when the picture has one) · credit · licence.
 * Never on a 3D postcard (owner decision 1: those keep their own label, no credit line): the caller leaves it out for scene3d.
 */
export function GuideCoverCredit({ image }: { image: GuideImage }) {
  const { t, english } = useUiCopy();
  return <figcaption className="gd-credit">
    <span>{getImageProvenance(image, english)}</span>
    <span>{isWebLink(image.creditUrl) ? <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{image.credit}</a> : image.credit}</span>
    {isWebLink(image.licenseUrl) && <span><a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">{t('图片授权', 'License')}</a></span>}
  </figcaption>;
}

/**
 * 回到顶部 (P38): a 48 px button after two screens of scroll, above the bar on a phone and bottom-right on a desktop. It jumps
 * (no smooth scroll) under reduced motion and in 简洁显示, then moves focus to the page's H1.
 */
export function GuideToTop() {
  const { t } = useUiCopy();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const check = () => setShown(window.scrollY > window.innerHeight * 2);
    check();
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, []);
  const toTop = () => {
    const still = document.documentElement.hasAttribute('data-simple') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
    const heading = document.querySelector<HTMLElement>('main h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  };
  return <button type="button" className="gd-to-top" hidden={!shown} aria-label={t('回到顶部', 'Back to top')} onClick={toTop}>
    <ArrowUp aria-hidden="true" strokeWidth={1.75} />
  </button>;
}
