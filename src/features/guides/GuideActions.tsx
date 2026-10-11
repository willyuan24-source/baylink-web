import { useEffect, useState } from 'react';
import { Bookmark, Check, MessageCircle, Send } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useUiCopy } from '../../components/ui/ui-copy';
import type { Guide } from '../../data/guides';
import { guideBayBayQuestion } from './guide-facts';
import { localizedUrl, translateText } from '../../i18n/locale';
import { rememberGuide, toggleSavedGuide, useReaderLibrary } from '../../lib/reader-library';
import { withFamilyReading } from '../../lib/family-reading';
import { SITE_URL } from '../../lib/seo';
import { copyText } from '../../utils/postShare';

/**
 * 收藏 — the guide save that is on main today (the reader library, which My Week's unified list reads). WEB-SAVES replaces
 * this body with `useSave('guide', slug)` (src/lib/saves.ts); lanes/WEB-GUIDES/merge/after-saves.patch is that swap.
 */
function GuideSaveAction({ slug, onStatus }: { slug: string; onStatus: (text: string) => void }) {
  const { t } = useUiCopy();
  const { saved } = useReaderLibrary();
  const isSaved = saved.includes(slug);
  const toggle = () => {
    const result = toggleSavedGuide(slug);
    onStatus(!result.saved ? t('已取消收藏。', 'Removed from saved items.')
      : result.persisted ? t('已收藏。在「我的这周」找回。', 'Saved. Find it in My Week.')
        : t('浏览器未允许保存，刷新后可能丢失。', 'Your browser did not keep this; it may be gone after a refresh.'));
  };
  return <Button variant="tonal" aria-pressed={isSaved} onClick={toggle} icon={isSaved ? <Check aria-hidden="true" strokeWidth={1.75} /> : <Bookmark aria-hidden="true" strokeWidth={1.75} />}>
    {isSaved ? t('已收藏', 'Saved') : t('收藏', 'Save')}
  </Button>;
}

/**
 * The article's three actions in one 48px row (design.md §4.10, GUIDE-10): [收藏] tonal, [发给家人] (a link that opens at
 * 特大 with 简洁显示, product.md §5) and [问 BayBay] with a question about this guide.
 */
export function GuideActions({ guide, onAsk }: { guide: Guide; onAsk?: (question: string) => void }) {
  const { t, locale } = useUiCopy();
  const [status, setStatus] = useState('');
  // The reading history ("最近读过" on /guides?view=saved) stays in this browser.
  useEffect(() => { rememberGuide(guide.slug); }, [guide.slug]);
  const title = translateText(guide.title, locale);
  const sendToFamily = async () => {
    setStatus('');
    const url = withFamilyReading(localizedUrl(`${SITE_URL}/guides/${guide.slug}?from=family`, locale));
    const text = t(`${title}\n大字、简洁版，打开就能看：`, `${title}\nLarge text, simple view:`);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share({ title, text, url }); return; }
      catch (error) { if (error instanceof Error && error.name === 'AbortError') return; }
    }
    const copied = await copyText(`${text}\n${url}`);
    setStatus(copied ? t('链接已复制，发到家庭群就好；家人打开是大字、简洁显示。', 'Link copied. Paste it to your family; it opens in large text and simple view.')
      : t('浏览器未允许复制，请长按地址栏复制链接。', 'Copy was blocked; copy the link from the address bar.'));
  };
  return <div className="gd-actions-wrap">
    <div className="gd-actions" role="group" aria-label={t('文章操作', 'Article actions')}>
      <GuideSaveAction slug={guide.slug} onStatus={setStatus} />
      <Button onClick={() => void sendToFamily()} icon={<Send aria-hidden="true" strokeWidth={1.75} />}>{t('发给家人', 'Send to family')}</Button>
      {onAsk ? <Button onClick={() => onAsk(guideBayBayQuestion(guide, t, title))} icon={<MessageCircle aria-hidden="true" strokeWidth={1.75} />}>{t('问 BayBay', 'Ask BayBay')}</Button>
        : <Button to={`/plan?q=${encodeURIComponent(guideBayBayQuestion(guide, t, title))}`} icon={<MessageCircle aria-hidden="true" strokeWidth={1.75} />}>{t('问 BayBay', 'Ask BayBay')}</Button>}
    </div>
    <p className="gd-actions__status" role="status">{status}</p>
  </div>;
}
