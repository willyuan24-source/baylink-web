// Neighbourhood post cards (T15, design.md §4.7): the WEB-UI feed card family — a 1:1 photo (or a coded category cover)
// with the price on it, a two-line title, one meta line (area · posted date) and a status line; ♡ above the stretched
// link. Contact, share and 有用 live on the post sheet. Owners and admins keep their ⋯ menu on the card.
import { useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Armchair, BriefcaseBusiness, Car, Edit, Flag, House, Images, Languages, MapPin, MoreHorizontal, Sparkles, Star, ThumbsUp, Trash2,
  Truck, UserX, Wrench,
} from 'lucide-react';
import '../../components/ui/ui.css';
import './community.css';
import { StatusChip, Sticker, StickerRow } from '../../components/ui/Badges';
import { useUiCopy } from '../../components/ui/ui-copy';
import { isDefaultCoverUrl, normalizePostImages } from '../../lib/constants';
import { postImageUrl } from '../../lib/post-image';
import { postAvailability } from '../../lib/postAvailability';
import type { PostData, UserData } from '../../lib/types';
import { categoryName, FOUNDER_LABEL, isFounderPost, postDate, showCount } from './community-copy';
import { PostSaveHeart } from './PostSaveHeart';
import { usePostTranslation } from './usePostTranslation';
import { usePostVisibility } from './usePostVisibility';
import { PostTranslationNotice } from './PostTranslationNotice';

const categoryIcons: Record<string, typeof House> = {
  租屋: House, 闲置: Armchair, 维修: Wrench, 接送: Car, 兼职: BriefcaseBusiness, 搬家: Truck, 清洁: Sparkles, 翻译: Languages,
};

/** 有用: the count shows from 3 (D20). */
export const UsefulLikeButton = ({ post, onLike, compact = false }: { post: PostData; onLike: (post: PostData) => void; compact?: boolean }) => {
  const { t } = useUiCopy();
  return <button type="button" onClick={(event) => { event.stopPropagation(); onLike(post); }}
    className={`cm-action${compact ? ' cm-action--compact' : ''}`} aria-pressed={post.hasLiked}
    title={post.hasLiked ? t('取消标记有用', 'Unmark as helpful') : t('标记为有用', 'Mark as helpful')}>
    <ThumbsUp aria-hidden="true" strokeWidth={1.75} />{t('有用', 'Helpful')}{showCount(post.likesCount) && <span className="cm-action__count">{post.likesCount}</span>}
  </button>;
};

/**
 * The post's cover: its first photo (Cloudinary-sized), a member-chosen stock cover (系统封面, letterboxed), or a coded
 * category cover (`data-cover="type"`) when there is no image or it fails to load.
 */
export function PostCover({ post, priority, sizes = '(max-width:767px) 50vw, 240px', children }: { post: PostData; priority?: boolean; sizes?: string; children?: ReactNode }) {
  const { t, pick } = useUiCopy();
  const first = normalizePostImages(post)[0] || '';
  const [failed, setFailed] = useState('');
  const loading = priority ? { loading: 'eager' as const, fetchpriority: 'high' } : { loading: 'lazy' as const };
  if (first && failed !== first) {
    const stock = isDefaultCoverUrl(first);
    return <div className="ui-cover cm-cover" data-cover="image" data-fit={stock ? 'contain' : 'cover'}>
      <img className="ui-cover__img" src={stock ? first : postImageUrl(first, 480)} srcSet={stock ? undefined : `${postImageUrl(first, 480)} 480w, ${postImageUrl(first, 960)} 960w`}
        sizes={stock ? undefined : sizes} alt="" decoding="async" onError={() => setFailed(first)} {...loading} />
      {stock && <span className="cm-cover__note">{t('系统封面', 'Stock cover')}</span>}
      {children}
    </div>;
  }
  const Icon = categoryIcons[post.category] || MapPin;
  return <div className="ui-cover cm-cover cm-cover--type" data-cover="type" data-category={post.category}>
    <span className="cm-cover__type" aria-hidden="true"><Icon strokeWidth={1.5} /><span>{pick(categoryName(post.category))}</span></span>
    {children}
  </div>;
}

/** Status line: 待确认有效 / N 天前确认有效 / 已出租, and 站长发布 for the founder's seed posts. */
export function PostStatusLine({ post }: { post: PostData }) {
  const { t, pick, english } = useUiCopy();
  const status = postAvailability(post);
  const label = english ? ({ confirmed: 'Confirmed by poster', unconfirmed: 'Not yet reconfirmed', closed: 'Ended' } as const)[status.tone] : t(status.label, status.label);
  return <p className="cm-status">
    <StatusChip tone={status.tone === 'confirmed' ? 'success' : status.tone === 'closed' ? 'ended' : 'neutral'}><span title={english ? undefined : t(status.detail, status.detail)}>{label}</span></StatusChip>
    {isFounderPost(post) && <span className="cm-status__founder">{pick(FOUNDER_LABEL)}</span>}
  </p>;
}

type PostCardProps = {
  post: PostData; currentUser?: UserData | null; blockedUserIds?: string[];
  /** `grid`: the 1:1 feed card. `list`: one column (My posts, a profile); the feed's own layout switch decides on the board. */
  layout?: 'list' | 'grid';
  /** The first card of the feed (LCP). */
  priority?: boolean;
  onClick?: () => void; onAvatarClick?: (id: string) => void; onImageClick?: (src: string) => void;
  onToggleBlockUser?: (id: string) => void;
  onContactClick?: (post: PostData) => void; onShare?: (post: PostData) => void;
  onLike?: (post: PostData) => void; onEdit?: (post: PostData) => void;
  onDelete?: (post: PostData) => void; onToggleFeature?: (post: PostData) => void; onReport?: (post: PostData) => void;
};

const plainClick = (event: MouseEvent) => !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0;

export const PostCard = ({ post, layout = 'grid', priority, onClick, currentUser, onEdit, onDelete, onToggleFeature, onReport, onToggleBlockUser, blockedUserIds }: PostCardProps) => {
  const { t, english } = useUiCopy();
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation || location;
  const isAdmin = currentUser?.role === 'admin';
  const isOwner = !!currentUser && currentUser.id === post.authorId;
  const canManage = isOwner || isAdmin;
  const [menuOpen, setMenuOpen] = useState(false);
  const { ref, visible } = usePostVisibility();
  const reading = usePostTranslation(post, visible);
  const displayed = reading.display;
  const images = normalizePostImages(post).filter(url => !isDefaultCoverUrl(url));
  const meta = [post.city || t('湾区', 'Bay Area'), `${postDate(post.createdAt, english)} ${t('发布', 'posted')}`].join(' · ');
  const close = () => setMenuOpen(false);
  return <article ref={ref} className="ui-feed-card cm-card" data-layout={layout} data-closed={post.status === 'closed' ? '' : undefined}>
    <h3 className="ui-feed-card__title cm-card__title">
      <Link className="ui-card-link" to={`/posts/${post.id}`} state={{ backgroundLocation }} translate="no"
        onClick={(event) => { if (onClick && plainClick(event)) { event.preventDefault(); onClick(); } }}>{displayed.title}</Link>
    </h3>
    <div className="ui-feed-card__media">
      <PostCover post={post} priority={priority}>
        <StickerRow>
          {post.budget ? <Sticker tone="price" slot="start"><span translate="no">{displayed.budget}</span></Sticker> : null}
          {images.length > 1 ? <Sticker tone="neutral" slot="end"><Images aria-hidden="true" strokeWidth={1.75} className="cm-sticker-icon" />{images.length}</Sticker> : null}
        </StickerRow>
      </PostCover>
    </div>
    <p className="ui-feed-card__meta cm-card__meta">{meta}</p>
    <div className="cm-card__translation"><PostTranslationNotice reading={reading} /></div>
    {post.isFeatured && <p className="cm-card__note"><Star aria-hidden="true" strokeWidth={1.75} />{t('编辑精选', 'Editor’s pick')}</p>}
    <PostStatusLine post={post} />
    <div className="ui-feed-card__save"><PostSaveHeart post={post} title={displayed.title} userId={currentUser?.id} /></div>
    {canManage && <div className="cm-card__menu" onKeyDown={(event) => { if (event.key === 'Escape' && menuOpen) { event.stopPropagation(); close(); } }}>
      <button type="button" className="cm-menu-trigger" aria-label={t('帖子操作', 'Post actions')} aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><MoreHorizontal aria-hidden="true" strokeWidth={1.75} /></button>
      {menuOpen && <>
        <div className="cm-menu-dismiss" onClick={close} />
        <div className="cm-menu" role="group" aria-label={t('帖子操作', 'Post actions')}>
          {!isOwner && onReport && <button type="button" onClick={() => { close(); onReport(post); }}><Flag aria-hidden="true" strokeWidth={1.75} />{t('举报帖子', 'Report post')}</button>}
          {!isOwner && onToggleBlockUser && post.authorId && <button type="button" onClick={() => { close(); onToggleBlockUser(post.authorId); }}><UserX aria-hidden="true" strokeWidth={1.75} />{blockedUserIds?.includes(post.authorId) ? t('取消屏蔽', 'Unblock') : t('屏蔽该用户', 'Block this member')}</button>}
          {isAdmin && <button type="button" onClick={() => { close(); onToggleFeature?.(post); }}><Star aria-hidden="true" strokeWidth={1.75} />{post.isFeatured ? t('取消编辑精选', 'Remove editor’s pick') : t('加入编辑精选', 'Make editor’s pick')}</button>}
          {canManage && onEdit && <button type="button" onClick={() => { close(); onEdit(post); }}><Edit aria-hidden="true" strokeWidth={1.75} />{t('编辑', 'Edit')}</button>}
          {canManage && onDelete && <button type="button" className="cm-menu__danger" onClick={() => { close(); onDelete(post); }}><Trash2 aria-hidden="true" strokeWidth={1.75} />{t('删除', 'Delete')}</button>}
        </div>
      </>}
    </div>}
  </article>;
};
