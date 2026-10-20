import { getLocale, translateText } from '../i18n/locale';
import type { ShowToast } from './context';

/**
 * The toast for a dialog, or a header control (the Aa sheet, via AppLayout), whose chunk could not load. Opening it again
 * loads it again (ChunkBoundary forgets the lost chunk). Online, code that would not load is most likely from an older
 * deploy, so the toast also offers a reload.
 */
export const showUnavailable = (showToast: ShowToast, lostChunk: boolean) => {
  const t = (zh: string, en: string) => getLocale() === 'en' ? en : translateText(zh);
  showToast(t('暂时打不开，请检查网络后重试。', 'This could not open. Check your connection and try again.'), 'error',
    lostChunk && navigator.onLine ? { label: t('重新加载', 'Reload'), onClick: () => window.location.reload() } : undefined);
};
