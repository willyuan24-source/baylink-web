// 帖子详情全屏覆盖层（评论 / 联系请求 / 分享 / 管理菜单）
import { useState, useEffect } from 'react';
import {
  X, Share2, MoreHorizontal, Flag, UserX, Star, Edit, Trash2, Loader2,
  MessageSquare, Send,
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
import { formatChineseDate, formatProfileLocation, isPostEdited } from '../../lib/format';
import type { PostData } from '../../lib/types';
import { UsefulLikeButton } from './PostCard';

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

export const PostDetailModal = ({ post, onClose, currentUser, onLoginNeeded, onOpenChat, onOpenUserProfile, onDeleted, onEdit, onToggleFeature, onImageClick, onShare, onLike, showToast, onReport, onToggleBlockUser, blockedUserIds, detailRefreshing, onAskBayBay }: any) => {
  const [comments, setComments] = useState<PostComment[]>(post.comments || []);
  const [input, setInput] = useState('');
  const [commentMode, setCommentMode] = useState<
    { type: 'new' } | { type: 'reply'; parentId: string; nickname: string } | { type: 'edit'; commentId: string }
  >({ type: 'new' });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setComments(post.comments || []);
  }, [post.id, post.comments]);

  const activeCommentCount = comments.filter((c) => !c.isDeleted).length;

  const resetCommentInput = () => {
    setCommentMode({ type: 'new' });
    setInput('');
  };

  const submitComment = async () => {
    if (!currentUser) return onLoginNeeded();
    if (!input.trim()) return;
    try {
      if (commentMode.type === 'edit') {
        const res = await api.request(`/posts/${post.id}/comments/${commentMode.commentId}`, {
          method: 'PATCH',
          body: JSON.stringify({ content: input.trim() }),
        });
        setComments(res.comments || []);
        showToast('评论已更新', 'success');
      } else {
        const body: { content: string; parentId?: string } = { content: input.trim() };
        if (commentMode.type === 'reply') body.parentId = commentMode.parentId;
        const res = await api.request(`/posts/${post.id}/comments`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setComments(res.comments || []);
        showToast(commentMode.type === 'reply' ? '回复已发送' : '评论已发送', 'success');
      }
      resetCommentInput();
    } catch (e: any) {
      showToast(e?.error || '操作失败', 'error');
    }
  };

  const handleReplyComment = (comment: PostComment) => {
    setCommentMode({ type: 'reply', parentId: comment.id, nickname: comment.authorName });
    setInput('');
  };

  const handleEditComment = (comment: PostComment) => {
    setCommentMode({ type: 'edit', commentId: comment.id });
    setInput(comment.content);
  };

  const handleDeleteComment = async (comment: PostComment) => {
    if (!(await confirmDialog({ title: '删除评论', message: '确定删除这条评论？', confirmText: '删除', danger: true }))) return;
    try {
      const res = await api.request(`/posts/${post.id}/comments/${comment.id}`, { method: 'DELETE' });
      setComments(res.comments || []);
      if (commentMode.type === 'edit' && commentMode.commentId === comment.id) resetCommentInput();
      showToast('评论已删除', 'success');
    } catch (e: any) {
      showToast(e?.error || '删除失败', 'error');
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

  const handleOpenAuthorProfile = () => {
    if (!canOpenProfile) return;
    onOpenUserProfile(authorId);
  };

  const deletePost = async () => {
    if (!(await confirmDialog({ title: '删除此贴？', message: '删除后其他用户将无法再看到这条信息。', confirmText: '删除', danger: true }))) return;
    try {
      await api.request(`/posts/${post.id}`, { method: 'DELETE' });
      onDeleted();
      onClose();
      showToast('帖子已删除', 'success');
    } catch {
      showToast('删除失败', 'error');
    }
  };

  const openReport = () => {
    if (!currentUser) return onLoginNeeded();
    setMenuOpen(false);
    onReport?.(post);
  };

  const chromeIconBtn = 'p-2.5 rounded-full bg-white/75 backdrop-blur-xl border border-black/[0.04] shadow-rest text-baylink-text transition hover:bg-white active:scale-95';

  return (
    <ModalShell onClose={onClose} closeOnBackdrop={false} label={post.title || '帖子详情'} className="fixed inset-0 bg-baylink-bg z-50 flex flex-col animate-in slide-in-from-bottom-full duration-300 w-full h-full sm:rounded-t-[2rem] sm:top-10 sm:max-w-md sm:mx-auto sm:shadow-elevated">
      <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl pt-safe-top shrink-0">
        <button type="button" onClick={onClose} className={chromeIconBtn} aria-label="关闭"><X size={20} /></button>
        <div className="flex gap-2 items-center">
          <button type="button" onClick={() => onShare(post)} className={`${chromeIconBtn} hover:text-baylink-green`} aria-label="分享"><Share2 size={20} /></button>
          {hasMenu && (
            <div className="relative">
              <button type="button" onClick={() => setMenuOpen((v) => !v)} className={chromeIconBtn} aria-label="更多">
                <MoreHorizontal size={20} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-1 min-w-[128px] rounded-xl border border-black/[0.06] bg-white py-1 shadow-elevated">
                    {showReport && (
                      <button type="button" onClick={openReport} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-baylink-text-secondary hover:bg-baylink-section/60">
                        <Flag size={13} /> 举报帖子
                      </button>
                    )}
                    {showReport && onToggleBlockUser && authorId && (
                      <button type="button" onClick={() => { setMenuOpen(false); onToggleBlockUser(authorId); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-baylink-text-secondary hover:bg-baylink-section/60">
                        <UserX size={13} /> {blockedUserIds?.includes(authorId) ? '取消屏蔽' : '屏蔽该用户'}
                      </button>
                    )}
                    {isAdmin && (
                      <button type="button" onClick={() => { setMenuOpen(false); onToggleFeature?.(post); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-amber-700 hover:bg-amber-50">
                        <Star size={13} /> {post.isFeatured ? '取消热门推荐' : '加入热门推荐'}
                      </button>
                    )}
                    {(isAdmin || isOwner) && (
                      <button type="button" onClick={() => { setMenuOpen(false); onEdit?.(post); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-baylink-text hover:bg-baylink-section/60">
                        <Edit size={13} /> 编辑
                      </button>
                    )}
                    {(isAdmin || isOwner) && (
                      <button type="button" onClick={() => { setMenuOpen(false); deletePost(); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50">
                        <Trash2 size={13} /> 删除
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5 pb-32 bg-baylink-bg">
        <h1 className="text-[24px] sm:text-[28px] font-semibold tracking-tight text-baylink-text mb-5 leading-tight">{post.title}</h1>
        <div className="surface-card flex gap-2.5 mb-6 items-center p-3">
          <button
            type="button"
            disabled={!canOpenProfile}
            onClick={handleOpenAuthorProfile}
            className={`shrink-0 rounded-full transition ${canOpenProfile ? 'cursor-pointer hover:opacity-80 active:scale-95' : 'cursor-default'}`}
            aria-label={canOpenProfile ? `查看 ${authorName} 的资料` : undefined}
          >
            <Avatar src={authorAvatar} name={authorName} size={10} />
          </button>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              disabled={!canOpenProfile}
              onClick={handleOpenAuthorProfile}
              className={`flex max-w-full flex-wrap items-center gap-1 text-left text-[15px] font-semibold text-baylink-text transition ${canOpenProfile ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
            >
              <span className="truncate">{authorName}</span>
              <TrustBadge user={post.author} size={10} showText />
            </button>
            {isPlatformAdmin(post.author) && (
              <p className="type-footnote mt-0.5 text-emerald-700">BAYLINK 平台账号发布</p>
            )}
            <p className="type-footnote mt-0.5 line-clamp-2 leading-snug">{formatPostDetailAuthorMeta(post)}</p>
          </div>
        </div>
        {(post.budget || post.timeInfo || post.category || post.city) && (
          <div className="surface-card mb-5 p-3.5 space-y-2">
            {detailRefreshing && (
              <p className="type-caption text-baylink-muted flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> 正在同步最新内容…</p>
            )}
            <div className="flex flex-wrap gap-2">
              {post.budget && (
                <span className="rounded-lg bg-baylink-green/[0.08] px-2.5 py-1 text-[11px] font-bold text-baylink-green">预算/价格：{post.budget}</span>
              )}
              {post.city && (
                <span className="rounded-lg bg-baylink-section/80 px-2.5 py-1 text-[11px] font-semibold text-baylink-text-secondary">区域：{post.city}</span>
              )}
              {post.timeInfo && (
                <span className="rounded-lg bg-baylink-section/80 px-2.5 py-1 text-[11px] font-semibold text-baylink-text-secondary">时间：{post.timeInfo}</span>
              )}
              {post.category && (
                <span className="rounded-lg bg-baylink-section/80 px-2.5 py-1 text-[11px] font-semibold text-baylink-text-secondary">分类：{post.category}</span>
              )}
            </div>
          </div>
        )}
        <p className="mb-6 whitespace-pre-wrap text-[16px] leading-7 text-baylink-text-secondary">{post.description}</p>
        <div className="space-y-3 mb-6">
          {imageUrls.map((u: string, i: number) => (
            <div key={i} className="relative overflow-hidden rounded-[22px] bg-baylink-section/50">
              <img
                src={u}
                alt=""
                onClick={() => onImageClick(u)}
                className={`w-full cursor-zoom-in rounded-[22px] shadow-rest transition hover:opacity-95 ${isDefaultCoverUrl(u) ? 'max-h-[360px] object-contain bg-baylink-section/80 p-2' : ''}`}
              />
              {isDefaultCoverUrl(u) && (
                <span className="absolute left-3 top-3 rounded-md bg-black/40 px-1.5 py-0.5 type-caption text-white/90">系统封面</span>
              )}
            </div>
          ))}
        </div>
        {quickTags.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-1.5">
            {quickTags.map((tag) => (
              <span key={tag} className="rounded-full border border-baylink-green/15 bg-baylink-green/[0.06] px-2 py-0.5 text-[10px] font-medium text-baylink-green">#{tag}</span>
            ))}
          </div>
        )}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {onLike && <UsefulLikeButton post={post} onLike={onLike} />}
          <button
            type="button"
            onClick={() => onShare(post)}
            className="inline-flex items-center gap-1 rounded-lg border border-black/[0.06] bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-baylink-text-secondary transition hover:bg-baylink-section/50 active:scale-[0.98]"
          >
            <Share2 size={14} />
            分享给朋友
          </button>
        </div>
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
            } catch (e: any) {
              return { status: e?.requestStatus || '', error: e?.error || e?.message || '请求失败', threadId: e?.threadId };
            }
          }}
          approveRequest={(id) => api.approveContactRequest(id)}
          declineRequest={(id) => api.declineContactRequest(id)}
        />
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
        <div className="border-t border-baylink-border/50 pt-6">
          <h3 className="type-section-title mb-4 flex items-center gap-2">
            <MessageSquare size={18} className="text-baylink-green" /> 评论 ({activeCommentCount})
          </h3>
          <CommentThread
            comments={comments}
            currentUser={currentUser}
            onReply={handleReplyComment}
            onEdit={handleEditComment}
            onDelete={handleDeleteComment}
            onLoginNeeded={onLoginNeeded}
          />
        </div>
      </div>
      <div className="border-t border-black/[0.06] bg-white/80 backdrop-blur-xl absolute bottom-0 w-full">
        {commentMode.type !== 'new' && (
          <div className="flex items-center justify-between border-b border-black/[0.04] px-4 py-2">
            <span className="text-[11px] text-baylink-muted">
              {commentMode.type === 'reply' ? `回复 ${commentMode.nickname}` : '编辑评论'}
            </span>
            <button type="button" onClick={resetCommentInput} className="text-[11px] font-medium text-baylink-green">
              取消
            </button>
          </div>
        )}
        <div className="flex gap-3 items-center px-4 pt-3 pb-safe-bar">
          <input
            className="flex-1 bg-white border border-black/[0.06] rounded-full px-5 py-3 outline-none text-[15px] text-baylink-text transition placeholder:text-baylink-muted focus:border-baylink-green/40 focus:ring-2 focus:ring-baylink-green/15"
            placeholder={commentPlaceholder}
            value={input}
            onChange={e => setInput(e.target.value)}
            onFocus={() => { if (!currentUser) onLoginNeeded(); }}
            onKeyDown={e => e.key === 'Enter' && submitComment()}
          />
          <button
            type="button"
            onClick={submitComment}
            className={`p-3 rounded-full text-white transition active:scale-90 ${input.trim() ? 'bg-baylink-green shadow-rest hover:bg-baylink-green-hover' : 'bg-baylink-border'}`}
            disabled={!input.trim()}
            aria-label="发送评论"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
