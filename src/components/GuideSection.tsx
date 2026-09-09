import { ArrowRight, ArrowUpRight, BookOpen, Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { getFeaturedGuides, getGuideBySlug } from "../data/guides";
import { GuideCardMini, handleGuideLinkClick } from "./GuideCard";

type GuideSectionProps = {
  onOpenGuide: (slug: string) => void;
  onViewAll: () => void;
};
const HOME_SPOTLIGHT_SLUG = "bay-area-newcomer-first-month-checklist";

export const GuideSection = ({ onOpenGuide, onViewAll }: GuideSectionProps) => {
  const featured = getFeaturedGuides(4);
  const spotlight = getGuideBySlug(HOME_SPOTLIGHT_SLUG) ?? featured[0];
  const smallCards = featured
    .filter((g) => g.slug !== spotlight?.slug)
    .slice(0, 3);
  if (!spotlight) return null;
  return (
    <section className="bl-home-guides" aria-labelledby="home-guides-title">
      <div className="bl-home-guides-heading">
        <div>
          <span className="bl-guide-eyebrow">THE BAYLINK JOURNAL</span>
          <h2 id="home-guides-title">
            <BookOpen size={20} strokeWidth={1.5} aria-hidden="true" />{" "}
            湾区生活指南
          </h2>
          <p>生活在这里，从更了解这里开始。</p>
        </div>
        <Link
          to="/guides"
          onClick={(event) => handleGuideLinkClick(event, onViewAll)}
        >
          查看更多 <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="bl-home-guides-content">
        <Link
          to={`/guides/${spotlight.slug}`}
          onClick={(event) =>
            handleGuideLinkClick(event, () => onOpenGuide(spotlight.slug))
          }
          className="bl-home-guide-spotlight"
        >
          <span className="bl-home-guide-spotlight-kicker">
            <Compass size={17} aria-hidden="true" /> 刚来湾区？从这里开始
          </span>
          <h3>{spotlight.title}</h3>
          <p>{spotlight.summary}</p>
          <span className="bl-home-guide-spotlight-bottom">
            {spotlight.readMinutes} 分钟阅读{" "}
            <ArrowUpRight size={22} aria-hidden="true" />
          </span>
        </Link>
        <div className="bl-home-guide-list">
          {smallCards.map((g) => (
            <GuideCardMini
              key={g.slug}
              guide={g}
              onClick={() => onOpenGuide(g.slug)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
