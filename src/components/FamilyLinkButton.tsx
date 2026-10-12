import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button, type ButtonVariant } from './ui/Button';
import { useUiCopy } from './ui/ui-copy';
import { localizedUrl } from '../i18n/locale';
import { withFamilyReading } from '../lib/family-reading';
import { SITE_URL } from '../lib/seo';

export type FamilyLinkButtonProps = {
  /** The page to send, as a site path without the language prefix ("/guides?topic=elders"); `from=family` is added. */
  path: string;
  /** What the page is, already in the reader's language: the share sheet's title and the first line of the message. */
  title: string;
  variant?: ButtonVariant;
  block?: boolean;
  className?: string;
};

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
 * 发给家人（大字版） (HOMEIA-07, product.md §5): shares a link that opens at 特大 with 简洁显示 on
 * (`?reading=extra-large&simple=1`, `withFamilyReading`), so an adult child can send a parent a page that is big and simple
 * from the first paint (public/reading-init.js applies both before the page draws). Uses the phone's share sheet where
 * there is one, else copies the link and says so. For home's 长辈与家属 entry; detail and guide pages can mount it too.
 */
export function FamilyLinkButton({ path, title, variant = 'secondary', block, className }: FamilyLinkButtonProps) {
  const { t, locale } = useUiCopy();
  const [status, setStatus] = useState('');
  const send = async () => {
    setStatus('');
    const url = withFamilyReading(localizedUrl(`${SITE_URL}${path}${path.includes('?') ? '&' : '?'}from=family`, locale));
    const text = t(`${title}\n大字、简洁版，打开就能看：`, `${title}\nLarge text, simple view:`);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share({ title, text, url }); return; } catch (error) { if (error instanceof Error && error.name === 'AbortError') return; }
    }
    setStatus(await copy(`${text}\n${url}`)
      ? t('已复制大字版链接，发到家庭群就好；家人打开就是大字、简洁显示。', 'Large-text link copied. Paste it to your family; it opens in large text and simple view.')
      : t('浏览器未允许复制。请打开页面后，在字号里选「特大」和「简洁显示」再分享。', 'Copy was blocked. Open the page, choose extra-large text and simple view under Aa, then share it.'));
  };
  return <span className={['family-link', className].filter(Boolean).join(' ')}>
    <Button variant={variant} block={block} onClick={() => void send()} icon={<Send aria-hidden="true" strokeWidth={1.75} />}>{t('发给家人（大字版）', 'Send to family (large text)')}</Button>
    <span className="family-link__status" role="status">{status}</span>
  </span>;
}
