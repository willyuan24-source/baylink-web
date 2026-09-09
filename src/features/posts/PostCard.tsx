// Shared, responsive post cards. Business actions stay with their existing callers.
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ThumbsUp, MoreHorizontal, Flag, UserX, Star, Edit, Trash2, Share2, MessageCircle,
  MapPin, Images, House, Armchair, Wrench, Car, BriefcaseBusiness, Truck, Sparkles, Languages, ArrowUpRight,
} from 'lucide-react';
import Avatar from '../../components/Avatar';
import { BookmarkButton } from '../../components/BookmarkButton';
import { PostAvailabilityBadge } from '../../components/PostAvailabilityBadge';
import { TrustBadge } from '../../components/TrustBadge';
import { isDefaultCoverUrl, normalizePostImages } from '../../lib/constants';
import { formatChineseDate, isPostEdited } from '../../lib/format';
import type { PostData, UserData } from '../../lib/types';

const formatUsefulLabel = (count: number) => (count > 0 ? `有用 ${count}` : '有用');
const categoryIcons = {
  租屋: House, 闲置: Armchair, 维修: Wrench, 接送: Car, 兼职: BriefcaseBusiness,
  搬家: Truck, 清洁: Sparkles, 翻译: Languages,
};

export const UsefulLikeButton = ({
  post, onLike, compact = false,
}: {
  post: PostData; onLike: (post: PostData) => void; compact?: boolean;
}) => (
  <button
    type="button"
    onClick={(event) => { event.stopPropagation(); onLike(post); }}
    className={`post-action post-action--useful ${compact ? 'post-action--compact' : ''} ${post.hasLiked ? 'is-liked' : ''}`}
    title={post.hasLiked ? '取消标记有用' : '标记为有用'}
    aria-pressed={post.hasLiked}
  >
    <ThumbsUp size={16} className={post.hasLiked ? 'fill-current' : ''} />
    <span>{formatUsefulLabel(post.likesCount)}</span>
  </button>
);

type PostCardProps = {
  post: PostData; currentUser?: UserData | null; blockedUserIds?: string[];
  layout?: 'list' | 'grid';
  onClick?: () => void; onAvatarClick?: (id: string) => void; onImageClick?: (src: string) => void;
  onToggleBlockUser?: (id: string) => void;
  onContactClick?: (post: PostData) => void; onShare?: (post: PostData) => void;
  onLike?: (post: PostData) => void; onEdit?: (post: PostData) => void;
  onDelete?: (post: PostData) => void; onToggleFeature?: (post: PostData) => void; onReport?: (post: PostData) => void;
};

export const PostCard = ({ post, layout = 'list', onClick, onContactClick, onAvatarClick, onImageClick, onShare, onLike, currentUser, onEdit, onDelete, onToggleFeature, onReport, onToggleBlockUser, blockedUserIds }: PostCardProps) => {
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation || location;
  const isProvider = post.type === 'provider';
  const postImages = normalizePostImages(post);
  const coverUrl = postImages[0] || '';
  const isSystemCover = !!coverUrl && isDefaultCoverUrl(coverUrl);
  const CategoryIcon = categoryIcons[post.category as keyof typeof categoryIcons] || MapPin;
  const isAdmin = currentUser?.role === 'admin';
  const isOwner = currentUser?.id === post.authorId;
  const canManage = currentUser && (isOwner || isAdmin);
  const showReport = !isOwner && !!onReport;
  const hasMenu = showReport || canManage || isAdmin;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <article
      onClick={(event) => { if (!(event.target as HTMLElement).closest('a,button,input')) onClick?.(); }}
      className={`post-card post-card--${layout} ${post.status === 'closed' ? 'post-card--closed' : ''}`}
      data-category={post.category}
    >
      <div className="post-card__layout">
        <div className={`post-card__media ${!coverUrl ? 'post-card__media--illustrated' : ''}`}>
          {coverUrl ? (
            <button
              type="button"
              className="post-card__image-button"
              aria-label={`查看 ${post.title} 的图片`}
              onClick={(event) => { event.stopPropagation(); if (onImageClick) onImageClick(coverUrl); else onClick?.(); }}
            >
              <img src={coverUrl} alt={post.title} loading="lazy" decoding="async" className={isSystemCover ? 'post-card__image post-card__image--system' : 'post-card__image'} />
            </button>
          ) : (
            <Link
              to={`/posts/${post.id}`}
              state={{ backgroundLocation }}
              className="post-card__illustration"
              aria-label={`查看 ${post.title}`}
              onClick={(event) => { event.stopPropagation(); if (onClick && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onClick(); } }}
            >
              <CategoryIcon size={44} strokeWidth={1.3} aria-hidden="true" />
              <span>{post.category || '湾区生活'}</span>
              <ArrowUpRight size={20} className="post-card__illustration-arrow" aria-hidden="true" />
            </Link>
          )}
          {post.isFeatured && <span className="post-card__featured"><Star size={12} fill="currentColor" /> 编辑精选</span>}
          {isSystemCover && <span className="post-card__cover-label">系统封面</span>}
          {postImages.length > 1 && <span className="post-card__image-count"><Images size={13} /> {postImages.length}</span>}
        </div>

        <div className="post-card__body">
          <div className="post-card__eyebrow">
            <div className="post-card__categories">
              <span className="post-card__category">{post.category || '湾区生活'}</span>
              <span className={`post-card__type ${!isProvider ? 'post-card__type--request' : ''}`}>{isProvider ? '本地资源' : '邻里需求'}</span>
            </div>
            {hasMenu && (
              <div className="post-card__menu-wrap" onKeyDown={(event) => { if (event.key === 'Escape' && menuOpen) { event.stopPropagation(); setMenuOpen(false); } }}>
                <button type="button" aria-label="帖子操作" aria-expanded={menuOpen} onClick={(event) => { event.stopPropagation(); setMenuOpen((value) => !value); }} className="post-card__menu-trigger"><MoreHorizontal size={19} /></button>
                {menuOpen && (
                  <>
                    <div className="post-card__menu-dismiss" onClick={(event) => { event.stopPropagation(); setMenuOpen(false); }} />
                    <div className="post-card__menu" role="group" aria-label="帖子操作">
                      {showReport && <button type="button" onClick={(event) => { event.stopPropagation(); setMenuOpen(false); onReport?.(post); }}><Flag size={15} /> 举报帖子</button>}
                      {showReport && onToggleBlockUser && post.authorId && <button type="button" onClick={(event) => { event.stopPropagation(); setMenuOpen(false); onToggleBlockUser(post.authorId); }}><UserX size={15} /> {blockedUserIds?.includes(post.authorId) ? '取消屏蔽' : '屏蔽该用户'}</button>}
                      {isAdmin && <button type="button" onClick={(event) => { event.stopPropagation(); setMenuOpen(false); onToggleFeature?.(post); }}><Star size={15} /> {post.isFeatured ? '取消编辑精选' : '加入编辑精选'}</button>}
                      {canManage && <>
                        <button type="button" onClick={(event) => { event.stopPropagation(); setMenuOpen(false); onEdit?.(post); }}><Edit size={15} /> 编辑</button>
                        <button type="button" className="post-card__danger" onClick={(event) => { event.stopPropagation(); setMenuOpen(false); onDelete?.(post); }}><Trash2 size={15} /> 删除</button>
                      </>}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <h3 className="post-card__title" translate="no"><Link to={`/posts/${post.id}`} state={{ backgroundLocation }} onClick={(event) => { event.stopPropagation(); if (onClick && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onClick(); } }}>{post.title}</Link></h3>
          <p className="post-card__description" translate="no">{post.description}</p>
          <div className="post-card__location"><MapPin size={13} aria-hidden="true" /><span>{post.city || '湾区'}</span>{post.timeInfo && <><span aria-hidden="true">·</span><span className="post-card__time" translate="no">{post.timeInfo}</span></>}</div>
          <div className="post-card__value-row">
            {post.budget ? <span className="post-card__price" translate="no">{post.budget}</span> : <span className="post-card__price-note">详情见介绍</span>}
            <PostAvailabilityBadge post={post} />
          </div>
        </div>
      </div>

      <div className="post-card__footer">
        <div className="post-card__author-row">
          <Link to={`/users/${post.authorId}`} state={{ backgroundLocation }} aria-label={`查看 ${post.author.nickname} 的资料`} onClick={(event) => { event.stopPropagation(); if (onAvatarClick && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onAvatarClick(post.authorId); } }} className="post-card__author">
            <Avatar src={post.author.avatar} name={post.author.nickname} size={7} />
            <span className="post-card__author-name" translate="no">{post.author.nickname}</span>
          </Link>
          <TrustBadge user={post.author} size={10} />
          <span className="post-card__date">{formatChineseDate(post.createdAt)}{isPostEdited(post) ? ' · 已编辑' : ''}</span>
        </div>
        <div className="post-card__actions">
          <BookmarkButton post={post} userId={currentUser?.id} />
          {onLike && <UsefulLikeButton post={post} onLike={onLike} compact />}
          {onShare && <button type="button" onClick={(event) => { event.stopPropagation(); onShare(post); }} className="post-action" title="分享帖子"><Share2 size={15} /><span>分享</span></button>}
          {onContactClick && !isOwner && post.status !== 'closed' && <button type="button" onClick={(event) => { event.stopPropagation(); onContactClick(post); }} className="post-action post-action--contact"><MessageCircle size={15} /><span>私信</span></button>}
        </div>
      </div>
    </article>
  );
};
