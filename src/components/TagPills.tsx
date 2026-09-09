export const TagPills = ({ tags, variant = 'profile' }: { tags: string[]; variant?: 'profile' | 'interest' }) => (
  <div className="flex flex-wrap gap-1.5">
    {tags.map((t) => (
      <span
        key={t}
        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
          variant === 'profile'
            ? 'bg-baylink-green/10 text-baylink-green'
            : 'bg-baylink-section/80 text-baylink-text-secondary'
        }`}
      >
        {t}
      </span>
    ))}
  </div>
);
