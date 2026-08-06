// 发布 / 编辑信息弹层（3 步向导）+ 默认封面选择器
import React, { useState } from 'react';
import { X, CheckCircle, Loader2, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import {
  CATEGORIES, DEFAULT_COVERS, MAX_POST_IMAGES, REGIONS,
  buildSubmitImageUrls, findDefaultCoverFromUrl, getRecommendedCovers,
  resolveCityFromDraft, splitPostImages,
} from '../../lib/constants';
import { getPostWritingHints, mapPostSaveError, validatePostForm } from '../../lib/format';
import type { DefaultCover, PostData, PostType, UserData } from '../../lib/types';
import { getCategoryFromSlug, getSlugFromCategory } from '../../routing';
import { BayBayPostAssist, type AiPostDraft } from '../../components/BayBayPostAssist';
import {
  ContactPreferenceForm, defaultContactPreference,
  type ContactMethodField, type ContactPreferenceValue,
} from '../../components/ContactPreferenceForm';
import { analyzeContactsInText } from '../../utils/contactDetection';
import {
  compressImageFile, fileToDataUrl, isLikelyImageFile,
  MAX_IMAGE_UPLOAD_BYTES, UnsupportedImageError,
} from '../../utils/imageCompression';

const DefaultCoverPicker = ({
  type,
  category,
  selected,
  onSelect,
  expanded,
  onToggleExpanded,
  open,
  onToggleOpen,
}: {
  type: PostType;
  category: string;
  selected: DefaultCover | null;
  onSelect: (cover: DefaultCover | null) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  open: boolean;
  onToggleOpen: () => void;
}) => {
  const { recommended, others } = getRecommendedCovers(type, category);
  const displayCovers = expanded ? [...recommended, ...others] : recommended.slice(0, 4);

  const toggleCover = (cover: DefaultCover) => {
    onSelect(selected?.id === cover.id ? null : cover);
  };

  return (
    <div className="rounded-xl border border-baylink-border/50 bg-white p-3">
      <p className="text-[11px] font-semibold text-baylink-text">没有照片？选择默认封面</p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-baylink-muted">适合求租、找室友、接送、清洁、二手等信息，一键配图更容易被看到。</p>
      {selected && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-baylink-green-light/30 p-2">
          <img src={selected.url} alt={selected.title} className="h-12 w-12 shrink-0 rounded-lg object-contain bg-baylink-section/50" />
          <span className="min-w-0 flex-1 text-[11px] font-semibold text-baylink-text">已选：{selected.title}</span>
          <button type="button" onClick={() => onSelect(null)} className="shrink-0 text-[10px] font-semibold text-baylink-muted hover:text-red-500">清除封面</button>
        </div>
      )}
      <button type="button" onClick={onToggleOpen} className="mt-2 w-full rounded-lg border border-baylink-border/60 bg-baylink-section/40 py-2 text-xs font-semibold text-baylink-text transition hover:border-baylink-green/40">
        {open ? '收起封面' : '选择默认封面'}
      </button>
      {open && (
        <div className="mt-3">
          <p className="mb-2 text-[10px] font-semibold text-baylink-muted">推荐封面</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {displayCovers.map((cover) => {
              const isSelected = selected?.id === cover.id;
              return (
                <button
                  key={cover.id}
                  type="button"
                  onClick={() => toggleCover(cover)}
                  className={`relative overflow-hidden rounded-xl border-2 bg-white p-1 shadow-sm transition ${isSelected ? 'border-baylink-green ring-1 ring-baylink-green/30' : 'border-baylink-border/50 hover:border-baylink-green/35'}`}
                >
                  <img src={cover.url} alt={cover.title} loading="lazy" decoding="async" className="aspect-[4/3] w-full rounded-lg object-contain bg-baylink-section/40" />
                  <p className="mt-1 truncate px-0.5 text-center text-[9px] font-medium text-baylink-text-secondary">{cover.title}</p>
                  {isSelected && (
                    <span className="absolute right-1 top-1 rounded-md bg-baylink-green px-1 py-px text-[8px] font-bold text-white">已选择</span>
                  )}
                </button>
              );
            })}
          </div>
          {!expanded && others.length > 0 && (
            <button type="button" onClick={onToggleExpanded} className="mt-2 w-full text-center text-[10px] font-semibold text-baylink-green">
              查看更多封面（共 {DEFAULT_COVERS.length} 张）
            </button>
          )}
          {expanded && (
            <button type="button" onClick={onToggleExpanded} className="mt-2 w-full text-center text-[10px] font-semibold text-baylink-muted">
              收起全部封面
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const CONTACT_METHOD_TYPES = ['wechat', 'phone', 'email', 'other'] as const;

const mergeContactMethod = (
  base: ContactMethodField,
  found?: { type?: string; label?: string; value?: string; note?: string; enabled?: boolean },
): ContactMethodField => {
  if (!found) return base;
  const type = CONTACT_METHOD_TYPES.includes(found.type as ContactMethodField['type'])
    ? (found.type as ContactMethodField['type'])
    : base.type;
  return {
    ...base,
    type,
    label: found.label || base.label,
    value: found.value || '',
    note: found.note || '',
    enabled: !!found.value,
  };
};

export const CreatePostModal = ({ onClose, onCreated, onUpdated, user, showToast, defaultType = 'client', defaultCategory, mode = 'create', editingPost }: {
  onClose: () => void;
  onCreated: () => void;
  onUpdated?: () => void;
  user: UserData;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  defaultType?: PostType;
  defaultCategory?: string;
  mode?: 'create' | 'edit';
  editingPost?: PostData | null;
}) => {
  const isEdit = mode === 'edit' && !!editingPost;
  const [step, setStep] = useState(isEdit ? 2 : 1);
  const [form, setForm] = useState(() => isEdit && editingPost ? {
    title: editingPost.title,
    city: editingPost.city || REGIONS[0],
    category: editingPost.category || CATEGORIES[0],
    budget: editingPost.budget || '',
    description: editingPost.description || '',
    timeInfo: editingPost.timeInfo || '',
    type: editingPost.type,
    contactInfo: user?.contactValue || '',
  } : {
    title: '', city: REGIONS[0],
    category: (defaultCategory && CATEGORIES.includes(defaultCategory) ? defaultCategory : CATEGORIES[0]),
    budget: '', description: '', timeInfo: '',
    type: (defaultType || 'client') as PostType, contactInfo: user?.contactValue || '',
  });
  const [contactPreference, setContactPreference] = useState<ContactPreferenceValue>(() => {
    if (isEdit && editingPost?.contactPreference) {
      return {
        mode: editingPost.contactPreference.mode || 'dm_first',
        methods: defaultContactPreference().methods.map((m) =>
          mergeContactMethod(m, editingPost.contactPreference?.methods?.find((x) => x.type === m.type)),
        ),
      };
    }
    return defaultContactPreference();
  });
  const [contactWarningDismissed, setContactWarningDismissed] = useState(false);
  const contactAnalysis = analyzeContactsInText(form.description);
  const showContactWarning = contactAnalysis.hasContact && !contactWarningDismissed;
  const initialImg = isEdit && editingPost?.imageUrls ? splitPostImages(editingPost.imageUrls) : { uploaded: [], cover: null as DefaultCover | null };
  const [uploadedImages, setUploadedImages] = useState<string[]>(initialImg.uploaded);
  const [selectedDefaultCover, setSelectedDefaultCover] = useState<DefaultCover | null>(initialImg.cover);
  const [coversPickerOpen, setCoversPickerOpen] = useState(false);
  const [coversExpanded, setCoversExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [postTrustWarning, setPostTrustWarning] = useState<string | null>(null);
  const [antiSpamAnswer, setAntiSpamAnswer] = useState('');
  const [imageCompressing, setImageCompressing] = useState(false);
  const [imageCompressHint, setImageCompressHint] = useState<string | null>(null);

  const isClient = form.type === 'client';
  const isAdmin = user?.role === 'admin';
  const hints = getPostWritingHints(form.category, form.type);
  const budgetPlaceholder = isClient ? '预算 / 可支付金额（如: $50/小时）' : '价格 / 收费方式（如: $80起 / 按小时）';

  const typeCardClass = (selected: boolean) =>
    selected ? 'border-baylink-green bg-baylink-green-light text-[#2d6b4f] shadow-sm'
      : 'border-baylink-border bg-white text-baylink-text-secondary hover:border-baylink-green/35';
  const categoryClass = (active: boolean) => active ? 'chip chip-active' : 'chip chip-inactive';

  const addTagToDesc = (tag: string) => {
    setForm((prev) => ({ ...prev, description: prev.description ? `${prev.description} #${tag} ` : `#${tag} ` }));
  };

  const appendQuickTagsToDescription = (description: string, tags: string[]) => {
    const normalized = tags
      .map((t) => String(t).replace(/\s+/g, '').replace(/^#/, '').trim())
      .filter(Boolean)
      .slice(0, 5);
    let desc = description.trim();
    const missing = normalized.filter((tag) => !new RegExp(`#${tag}\\b`, 'i').test(desc));
    if (missing.length === 0) return desc;
    const suffix = missing.map((t) => `#${t}`).join(' ');
    return `${desc}\n\n${suffix}`.trim();
  };

  const applyAiDraft = (draft: AiPostDraft, options?: { appendQuickTags?: boolean }) => {
    setForm((prev) => {
      const next = { ...prev };
      if (draft.title?.trim()) next.title = draft.title.trim();
      let description = draft.description?.trim() || '';
      if (options?.appendQuickTags && draft.quickTags?.length) {
        description = appendQuickTagsToDescription(description, draft.quickTags);
      }
      if (description) next.description = description;
      if (draft.type === 'client' || draft.type === 'provider') next.type = draft.type;
      const catLabel = getCategoryFromSlug(draft.category);
      if (catLabel && catLabel !== '全部' && CATEGORIES.includes(catLabel)) next.category = catLabel;
      if (draft.budget?.trim()) next.budget = draft.budget.trim();
      if (draft.timeInfo?.trim()) next.timeInfo = draft.timeInfo.trim();
      next.city = resolveCityFromDraft(draft, prev.city);
      return next;
    });
    if (uploadedImages.length === 0 && draft.coverSuggestion?.startsWith('/default-covers/')) {
      const cover = findDefaultCoverFromUrl(draft.coverSuggestion);
      if (cover) setSelectedDefaultCover(cover);
    }
    showToast('BayBay 已帮你填好草稿，你可以继续修改后发布', 'success');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const files = input.files;
    if (!files?.length) return;

    const remaining = MAX_POST_IMAGES - uploadedImages.length;
    if (remaining <= 0) {
      showToast('最多上传 5 张照片', 'error');
      input.value = '';
      return;
    }

    const fileList = Array.from(files);
    const willTruncate = fileList.length > remaining;

    setImageCompressing(true);
    setImageCompressHint('图片处理中...');

    const newImages: string[] = [];
    let anyCompressed = false;

    try {
      for (const file of fileList.slice(0, remaining)) {
        if (!isLikelyImageFile(file)) continue;

        if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
          showToast('图片过大，请换一张或截图后上传', 'error');
          continue;
        }

        try {
          const result = await compressImageFile(file);
          if (result.compressed) anyCompressed = true;
          const dataUrl = await fileToDataUrl(result.file);
          newImages.push(dataUrl);
        } catch (err) {
          if (err instanceof UnsupportedImageError) {
            showToast(err.message, 'error');
            continue;
          }
          console.warn('[CreatePost] image compress/read failed, using original', err);
          try {
            const dataUrl = await fileToDataUrl(file);
            newImages.push(dataUrl);
          } catch { /* skip broken file */ }
        }
      }

      if (newImages.length > 0) {
        setUploadedImages((prev) => [...prev, ...newImages].slice(0, MAX_POST_IMAGES));
      }

      if (willTruncate) {
        showToast('最多上传 5 张照片', 'error');
      }

      setImageCompressHint(anyCompressed ? '图片已优化，上传更快' : null);
    } finally {
      setImageCompressing(false);
      input.value = '';
    }
  };

  const handleSubmit = async () => {
    const err = validatePostForm(form);
    if (err) return showToast(err, 'error');
    if (!isEdit && !isAdmin && antiSpamAnswer !== '旧金山湾区') {
      return showToast('请先完成验证', 'error');
    }
    setSubmitting(true);
    const finalImageUrls = buildSubmitImageUrls(uploadedImages, selectedDefaultCover);
    const payload = { ...form, imageUrls: finalImageUrls, contactPreference };
    try {
      if (isEdit && editingPost) {
        await api.request(`/posts/${editingPost.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        onUpdated?.();
        onCreated();
        showToast('信息已更新', 'success');
        onClose();
      } else {
        const res = await api.request('/posts', { method: 'POST', body: JSON.stringify(payload) });
        onCreated();
        const warning = typeof res?.trustWarning === 'string' ? res.trustWarning : null;
        setPostTrustWarning(warning);
        setIsSuccess(true);
        if (warning) showToast(warning, 'info');
      }
    } catch (err: any) {
      const toastMsg = mapPostSaveError(err, isEdit);
      if (/image|upload|图片/i.test(err?.error || '')) showToast('图片上传失败，请换一张图', 'error');
      else showToast(toastMsg, 'error');
      setSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      // zoom 只放在内层卡片：整个遮罩层缩放会在入场瞬间露出四周未变暗的屏幕边缘
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative m-4 w-full max-w-sm overflow-hidden rounded-[28px] border border-black/[0.04] bg-baylink-bg-alt/95 p-8 text-center shadow-elevated backdrop-blur-xl animate-in zoom-in-95 fade-in duration-200">
           <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-baylink-green-light text-baylink-green">
              <CheckCircle size={36} />
           </div>
           <h2 className="mb-2 text-xl font-bold text-baylink-text">发布成功</h2>
           <p className="mb-4 text-sm text-baylink-muted">你的信息已推送给湾区邻居们。</p>
           {postTrustWarning && (
             <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs leading-relaxed text-amber-800">
               {postTrustWarning}
             </p>
           )}
           <button onClick={onClose} className="w-full py-3.5 btn-primary">知道了</button>
        </div>
      </div>
    );
  }

  const goToStep3 = () => {
    const err = validatePostForm(form);
    if (err) return showToast(err, 'error');
    setStep(3);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[70]">
      <div className="bg-baylink-bg w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto pb-safe-bar shadow-2xl border border-baylink-border/40">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-lg font-bold text-baylink-text">{isEdit ? '编辑信息' : '发布信息'}</h3>
            <span className="text-[11px] text-baylink-muted">Step {step}/3</span>
          </div>
          <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-baylink-section border border-baylink-border/50"><X size={18} className="text-baylink-muted"/></button>
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-baylink-text mb-0.5">你想发布什么？</label>
              <p className="text-[11px] text-baylink-muted mb-3">选择后，我们会帮你匹配更合适的展示方式</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setForm({...form, type: 'client'})}
                  className={`flex-1 p-3.5 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${typeCardClass(form.type==='client')}`}
                >
                  {form.type === 'client' && <span className="text-[9px] font-semibold bg-baylink-green/15 text-baylink-green px-1.5 py-px rounded mb-1.5 inline-block">当前选择</span>}
                  <div className="text-sm font-bold leading-tight">发布需求</div>
                  <div className="text-[11px] mt-1 opacity-90 leading-snug">找房、找人帮忙、找服务</div>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({...form, type: 'provider'})}
                  className={`flex-1 p-3.5 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${typeCardClass(form.type==='provider')}`}
                >
                  {form.type === 'provider' && <span className="text-[9px] font-semibold bg-baylink-green/15 text-baylink-green px-1.5 py-px rounded mb-1.5 inline-block">当前选择</span>}
                  <div className="text-sm font-bold leading-tight">提供资源</div>
                  <div className="text-[11px] mt-1 opacity-90 leading-snug">房源、二手、服务、接送</div>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-baylink-text mb-2">选择分类</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button key={c} type="button" onClick={() => setForm({...form, category: c})} className={categoryClass(form.category===c)}>{c}</button>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => setStep(2)} className="w-full py-3.5 btn-primary mt-2">下一步</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <BayBayPostAssist
              postType={form.type}
              categorySlug={getSlugFromCategory(form.category)}
              areaHint={form.city}
              user={user}
              showToast={showToast}
              onApply={applyAiDraft}
              requestAiAssist={(body) =>
                api.request('/ai/post-assist', { method: 'POST', body: JSON.stringify(body) })
              }
            />
            <div>
              <div className="mb-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0 px-0.5">
                <span className="text-[11px] font-semibold text-baylink-text">帖子标题</span>
                <span className="text-[10px] text-baylink-muted">一句话说清楚需求或服务</span>
              </div>
              <input
                className="w-full p-4 bg-white rounded-xl font-semibold text-base outline-none border border-baylink-border/60 placeholder:text-baylink-muted focus:border-baylink-green/40 focus:ring-1 focus:ring-baylink-green/10"
                placeholder={hints.titlePlaceholder}
                value={form.title}
                maxLength={80}
                onChange={e => setForm({...form, title: e.target.value})}
              />
            </div>
            {hints.quickTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {hints.quickTags.map((tag) => (
                  <button key={tag} type="button" onClick={() => addTagToDesc(tag)} className="text-[10px] bg-white text-baylink-text-secondary px-2 py-1 rounded-md border border-baylink-border hover:border-baylink-green/40 hover:bg-baylink-green-light/50 active:scale-95 transition">#{tag}</button>
                ))}
              </div>
            )}
            {hints.checklist.length > 0 && (
              <p className="text-[10px] text-baylink-muted leading-relaxed px-0.5">建议包含：{hints.checklist.join('、')}</p>
            )}
            <div>
              <div className="mb-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0 px-0.5">
                <span className="text-[11px] font-semibold text-baylink-text">详细内容</span>
                <span className="text-[10px] text-baylink-muted">补充位置、价格、时间、联系方式等</span>
              </div>
              <textarea
                className="w-full p-4 bg-white rounded-xl h-36 resize-none outline-none border border-baylink-border/60 placeholder:text-baylink-muted text-sm leading-relaxed focus:border-baylink-green/40 focus:ring-1 focus:ring-baylink-green/10"
                placeholder={hints.descriptionPlaceholder}
                value={form.description}
                maxLength={2000}
                onChange={e => { setForm({ ...form, description: e.target.value }); setContactWarningDismissed(false); }}
              />
            </div>
            {showContactWarning && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-[11px] leading-relaxed text-amber-900">
                  为了减少骚扰和诈骗，建议不要把联系方式直接放在公开正文。你可以开启 BAYLINK 联系方式请求功能，让已登录用户请求联系方式。
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const analysis = analyzeContactsInText(form.description);
                      if (analysis.keywordOnly) {
                        setContactPreference({
                          mode: 'manual_approve',
                          methods: defaultContactPreference().methods,
                        });
                        setContactWarningDismissed(true);
                        showToast('检测到联系方式相关词，但没有识别到具体号码或账号。请手动填写私密联系方式，并删除正文中的联系方式。', 'info');
                        return;
                      }
                      setContactPreference({
                        mode: 'manual_approve',
                        methods: defaultContactPreference().methods.map((m) => {
                          const found = analysis.detectedMethods.find((x) => x.type === m.type);
                          return found ? mergeContactMethod(m, found) : m;
                        }),
                      });
                      setForm({ ...form, description: analysis.cleanedText });
                      setContactWarningDismissed(true);
                      const stillHasContact = analyzeContactsInText(analysis.cleanedText).hasContact;
                      if (analysis.removedFromText && !stillHasContact) {
                        showToast('已移到私密联系方式，并从公开正文中移除。发布前请再检查一次。', 'success');
                      } else {
                        showToast('已填入私密联系方式，请手动检查并删除正文中的联系方式。', 'info');
                      }
                    }}
                    className="rounded-lg bg-baylink-green px-2.5 py-1.5 text-[11px] font-semibold text-white"
                  >
                    移到私密联系方式
                  </button>
                  <button type="button" onClick={() => setContactWarningDismissed(true)} className="rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-amber-900">
                    仍保留在正文
                  </button>
                </div>
              </div>
            )}
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-1.5 px-0.5">
              <span className="text-[11px] font-semibold text-baylink-text">上传照片</span>
              <span className="text-[10px] text-baylink-muted">
                {uploadedImages.length > 0
                  ? `已上传 ${uploadedImages.length}/${MAX_POST_IMAGES} 张 · 最多上传 5 张照片`
                  : '最多上传 5 张照片'}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {uploadedImages.map((img, i) => (
                <div key={i} className="relative shrink-0">
                  <img src={img} alt="" className="h-[72px] w-[72px] rounded-xl border border-baylink-border/50 object-cover" />
                  <button type="button" onClick={() => setUploadedImages((prev) => prev.filter((_, idx) => idx !== i))} className="absolute -right-1 -top-1 rounded-full bg-white p-0.5 text-red-500 shadow-sm"><X size={12} /></button>
                </div>
              ))}
              {uploadedImages.length < MAX_POST_IMAGES && (
                <label
                  htmlFor="create-post-image-input"
                  className="relative flex h-[72px] w-[72px] shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-baylink-border bg-white text-baylink-muted transition hover:border-baylink-green/50 hover:text-baylink-green"
                >
                  <input
                    id="create-post-image-input"
                    type="file"
                    accept="image/*"
                    multiple
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                    onChange={handleImageUpload}
                    aria-label="添加图片"
                  />
                  <span className="pointer-events-none flex flex-col items-center justify-center">
                    {imageCompressing ? <Loader2 size={18} className="animate-spin text-baylink-green" /> : <Plus size={18} />}
                    <span className="mt-0.5 text-[10px]">{imageCompressing ? '处理中' : '添加图片'}</span>
                  </span>
                </label>
              )}
            </div>
            {imageCompressing && (
              <p className="flex items-center gap-1 text-[10px] text-baylink-muted px-0.5">
                <Loader2 size={11} className="animate-spin" /> 图片处理中...
              </p>
            )}
            {!imageCompressing && imageCompressHint && (
              <p className="text-[10px] text-baylink-green px-0.5">{imageCompressHint}</p>
            )}
            {uploadedImages.length > 0 && (
              <p className="text-[10px] text-baylink-muted px-0.5">已上传真实照片，发布时将优先使用照片</p>
            )}
            <DefaultCoverPicker
              type={form.type}
              category={form.category}
              selected={selectedDefaultCover}
              onSelect={setSelectedDefaultCover}
              open={coversPickerOpen}
              onToggleOpen={() => setCoversPickerOpen((v) => !v)}
              expanded={coversExpanded}
              onToggleExpanded={() => setCoversExpanded((v) => !v)}
            />

            <div className="flex gap-2 mt-3">
              <button type="button" onClick={()=>setStep(1)} className="flex-1 py-3 bg-white text-baylink-text-secondary rounded-xl font-semibold border border-baylink-border hover:bg-baylink-section/50">上一步</button>
              <button type="button" onClick={goToStep3} className="flex-[2] py-3 btn-primary">下一步</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-baylink-text-secondary mb-2">选择地区</label>
              <div className="grid grid-cols-2 gap-2">
                {REGIONS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm({...form, city: r})}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${form.city===r ? 'chip-active' : 'chip-inactive'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white p-1 rounded-xl border border-baylink-border/60">
              <input
                className="w-full p-3 bg-transparent outline-none font-semibold text-center text-base placeholder:text-baylink-muted"
                placeholder={budgetPlaceholder}
                value={form.budget}
                maxLength={30}
                onChange={e => setForm({...form, budget: e.target.value})}
              />
            </div>
            <div className="bg-white p-1 rounded-xl border border-baylink-border/60">
              <input
                className="w-full p-3 bg-transparent outline-none font-medium text-center text-sm placeholder:text-baylink-muted"
                placeholder="可服务 / 需要的时间（如: 周末、本周）"
                value={form.timeInfo}
                onChange={e => setForm({...form, timeInfo: e.target.value})}
              />
            </div>
            <ContactPreferenceForm value={contactPreference} onChange={setContactPreference} />
            {!isEdit && !isAdmin && (
              <div className="rounded-xl border border-baylink-border/60 bg-white p-3">
                <p className="text-xs font-semibold text-baylink-text mb-2">为了防止垃圾内容，请完成验证</p>
                <p className="text-[11px] text-baylink-muted mb-2">BayLink 主要服务哪个地区？</p>
                <div className="space-y-1.5">
                  {['旧金山湾区', '纽约', '洛杉矶'].map((opt) => (
                    <label key={opt} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer ${antiSpamAnswer === opt ? 'border-baylink-green bg-baylink-green-light/40' : 'border-baylink-border'}`}>
                      <input type="radio" name="antiSpam" className="accent-baylink-green" checked={antiSpamAnswer === opt} onChange={() => setAntiSpamAnswer(opt)} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={()=>setStep(2)} className="flex-1 py-3 bg-white text-baylink-text-secondary rounded-xl font-semibold border border-baylink-border">上一步</button>
              <button type="button" onClick={handleSubmit} disabled={submitting} className="flex-[2] py-3 btn-primary disabled:opacity-50">
                {submitting ? (isEdit ? '保存中...' : '发布中...') : (isEdit ? '保存修改' : '确认发布')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
