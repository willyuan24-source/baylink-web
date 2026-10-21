import { useEffect, useRef } from 'react';
import { Check, Heart } from 'lucide-react';
import { SAVE_ERROR_COPY, useSave } from '../../lib/saves';
import { translateText, useLocale } from '../../i18n/locale';

export type ReaderNotice = { text: string; retry?: () => void };

/**
 * The guide's 收藏 button in the reader actions: the one save model (src/lib/saves.ts). Loaded on its own by
 * GuideReaderActions, which shows the same button, disabled, until it arrives. Messages go to the reader actions'
 * status lines: `onStatus` after a change, `onError` while a save or the account read has failed.
 */
export default function GuideSaveButton({ slug, onStatus, onError }: { slug: string; onStatus: (text: string) => void; onError: (notice: ReaderNotice | null) => void }) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const save = useSave('guide', slug);
  const retry = useRef(save.retry);
  useEffect(() => { retry.current = save.retry; });
  const error = save.error ?? (save.readError ? 'read' : null);
  useEffect(() => {
    if (!error) { onError(null); return; }
    const copy = SAVE_ERROR_COPY[error];
    onError({ text: locale === 'en' ? copy.en : translateText(copy.zh, locale), retry: error === 'read' ? () => retry.current() : undefined });
  }, [error, locale, onError]);
  const toggle = async () => {
    onStatus('');
    const result = await save.toggle();
    if (!result) return;
    onStatus(!result.saved ? t('已取消收藏。', 'Removed from saved items.')
      : !result.persisted ? t('浏览器未允许保存，刷新后可能丢失。', 'Your browser did not keep this; it may be gone after a refresh.')
        : result.pending ? t('已收藏在本机，账号稍后同步。在「我的这周」找回。', 'Saved on this device; your account will catch up. Find it in My Week.')
          : t('已收藏。在「我的这周」找回。', 'Saved. Find it in My Week.'));
  };
  return <button type="button" onClick={() => void toggle()} aria-pressed={save.saved === null ? undefined : save.saved} disabled={save.saved === null || save.busy}>
    {save.saved ? <Check size={16} /> : <Heart size={16} />}{save.saved ? t('已收藏', 'Saved') : t('收藏', 'Save')}
  </button>;
}
