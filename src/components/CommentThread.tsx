import { CommentItem, type PostComment } from './CommentItem';
import { useUiCopy } from './ui/ui-copy';

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
  const { t } = useUiCopy();
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
      // The post sheet's quiet empty line (WEB-COMMUNITY: no dashed boxes).
      <p className="cm-comments-empty">{t('还没有评论。有疑问或补充，可以在下面留言和发布者交流。', 'No comments yet. Ask a question or add a detail below.')}</p>
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
