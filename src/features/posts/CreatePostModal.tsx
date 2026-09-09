// 发布 / 编辑信息弹层（3 步向导）+ 默认封面选择器
import React, { useRef, useState } from 'react';
import { X, CheckCircle, Loader2, Plus } from 'lucide-react';
import { ModalShell } from '../../components/ui/Modal';
import { api } from '../../lib/api';
import {
  CATEGORIES, DEFAULT_COVERS, MAX_POST_IMAGES, REGIONS,
  buildSubmitImageUrls, findDefaultCoverFromUrl, getRecommendedCovers,
  resolveCityFromDraft, splitPostImages,
} from '../../lib/constants';
import { getPostWritingHints, mapPostSaveError, PUBLIC_CONTACT_NOTICE, validatePostForm } from '../../lib/format';
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
      <p className="mt-0.5 text-[11px] leading-relaxed text-baylink-muted">适合求租、找室友、接送、清洁、二手等信息，一键配图更容易被看到。</p>
      {selected && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-baylink-green-light/30 p-2">
          <img src={selected.url} alt={selected.title} className="h-12 w-12 shrink-0 rounded-lg object-contain bg-baylink-section/50" />
          <span className="min-w-0 flex-1 text-[11px] font-semibold text-baylink-text">已选：{selected.title}</span>
          <button type="button" onClick={() => onSelect(null)} className="shrink-0 text-[11px] font-semibold text-baylink-muted hover:text-red-500">清除封面</button>
        </div>
      )}
      <button type="button" onClick={onToggleOpen} className="mt-2 w-full rounded-lg border border-baylink-border/60 bg-baylink-section/40 py-2 text-xs font-semibold text-baylink-text transition hover:border-baylink-green/40">
        {open ? '收起封面' : '选择默认封面'}
      </button>
      {open && (
        <div className="mt-3">
          <p className="mb-2 text-[11px] font-semibold text-baylink-muted">推荐封面</p>
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
                  <p className="mt-1 truncate px-0.5 text-center text-[11px] font-medium text-baylink-text-secondary">{cover.title}</p>
                  {isSelected && (
                    <span className="absolute right-1 top-1 rounded-md bg-baylink-green px-1 py-px text-[8px] font-bold text-white">已选择</span>
                  )}
                </button>
              );
            })}
          </div>
          {!expanded && others.length > 0 && (
            <button type="button" onClick={onToggleExpanded} className="mt-2 w-full text-center text-[11px] font-semibold text-baylink-green">
              查看更多封面（共 {DEFAULT_COVERS.length} 张）
            </button>
          )}
          {expanded && (
            <button type="button" onClick={onToggleExpanded} className="mt-2 w-full text-center text-[11px] font-semibold text-baylink-muted">
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
  const titleContactAnalysis = analyzeContactsInText(form.title);
  const showContactWarning = (contactAnalysis.hasContact || titleContactAnalysis.hasContact) && !contactWarningDismissed;
  const initialImg = isEdit && editingPost?.imageUrls ? splitPostImages(editingPost.imageUrls) : { uploaded: [], cover: null as DefaultCover | null };
  const [uploadedImages, setUploadedImages] = useState<string[]>(initialImg.uploaded);
  const [selectedDefaultCover, setSelectedDefaultCover] = useState<DefaultCover | null>(initialImg.cover);
  const [coversPickerOpen, setCoversPickerOpen] = useState(false);
  const [coversExpanded, setCoversExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [postTrustWarning, setPostTrustWarning] = useState<string | null>(null);
  const [imageCompressing, setImageCompressing] = useState(false);
  const [imageCompressHint, setImageCompressHint] = useState<string | null>(null);
  const imageProcessingRef = useRef(false);
  const submittingRef = useRef(false);
  const [postStatus, setPostStatus] = useState<'active' | 'closed'>(editingPost?.status === 'closed' ? 'closed' : 'active');
  const [confirmAvailability, setConfirmAvailability] = useState(false);

  const isClient = form.type === 'client';
  const closedStatusLabel = form.category === '租屋' && !isClient ? '已出租' : form.category === '闲置' && !isClient ? '已售出' : isClient ? '已解决' : '已结束';
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
    const desc = description.trim();
    const existingTags = new Set((desc.match(/#[^\s#]+/g) || []).map((tag) => tag.slice(1).toLowerCase()));
    const missing = normalized.filter((tag) => !existingTags.has(tag.toLowerCase()));
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
    if (imageProcessingRef.current || submittingRef.current) return;
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

    imageProcessingRef.current = true;
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
      imageProcessingRef.current = false;
      setImageCompressing(false);
      input.value = '';
    }
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (imageProcessingRef.current) return showToast('照片还在处理中，请稍候再提交。', 'info');
    const err = validatePostForm(form);
    if (err) return showToast(err, 'error');
    if (contactPreference.mode !== 'dm_first' && !contactPreference.methods.some((method) => method.enabled && method.value.trim())) {
      return showToast('请填写至少一种联系方式，或选择优先站内私信。', 'error');
    }
    submittingRef.current = true;
    setSubmitting(true);
    const finalImageUrls = buildSubmitImageUrls(uploadedImages, selectedDefaultCover);
    const payload = { ...form, imageUrls: finalImageUrls, contactPreference, status: postStatus,
      ...(isEdit && editingPost?.authorId === user.id && confirmAvailability && postStatus === 'active' ? { confirmAvailability: true } : {}) };
    try {
      if (isEdit && editingPost) {
        await api.request(`/posts/${editingPost.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        if (onUpdated) onUpdated(); else onCreated();
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
      submittingRef.current = false;
    }
  };

  if (isSuccess) {
    return (
      // zoom 只放在内层卡片：整个遮罩层缩放会在入场瞬间露出四周未变暗的屏幕边缘
      <ModalShell onClose={onClose} label="发布成功" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative m-4 w-full max-w-sm overflow-hidden rounded-[28px] border border-black/[0.04] bg-baylink-bg-alt/95 p-8 text-center shadow-elevated backdrop-blur-xl animate-in zoom-in-95 fade-in duration-200">
           <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-baylink-green-light text-baylink-green">
              <CheckCircle size={36} />
           </div>
           <h2 className="mb-2 text-xl font-bold text-baylink-text">发布成功</h2>
           <p className="mb-4 text-sm text-baylink-muted">你的信息已发布，湾区邻居可以在社区中查看。</p>
           {postTrustWarning && (
             <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs leading-relaxed text-amber-800">
               {postTrustWarning}
             </p>
           )}
           <button onClick={onClose} className="w-full py-3.5 btn-primary">知道了</button>
        </div>
      </ModalShell>
    );
  }

  const goToStep3 = () => {
    if (imageProcessingRef.current || submittingRef.current) return;
    const err = validatePostForm(form);
    if (err) return showToast(err, 'error');
    setStep(3);
  };

  return (
    // 表单内容较多，误触遮罩不关闭（closeOnBackdrop=false），Esc / 右上角 X 可关
    <ModalShell onClose={onClose} closeOnBackdrop={false} label={isEdit ? '编辑信息' : '发布信息'} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[70]">
      <div className="bg-baylink-bg w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto pb-safe-bar shadow-2xl border border-baylink-border/40">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-lg font-bold text-baylink-text">{isEdit ? '编辑信息' : '发布信息'}</h3>
            <span className="text-[11px] text-baylink-muted">Step {step}/3</span>
          </div>
          <button type="button" aria-label="关闭发布窗口" onClick={onClose} className="p-2 bg-white rounded-full hover:bg-baylink-section border border-baylink-border/50"><X size={18} className="text-baylink-muted"/></button>
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
                  {form.type === 'client' && <span className="text-[11px] font-semibold bg-baylink-green/15 text-baylink-green px-1.5 py-px rounded mb-1.5 inline-block">当前选择</span>}
                  <div className="text-sm font-bold leading-tight">发布需求</div>
                  <div className="text-[11px] mt-1 leading-snug">找房、找人帮忙、找服务</div>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({...form, type: 'provider'})}
                  className={`flex-1 p-3.5 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${typeCardClass(form.type==='provider')}`}
                >
                  {form.type === 'provider' && <span className="text-[11px] font-semibold bg-baylink-green/15 text-baylink-green px-1.5 py-px rounded mb-1.5 inline-block">当前选择</span>}
                  <div className="text-sm font-bold leading-tight">提供资源</div>
                  <div className="text-[11px] mt-1 leading-snug">房源、二手、服务、接送</div>
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
            <button type="button" disabled={imageCompressing || submitting} onClick={() => { if (!imageProcessingRef.current && !submittingRef.current) setStep(2); }} className="w-full py-3.5 btn-primary mt-2 disabled:opacity-50">下一步</button>
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
                <label htmlFor="post-title" className="text-[11px] font-semibold text-baylink-text">帖子标题</label>
                <span className="text-[11px] text-baylink-muted">一句话说清楚需求或服务</span>
              </div>
              <input
                className="w-full p-4 bg-white rounded-xl font-semibold text-base outline-none border border-baylink-border/60 placeholder:text-baylink-muted focus:border-baylink-green/40 focus:ring-1 focus:ring-baylink-green/10"
                id="post-title"
                placeholder={hints.titlePlaceholder}
                value={form.title}
                maxLength={80}
                onChange={e => { setForm({...form, title: e.target.value}); setContactWarningDismissed(false); }}
              />
            </div>
            {hints.quickTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {hints.quickTags.map((tag) => (
                  <button key={tag} type="button" onClick={() => addTagToDesc(tag)} className="text-[11px] bg-white text-baylink-text-secondary px-2 py-1 rounded-md border border-baylink-border hover:border-baylink-green/40 hover:bg-baylink-green-light/50 active:scale-95 transition">#{tag}</button>
                ))}
              </div>
            )}
            {hints.checklist.length > 0 && (
              <p className="text-[11px] text-baylink-muted leading-relaxed px-0.5">建议包含：{hints.checklist.join('、')}</p>
            )}
            <div>
              <div className="mb-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0 px-0.5">
                <label htmlFor="post-description" className="text-[11px] font-semibold text-baylink-text">详细内容</label>
                <span className="text-[11px] text-baylink-muted">补充位置、价格、时间和具体要求</span>
              </div>
              <textarea
                className="w-full p-4 bg-white rounded-xl h-36 resize-none outline-none border border-baylink-border/60 placeholder:text-baylink-muted text-sm leading-relaxed focus:border-baylink-green/40 focus:ring-1 focus:ring-baylink-green/10"
                id="post-description"
                placeholder={hints.descriptionPlaceholder}
                value={form.description}
                maxLength={2000}
                onChange={e => { setForm({ ...form, description: e.target.value }); setContactWarningDismissed(false); }}
              />
            </div>
            <p className="px-0.5 text-[11px] leading-relaxed text-baylink-muted">{PUBLIC_CONTACT_NOTICE}</p>
            {showContactWarning && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-[11px] leading-relaxed text-amber-900">
                  检测到可能的联系方式。{PUBLIC_CONTACT_NOTICE}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const analysis = analyzeContactsInText(form.description);
                      const titleAnalysis = analyzeContactsInText(form.title);
                      const detectedMethods = [...analysis.detectedMethods, ...titleAnalysis.detectedMethods];
                      const hasConflictingValues = detectedMethods.some((method) => {
                        const current = contactPreference.methods.find((item) => item.type === method.type)?.value.trim();
                        return (current && current !== method.value.trim()) || detectedMethods.some((other) => other.type === method.type && other.value.trim() !== method.value.trim());
                      });
                      if (hasConflictingValues) {
                        showToast('检测到同类多个联系方式或与已填写内容不同。请在下一步选择要分享的联系方式，再手动调整公开内容。', 'info');
                        return;
                      }
                      if (detectedMethods.length === 0) {
                        setContactPreference((previous) => ({ ...previous, mode: 'manual_approve' }));
                        setContactWarningDismissed(true);
                        showToast('未识别到具体号码或账号。请在下一步填写联系方式，并检查标题和正文。', 'info');
                        return;
                      }
                      setContactPreference({
                        mode: 'manual_approve',
                        methods: contactPreference.methods.map((m) => {
                          const found = detectedMethods.find((x) => x.type === m.type);
                          if (m.value.trim()) return m;
                          return found ? mergeContactMethod(m, found) : m;
                        }),
                      });
                      setForm({ ...form, title: titleAnalysis.cleanedText, description: analysis.cleanedText });
                      setContactWarningDismissed(true);
                      const stillHasContact = analyzeContactsInText(`${titleAnalysis.cleanedText}\n${analysis.cleanedText}`).hasContact;
                      if (analysis.removedFromText && !stillHasContact) {
                        showToast('已移到联系方式设置，请核对号码、账号和公开内容后再发布。', 'success');
                      } else {
                        showToast('已填入联系方式设置，请继续检查标题和正文中的联系方式。', 'info');
                      }
                    }}
                    className="rounded-lg bg-baylink-green px-2.5 py-1.5 text-[11px] font-semibold text-white"
                  >
                    移到私密联系方式
                  </button>
                  <button type="button" onClick={() => setContactWarningDismissed(true)} className="rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-amber-900">
                    我确认保留公开显示
                  </button>
                </div>
              </div>
            )}
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-1.5 px-0.5">
              <span className="text-[11px] font-semibold text-baylink-text">上传照片</span>
              <span className="text-[11px] text-baylink-muted">
                {uploadedImages.length > 0
                  ? `已上传 ${uploadedImages.length}/${MAX_POST_IMAGES} 张 · 最多上传 5 张照片`
                  : '最多上传 5 张照片'}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {uploadedImages.map((img, i) => (
                <div key={i} className="relative shrink-0">
                  <img src={img} alt="" className="h-[72px] w-[72px] rounded-xl border border-baylink-border/50 object-cover" />
                  <button type="button" aria-label={`移除第 ${i + 1} 张照片`} disabled={imageCompressing || submitting} onClick={() => setUploadedImages((prev) => prev.filter((_, idx) => idx !== i))} className="absolute -right-1 -top-1 rounded-full bg-white p-0.5 text-red-500 shadow-sm disabled:opacity-50"><X size={12} /></button>
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
                    disabled={imageCompressing || submitting}
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                    onChange={handleImageUpload}
                    aria-label="添加图片"
                  />
                  <span className="pointer-events-none flex flex-col items-center justify-center">
                    {imageCompressing ? <Loader2 size={18} className="animate-spin text-baylink-green" /> : <Plus size={18} />}
                    <span className="mt-0.5 text-[11px]">{imageCompressing ? '处理中' : '添加图片'}</span>
                  </span>
                </label>
              )}
            </div>
            {imageCompressing && (
              <p className="flex items-center gap-1 text-[11px] text-baylink-muted px-0.5">
                <Loader2 size={11} className="animate-spin" /> 图片处理中...
              </p>
            )}
            {!imageCompressing && imageCompressHint && (
              <p className="text-[11px] text-baylink-green px-0.5">{imageCompressHint}</p>
            )}
            {uploadedImages.length > 0 && (
              <p className="text-[11px] text-baylink-muted px-0.5">已上传真实照片，发布时将优先使用照片</p>
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
              <button type="button" disabled={imageCompressing || submitting} onClick={()=>setStep(1)} className="flex-1 py-3 bg-white text-baylink-text-secondary rounded-xl font-semibold border border-baylink-border hover:bg-baylink-section/50 disabled:opacity-50">上一步</button>
              <button type="button" onClick={goToStep3} disabled={imageCompressing || submitting} className="flex-[2] py-3 btn-primary disabled:opacity-50">{imageCompressing ? '照片处理中…' : '下一步'}</button>
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
              <label htmlFor="post-budget" className="sr-only">预算或价格</label>
              <input
                id="post-budget"
                className="w-full p-3 bg-transparent outline-none font-semibold text-center text-base placeholder:text-baylink-muted"
                placeholder={budgetPlaceholder}
                value={form.budget}
                maxLength={30}
                onChange={e => setForm({...form, budget: e.target.value})}
              />
            </div>
            <div className="bg-white p-1 rounded-xl border border-baylink-border/60">
              <label htmlFor="post-time" className="sr-only">可服务或需要的时间</label>
              <input
                id="post-time"
                className="w-full p-3 bg-transparent outline-none font-medium text-center text-sm placeholder:text-baylink-muted"
                placeholder="可服务 / 需要的时间（如: 周末、本周）"
                value={form.timeInfo}
                onChange={e => setForm({...form, timeInfo: e.target.value})}
              />
            </div>
            <ContactPreferenceForm value={contactPreference} onChange={setContactPreference} />
            {isEdit && (
              <div className="rounded-xl border border-baylink-border/60 bg-white p-3">
                <label htmlFor="post-status" className="mb-2 block text-xs font-semibold">信息状态</label>
                <select id="post-status" value={postStatus} onChange={(e) => { setPostStatus(e.target.value as 'active' | 'closed'); setConfirmAvailability(false); }} className="w-full rounded-lg border border-baylink-border bg-white p-2 text-sm">
                  <option value="active">仍在进行</option><option value="closed">{closedStatusLabel}</option>
                </select>
                {postStatus === 'active' && editingPost?.authorId === user.id && <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed">
                  <input type="checkbox" className="mt-0.5 accent-baylink-green" checked={confirmAvailability} onChange={(e) => setConfirmAvailability(e.target.checked)} />
                  <span>我已重新核实，这条信息目前仍然有效。<span className="block mt-1 text-baylink-muted">仅修改文字不会更新有效性确认时间。</span></span>
                </label>}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button type="button" disabled={imageCompressing || submitting} onClick={()=>setStep(2)} className="flex-1 py-3 bg-white text-baylink-text-secondary rounded-xl font-semibold border border-baylink-border disabled:opacity-50">上一步</button>
              <button type="button" onClick={handleSubmit} disabled={submitting || imageCompressing} className="flex-[2] py-3 btn-primary disabled:opacity-50">
                {imageCompressing ? '照片处理中…' : submitting ? (isEdit ? '保存中...' : '发布中...') : (isEdit ? '保存修改' : '确认发布')}
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
};
