// 帖子详情全屏覆盖层（评论 / 联系请求 / 分享 / 管理菜单）
import { useState, useEffect, useRef } from 'react';
import {
  X, Share2, MoreHorizontal, Flag, UserX, Star, Edit, Trash2, Loader2,
  MessageSquare, Send, MessageCircle,
} from 'lucide-react';
import { api } from '../../lib/api';
import Avatar from '../../components/Avatar';
import { ModalShell } from '../../components/ui/Modal';
import { confirmDialog } from '../../components/ui/confirm';
import { TrustBadge } from '../../components/TrustBadge';
import { isPlatformAdmin } from '../../components/UserTrustBadges';
import { CommentThread } from '../../components/CommentThread';
import type { PostComment } from '../../components/CommentItem';
import { PostDetailContactPanel } from '../../components/PostDetailContactPanel';
import { isDefaultCoverUrl, normalizePostImages } from '../../lib/constants';
import { formatChineseDate, formatProfileLocation, friendlyErrorMessage, isPostEdited } from '../../lib/format';
import type { PostData, UserData } from '../../lib/types';
import { UsefulLikeButton } from './PostCard';
import { PostAvailabilityBadge } from '../../components/PostAvailabilityBadge';
import { postAvailability } from '../../lib/postAvailability';

const extractQuickTagsFromDescription = (description: string): string[] => {
  const matches = String(description || '').match(/#([^\s#]+)/g) || [];
  return [...new Set(matches.map((m) => m.slice(1).trim()).filter(Boolean))].slice(0, 8);
};

/**
 * 帖子 meta 行只描述帖子本身（地区 · 分类 · 日期），不放作者身份。
 * 「官方认证 / 已验证 / 管理员」只以徽章形式跟在作者名字旁边，避免看起来像平台背书这条帖子。
 */
const formatPostDetailAuthorMeta = (post: PostData) => {
  const author = post.author as PostData['author'] & {
    city?: string;
    area?: string;
  };
  const location =
    post.city?.trim() ||
    author.city?.trim() ||
    author.area?.trim() ||
    formatProfileLocation(author.area, author.city) ||
    '';
  const parts = [location, post.category?.trim(), formatChineseDate(post.createdAt)];
  if (isPostEdited(post)) parts.push('已编辑');
  return parts.filter((p) => p && String(p).trim()).join(' · ');
};

type PostDetailProps = {
  post: PostData; currentUser: UserData | null; onClose: () => void; onLoginNeeded: () => void;
  onOpenChat: (id: string, nickname: string, title: string) => void;
  onOpenUserProfile?: (id: string) => void; onDeleted: () => void;
  onEdit?: (post: PostData) => void; onToggleFeature?: (post: PostData) => void;
  onImageClick: (src: string) => void; onShare: (post: PostData) => void;
  onLike?: (post: PostData) => void; onReport?: (post: PostData) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onToggleBlockUser?: (id: string) => void; blockedUserIds?: string[];
  detailRefreshing?: boolean; onAskBayBay: (question: string) => void;
};

export const PostDetailModal = (props: PostDetailProps) => (
  <PostDetailSession key={`${props.post.id}:${props.currentUser?.id || 'guest'}`} {...props} />
);

const PostDetailSession = ({ post, onClose, currentUser, onLoginNeeded, onOpenChat, onOpenUserProfile, onDeleted, onEdit, onToggleFeature, onImageClick, onShare, onLike, showToast, onReport, onToggleBlockUser, blockedUserIds, detailRefreshing, onAskBayBay }: PostDetailProps) => {
  const [comments, setComments] = useState<PostComment[]>(post.comments || []);
  const [input, setInput] = useState('');
  const [commentMode, setCommentMode] = useState<
    { type: 'new' } | { type: 'reply'; parentId: string; nickname: string } | { type: 'edit'; commentId: string }
  >({ type: 'new' });
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const busyRef = useRef(false);
  const active = useRef(true);
  const locallyModified = useRef(false);
  const composing = useRef(false);

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
    if (!input.trim() || busyRef.current) return;
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
        showToast('评论已更新', 'success');
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
        showToast(commentMode.type === 'reply' ? '回复已发送' : '评论已发送', 'success');
      }
      resetCommentInput();
    } catch (error) {
      if (active.current) showToast(friendlyErrorMessage(error, '操作失败，请重试。'), 'error');
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
    if (!(await confirmDialog({ title: '删除评论', message: '确定删除这条评论？', confirmText: '删除', danger: true }))) return;
    if (!active.current || busyRef.current) return;
    busyRef.current = true;
    setCommentBusy(true);
    try {
      const res = await api.request(`/posts/${post.id}/comments/${comment.id}`, { method: 'DELETE' });
      if (!active.current) return;
      locallyModified.current = true;
      setComments(res.comments || []);
      if (commentMode.type === 'edit' && commentMode.commentId === comment.id) resetCommentInput();
      showToast('评论已删除', 'success');
    } catch (error) {
      if (active.current) showToast(friendlyErrorMessage(error, '删除失败，请重试。'), 'error');
    } finally {
      if (active.current) { busyRef.current = false; setCommentBusy(false); }
    }
  };

  const commentPlaceholder =
    commentMode.type === 'reply'
      ? `回复 ${commentMode.nickname}...`
      : commentMode.type === 'edit'
        ? '编辑评论...'
        : '写下你的评论...';
  const isAdmin = currentUser?.role === 'admin';
  const isOwner = currentUser?.id === post.authorId;
  const showReport = !isOwner;
  const hasMenu = showReport || isAdmin || isOwner;
  const authorName = post.author?.nickname || '匿名用户';
  const authorAvatar = post.author?.avatar;
  const authorId = post.authorId;
  const canOpenProfile = !!authorId && !!onOpenUserProfile;
  const imageUrls = normalizePostImages(post);
  const quickTags = extractQuickTagsFromDescription(post.description);
  const availability = postAvailability(post);

  const handleOpenAuthorProfile = () => {
    if (!canOpenProfile) return;
    onOpenUserProfile?.(authorId);
  };

  const deletePost = async () => {
    if (!(await confirmDialog({ title: '删除此贴？', message: '删除后其他用户将无法再看到这条信息。', confirmText: '删除', danger: true }))) return;
    if (!active.current || busyRef.current) return;
    busyRef.current = true;
    setCommentBusy(true);
    try {
      await api.request(`/posts/${post.id}`, { method: 'DELETE' });
      if (!active.current) return;
      onDeleted();
      showToast('帖子已删除', 'success');
    } catch (error) {
      if (active.current) showToast(friendlyErrorMessage(error, '删除失败，请重试。'), 'error');
    } finally {
      if (active.current) { busyRef.current = false; setCommentBusy(false); }
    }
  };

  const openReport = () => {
    if (!currentUser) return onLoginNeeded();
    setMenuOpen(false);
    onReport?.(post);
  };

  return (
    <ModalShell onClose={onClose} closeOnBackdrop={false} label={post.title || '帖子详情'} className="post-detail">
      <div className="post-detail__window">
        <header className="post-detail__toolbar">
          <button type="button" onClick={onClose} className="post-detail__close" aria-label="关闭"><X size={18} /><span>返回浏览</span></button>
          <span className="post-detail__toolbar-label">BAYLINK · 邻里生活</span>
          <div className="post-detail__toolbar-actions">
            <button type="button" onClick={() => onShare(post)} className="post-detail__icon-button" aria-label="分享"><Share2 size={18} /></button>
            {hasMenu && (
              <div className="post-card__menu-wrap">
                <button type="button" onClick={() => setMenuOpen((value) => !value)} className="post-detail__icon-button" aria-label="更多" aria-expanded={menuOpen}><MoreHorizontal size={20} /></button>
                {menuOpen && (
                  <>
                    <div className="post-card__menu-dismiss" onClick={() => setMenuOpen(false)} />
                    <div className="post-card__menu" role="group" aria-label="帖子操作">
                      {showReport && <button type="button" onClick={openReport}><Flag size={15} /> 举报帖子</button>}
                      {showReport && onToggleBlockUser && authorId && <button type="button" onClick={() => { setMenuOpen(false); onToggleBlockUser(authorId); }}><UserX size={15} /> {blockedUserIds?.includes(authorId) ? '取消屏蔽' : '屏蔽该用户'}</button>}
                      {isAdmin && <button type="button" onClick={() => { setMenuOpen(false); onToggleFeature?.(post); }}><Star size={15} /> {post.isFeatured ? '取消编辑精选' : '加入编辑精选'}</button>}
                      {(isAdmin || isOwner) && <button type="button" onClick={() => { setMenuOpen(false); onEdit?.(post); }}><Edit size={15} /> 编辑</button>}
                      {(isAdmin || isOwner) && <button type="button" className="post-card__danger" onClick={() => { setMenuOpen(false); void deletePost(); }}><Trash2 size={15} /> 删除</button>}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        <div className="post-detail__scroll">
          <div className="post-detail__heading">
            <div className="post-detail__eyebrow"><span>{post.category || '湾区生活'}</span><span>{post.type === 'provider' ? '本地资源' : '邻里需求'}</span>{post.isFeatured && <span className="post-detail__featured"><Star size={12} fill="currentColor" /> 编辑精选</span>}</div>
            <h1>{post.title}</h1>
            <div className="post-detail__availability"><PostAvailabilityBadge post={post} /><p>{availability.detail}</p></div>
            {detailRefreshing && <p className="post-detail__refresh" role="status"><Loader2 size={13} className="animate-spin" /> 正在同步最新内容…</p>}
          </div>

          <div className="post-detail__columns">
            <div className="post-detail__main">
              {imageUrls.length > 0 && (
                <div className={`post-detail__gallery ${imageUrls.length > 1 ? 'post-detail__gallery--multiple' : ''}`}>
                  {imageUrls.map((url: string, index: number) => (
                    <button key={url + index} type="button" className="post-detail__photo" onClick={() => onImageClick(url)} aria-label={`查看 ${post.title} 的第 ${index + 1} 张图片`}>
                      <img src={url} alt={`${post.title}，图片 ${index + 1}`} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" className={isDefaultCoverUrl(url) ? 'post-detail__photo--system' : ''} />
                      {isDefaultCoverUrl(url) && <span className="post-detail__photo-label">系统封面</span>}
                      <span className="post-detail__photo-number">{index + 1} / {imageUrls.length}</span>
                    </button>
                  ))}
                </div>
              )}
              <section className="post-detail__description-section" aria-label="信息详情">
                <h2>关于这条信息</h2>
                <p className="post-detail__description">{post.description}</p>
                {quickTags.length > 0 && <div className="post-detail__tags">{quickTags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
                <div className="post-detail__reactions">
                  {onLike && <UsefulLikeButton post={post} onLike={onLike} />}
                  <button type="button" onClick={() => onShare(post)} className="post-action"><Share2 size={15} /><span>分享给朋友</span></button>
                </div>
              </section>
            </div>

            <aside className="post-detail__aside" aria-label="发布者和联系方式">
              <div className="post-detail__aside-sticky">
                <div className="post-detail__summary">
                  {post.budget && <div className="post-detail__budget"><span>{post.type === 'client' ? '预算' : '价格'}</span><strong>{post.budget}</strong></div>}
                  {(post.city || post.timeInfo || post.category) && <dl className="post-detail__facts">
                    {post.city && <div><dt>所在地区</dt><dd>{post.city}</dd></div>}
                    {post.timeInfo && <div><dt>时间安排</dt><dd>{post.timeInfo}</dd></div>}
                    {post.category && <div><dt>信息分类</dt><dd>{post.category}</dd></div>}
                  </dl>}
                  <div className="post-detail__author">
                    <button type="button" disabled={!canOpenProfile} onClick={handleOpenAuthorProfile} className="post-detail__avatar" aria-label={canOpenProfile ? `查看 ${authorName} 的资料` : undefined}><Avatar src={authorAvatar} name={authorName} size={10} /></button>
                    <div className="post-detail__author-info">
                      <button type="button" disabled={!canOpenProfile} onClick={handleOpenAuthorProfile} className="post-detail__author-name"><span>{authorName}</span><TrustBadge user={post.author} size={10} showText /></button>
                      {isPlatformAdmin(post.author) && <p className="post-detail__platform-account">BAYLINK 平台账号发布</p>}
                      <p className="post-detail__author-date">{formatPostDetailAuthorMeta(post)}</p>
                    </div>
                  </div>
                </div>
                <div className="post-detail__contact">
                  <PostDetailContactPanel
                    section="contact"
                    post={post}
                    currentUser={currentUser}
                    isOwner={isOwner}
                    onLoginNeeded={onLoginNeeded}
                    onOpenChat={onOpenChat}
                    authorName={authorName}
                    showToast={showToast}
                    onAskBayBay={onAskBayBay}
                    requestContact={async (postId) => {
                      try {
                        const res = await api.requestPostContact(postId);
                        return { status: res.status, threadId: res.threadId };
                      } catch (error) {
                        const detail = error as { requestStatus?: string; threadId?: string };
                        return { status: detail?.requestStatus || '', error: friendlyErrorMessage(error, '请求失败'), threadId: detail?.threadId };
                      }
                    }}
                    approveRequest={(id) => api.approveContactRequest(id)}
                    declineRequest={(id) => api.declineContactRequest(id)}
                  />
                </div>
                <div className="post-detail__baybay">
                  <PostDetailContactPanel
                    section="baybay"
                    post={post}
                    currentUser={currentUser}
                    isOwner={isOwner}
                    onLoginNeeded={onLoginNeeded}
                    onOpenChat={onOpenChat}
                    authorName={authorName}
                    showToast={showToast}
                    onAskBayBay={onAskBayBay}
                    requestContact={async () => ({ status: '' })}
                  />
                </div>
              </div>
            </aside>

            <section className="post-detail__comments" aria-label="评论">
              <h2><MessageSquare size={19} /><span>邻里聊聊</span><span className="post-detail__comment-count">{activeCommentCount}</span></h2>
              <CommentThread comments={comments} currentUser={currentUser} onReply={handleReplyComment} onEdit={handleEditComment} onDelete={handleDeleteComment} onLoginNeeded={onLoginNeeded} disabled={commentBusy} />
            </section>
          </div>
        </div>

        <div className="post-detail__composer">
          {commentMode.type !== 'new' && <div className="post-detail__reply-state"><span>{commentMode.type === 'reply' ? `回复 ${commentMode.nickname}` : '编辑评论'}</span><button type="button" disabled={commentBusy} onClick={resetCommentInput}>取消</button></div>}
          <div className="post-detail__composer-row">
            <MessageSquare size={19} className="post-detail__composer-icon" aria-hidden="true" />
            <input
              className="post-detail__comment-input"
              placeholder={commentPlaceholder}
              aria-label={commentMode.type === 'reply' ? `回复 ${commentMode.nickname}` : commentMode.type === 'edit' ? '编辑评论内容' : '评论内容'}
              disabled={commentBusy}
              value={input}
              onChange={event => setInput(event.target.value)}
              onFocus={() => { if (!currentUser) onLoginNeeded(); }}
              onCompositionStart={() => { composing.current = true; }}
              onCompositionEnd={() => { composing.current = false; }}
              onKeyDown={event => { if (event.key === 'Enter' && !composing.current && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); void submitComment(); } }}
            />
            <button type="button" onClick={submitComment} className="post-detail__send" disabled={!input.trim() || commentBusy} aria-label="发送评论">{commentBusy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}<span>发送</span></button>
            {!isOwner && post.status !== 'closed' && <button type="button" className="post-detail__quick-contact" onClick={() => { if (!currentUser) return onLoginNeeded(); onOpenChat(authorId, authorName, post.title); }}><MessageCircle size={18} /><span>私信</span></button>}
          </div>
        </div>
      </div>
    </ModalShell>
  );
};
