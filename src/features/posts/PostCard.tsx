// Neighbourhood post cards (T15, design.md §4.7): the WEB-UI feed card family — a 1:1 photo (or a coded category cover),
// a two-line title, the price line (UI9-R1: text under the title, as DECISIONS 21 puts every price; grouped, N06), one
// meta line (area · posted date) and a status line. On the photo only ♡ and one sticker (N22): the photo count, or 系统封面
// on a stock cover. Contact, share and 有用 live on the post sheet. Owners and admins keep their ⋯ menu on the card.
import { useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Armchair, BriefcaseBusiness, Car, Edit, Flag, House, Images, Languages, MapPin, MoreHorizontal, Sparkles, Star, ThumbsUp, Trash2,
  Truck, UserX, Wrench,
} from 'lucide-react';
import '../../components/ui/ui.css';
import '../../components/ui/covers.css';
import '../../components/ui/cards.css';
import './community.css';
import { StatusChip, Sticker, StickerRow } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { useUiCopy } from '../../components/ui/ui-copy';
import { isDefaultCoverUrl, normalizePostImages } from '../../lib/constants';
import { postImageUrl } from '../../lib/post-image';
import { postAvailability } from '../../lib/postAvailability';
import type { PostData, UserData } from '../../lib/types';
import { categoryName, FOUNDER_LABEL, isFounderPost, postedOn, regionName, showCount } from './community-copy';
import { PostSaveHeart } from './PostSaveHeart';
import { usePostTranslation } from './usePostTranslation';
import { usePostVisibility } from './usePostVisibility';
import { PostTranslationNotice } from './PostTranslationNotice';
import { formatPostPrice } from './post-price';

const categoryIcons: Record<string, typeof House> = {
  租屋: House, 闲置: Armchair, 维修: Wrench, 接送: Car, 兼职: BriefcaseBusiness, 搬家: Truck, 清洁: Sparkles, 翻译: Languages,
};

/** 有用 (the WEB-UI secondary button): the count shows from 3 (D20). */
export const UsefulLikeButton = ({ post, onLike }: { post: PostData; onLike: (post: PostData) => void }) => {
  const { t } = useUiCopy();
  return <Button variant="secondary" className="cm-action" aria-pressed={!!post.hasLiked} onClick={(event) => { event.stopPropagation(); onLike(post); }}
    title={post.hasLiked ? t('取消标记有用', 'Unmark as helpful') : t('标记为有用', 'Mark as helpful')} icon={<ThumbsUp aria-hidden="true" strokeWidth={1.75} />}>
    {t('有用', 'Helpful')}{showCount(post.likesCount) && <span className="cm-action__count">{post.likesCount}</span>}
  </Button>;
};

/**
 * The post's cover: its first photo (Cloudinary-sized), a member-chosen stock cover (系统封面, letterboxed), or a coded
 * category cover (`data-cover="post-category"`: a member post, not a listing) when there is no image or it fails to load.
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
  return <div className="ui-cover cm-cover cm-cover--type" data-cover="post-category" data-category={post.category}>
    <span className="cm-cover__type" aria-hidden="true"><Icon strokeWidth={1.5} /><span>{pick(categoryName(post.category))}</span></span>
    {children}
  </div>;
}

/** The post has Chinese text an English reader would otherwise have translated (usePostTranslation's own test). */
export const writtenInChinese = ({ title, description, budget, timeInfo }: Pick<PostData, 'title' | 'description' | 'budget' | 'timeInfo'>) =>
  /\p{Script=Han}/u.test(`${title}${description}${budget}${timeInfo}`);

/** /en, a guest: the post is shown as its poster wrote it (UI9-R1-POLISH-2; the card and the post page). On the post page
 * `onSignIn` adds the way forward, as a member's 「Original text · Show translation」 line (members translate, API H10). */
export function PostOriginalNote({ onSignIn }: { onSignIn?: () => void }) {
  return <div className="post-translation" lang="en" data-post-original=""><span><Languages size={13} aria-hidden="true" />Original text</span>
    {onSignIn && <button type="button" onClick={event => { event.stopPropagation(); onSignIn(); }}>Sign in to translate</button>}</div>;
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
  /**
   * `grid`: the 1:1 card inside a WEB-UI FeedGrid (the board, 同区同类; the grid's own switch sets its columns).
   * `list` (the default): a row with a small thumbnail, for a plain list outside a feed grid (我的发布).
   */
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

export const PostCard = ({ post, layout = 'list', priority, onClick, currentUser, onEdit, onDelete, onToggleFeature, onReport, onToggleBlockUser, blockedUserIds }: PostCardProps) => {
  const { t, pick, english, locale } = useUiCopy();
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation || location;
  const isAdmin = currentUser?.role === 'admin';
  const isOwner = !!currentUser && currentUser.id === post.authorId;
  const canManage = isOwner || isAdmin;
  const [menuOpen, setMenuOpen] = useState(false);
  const { ref, visible } = usePostVisibility();
  // /en: a guest's card asks for no translation (the API generates for members only and answers a guest's uncached post
  // with 403, H10), so it shows the post as written with a quiet 「Original text」 line instead of a failed translation.
  const guestOriginal = english && !currentUser && writtenInChinese(post);
  const reading = usePostTranslation(post, visible && !guestOriginal);
  const displayed = reading.display;
  const all = normalizePostImages(post);
  const images = all.filter(url => !isDefaultCoverUrl(url));
  // A stock cover already carries its 系统封面 note, and an owner's or admin's card its ⋯ menu: no photo count beside them
  // (on the photo ♡ + one more control or sticker, N22).
  const photoCount = canManage || (all[0] && isDefaultCoverUrl(all[0])) ? 0 : images.length;
  const price = post.budget ? formatPostPrice(displayed.budget, locale) : '';
  const meta = [post.city ? pick(regionName(post.city)) : t('湾区', 'Bay Area'), postedOn(post.createdAt, english)].filter(Boolean).join(' · ');
  const close = () => setMenuOpen(false);
  return <article ref={ref} className="ui-feed-card cm-card" data-layout={layout} data-closed={post.status === 'closed' ? '' : undefined}>
    <h3 className="ui-feed-card__title cm-card__title">
      <Link className="ui-card-link" to={`/posts/${post.id}`} state={{ backgroundLocation }} translate="no"
        onClick={(event) => { if (onClick && plainClick(event)) { event.preventDefault(); onClick(); } }}>{displayed.title}</Link>
    </h3>
    <div className="ui-feed-card__media">
      <PostCover post={post} priority={priority}>
        {photoCount > 1 ? <StickerRow><Sticker tone="neutral" slot="end"><Images aria-hidden="true" strokeWidth={1.75} className="cm-sticker-icon" />
          <span className="sr-only">{t('照片', 'Photos')} </span>{photoCount}</Sticker></StickerRow> : null}
      </PostCover>
    </div>
    {price ? <p className="cm-card__price" translate="no">{price}</p> : null}
    <p className="ui-feed-card__meta cm-card__meta">{meta}</p>
    <div className="cm-card__translation">{guestOriginal ? <PostOriginalNote /> : <PostTranslationNotice reading={reading} />}</div>
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
