import { useMemo, useState } from "react";
import {
  Search,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Compass,
  MapPin,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  guides,
  GUIDE_CATEGORY_TABS,
  getGuideBySlug,
  type Guide,
  type GuideCategory,
} from "../data/guides";
import { GuideCard, handleGuideLinkClick } from "./GuideCard";

type GuidesHomeProps = { onOpenGuide: (slug: string) => void };
const NEWCOMER_SPOTLIGHT_SLUGS = [
  "bay-area-newcomer-first-month-checklist",
  "bay-area-rental-scam-guide",
  "bay-area-commute-guide",
];

export const GuidesHome = ({ onOpenGuide }: GuidesHomeProps) => {
  const [tab, setTab] = useState<"all" | GuideCategory>("all");
  const [query, setQuery] = useState("");
  const spotlightGuides = NEWCOMER_SPOTLIGHT_SLUGS.map(getGuideBySlug).filter(
    Boolean,
  ) as Guide[];
  const filtered = useMemo(() => {
    let list =
      tab === "all" ? [...guides] : guides.filter((g) => g.category === tab);
    const q = query.trim().toLowerCase();
    if (q)
      list = list.filter((g) =>
        [g.title, g.summary, ...g.tags, ...g.audience].some((value) =>
          value.toLowerCase().includes(q),
        ),
      );
    return list.sort(
      (a, b) =>
        ({ P0: 0, P1: 1, P2: 2 })[a.priority] -
        { P0: 0, P1: 1, P2: 2 }[b.priority],
    );
  }, [tab, query]);
  const grouped = useMemo(() => {
    if (tab !== "all" || query.trim()) return null;
    const byCat = new Map<string, Guide[]>();
    for (const g of filtered)
      byCat.set(g.categoryLabel, [...(byCat.get(g.categoryLabel) ?? []), g]);
    return byCat;
  }, [tab, query, filtered]);
  const hero = spotlightGuides[0];

  return (
    <div className="bl-guides-page">
      <header className="bl-guides-intro">
        <span className="bl-guide-eyebrow">
          <span /> THE BAYLINK JOURNAL
        </span>
        <div className="bl-guides-intro-row">
          <div>
            <h1>
              把湾区，
              <br />
              <em>过成你的生活。</em>
            </h1>
            <p>
              从第一份租约，到周末的新去处。
              <br className="bl-guides-mobile-break" />{" "}
              给每一步，一个更清晰的开始。
            </p>
          </div>
          <div className="bl-guides-edition">
            <BookOpen size={22} strokeWidth={1.3} aria-hidden="true" />
            <strong>{guides.length} 篇</strong>
            <span>湾区生活指南</span>
          </div>
        </div>
      </header>
      {!query.trim() && tab === "all" && hero && (
        <section className="bl-guides-spotlights" aria-label="新来湾区先看">
          <Link
            to={`/guides/${hero.slug}`}
            onClick={(event) =>
              handleGuideLinkClick(event, () => onOpenGuide(hero.slug))
            }
            className="bl-guides-feature"
          >
            <div className="bl-guides-feature-top">
              <span>
                <Compass size={15} aria-hidden="true" /> 新来湾区先看
              </span>
              <span>START HERE</span>
            </div>
            <div className="bl-guides-feature-content">
              <h2>
                新的城市，
                <br />
                从容开始。
              </h2>
              <p>{hero.title}</p>
              <span className="bl-guides-feature-link">
                打开第一份生活清单 <ArrowRight size={17} aria-hidden="true" />
              </span>
            </div>
            <div className="bl-guides-feature-drawing" aria-hidden="true">
              <span className="bl-guide-orbit bl-guide-orbit-one" />
              <span className="bl-guide-orbit bl-guide-orbit-two" />
              <MapPin className="bl-guide-pin" strokeWidth={1.1} />
              <span className="bl-guide-drawing-note">
                HELLO,
                <br />
                BAY AREA.
              </span>
              <span className="bl-guide-drawing-dot" />
            </div>
          </Link>
          <div className="bl-guides-starter-list">
            {spotlightGuides.slice(1).map((g, index) => (
              <Link
                key={g.slug}
                to={`/guides/${g.slug}`}
                onClick={(event) =>
                  handleGuideLinkClick(event, () => onOpenGuide(g.slug))
                }
                className="bl-guides-starter"
              >
                <div className="bl-guides-starter-top">
                  <span>0{index + 2} / 必读指南</span>
                  <ArrowUpRight size={19} aria-hidden="true" />
                </div>
                <h3>{g.title}</h3>
                <p>
                  {g.categoryLabel} <span>·</span> {g.readMinutes} 分钟阅读
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section
        className="bl-guides-library"
        aria-labelledby="guide-library-title"
      >
        <div className="bl-guides-library-heading">
          <div>
            <span className="bl-guide-eyebrow">YOUR LOCAL HANDBOOK</span>
            <h2 id="guide-library-title">生活的答案，在这里。</h2>
          </div>
          <span className="bl-guides-count" aria-live="polite">
            {filtered.length} 篇指南
          </span>
        </div>
        <div className="bl-guides-controls">
          <div className="bl-guide-search">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              aria-label="搜索生活指南"
              placeholder="搜索租房、通勤、二手交易…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="清除指南搜索"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="bl-guide-tabs" role="group" aria-label="指南分类">
            {GUIDE_CATEGORY_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                className={tab === t.id ? "is-active" : ""}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="bl-guide-empty">
            <Search size={28} strokeWidth={1.3} aria-hidden="true" />
            <h3>还没有找到相关指南</h3>
            <p>试试更简短的关键词，或看看其他分类。</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setTab("all");
              }}
            >
              查看全部指南 <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        ) : grouped ? (
          Array.from(grouped.entries()).map(([label, items]) => (
            <section
              className="bl-guide-category-group"
              key={label}
              aria-label={label}
            >
              <div className="bl-guide-group-title">
                <h3>{label}</h3>
                <span>{String(items.length).padStart(2, "0")}</span>
              </div>
              <div className="bl-guide-grid">
                {items.map((g) => (
                  <GuideCard
                    key={g.slug}
                    guide={g}
                    onClick={() => onOpenGuide(g.slug)}
                  />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="bl-guide-grid bl-guide-filter-results">
            {filtered.map((g) => (
              <GuideCard
                key={g.slug}
                guide={g}
                onClick={() => onOpenGuide(g.slug)}
              />
            ))}
          </div>
        )}
      </section>
      <footer className="bl-guides-bottom">
        <Compass size={20} strokeWidth={1.4} aria-hidden="true" />
        <p>慢慢熟悉，也慢慢喜欢上这里。</p>
        <span>BAYLINK · CONNECTED BY THE BAY</span>
      </footer>
    </div>
  );
};
