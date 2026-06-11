import type { Guide } from '../data/guides';

type GuideCardProps = {
  guide: Guide;
  onClick: () => void;
  compact?: boolean;
};

export const GuideCard = ({ guide, onClick, compact }: GuideCardProps) => {
  const hasCover = Boolean(guide.cover);
  const padding = compact ? 'p-3' : 'p-4';

  const body = (
    <>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-lg leading-none">{guide.emoji}</span>
        <span className="rounded-md bg-baylink-section px-1.5 py-0.5 text-[10px] font-medium text-baylink-muted">
          {guide.categoryLabel}
        </span>
        {guide.priority === 'P0' && (
          <span className="rounded-md bg-baylink-green/10 px-1.5 py-0.5 text-[10px] font-semibold text-baylink-green">
            新手必看
          </span>
        )}
      </div>
      <h4 className={`font-semibold text-baylink-text ${compact ? 'line-clamp-2 text-sm' : 'line-clamp-2 text-[15px]'}`}>
        {guide.title}
      </h4>
      {!compact && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-baylink-text-secondary">{guide.summary}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-baylink-muted">
        <span>{guide.readMinutes} 分钟</span>
        <span>·</span>
        <span>{guide.updatedAt}</span>
      </div>
      {guide.audience.length > 0 && !compact && (
        <div className="mt-2 flex flex-wrap gap-1">
          {guide.audience.slice(0, 2).map((a) => (
            <span key={a} className="rounded-full bg-baylink-section/80 px-2 py-0.5 text-[10px] text-baylink-muted">
              {a}
            </span>
          ))}
        </div>
      )}
    </>
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border border-baylink-border/50 bg-white text-left shadow-card transition hover:border-baylink-green/30 hover:bg-gray-50/80 active:scale-[0.99] ${
        hasCover ? 'p-0' : padding
      }`}
    >
      {hasCover && (
        <img
          src={guide.cover}
          alt={`${guide.title} 海报`}
          loading="lazy"
          className="h-[150px] w-full shrink-0 object-cover sm:h-[170px] lg:h-[185px]"
        />
      )}
      {hasCover ? <div className={padding}>{body}</div> : body}
    </button>
  );
};

export const GuideCardMini = ({ guide, onClick }: GuideCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-w-[140px] max-w-[160px] shrink-0 cursor-pointer flex-col rounded-xl border border-baylink-border/50 bg-white p-3 text-left shadow-card transition hover:border-baylink-green/30 active:scale-[0.99] sm:min-w-[150px]"
  >
    <span className="text-xl">{guide.emoji}</span>
    <span className="mt-1 line-clamp-2 text-xs font-semibold text-baylink-text">{guide.title}</span>
    <span className="mt-1 text-[10px] text-baylink-muted">{guide.readMinutes} 分钟</span>
  </button>
);
