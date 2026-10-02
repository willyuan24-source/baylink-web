import { useState } from 'react';
import { ArrowUpRight, CalendarDays, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { localizedUrl, translateText } from '../../i18n/locale';
import { safeOutingUrl } from '../../lib/outings';
import { useOutingCopy } from './outing-copy';
import { resolveOutingCover, type OutingCoverInput } from './outing-cover';

export function OutingCover({ outing, variant = 'card', source = true, to }: {
  outing: OutingCoverInput; variant?: 'card' | 'detail' | 'preview'; source?: boolean; to?: string;
}) {
  const { locale, t } = useOutingCopy();
  const selected = resolveOutingCover(outing);
  const [failedSource, setFailedSource] = useState('');
  const image = selected?.image;
  const showImage = image && failedSource !== image.src;
  const date = /^20\d{2}-\d{2}-\d{2}$/.test(outing.date) ? outing.date.slice(5).replace('-', ' / ') : '';
  const frameClass = `outing-cover-frame${image?.kind === 'poster' || image?.fullFrame ? ' is-full-frame' : ''}`;
  const content = showImage ? <>
        {(image.kind === 'poster' || image.fullFrame) && <img className="outing-cover-backdrop" src={image.src} alt="" aria-hidden="true" loading="lazy" decoding="async" />}
        <img className="outing-cover-image" src={image.src} srcSet={image.srcSet} sizes={variant === 'detail' ? '(max-width: 720px) 90vw, 960px' : '(max-width: 720px) 90vw, 500px'} width={image.width} height={image.height} alt={translateText(image.alt, locale)} loading="lazy" decoding="async" onError={() => setFailedSource(image.src)} />
        <span className="outing-cover-kind">{image.kind === 'photo' ? t('参考实景', 'Reference photo') : image.kind === 'poster' ? t('活动宣传图', 'Event artwork') : t('情境插图', 'Illustration')}</span>
      </> : <div className="outing-cover-designed">
        <div className="outing-cover-designed-top"><span>BAYLINK · TOGETHER</span><Users size={20} aria-hidden="true" /></div>
        <strong className={variant === 'card' && date ? 'outing-cover-calendar-date' : undefined} translate="no">{variant === 'card' ? date || t('一起出发', 'Go together') : outing.title.trim() || t('一起，把想法变成见面', 'Make room for a little together time')}</strong>
        <div className="outing-cover-designed-meta">
          {(date || outing.startTime) && <span><CalendarDays size={14} aria-hidden="true" />{variant === 'card' ? outing.startTime : [date, outing.startTime].filter(Boolean).join(' · ')}</span>}
          <span translate="no"><MapPin size={14} aria-hidden="true" />{outing.city.trim() || t('湾区小队', 'Bay Area gathering')}</span>
        </div>
      </div>;
  return <figure className={`outing-cover outing-cover--${variant}${showImage ? ' has-image' : ' is-designed'}`}>
    {to ? <Link className={frameClass} to={to} aria-label={`${t('查看小队', 'View gathering')}: ${outing.title}`}>{content}</Link> : <div className={frameClass}>{content}</div>}
    {selected && <figcaption className="outing-cover-caption">
      {source && <a href={localizedUrl(selected.path, locale)} target="_blank" rel="noopener noreferrer"><span>{t('参考内容', 'Reference')} · {translateText(selected.title, locale)}</span><ArrowUpRight size={14} aria-hidden="true" /></a>}
      <details className="outing-cover-credit"><summary>{t('图片说明与署名', 'Image details & credits')}</summary>
        <p>{translateText(selected.image.caption, locale)}</p>
        <p>{translateText(selected.image.credit, locale)}</p>
        <div>
          {selected.image.creditUrl && safeOutingUrl(selected.image.creditUrl) && <a href={selected.image.creditUrl} target="_blank" rel="noopener noreferrer">{t('图片来源', 'Image source')}</a>}
          {selected.image.licenseUrl && safeOutingUrl(selected.image.licenseUrl) && <a href={selected.image.licenseUrl} target="_blank" rel="noopener noreferrer">{t('授权说明', 'License')}</a>}
        </div>
        <p>{t('封面引用站内内容，不是小队合照，也不表示原活动或商家主办此小队。', 'This cover references BAYLINK content. It is not a group photo or an endorsement by the original organizer or business.')}</p>
      </details>
    </figcaption>}
  </figure>;
}
