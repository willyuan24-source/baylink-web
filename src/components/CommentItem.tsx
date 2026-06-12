import Avatar from './Avatar';
import { UserTrustBadges } from './UserTrustBadges';

export type PostComment = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  isAdmin?: boolean;
  content: string;
  parentId?: string | null;
  createdAt: number;
  updatedAt?: number | null;
  editedAt?: number | null;
  isDeleted?: boolean;
};

type CommentItemProps = {
  comment: PostComment;
  isReply?: boolean;
  currentUser?: { id: string; role?: string } | null;
  onReply?: (comment: PostComment) => void;
  onEdit: (comment: PostComment) => void;
  onDelete: (comment: PostComment) => void;
  onLoginNeeded: () => void;
};

const formatCommentTime = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString();
};

export const CommentItem = ({
  comment,
  isReply = false,
  currentUser,
  onReply,
  onEdit,
  onDelete,
  onLoginNeeded,
}: CommentItemProps) => {
  const isDeleted = !!comment.isDeleted;
  const isAdmin = currentUser?.role === 'admin';
  const isAuthor = currentUser?.id === comment.authorId;
  const canManage = !isDeleted && (isAuthor || isAdmin);
  const showReply = !isReply && !isDeleted && onReply;

  const requireLogin = (action: () => void) => {
    if (!currentUser) return onLoginNeeded();
    action();
  };

  return (
    <div
      className={
        isReply
          ? 'ml-3 border-l-2 border-baylink-green/20 pl-3'
          : 'rounded-2xl border border-black/[0.04] bg-white p-3 shadow-rest'
      }
    >
      <div className="flex gap-2">
        <Avatar src={comment.authorAvatar} name={comment.authorName} size={isReply ? 7 : 8} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="text-[13px] font-semibold text-baylink-text">{comment.authorName}</span>
            {comment.isAdmin && (
              <UserTrustBadges user={{ isAdmin: true }} size={9} showText adminCompact />
            )}
            <span className="text-[10px] text-baylink-muted">{formatCommentTime(comment.createdAt)}</span>
            {comment.editedAt && !isDeleted && (
              <span className="text-[10px] text-baylink-muted">已编辑</span>
            )}
          </div>
          <p className={`mt-1 text-[14px] leading-relaxed ${isDeleted ? 'italic text-baylink-muted' : 'text-baylink-text-secondary'}`}>
            {isDeleted ? '评论已删除' : comment.content}
          </p>
          {(showReply || canManage) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {showReply && (
                <button
                  type="button"
                  onClick={() => requireLogin(() => onReply!(comment))}
                  className="text-[11px] font-medium text-baylink-green hover:underline"
                >
                  回复
                </button>
              )}
              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={() => requireLogin(() => onEdit(comment))}
                    className="text-[11px] font-medium text-baylink-text-secondary hover:text-baylink-text"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => requireLogin(() => onDelete(comment))}
                    className="text-[11px] font-medium text-red-500/90 hover:text-red-600"
                  >
                    删除
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
