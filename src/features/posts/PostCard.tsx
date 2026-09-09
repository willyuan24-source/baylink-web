// Feed 帖子卡片 + 「有用」点赞按钮
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PostAvailabilityBadge } from '../../components/PostAvailabilityBadge';
import {
  ThumbsUp, MoreHorizontal, Flag, UserX, Star, Edit, Trash2, Share2, MessageCircle,
} from 'lucide-react';
import Avatar from '../../components/Avatar';
import { TrustBadge } from '../../components/TrustBadge';
import { isPlatformAdmin } from '../../components/UserTrustBadges';
import { isDefaultCoverUrl, normalizePostImages } from '../../lib/constants';
import { formatPostDateLine } from '../../lib/format';
import type { PostData, UserData } from '../../lib/types';

const formatUsefulLabel = (count: number) => (count > 0 ? `有用 ${count}` : '有用');

export const UsefulLikeButton = ({
  post,
  onLike,
  compact = false,
}: {
  post: PostData;
  onLike: (post: PostData) => void;
  compact?: boolean;
}) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onLike(post); }}
    className={`inline-flex items-center gap-0.5 rounded-lg transition active:scale-[0.98] ${
      compact ? 'p-1.5' : 'px-2.5 py-1.5'
    } ${
      post.hasLiked
        ? 'bg-baylink-green/[0.1] text-baylink-green'
        : 'text-baylink-muted hover:bg-baylink-section/60 hover:text-baylink-text-secondary'
    }`}
    title={post.hasLiked ? '取消标记有用' : '标记为有用'}
  >
    <ThumbsUp size={compact ? 14 : 15} className={post.hasLiked ? 'fill-baylink-green/25' : ''} />
    <span className="font-medium text-[11px]">{formatUsefulLabel(post.likesCount)}</span>
  </button>
);

type PostCardProps = {
  post: PostData; currentUser?: UserData | null; blockedUserIds?: string[];
  onClick?: () => void; onAvatarClick?: (id: string) => void; onImageClick?: (src: string) => void;
  onToggleBlockUser?: (id: string) => void;
  onContactClick?: (post: PostData) => void; onShare?: (post: PostData) => void;
  onLike?: (post: PostData) => void; onEdit?: (post: PostData) => void;
  onDelete?: (post: PostData) => void; onToggleFeature?: (post: PostData) => void; onReport?: (post: PostData) => void;
};
export const PostCard = ({ post, onClick, onContactClick, onAvatarClick, onImageClick, onShare, onLike, currentUser, onEdit, onDelete, onToggleFeature, onReport, onToggleBlockUser, blockedUserIds }: PostCardProps) => {
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation || location;
  const isProvider = post.type === 'provider';
  const postImages = normalizePostImages(post);
  const hasImage = postImages.length > 0;
  const coverUrl = hasImage ? postImages[0] : '';
  const isSystemCover = !!coverUrl && isDefaultCoverUrl(coverUrl);
  const isAdmin = currentUser?.role === 'admin';
  const isOwner = currentUser?.id === post.authorId;
  const canManage = currentUser && (isOwner || isAdmin);
  const showReport = !isOwner && !!onReport;
  const hasMenu = showReport || canManage || isAdmin;
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <article onClick={(e) => { if (!(e.target as HTMLElement).closest('a,button,input')) onClick?.(); }} className="surface-card mb-3 overflow-hidden group cursor-pointer transition-all duration-200 hover:shadow-elevated hover:border-baylink-green/10">
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
        <Link to={`/users/${post.authorId}`} state={{ backgroundLocation }} aria-label={`查看 ${post.author.nickname} 的资料`} onClick={(e) => { e.stopPropagation(); if (onAvatarClick && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); onAvatarClick(post.authorId); } }} className="cursor-pointer shrink-0">
            <Avatar src={post.author.avatar} name={post.author.nickname} size={7} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-baylink-text">
            <span className="max-w-full truncate font-medium">{post.author.nickname}</span>
            {!isPlatformAdmin(post.author) && (
              <span className="origin-left scale-90 opacity-80"><TrustBadge user={post.author} size={9} /></span>
            )}
          </div>
          {isPlatformAdmin(post.author) && (
            <div className="mt-0.5"><TrustBadge user={post.author} size={9} showText /></div>
          )}
          <div className="text-[11px] text-baylink-muted">{formatPostDateLine(post)}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${isProvider ? 'bg-baylink-section/80 text-baylink-muted' : 'bg-baylink-green-light/90 text-baylink-green'}`}>
            {isProvider ? '资源' : '需求'}
          </span>
          {hasMenu && (
            <div className="relative">
              <button type="button" aria-label="帖子操作" aria-expanded={menuOpen} onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }} className="p-2 text-baylink-muted hover:text-baylink-text rounded-lg hover:bg-baylink-section/80">
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
                  <div className="absolute right-0 top-full z-20 mt-1 min-w-[120px] rounded-xl border border-baylink-border/60 bg-white py-1 shadow-lg">
                    {showReport && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onReport?.(post); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-baylink-text-secondary hover:bg-baylink-section/60">
                        <Flag size={13} /> 举报帖子
                      </button>
                    )}
                    {showReport && onToggleBlockUser && post.authorId && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleBlockUser(post.authorId); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-baylink-text-secondary hover:bg-baylink-section/60">
                        <UserX size={13} /> {blockedUserIds?.includes(post.authorId) ? '取消屏蔽' : '屏蔽该用户'}
                      </button>
                    )}
                    {isAdmin && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleFeature?.(post); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-amber-700 hover:bg-amber-50">
                        <Star size={13} /> {post.isFeatured ? '取消编辑精选' : '加入编辑精选'}
                      </button>
                    )}
                    {canManage && (
                      <>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit?.(post); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-baylink-text hover:bg-baylink-section/60">
                          <Edit size={13} /> 编辑
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete?.(post); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50">
                          <Trash2 size={13} /> 删除
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="px-4 pb-2.5">
         <h3 className="font-semibold text-base text-baylink-text leading-snug line-clamp-2 mb-1.5"><Link to={`/posts/${post.id}`} state={{ backgroundLocation }} onClick={(e) => { e.stopPropagation(); if (onClick && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); onClick(); } }}>{post.title}</Link></h3>
         <div className="mb-2"><PostAvailabilityBadge post={post} /></div>
         {hasImage ? (
           <div className="relative mb-2.5 overflow-hidden rounded-xl border border-black/[0.04] bg-gradient-to-br from-baylink-section/60 to-baylink-green-light/30">
             <button type="button" className="block w-full" aria-label={`查看 ${post.title} 的图片`} onClick={(e) => { e.stopPropagation(); if (onImageClick) onImageClick(coverUrl); else onClick?.(); }}><img
               src={coverUrl}
               alt={post.title}
               loading="lazy"
               decoding="async"
               className={`aspect-[16/10] w-full ${isSystemCover ? 'object-contain bg-baylink-section/50 p-2' : 'object-cover'}`}
             /></button>
             {isSystemCover && (
               <span className="absolute left-2.5 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-baylink-muted shadow-rest">封面</span>
             )}
           </div>
         ) : null}
         <p className="text-[13px] text-baylink-text-secondary line-clamp-2 leading-relaxed">{post.description}</p>
      </div>
      <div className="px-4 pb-3.5 flex items-center justify-between gap-2 border-t border-black/[0.03] pt-2.5 mx-4 mb-0.5">
         <div className="flex flex-wrap items-center gap-1.5 min-w-0">
           {post.budget && <span className="text-sm font-semibold text-baylink-green truncate">{post.budget}</span>}
           <span className="text-[11px] text-baylink-muted">#{post.category}</span>
         </div>
         <div className="flex items-center gap-0.5 shrink-0">
            {onLike && <UsefulLikeButton post={post} onLike={onLike} compact />}
            {onShare && <button onClick={(e) => { e.stopPropagation(); onShare(post); }} className="inline-flex items-center gap-0.5 rounded-lg p-1.5 text-baylink-muted transition hover:bg-baylink-section/60 hover:text-baylink-text-secondary" title="分享">
              <Share2 size={14}/>
              <span className="text-[11px] font-medium">分享</span>
            </button>}
            {onContactClick && !isOwner && post.status !== 'closed' && <button onClick={(e) => {e.stopPropagation(); onContactClick(post);}} className="text-xs font-semibold border border-baylink-green/25 bg-baylink-green/[0.08] text-baylink-green px-2.5 py-1.5 rounded-lg hover:bg-baylink-green/[0.12] active:scale-[0.98] transition flex items-center gap-1">
              <MessageCircle size={13} /> 私信
            </button>}
         </div>
      </div>
    </article>
  );
};
