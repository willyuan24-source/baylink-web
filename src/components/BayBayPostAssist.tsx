import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/Button';
import { BayBayOtter } from '../features/baybay/BayBayMarks';
import '../features/baybay/baybay-post-assist.css';
import { getCategoryFromSlug } from '../routing';
import { DEFAULT_COVERS } from '../lib/constants';
import { translateText, useLocale } from '../i18n/locale';

export type AiPostDraft = {
  title: string;
  description: string;
  category: string;
  type: 'client' | 'provider';
  area: string;
  budget: string;
  timeInfo: string;
  quickTags: string[];
  safetyTip: string;
  coverSuggestion: string;
};

export type AiAssistTone =
  | 'clear'
  | 'natural'
  | 'concise'
  | 'detailed'
  | 'urgent';

export type AiRewriteMode = 'shorter' | 'moreDetailed' | 'moreNatural';
export type AiAssistLanguage = 'zh' | 'en' | 'bilingual';

const TONE_OPTIONS: { id: AiAssistTone; label: string }[] = [
  { id: 'clear', label: '清楚实用' },
  { id: 'natural', label: '更像真人' },
  { id: 'concise', label: '简洁一点' },
  { id: 'detailed', label: '更详细' },
  { id: 'urgent', label: '稍微急一点' },
];

const REWRITE_OPTIONS: { mode: AiRewriteMode; label: string }[] = [
  { mode: 'shorter', label: '更简洁' },
  { mode: 'moreDetailed', label: '更详细' },
  { mode: 'moreNatural', label: '更自然' },
];

const SUPPLEMENT_HINTS: Record<string, string> = {
  rent: '建议补充：入住时间、预算、是否需要独立卫浴、是否有车位、是否有宠物。',
  used: '建议补充：品牌型号、新旧程度、价格、取货地点、是否可议价。',
  moving: '建议补充：搬运日期、起点终点、楼梯/电梯、物品大小、是否需要车。',
  cleaning: '建议补充：清洁日期、房屋大小、是否退房清洁、是否需要带工具。',
  ride: '建议补充：出发地、目的地、时间、人数、行李数量。',
  repair: '建议补充：维修项目、问题照片、可预约时间、预算。',
  translation: '建议补充：文件类型、页数、语言、截止时间。',
  'part-time': '建议补充：工作内容、地点、时间、薪酬、是否需要经验。',
  other: '建议补充：地点、时间、预算、联系方式、具体需求。',
};

type BayBayPostAssistProps = {
  intent?: string;
  onIntentChange?: (intent: string) => void;
  intentFromQuestion?: boolean;
  postType: 'client' | 'provider';
  categorySlug?: string | null;
  areaHint?: string;
  user: { token?: string } | null;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onApply: (draft: AiPostDraft, options?: { appendQuickTags?: boolean }) => void;
  requestAiAssist: (body: {
    intent: string;
    type: 'client' | 'provider';
    categoryHint?: string;
    areaHint?: string;
    language: AiAssistLanguage;
    tone: AiAssistTone;
    rewriteMode?: AiRewriteMode;
  }) => Promise<{ ok: boolean; draft?: AiPostDraft; error?: string }>;
};

export const BayBayPostAssist = ({
  postType,
  categorySlug,
  areaHint,
  user,
  showToast,
  onApply,
  requestAiAssist,
  intent: controlledIntent,
  onIntentChange,
  intentFromQuestion,
}: BayBayPostAssistProps) => {
  const locale = useLocale();
  const tr = (text: string) => translateText(text, locale);
  const [languageChoice, setLanguageChoice] = useState<AiAssistLanguage | 'auto'>('auto');
  const draftLanguage = languageChoice === 'auto' ? (locale === 'en' ? 'en' : 'zh') : languageChoice;
  const [localIntent, setLocalIntent] = useState('');
  const aiPostIntent = controlledIntent ?? localIntent;
  const setAiPostIntent = onIntentChange ?? setLocalIntent;
  const [tone, setTone] = useState<AiAssistTone>('clear');
  const [appendTagsOnApply, setAppendTagsOnApply] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<AiPostDraft | null>(null);
  const activeRequest = useRef<number | null>(null);
  const requestSequence = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; activeRequest.current = null; };
  }, []);

  useEffect(() => {
    activeRequest.current = null;
    setAiLoading(false);
  }, [draftLanguage, postType, categorySlug, areaHint]);

  useEffect(() => {
    activeRequest.current = null;
    setAiLoading(false);
    setAiDraft(null);
  }, [user?.token]);

  const dismissDraft = () => {
    activeRequest.current = null;
    setAiLoading(false);
    setAiDraft(null);
  };

  const runAssist = async (rewriteMode?: AiRewriteMode) => {
    if (activeRequest.current !== null) return;
    const intent = aiPostIntent.trim();
    if (!user?.token) {
      showToast('请先登录后使用 BayBay 发帖助手', 'error');
      return;
    }
    if (intent.length < 5) {
      showToast('多写一点需求，BayBay 才能帮你整理', 'error');
      return;
    }
    const requestId = ++requestSequence.current;
    activeRequest.current = requestId;
    const isCurrent = () => mounted.current && activeRequest.current === requestId;
    setAiLoading(true);
    try {
      const res = await requestAiAssist({
        intent,
        type: postType,
        categoryHint: categorySlug || undefined,
        areaHint: areaHint?.trim() || undefined,
        language: draftLanguage,
        tone,
        ...(rewriteMode ? { rewriteMode } : {}),
      });
      if (!isCurrent()) return;
      if (res.ok && res.draft) {
        setAiDraft(res.draft);
      } else {
        showToast(res.error || 'AI 整理失败，请稍后再试', 'error');
      }
    } catch (e: unknown) {
      if (!isCurrent()) return;
      const err = e as { error?: string; status?: number };
      if (err?.error) showToast(err.error, 'error');
      else showToast('AI 服务暂时不可用，请稍后再试', 'error');
    } finally {
      if (isCurrent()) { activeRequest.current = null; setAiLoading(false); }
    }
  };

  const categoryLabel = (slug: string) => {
    const label = getCategoryFromSlug(slug);
    return label === '全部' ? slug : label;
  };

  const supplementHint = aiDraft
    ? SUPPLEMENT_HINTS[aiDraft.category] || SUPPLEMENT_HINTS.other
    : '';
  const suggestedCover = DEFAULT_COVERS.find(cover => cover.url === aiDraft?.coverSuggestion);

  // The post helper inside the publishing sheet (UI9-BB): the otter as the one mark, the panel's type and spacing tokens,
  // F's chips for tone and rewrite and F's buttons (帮我整理 / 应用到表单 the one primary), three fading dots while it works.
  return (
    <div className="bb-assist">
      <div className="bb-assist__head">
        <BayBayOtter size={44} />
        <div>
          <h4>BayBay 帮你整理帖子</h4>
          <p>一句话告诉我你想发什么，我帮你整理成更清楚的标题和正文。</p>
        </div>
      </div>

      <label className="bb-assist__field" translate="no">
        {tr('生成语言')}
        <select value={languageChoice} onChange={event => setLanguageChoice(event.target.value as AiAssistLanguage | 'auto')}>
          <option value="auto">{tr('跟随界面语言')}</option>
          <option value="zh">{tr('中文')}</option>
          <option value="en">English</option>
          <option value="bilingual">{tr('中英双语')}</option>
        </select>
      </label>

      {!aiDraft ? (
        <>
          {intentFromQuestion && <p className="bb-assist__note">已带入你刚才的问题。请确认要公开的需求，补充地点、时间和预算，再点击「帮我整理」。生成后仍需你检查和发布。</p>}
          <textarea
            aria-label="告诉 BayBay 你想发布的内容"
            className="bb-assist__input"
            rows={3}
            maxLength={3000}
            placeholder="例如：我想在 Millbrae 附近找一间房，预算 1800，7月入住，最好近 BART。"
            value={aiPostIntent}
            onChange={(e) => setAiPostIntent(e.target.value)}
            disabled={aiLoading}
          />
          <div className="bb-assist__group">
            <p>语气</p>
            <div>
              {TONE_OPTIONS.map((opt) => (
                <button key={opt.id} type="button" className="ui-chip" aria-pressed={tone === opt.id} disabled={aiLoading} onClick={() => setTone(opt.id)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <Button variant="primary" block onClick={() => runAssist()} disabled={aiLoading}>
            {aiLoading ? <><span className="bb-dots" aria-hidden="true"><span /><span /><span /></span>BayBay 正在整理...</> : '帮我整理'}
          </Button>
        </>
      ) : (
        <div className="bb-assist__draft">
          <p className="bb-assist__draft-title">BayBay 草稿预览</p>
          <div className="bb-assist__draft-body">
            <p><span>标题：</span><span translate="no">{aiDraft.title}</span></p>
            <p className="bb-assist__pre"><span>正文：</span><span translate="no">{aiDraft.description}</span></p>
            <p><span>分类：</span>{categoryLabel(aiDraft.category)}</p>
            {aiDraft.area && <p><span>地区：</span><span translate="no">{tr(aiDraft.area)}</span></p>}
            {aiDraft.budget && <p><span>预算：</span><span translate="no">{aiDraft.budget}</span></p>}
            {aiDraft.timeInfo && <p><span>时间：</span><span translate="no">{aiDraft.timeInfo}</span></p>}
            {aiDraft.quickTags?.length > 0 && (
              <div>
                <p><span>标签：</span><span translate="no">{aiDraft.quickTags.join(' · ')}</span></p>
                <label className="bb-assist__check">
                  <input type="checkbox" checked={appendTagsOnApply} onChange={(e) => setAppendTagsOnApply(e.target.checked)} />
                  应用时把标签加到正文末尾
                </label>
              </div>
            )}
            {aiDraft.safetyTip && <p translate="no" className="bb-assist__tip">{aiDraft.safetyTip}</p>}
            {suggestedCover && (
              <p className="bb-assist__cover"><img src={suggestedCover.url} alt="" width={48} height={48} /><span><span>封面建议：</span><span translate="no">{tr(suggestedCover.title)}</span></span></p>
            )}
          </div>

          {supplementHint && (
            <p className="bb-assist__hint">
              <strong>BayBay 建议补充 · </strong>
              <span translate="no">{tr(supplementHint).replace(/^(?:建议补充|建議補充|Consider adding)[：:]\s*/, '')}</span>
            </p>
          )}

          <div className="bb-assist__group">
            <p>换个写法</p>
            <div>
              {REWRITE_OPTIONS.map((opt) => (
                <button key={opt.mode} type="button" className="ui-chip" disabled={aiLoading} onClick={() => runAssist(opt.mode)}>
                  {aiLoading ? '…' : opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bb-actions">
            <Button variant="primary" onClick={() => { onApply(aiDraft, { appendQuickTags: appendTagsOnApply }); dismissDraft(); }}>应用到表单</Button>
            <Button variant="secondary" onClick={dismissDraft}>取消</Button>
          </div>
        </div>
      )}
    </div>
  );
};
