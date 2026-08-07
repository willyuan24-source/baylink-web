// 官方推荐（广告位）：侧栏轮播 / 推荐页列表 + 详情弹层 + 管理员编辑
import { useState, useEffect } from 'react';
import { X, Shield, BadgeCheck, Plus, Trash2 } from 'lucide-react';
import { ModalShell } from '../../components/ui/Modal';
import { confirmDialog } from '../../components/ui/confirm';
import { api } from '../../lib/api';
import {
  friendlyErrorMessage, getAdContent, getAdImageUrl, getAdTitle, mapAdSaveError,
  toAdDetailItem, validateAdImageUrl,
} from '../../lib/format';
import type { AdData, AdDetailItem } from '../../lib/types';

const AdThumb = ({ src, className, contain }: { src: string; className?: string; contain?: boolean }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={`bg-baylink-section shrink-0 ${className || 'w-14 h-14 rounded-xl'}`} />;
  return <img src={src} alt="" loading="lazy" decoding="async" className={`${className || ''} ${contain ? 'ad-thumb-contain' : ''}`} onError={() => setFailed(true)} />;
};

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
  return (
    <ModalShell onClose={onClose} label="推荐详情" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm">
      <div
        className="flex w-full max-w-[calc(100vw-32px)] max-h-[86vh] flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl sm:max-w-[520px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex shrink-0 items-center justify-between border-b border-baylink-border/40 px-5 py-4">
          <h3 className="text-lg font-bold text-baylink-text pr-8">推荐详情</h3>
          <button type="button" onClick={onClose} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-baylink-muted hover:bg-baylink-section" aria-label="关闭"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {imageUrl ? <AdDetailImage src={imageUrl} /> : null}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-0.5 rounded-md bg-baylink-green-light px-2 py-0.5 text-[10px] font-semibold text-baylink-green">
              <Shield size={10} /> 官方推荐
            </span>
            {ad.isDemo && <span className="rounded-md bg-baylink-section px-2 py-0.5 text-[10px] text-baylink-muted">示例推荐</span>}
          </div>
          <h4 className="mt-2 text-xl font-bold leading-snug text-baylink-text">{getAdTitle(ad)}</h4>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-baylink-text-secondary">{getAdContent(ad)}</p>
        </div>
        <div className="shrink-0 border-t border-baylink-border/40 px-5 py-4">
          {isAdmin && !ad.isDemo && onDelete ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => onDelete(ad.id)} className="flex-1 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600">删除</button>
              <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-700">关闭</button>
            </div>
          ) : (
            <button type="button" onClick={onClose} className="w-full rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-800">关闭</button>
          )}
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
  <ModalShell onClose={onClose} closeOnBackdrop={false} label="管理官方推荐" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <h3 className="mb-4 text-lg font-bold">管理官方推荐</h3>
      <div className="space-y-3">
        <input className="w-full rounded-xl border bg-gray-50 p-3 text-sm" placeholder="标题" value={editingAd.title || ''} onChange={(e) => onChange({ title: e.target.value })} />
        <textarea className="h-24 w-full resize-none rounded-xl border bg-gray-50 p-3 text-sm" placeholder="内容描述" value={editingAd.content || ''} onChange={(e) => onChange({ content: e.target.value })} />
        <input className="w-full rounded-xl border bg-gray-50 p-3 text-sm" placeholder="图片直链 URL（可选，需 .jpg/.png/.webp）" value={editingAd.imageUrl || ''} onChange={(e) => onChange({ imageUrl: e.target.value })} />
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-600">取消</button>
          <button type="button" onClick={onSave} className="flex-1 rounded-xl bg-gray-900 py-3 text-sm font-bold text-white">保存发布</button>
        </div>
      </div>
    </div>
  </ModalShell>
);

const OfficialAdListCard = ({ ad, isAdmin, onOpenDetail, onDelete }: {
  ad: AdData;
  isAdmin: boolean;
  onOpenDetail: (ad: AdDetailItem) => void;
  onDelete: (id: string) => void;
}) => {
  const imageUrl = getAdImageUrl(ad);
  return (
    <div
      role="button"
      tabIndex={0}
      className="relative flex w-full cursor-pointer gap-3 overflow-hidden rounded-2xl border border-baylink-border/60 bg-white p-3.5 shadow-card transition hover:border-baylink-green/25 active:scale-[0.995] sm:rounded-3xl"
      onClick={() => onOpenDetail(toAdDetailItem(ad))}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail(toAdDetailItem(ad)); } }}
    >
      {imageUrl ? (
        <AdThumb src={imageUrl} contain className="h-[88px] w-[88px] shrink-0 rounded-xl sm:h-24 sm:w-24" />
      ) : (
        <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-xl bg-baylink-section sm:h-24 sm:w-24">
          <BadgeCheck size={22} className="text-baylink-muted/40" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
        <span className="mb-1 inline-flex w-fit items-center gap-0.5 rounded-md bg-baylink-green-light px-1.5 py-0.5 text-[9px] font-semibold text-baylink-green">
          <Shield size={8} /> 官方推荐
        </span>
        <div className="line-clamp-2 text-[14px] font-bold leading-snug text-baylink-text">{getAdTitle(ad)}</div>
        <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-baylink-muted">{getAdContent(ad)}</div>
      </div>
      {isAdmin && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(ad.id); }} className="absolute right-2.5 top-2.5 rounded-full bg-white p-1.5 text-red-500 shadow-sm">
          <Trash2 size={14} />
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
      showToast('推荐已发布', 'success');
    } catch (e: any) {
      showToast(mapAdSaveError(e), 'error');
    }
  };
  const handleDeleteAd = async (id: string) => { if(!(await confirmDialog({ title: '删除推荐', message: '确定删除这条推荐？', confirmText: '删除', danger: true }))) return; try { await api.request(`/ads/${id}`, { method: 'DELETE' }); fetchAds(true); showToast('已删除', 'success'); } catch (e: any) { showToast(friendlyErrorMessage(e, '删除失败，请稍后再试'), 'error'); } };
  const visibleAds = isAdmin ? ads : ads.filter(isDisplayableAd);
  const emptyState = (
    <div className="w-full rounded-2xl border border-baylink-border/50 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-baylink-green-light"><BadgeCheck size={16} className="text-baylink-green" /></span>
        <p className="text-xs font-semibold text-baylink-text">认证商家推荐位</p>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-baylink-muted">通过官方认证的本地服务商会展示在这里。想让你的服务被更多湾区邻居看到？可以在「我的」页面申请官方认证。</p>
    </div>
  );
  const loadingState = (
    <div className="w-full space-y-2">
      {[0, 1].map((i) => (
        <div key={i} className="h-16 w-full animate-pulse rounded-2xl border border-baylink-border/40 bg-baylink-section/40" />
      ))}
    </div>
  );

  return (
    <div className={layout === 'list' ? 'w-full' : 'mb-6'}>
      <div className={`flex items-center justify-between px-1 ${layout === 'list' ? 'mb-4' : 'mb-3'}`}>
        {layout === 'carousel' ? (
          <h3 className="flex items-center gap-1 text-sm font-bold text-baylink-text"><BadgeCheck size={14} className="text-baylink-green" /> 官方推荐</h3>
        ) : (
          <span className="sr-only">官方推荐列表</span>
        )}
        {isAdmin && (
          <button type="button" onClick={() => { setEditingAd({ title: '', content: '', imageUrl: '' }); setIsFormOpen(true); }} className="flex items-center gap-1 rounded-lg bg-baylink-green px-2.5 py-1.5 text-[10px] font-semibold text-white transition hover:bg-baylink-green-hover sm:text-xs">
            <Plus size={12} /> 添加
          </button>
        )}
      </div>
      {adsLoading ? loadingState : visibleAds.length > 0 ? (
        layout === 'list' ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {visibleAds.map((ad) => (
              <OfficialAdListCard key={ad.id} ad={ad} isAdmin={isAdmin} onOpenDetail={onOpenDetail} onDelete={handleDeleteAd} />
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar snap-x px-1">
            {visibleAds.map((ad) => (
              <div
                key={ad.id}
                role="button"
                tabIndex={0}
                className="group relative flex min-w-[240px] shrink-0 cursor-pointer snap-center gap-3 overflow-hidden rounded-2xl border border-baylink-border/60 bg-white p-3 shadow-card transition hover:border-baylink-green/30"
                onClick={() => onOpenDetail(toAdDetailItem(ad))}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail(toAdDetailItem(ad)); } }}
              >
                <div className="absolute -right-5 -top-5 h-16 w-16 rounded-bl-full bg-baylink-green-light" />
                {getAdImageUrl(ad) && <AdThumb src={getAdImageUrl(ad)} contain className="z-10 h-14 w-14 shrink-0 rounded-xl" />}
                <div className="z-10 flex min-w-0 flex-1 flex-col justify-center">
                  <div className="mb-1 flex items-center gap-1">
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-baylink-green-light px-1.5 py-0.5 text-[9px] font-semibold text-baylink-green"><Shield size={8} /> 官方</span>
                    {isAdmin && !isDisplayableAd(ad) && (
                      <span className="inline-flex rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">未配图 · 仅管理员可见</span>
                    )}
                  </div>
                  <div className="mb-0.5 line-clamp-1 text-sm font-semibold text-baylink-text">{getAdTitle(ad)}</div>
                  <div className="line-clamp-1 text-[10px] text-baylink-muted">{getAdContent(ad)}</div>
                </div>
                {isAdmin && <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteAd(ad.id); }} className="absolute right-2 top-2 z-20 rounded-full bg-white p-1 text-red-500 shadow-sm"><Trash2 size={12} /></button>}
              </div>
            ))}
          </div>
        )
      ) : emptyState}
      {isFormOpen && (
        <AdFormModal
          editingAd={editingAd}
          onClose={() => { setIsFormOpen(false); setEditingAd({}); }}
          onChange={(patch) => setEditingAd((p) => ({ ...p, ...patch }))}
          onSave={handleSaveAd}
        />
      )}
    </div>
  );
};
