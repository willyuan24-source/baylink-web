import { CommentItem, type PostComment } from './CommentItem';

type CommentThreadProps = {
  comments: PostComment[];
  currentUser?: { id: string; role?: string } | null;
  onReply: (comment: PostComment) => void;
  onEdit: (comment: PostComment) => void;
  onDelete: (comment: PostComment) => void;
  onLoginNeeded: () => void;
  disabled?: boolean;
};

export const CommentThread = ({
  comments,
  currentUser,
  onReply,
  onEdit,
  onDelete,
  onLoginNeeded,
  disabled = false,
}: CommentThreadProps) => {
  const uniqueComments = [...new Map(comments.map(comment => [comment.id, comment])).values()];
  const commentIds = new Set(uniqueComments.map(comment => comment.id));
  const topLevel = uniqueComments.filter((c) => !c.parentId || !commentIds.has(c.parentId));
  const repliesByParent = new Map<string, PostComment[]>();
  uniqueComments.filter((c) => c.parentId && commentIds.has(c.parentId)).forEach((r) => {
    const list = repliesByParent.get(r.parentId!) || [];
    list.push(r);
    repliesByParent.set(r.parentId!, list);
  });

  if (topLevel.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-baylink-border/70 bg-white/60 py-6 text-center">
        <p className="text-[13px] font-medium text-baylink-text-secondary">还没有评论</p>
        <p className="mt-1 type-footnote text-baylink-muted">有疑问或补充？欢迎留言和帖主交流。</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {topLevel.map((comment) => (
        <div key={comment.id} className="space-y-2">
          <CommentItem
            comment={comment}
            currentUser={currentUser}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            onLoginNeeded={onLoginNeeded}
            disabled={disabled}
          />
          {(repliesByParent.get(comment.id) || []).map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              isReply
              currentUser={currentUser}
              onEdit={onEdit}
              onDelete={onDelete}
              onLoginNeeded={onLoginNeeded}
              disabled={disabled}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
