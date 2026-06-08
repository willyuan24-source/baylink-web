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

type BayBayPostAssistProps = {
  postType: 'client' | 'provider';
  categorySlug?: string | null;
  areaHint?: string;
  user: { token?: string } | null;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onApply: (draft: AiPostDraft) => void;
  requestAiAssist: (body: {
    intent: string;
    type: 'client' | 'provider';
    categoryHint?: string;
    areaHint?: string;
    language: 'zh';
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
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<AiPostDraft | null>(null);

  const runAssist = async () => {
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
      });
      if (res.ok && res.draft) {
        setAiDraft(res.draft);
      } else {
        showToast(res.error || 'AI 整理失败，请稍后再试', 'error');
      }
    } catch (e: unknown) {
      const err = e as { error?: string; status?: number };
      if (err?.error) showToast(err.error, 'error');
      else if (err?.status) showToast('AI 服务暂时不可用，请稍后再试', 'error');
      else showToast('AI 服务暂时不可用，请稍后再试', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const categoryLabel = (slug: string) => {
    const label = getCategoryFromSlug(slug);
    return label === '全部' ? slug : label;
  };

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
          <button
            type="button"
            onClick={runAssist}
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
          <div className="max-h-40 space-y-1.5 overflow-y-auto text-[11px] text-baylink-text-secondary">
            <p><span className="font-medium text-baylink-muted">标题：</span>{aiDraft.title}</p>
            <p className="whitespace-pre-wrap"><span className="font-medium text-baylink-muted">正文：</span>{aiDraft.description}</p>
            <p><span className="font-medium text-baylink-muted">分类：</span>{categoryLabel(aiDraft.category)}</p>
            {aiDraft.area && <p><span className="font-medium text-baylink-muted">地区：</span>{aiDraft.area}</p>}
            {aiDraft.budget && <p><span className="font-medium text-baylink-muted">预算：</span>{aiDraft.budget}</p>}
            {aiDraft.timeInfo && <p><span className="font-medium text-baylink-muted">时间：</span>{aiDraft.timeInfo}</p>}
            {aiDraft.quickTags?.length > 0 && (
              <p><span className="font-medium text-baylink-muted">标签：</span>{aiDraft.quickTags.join(' · ')}</p>
            )}
            {aiDraft.safetyTip && (
              <p className="rounded-md bg-baylink-section/60 p-1.5 text-[10px] text-baylink-muted">{aiDraft.safetyTip}</p>
            )}
            {aiDraft.coverSuggestion && (
              <p className="truncate"><span className="font-medium text-baylink-muted">封面建议：</span>{aiDraft.coverSuggestion}</p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                onApply(aiDraft);
                setAiDraft(null);
              }}
              className="flex-1 min-w-[88px] rounded-lg bg-baylink-green py-2 text-[11px] font-bold text-white"
            >
              应用到表单
            </button>
            <button
              type="button"
              onClick={runAssist}
              disabled={aiLoading}
              className="flex-1 min-w-[88px] rounded-lg border border-baylink-border py-2 text-[11px] font-semibold text-baylink-text disabled:opacity-50"
            >
              {aiLoading ? '整理中...' : '重新生成'}
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
