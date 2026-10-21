import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Image as ImageIcon, Share2 } from 'lucide-react';
import { Button } from './ui/Button';
import { copyText } from '../utils/postShare';
import { editorialShareText, editorialShareUrl, type EditorialShare } from '../lib/editorial-share';
import { translateText, useLocale } from '../i18n/locale';

// The share-card sheet loads when a reader opens it (route JS budgets): most readers never do.
const ShareCardSheet = lazy(() => import('../features/detail/ShareCardSheet'));

/**
 * 分享 · 分享卡片 (detail pages, the freebie board, the reading shelf): two quiet buttons (F's quiet look), then any extra
 * actions of the same row (`children`, e.g. 存入日历 on an event). 分享 uses the phone's share sheet, else copies the text;
 * 分享卡片 opens the card in F's Sheet. `card={false}` leaves the card out (an ended page keeps only 分享).
 */
export function EditorialShareActions({ item, card = true, children }: { item: EditorialShare; card?: boolean; children?: ReactNode }) {
  useLocale();
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [manual, setManual] = useState(false);
  const share = async () => {
    if (busy) return;
    setBusy(true); setNotice(''); setManual(false);
    try {
      if (typeof navigator.share === 'function') {
        try { await navigator.share({ title: translateText(item.title), text: editorialShareText(item), url: editorialShareUrl(item) }); return; }
        catch (error) { if (error instanceof Error && error.name === 'AbortError') return; }
      }
      const copied = await copyText(editorialShareText(item));
      setNotice(copied ? '分享文案已复制，粘贴给朋友就好。' : '请手动复制下方链接。'); setManual(!copied);
    } finally { setBusy(false); }
  };
  return <div className="editorial-share-actions">
    <div className="editorial-share-buttons">
      <Button variant="quiet" onClick={share} disabled={busy} aria-label={`${translateText('分享')}：${translateText(item.title)}`} icon={<Share2 aria-hidden="true" strokeWidth={1.75} />}>{translateText('分享')}</Button>
      {card && <Button variant="quiet" onClick={() => { setOpened(true); setOpen(true); }} aria-label={`${translateText('分享卡片')}：${translateText(item.title)}`} icon={<ImageIcon aria-hidden="true" strokeWidth={1.75} />}>{translateText('分享卡片')}</Button>}
      {children}
    </div>
    {notice && <p role="status">{translateText(notice)}</p>}
    {manual && <input aria-label={translateText('手动复制分享链接')} readOnly value={editorialShareUrl(item)} onFocus={event => event.currentTarget.select()} />}
    {opened && <Suspense fallback={null}><ShareCardSheet item={item} open={open} onClose={() => setOpen(false)} /></Suspense>}
  </div>;
}
