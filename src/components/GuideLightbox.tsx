// The picture, enlarged (N10 / N13 / N24): a chunk of its own, with its styles (guide-lightbox.css), so a guide page does not
// wait for them; GuideVisuals.tsx's GuideImageLightbox loads it (lazy-dialog.ts: warmed when the page is idle). The caption
// comes in drawn (`caption`): importing GuideImageCaption back from GuideVisuals.tsx made the guide article's lazy-import
// list repeat chunks it already has. The ✕ is the site's one CloseButton (UI9-R2-GUIDE); the article already loads
// Button.tsx, so the lightbox chunk shares it.
import type { CSSProperties, ReactNode } from 'react';
import type { GuideImage } from '../data/guide-media';
import { CloseButton } from './ui/CloseButton';
import { ModalShell } from './ui/Modal';
import { useClosing } from './ui/closing';
import { useLocale } from '../i18n/locale';
import './guide-lightbox.css';

export type GuideLightboxProps = { image: GuideImage; caption: ReactNode; onClose: () => void; afterWait?: boolean };

/**
 * A surface panel sized to the picture over the picture viewers' scrim (no blur), with its credit and F's CloseButton. The
 * dialogs' motion: the scrim fades, the panel grows from 95% over --dur-2, and both leave the same way while useClosing keeps
 * them mounted. `afterWait`: DialogWait already painted the scrim, so it stays instead of fading in again.
 */
export function GuideLightbox({ image, caption, onClose, afterWait = false }: GuideLightboxProps) {
  const [closing, close] = useClosing(onClose);
  const label = useLocale() === 'en' ? 'Close the picture' : '关闭放大图片';
  const out = 'animate-out fade-out fill-mode-forwards ease-in';
  const scrim = closing ? out : afterWait ? '' : 'animate-in fade-in ease-out';
  const panel = closing ? `${out} zoom-out-95` : 'animate-in fade-in ease-out zoom-in-95';
  return <ModalShell label={`图片放大：${image.alt}`} onClose={close} className={`guide-image-overlay duration-150 ${scrim}`}>
    <div className={`guide-image-dialog duration-150 ${panel}`} style={{ '--guide-image-ratio': image.width / image.height } as CSSProperties}>
      <CloseButton className="guide-image-close" label={label} onClick={close} />
      <figure>
        <img src={image.src} alt={image.alt} width={image.width} height={image.height} style={image.width < 480 ? { maxWidth: image.width, marginInline: 'auto' } : undefined} decoding="async" />
        {caption}
      </figure>
    </div>
  </ModalShell>;
}
