import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { BRAND } from '../brandAssets';
import { getCategoryFromSlug } from '../routing';

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
    language: 'zh';
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
}: BayBayPostAssistProps) => {
  const [aiPostIntent, setAiPostIntent] = useState('');
  const [tone, setTone] = useState<AiAssistTone>('clear');
  const [appendTagsOnApply, setAppendTagsOnApply] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<AiPostDraft | null>(null);

  const runAssist = async (rewriteMode?: AiRewriteMode) => {
    const intent = aiPostIntent.trim();
    if (!user?.token) {
      showToast('请先登录后使用 BayBay 发帖助手', 'error');
      return;
    }
    if (intent.length < 5) {
      showToast('多写一点需求，BayBay 才能帮你整理', 'error');
      return;
    }
    setAiLoading(true);
    try {
      const res = await requestAiAssist({
        intent,
        type: postType,
        categoryHint: categorySlug || undefined,
        areaHint: areaHint?.trim() || undefined,
        language: 'zh',
        tone,
        ...(rewriteMode ? { rewriteMode } : {}),
      });
      if (res.ok && res.draft) {
        setAiDraft(res.draft);
      } else {
        showToast(res.error || 'AI 整理失败，请稍后再试', 'error');
      }
    } catch (e: unknown) {
      const err = e as { error?: string; status?: number };
      if (err?.error) showToast(err.error, 'error');
      else showToast('AI 服务暂时不可用，请稍后再试', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const categoryLabel = (slug: string) => {
    const label = getCategoryFromSlug(slug);
    return label === '全部' ? slug : label;
  };

  const supplementHint = aiDraft
    ? SUPPLEMENT_HINTS[aiDraft.category] || SUPPLEMENT_HINTS.other
    : '';

  return (
    <div className="rounded-xl border border-baylink-green/20 bg-gradient-to-br from-baylink-green/6 via-white to-[#FFF8F0]/80 p-3">
      <div className="flex gap-2.5">
        <img
          src={BRAND.baybayAvatar}
          alt="BayBay"
          className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-baylink-green/20"
          width={40}
          height={40}
        />
        <div className="min-w-0 flex-1">
          <h4 className="flex items-center gap-1 text-sm font-bold text-baylink-text">
            <Sparkles size={13} className="text-baylink-green shrink-0" />
            BayBay 帮你整理帖子
          </h4>
          <p className="mt-0.5 text-[10px] leading-snug text-baylink-muted">
            一句话告诉我你想发什么，我帮你整理成更清楚的标题和正文。
          </p>
        </div>
      </div>

      {!aiDraft ? (
        <>
          <textarea
            className="mt-2.5 w-full resize-none rounded-lg border border-baylink-border/50 bg-white/90 p-2.5 text-xs outline-none placeholder:text-baylink-muted focus:border-baylink-green/40"
            rows={3}
            placeholder="例如：我想在 Millbrae 附近找一间房，预算 1800，7月入住，最好近 BART。"
            value={aiPostIntent}
            onChange={(e) => setAiPostIntent(e.target.value)}
            disabled={aiLoading}
          />
          <div className="mt-2">
            <p className="mb-1 text-[10px] font-medium text-baylink-muted">语气</p>
            <div className="flex flex-wrap gap-1">
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={aiLoading}
                  onClick={() => setTone(opt.id)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
                    tone === opt.id
                      ? 'bg-baylink-green text-white'
                      : 'border border-baylink-border/60 bg-white text-baylink-text-secondary hover:border-baylink-green/30'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => runAssist()}
            disabled={aiLoading}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-baylink-green py-2 text-xs font-bold text-white transition hover:opacity-95 disabled:opacity-60"
          >
            {aiLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                BayBay 正在整理...
              </>
            ) : (
              '帮我整理'
            )}
          </button>
        </>
      ) : (
        <div className="mt-2.5 rounded-lg border border-baylink-border/50 bg-white p-3 text-xs">
          <p className="mb-2 font-semibold text-baylink-text">BayBay 草稿预览</p>
          <div className="max-h-36 space-y-1.5 overflow-y-auto text-[11px] text-baylink-text-secondary">
            <p><span className="font-medium text-baylink-muted">标题：</span>{aiDraft.title}</p>
            <p className="whitespace-pre-wrap"><span className="font-medium text-baylink-muted">正文：</span>{aiDraft.description}</p>
            <p><span className="font-medium text-baylink-muted">分类：</span>{categoryLabel(aiDraft.category)}</p>
            {aiDraft.area && <p><span className="font-medium text-baylink-muted">地区：</span>{aiDraft.area}</p>}
            {aiDraft.budget && <p><span className="font-medium text-baylink-muted">预算：</span>{aiDraft.budget}</p>}
            {aiDraft.timeInfo && <p><span className="font-medium text-baylink-muted">时间：</span>{aiDraft.timeInfo}</p>}
            {aiDraft.quickTags?.length > 0 && (
              <div>
                <p><span className="font-medium text-baylink-muted">标签：</span>{aiDraft.quickTags.join(' · ')}</p>
                <label className="mt-1 flex cursor-pointer items-center gap-1.5 text-[10px] text-baylink-muted">
                  <input
                    type="checkbox"
                    className="accent-baylink-green"
                    checked={appendTagsOnApply}
                    onChange={(e) => setAppendTagsOnApply(e.target.checked)}
                  />
                  应用时把标签加到正文末尾
                </label>
              </div>
            )}
            {aiDraft.safetyTip && (
              <p className="rounded-md bg-baylink-section/60 p-1.5 text-[10px] text-baylink-muted">{aiDraft.safetyTip}</p>
            )}
            {aiDraft.coverSuggestion && (
              <p className="truncate"><span className="font-medium text-baylink-muted">封面建议：</span>{aiDraft.coverSuggestion}</p>
            )}
          </div>

          {supplementHint && (
            <div className="mt-2 rounded-lg border border-baylink-green/15 bg-baylink-green/5 px-2.5 py-2 text-[10px] leading-relaxed text-baylink-text-secondary">
              <span className="font-semibold text-baylink-green">BayBay 建议补充 · </span>
              {supplementHint.replace(/^建议补充：/, '')}
            </div>
          )}

          <div className="mt-2.5">
            <p className="mb-1 text-[10px] text-baylink-muted">换个写法</p>
            <div className="flex flex-wrap gap-1">
              {REWRITE_OPTIONS.map((opt) => (
                <button
                  key={opt.mode}
                  type="button"
                  disabled={aiLoading}
                  onClick={() => runAssist(opt.mode)}
                  className="rounded-lg border border-baylink-border px-2 py-1 text-[10px] font-medium text-baylink-text transition hover:border-baylink-green/30 disabled:opacity-50"
                >
                  {aiLoading ? '…' : opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                onApply(aiDraft, { appendQuickTags: appendTagsOnApply });
                setAiDraft(null);
              }}
              className="flex-1 min-w-[88px] rounded-lg bg-baylink-green py-2 text-[11px] font-bold text-white"
            >
              应用到表单
            </button>
            <button
              type="button"
              onClick={() => setAiDraft(null)}
              className="rounded-lg border border-baylink-border px-3 py-2 text-[11px] text-baylink-muted"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
