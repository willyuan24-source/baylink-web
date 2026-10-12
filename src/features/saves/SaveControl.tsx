import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SAVE_ERROR_COPY, useSave } from '../../lib/saves';
import { translateText, useLocale } from '../../i18n/locale';
import type { SaveToWeekProps } from '../../components/SaveToWeek';
import { saveButtonName } from './save-name';
import { SaveToast } from './SaveToast';
import { prepareSaveAnnouncer } from './save-announcer';

/**
 * ♡ 收藏 for one event, place, offer or opening: the one save model (src/lib/saves.ts). Loaded on its own by
 * `SaveToWeek`, which shows the same button, disabled, until this module and the save store have arrived.
 *
 * A failed account read concerns the whole list, not this item. On a detail page (one control) it shows with a
 * 重新读取收藏 button. On a list card (`compact`, one per card) it stays silent, or every card of the list would
 * announce the same alert: the ♡ there reads the list again when tapped, and only the tapped card says if that failed.
 * Write errors on a card likewise show on the card that was tapped only.
 */
export default function SaveControl({ favorite, compact, title }: SaveToWeekProps) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const save = useSave(favorite.kind, favorite.id);
  const [toast, setToast] = useState('');
  const [tapped, setTapped] = useState(false);
  const unknown = save.saved === null;
  const rereadOnTap = !!compact && save.readError;
  const error = !compact || tapped ? save.error ?? (save.readError ? 'read' : null) : null;
  const toggle = async () => {
    setToast('');
    setTapped(true);
    prepareSaveAnnouncer();
    if (rereadOnTap) { save.retry(); return; }
    const result = await save.toggle();
    if (!result?.saved) return;
    setToast(!result.persisted ? t('已收藏，但浏览器未允许保存，刷新后可能丢失', 'Saved for this visit only; your browser did not keep it')
      : result.pending ? t('已收藏在本机，账号稍后同步', 'Saved on this device; your account will catch up') : t('已收藏', 'Saved'));
  };
  return <div className="saves-control" data-compact={compact ? '' : undefined}>
    <button type="button" className="saves-toggle" data-compact={compact ? '' : undefined} aria-pressed={unknown ? undefined : !!save.saved}
      aria-label={saveButtonName(!!save.saved, title, locale)} disabled={(unknown && !rereadOnTap) || save.busy} onClick={() => void toggle()}>
      <Heart aria-hidden="true" strokeWidth={1.75} />{save.saved ? t('已收藏', 'Saved') : t('收藏', 'Save')}
    </button>
    {!compact && <Link className="saves-control__link" to="/my-week#saved">{t('我的这周', 'My Week')}</Link>}
    {!compact && save.saved && save.pending && <p className="saves-control__note">{t('已收藏在本机，账号稍后同步。', 'Saved on this device; your account will catch up shortly.')}</p>}
    {error && <p className="saves-control__error" role="alert">{t(SAVE_ERROR_COPY[error].zh, SAVE_ERROR_COPY[error].en)}
      {error === 'read' && !compact && <button type="button" onClick={save.retry}>{t('重新读取收藏', 'Reload saved items')}</button>}</p>}
    {toast && <SaveToast message={toast} actionLabel={t('查看', 'View')} to="/my-week#saved" closeLabel={t('关闭提示', 'Dismiss')} onClose={() => setToast('')} />}
  </div>;
}
