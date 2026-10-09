import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SAVE_ERROR_COPY, useSave } from '../../lib/saves';
import { translateText, useLocale } from '../../i18n/locale';
import type { SaveToWeekProps } from '../../components/SaveToWeek';
import { saveButtonName } from './save-name';
import { SaveToast } from './SaveToast';

/**
 * ♡ 收藏 for one event, place, offer or opening: the one save model (src/lib/saves.ts). Loaded on its own by
 * `SaveToWeek`, which shows the same button, disabled, until this module and the save store have arrived.
 */
export default function SaveControl({ favorite, compact, title }: SaveToWeekProps) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const save = useSave(favorite.kind, favorite.id);
  const [toast, setToast] = useState('');
  const unknown = save.saved === null;
  const error = save.error ?? (save.readError ? 'read' : null);
  const toggle = async () => {
    setToast('');
    const result = await save.toggle();
    if (!result?.saved) return;
    setToast(!result.persisted ? t('已收藏，但浏览器未允许保存，刷新后可能丢失', 'Saved for this visit only; your browser did not keep it')
      : result.pending ? t('已收藏在本机，账号稍后同步', 'Saved on this device; your account will catch up') : t('已收藏', 'Saved'));
  };
  return <div className="saves-control" data-compact={compact ? '' : undefined}>
    <button type="button" className="saves-toggle" data-compact={compact ? '' : undefined} aria-pressed={unknown ? undefined : !!save.saved}
      aria-label={saveButtonName(!!save.saved, title, locale)} disabled={unknown || save.busy} onClick={() => void toggle()}>
      <Heart aria-hidden="true" strokeWidth={1.75} />{save.saved ? t('已收藏', 'Saved') : t('收藏', 'Save')}
    </button>
    {!compact && <Link className="saves-control__link" to="/my-week#saved">{t('我的这周', 'My Week')}</Link>}
    {!compact && save.saved && save.pending && <p className="saves-control__note">{t('已收藏在本机，账号稍后同步。', 'Saved on this device; your account will catch up shortly.')}</p>}
    {error && <p className="saves-control__error" role="alert">{t(SAVE_ERROR_COPY[error].zh, SAVE_ERROR_COPY[error].en)}
      {error === 'read' && <button type="button" onClick={save.retry}>{t('重新读取收藏', 'Reload saved items')}</button>}</p>}
    {toast && <SaveToast message={toast} actionLabel={t('查看', 'View')} to="/my-week#saved" closeLabel={t('关闭提示', 'Dismiss')} onClose={() => setToast('')} />}
  </div>;
}
