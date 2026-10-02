import { useId, useMemo, useState } from 'react';
import { Check, ChevronDown, Image, Search, Type } from 'lucide-react';
import { translateText } from '../../i18n/locale';
import type { OutingCoverSelection } from '../../lib/outings';
import { useOutingCopy } from './outing-copy';
import { getOutingCoverChoices, resolveOutingCover, type OutingCoverInput } from './outing-cover';
import { OutingCover } from './OutingCover';

export function OutingCoverPicker({ outing, onChange, disabled = false }: {
  outing: OutingCoverInput; onChange: (cover: OutingCoverSelection) => void; disabled?: boolean;
}) {
  const { locale, t } = useOutingCopy();
  const [expanded, setExpanded] = useState(false), [query, setQuery] = useState('');
  const resultsId = useId(), searchId = useId();
  const choices = useMemo(() => getOutingCoverChoices(query, 6, locale), [query, locale]);
  const selected = resolveOutingCover(outing);
  const mode = outing.cover?.kind || 'auto';
  return <div className="outing-cover-picker">
    <div className="outing-cover-picker-heading"><div><h4>{t('小队封面', 'Gathering cover')}</h4><p>{t('一眼看懂想做什么。可以沿用关联活动的图片，或选一篇参考内容。', 'Show what you have in mind. Use the linked event image or pick a reference from BAYLINK.')}</p></div><span>{t('可选', 'Optional')}</span></div>
    <div className="outing-cover-modes" role="group" aria-label={t('封面样式', 'Cover style')}>
      <button type="button" disabled={disabled} aria-pressed={mode === 'auto'} onClick={() => onChange({ kind: 'auto' })}><Image size={16} aria-hidden="true" />{t('自动配图', 'Automatic')}</button>
      <button type="button" disabled={disabled} aria-pressed={mode === 'card'} onClick={() => onChange({ kind: 'card' })}><Type size={16} aria-hidden="true" />{t('文字卡片', 'Text card')}</button>
      <button type="button" disabled={disabled} aria-expanded={expanded} aria-controls={resultsId} aria-pressed={mode !== 'auto' && mode !== 'card'} onClick={() => setExpanded(value => !value)}><Search size={16} aria-hidden="true" />{t('从攻略与资讯选图', 'Choose from BAYLINK')}<ChevronDown size={14} aria-hidden="true" /></button>
    </div>
    {expanded && <div id={resultsId} className="outing-cover-catalog">
      <label htmlFor={searchId}>{t('搜索地点、攻略、活动或店名', 'Search places, guides, events or shops')}</label>
      <input id={searchId} type="search" value={query} disabled={disabled} placeholder={t('例如：海边、咖啡、San Mateo', 'Try: coast, coffee, San Mateo')} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} maxLength={120} />
      <div className="outing-cover-options">
        {choices.map(choice => <button type="button" key={`${choice.kind}:${choice.id}`} disabled={disabled} aria-pressed={mode === choice.kind && selected?.id === choice.id} onClick={() => { onChange({ kind: choice.kind, id: choice.id }); setExpanded(false); }}>
          <img src={choice.image.src} alt="" loading="lazy" decoding="async" className={choice.image.kind === 'poster' || choice.image.fullFrame ? 'is-full-frame' : ''} onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />
          <span><small>{choice.kind === 'guide' ? t('攻略', 'Guide') : choice.kind === 'event' ? t('活动', 'Event') : choice.kind === 'offer' ? t('优惠', 'Offer') : t('新店', 'Opening')} · {choice.image.kind === 'photo' ? t('实景', 'Photo') : choice.image.kind === 'poster' ? t('宣传图', 'Artwork') : t('插图', 'Illustration')}</small><strong>{translateText(choice.title, locale)}</strong></span>
          {mode === choice.kind && selected?.id === choice.id && <Check size={16} aria-hidden="true" />}
        </button>)}
      </div>
      <p role="status">{choices.length ? t('最多显示 6 项，输入更具体的地点或名称继续筛选。', 'Showing up to 6 matches. Refine the place or name to find more.') : t('没有找到。试试地点名，或使用文字卡片。', 'No matches. Try a place name or use a text card.')}</p>
    </div>}
    {mode !== 'auto' && mode !== 'card' && !selected && <p className="outing-cover-picker-note" role="status">{t('原参考内容暂不可用，已显示文字卡片，请重新选图。', 'The original reference is unavailable. A text card is shown; please choose another cover.')}</p>}
    <div className="outing-cover-preview-label">{t('封面预览', 'Cover preview')}{mode === 'auto' && !selected && <span>{t('未关联活动时，自动使用文字卡片', 'No linked event: a text card is used')}</span>}</div>
    <OutingCover outing={outing} variant="preview" />
    <p className="outing-cover-picker-note">{t('换封面只影响展示，不会改动小队时间、地点或关联活动。请核对参考内容是否适合这次见面。', 'Changing the cover only changes its appearance, not the time, place or linked event. Check that the reference fits your gathering.')}</p>
  </div>;
}
