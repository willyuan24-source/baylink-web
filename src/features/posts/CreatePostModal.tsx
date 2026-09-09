// 发布 / 编辑信息弹层（3 步向导）+ 默认封面选择器
import React, { useEffect, useRef, useState } from 'react';
import { X, CheckCircle, Loader2, Plus, Search, Store, ArrowRight, MapPin, ImagePlus, PenLine, Check } from 'lucide-react';
import { ModalShell } from '../../components/ui/Modal';
import { api } from '../../lib/api';
import { clearPostDraft, hasPostDraftContent, readPostDraft, savePostDraft, type PostDraft } from '../../lib/postDraft';
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
    <div className="member-compose-covers">
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

export const CreatePostModal = ({ onClose, onCreated, onUpdated, user, showToast, defaultType = 'client', defaultCategory, initialIntent = '', mode = 'create', editingPost }: {
  onClose: () => void;
  onCreated: () => void;
  onUpdated?: () => void;
  user: UserData;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  defaultType?: PostType;
  defaultCategory?: string;
  initialIntent?: string;
  mode?: 'create' | 'edit';
  editingPost?: PostData | null;
}) => {
  const isEdit = mode === 'edit' && !!editingPost;
  const [step, setStep] = useState(isEdit || initialIntent.trim() ? 2 : 1);
  const [savedDraft, setSavedDraft] = useState(() => isEdit ? null : readPostDraft(user.id));
  const [draftReady, setDraftReady] = useState(() => isEdit || !savedDraft);
  const [draftSaveState, setDraftSaveState] = useState<'empty' | 'saved' | 'failed'>('empty');
  const [aiIntent, setAiIntent] = useState(isEdit ? '' : initialIntent.slice(0, 3000));
  const [missingDraftPhotos, setMissingDraftPhotos] = useState(false);
  const draftCompleted = useRef(false);
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

  useEffect(() => {
    if (isEdit || !draftReady || isSuccess || draftCompleted.current) return;
    const draft: PostDraft = { version: 1, updatedAt: Date.now(), form, contactPreference, aiIntent, step,
      defaultCoverUrl: selectedDefaultCover?.url || null, hadPhotos: uploadedImages.length > 0 || missingDraftPhotos };
    setDraftSaveState(savePostDraft(user.id, draft) ? (hasPostDraftContent(draft) ? 'saved' : 'empty') : 'failed');
  }, [isEdit, draftReady, isSuccess, user.id, form, contactPreference, aiIntent, step, selectedDefaultCover, uploadedImages.length, missingDraftPhotos]);

  const restoreDraft = () => {
    if (!savedDraft) return;
    setForm(savedDraft.form);
    setContactPreference(savedDraft.contactPreference);
    setAiIntent(savedDraft.aiIntent);
    setStep(savedDraft.step);
    setSelectedDefaultCover(savedDraft.defaultCoverUrl ? findDefaultCoverFromUrl(savedDraft.defaultCoverUrl) || null : null);
    setMissingDraftPhotos(savedDraft.hadPhotos);
    setSavedDraft(null);
    setDraftReady(true);
  };

  const discardSavedDraft = () => {
    if (!clearPostDraft(user.id)) { showToast('浏览器未能删除草稿，请重试。', 'error'); return; }
    setSavedDraft(null);
    setDraftReady(true);
  };

  const discardCurrentDraft = () => {
    if (!clearPostDraft(user.id)) { showToast('浏览器未能删除草稿，请重试。', 'error'); return; }
    draftCompleted.current = true;
    onClose();
  };

  const isClient = form.type === 'client';
  const closedStatusLabel = form.category === '租屋' && !isClient ? '已出租' : form.category === '闲置' && !isClient ? '已售出' : isClient ? '已解决' : '已结束';
  const hints = getPostWritingHints(form.category, form.type);
  const budgetPlaceholder = isClient ? '预算 / 可支付金额（如: $50/小时）' : '价格 / 收费方式（如: $80起 / 按小时）';

  const typeCardClass = (selected: boolean) =>
    selected ? 'member-compose-type--selected' : '';
  const categoryClass = (active: boolean) => `member-category-choice${active ? ' member-category-choice--active' : ''}`;

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
        draftCompleted.current = true;
        if (!clearPostDraft(user.id)) showToast('发布成功，但浏览器未能清除本机草稿，请稍后丢弃。', 'info');
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

  if (!isEdit && !draftReady && savedDraft) {
    return <ModalShell onClose={onClose} closeOnBackdrop={false} label="恢复发布草稿" className="member-compose-overlay">
      <div className="member-compose-success">
        <h2 className="text-xl font-bold text-baylink-text">有一份没写完的草稿</h2>
        <p className="mt-3 text-sm text-baylink-text-secondary">{savedDraft.form.title || savedDraft.aiIntent.slice(0, 70) || '未命名的发布草稿'}</p>
        <p className="mt-2 text-xs leading-relaxed text-baylink-text-secondary">保存于 {new Date(savedDraft.updatedAt).toLocaleString('zh-CN')}，仅在当前账号的本机浏览器中保留。照片没有保存，恢复后请重新选择。</p>
        {initialIntent.trim() && <p className="mt-2 text-xs text-baylink-text-secondary">继续旧草稿会保留原来的内容；选择重新开始，会带入你这次向 BayBay 提出的需求。</p>}
        <div className="mt-6 flex flex-col gap-2">
          <button type="button" className="member-primary min-h-11" onClick={restoreDraft}>继续之前的草稿</button>
          <button type="button" className="member-secondary min-h-11" onClick={discardSavedDraft}>丢弃旧草稿，重新开始</button>
          <button type="button" className="min-h-11 text-sm text-baylink-text-secondary" onClick={onClose}>稍后再写</button>
        </div>
      </div>
    </ModalShell>;
  }

  if (isSuccess) {
    return (
      // zoom 只放在内层卡片：整个遮罩层缩放会在入场瞬间露出四周未变暗的屏幕边缘
      <ModalShell onClose={onClose} label="发布成功" className="member-compose-overlay">
        <div className="member-compose-success">
           <div className="member-empty-icon mx-auto mb-5">
              <CheckCircle size={36} />
           </div>
           <h2 className="mb-2 text-xl font-bold text-baylink-text">发布成功</h2>
           <p className="mb-4 text-sm text-baylink-muted">你的信息已发布，湾区邻居可以在社区中查看。</p>
           {postTrustWarning && (
             <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs leading-relaxed text-amber-800">
               {postTrustWarning}
             </p>
           )}
           <button onClick={onClose} className="member-primary w-full">知道了</button>
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
    <ModalShell onClose={onClose} closeOnBackdrop={false} label={isEdit ? '编辑信息' : '发布信息'} className="member-compose-overlay">
      <div className="member-compose-dialog">
        <div className="member-compose-header">
          <div>
            <span className="member-compose-eyebrow">SHARE WITH YOUR NEIGHBORHOOD</span>
            <h2>{isEdit ? '编辑信息' : '让你的信息，遇见需要的人。'}</h2>
            <p>{isEdit ? '更新内容，让邻居看到准确的信息。' : '发布需求或分享资源，与湾区邻里建立联系。'}</p>
          </div>
          <button type="button" aria-label="关闭发布窗口" onClick={onClose} className="member-compose-close"><X size={18}/></button>
        </div>
        <ol className="member-compose-progress" aria-label="发布步骤">
          {['选择类型', '填写内容', '发布设置'].map((label, index) => <li key={label} className={step === index + 1 ? 'is-current' : step > index + 1 ? 'is-complete' : ''} aria-current={step === index + 1 ? 'step' : undefined}><span>{step > index + 1 ? <Check size={13} aria-hidden="true" /> : index + 1}</span><strong>{label}</strong></li>)}
        </ol>
        <div className="member-compose-body">

        {!isEdit && <div className="mx-1 mb-4 rounded-xl border border-baylink-border bg-white p-3 text-xs text-baylink-text-secondary">
          <p role="status">{draftSaveState === 'failed' ? '浏览器未能保存草稿，关闭或刷新后内容可能丢失。' : draftSaveState === 'saved' ? '文字和发布设置已自动保存到此账号的本机草稿。' : '文字和发布设置会自动保存到此账号的本机草稿。'}</p>
          <p className="mt-1">照片不会保存到草稿，重新打开后需要再次选择。{missingDraftPhotos && uploadedImages.length === 0 ? '这份草稿之前有照片，请重新添加。' : ''}</p>
          {draftSaveState !== 'empty' && <button type="button" onClick={discardCurrentDraft} className="mt-1 min-h-11 font-semibold text-baylink-green underline">丢弃草稿并关闭</button>}
        </div>}

        {step === 1 && (
          <div className="member-compose-step space-y-6">
            <div>
              <label className="block text-sm font-semibold text-baylink-text mb-0.5">你想发布什么？</label>
              <p className="text-[11px] text-baylink-muted mb-3">选择后，我们会帮你匹配更合适的展示方式</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setForm({...form, type: 'client'})}
                  aria-pressed={form.type === 'client'}
                  className={`member-compose-type ${typeCardClass(form.type==='client')}`}
                >
                  <span className="member-compose-type-icon"><Search size={24} aria-hidden="true" /></span>
                  {form.type === 'client' && <span className="member-compose-selected">当前选择</span>}
                  <div className="text-sm font-bold leading-tight">发布需求</div>
                  <div className="text-[11px] mt-1 leading-snug">找房、找人帮忙、找服务</div>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({...form, type: 'provider'})}
                  aria-pressed={form.type === 'provider'}
                  className={`member-compose-type ${typeCardClass(form.type==='provider')}`}
                >
                  <span className="member-compose-type-icon"><Store size={24} aria-hidden="true" /></span>
                  {form.type === 'provider' && <span className="member-compose-selected">当前选择</span>}
                  <div className="text-sm font-bold leading-tight">提供资源</div>
                  <div className="text-[11px] mt-1 leading-snug">房源、二手、服务、接送</div>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-baylink-text mb-2">选择分类</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button key={c} type="button" onClick={() => setForm({...form, category: c})} aria-pressed={form.category === c} className={categoryClass(form.category===c)}>{c}</button>
                ))}
              </div>
            </div>
            <div className="member-compose-actions"><button type="button" disabled={imageCompressing || submitting} onClick={() => { if (!imageProcessingRef.current && !submittingRef.current) setStep(2); }} className="member-primary w-full disabled:opacity-50">下一步<ArrowRight size={16} aria-hidden="true" /></button></div>
          </div>
        )}

        {step === 2 && (
          <div className="member-compose-step space-y-4">
            <div className="member-compose-section-title"><span><PenLine size={18} aria-hidden="true" /></span><div><h3>把信息说清楚</h3><p>好的描述，让沟通更简单。</p></div></div>
            <div className="member-compose-ai">
            <BayBayPostAssist
              postType={form.type}
              categorySlug={getSlugFromCategory(form.category)}
              areaHint={form.city}
              user={user}
              showToast={showToast}
              onApply={applyAiDraft}
              intent={aiIntent}
              onIntentChange={setAiIntent}
              intentFromQuestion={!isEdit && !!initialIntent.trim()}
              requestAiAssist={(body) =>
                api.request('/ai/post-assist', { method: 'POST', body: JSON.stringify(body) })
              }
            />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0 px-0.5">
                <label htmlFor="post-title" className="text-[11px] font-semibold text-baylink-text">帖子标题</label>
                <span className="text-[11px] text-baylink-muted">一句话说清楚需求或服务</span>
              </div>
              <input
                className="member-compose-input"
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
                className="member-compose-input member-compose-description"
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
            <div className="member-compose-upload-heading">
              <span><ImagePlus size={17} aria-hidden="true" />上传照片</span>
              <span className="text-[11px] text-baylink-muted">
                {uploadedImages.length > 0
                  ? `已上传 ${uploadedImages.length}/${MAX_POST_IMAGES} 张 · 最多上传 5 张照片`
                  : '最多上传 5 张照片'}
              </span>
            </div>
            <div className="member-compose-images hide-scrollbar">
              {uploadedImages.map((img, i) => (
                <div key={i} className="relative shrink-0">
                  <img src={img} alt="" className="member-compose-image" />
                  <button type="button" aria-label={`移除第 ${i + 1} 张照片`} disabled={imageCompressing || submitting} onClick={() => setUploadedImages((prev) => prev.filter((_, idx) => idx !== i))} className="absolute -right-1 -top-1 rounded-full bg-white p-0.5 text-red-500 shadow-sm disabled:opacity-50"><X size={12} /></button>
                </div>
              ))}
              {uploadedImages.length < MAX_POST_IMAGES && (
                <label
                  htmlFor="create-post-image-input"
                  className="member-compose-upload"
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

            <div className="member-compose-actions">
              <button type="button" disabled={imageCompressing || submitting} onClick={()=>setStep(1)} className="member-secondary flex-1 disabled:opacity-50">上一步</button>
              <button type="button" onClick={goToStep3} disabled={imageCompressing || submitting} className="member-primary flex-[2] disabled:opacity-50">{imageCompressing ? '照片处理中…' : '下一步'}<ArrowRight size={16} aria-hidden="true" /></button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="member-compose-step space-y-4">
            <div className="member-compose-section-title"><span><MapPin size={18} aria-hidden="true" /></span><div><h3>补充发布设置</h3><p>确认地区、时间，以及你希望被联系的方式。</p></div></div>
            <div>
              <label className="block text-xs font-medium text-baylink-text-secondary mb-2">选择地区</label>
              <div className="grid grid-cols-2 gap-2">
                {REGIONS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm({...form, city: r})}
                    aria-pressed={form.city === r}
                    className={categoryClass(form.city===r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="member-compose-field">
              <label htmlFor="post-budget">预算或价格</label>
              <input
                id="post-budget"
                className="member-compose-input"
                placeholder={budgetPlaceholder}
                value={form.budget}
                maxLength={30}
                onChange={e => setForm({...form, budget: e.target.value})}
              />
            </div>
            <div className="member-compose-field">
              <label htmlFor="post-time">可服务或需要的时间</label>
              <input
                id="post-time"
                className="member-compose-input"
                placeholder="可服务 / 需要的时间（如: 周末、本周）"
                value={form.timeInfo}
                onChange={e => setForm({...form, timeInfo: e.target.value})}
              />
            </div>
            <div className="member-compose-contact"><ContactPreferenceForm value={contactPreference} onChange={setContactPreference} /></div>
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
            <div className="member-compose-actions">
              <button type="button" disabled={imageCompressing || submitting} onClick={()=>setStep(2)} className="member-secondary flex-1 disabled:opacity-50">上一步</button>
              <button type="button" onClick={handleSubmit} disabled={submitting || imageCompressing} className="member-primary flex-[2] disabled:opacity-50">
                {imageCompressing ? '照片处理中…' : submitting ? (isEdit ? '保存中...' : '发布中...') : (isEdit ? '保存修改' : '确认发布')}
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </ModalShell>
  );
};
