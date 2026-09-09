// 首页区块组件：筛选 chips / Hero / 频道 / 编辑精选 / 精选帖 / feed 切换 / 空态
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSlugFromCategory } from '../../routing';
import { ArrowDown, ArrowUpRight, Building2, CarFront, HeartHandshake, Sofa, Sparkles, Shield, Clock, BookOpen, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { CATEGORY_EMOJI, HOME_CHANNELS, normalizePostImages } from '../../lib/constants';
import { formatChineseDate } from '../../lib/format';
import type { PostData, PostType, UserData } from '../../lib/types';
import { PostCard } from '../posts/PostCard';
import { FeedSkeleton, HotRecommendSkeleton } from '../../components/ui/Skeleton';

export const FilterTag = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
  <button type="button" onClick={onClick} aria-pressed={active} className={`chip ${active ? 'chip-active' : 'chip-inactive'}`}>{label}</button>
);

export const CategoryChip = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => {
  const emoji = CATEGORY_EMOJI[label];
  const display = label === '全部' ? '全部' : emoji ? `${emoji} ${label}` : label;
  const slug = getSlugFromCategory(label);
  return <Link to={slug ? `/category/${slug}` : '/'} aria-current={active ? 'page' : undefined} onClick={(event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onClick(); } }} className={`chip ${active ? 'chip-active' : 'chip-inactive'}`}>{display}</Link>;
};

const HotRecommendCover = ({ coverType, isDemo }: { coverType: 'rent' | 'used' | 'service'; isDemo?: boolean }) => (
  <div className={`hot-cover hot-cover--${coverType}`} aria-hidden="true">
    {isDemo && <span className="hot-cover-badge">示例推荐</span>}
    {coverType === 'rent' && (
      <>
        <span className="hot-cover-el hot-cover-wall" />
        <span className="hot-cover-el hot-cover-window" />
        <span className="hot-cover-el hot-cover-sofa" />
        <span className="hot-cover-el hot-cover-floor" />
      </>
    )}
    {coverType === 'used' && (
      <>
        <span className="hot-cover-el hot-cover-wall-warm" />
        <span className="hot-cover-el hot-cover-sofa-lg" />
        <span className="hot-cover-el hot-cover-table" />
      </>
    )}
    {coverType === 'service' && (
      <>
        <span className="hot-cover-el hot-cover-window-svc" />
        <span className="hot-cover-el hot-cover-spray" />
        <span className="hot-cover-el hot-cover-bucket" />
      </>
    )}
  </div>
);

export const BayHero = ({ onPublishNeed, onBrowseResources }: { onPublishNeed: () => void; onBrowseResources: () => void }) => (
  <section className="bay-hero" aria-label="连接湾区生活">
    <div className="bay-hero-copy">
      <span className="bay-hero-eyebrow"><span /> LOCAL LIFE, BETTER CONNECTED</span>
      <h1>在湾区，<br />找到生活的<span>更多可能。</span></h1>
      <p>一个家，一份好物，一位靠谱的邻居。<br className="hidden sm:block" />你需要的生活连接，都从这里开始。</p>
      <div className="bay-hero-actions"><button type="button" onClick={onBrowseResources} className="bay-button-dark">探索身边的好信息<ArrowDown size={16} /></button><button type="button" onClick={onPublishNeed} className="bay-button-text">发布我的需求<ArrowUpRight size={17} /></button></div>
    </div>
    <div className="bay-hero-art"><img src="/brand/bay-area-diorama-v2.webp" alt="金门大桥、海湾与湾区街屋组成的微缩景观" width="1254" height="1254" {...{ fetchpriority: 'high' }} /><span className="bay-hero-coordinate">37.8199° N &nbsp; 122.4783° W</span></div>
    <div className="bay-hero-sticker"><span className="bay-hero-sticker-icon"><HeartHandshake size={19} /></span><span>让附近，变得更亲近<small>Good things happen locally.</small></span></div>
  </section>
);

const channelIcons = { rent: Building2, used: Sofa, service: HeartHandshake, ride: CarFront, featured: Sparkles };
export const ChannelShortcuts = ({ onChannel }: { onChannel: (ch: typeof HOME_CHANNELS[number]) => void }) => (
  <section className="bay-channels" aria-label="探索生活分类">
    {HOME_CHANNELS.map((channel, index) => {
      const Icon = channelIcons[channel.id as keyof typeof channelIcons];
      return <button key={channel.id} type="button" onClick={() => onChannel(channel)} className={`bay-channel bay-channel--${channel.id}`}><span className="bay-channel-icon"><Icon size={24} strokeWidth={1.6} /></span><span className="bay-channel-text"><strong>{channel.title}</strong><small>{channel.sub.replace(/ \/ /g, ' · ')}</small></span><span className="bay-channel-index">0{index + 1}</span><ArrowUpRight size={15} className="bay-channel-arrow" /></button>;
    })}
  </section>
);

export const HotRecommendCard = ({ tag, title, desc, price, location, imageUrl, isDemo, isFeatured, coverType, onClick }: {
  tag: string; title: string; desc: string; price?: string; location?: string;
  imageUrl?: string; isDemo?: boolean; isFeatured?: boolean; coverType?: 'rent' | 'used' | 'service';
  onClick?: () => void;
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = imageUrl && !imgFailed;
  return (
  <article
    className={`hot-recommend-card ${onClick ? 'cursor-pointer hover:border-baylink-green/25' : ''}`}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
  >
    <div className="hot-recommend-media">
      {showImage ? (
        <img src={imageUrl} alt="" loading="lazy" decoding="async" className="hot-recommend-img" onError={() => setImgFailed(true)} />
      ) : coverType ? (
        <HotRecommendCover coverType={coverType} isDemo={isDemo} />
      ) : (
        <div className="hot-cover hot-cover--default" aria-hidden="true" />
      )}
    </div>
    <div className="hot-recommend-body">
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-px text-[11px] font-semibold ${isDemo ? 'bg-baylink-section text-baylink-muted' : isFeatured ? 'bg-amber-50 text-amber-700' : 'bg-baylink-green-light text-baylink-green'}`}>
          {isDemo ? tag : isFeatured ? <><Sparkles size={8} /> 精选</> : <><Shield size={8} /> {tag || '官方'}</>}
        </span>
      </div>
      <h4 className="line-clamp-2 text-[13px] font-bold leading-snug text-baylink-text lg:line-clamp-1">{title}</h4>
      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-baylink-muted">{desc}</p>
      {price && <p className="mt-1 text-[13px] font-bold text-baylink-green lg:mt-1.5">{price}</p>}
      {location && <p className="mt-0.5 flex items-center gap-0.5 text-[11px] text-baylink-muted"><Clock size={9} />{location}</p>}
    </div>
  </article>
  );
};

export const HotRecommend = ({ onOpenPost, refreshKey, onViewMore, onPublish, onAskBayBay }: {
  onOpenPost: (post: PostData) => void;
  refreshKey?: number;
  onViewMore?: () => void;
  onPublish?: () => void;
  onAskBayBay?: () => void;
}) => {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.request('/posts/featured?limit=3');
        setPosts(res.posts || []);
      } catch (e) {
        console.error('fetch featured', e);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshKey]);

  const gridColsClass =
    posts.length === 1 ? 'hot-recommend-grid--cols-1' : posts.length === 2 ? 'hot-recommend-grid--cols-2' : '';

  return (
    <section className="mb-1.5 sm:mb-3">
      <div className="mb-1 flex items-start justify-between gap-2 px-0.5 sm:mb-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1 text-[13px] font-semibold text-baylink-text sm:text-sm">
            <Sparkles size={14} className="text-baylink-green sm:w-[15px] sm:h-[15px]" /> 编辑精选
          </h3>
          <p className="mt-0.5 hidden text-[11px] text-baylink-muted sm:block">编辑选取的信息，请联系发布者确认现状</p>
        </div>
        {onViewMore && (
          <button type="button" onClick={onViewMore} className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-baylink-green transition hover:bg-baylink-green-light active:scale-95 sm:text-xs">
            更多
          </button>
        )}
      </div>
      {loading ? (
        <HotRecommendSkeleton />
      ) : posts.length > 0 ? (
        <div className={`hot-recommend-grid ${gridColsClass}`.trim()}>
          {posts.map((post) => {
            const imgs = normalizePostImages(post);
            return (
              <HotRecommendCard
                key={post.id}
                tag={post.category}
                title={post.title}
                desc={post.description}
                price={post.budget}
                location={`${post.city} · ${formatChineseDate(post.createdAt)}`}
                imageUrl={imgs[0]}
                isFeatured
                onClick={() => onOpenPost(post)}
              />
            );
          })}
        </div>
      ) : (
        <div className="hot-recommend-empty">
          <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-baylink-green-light ring-1 ring-baylink-green/15">
            <Sparkles size={18} className="text-baylink-green" />
          </div>
          <p className="text-[13px] font-semibold text-baylink-text">暂时还没有编辑精选</p>
          <p className="mx-auto mt-1 max-w-[260px] text-[11px] leading-relaxed text-baylink-muted">
            你可以先浏览最新发布，或者让 BayBay 帮你找合适的信息。
          </p>
          {(onAskBayBay || onPublish) && (
            <div className="mt-3 flex justify-center gap-2">
              {onAskBayBay && (
                <button type="button" onClick={onAskBayBay} className="rounded-xl border border-baylink-green/20 bg-baylink-green-light px-3.5 py-2 text-[11px] font-semibold text-baylink-green transition hover:bg-baylink-green/[0.12] active:scale-95">
                  问问 BayBay
                </button>
              )}
              {onPublish && (
                <button type="button" onClick={onPublish} className="rounded-xl border border-black/[0.06] bg-white/90 px-3.5 py-2 text-[11px] font-semibold text-baylink-text transition hover:bg-baylink-section/40 active:scale-95">
                  发布需求
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export const FeaturedPostsSection = ({ onOpenPost, refreshKey, compact, currentUser, onToggleFeature, onOpenProfile, onLike }: {
  onOpenPost: (post: PostData) => void;
  refreshKey?: number;
  compact?: boolean;
  currentUser?: UserData | null;
  onToggleFeature?: (post: PostData) => void;
  onOpenProfile?: (userId: string) => void;
  onLike?: (post: PostData, onSynced?: (postId: string, liked: boolean, likesCount: number) => void) => void;
}) => {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.request('/posts/featured');
        setPosts(res.posts || []);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshKey]);

  if (loading) {
    return <FeedSkeleton count={2} />;
  }
  if (posts.length === 0) {
    return (
      <div className="mb-6 rounded-2xl border border-dashed border-baylink-border bg-white p-6 text-center">
        <Sparkles size={22} className="mx-auto mb-2 text-baylink-muted opacity-50" />
        <p className="text-sm font-semibold text-baylink-text-secondary">暂无编辑精选</p>
        <p className="mt-1 text-[11px] leading-relaxed text-baylink-muted">编辑选取的帖子会显示在这里，入选不代表平台担保</p>
      </div>
    );
  }
  return (
    <div className={compact ? 'mb-6 space-y-3' : 'mb-6 grid grid-cols-1 gap-3 md:grid-cols-2'}>
      {posts.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          currentUser={currentUser}
          onToggleFeature={onToggleFeature}
          onClick={() => onOpenPost(p)}
          onAvatarClick={onOpenProfile}
          onLike={(post: PostData) => onLike?.(post, (postId, liked, likesCount) => {
            setPosts((prev) => prev.map((x) => (x.id === postId ? { ...x, hasLiked: liked, likesCount } : x)));
          })}
        />
      ))}
    </div>
  );
};

export const FeedSwitch = ({ feedType, onClient, onProvider }: { feedType: PostType, onClient: () => void, onProvider: () => void }) => (
  <div className="bay-feed-tabs" role="group" aria-label="信息类型">
    <button type="button" onClick={onProvider} aria-pressed={feedType === 'provider'} className={feedType === 'provider' ? 'is-active' : ''}><Building2 size={17} /><span>本地资源</span><small>发现好物与服务</small></button>
    <button type="button" onClick={onClient} aria-pressed={feedType === 'client'} className={feedType === 'client' ? 'is-active' : ''}><HeartHandshake size={17} /><span>邻里需求</span><small>把需要连接起来</small></button>
  </div>
);

export const EmptyFeed = ({ feedType, onPublishService, onPublishInfo, keyword, onOpenGuides, onAskBayBay }: {
  feedType: PostType;
  onPublishService: () => void;
  onPublishInfo: () => void;
  keyword?: string;
  onOpenGuides?: () => void;
  onAskBayBay?: () => void;
}) => {
  if (keyword?.trim()) {
    return (
      <div className="py-5 px-4 text-center bg-white rounded-2xl border border-baylink-border/50 shadow-sm">
        <p className="text-sm font-medium text-baylink-text mb-0.5">没有找到相关内容</p>
        <p className="text-xs text-baylink-muted">换个关键词试试，或浏览其他分类</p>
      </div>
    );
  }
  const secondaryActions = (onOpenGuides || onAskBayBay) && (
    <div className="mt-2.5 flex justify-center gap-2 text-[11px]">
      {onOpenGuides && (
        <button onClick={onOpenGuides} className="inline-flex items-center gap-1 rounded-lg border border-baylink-border/60 bg-white px-3 py-1.5 font-medium text-baylink-text-secondary transition hover:border-baylink-green/30 hover:text-baylink-green">
          <BookOpen size={12} /> 先看湾区指南
        </button>
      )}
      {onAskBayBay && (
        <button onClick={onAskBayBay} className="inline-flex items-center gap-1 rounded-lg border border-baylink-green/20 bg-baylink-green-light/60 px-3 py-1.5 font-medium text-baylink-green transition hover:bg-baylink-green-light">
          <Sparkles size={12} /> 问问 BayBay
        </button>
      )}
    </div>
  );
  return feedType === 'provider' ? (
    <div className="py-6 px-4 text-center bg-white rounded-2xl border border-baylink-border/50 shadow-sm">
      <p className="text-sm font-medium text-baylink-text mb-0.5">这个分类还没有资源</p>
      <p className="text-xs text-baylink-muted mb-3">提供你的服务、房源或二手资源，让附近的人找到你</p>
      <button onClick={onPublishService} className="btn-primary px-5 py-2 text-xs inline-flex items-center gap-1.5"><Plus size={14}/> 提供服务</button>
      {secondaryActions}
    </div>
  ) : (
    <div className="py-6 px-4 text-center bg-white rounded-2xl border border-baylink-border/50 shadow-sm">
      <p className="text-sm font-medium text-baylink-text mb-0.5">还没有新的需求</p>
      <p className="text-xs text-baylink-muted mb-3">附近的需求会显示在这里，你也可以先把自己的需求发出来</p>
      <button onClick={onPublishInfo} className="btn-primary px-5 py-2 text-xs inline-flex items-center gap-1.5"><Plus size={14}/> 发布信息</button>
      {secondaryActions}
    </div>
  );
};
