import { useMemo, useState } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import {
  guides,
  GUIDE_CATEGORY_TABS,
  getGuideBySlug,
  type Guide,
  type GuideCategory,
} from '../data/guides';
import { GuideCard } from './GuideCard';

type GuidesHomeProps = {
  onOpenGuide: (slug: string) => void;
};

const NEWCOMER_SPOTLIGHT_SLUGS = [
  'bay-area-newcomer-first-month-checklist',
  'bay-area-rental-scam-guide',
  'bay-area-commute-guide',
];

export const GuidesHome = ({ onOpenGuide }: GuidesHomeProps) => {
  const [tab, setTab] = useState<'all' | GuideCategory>('all');
  const [query, setQuery] = useState('');

  const spotlightGuides = NEWCOMER_SPOTLIGHT_SLUGS.map((s) => getGuideBySlug(s)).filter(
    Boolean
  ) as Guide[];

  const filtered = useMemo(() => {
    let list = tab === 'all' ? [...guides] : guides.filter((g) => g.category === tab);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.summary.toLowerCase().includes(q) ||
          g.tags.some((t) => t.toLowerCase().includes(q)) ||
          g.audience.some((a) => a.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => {
      const po = (g: Guide) => (g.priority === 'P0' ? 0 : g.priority === 'P1' ? 1 : 2);
      return po(a) - po(b);
    });
  }, [tab, query]);

  const grouped = useMemo(() => {
    if (tab !== 'all' || query.trim()) return null;
    const byCat = new Map<string, Guide[]>();
    for (const g of filtered) {
      const arr = byCat.get(g.categoryLabel) ?? [];
      arr.push(g);
      byCat.set(g.categoryLabel, arr);
    }
    return byCat;
  }, [tab, query, filtered]);

  return (
    <div className="flex flex-col h-full w-full pb-24 lg:pb-8">
      <div className="px-4 sm:px-5 pt-safe-top pb-3 bg-baylink-bg/95 backdrop-blur-sm sticky top-0 z-10 border-b border-baylink-border/40">
        <h2 className="text-xl font-bold text-baylink-text">湾区生活指南</h2>
        <p className="text-[11px] text-baylink-muted mt-0.5 leading-relaxed">
          租房、找室友、二手交易、通勤和本地生活，先避坑再行动
        </p>
        <div className="relative mt-3 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-baylink-muted/70 pointer-events-none" size={15} />
          <input
            className="search-input pl-9 text-sm"
            placeholder="搜索指南标题、标签..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto hide-scrollbar -mx-1 px-1">
          {GUIDE_CATEGORY_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`chip shrink-0 text-[10px] py-1 px-2.5 ${tab === t.id ? 'chip-active' : 'chip-inactive'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-5">
        {!query.trim() && tab === 'all' && (
          <div className="rounded-2xl border border-baylink-green/20 bg-gradient-to-br from-baylink-green/8 to-white p-4 shadow-card">
            <h3 className="text-sm font-bold text-baylink-green mb-2">新来湾区先看</h3>
            <div className="space-y-2">
              {spotlightGuides.map((g) => (
                <button
                  key={g.slug}
                  type="button"
                  onClick={() => onOpenGuide(g.slug)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-baylink-border/40 bg-white/90 p-3 text-left transition hover:border-baylink-green/30"
                >
                  <span className="text-2xl">{g.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-semibold text-baylink-text">{g.title}</div>
                    <span className="text-[10px] text-baylink-muted">{g.readMinutes} 分钟 · {g.categoryLabel}</span>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-gray-300" />
                </button>
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-baylink-muted">没有找到相关指南</p>
        ) : grouped ? (
          Array.from(grouped.entries()).map(([label, items]) => (
            <div key={label}>
              <h3 className="mb-2 text-xs font-bold text-baylink-muted">{label}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((g) => (
                  <GuideCard key={g.slug} guide={g} onClick={() => onOpenGuide(g.slug)} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {filtered.map((g) => (
              <GuideCard key={g.slug} guide={g} onClick={() => onOpenGuide(g.slug)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
