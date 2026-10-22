// The picture, enlarged (N10 / N13 / N24): a chunk of its own, with its styles (guide-lightbox.css), so a guide page does not
// wait for them; GuideVisuals.tsx's GuideImageLightbox loads it (lazy-dialog.ts: warmed when the page is idle). The caption
// comes in drawn (`caption`), and the ✕'s label reads the locale itself (繁體 from the host's attribute translation,
// i18n/host.ts): importing GuideImageCaption back from GuideVisuals.tsx and ui-copy made the guide article's lazy-import
// list repeat chunks it already has (+36 B gzip on the guide route).
import type { CSSProperties, ReactNode } from 'react';
import { X } from 'lucide-react';
import type { GuideImage } from '../data/guide-media';
import { ModalShell } from './ui/Modal';
import { useClosing } from './ui/closing';
import { useLocale } from '../i18n/locale';
import './guide-lightbox.css';

export type GuideLightboxProps = { image: GuideImage; caption: ReactNode; onClose: () => void; afterWait?: boolean };

/**
 * A surface panel sized to the picture over the site's one scrim (no blur), with its credit and F's close button
 * (CloseButton's markup: no Button.tsx for one button). The dialogs' motion: the scrim fades, the panel grows from 95% over
 * --dur-2, and both leave the same way while useClosing keeps them mounted. `afterWait`: DialogWait already painted the
 * scrim, so it stays instead of fading in again.
 */
export function GuideLightbox({ image, caption, onClose, afterWait = false }: GuideLightboxProps) {
  const [closing, close] = useClosing(onClose);
  const label = useLocale() === 'en' ? 'Close the picture' : '关闭放大图片';
  const out = 'animate-out fade-out fill-mode-forwards ease-in';
  const scrim = closing ? out : afterWait ? '' : 'animate-in fade-in ease-out';
  const panel = closing ? `${out} zoom-out-95` : 'animate-in fade-in ease-out zoom-in-95';
  return <ModalShell label={`图片放大：${image.alt}`} onClose={close} className={`guide-image-overlay duration-150 ${scrim}`}>
    <div className={`guide-image-dialog duration-150 ${panel}`} style={{ '--guide-image-ratio': image.width / image.height } as CSSProperties}>
      <button type="button" className="ui-icon-button ui-close guide-image-close" aria-label={label} title={label} onClick={close}><X aria-hidden="true" strokeWidth={1.75} /></button>
      <figure>
        <img src={image.src} alt={image.alt} width={image.width} height={image.height} style={image.width < 480 ? { maxWidth: image.width, marginInline: 'auto' } : undefined} decoding="async" />
        {caption}
      </figure>
    </div>
  </ModalShell>;
}
