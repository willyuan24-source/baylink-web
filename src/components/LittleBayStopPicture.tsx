import { useEffect, useRef, useState } from 'react';
import { Compass, Expand, RotateCcw } from 'lucide-react';
import type { LittleBayStop } from '../features/little-bay/catalog';
import { translateText, useLocale } from '../i18n/locale';
import { GuideImageLightbox } from './GuideVisuals';

/** A new stop starts a new picture session, including its lightbox and retry state. */
export function LittleBayStopPicture({ stop }: { stop: LittleBayStop }) {
  return <PictureSession key={`${stop.key}:${stop.image || ''}`} stop={stop} />;
}

function PictureSession({ stop }: { stop: LittleBayStop }) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const photoButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (attempt > 0) photoButton.current?.focus(); }, [attempt]);
  const image = stop.imageMeta;
  const alt = translateText(image?.alt || stop.title, locale);
  return <>
    <div className={`lb-stop-image lb-stop-image--${stop.kind}`}>
      {stop.image && !failed ? <button ref={photoButton} type="button" className="lb-stop-photo-open" disabled={!image}
        aria-label={t(`放大图片：${alt}`, `Enlarge photo: ${alt}`)} aria-haspopup={image ? 'dialog' : undefined} onClick={() => setOpen(true)}>
        <img key={attempt} src={stop.image} srcSet={image?.srcSet} sizes="(max-width: 767px) 94vw, 390px"
          width={image?.width} height={image?.height} alt={alt} loading="lazy" decoding="async"
          style={image?.fullFrame || image?.kind === 'poster' ? { objectFit: 'contain' } : undefined}
          onError={() => setFailed(true)} />
        {image && <span className="lb-stop-photo-zoom"><Expand size={14} aria-hidden="true" />{t('查看大图', 'View photo')}</span>}
      </button> : <div className="lb-stop-photo-empty">
        <Compass size={48} strokeWidth={1} aria-hidden="true" />
        <span>{failed ? t('照片暂时无法加载', 'Photo could not load') : stop.city}</span>
        {failed && <button type="button" onClick={() => { setAttempt(value => value + 1); setFailed(false); }}><RotateCcw size={14} aria-hidden="true" />{t('重新加载照片', 'Retry photo')}</button>}
      </div>}
      <span className="lb-image-badge">{stop.kind === 'event' ? t('当天活动', 'ON THIS DAY') : t('湾区好去处', 'A BAY AREA FAVORITE')}</span>
    </div>
    {open && image && <GuideImageLightbox image={image} onClose={() => setOpen(false)} />}
  </>;
}
