import { useEffect, useRef, useState } from 'react';
import { Camera, Expand, ImageOff, RotateCcw } from 'lucide-react';
import type { GuideImage } from '../../data/guide-media';
import { translateText, type Locale } from '../../i18n/locale';

type Props = { photo: GuideImage; locale: Locale; expanded?: boolean; onExpand?: () => void };

/** Lives inside the game dialog so photographs remain visible in stage fullscreen. */
export default function SfLandmarkPhoto({ photo, locale, expanded = false, onExpand }: Props) {
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const figure = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  useEffect(() => {
    if (!retry) return;
    const target = opener.current || figure.current?.closest('.sf-guide-panel')?.querySelector<HTMLButtonElement>('.sf-guide-close');
    target?.focus();
  }, [retry]);
  const picture = <img key={retry} src={photo.src} srcSet={expanded ? undefined : photo.srcSet} sizes="(max-width: 600px) calc(100vw - 62px), 480px" alt={photo.alt} width={photo.width} height={photo.height} decoding="async" onError={() => setFailed(true)} />;
  return <figure ref={figure} className={`sf-landmark-photo${expanded ? ' is-expanded' : ''}`}>
    {failed ? <div className="sf-landmark-photo-failed" role="status"><ImageOff size={26} aria-hidden="true" /><p>{t('照片暂时未能加载', 'The photograph could not load')}</p><button type="button" onClick={() => { setFailed(false); setRetry(value => value + 1); }}><RotateCcw size={14} />{t('重试', 'Try again')}</button></div> : expanded ? <div className="sf-landmark-photo-full">{picture}</div> : <button ref={opener} type="button" className="sf-landmark-photo-open" onClick={onExpand} aria-label={t(`放大景点照片：${photo.alt}`, `Enlarge attraction photograph: ${photo.alt}`)}>
      {picture}<span className="sf-landmark-photo-label"><Camera size={13} />{t('真实景点', 'REAL PLACE')}</span><span className="sf-landmark-photo-zoom"><Expand size={14} />{t('查看大图', 'Enlarge')}</span>
    </button>}
    <figcaption><p>{photo.caption}</p><div><a href={photo.creditUrl} target="_blank" rel="noopener noreferrer">{photo.credit}</a>{photo.licenseUrl && <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">{t('图片授权', 'License')}</a>}</div></figcaption>
  </figure>;
}
