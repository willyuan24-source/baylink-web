import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Disclosure } from '../../components/ui/Disclosure';
import { useUiCopy } from '../../components/ui/ui-copy';
import type { GuideImage } from '../../data/guide-media';
import { getImageProvenance } from '../../lib/image-provenance';
import { creditAfterLabel } from '../../components/ui/CoverImage';

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
 * G13: the one 13 px credit line under a guide's title picture — credit · licence. The kind (示意图, 照片 · 年份) is the
 * picture's own badge (`label`, DECISIONS 23: one label per picture; captain 10-22 02:50), so the line does not repeat it.
 * Never on a 3D postcard (owner decision 1: those keep their own label, no credit line): the caller leaves it out for scene3d.
 */
export function GuideCoverCredit({ image, label }: { image: GuideImage; label: string }) {
  const { t } = useUiCopy();
  const credit = creditAfterLabel(label, image.credit);
  return <figcaption className="gd-credit">
    <span>{isWebLink(image.creditUrl) ? <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{credit}</a> : credit}</span>
    {isWebLink(image.licenseUrl) && <span><a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">{t('图片授权', 'License')}</a></span>}
  </figcaption>;
}

/**
 * What the floating button would cover (R2-14, UI9-R2-GUIDE): any text, link or control under its box, the site footer or the
 * action bar. The page under the button's fixed box is sampled at its centre and four inset corners; for each element there,
 * a control, the footer, the bar, or a text node of that element whose line box meets the button's box counts as covered.
 * Stepped aside (`data-off`) the button keeps its box but is hidden with visibility, which elementsFromPoint does not hit.
 */
function coversContent(button: HTMLElement): boolean {
  const box = button.getBoundingClientRect();
  if (!box.width || !box.height) return false;
  const inset = 6;
  const points: [number, number][] = [[box.left + box.width / 2, box.top + box.height / 2], [box.left + inset, box.top + inset], [box.right - inset, box.top + inset], [box.left + inset, box.bottom - inset], [box.right - inset, box.bottom - inset]];
  const meets = (rect: DOMRect) => rect.width > 0 && rect.height > 0 && rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top;
  const seen = new Set<Element>();
  for (const [x, y] of points) {
    for (const element of document.elementsFromPoint(x, y)) {
      if (element === button || button.contains(element) || seen.has(element)) continue;
      seen.add(element);
      if (element === document.documentElement || element === document.body) continue;
      if (element.closest('footer, .site-detail-actions, a, button, input, select, textarea, summary, label, [role=button]')) return true;
      for (const node of element.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        if ([...range.getClientRects()].some(meets)) return true;
      }
    }
  }
  return false;
}

/**
 * 回到顶部 (P38): a 48 px button after two screens of scroll, above the bar on a phone and bottom-right on a desktop. R2-14
 * (UI9-R2-GUIDE): it never sits on the page — while any text, link or control, the footer or the action bar is under it, it
 * steps aside (checked once a frame while the page scrolls or resizes). It jumps (no smooth scroll) under reduced motion and
 * in 简洁显示, then moves focus to the page's H1. At 大 / 特大 / 简洁 on a phone it is a labelled button at the end of the page
 * (guide-article.css), so only the floating one is checked.
 */
export function GuideToTop() {
  const { t } = useUiCopy();
  const ref = useRef<HTMLButtonElement>(null);
  const [shown, setShown] = useState(false);
  // Stepped aside until the first check has seen what is under it (no frame drawn over text).
  const [covering, setCovering] = useState(true);
  useEffect(() => {
    let frame = 0;
    // What is under it, once a frame (after layout); where a page has no frames to wait for (a test), at once.
    const cover = () => {
      frame = 0;
      const button = ref.current;
      // The labelled end-of-page button (大 / 特大 / 简洁 on a phone, not fixed) is never stepped aside; a hidden floating one
      // stays aside until it is drawn and checked.
      setCovering(!!button && getComputedStyle(button).position === 'fixed' && (button.hidden || coversContent(button)));
    };
    const check = () => {
      setShown(window.scrollY > window.innerHeight * 2);
      if (typeof requestAnimationFrame !== 'function') cover();
      else if (!frame) frame = requestAnimationFrame(cover);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => { window.removeEventListener('scroll', check); window.removeEventListener('resize', check); if (frame) cancelAnimationFrame(frame); };
  // Re-run when it shows: its box is real from then on.
  }, [shown]);
  const toTop = () => {
    const still = document.documentElement.hasAttribute('data-simple') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
    const heading = document.querySelector<HTMLElement>('main h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  };
  return <button ref={ref} type="button" className="gd-to-top" hidden={!shown} data-off={covering ? '' : undefined} aria-label={t('回到顶部', 'Back to top')} onClick={toTop}>
    <ArrowUp aria-hidden="true" strokeWidth={1.75} />
  </button>;
}
