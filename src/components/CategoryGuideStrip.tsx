import { ChevronRight } from 'lucide-react';
import { CATEGORY_STRIP_TITLES, getGuidesForCategorySlug, type Guide } from '../data/guides';

type CategoryGuideStripProps = {
  categorySlug: string;
  onOpenGuide: (slug: string) => void;
};

export const CategoryGuideStrip = ({ categorySlug, onOpenGuide }: CategoryGuideStripProps) => {
  const items = getGuidesForCategorySlug(categorySlug, 3);
  if (items.length === 0) return null;

  const title = CATEGORY_STRIP_TITLES[categorySlug] ?? '相关生活指南';

  return (
    <div className="mb-3 rounded-xl border border-baylink-border/40 bg-baylink-section/30 px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-baylink-text">{title}</span>
        <span className="text-[10px] text-baylink-muted">湾区指南</span>
      </div>
      <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
        {items.map((g) => (
          <GuidePill key={g.slug} guide={g} onClick={() => onOpenGuide(g.slug)} />
        ))}
      </div>
    </div>
  );
};

const GuidePill = ({ guide, onClick }: { guide: Guide; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-h-[40px] w-full cursor-pointer items-center gap-2 rounded-lg border border-baylink-border/50 bg-white px-2.5 py-2 text-left transition hover:border-baylink-green/30 sm:max-w-[calc(50%-4px)] sm:flex-1"
  >
    <span className="text-base">{guide.emoji}</span>
    <span className="min-w-0 flex-1 line-clamp-1 text-xs font-medium text-baylink-text">{guide.title}</span>
    <ChevronRight size={14} className="shrink-0 text-gray-300" />
  </button>
);
