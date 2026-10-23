// The post sheet (T20, design.md §4.7): a full-height page over the board — photos, one H1, the price, the poster's
// status, the description, facts and the poster, safety and contact, comments, then 同区同类 3. The contact bar stays at
// the bottom of the screen. While it is open the page under it is hidden (one H1; nothing behind it for a screen reader).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, Edit, Flag, Loader2, MessageCircle, MessageSquare, MoreHorizontal, Send, Share2, Star, Trash2, UserX } from 'lucide-react';
import '../../components/ui/ui.css';
import '../../components/ui/covers.css';
import '../../components/ui/cards.css';
import './community.css';
import { api } from '../../lib/api';
import Avatar from '../../components/Avatar';
import { ModalShell } from '../../components/ui/Modal';
import { useClosing } from '../../components/ui/closing';
import { Button, IconButton } from '../../components/ui/Button';
import { FeedGrid, FeedItem } from '../../components/ui/FeedGrid';
import { useUiCopy } from '../../components/ui/ui-copy';
import { confirmDialog } from '../../components/ui/confirm';
import { TrustBadge } from '../../components/TrustBadge';
import { isPlatformAdmin } from '../../components/UserTrustBadges';
import { CommentThread } from '../../components/CommentThread';
import type { PostComment } from '../../components/CommentItem';
import { PostDetailContactPanel } from '../../components/PostDetailContactPanel';
import { normalizePostImages } from '../../lib/constants';
import { friendlyErrorMessage, isPostEdited } from '../../lib/format';
import type { PostData, UserData } from '../../lib/types';
import { PostCard, PostCover, PostOriginalNote, PostStatusLine, UsefulLikeButton } from './PostCard';
import { PostSaveHeart } from './PostSaveHeart';
import { postAvailability } from '../../lib/postAvailability';
import { setPageMetadata } from '../../lib/seo';
import { usePostTranslation } from './usePostTranslation';
import { PostTranslationNotice } from './PostTranslationNotice';
import { formatPostPrice } from './post-price';
import { ServiceBookingPanel } from '../bookings/ServiceBookingPanel';
import { categoryName, feedTypeNames, isFounderPost, postedOn, regionName, showCount } from './community-copy';
import { CommunityPausedSheet } from './CommunityPaused';
import { COMMUNITY_VISIBLE } from '../../data/site-flags';

const extractQuickTagsFromDescription = (description: string): string[] => {
  const matches = String(description || '').match(/#([^\s#]+)/g) || [];
  return [...new Set(matches.map((m) => m.slice(1).trim()).filter(Boolean))].slice(0, 8);
};
const SERVICE_BOOKING_CATEGORIES = ['清洁', '维修', '接送', '搬家', '翻译', '其他'];

type PostDetailProps = {
  post: PostData; currentUser: UserData | null; onClose: () => void; onLoginNeeded: () => void;
  onContactLoginNeeded?: () => void;
  onOpenChat: (id: string, nickname: string, title: string) => void;
  onOpenUserProfile?: (id: string) => void; onDeleted: () => void;
  onEdit?: (post: PostData) => void; onToggleFeature?: (post: PostData) => void;
  onImageClick: (src: string) => void; onShare: (post: PostData) => void;
  onLike?: (post: PostData) => void; onReport?: (post: PostData) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onToggleBlockUser?: (id: string) => void; blockedUserIds?: string[];
  detailRefreshing?: boolean; onAskBayBay: (question: string) => void;
};

/** While the board is paused (COMMUNITY_VISIBLE = false) a post link opens the paused notice, never the post. */
export const PostDetailModal = (props: PostDetailProps) => COMMUNITY_VISIBLE
  ? <PostDetailSession key={`${props.post.id}:${props.currentUser?.id || 'guest'}`} {...props} />
  : <CommunityPausedSheet postId={props.post.id} onClose={props.onClose} />;

/**
 * 同区同类: three other open posts in the same category — the same area's first, then the rest of the category (closed
 * posts and blocked members' left out). The heading names the area only when every card shown is from it.
 */
export function RelatedPosts({ post, currentUser, blockedUserIds }: { post: PostData; currentUser: UserData | null; blockedUserIds?: string[] }) {
  const { t, pick } = useUiCopy();
  const [state, setState] = useState<{ posts: PostData[]; sameArea: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const blocked = new Set(blockedUserIds || []);
    const usable = (items: PostData[] | undefined) => (items || []).filter(item => item.id !== post.id && item.status !== 'closed' && !blocked.has(item.authorId));
    const query = (limit: number, city?: string) => api.request(`/posts?page=1&limit=${limit}&availability=all&category=${encodeURIComponent(post.category)}${city ? `&city=${encodeURIComponent(city)}` : ''}`) as Promise<{ posts?: PostData[] }>;
    (async () => {
      if (!post.category) { if (!cancelled) setState({ posts: [], sameArea: false }); return; }
      let shown: PostData[] = [];
      try { if (post.city) shown = usable((await query(4, post.city)).posts).slice(0, 3); } catch { /* The category below still fills the row. */ }
      if (shown.length < 3) {
        try {
          const seen = new Set(shown.map(item => item.id));
          shown = [...shown, ...usable((await query(8)).posts).filter(item => !seen.has(item.id))].slice(0, 3);
        } catch { /* Whatever the area query found is shown. */ }
      }
      if (!cancelled) setState({ posts: shown, sameArea: !!post.city && shown.length > 0 && shown.every(item => item.city === post.city) });
    })();
    return () => { cancelled = true; };
  }, [post.id, post.category, post.city, blockedUserIds]);
  if (!state || state.posts.length === 0) return null;
  const name = pick(categoryName(post.category));
  return <section className="cm-sheet__related" aria-labelledby="cm-related-title">
    <h2 className="cm-board__subhead" id="cm-related-title">{state.sameArea ? t(`${pick(regionName(post.city))}的其他${name}信息`, `More ${name.toLowerCase()} posts in ${pick(regionName(post.city))}`) : t(`其他${name}信息`, `More ${name.toLowerCase()} posts`)}</h2>
    <FeedGrid label={t('同区同类', 'Similar posts')} ratio="1:1">
      {state.posts.map(item => <FeedItem key={item.id}><PostCard post={item} layout="grid" currentUser={currentUser} /></FeedItem>)}
    </FeedGrid>
  </section>;
}

/** The post page's exit, --dur-3 (community.css .cm-sheet.is-closing). */
const SHEET_EXIT_MS = 200;

const PostDetailSession = ({ post, onClose, currentUser, onLoginNeeded, onContactLoginNeeded, onOpenChat, onOpenUserProfile, onDeleted, onEdit, onToggleFeature, onImageClick, onShare, onLike, showToast, onReport, onToggleBlockUser, blockedUserIds, detailRefreshing, onAskBayBay }: PostDetailProps) => {
  const { t, pick, english, locale } = useUiCopy();
  // /en, a guest: no translation request (members only, API H10); the post as written, marked 「Original text」 (as the cards).
  const guestOriginal = english && !currentUser && /\p{Script=Han}/u.test(`${post.title}${post.description}${post.budget}${post.timeInfo}`);
  const reading = usePostTranslation(post, !guestOriginal);
  const displayed = reading.display;
  // The price as written, with digit groups (UI9-R1 N06; the card shows the same string).
  const price = post.budget ? formatPostPrice(displayed.budget, locale) : '';
  useEffect(() => {
    setPageMetadata({ title: `${displayed.title}｜BAYLINK`, description: displayed.description.slice(0, 160), path: `/posts/${post.id}`, image: post.imageUrls?.[0], type: 'article', noindex: post.status === 'closed', preserveText: true });
  }, [post, displayed.title, displayed.description, locale]);
  // The page under the sheet is hidden while it is open (community.css): one H1, one page for a screen reader. A layout
  // effect, so the page is visible again before the dialog's own cleanup returns focus to the control that opened it.
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-post-sheet', '');
    return () => document.documentElement.removeAttribute('data-post-sheet');
  }, []);
  // N24 (UI9-R1-POLISH-2): 返回 and Esc play the page's exit first (community.css: it sinks on a
  // phone, fades from 1024px; --dur-3), and the board under it shows again as it starts to leave.
  const [closing, leave] = useClosing(onClose, SHEET_EXIT_MS);
  useLayoutEffect(() => { if (closing) document.documentElement.removeAttribute('data-post-sheet'); }, [closing]);
  const [comments, setComments] = useState<PostComment[]>(post.comments || []);
  const [input, setInput] = useState('');
  const [commentMode, setCommentMode] = useState<
    { type: 'new' } | { type: 'reply'; parentId: string; nickname: string } | { type: 'edit'; commentId: string }
  >({ type: 'new' });
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const active = useRef(true);
  const locallyModified = useRef(false);
  const composing = useRef(false);
  // The sheet opens on its title: read first by a screen reader, and no focus ring on 返回 at load. The dialog focuses
  // its first control in its own effect (a child's effects run first); this one then moves focus to the title.
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, []);

  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  useEffect(() => {
    // A detail request started before a local mutation must not roll the comments back.
    if (!busyRef.current && !locallyModified.current) setComments(post.comments || []);
  }, [post.id, post.comments]);

  const activeCommentCount = comments.filter((c) => !c.isDeleted).length;

  const resetCommentInput = () => {
    setCommentMode({ type: 'new' });
    setInput('');
  };

  const submitComment = async () => {
    if (!currentUser) return onLoginNeeded();
    if (busyRef.current) return;
    // 发送 stays a plain secondary button (no greyed-out state): with nothing typed it puts the cursor in the box.
    if (!input.trim()) { commentInputRef.current?.focus(); return; }
    busyRef.current = true;
    setCommentBusy(true);
    try {
      if (commentMode.type === 'edit') {
        const res = await api.request(`/posts/${post.id}/comments/${commentMode.commentId}`, {
          method: 'PATCH',
          body: JSON.stringify({ content: input.trim() }),
        });
        if (!active.current) return;
        locallyModified.current = true;
        setComments(res.comments || []);
        showToast(t('评论已更新', 'Comment updated'), 'success');
      } else {
        const body: { content: string; parentId?: string } = { content: input.trim() };
        if (commentMode.type === 'reply') body.parentId = commentMode.parentId;
        const res = await api.request(`/posts/${post.id}/comments`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        if (!active.current) return;
        locallyModified.current = true;
        setComments(res.comments || []);
        showToast(commentMode.type === 'reply' ? t('回复已发送', 'Reply sent') : t('评论已发送', 'Comment sent'), 'success');
      }
      resetCommentInput();
    } catch (error) {
      if (active.current) showToast(friendlyErrorMessage(error, t('操作失败，请重试。', 'That didn’t work. Please try again.')), 'error');
    } finally {
      if (active.current) { busyRef.current = false; setCommentBusy(false); }
    }
  };

  const handleReplyComment = (comment: PostComment) => {
    if (busyRef.current) return;
    setCommentMode({ type: 'reply', parentId: comment.id, nickname: comment.authorName });
    setInput('');
  };

  const handleEditComment = (comment: PostComment) => {
    if (busyRef.current) return;
    setCommentMode({ type: 'edit', commentId: comment.id });
    setInput(comment.content);
  };

  const handleDeleteComment = async (comment: PostComment) => {
    if (busyRef.current) return;
    if (!(await confirmDialog({ title: t('删除评论', 'Delete comment'), message: t('确定删除这条评论？', 'Delete this comment?'), confirmText: t('删除', 'Delete'), danger: true }))) return;
    if (!active.current || busyRef.current) return;
    busyRef.current = true;
    setCommentBusy(true);
    try {
      const res = await api.request(`/posts/${post.id}/comments/${comment.id}`, { method: 'DELETE' });
      if (!active.current) return;
      locallyModified.current = true;
      setComments(res.comments || []);
      if (commentMode.type === 'edit' && commentMode.commentId === comment.id) resetCommentInput();
      showToast(t('评论已删除', 'Comment deleted'), 'success');
    } catch (error) {
      if (active.current) showToast(friendlyErrorMessage(error, t('删除失败，请重试。', 'Could not delete. Please try again.')), 'error');
    } finally {
      if (active.current) { busyRef.current = false; setCommentBusy(false); }
    }
  };

  const commentPlaceholder =
    commentMode.type === 'reply'
      ? t(`回复 ${commentMode.nickname}...`, `Reply to ${commentMode.nickname}…`)
      : commentMode.type === 'edit'
        ? t('编辑评论...', 'Edit your comment…')
        : t('写下你的评论...', 'Write a comment…');
  const isAdmin = currentUser?.role === 'admin';
  const isOwner = currentUser?.id === post.authorId;
  const isClosed = post.status === 'closed';
  const showReport = !isOwner;
  const hasMenu = showReport || isAdmin || isOwner;
  const authorName = post.author?.nickname || t('匿名用户', 'Anonymous');
  const authorId = post.authorId;
  const canOpenProfile = !!authorId && !!onOpenUserProfile;
  const imageUrls = normalizePostImages(post);
  const quickTags = extractQuickTagsFromDescription(displayed.description);
  const availability = postAvailability(post);
  const types = feedTypeNames(post.category);

  const openChat = () => {
    if (!currentUser) return (onContactLoginNeeded || onLoginNeeded)();
    onOpenChat(authorId, authorName, post.title);
  };

  const deletePost = async () => {
    if (!(await confirmDialog({ title: t('删除此贴？', 'Delete this post?'), message: t('删除后其他用户将无法再看到这条信息。', 'Other members will no longer see it.'), confirmText: t('删除', 'Delete'), danger: true }))) return;
    if (!active.current || busyRef.current) return;
    busyRef.current = true;
    setCommentBusy(true);
    try {
      await api.request(`/posts/${post.id}`, { method: 'DELETE' });
      if (!active.current) return;
      onDeleted();
      showToast(t('帖子已删除', 'Post deleted'), 'success');
    } catch (error) {
      if (active.current) showToast(friendlyErrorMessage(error, t('删除失败，请重试。', 'Could not delete. Please try again.')), 'error');
    } finally {
      if (active.current) { busyRef.current = false; setCommentBusy(false); }
    }
  };

  const openReport = () => {
    if (!currentUser) return onLoginNeeded();
    setMenuOpen(false);
    onReport?.(post);
  };

  const meta = [post.city ? pick(regionName(post.city)) : '', postedOn(post.createdAt, english), isPostEdited(post) ? t('已编辑', 'edited') : ''].filter(Boolean).join(' · ');

  return (
    <ModalShell onClose={leave} closeOnBackdrop={false} label={displayed.title || t('帖子详情', 'Post')} className={`cm-sheet${closing ? ' is-closing' : ''}`}>
      <header className="cm-sheet__toolbar">
        <button type="button" onClick={leave} className="cm-sheet__back"><ChevronLeft aria-hidden="true" strokeWidth={1.75} />{t('返回', 'Back')}</button>
        <div className="cm-sheet__toolbar-actions">
          <IconButton label={t('分享', 'Share')} onClick={() => onShare(post)}><Share2 aria-hidden="true" strokeWidth={1.75} /></IconButton>
          {hasMenu && <>
            <IconButton label={t('更多操作', 'More actions')} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><MoreHorizontal aria-hidden="true" strokeWidth={1.75} /></IconButton>
            {menuOpen && <>
              <div className="cm-menu-dismiss" onClick={() => setMenuOpen(false)} />
              <div className="cm-menu" role="group" aria-label={t('帖子操作', 'Post actions')}>
                {showReport && <button type="button" onClick={openReport}><Flag aria-hidden="true" strokeWidth={1.75} />{t('举报帖子', 'Report post')}</button>}
                {showReport && onToggleBlockUser && authorId && <button type="button" onClick={() => { setMenuOpen(false); onToggleBlockUser(authorId); }}><UserX aria-hidden="true" strokeWidth={1.75} />{blockedUserIds?.includes(authorId) ? t('取消屏蔽', 'Unblock') : t('屏蔽该用户', 'Block this member')}</button>}
                {isAdmin && <button type="button" onClick={() => { setMenuOpen(false); onToggleFeature?.(post); }}><Star aria-hidden="true" strokeWidth={1.75} />{post.isFeatured ? t('取消编辑精选', 'Remove editor’s pick') : t('加入编辑精选', 'Make editor’s pick')}</button>}
                {(isAdmin || isOwner) && <button type="button" onClick={() => { setMenuOpen(false); onEdit?.(post); }}><Edit aria-hidden="true" strokeWidth={1.75} />{t('编辑', 'Edit')}</button>}
                {(isAdmin || isOwner) && <button type="button" className="cm-menu__danger" onClick={() => { setMenuOpen(false); void deletePost(); }}><Trash2 aria-hidden="true" strokeWidth={1.75} />{t('删除', 'Delete')}</button>}
              </div>
            </>}
          </>}
        </div>
      </header>

      <div className="cm-sheet__scroll">
        <div className="cm-sheet__body">
          {imageUrls.length > 0 && <div className="cm-sheet__gallery" data-single={imageUrls.length === 1 ? '' : undefined}>
            {imageUrls.map((url, index) => <button key={url + index} type="button" className="cm-sheet__photo" onClick={() => onImageClick(url)}
              aria-label={t(`查看第 ${index + 1} 张图片（共 ${imageUrls.length} 张）`, `View photo ${index + 1} of ${imageUrls.length}`)}>
              <PostCover post={{ ...post, imageUrls: [url] }} priority={index === 0} sizes="(max-width:767px) 100vw, 480px">
                {imageUrls.length > 1 && <span className="cm-sheet__count">{index + 1} / {imageUrls.length}</span>}
              </PostCover>
            </button>)}
          </div>}

          <p className="cm-sheet__eyebrow"><span>{pick(categoryName(post.category))}</span><span aria-hidden="true">·</span><span>{pick(types[post.type === 'client' ? 'client' : 'provider'])}</span>
            {post.isFeatured && <><span aria-hidden="true">·</span><span>{t('编辑精选', 'Editor’s pick')}</span></>}</p>
          <h1 translate="no" ref={titleRef} tabIndex={-1}>{displayed.title}</h1>
          {guestOriginal ? <PostOriginalNote /> : <PostTranslationNotice reading={reading} />}
          {price && <p className="cm-sheet__price" translate="no">{price}</p>}
          <div className="cm-sheet__availability"><PostStatusLine post={post} /><p>{english ? (availability.tone === 'confirmed' ? 'Confirmed by the poster; BAYLINK does not guarantee availability or the outcome of a deal.' : availability.tone === 'closed' ? 'The poster has ended this post.' : 'Not reconfirmed recently; ask the poster whether it still stands before you contact them.') : t(availability.detail, availability.detail)}</p></div>
          {detailRefreshing && <p className="cm-sheet__availability" role="status"><Loader2 size={14} className="animate-spin" aria-hidden="true" /> {t('正在同步最新内容…', 'Updating…')}</p>}

          <div className="cm-sheet__columns">
            <div className="cm-sheet__main">
              <section className="cm-sheet__section" aria-labelledby="cm-about-title">
                <h2 id="cm-about-title">{t('关于这条信息', 'About this post')}</h2>
                <p className="cm-sheet__description" translate="no">{displayed.description}</p>
                {quickTags.length > 0 && <p className="cm-sheet__tags" translate="no">{quickTags.map((tag) => <span key={tag}>#{tag}</span>)}</p>}
                <div className="cm-sheet__reactions">
                  <PostSaveHeart post={post} title={displayed.title} userId={currentUser?.id} labelled />
                  {onLike && <UsefulLikeButton post={post} onLike={onLike} />}
                  <Button variant="secondary" className="cm-action" onClick={() => onShare(post)} icon={<Share2 aria-hidden="true" strokeWidth={1.75} />}>{t('分享', 'Share')}</Button>
                </div>
              </section>
              {post.type === 'provider' && SERVICE_BOOKING_CATEGORIES.includes(post.category) && (
                <ServiceBookingPanel post={post} currentUser={currentUser} onLoginNeeded={onLoginNeeded} showToast={showToast} onRequestTime={openChat} />
              )}
            </div>

            <aside className="cm-sheet__aside" aria-label={t('发布者和联系方式', 'Poster and contact')}>
              <div className="cm-sheet__panel">
                {(post.city || post.timeInfo || post.category) && <dl className="cm-sheet__facts">
                  {post.city && <div><dt>{t('地区', 'Area')}</dt><dd>{pick(regionName(post.city))}</dd></div>}
                  {post.timeInfo && <div><dt>{t('时间', 'Timing')}</dt><dd translate="no">{displayed.timeInfo}</dd></div>}
                  {post.category && <div><dt>{t('分类', 'Category')}</dt><dd>{pick(categoryName(post.category))}</dd></div>}
                </dl>}
                <div className="cm-sheet__author">
                  <button type="button" disabled={!canOpenProfile} onClick={() => canOpenProfile && onOpenUserProfile?.(authorId)} className="cm-sheet__avatar" aria-label={canOpenProfile ? t(`查看 ${authorName} 的资料`, `View ${authorName}’s profile`) : undefined}><Avatar src={post.author?.avatar} name={authorName} size={10} /></button>
                  <div>
                    <button type="button" disabled={!canOpenProfile} onClick={() => canOpenProfile && onOpenUserProfile?.(authorId)} className="cm-sheet__author-name"><span translate="no">{authorName}</span><TrustBadge user={post.author} size={12} showText /></button>
                    <p className="cm-sheet__author-meta">{!isFounderPost(post) && isPlatformAdmin(post.author) ? `${t('BAYLINK 平台账号发布', 'Posted by a BAYLINK account')} · ` : ''}{meta}</p>
                  </div>
                </div>
              </div>
              <div className="cm-sheet__panel">
                <PostDetailContactPanel
                  section="contact" post={post} currentUser={currentUser} isOwner={isOwner}
                  onLoginNeeded={onLoginNeeded} onContactLoginNeeded={onContactLoginNeeded} onOpenChat={onOpenChat}
                  authorName={authorName} showToast={showToast} onAskBayBay={onAskBayBay}
                  requestContact={async (postId) => {
                    try {
                      const res = await api.requestPostContact(postId);
                      return { status: res.status, threadId: res.threadId };
                    } catch (error) {
                      if (error && typeof error === 'object' && 'code' in error && error.code === 'VERIFIED_CONTACT_REQUIRED') throw error;
                      const detail = error as { requestStatus?: string; threadId?: string };
                      return { status: detail?.requestStatus || '', error: friendlyErrorMessage(error, t('请求失败', 'The request failed')), threadId: detail?.threadId };
                    }
                  }}
                  approveRequest={(id) => api.approveContactRequest(id)}
                  declineRequest={(id) => api.declineContactRequest(id)}
                />
              </div>
              <div className="cm-sheet__panel">
                <PostDetailContactPanel section="baybay" post={post} currentUser={currentUser} isOwner={isOwner} onLoginNeeded={onLoginNeeded}
                  onOpenChat={onOpenChat} authorName={authorName} showToast={showToast} onAskBayBay={onAskBayBay} requestContact={async () => ({ status: '' })} />
              </div>
            </aside>
          </div>

          <section className="cm-sheet__section cm-sheet__comments" aria-labelledby="cm-comments-title">
            <h2 id="cm-comments-title" className="cm-sheet__comments-head"><MessageSquare aria-hidden="true" strokeWidth={1.75} />{t('邻里聊聊', 'Comments')}{showCount(activeCommentCount) && <span className="cm-action__count">{activeCommentCount}</span>}</h2>
            <CommentThread comments={comments} currentUser={currentUser} onReply={handleReplyComment} onEdit={handleEditComment} onDelete={handleDeleteComment} onLoginNeeded={onLoginNeeded} disabled={commentBusy} />
            <div className="cm-sheet__composer">
              {commentMode.type !== 'new' && <div className="cm-sheet__reply-state"><span>{commentMode.type === 'reply' ? t(`回复 ${commentMode.nickname}`, `Replying to ${commentMode.nickname}`) : t('编辑评论', 'Editing your comment')}</span><Button variant="text" disabled={commentBusy} onClick={resetCommentInput}>{t('取消', 'Cancel')}</Button></div>}
              <div className="cm-sheet__composer-row">
                <input
                  ref={commentInputRef}
                  placeholder={commentPlaceholder}
                  aria-label={commentMode.type === 'reply' ? t(`回复 ${commentMode.nickname}`, `Reply to ${commentMode.nickname}`) : commentMode.type === 'edit' ? t('编辑评论内容', 'Edit comment') : t('评论内容', 'Comment')}
                  disabled={commentBusy}
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  onFocus={() => { if (!currentUser) onLoginNeeded(); }}
                  onCompositionStart={() => { composing.current = true; }}
                  onCompositionEnd={() => { composing.current = false; }}
                  onKeyDown={event => { if (event.key === 'Enter' && !composing.current && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); void submitComment(); } }}
                />
                <Button variant="secondary" onClick={() => void submitComment()} aria-busy={commentBusy || undefined} aria-label={t('发送评论', 'Send comment')} icon={commentBusy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" strokeWidth={1.75} />}>{t('发送', 'Send')}</Button>
              </div>
            </div>
          </section>

          <RelatedPosts post={post} currentUser={currentUser} blockedUserIds={blockedUserIds} />
        </div>
      </div>

      <footer className="cm-sheet__bar">
        {price && <span className="cm-sheet__bar-price" translate="no">{price}</span>}
        {isOwner ? <>
          <p className="cm-sheet__bar-note">{t('这是你发布的信息。私信和联系请求在「消息」里。', 'This is your post. Messages and contact requests are in Messages.')}</p>
          {onEdit && <Button variant="secondary" icon={<Edit aria-hidden="true" strokeWidth={1.75} />} onClick={() => onEdit(post)}>{t('编辑', 'Edit')}</Button>}
        </> : isClosed ? <p className="cm-sheet__bar-note">{t('这条信息已结束，不再接受新的联系。', 'This post has ended and takes no new contact.')}</p>
          : <Button variant="primary" data-contact-action="" icon={<MessageCircle aria-hidden="true" strokeWidth={1.75} />} onClick={openChat}>{currentUser ? t('私信发布者', 'Message the poster') : t('登录后私信发布者', 'Sign in to message')}</Button>}
      </footer>
    </ModalShell>
  );
};
