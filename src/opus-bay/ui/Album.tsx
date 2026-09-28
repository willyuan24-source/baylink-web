import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronLeft, ChevronRight, Download, Images, Share2, Trash2, X } from 'lucide-react';
import { toast } from '../core/store';
import type { Bilingual } from '../core/types';
import {
  ALBUM_MAX, albumKind, albumVersion, deletePhoto, listPhotos, photoFile, photosNow, subscribeAlbum, type AlbumPhoto,
} from '../game/album';
import { holdLock } from '../game/playerLock';
import { useT } from '../i18n';
import { useDevice, useWindowKey } from './hooks';
import type { OverlayProps } from './slots';
import './album.css';

/**
 * Wave 5 · lane C · W5-C7: the album sheet (game/album.ts registers it as the overlay `c-album`; the More item 相册
 * and photo mode's thumbnail open it). A grid of the photos taken on this device, newest first; a photo opens large
 * with 保存 · 分享 · 删除. 保存 on a phone that can share files opens the share sheet (iOS: 存储图像 puts it in Photos),
 * elsewhere it downloads the file; 分享 shares the file where the browser can, else downloads it and copies the
 * game's link. The player stays put while it is open (playerLock 'panel').
 */

const ALBUM_TEXT = {
  title: { zh: '相册', en: 'Album' },
  count: (n: number): Bilingual => ({ zh: `${n} 张`, en: n === 1 ? '1 photo' : `${n} photos` }),
  empty: { zh: '还没有照片。点「拍照」拍一张吧～', en: 'No photos yet. Tap Photo to take one~' },
  kept: { zh: `照片存在这台设备的浏览器里（最多 ${ALBUM_MAX} 张）。想长久留着，就点「保存」。`, en: `Photos stay in this browser on this device (up to ${ALBUM_MAX}). Tap Save to keep one for good.` },
  memory: { zh: '这个窗口关掉后照片就没了，喜欢的记得点「保存」。', en: 'These photos go when this window closes — tap Save on the ones you love.' },
  save: { zh: '保存', en: 'Save' },
  share: { zh: '分享', en: 'Share' },
  del: { zh: '删除', en: 'Delete' },
  delAsk: { zh: '删掉这张照片？', en: 'Delete this photo?' },
  delYes: { zh: '删掉', en: 'Delete' },
  delNo: { zh: '留着', en: 'Keep it' },
  back: { zh: '返回相册', en: 'Back to the album' },
  saved: { zh: '照片已保存', en: 'Photo saved' },
  linkCopied: { zh: '照片已保存，游戏链接也复制好了', en: 'Photo saved, and the game link is copied' },
  shareText: { zh: '我在 BAYLINK 的湾区小旅拍的照片', en: 'A photo from my Little Bay Trip on BAYLINK' },
  gone: { zh: '这张照片找不到了', en: 'That photo is gone' },
} satisfies Record<string, Bilingual | ((n: number) => Bilingual)>;

const dateLabel = (at: number, locale: string) => {
  try { return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(at)); } catch { return ''; }
};

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = file.name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Can this browser share this file through the system sheet? */
function canShareFile(file: File): boolean {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  try { return !!nav?.share && !!nav.canShare && nav.canShare({ files: [file] }); } catch { return false; }
}

/** The game's address (shared with a downloaded photo). */
const gameLink = () => (typeof location !== 'undefined' ? `${location.origin}/opus-bay` : 'https://baylink.app/opus-bay');

export default function Album({ props, close }: OverlayProps) {
  const { t, locale } = useT();
  const device = useDevice();
  useSyncExternalStore(subscribeAlbum, albumVersion, albumVersion);
  const [photos, setPhotos] = useState<readonly AlbumPhoto[] | null>(photosNow());
  const asked = (props as { photo?: string } | undefined)?.photo ?? null;
  const [openId, setOpenId] = useState<string | null>(asked);
  const closeRef = useRef<HTMLButtonElement>(null);

  // the player stays put while the album is up (released on every way out: unmount)
  useEffect(() => holdLock('panel', 'album'), []);
  useEffect(() => { let live = true; void listPhotos().then(list => { if (live) setPhotos([...list]); }); return () => { live = false; }; }, []);
  // (a photo added or deleted while open: the list object is the album's own, copied for React)
  useEffect(() => subscribeAlbum(() => { void listPhotos().then(list => setPhotos([...list])); }), []);
  useEffect(() => { setOpenId(asked); }, [asked]);
  useEffect(() => { if (!openId) closeRef.current?.focus({ preventScroll: true }); }, [openId]);

  const list = useMemo(() => photos ?? [], [photos]);
  const index = openId ? list.findIndex(p => p.id === openId) : -1;
  const open = index >= 0 ? list[index] : null;
  const step = useCallback((d: number) => { if (index < 0 || !list.length) return; setOpenId(list[(index + d + list.length) % list.length].id); }, [index, list]);
  useWindowKey(e => {
    if (!open || e.repeat) return;
    if (e.code === 'ArrowLeft') { e.preventDefault(); step(-1); } else if (e.code === 'ArrowRight') { e.preventDefault(); step(1); }
  });

  return (
    <div className="ob-album-wrap" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <section className={`ob-album ${open ? 'is-viewing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="ob-album-title">
        <header className="ob-album-head">
          {open ? (
            <button type="button" className="ob-icon-btn ob-icon-sm" onClick={() => setOpenId(null)} aria-label={t(ALBUM_TEXT.back)}><ChevronLeft size={20} aria-hidden /></button>
          ) : <span className="ob-album-icon" aria-hidden><Images size={18} /></span>}
          <h2 id="ob-album-title">{t(ALBUM_TEXT.title)}{photos && <small> · {t(ALBUM_TEXT.count(list.length))}</small>}</h2>
          <button ref={closeRef} type="button" className="ob-icon-btn ob-icon-sm ob-album-close" onClick={close} aria-label={t('关闭', 'Close')}><X size={20} aria-hidden /></button>
        </header>
        {open ? (
          <Viewer key={open.id} photo={open} count={list.length} onStep={step} onGone={() => setOpenId(null)} touch={device === 'touch'} date={dateLabel(open.at, locale)} />
        ) : (
          <>
            {photos && !list.length && <p className="ob-album-empty">{t(ALBUM_TEXT.empty)}</p>}
            {list.length > 0 && (
              <ul className="ob-album-grid">
                {list.map(p => (
                  <li key={p.id}>
                    <button type="button" onClick={() => setOpenId(p.id)} aria-label={`${p.caption} · ${dateLabel(p.at, locale)}`}>
                      <img src={p.thumbUrl} alt="" loading="lazy" draggable={false} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="ob-album-note">{t(albumKind() === 'memory' ? ALBUM_TEXT.memory : ALBUM_TEXT.kept)}</p>
          </>
        )}
      </section>
    </div>
  );
}

function Viewer({ photo, count, onStep, onGone, touch, date }: { photo: AlbumPhoto; count: number; onStep: (d: number) => void; onGone: () => void; touch: boolean; date: string }) {
  const { t } = useT();
  const [file, setFile] = useState<File | null>(null);
  const [asking, setAsking] = useState(false);
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  // the card itself, loaded when the photo opens (so 保存 / 分享 run inside the tap: iOS shares only from a gesture)
  useEffect(() => {
    let live = true;
    void photoFile(photo.id).then(f => { if (!live) return; if (f) setFile(f); else { toast(t(ALBUM_TEXT.gone), 'info', 2200); onGone(); } });
    return () => { live = false; };
  }, [photo.id, onGone, t]);

  const share = async (asSave: boolean) => {
    if (!file) return;
    if (canShareFile(file) && (touch || !asSave)) {
      try { await navigator.share({ files: [file], title: 'Opus Bay', text: t(ALBUM_TEXT.shareText) }); } catch { /* cancelled */ }
      return;
    }
    download(file);
    if (asSave) { toast(t(ALBUM_TEXT.saved), 'info', 2000); return; }
    let copied: boolean;
    try { await navigator.clipboard?.writeText(`${t(ALBUM_TEXT.shareText)} ${gameLink()}`); copied = !!navigator.clipboard; } catch { copied = false; }
    toast(t(copied ? ALBUM_TEXT.linkCopied : ALBUM_TEXT.saved), 'info', 2600);
  };
  const remove = async () => { setAsking(false); await deletePhoto(photo.id); onGone(); };

  return (
    <div className="ob-album-view">
      <figure>
        <div className="ob-album-photo" style={{ aspectRatio: `${photo.w} / ${photo.h}` }}>
          <img src={url ?? photo.thumbUrl} alt={photo.caption} draggable={false} />
          {count > 1 && (
            <>
              <button type="button" className="ob-album-nav is-prev" onClick={() => onStep(-1)} aria-label={t('上一张', 'Previous')}><ChevronLeft size={22} aria-hidden /></button>
              <button type="button" className="ob-album-nav is-next" onClick={() => onStep(1)} aria-label={t('下一张', 'Next')}><ChevronRight size={22} aria-hidden /></button>
            </>
          )}
        </div>
        <figcaption>{date}</figcaption>
      </figure>
      {asking ? (
        <div className="ob-album-actions is-ask" role="group" aria-label={t(ALBUM_TEXT.delAsk)}>
          <p>{t(ALBUM_TEXT.delAsk)}</p>
          <button type="button" className="ob-btn ob-btn-sm ob-btn-danger" onClick={() => { void remove(); }}>{t(ALBUM_TEXT.delYes)}</button>
          <button type="button" className="ob-btn ob-btn-sm ob-btn-ghost" onClick={() => setAsking(false)}>{t(ALBUM_TEXT.delNo)}</button>
        </div>
      ) : (
        <div className="ob-album-actions">
          <button type="button" className="ob-btn ob-btn-primary" disabled={!file} onClick={() => { void share(true); }}><Download size={17} aria-hidden /><span>{t(ALBUM_TEXT.save)}</span></button>
          <button type="button" className="ob-btn ob-btn-soft" disabled={!file} onClick={() => { void share(false); }}><Share2 size={17} aria-hidden /><span>{t(ALBUM_TEXT.share)}</span></button>
          <button type="button" className="ob-icon-btn ob-album-del" onClick={() => setAsking(true)} aria-label={t(ALBUM_TEXT.del)}><Trash2 size={18} aria-hidden /></button>
        </div>
      )}
    </div>
  );
}
