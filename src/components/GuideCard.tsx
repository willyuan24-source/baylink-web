import type { Guide } from "../data/guides";
import { getGuideMedia } from '../data/guide-media';
import type { MouseEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Armchair,
  BookOpen,
  Clock3,
  House,
  MapPin,
  ShieldCheck,
  Sparkles,
  TrainFront,
  Users,
  Wrench,
} from "lucide-react";

type GuideCardProps = { guide: Guide; onClick?: () => void; compact?: boolean; searchSnippet?: string; searchSection?: string };

/** Preserve app navigation callbacks while allowing copy-link and modified clicks. */
export const handleGuideLinkClick = (
  event: MouseEvent<HTMLAnchorElement>,
  onClick?: () => void,
) => {
  if (
    !onClick ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  onClick();
};

const categoryIcons = {
  rent: House,
  roommate: Users,
  used: Armchair,
  service: Wrench,
  commute: TrainFront,
  newcomer: Sparkles,
  city: MapPin,
  safety: ShieldCheck,
  events: BookOpen,
};

export const GuideCard = ({ guide, onClick, compact, searchSnippet, searchSection }: GuideCardProps) => {
  const { cover } = getGuideMedia(guide);
  return (
    <Link
      to={`/guides/${guide.slug}`}
      onClick={(event) => handleGuideLinkClick(event, onClick)}
      className={`bl-guide-card bl-guide-tone-${guide.category}${compact ? " bl-guide-card-compact" : ""}`}
    >
      {!compact && (
        <div
          className="bl-guide-card-art bl-guide-card-art-photo"
          aria-hidden="true"
        >
          <img src={cover.src} srcSet={cover.srcSet} sizes="(max-width: 639px) calc(100vw - 48px), (max-width: 1023px) 42vw, 340px" width={cover.width} height={cover.height} alt="" loading="lazy" decoding="async" />
          <span className="bl-guide-art-label">{guide.categoryLabel}</span>
          <span className="bl-guide-art-arrow">
            <ArrowUpRight size={17} />
          </span>
          <span className="bl-guide-image-kind">{cover.kind === 'photo' ? '实景照片' : 'AI 原创插图'}</span>
        </div>
      )}
      <div className="bl-guide-card-body">
        <div className="bl-guide-card-kicker">
          <span>{guide.categoryLabel}</span>
          {guide.priority === "P0" && (
            <span className="bl-guide-essential">新手必看</span>
          )}
        </div>
        <h3>{guide.title}</h3>
        {!compact && searchSection && <span className="bl-guide-search-section">文内匹配 · {searchSection}</span>}
        {!compact && <p className="bl-guide-card-summary">{searchSnippet || guide.summary}</p>}
        <div className="bl-guide-card-meta">
          <span>
            <Clock3 size={12} aria-hidden="true" /> {guide.readMinutes} 分钟
          </span>
          <span>更新 {guide.updatedAt}</span>
        </div>
      </div>
    </Link>
  );
};

export const GuideCardMini = ({ guide, onClick }: GuideCardProps) => {
  const Icon = categoryIcons[guide.category];
  const { cover } = getGuideMedia(guide);
  return (
    <Link
      to={`/guides/${guide.slug}`}
      onClick={(event) => handleGuideLinkClick(event, onClick)}
      className={`bl-guide-mini bl-guide-tone-${guide.category}`}
    >
      <img className="bl-guide-mini-photo" src={cover.src} srcSet={cover.srcSet} sizes="280px" width={cover.width} height={cover.height} alt="" loading="lazy" decoding="async" />
      <span className="bl-guide-mini-top">
        <span className="bl-guide-mini-icon">
          <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <ArrowUpRight size={15} aria-hidden="true" />
      </span>
      <span className="bl-guide-mini-title">{guide.title}</span>
      <span className="bl-guide-mini-meta">
        {guide.categoryLabel} · {guide.readMinutes} 分钟
      </span>
    </Link>
  );
};
