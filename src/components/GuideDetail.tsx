import { ChevronLeft, CheckCircle2, Lightbulb } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getGuideBySlug,
  getRelatedGuides,
  type GuideBlock,
} from '../data/guides';
import { GuideCardMini } from './GuideCard';

type GuideDetailProps = {
  slug: string;
  onBack: () => void;
  onOpenGuide: (slug: string) => void;
  onNavigate: (path: string) => void;
  onOpenPost: (options: { type: 'client' | 'provider'; categorySlug: string }) => void;
};

export const GuideDetail = ({
  slug,
  onBack,
  onOpenGuide,
  onNavigate,
  onOpenPost,
}: GuideDetailProps) => {
  const guide = getGuideBySlug(slug);

  if (!guide) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 pb-24 text-center">
        <p className="text-lg font-semibold text-baylink-text">未找到该指南</p>
        <p className="mt-2 text-sm text-baylink-muted">链接可能已失效或文章已移除</p>
        <button type="button" onClick={() => onNavigate('/guides')} className="mt-6 btn-primary px-6 py-2.5 text-sm">
          返回湾区指南
        </button>
      </div>
    );
  }

  const related = getRelatedGuides(guide, 3);

  const handleCta = (block: Extract<GuideBlock, { type: 'cta' }>) => {
    if (block.primaryAction === 'post' && block.postCategorySlug)
      onOpenPost({ type: block.postType || 'client', categorySlug: block.postCategorySlug });
    else if (block.primaryAction === 'category' && block.categorySlug)
      onNavigate(`/category/${block.categorySlug}`);
    else if (block.primaryAction === 'guides') onNavigate('/guides');
  };

  return (
    <div className="flex flex-col h-full w-full pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] lg:pb-8">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-baylink-border/40 bg-baylink-bg/95 px-4 py-3 backdrop-blur-sm">
        <button type="button" onClick={onBack} aria-label="返回湾区指南" className="rounded-full p-2 text-baylink-muted hover:bg-baylink-section">
          <ChevronLeft size={22} />
        </button>
        <span className="text-sm font-medium text-baylink-text truncate">湾区指南</span>
      </div>

      <article className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 max-w-full">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-md bg-baylink-section px-2 py-0.5 font-medium text-baylink-muted">
            {guide.categoryLabel}
          </span>
          {guide.priority === 'P0' && (
            <span className="rounded-md bg-baylink-green/10 px-2 py-0.5 font-semibold text-baylink-green">
              新手必看
            </span>
          )}
          <span className="text-baylink-muted">{guide.readMinutes} 分钟阅读</span>
          <span className="text-baylink-muted">更新 {guide.updatedAt}</span>
        </div>

        <h1 className="text-xl font-bold leading-snug text-baylink-text">{guide.title}</h1>
        <p className="mt-2 text-sm text-baylink-text-secondary leading-relaxed">{guide.subtitle}</p>
        <p className="mt-1 text-xs text-baylink-muted">{guide.summary}</p>

        {guide.audience.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {guide.audience.map((a) => (
              <span key={a} className="rounded-full bg-baylink-section px-2.5 py-0.5 text-[11px] text-baylink-muted">
                {a}
              </span>
            ))}
          </div>
        )}

        {guide.cover && (
          <a
            href={guide.cover}
            target="_blank"
            rel="noopener noreferrer"
            className="group mx-auto mt-6 block w-full max-w-[760px] rounded-2xl border border-baylink-border/60 bg-white/80 p-2 shadow-rest transition hover:border-baylink-green/25 hover:shadow-card"
            aria-label={`${guide.title} 完整海报`}
          >
            <img
              src={guide.cover}
              alt={`${guide.title} 海报`}
              className="mx-auto h-auto w-full max-w-full rounded-xl object-contain"
            />
            <div className="mt-2 text-center text-[11px] text-baylink-muted transition group-hover:text-baylink-green">
              点击查看完整海报
            </div>
          </a>
        )}

        <div className="mt-6 space-y-4">
          {guide.blocks.map((block, i) => (
            <BlockRenderer key={i} block={block} onCta={handleCta} />
          ))}
        </div>

        <section className="mt-8 rounded-2xl border border-baylink-border/60 bg-white p-4" aria-labelledby="guide-sources">
          <h2 id="guide-sources" className="text-sm font-bold text-baylink-text">官方参考资料与办事入口</h2>
          <p className="mt-1 text-xs leading-relaxed text-baylink-muted">按你的具体情况核对原始资料。票价、开放时间、法规和服务安排可能变化。</p>
          <ul className="mt-3 space-y-3">
            {guide.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-baylink-green underline underline-offset-2">
                  {source.title}<span className="sr-only">（在新标签页打开）</span>
                </a>
                <p className="mt-0.5 text-xs leading-relaxed text-baylink-text-secondary">{source.description}</p>
              </li>
            ))}
          </ul>
        </section>

        {guide.sourceNote && (
          <p className="mt-8 rounded-xl bg-baylink-section/60 p-3 text-[11px] leading-relaxed text-baylink-muted">
            {guide.sourceNote}
          </p>
        )}

        {related.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-2 text-sm font-bold text-baylink-text">相关指南</h3>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1">
              {related.map((g) => (
                <GuideCardMini key={g.slug} guide={g} onClick={() => onOpenGuide(g.slug)} />
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => onNavigate('/guides')}
          className="mt-6 w-full rounded-xl border border-baylink-border py-3 text-sm font-semibold text-baylink-text transition hover:border-baylink-green/30"
        >
          返回湾区指南
        </button>
      </article>
    </div>
  );
};

const BlockRenderer = ({
  block,
  onCta,
}: {
  block: GuideBlock;
  onCta: (b: Extract<GuideBlock, { type: 'cta' }>) => void;
}) => {
  switch (block.type) {
    case 'heading':
      return <h2 className="text-base font-bold text-baylink-text pt-1">{block.text}</h2>;
    case 'paragraph':
      return <p className="text-sm leading-relaxed text-baylink-text-secondary">{block.text}</p>;
    case 'list':
      return (
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-baylink-text-secondary">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case 'checklist':
      return (
        <ul className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-baylink-text-secondary">
              <CheckCircle2 size={16} className="shrink-0 text-baylink-green mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case 'tip':
      return (
        <div className="rounded-xl border border-baylink-green/20 bg-baylink-green/5 p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-baylink-green mb-1">
            <Lightbulb size={14} />
            {block.title || '提示'}
          </div>
          <p className="text-sm leading-relaxed text-baylink-text-secondary">{block.text}</p>
        </div>
      );
    case 'cta':
      return (
        <div className="rounded-2xl border border-baylink-green/25 bg-white p-4 shadow-card">
          <h3 className="text-sm font-bold text-baylink-text">{block.title}</h3>
          <p className="mt-1 text-xs text-baylink-muted leading-relaxed">{block.text}</p>
          {block.primaryAction === 'post' ? (
            block.postChoices?.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-3" aria-label={block.primaryLabel}>
                {block.postChoices.map((choice) => (
                  <button key={choice.categorySlug} type="button" onClick={() => onCta({ ...block, postCategorySlug: choice.categorySlug })} className="rounded-xl bg-baylink-green px-3 py-2.5 text-sm font-bold text-white transition active:scale-[0.98]">
                    {choice.label}
                  </button>
                ))}
              </div>
            ) : (
              <button type="button" onClick={() => onCta(block)} className="mt-3 block w-full rounded-xl bg-baylink-green py-2.5 text-center text-sm font-bold text-white transition active:scale-[0.98]">
                {block.primaryLabel}
              </button>
            )
          ) : (
            <Link to={block.primaryAction === 'category' && block.categorySlug ? `/category/${block.categorySlug}` : '/guides'} className="mt-3 block w-full rounded-xl bg-baylink-green py-2.5 text-center text-sm font-bold text-white transition active:scale-[0.98]">
              {block.primaryLabel}
            </Link>
          )}
        </div>
      );
    default:
      return null;
  }
};
