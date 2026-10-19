import { useUiCopy } from './ui/ui-copy';
import { localizedUrl } from '../i18n/locale';
import { withFamilyReading } from '../lib/family-reading';
import { SITE_URL } from '../lib/seo';

/** Copies text to the clipboard; a hidden textarea where the async clipboard is not allowed (older WebViews). */
async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back below */ }
  let area: HTMLTextAreaElement | undefined;
  try {
    area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    return document.execCommand('copy');
  } catch { return false; } finally { area?.remove(); }
}

/**
 * The send of 发给家人（大字版）: a link that opens at 特大 with 简洁显示 on (`withFamilyReading`), through the phone's share
 * sheet where there is one, else copied. Resolves to what to tell the reader after a copy (null after the share sheet or a
 * cancel): the button below prints it under itself, the detail bar's 发家人 cell says it in the app toast.
 */
export function useFamilySend(path: string, title: string): () => Promise<{ copied: boolean; message: string } | null> {
  const { t, locale } = useUiCopy();
  return async () => {
    const url = withFamilyReading(localizedUrl(`${SITE_URL}${path}${path.includes('?') ? '&' : '?'}from=family`, locale));
    const text = t(`${title}\n大字、简洁版，打开就能看：`, `${title}\nLarge text, simple view:`);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share({ title, text, url }); return null; } catch (error) { if (error instanceof Error && error.name === 'AbortError') return null; }
    }
    const copied = await copy(`${text}\n${url}`);
    return { copied, message: copied
      ? t('已复制大字版链接，发到家庭群就好；家人打开就是大字、简洁显示。', 'Large-text link copied. Paste it to your family; it opens in large text and simple view.')
      : t('浏览器未允许复制。请打开页面后，在字号里选「特大」和「简洁显示」再分享。', 'Copy was blocked. Open the page, choose extra-large text and simple view under Aa, then share it.') };
  };
}
