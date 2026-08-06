// 骨架屏原语与常用形态：替代全局 spinner，让加载中也保持页面结构
export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded-lg bg-baylink-section/70 ${className}`} />
);

/** 与 PostCard 同构的骨架：头像行 + 标题 + 图区 + 摘要 + 底栏 */
export const PostCardSkeleton = ({ withImage = true }: { withImage?: boolean }) => (
  <div className="surface-card mb-3 overflow-hidden" aria-hidden="true">
    <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
      <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2.5 w-32" />
      </div>
      <Skeleton className="h-5 w-12 shrink-0 rounded-full" />
    </div>
    <div className="px-4 pb-2.5">
      <Skeleton className="mb-2 h-4 w-3/4" />
      {withImage && <Skeleton className="mb-2.5 aspect-[16/10] w-full rounded-xl" />}
      <Skeleton className="h-3 w-full" />
      <Skeleton className="mt-1.5 h-3 w-2/3" />
    </div>
    <div className="mx-4 mb-0.5 flex items-center justify-between border-t border-black/[0.03] px-0 pb-3.5 pt-2.5">
      <Skeleton className="h-3.5 w-16" />
      <Skeleton className="h-7 w-28 rounded-lg" />
    </div>
  </div>
);

export const FeedSkeleton = ({ count = 3 }: { count?: number }) => (
  <div aria-busy="true" aria-label="内容加载中">
    {Array.from({ length: count }, (_, i) => (
      // 首卡带图占位、其余收紧，模拟真实 feed 密度
      <PostCardSkeleton key={i} withImage={i === 0} />
    ))}
  </div>
);

/** 热门推荐骨架（媒体卡片网格） */
export const HotRecommendSkeleton = () => (
  <div className="hot-recommend-grid" aria-busy="true" aria-label="热门推荐加载中">
    {Array.from({ length: 3 }, (_, i) => (
      <div key={i} className="hot-recommend-card" aria-hidden="true">
        <Skeleton className="hot-recommend-media rounded-none" />
        <div className="hot-recommend-body space-y-1.5">
          <Skeleton className="h-3.5 w-12 rounded-md" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-2.5 w-3/4" />
        </div>
      </div>
    ))}
  </div>
);

/** 会话列表骨架 */
export const ConversationListSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="space-y-3" aria-busy="true" aria-label="会话加载中">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="surface-card flex min-h-[72px] items-center gap-3.5 p-4" aria-hidden="true">
        <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-3.5 w-4/5" />
        </div>
      </div>
    ))}
  </div>
);

/** 用户名片骨架（弹层内） */
export const ProfileCardSkeleton = () => (
  <div className="py-2" aria-busy="true" aria-label="资料加载中" aria-hidden="true">
    <div className="rounded-2xl border border-baylink-border/40 bg-white p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <Skeleton className="h-[18px] w-32" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <Skeleton className="mt-3 h-3 w-full" />
      <Skeleton className="mt-1.5 h-3 w-2/3" />
    </div>
    <div className="mt-3 space-y-2 rounded-xl border border-baylink-border/40 bg-white p-3">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  </div>
);
