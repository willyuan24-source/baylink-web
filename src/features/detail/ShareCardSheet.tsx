import { useEffect, useState } from 'react';
import { Copy, Download, Share2 } from 'lucide-react';
import { Sheet } from '../../components/ui/Sheet';
import './detail-sheet.css';
import { Button } from '../../components/ui/Button';
import { copyText } from '../../utils/postShare';
import { editorialShareText, editorialShareUrl, shareCardPath, type EditorialShare } from '../../lib/editorial-share';
import { translateText, useLocale } from '../../i18n/locale';

/**
 * 分享卡片 (UI9-DETAIL): the share card in F's Sheet (bottom sheet on a phone, drawer on a desktop; enter and exit motion,
 * the scrim, e2, one close button, no blur). Loaded on its own when a reader opens it (EditorialShareActions), so the
 * pages with share buttons do not carry it. The card is in the reader's language: its text and its QR (the page in that
 * language).
 */
export default function ShareCardSheet({ item, open, onClose }: { item: EditorialShare; open: boolean; onClose: () => void }) {
  const locale = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imagePath = shareCardPath(item, locale);
  useEffect(() => {
    const controller = new AbortController();
    fetch(imagePath, { signal: controller.signal }).then(async response => {
      if (!response.ok || !response.headers.get('content-type')?.includes('image/png')) throw new Error('Card unavailable');
      const blob = await response.blob();
      if (!controller.signal.aborted) setFile(new File([blob], `BAYLINK-${item.id}.png`, { type: 'image/png' }));
    }).catch(() => { if (!controller.signal.aborted) setImageError(true); });
    return () => controller.abort();
  }, [imagePath, item.id]);
  const copy = async () => { const copied = await copyText(editorialShareText(item)); setManual(!copied); setNotice(copied ? '分享文案已复制，粘贴给朋友就好。' : '请手动复制下方链接。'); };
  const shareFile = async () => {
    if (!file || busy || imageError) return;
    setBusy(true);
    try {
      await navigator.share({ files: [file], title: translateText(item.title), text: editorialShareText(item) });
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setNotice('此设备未能分享图片，请保存卡片后发送。');
    } finally { setBusy(false); }
  };
  let canShareFile = false;
  try { canShareFile = !imageError && !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }); } catch { /* Download remains available. */ }
  return <Sheet open={open} onClose={onClose} title={translateText('BAYLINK 分享卡片')} className="detail-sheet">
    <p className="detail-sheet__lede">{translateText('卡片带有 BAYLINK 标识和二维码，朋友扫码就能回到这条详情。')}</p>
    {!imageError ? <img className="editorial-share-preview" src={imagePath} width={1200} height={630} alt={`BAYLINK ${translateText('分享卡片')}：${translateText(item.title)}`} onError={() => setImageError(true)} /> : <p className="detail-sheet__note">{translateText('卡片暂时无法加载，仍可分享下方链接。')}</p>}
    <div className="detail-sheet__actions">
      {canShareFile && <Button variant="primary" disabled={busy} onClick={shareFile} icon={<Share2 aria-hidden="true" strokeWidth={1.75} />}>{translateText('分享图片')}</Button>}
      {!imageError && <Button variant={canShareFile ? 'secondary' : 'primary'} href={imagePath} download={`BAYLINK-${item.id}.png`} icon={<Download aria-hidden="true" strokeWidth={1.75} />}>{translateText('保存分享卡片')}</Button>}
      <Button variant="secondary" onClick={copy} icon={<Copy aria-hidden="true" strokeWidth={1.75} />}>{translateText('复制文案与链接')}</Button>
    </div>
    <p className="detail-sheet__small">{translateText('在微信中，可以把保存的卡片发给好友或群聊。日期与条件请以详情页为准。')}</p>
    {notice && <p role="status">{translateText(notice)}</p>}
    <label className="detail-sheet__copy"><span>{translateText(manual ? '手动复制分享链接' : '朋友会打开这个页面')}</span><input readOnly value={editorialShareUrl(item)} onFocus={event => event.currentTarget.select()} /></label>
  </Sheet>;
}
