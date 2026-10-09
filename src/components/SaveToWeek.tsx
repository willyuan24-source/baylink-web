import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Favorite } from '../lib/planner';
import { SAVE_ERROR_COPY, useSave } from '../lib/saves';
import { translateText, useLocale } from '../i18n/locale';
import { Button } from './ui/Button';
import { SaveToast } from '../features/saves/SaveToast';
import '../features/saves/saves.css';

type Props = {
  favorite: Favorite;
  /** On a list card: the button only (no "我的这周" link), with the item's title in its accessible name. */
  compact?: boolean;
  /** The item's title (catalog source text), read with the button: "收藏：…". */
  title?: string;
};

/**
 * ♡ 收藏 for one event, place, offer or opening: the one save model (src/lib/saves.ts). Signed-in saves go to the
 * account, guests keep them in this browser, and a save the account cannot accept yet stays saved here (RC-15).
 */
export function SaveToWeek(props: Props) {
  // On a guide page the reader actions beside this mount carry the same ♡ (GuideReaderActions); two buttons for one
  // save would confuse. WEB-GUIDES removes this mount from GuideDetail.
  if (props.favorite.kind === 'guide' && !props.compact) return null;
  return <SaveControl {...props} />;
}

function SaveControl({ favorite, compact, title }: Props) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const save = useSave(favorite.kind, favorite.id);
  const [toast, setToast] = useState('');
  const unknown = save.saved === null;
  const label = save.saved ? t('已收藏', 'Saved') : t('收藏', 'Save');
  const name = title ? `${save.saved ? t('取消收藏', 'Remove from saved') : t('收藏', 'Save')}${locale === 'en' ? ': ' : '：'}${translateText(title, locale)}` : undefined;
  const error = save.error ?? (save.readError ? 'read' : null);
  const toggle = async () => {
    setToast('');
    const result = await save.toggle();
    if (!result?.saved) return;
    setToast(!result.persisted ? t('已收藏，但浏览器未允许保存，刷新后可能丢失', 'Saved for this visit only; your browser did not keep it')
      : result.pending ? t('已收藏在本机，账号稍后同步', 'Saved on this device; your account will catch up') : t('已收藏', 'Saved'));
  };
  return <div className="saves-control" data-compact={compact ? '' : undefined}>
    <Button variant="tonal" className="saves-toggle" data-compact={compact ? '' : undefined} aria-pressed={unknown ? undefined : !!save.saved} aria-label={name}
      disabled={unknown || save.busy} onClick={() => void toggle()} icon={<Heart aria-hidden="true" strokeWidth={1.75} />}>{label}</Button>
    {!compact && <Link className="saves-control__link" to="/my-week#saved">{t('我的这周', 'My Week')}</Link>}
    {!compact && save.saved && save.pending && <p className="saves-control__note">{t('已收藏在本机，账号稍后同步。', 'Saved on this device; your account will catch up shortly.')}</p>}
    {error && <p className="saves-control__error" role="alert">{t(SAVE_ERROR_COPY[error].zh, SAVE_ERROR_COPY[error].en)}
      {error === 'read' && <button type="button" onClick={save.retry}>{t('重新读取收藏', 'Reload saved items')}</button>}</p>}
    {toast && <SaveToast message={toast} actionLabel={t('查看', 'View')} to="/my-week#saved" closeLabel={t('关闭提示', 'Dismiss')} onClose={() => setToast('')} />}
  </div>;
}
