import { ModalShell } from './ui/Modal';
import { CloseButton } from './ui/CloseButton';
import { useUiCopy } from './ui/ui-copy';
import './site-dialogs.css';

/**
 * A post photo at full size: the site's one scrim, the picture fading in from 96 %, F's close button. `closing` plays the
 * exit (OverlayHost keeps the viewer mounted for it, useExit). No blur behind it (N10). Styles: site-dialogs.css.
 */
export const ImageViewer = ({ src, closing = false, onClose }: { src: string; closing?: boolean; onClose: () => void }) => {
  const { t } = useUiCopy();
  return <ModalShell onClose={onClose} label={t('查看大图', 'Full-size picture')} className={`site-image-viewer${closing ? ' is-closing' : ''}`}>
    <CloseButton className="site-image-viewer__close" label={t('关闭大图', 'Close picture')} onClick={onClose} />
    <img className="site-image-viewer__img" src={src} alt={t('查看完整图片', 'The full picture')} onClick={e => e.stopPropagation()} />
  </ModalShell>;
};
