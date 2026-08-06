// 「我的」页的全屏子视图：站内信息页（关于/帮助）与我的发布
import { useState, useEffect } from 'react';
import { ChevronLeft, Edit, Save } from 'lucide-react';
import { api } from '../../lib/api';
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
      } catch (e) {
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
    } catch (e) {
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
  const [myPosts, setMyPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const all = await api.request('/posts');
        const list = Array.isArray(all) ? all : (all.posts || []);
        setMyPosts(list.filter((p: any) => p.authorId === user.id));
      } catch {} finally {
        setLoading(false);
      }
    };
    load();
  }, [user.id]);

  return (
    <div className="fixed inset-0 z-[80] bg-[#FFF8F0] flex flex-col w-full h-full">
      <div className="px-4 py-3 border-b border-white/50 flex items-center gap-3 bg-[#FFF8F0]/80 backdrop-blur-md sticky top-0 pt-safe-top shrink-0 z-10"><button onClick={onBack} className="p-2 hover:bg-white/50 rounded-full transition active:scale-90"><ChevronLeft size={24} className="text-gray-900" /></button><span className="font-bold text-lg text-gray-900">我的发布</span></div>
      <div className="flex-1 overflow-y-auto p-4 pb-24 bg-[#FAFAFA]">{loading ? <div className="text-center py-10 text-gray-400 text-xs">加载中...</div> : myPosts.length > 0 ? myPosts.map(p => <PostCard key={p.id} post={p} onClick={() => onOpenPost(p)} onContactClick={() => {}} onAvatarClick={() => {}} onImageClick={() => {}} />) : <div className="text-center py-20 opacity-60"><div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-soft"><Edit size={32} className="text-gray-400" /></div><p className="text-sm font-bold text-gray-500">你还没有发布过内容</p><p className="text-xs text-gray-400 mt-1">发布第一条信息，让附近用户看到你</p></div>}</div>
    </div>
  );
};
