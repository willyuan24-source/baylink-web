import { useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { toggleSavedPost, useSavedPosts, type SavedPost } from '../lib/savedPosts';

export function BookmarkButton({ post, userId }: { post: Omit<SavedPost, 'savedAt'>; userId?: string }) {
  const posts = useSavedPosts(userId);
  const saved = posts.some((item) => item.id === post.id);
  const [error, setError] = useState<string | null>(null);
  return <span className="bookmark-control">
    <button type="button" className={`post-action ${saved ? 'is-saved' : ''}`} aria-label={`${saved ? '取消收藏' : '收藏'}：${post.title}`} aria-pressed={saved} title="保存到此设备的收藏" onClick={(event) => {
      event.stopPropagation();
      try { setError(toggleSavedPost(window.localStorage, userId, post).error); }
      catch { setError('浏览器未能保存收藏，请检查存储设置后重试。'); }
    }}>{saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}<span>{saved ? '已收藏' : '收藏'}</span></button>
    {error && <span role="alert" className="bookmark-error">{error}</span>}
  </span>;
}
