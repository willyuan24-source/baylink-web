import { useEffect, useState } from 'react';
import { Copy, Download, Image as ImageIcon, Share2, X } from 'lucide-react';
import { ModalShell } from './ui/Modal';
import { copyText } from '../utils/postShare';
import { editorialShareText, editorialShareUrl, shareCardPath, type EditorialShare } from '../lib/editorial-share';
import { translateText, useLocale } from '../i18n/locale';

export function EditorialShareActions({ item }: { item: EditorialShare }) {
  useLocale();
  const [open, setOpen] = useState(false);
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
    <div className="editorial-share-buttons"><button type="button" onClick={share} disabled={busy} aria-label={`${translateText('分享')}：${translateText(item.title)}`}><Share2 size={16} />分享</button><button type="button" onClick={() => setOpen(true)} aria-label={`${translateText('分享卡片')}：${translateText(item.title)}`}><ImageIcon size={16} />分享卡片</button></div>
    {notice && <p role="status">{notice}</p>}
    {manual && <input aria-label="手动复制分享链接" readOnly value={editorialShareUrl(item)} onFocus={event => event.currentTarget.select()} />}
    {open && <EditorialShareSheet item={item} onClose={() => setOpen(false)} />}
  </div>;
}

function EditorialShareSheet({ item, onClose }: { item: EditorialShare; onClose: () => void }) {
  useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imagePath = shareCardPath(item);
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
  return <ModalShell onClose={onClose} label="BAYLINK 分享卡片" className="discovery-modal-backdrop">
    <div className="discovery-modal editorial-share-sheet" onClick={event => event.stopPropagation()}>
      <button type="button" onClick={onClose} className="discovery-modal-close" aria-label="关闭分享卡片"><X size={20} /></button>
      <span className="discovery-eyebrow">BAYLINK · PASS IT ON</span><h2>把有用的湾区，分享出去。</h2>
      <p>卡片带有 BAYLINK 标识和二维码，朋友扫码就能回到这条详情。</p>
      {!imageError ? <img className="editorial-share-preview" src={imagePath} width={1200} height={630} alt={`BAYLINK ${translateText('分享卡片')}：${translateText(item.title)}`} onError={() => setImageError(true)} /> : <div className="discovery-inline-note">卡片暂时无法加载，仍可分享下方链接。</div>}
      <div className="discovery-modal-actions">
        {canShareFile && <button type="button" className="discovery-primary" disabled={busy} onClick={shareFile}><Share2 size={17} />分享图片</button>}
        {!imageError && <a className="discovery-primary" href={imagePath} download={`BAYLINK-${item.id}.png`}><Download size={17} />保存分享卡片</a>}
        <button type="button" onClick={copy}><Copy size={17} />复制文案与链接</button>
      </div>
      <p className="discovery-small">在微信中，可以把保存的卡片发给好友或群聊。日期与条件请以详情页为准。</p>
      {notice && <p role="status">{notice}</p>}
      <label className="discovery-copy-link"><span>{manual ? '手动复制分享链接' : '朋友会打开这个页面'}</span><input readOnly value={editorialShareUrl(item)} onFocus={event => event.currentTarget.select()} /></label>
    </div>
  </ModalShell>;
}
