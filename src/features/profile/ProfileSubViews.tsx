// 「我的」页的全屏子视图：站内信息页（关于/帮助）与我的发布
import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, Edit, Save, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { readOwnPostsBatch } from '../../lib/ownPosts';
import { friendlyErrorMessage } from '../../lib/format';
import { useApp } from '../../app/context';
import type { PostData } from '../../lib/types';
import { PostCard } from '../posts/PostCard';

export const InfoPage = ({ title, storageKey, user, onBack, showToast }: any) => {
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.request(`/content/${storageKey}`);
        setContent(data.value || '暂无内容');
        setEditValue(data.value || '');
      } catch {
        setContent('加载失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [storageKey]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.request('/content', { method: 'POST', body: JSON.stringify({ key: storageKey, value: editValue }) });
      setContent(editValue);
      setIsEditing(false);
      showToast('页面内容已更新', 'success');
    } catch {
      showToast('保存失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-[#FFF8F0] flex flex-col w-full h-full">
      <div className="px-4 py-3 border-b border-white/50 flex items-center justify-between bg-[#FFF8F0]/80 backdrop-blur-md sticky top-0 pt-safe-top shrink-0 z-10">
        <div className="flex items-center gap-3"><button onClick={onBack} className="p-2 hover:bg-white/50 rounded-full transition active:scale-90"><ChevronLeft size={24} className="text-gray-900" /></button><span className="font-bold text-lg text-gray-900">{title}</span></div>
        {user?.role === 'admin' && !isEditing && <button onClick={() => setIsEditing(true)} className="text-green-700 text-sm font-bold flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm"><Edit size={14} /> 编辑</button>}
        {isEditing && <button onClick={handleSave} disabled={loading} className="text-white bg-green-700 text-sm font-bold flex items-center gap-1 px-3 py-1.5 rounded-full shadow-md"><Save size={14} /> {loading ? '...' : '发布'}</button>}
      </div>
      <div className="flex-1 p-6 overflow-y-auto bg-white/50">{!loading && (isEditing ? <textarea className="w-full h-full p-4 bg-white border rounded-2xl text-sm outline-none resize-none shadow-sm" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="在这里输入内容..." /> : <div className="text-gray-900 text-base leading-relaxed whitespace-pre-wrap">{content}</div>)}</div>
    </div>
  );
};

export const MyPostsView = ({ user, onBack, onOpenPost }: any) => {
  const app = useApp();
  const [myPosts, setMyPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const nextPageRef = useRef(1);
  const publicFeedFallbackRef = useRef(false);
  const requestRef = useRef(0);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    const requestId = ++requestRef.current;
    try {
      let result;
      if (!publicFeedFallbackRef.current) {
        try {
          result = await readOwnPostsBatch({ userId: user.id, startPage: nextPageRef.current, maxPages: 1,
            fetchPage: (page) => api.request(`/users/me/posts?page=${page}&limit=10`) });
        } catch (e) {
          const status = (e as { status?: number })?.status;
          if (status !== 404 && status !== 405) throw e;
          publicFeedFallbackRef.current = true;
        }
      }
      result ??= await readOwnPostsBatch({ userId: user.id, startPage: nextPageRef.current,
        fetchPage: (page) => api.request(`/posts?page=${page}&limit=10`) });
      if (requestId !== requestRef.current) return;
      setMyPosts((previous) => [...new Map([...previous, ...result.posts].map((post) => [post.id, post])).values()]);
      nextPageRef.current = result.nextPage;
      setHasMore(result.hasMore);
    } catch (e) {
      if (requestId === requestRef.current) setError(friendlyErrorMessage(e, '加载发布记录失败，请重试。'));
    } finally {
      if (requestId === requestRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [user.id]);

  useEffect(() => {
    nextPageRef.current = 1;
    publicFeedFallbackRef.current = false;
    loadingRef.current = false;
    setMyPosts([]);
    setHasMore(true);
    void load();
    return () => { requestRef.current += 1; loadingRef.current = false; };
  // Shared post mutations (including editing from the detail overlay) invalidate this list.
  }, [load, app.featuredRefreshKey]);

  return (
    <section className="bg-baylink-bg flex flex-col w-full min-h-full">
      <div className="px-4 py-3 border-b border-baylink-border/50 flex items-center gap-3 bg-baylink-bg/90 backdrop-blur-md sticky top-0 pt-safe-top shrink-0 z-10"><button type="button" onClick={onBack} aria-label="返回我的资料" className="p-2 hover:bg-white/50 rounded-full transition active:scale-90"><ChevronLeft size={24} /></button><h2 className="font-bold text-lg">我的发布</h2></div>
      <div className="flex-1 p-4 pb-28">
        {myPosts.map((post) => <PostCard key={post.id} post={post} currentUser={user}
          onClick={() => onOpenPost(post)} onContactClick={() => onOpenPost(post)}
          onAvatarClick={app.openUserProfile} onImageClick={app.setViewingImage} onShare={app.setSharingPost}
          onLike={(p: PostData) => app.handleToggleLike(p, (id, hasLiked, likesCount) => setMyPosts((items) => items.map((item) => item.id === id ? { ...item, hasLiked, likesCount } : item)))}
          onEdit={(p: PostData) => { onBack(); app.openEditPost(p); }}
          onDelete={async (p: PostData) => { await app.handleDeletePost(p); nextPageRef.current = 1; setMyPosts([]); void load(); }}
          onToggleFeature={async (p: PostData) => {
            await app.handleToggleFeature(p);
            try {
              const updated = await api.request(`/posts/${p.id}`);
              setMyPosts((items) => items.map((item) => item.id === p.id ? updated : item));
            } catch { /* The action already reports errors; retain the last visible record. */ }
          }} />)}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {!loading && !error && myPosts.length === 0 && <div className="py-12 text-center text-baylink-muted">
          <Edit size={28} className="mx-auto mb-3" />
          <p>{hasMore ? '正在查找较早的发布记录，继续加载可查看。' : '你还没有发布过内容'}</p>
        </div>}
        {loading && <p role="status" className="flex justify-center items-center gap-2 py-6 text-sm text-baylink-muted"><Loader2 size={16} className="animate-spin" />正在查找你的发布…</p>}
        {!loading && (hasMore || error) && <button type="button" onClick={() => void load()} className="mt-4 w-full rounded-xl border border-baylink-border bg-white py-3 text-sm font-semibold">{error ? '重试加载' : '加载更早的发布'}</button>}
        {!loading && !error && !hasMore && myPosts.length > 0 && <p className="py-5 text-center text-xs text-baylink-muted">已显示全部发布记录</p>}
      </div>
    </section>
  );
};
