// 官方推荐（广告位）：侧栏轮播 / 推荐页列表 + 详情弹层 + 管理员编辑
// UI9-R1 (N10 / N11): the tiles, the detail dialog and the admin form read the site tokens through community.css (cm-ad-*):
// tile edge + e1, the --scrim backdrop with no blur, --r-* corners, e2 on the dialogs; the decorative corner blob is gone.
// The tiles are one swipe row whose cards never grow past the row (the phone cut "Airbnb经…" at the right edge). Only the
// community board renders these (and opens the dialog), so its stylesheet is always loaded with them.
import { useState, useEffect } from 'react';
import { X, Megaphone, Plus, Trash2, Copy, ExternalLink } from 'lucide-react';
import { ModalShell } from '../../components/ui/Modal';
import { confirmDialog } from '../../components/ui/confirm';
import { api } from '../../lib/api';
import {
  friendlyErrorMessage, getAdContent, getAdImageUrl, getAdTitle, mapAdSaveError,
  toAdDetailItem, validateAdImageUrl,
} from '../../lib/format';
import type { AdData, AdDetailItem } from '../../lib/types';
import { adRelationshipDisclosure } from '../../lib/ad-disclosure';
import { translateText, useLocale } from '../../i18n/locale';

const HAN = /[㐀-鿿]/;
/** The small muted line the ads use for their notes and disclaimers. */
const NOTE_TEXT = 'cm-ad-note';
/**
 * H50 (I13-13): an ad is its advertiser's own words, in Chinese. On /en its title and text are marked as Chinese
 * (lang="zh-Hans", and translate="no" like every other user-written text), and one short line says it is shown as written.
 */
type AdCopy = { english: boolean; t: (zh: string, en: string) => string };
/**
 * The reader's language, from i18n/locale directly: importing components/ui/ui-copy here changed how the build splits the
 * shared UI chunk, and with it the order of the stylesheets on /events and /calendar (review 10-14).
 */
const useAdCopy = (): AdCopy => {
  const locale = useLocale();
  return { english: locale === 'en', t: (zh, en) => locale === 'en' ? en : translateText(zh, locale) };
};
const adLanguage = ({ english, t }: AdCopy, ...texts: string[]) => {
  const chinese = english && texts.some(text => HAN.test(text));
  return {
    marks: chinese ? { lang: 'zh-Hans', translate: 'no' as const } : {},
    note: chinese ? <span className={`block ${NOTE_TEXT}`} data-ad-original>{t('广告原文', 'Shown in Chinese, as the advertiser wrote it')}</span> : null,
  };
};

/** Existing ads only store title, content and image; use links actually supplied in that content. */
const getContentLinks = (content: string): { url: string; host: string }[] => {
  const candidates = content.match(/https?:\/\/[^\s<>"'，。；！？、）】]+/g) || [];
  const seen = new Set<string>();
  return candidates.flatMap((candidate) => {
    try {
      const url = new URL(candidate.replace(/[.,;!?)\]]+$/, ''));
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || seen.has(url.href)) return [];
      seen.add(url.href);
      return [{ url: url.href, host: url.hostname }];
    } catch { return []; }
  }).slice(0, 3);
};

const AdThumb = ({ src, className, contain }: { src: string; className?: string; contain?: boolean }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={className || 'cm-ad__thumb'} />;
  return <img src={src} alt="" loading="lazy" decoding="async" className={`${className || ''} ${contain ? 'ad-thumb-contain' : ''}`} onError={() => setFailed(true)} />;
};
/** The 推广 label on every tile and in the dialog: each ad still says it is one, under the section's 推广信息 heading. */
const AdLabel = ({ t }: { t: AdCopy['t'] }) => <span className="cm-ad-label">{t('推广', 'Ad')}</span>;

const AdDetailImage = ({ src }: { src: string }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="ad-detail-image-placeholder">图片无法加载</div>;
  return <img src={src} alt="" className="ad-detail-image" onError={() => setFailed(true)} />;
};

export const AdDetailModal = ({ ad, onClose, isAdmin, onDelete }: {
  ad: AdDetailItem;
  onClose: () => void;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
}) => {
  const imageUrl = getAdImageUrl(ad);
  const content = getAdContent(ad);
  const links = getContentLinks(content);
  const copy = useAdCopy();
  const language = adLanguage(copy, getAdTitle(ad), content);
  const [copyMessage, setCopyMessage] = useState('');
  const copyInfo = async () => {
    try {
      await navigator.clipboard.writeText(`${getAdTitle(ad)}\n\n${content}`);
      setCopyMessage(copy.t('推广信息已复制', 'Copied'));
    } catch {
      setCopyMessage(copy.t('复制失败，请长按正文选择并复制', 'Could not copy; press and hold the text to select it'));
    }
  };
  return (
    <ModalShell onClose={onClose} label={copy.t('推广详情', 'Promotion details')} className="cm-ad-dialog">
      <div className="cm-ad-dialog__panel" onClick={(e) => e.stopPropagation()}>
        <div className="cm-ad-dialog__head">
          <h3>{copy.t('推广详情', 'Promotion details')}</h3>
          <button type="button" onClick={onClose} className="ui-icon-button ui-close" aria-label={copy.t('关闭', 'Close')} title={copy.t('关闭', 'Close')}><X aria-hidden="true" strokeWidth={1.75} /></button>
        </div>
        <div className="cm-ad-dialog__body">
          {imageUrl ? <AdDetailImage src={imageUrl} /> : null}
          <div className="cm-ad-dialog__labels">
            <AdLabel t={copy.t} />
            {ad.isDemo && <span className="ui-status" data-tone="neutral">{copy.t('示例推广', 'Sample promotion')}</span>}
          </div>
          <h4 className="cm-ad-dialog__title" {...language.marks}>{getAdTitle(ad)}</h4>
          <p className="cm-ad-dialog__text" {...language.marks}>{content}</p>
          {language.note}
          {adRelationshipDisclosure(ad.id) && <p className="cm-ad-dialog__disclosure">{adRelationshipDisclosure(ad.id)}</p>}
          <p className={NOTE_TEXT}>此处为平台推广展示，可能包含平台关联业务。展示与资料审核不代表执照核验或交易担保；服务资格、费用与合同请向提供者确认。</p>
          {links.length > 0 && (
            <div className="cm-ad-dialog__links">
              {links.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="cm-ad-link">
                  <span>{copy.t('查看提供的链接', 'Open the link they gave')} <span className="cm-ad-link__host">· {link.host}</span></span><ExternalLink aria-hidden="true" strokeWidth={1.75} />
                </a>
              ))}
            </div>
          )}
          <button type="button" onClick={copyInfo} className="ui-button cm-ad-dialog__copy" data-variant="secondary"><Copy aria-hidden="true" strokeWidth={1.75} />{copy.t('复制推广信息', 'Copy the promotion')}</button>
          {copyMessage && <p role="status" className="cm-ad-note">{copyMessage}</p>}
        </div>
        <div className="cm-ad-dialog__foot">
          {isAdmin && !ad.isDemo && onDelete ? <button type="button" onClick={() => onDelete(ad.id)} className="ui-button cm-ad-dialog__delete" data-variant="secondary">{copy.t('删除', 'Delete')}</button> : null}
          <button type="button" onClick={onClose} className="ui-button" data-variant="secondary" data-block="">{copy.t('关闭', 'Close')}</button>
        </div>
      </div>
    </ModalShell>
  );
};

const AdFormModal = ({ editingAd, onClose, onChange, onSave }: {
  editingAd: Partial<AdData>;
  onClose: () => void;
  onChange: (patch: Partial<AdData>) => void;
  onSave: () => void;
}) => (
  // 表单弹层，误触遮罩不关闭（关闭会丢弃草稿）
  <ModalShell onClose={onClose} closeOnBackdrop={false} label="管理推广信息" className="cm-ad-dialog">
    <div className="cm-ad-dialog__panel cm-ad-dialog__panel--form" onClick={(e) => e.stopPropagation()}>
      <div className="cm-ad-dialog__head"><h3>管理推广信息</h3></div>
      <div className="cm-ad-dialog__body cm-ad-form">
        <input className="cm-ad-field" aria-label="标题" placeholder="标题" value={editingAd.title || ''} onChange={(e) => onChange({ title: e.target.value })} />
        <textarea className="cm-ad-field" aria-label="内容描述；可附相关帖子或商家提供的完整 https:// 链接" rows={4} placeholder="内容描述；可附相关帖子或商家提供的完整 https:// 链接" value={editingAd.content || ''} onChange={(e) => onChange({ content: e.target.value })} />
        <input className="cm-ad-field" aria-label="图片直链 URL（可选，需 .jpg/.png/.webp）" placeholder="图片直链 URL（可选，需 .jpg/.png/.webp）" value={editingAd.imageUrl || ''} onChange={(e) => onChange({ imageUrl: e.target.value })} />
      </div>
      <div className="cm-ad-dialog__foot">
        <button type="button" onClick={onClose} className="ui-button" data-variant="secondary">取消</button>
        <button type="button" onClick={onSave} className="ui-button" data-variant="primary">保存发布</button>
      </div>
    </div>
  </ModalShell>
);

/**
 * One promotion tile (the board's row and the list): the picture, the 推广信息 label, the title and two lines of text, the
 * relationship disclosure. The whole tile opens the dialog; the admin's delete sits on its corner.
 */
const AdTile = ({ ad, copy, isAdmin, onOpenDetail, onDelete }: {
  ad: AdData;
  copy: AdCopy;
  isAdmin: boolean;
  onOpenDetail: (ad: AdDetailItem) => void;
  onDelete: (id: string) => void;
}) => {
  const imageUrl = getAdImageUrl(ad);
  const language = adLanguage(copy, getAdTitle(ad), getAdContent(ad));
  return (
    <div
      role="button"
      tabIndex={0}
      className="cm-ad"
      onClick={() => onOpenDetail(toAdDetailItem(ad))}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail(toAdDetailItem(ad)); } }}
    >
      {imageUrl ? <AdThumb src={imageUrl} contain className="cm-ad__thumb" /> : <div className="cm-ad__thumb" />}
      <div className="cm-ad__body">
        <div className="cm-ad__labels">
          <AdLabel t={copy.t} />
          {isAdmin && !isDisplayableAd(ad) && <span className="ui-status" data-tone="neutral">未配图 · 仅管理员可见</span>}
        </div>
        <div className="cm-ad__title" {...language.marks}>{getAdTitle(ad)}</div>
        <div className="cm-ad__text" {...language.marks}>{getAdContent(ad)}</div>
        {language.note}
        {adRelationshipDisclosure(ad.id) && <p className="cm-ad__disclosure">{adRelationshipDisclosure(ad.id)}</p>}
      </div>
      {isAdmin && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(ad.id); }} className="ui-icon-button cm-ad__delete" aria-label="删除推广" title="删除推广">
          <Trash2 aria-hidden="true" strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
};

const ADS_CACHE_TTL = 60_000;
let adsCache: { data: AdData[]; ts: number } | null = null;
const fetchAdsCached = async (force = false): Promise<AdData[]> => {
  if (!force && adsCache && Date.now() - adsCache.ts < ADS_CACHE_TTL) return adsCache.data;
  const data = await api.request('/ads');
  adsCache = { data: Array.isArray(data) ? data : [], ts: Date.now() };
  return adsCache.data;
};

/** 展示质量规则：无配图的推荐不对普通用户展示，管理员仍可看到全部以便管理 */
const isDisplayableAd = (ad: AdData) => !!getAdImageUrl(ad);

export const OfficialAds = ({ isAdmin, showToast, onOpenDetail, refreshKey, layout = 'carousel' }: {
  isAdmin: boolean;
  showToast: any;
  onOpenDetail: (ad: AdDetailItem) => void;
  refreshKey?: number;
  layout?: 'carousel' | 'list';
}) => {
  const copy = useAdCopy();
  const [ads, setAds] = useState<AdData[]>(() => adsCache?.data || []);
  const [adsLoading, setAdsLoading] = useState(() => !adsCache);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Partial<AdData>>({});
  const fetchAds = async (force = false) => {
    try { setAds(await fetchAdsCached(force)); }
    catch (e) { console.error('fetch ads', e); }
    finally { setAdsLoading(false); }
  };
  useEffect(() => { fetchAds(!!refreshKey); }, [refreshKey]);
  const handleSaveAd = async () => {
    if (!editingAd?.title?.trim()) return showToast('请填写标题', 'error');
    const imageUrl = (editingAd.imageUrl || '').trim();
    const imageErr = validateAdImageUrl(editingAd.imageUrl || '');
    if (imageErr) return showToast(imageErr, 'error');
    const payload = {
      title: editingAd.title.trim(),
      content: (editingAd.content || '').trim(),
      imageUrl,
    };
    try {
      await api.request('/ads', { method: 'POST', body: JSON.stringify(payload) });
      setEditingAd({});
      setIsFormOpen(false);
      fetchAds(true);
      showToast('推广已发布', 'success');
    } catch (e: any) {
      showToast(mapAdSaveError(e), 'error');
    }
  };
  const handleDeleteAd = async (id: string) => { if(!(await confirmDialog({ title: '删除推广', message: '确定删除这条推广信息？', confirmText: '删除', danger: true }))) return; try { await api.request(`/ads/${id}`, { method: 'DELETE' }); fetchAds(true); showToast('已删除', 'success'); } catch (e: any) { showToast(friendlyErrorMessage(e, '删除失败，请稍后再试'), 'error'); } };
  const visibleAds = isAdmin ? ads : ads.filter(isDisplayableAd);
  // Only the admin ever sees this empty box (a reader sees no promotions block at all).
  const emptyState = (
    <div className="cm-ad cm-ad--empty">
      <p className="cm-ad__title">本地推广信息</p>
      <p className={NOTE_TEXT}>平台选择展示的本地信息会出现在这里。资料审核与推荐展示分别处理，审核通过不保证入选，也不代表平台担保交易。</p>
    </div>
  );
  const loadingState = <div className="cm-ads__track" aria-hidden="true"><span className="ui-skeleton cm-ad cm-ad--loading" /></div>;

  // WEB-COMMUNITY (D20): a reader is not shown an empty promotions box; the admin still sees it and its 添加 button.
  if (!isAdmin && !adsLoading && visibleAds.length === 0) return null;
  return (
    <section className="cm-ads" data-layout={layout} aria-labelledby={layout === 'carousel' ? 'cm-ads-title' : undefined} aria-label={layout === 'list' ? '推广信息列表' : undefined}>
      {(layout === 'carousel' || isAdmin) && <div className="cm-ads__head">
        {layout === 'carousel' && <h2 id="cm-ads-title" className="cm-board__subhead"><Megaphone aria-hidden="true" strokeWidth={1.75} />{copy.t('推广信息', 'Promotions')}</h2>}
        {isAdmin && (
          <button type="button" onClick={() => { setEditingAd({ title: '', content: '', imageUrl: '' }); setIsFormOpen(true); }} className="ui-button" data-variant="secondary">
            <Plus aria-hidden="true" strokeWidth={1.75} />添加
          </button>
        )}
      </div>}
      {adsLoading ? loadingState : visibleAds.length > 0 ? (
        <div className="cm-ads__track">
          {visibleAds.map((ad) => <AdTile key={ad.id} ad={ad} copy={copy} isAdmin={isAdmin} onOpenDetail={onOpenDetail} onDelete={handleDeleteAd} />)}
        </div>
      ) : emptyState}
      {isFormOpen && (
        <AdFormModal
          editingAd={editingAd}
          onClose={() => { setIsFormOpen(false); setEditingAd({}); }}
          onChange={(patch) => setEditingAd((p) => ({ ...p, ...patch }))}
          onSave={handleSaveAd}
        />
      )}
    </section>
  );
};
