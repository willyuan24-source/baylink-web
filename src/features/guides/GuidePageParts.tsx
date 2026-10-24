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

const CONTROLS = 'a[href], button, input, select, textarea, summary, label, [role=button], footer, .site-detail-actions';

/**
 * What the floating button would cover (R2-14, UI9-R2-GUIDE): any text line, link or control under its box, the site footer
 * or the action bar. `quick` samples the page under the box at nine points (each frame while the page scrolls); the full
 * check (once the page rests) measures every text line and control whose box meets the button's. Stepped aside
 * (`data-off`) the button keeps its box but is hidden with visibility, which elementsFromPoint does not hit.
 */
function coversContent(button: HTMLElement, quick: boolean): boolean {
  const box = button.getBoundingClientRect();
  if (!box.width || !box.height) return false;
  const meets = (rect: DOMRect) => rect.width > 0 && rect.height > 0 && rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top;
  const textMeets = (element: Element) => [...element.childNodes].some(node => {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) return false;
    const range = document.createRange();
    range.selectNodeContents(node);
    return [...range.getClientRects()].some(meets);
  });
  const visible = (element: Element) => { const style = getComputedStyle(element); return style.visibility !== 'hidden' && style.display !== 'none'; };
  if (quick) {
    const seen = new Set<Element>();
    for (const fx of [.1, .5, .9]) for (const fy of [.1, .5, .9]) for (const element of document.elementsFromPoint(box.left + box.width * fx, box.top + box.height * fy)) {
      if (element === button || button.contains(element) || seen.has(element) || element === document.documentElement || element === document.body) continue;
      seen.add(element);
      if (element.closest(CONTROLS) || textMeets(element)) return true;
    }
    return false;
  }
  for (const element of document.querySelectorAll(CONTROLS)) if (element !== button && !button.contains(element) && meets(element.getBoundingClientRect()) && visible(element)) return true;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const checked = new Set<Element>();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || checked.has(parent) || button.contains(parent)) continue;
    checked.add(parent);
    if (meets(parent.getBoundingClientRect()) && visible(parent) && textMeets(parent)) return true;
  }
  return false;
}

/**
 * 回到顶部 (P38): a 48 px button after two screens of scroll, above the bar on a phone and bottom-right on a desktop. R2-14
 * (UI9-R2-GUIDE): it never sits on the page — while any text, link or control, the footer or the action bar is under it, it
 * steps aside (a quick check each frame while the page scrolls, the full one when it rests). It jumps (no smooth scroll) under reduced motion and
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
    let frame = 0, rest = 0;
    // The labelled end-of-page button (大 / 特大 / 简洁 on a phone, not fixed) is never stepped aside; a hidden floating one
    // stays aside until it is drawn and checked. While the page scrolls the quick check runs once a frame (it can only step
    // the button aside); 120 ms after the page rests the full check decides.
    const covered = (quick: boolean) => {
      const button = ref.current;
      return !!button && getComputedStyle(button).position === 'fixed' && (button.hidden || coversContent(button, quick));
    };
    const settle = () => { rest = 0; setCovering(covered(false)); };
    const onFrame = () => { frame = 0; if (covered(true)) setCovering(true); };
    const check = () => {
      setShown(window.scrollY > window.innerHeight * 2);
      // Where a page has no frames to wait for (a test), at once.
      if (typeof requestAnimationFrame !== 'function') { settle(); return; }
      if (!frame) frame = requestAnimationFrame(onFrame);
      window.clearTimeout(rest);
      rest = window.setTimeout(settle, 120);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => { window.removeEventListener('scroll', check); window.removeEventListener('resize', check); if (frame) cancelAnimationFrame(frame); window.clearTimeout(rest); };
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
