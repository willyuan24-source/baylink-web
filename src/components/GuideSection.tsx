import { ChevronRight, BookOpen } from 'lucide-react';
import { getFeaturedGuides, getGuideBySlug, type Guide } from '../data/guides';
import { GuideCardMini } from './GuideCard';

type GuideSectionProps = {
  onOpenGuide: (slug: string) => void;
  onViewAll: () => void;
};

const HOME_SPOTLIGHT_SLUG = 'bay-area-newcomer-first-month-checklist';

export const GuideSection = ({ onOpenGuide, onViewAll }: GuideSectionProps) => {
  const featured = getFeaturedGuides(4);
  const spotlight = getGuideBySlug(HOME_SPOTLIGHT_SLUG) ?? featured[0];
  const smallCards = featured.filter((g) => g.slug !== spotlight?.slug).slice(0, 3);

  if (!spotlight) return null;

  return (
    <section className="mb-4 mt-1">
      <div className="mb-2 flex items-end justify-between gap-2 px-0.5">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-baylink-text">
            <BookOpen size={15} className="text-baylink-green" />
            湾区生活指南
          </h3>
          <p className="mt-0.5 text-[11px] text-baylink-muted leading-snug">
            租房、找室友、通勤、二手交易，先避坑再行动
          </p>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="shrink-0 text-[11px] font-medium text-baylink-green flex items-center gap-0.5"
        >
          查看更多 <ChevronRight size={14} />
        </button>
      </div>

      <div className="hidden md:grid md:grid-cols-2 md:gap-2">
        <SpotlightCard guide={spotlight} onClick={() => onOpenGuide(spotlight.slug)} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {smallCards.map((g) => (
            <MiniRow key={g.slug} guide={g} onClick={() => onOpenGuide(g.slug)} />
          ))}
        </div>
      </div>

      <div className="md:hidden">
        <button
          type="button"
          onClick={() => onOpenGuide(spotlight.slug)}
          className="mb-2 w-full rounded-2xl border border-baylink-green/20 bg-gradient-to-br from-baylink-green/8 to-white p-3.5 text-left shadow-card"
        >
          <span className="text-[10px] font-bold uppercase tracking-wide text-baylink-green">刚来湾区？从这里开始</span>
          <div className="mt-1 flex items-start gap-2">
            <span className="text-2xl">{spotlight.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-sm font-bold text-baylink-text">{spotlight.title}</div>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-baylink-muted">{spotlight.summary}</p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-baylink-green/60" />
          </div>
        </button>
        <div className="-mx-1 flex gap-2 overflow-x-auto hide-scrollbar px-1 pb-0.5">
          {featured.map((g) => (
            <GuideCardMini key={g.slug} guide={g} onClick={() => onOpenGuide(g.slug)} />
          ))}
        </div>
      </div>
    </section>
  );
};

const SpotlightCard = ({ guide, onClick }: { guide: Guide; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-full min-h-[140px] cursor-pointer flex-col rounded-2xl border border-baylink-green/25 bg-gradient-to-br from-baylink-green/10 via-white to-baylink-bg p-4 text-left shadow-card transition hover:border-baylink-green/40"
  >
    <span className="text-[11px] font-bold text-baylink-green">刚来湾区？从这里开始</span>
    <div className="mt-2 flex items-start gap-3">
      <span className="text-3xl">{guide.emoji}</span>
      <div className="min-w-0 flex-1">
        <h4 className="line-clamp-2 text-base font-bold text-baylink-text">{guide.title}</h4>
        <p className="mt-1 line-clamp-2 text-xs text-baylink-text-secondary">{guide.summary}</p>
        <span className="mt-2 inline-block text-[10px] text-baylink-muted">{guide.readMinutes} 分钟阅读</span>
      </div>
    </div>
  </button>
);

const MiniRow = ({ guide, onClick }: { guide: Guide; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex cursor-pointer items-center gap-2 rounded-xl border border-baylink-border/50 bg-white p-2.5 text-left shadow-card transition hover:border-baylink-green/30"
  >
    <span className="text-xl">{guide.emoji}</span>
    <div className="min-w-0 flex-1">
      <div className="line-clamp-2 text-xs font-semibold text-baylink-text">{guide.title}</div>
      <span className="text-[10px] text-baylink-muted">{guide.categoryLabel}</span>
    </div>
    <ChevronRight size={14} className="shrink-0 text-gray-300" />
  </button>
);
