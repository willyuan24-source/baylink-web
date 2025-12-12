import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, Heart, Send, Plus, MapPin, 
  User as UserIcon, X, ShieldCheck, Trash2, Edit, 
  AlertCircle, Phone, Search, Home, Bell, 
  ChevronDown, CheckCircle, Loader2, ChevronLeft, 
  Save, RefreshCw, Clock, Filter, MoreHorizontal, Star, Menu, LogOut, ChevronRight,
  MessageSquare, Lock, Mail as MailIcon, ArrowRight, Info, Image as ImageIcon, ExternalLink, Camera,
  Linkedin, Instagram, AlertTriangle
} from 'lucide-react';

// BAYLINK APP V25.2 - 信任与安全升级版 (Report & Social Links)

const API_BASE_URL = 'https://baylink-api.onrender.com/api'; 

type Role = 'user' | 'admin';
type PostType = 'client' | 'provider';
interface UserData {
  id: string; email: string; nickname: string; role: Role;
  contactType: 'phone'|'wechat'|'email'; contactValue: string; isBanned: boolean; token?: string;
  bio?: string; avatar?: string;
  socialLinks?: { linkedin?: string; instagram?: string; }; // ✨ 新增
}
interface AdData { id: string; title: string; content: string; imageUrl?: string; isVerified: boolean; }
interface CommentData { id: string; authorId: string; authorName: string; content: string; createdAt: number; parentId?: string; replies?: CommentData[]; }
interface PostData {
  id: string; authorId: string; author: { nickname: string; avatar?: string; }; 
  type: PostType; title: string; city: string; category: string; timeInfo: string; budget: string;
  description: string; contactInfo: string | null; imageUrls: string[];
  likesCount: number; hasLiked: boolean; commentsCount: number; comments?: any[];
  createdAt: number; isContacted?: boolean;
  isReported?: boolean; // ✨ 新增
}
interface Conversation { id: string; otherUser: { id: string; nickname: string; avatar?: string; }; lastMessage?: string; updatedAt: number; }
interface Message { id: string; senderId: string; type: 'text'|'contact-request'|'contact-share'; content: string; createdAt: number; }

const REGIONS = ["旧金山", "中半岛", "东湾", "南湾"];
const CATEGORIES = ["租屋", "维修", "清洁", "搬家", "接送", "翻译", "兼职", "闲置", "其他"];

const triggerSessionExpired = () => { window.dispatchEvent(new Event('session-expired')); };
const safeParse = (str: string | null) => { try { return str ? JSON.parse(str) : null; } catch { return null; } };

const api = {
  request: async (endpoint: string, options: any = {}) => {
    const headers: any = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      const user = safeParse(userStr);
      if (user && user.token) headers['Authorization'] = `Bearer ${user.token}`;
    }
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
      if (res.status === 401 || res.status === 403) {
        if (!endpoint.includes('/auth/login')) { triggerSessionExpired(); throw { status: res.status, message: '登录已过期', handled: true }; }
      }
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    } catch (err: any) { if (!err.handled && err.status !== 401 && err.status !== 403) {} throw err; }
  },
  getUserProfile: async (userId: string) => await api.request(`/users/${userId}`),
  updateProfile: async (data: Partial<UserData>) => await api.request('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  reportPost: async (postId: string, reason: string) => await api.request(`/posts/${postId}/report`, { method: 'POST', body: JSON.stringify({ reason }) })
};

const Avatar = ({ src, name, size = 10, className = "" }: { src?: string, name?: string, size?: number, className?: string }) => {
    const displaySize = size * 4; 
    if (src) return <img src={src} alt={name || "User"} className={`rounded-full object-cover border border-gray-100 bg-white ${className}`} style={{ width: `${displaySize}px`, height: `${displaySize}px` }} />;
    return <div className={`rounded-full bg-green-700 text-white flex items-center justify-center font-bold shadow-sm ${className}`} style={{ width: `${displaySize}px`, height: `${displaySize}px`, fontSize: `${displaySize * 0.4}px` }}>{name ? name[0].toUpperCase() : <UserIcon size={displaySize * 0.5} />}</div>;
};

const FilterTag = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
  <button onClick={onClick} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 whitespace-nowrap border shadow-sm ${active ? 'bg-green-700 text-white border-green-700 shadow-green-900/20' : 'bg-white text-gray-600 border-gray-200 hover:border-green-700/30 hover:text-gray-900'}`}>{label}</button>
);

const InfoPage = ({ title, storageKey, user, onBack }: any) => {
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => { const load = async () => { setLoading(true); try { const data = await api.request(`/content/${storageKey}`); setContent(data.value || '暂无内容'); setEditValue(data.value || ''); } catch (e) { setContent('加载失败'); } finally { setLoading(false); } }; load(); }, [storageKey]);
  const handleSave = async () => { setLoading(true); try { await api.request('/content', { method: 'POST', body: JSON.stringify({ key: storageKey, value: editValue }) }); setContent(editValue); setIsEditing(false); alert('更新成功'); } catch (e) { alert('保存失败'); } finally { setLoading(false); } };
  return (
    <div className="fixed inset-0 z-[80] bg-[#FFF8F0] flex flex-col w-full h-full">
      <div className="px-4 py-3 border-b border-white/50 flex items-center justify-between bg-[#FFF8F0]/95 backdrop-blur sticky top-0 pt-safe-top shrink-0 z-10">
        <div className="flex items-center gap-2"><button onClick={onBack} className="p-2 hover:bg-white rounded-full transition"><ChevronLeft size={24} className="text-gray-900"/></button><span className="font-bold text-lg text-gray-900">{title}</span></div>
        {user?.role === 'admin' && !isEditing && <button onClick={() => setIsEditing(true)} className="text-green-700 text-sm font-bold flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm"><Edit size={14}/> 编辑</button>}
        {isEditing && <button onClick={handleSave} disabled={loading} className="text-white bg-green-700 text-sm font-bold flex items-center gap-1 px-3 py-1.5 rounded-full shadow-md"><Save size={14}/> {loading ? '...' : '发布'}</button>}
      </div>
      <div className="flex-1 p-5 overflow-y-auto bg-white">
        {!loading && (isEditing ? <textarea className="w-full h-full p-4 bg-gray-50 border rounded-xl text-sm outline-none resize-none shadow-inner" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="在这里输入内容..." /> : <div className="text-gray-900 text-sm leading-relaxed whitespace-pre-wrap">{content}</div>)}
      </div>
    </div>
  );
};

const PostCard = ({ post, onClick, onContactClick, onAvatarClick }: any) => {
  const isProvider = post.type === 'provider';
  return (
    <div onClick={onClick} className="bg-white p-5 rounded-2xl shadow-card border border-white hover:border-green-700/20 transition-all duration-300 cursor-pointer mb-3 group active:scale-[0.98]">
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-3 items-center">
          <div onClick={(e) => { e.stopPropagation(); onAvatarClick && onAvatarClick(post.authorId); }} className="cursor-pointer hover:opacity-80 transition"><Avatar src={post.author.avatar} name={post.author.nickname} size={10} className={`border-2 ${isProvider ? 'border-green-600' : 'border-orange-500'}`}/></div>
          <div><div className="text-sm font-bold text-gray-900 flex items-center gap-1">{post.author.nickname} <ShieldCheck size={12} className="text-green-600" fill="#E8F5E9" /></div><div className="text-[10px] text-gray-400 flex items-center gap-2 mt-0.5"><span>{new Date(post.createdAt).toLocaleDateString()}</span><span className="w-0.5 h-2 bg-gray-200"></span><span className="flex items-center gap-0.5"><MapPin size={10}/> 湾区</span></div></div>
        </div>
        <div className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${isProvider ? 'bg-green-50 text-green-700 border-green-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>{isProvider ? '我帮忙' : '求帮助'}</div>
      </div>
      <div className="mb-3"><h3 className="font-bold text-[15px] text-gray-900 mb-1.5 line-clamp-1 group-hover:text-green-700 transition-colors">{post.title}</h3><p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{post.description}</p></div>
      <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3"><div className="flex flex-wrap gap-1.5"><span className="bg-[#FFF8F0] px-2 py-0.5 rounded text-[10px] text-gray-600 font-medium border border-gray-100">{post.category}</span><span className="bg-[#FFF8F0] px-2 py-0.5 rounded text-[10px] text-gray-600 font-medium border border-gray-100">{post.city}</span></div><div className="font-bold text-sm text-orange-500 font-mono">{post.budget}</div></div>
      <div className="flex items-center justify-between"><div className="flex gap-4 text-gray-400"><button className="flex items-center gap-1 text-xs hover:text-orange-500 transition"><Heart size={16}/> {post.likesCount}</button><button className="flex items-center gap-1 text-xs hover:text-green-700 transition"><MessageSquare size={16}/> {post.commentsCount}</button></div><button onClick={(e) => {e.stopPropagation(); onContactClick(post);}} className="text-xs bg-gray-900 text-white px-4 py-2 rounded-full font-bold shadow-md hover:bg-green-700 transition flex items-center gap-1"><MessageCircle size={12} /> 私信 TA</button></div>
    </div>
  );
};

const MyPostsView = ({ user, onBack, onOpenPost }: any) => {
  const [myPosts, setMyPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const load = async () => { try { const all = await api.request('/posts'); const list = Array.isArray(all) ? all : (all.posts || []); setMyPosts(list.filter((p:any) => p.authorId === user.id)); } catch {} finally { setLoading(false); } }; load(); }, [user.id]);
  return (
    <div className="fixed inset-0 z-[80] bg-[#FFF8F0] flex flex-col w-full h-full">
      <div className="px-4 py-3 border-b border-white/50 flex items-center gap-2 bg-[#FFF8F0]/95 backdrop-blur sticky top-0 pt-safe-top shrink-0 z-10"><button onClick={onBack} className="p-2 hover:bg-white rounded-full transition"><ChevronLeft size={24} className="text-gray-900"/></button><span className="font-bold text-lg text-gray-900">我的发布</span></div>
      <div className="flex-1 overflow-y-auto p-4 pb-24 bg-[#FAFAFA]">{loading ? <div className="text-center py-10 text-gray-400 text-xs">加载中...</div> : myPosts.length > 0 ? myPosts.map(p => <PostCard key={p.id} post={p} onClick={() => onOpenPost(p)} onContactClick={()=>{}} onAvatarClick={()=>{}} />) : <div className="text-center py-20 opacity-60"><div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-soft"><Edit size={32} className="text-gray-400"/></div><p className="text-sm font-bold text-gray-500">你还没有发布过内容</p></div>}</div>
    </div>
  );
};

const MessagesList = ({ currentUser, onOpenChat }: { currentUser: UserData | null, onOpenChat: (conv: Conversation) => void }) => {
  const [convs, setConvs] = useState<Conversation[]>([]);
  useEffect(() => { if (!currentUser) return; const load = async () => { try { const res = await api.request('/conversations'); if (Array.isArray(res)) setConvs(res); } catch {} }; load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, [currentUser]);
  if (!currentUser) return <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-60 w-full min-h-[300px]"><div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-soft"><MessageCircle size={32} className="text-gray-400" /></div><h3 className="font-bold text-gray-900 mb-2">请先登录</h3></div>;
  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 w-full">{convs.length > 0 ? <div className="space-y-3">{convs.map(c => <div key={c.id} onClick={() => onOpenChat(c)} className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-card hover:shadow-soft transition cursor-pointer"><Avatar src={c.otherUser.avatar} name={c.otherUser.nickname} size={12} /><div className="flex-1 min-w-0"><div className="flex justify-between mb-1"><span className="font-bold text-gray-900">{c.otherUser.nickname}</span><span className="text-[10px] text-gray-500">{new Date(c.updatedAt).toLocaleDateString()}</span></div><p className="text-xs text-gray-500 truncate">{c.lastMessage || '点击开始聊天'}</p></div><ChevronRight size={16} className="text-gray-300" /></div>)}</div> : <div className="text-center py-20 opacity-60"><div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-soft"><MessageCircle size={32} className="text-gray-400"/></div><p className="text-sm font-bold text-gray-500">暂无消息</p></div>}</div>
  );
};

// 👤 Public Profile Modal (已更新：显示社交链接)
const PublicProfileModal = ({ userId, onClose, onChat, currentUser }: any) => {
    const [profile, setProfile] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => { const load = async () => { try { setProfile(await api.getUserProfile(userId)); } catch (e) { alert('无法获取用户信息'); onClose(); } finally { setLoading(false); } }; load(); }, [userId]);
    if (loading || !profile) return <div className="fixed inset-0 z-[100] bg-white/90 flex items-center justify-center"><Loader2 className="animate-spin text-green-700"/></div>;
    return (
        <div className="fixed inset-0 z-[90] bg-[#FFF8F0] flex flex-col animate-in slide-in-from-bottom duration-200">
             <div className="px-4 py-3 border-b border-white/50 flex items-center justify-between bg-[#FFF8F0]/95 backdrop-blur pt-safe-top">
                <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-gray-100"><X size={20}/></button>
                <span className="font-bold text-lg text-gray-900">用户主页</span><div className="w-9"></div>
             </div>
             <div className="flex-1 p-6 overflow-y-auto flex flex-col items-center">
                 <Avatar src={profile.avatar} name={profile.nickname} size={24} className="mb-4 shadow-lg border-4 border-white"/>
                 <h2 className="text-2xl font-black text-gray-900 mb-1">{profile.nickname}</h2>
                 <div className="flex gap-2 mb-6"><span className={`text-xs px-2 py-0.5 rounded font-bold ${profile.role === 'admin' ? 'bg-green-700 text-white' : 'bg-gray-200 text-gray-600'}`}>{profile.role === 'admin' ? '管理员' : '认证用户'}</span><span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded font-bold">信用极好</span></div>
                 {/* ✨ 社交链接展示 */}
                 {profile.socialLinks && (profile.socialLinks.linkedin || profile.socialLinks.instagram) && (
                   <div className="flex gap-4 mb-6">
                     {profile.socialLinks.linkedin && <a href={profile.socialLinks.linkedin} target="_blank" className="p-3 bg-white rounded-full text-[#0077b5] shadow-sm hover:scale-110 transition"><Linkedin size={20}/></a>}
                     {profile.socialLinks.instagram && <a href={profile.socialLinks.instagram} target="_blank" className="p-3 bg-white rounded-full text-[#E1306C] shadow-sm hover:scale-110 transition"><Instagram size={20}/></a>}
                   </div>
                 )}
                 <div className="w-full bg-white p-6 rounded-3xl shadow-sm border border-white mb-6"><h3 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">个人简介</h3><p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-sm">{profile.bio || "这个用户很懒，还没有写简介。"}</p></div>
                 {currentUser?.id !== profile.id && <button onClick={() => { onChat(profile.id, profile.nickname); onClose(); }} className="w-full py-4 bg-green-700 text-white rounded-2xl font-bold shadow-lg shadow-green-900/20 active:scale-95 transition flex items-center justify-center gap-2"><MessageCircle size={20}/> 发送私信</button>}
             </div>
        </div>
    );
};

// ✏️ Edit Profile Modal (已更新：编辑社交链接)
const EditProfileModal = ({ user, onClose, onUpdate }: any) => {
    const [form, setForm] = useState({ 
      nickname: user.nickname || '', bio: user.bio || '', avatar: user.avatar || '',
      socialLinks: { linkedin: user.socialLinks?.linkedin || '', instagram: user.socialLinks?.instagram || '' }
    });
    const [saving, setSaving] = useState(false);
    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file && file.size < 1024*1024) { const reader = new FileReader(); reader.onloadend = () => setForm(p => ({ ...p, avatar: reader.result as string })); reader.readAsDataURL(file); } else { alert('图片需小于1MB'); } };
    const handleSave = async () => { if (!form.nickname) return; setSaving(true); try { const updated = await api.updateProfile(form); const newUserData = { ...user, ...updated }; localStorage.setItem('currentUser', JSON.stringify(newUserData)); onUpdate(newUserData); onClose(); } catch (e) { alert('保存失败'); } finally { setSaving(false); } };
    return (
        <div className="fixed inset-0 z-[90] bg-[#FFF8F0] flex flex-col animate-in slide-in-from-bottom duration-200">
             <div className="px-4 py-3 border-b border-white/50 flex items-center justify-between bg-[#FFF8F0]/95 backdrop-blur pt-safe-top">
                <button onClick={onClose} className="text-gray-500 hover:text-gray-900">取消</button><span className="font-bold text-lg text-gray-900">编辑资料</span><button onClick={handleSave} disabled={saving} className="text-green-700 font-bold disabled:opacity-50">{saving ? '保存中...' : '完成'}</button>
             </div>
             <div className="flex-1 p-6 overflow-y-auto">
                 <div className="flex flex-col items-center mb-8"><div className="relative group"><Avatar src={form.avatar} name={form.nickname} size={24} /><label className="absolute bottom-0 right-0 bg-gray-900 text-white p-2 rounded-full cursor-pointer shadow-md hover:scale-110 transition"><Camera size={16}/><input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} /></label></div></div>
                 <div className="space-y-4">
                     <div><label className="block text-xs font-bold text-gray-500 mb-1.5">昵称</label><input className="w-full p-4 bg-white rounded-xl border-none outline-none text-sm font-medium" value={form.nickname} onChange={e => setForm({...form, nickname: e.target.value})} /></div>
                     <div><label className="block text-xs font-bold text-gray-500 mb-1.5">个人简介</label><textarea className="w-full p-4 bg-white rounded-xl border-none outline-none text-sm h-32 resize-none font-medium" value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} placeholder="介绍一下你自己..." /></div>
                     {/* ✨ 社交链接输入 */}
                     <div><label className="block text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1"><Linkedin size={12}/> LinkedIn URL</label><input className="w-full p-4 bg-white rounded-xl border-none outline-none text-sm font-medium" placeholder="https://linkedin.com/in/..." value={form.socialLinks.linkedin} onChange={e => setForm({...form, socialLinks: {...form.socialLinks, linkedin: e.target.value}})} /></div>
                     <div><label className="block text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1"><Instagram size={12}/> Instagram URL</label><input className="w-full p-4 bg-white rounded-xl border-none outline-none text-sm font-medium" placeholder="https://instagram.com/..." value={form.socialLinks.instagram} onChange={e => setForm({...form, socialLinks: {...form.socialLinks, instagram: e.target.value}})} /></div>
                 </div>
             </div>
        </div>
    );
};

const OfficialAds = ({ isAdmin }: { isAdmin: boolean }) => {
  const [ads, setAds] = useState<AdData[]>([]);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Partial<AdData> | null>(null);
  const fetchAds = async () => { try { setAds(await api.request('/ads')); } catch {} };
  useEffect(() => { fetchAds(); }, []);
  const handleSaveAd = async () => { if (!editingAd?.title) return; try { await api.request('/ads', { method: 'POST', body: JSON.stringify(editingAd) }); setEditingAd(null); setIsManagerOpen(false); fetchAds(); } catch {} };
  const handleDeleteAd = async (id: string) => { if(!confirm('确定删除?')) return; try { await api.request(`/ads/${id}`, { method: 'DELETE' }); fetchAds(); } catch {} };
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-3 px-1"><h3 className="font-bold text-gray-900 text-sm flex items-center gap-1"><Star size={14} className="text-orange-500" fill="currentColor"/> 官方推荐</h3>{isAdmin && <button onClick={() => { setEditingAd({}); setIsManagerOpen(true); }} className="text-[10px] bg-gray-800 text-white px-2 py-1 rounded-md font-bold hover:bg-green-700 transition flex items-center gap-1"><Plus size={10}/> 添加</button>}</div>
      <div className="flex overflow-x-auto gap-3 pb-2 hide-scrollbar snap-x">{ads.length > 0 ? ads.map(ad => (<div key={ad.id} className="snap-center min-w-[280px] bg-white rounded-xl shadow-sm p-3 flex gap-3 border border-gray-100 shrink-0 relative overflow-hidden group cursor-pointer" onClick={() => { setEditingAd(isAdmin ? ad : {...ad, readonly: true} as any); setIsManagerOpen(true); }}><div className="absolute right-0 top-0 w-16 h-16 bg-green-50 rounded-bl-full -mr-4 -mt-4"></div>{ad.imageUrl && <img src={ad.imageUrl} className="w-16 h-16 rounded-lg object-cover bg-gray-100 shadow-sm z-10" />}<div className="flex flex-col justify-center z-10 flex-1"><div className="flex items-center gap-1 mb-1"><span className="text-[9px] bg-green-700 text-white px-1.5 py-0.5 rounded-md font-bold">官方认证</span></div><div className="font-bold text-gray-900 text-sm line-clamp-1 mb-0.5">{ad.title}</div><div className="text-[10px] text-gray-500 line-clamp-1">{ad.content}</div></div>{isAdmin && <button onClick={(e) => {e.stopPropagation(); handleDeleteAd(ad.id);}} className="absolute top-2 right-2 p-1 bg-white rounded-full text-red-500 shadow-sm"><Trash2 size={12}/></button>}</div>)) : <div className="p-4 bg-white rounded-xl border border-dashed border-gray-200 text-center text-xs text-gray-400">暂无推荐</div>}</div>
      {isManagerOpen && <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl"><h3 className="text-lg font-bold mb-4">{editingAd && (editingAd as any).readonly ? '推荐详情' : '管理官方推荐'}</h3>{editingAd && (editingAd as any).readonly ? <div className="space-y-3">{editingAd.imageUrl && <img src={editingAd.imageUrl} className="w-full h-40 object-cover rounded-xl" />}<h4 className="font-bold text-lg">{editingAd.title}</h4><p className="text-sm text-gray-600 leading-relaxed">{editingAd.content}</p><button onClick={() => setIsManagerOpen(false)} className="w-full py-3 bg-gray-100 text-gray-800 rounded-xl font-bold mt-4">关闭</button></div> : <div className="space-y-3"><input className="w-full p-3 bg-gray-50 border rounded-xl text-sm" placeholder="标题" value={editingAd?.title || ''} onChange={e => setEditingAd(p => ({...p, title: e.target.value}))} /><textarea className="w-full p-3 bg-gray-50 border rounded-xl text-sm h-24 resize-none" placeholder="内容描述" value={editingAd?.content || ''} onChange={e => setEditingAd(p => ({...p, content: e.target.value}))} /><input className="w-full p-3 bg-gray-50 border rounded-xl text-sm" placeholder="图片 URL (可选)" value={editingAd?.imageUrl || ''} onChange={e => setEditingAd(p => ({...p, imageUrl: e.target.value}))} /><div className="flex gap-2 mt-4"><button onClick={() => setIsManagerOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm">取消</button><button onClick={handleSaveAd} className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm">保存发布</button></div></div>}</div></div>}
    </div>
  );
};

const CreatePostModal = ({ onClose, onCreated, user }: any) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ title: '', city: REGIONS[0], category: CATEGORIES[0], budget: '', description: '', timeInfo: '', type: 'client' as PostType, contactInfo: user?.contactValue || '' });
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const files = e.target.files; if (files) { if (images.length + files.length > 3) return alert('最多3张'); Array.from(files).forEach(f => { const r = new FileReader(); r.onloadend = () => setImages(p => [...p, r.result as string].slice(0,3)); r.readAsDataURL(f); }); } };
  const handleSubmit = async () => { if (!form.title || !form.budget) return alert('请完善信息'); setSubmitting(true); try { await api.request('/posts', { method: 'POST', body: JSON.stringify({ ...form, imageUrls: images }) }); onCreated(); onClose(); } catch (err: any) { alert(err.message === 'TODAY_LIMIT_REACHED' ? '今日发布已达上限' : '发布失败'); } finally { setSubmitting(false); } };
  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-[70]">
      <div className="bg-[#FFF8F0] w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6"><div><h3 className="text-xl font-extrabold text-gray-900">发布需求 <span className="text-xs font-normal bg-white px-2 py-1 rounded">Step {step}/3</span></h3></div><button onClick={onClose}><X/></button></div>
        {step === 1 && <div className="space-y-6"><div><label className="block text-sm font-bold mb-3">目标</label><div className="flex gap-3"><button onClick={() => setForm({...form, type: 'client'})} className={`flex-1 py-5 rounded-2xl border-2 font-bold ${form.type==='client'?'border-orange-500 bg-orange-100/50 text-orange-600':'border-white bg-white'}`}><span>🙋‍♂️</span> 找帮忙 (求助)</button><button onClick={() => setForm({...form, type: 'provider'})} className={`flex-1 py-5 rounded-2xl border-2 font-bold ${form.type==='provider'?'border-green-600 bg-green-100/50 text-green-700':'border-white bg-white'}`}><span>🤝</span> 我接单 (提供)</button></div></div><div className="flex flex-wrap gap-2">{CATEGORIES.map(c => <button key={c} onClick={() => setForm({...form, category: c})} className={`px-4 py-2 rounded-xl text-xs font-bold border ${form.category===c?'bg-gray-900 text-white':'bg-white'}`}>{c}</button>)}</div><button onClick={() => setStep(2)} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold mt-4">下一步</button></div>}
        {step === 2 && <div className="space-y-4"><input className="w-full p-4 bg-white rounded-2xl font-bold text-lg outline-none" placeholder="标题..." value={form.title} onChange={e => setForm({...form, title: e.target.value})} /><div className="flex gap-2 overflow-x-auto">{images.map((img,i)=><img key={i} src={img} className="w-16 h-16 rounded-lg object-cover"/>)}<label className="w-16 h-16 flex items-center justify-center border-2 border-dashed rounded-lg cursor-pointer"><Plus/><input type="file" hidden onChange={handleImageUpload}/></label></div><textarea className="w-full p-4 bg-white rounded-2xl h-32 resize-none outline-none" placeholder="描述..." value={form.description} onChange={e => setForm({...form, description: e.target.value})}/><div className="flex gap-3"><button onClick={()=>setStep(1)} className="flex-1 py-3 border rounded-2xl">上一步</button><button onClick={()=>setStep(3)} className="flex-[2] py-3 bg-gray-900 text-white rounded-2xl">下一步</button></div></div>}
        {step === 3 && <div className="space-y-4"><div className="grid grid-cols-2 gap-2">{REGIONS.map(r => <button key={r} onClick={() => setForm({...form, city: r})} className={`py-2 rounded-xl text-xs border ${form.city===r?'bg-green-700 text-white':'bg-white'}`}>{r}</button>)}</div><input className="w-full p-4 bg-white rounded-2xl outline-none" placeholder="预算" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})}/><input className="w-full p-4 bg-white rounded-2xl outline-none" placeholder="时间" value={form.timeInfo} onChange={e => setForm({...form, timeInfo: e.target.value})}/><div className="flex gap-3"><button onClick={()=>setStep(2)} className="flex-1 py-3 border rounded-2xl">上一步</button><button onClick={handleSubmit} disabled={submitting} className="flex-[2] py-3 bg-green-700 text-white rounded-2xl">{submitting?'...':'发布'}</button></div></div>}
      </div>
    </div>
  );
};

const LoginModal = ({ onClose, onLogin }: any) => {
  const [mode, setMode] = useState<'login'|'register'|'forgot'>('login');
  const [form, setForm] = useState({ email: '', password: '', nickname: '', contactType: 'wechat', contactValue: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (mode === 'forgot') { if(!forgotEmail) return setError('请输入邮箱'); setLoading(true); setTimeout(() => { alert(`链接已发送至 ${forgotEmail}`); setLoading(false); setMode('login'); }, 1500); return; }
    setLoading(true);
    try { const user = await api.request(mode==='register'?'/auth/register':'/auth/login', { method: 'POST', body: JSON.stringify(form) }); localStorage.setItem('currentUser', JSON.stringify(user)); onLogin(user); onClose(); } catch (e:any) { let msg = e.message || '失败'; if (msg.includes('User not found')) msg = '该账号尚未注册'; else if (msg.includes('Invalid password')) msg = '密码错误'; else if (msg.includes('User exists')) msg = '该邮箱已被注册'; setError(msg); } finally { setLoading(false); }
  };
  return (
     <div className="fixed inset-0 bg-gray-900/80 flex items-center justify-center p-6 z-[60] backdrop-blur-sm">
       <div className="bg-[#FFF8F0] p-8 rounded-[2rem] shadow-2xl w-full max-w-xs relative"><h2 className="text-3xl font-extrabold mb-6 text-center text-green-700">BAYLINK</h2>{error && <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-xs font-medium flex items-center gap-2"><AlertCircle size={14}/>{error}</div>}{mode === 'forgot' ? (<form onSubmit={handleSubmit} className="space-y-4"><input required className="w-full p-3.5 bg-white rounded-2xl" value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} placeholder="邮箱" /><button disabled={loading} className="w-full py-3.5 bg-gray-900 text-white rounded-2xl font-bold">{loading ? '...' : '发送重置邮件'}</button><button type="button" onClick={()=>setMode('login')} className="w-full text-xs text-center mt-2">返回登录</button></form>) : (<form onSubmit={handleSubmit} className="space-y-3"><input required className="w-full p-3.5 bg-white rounded-2xl" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} placeholder="邮箱账号" /><input required type="password" className="w-full p-3.5 bg-white rounded-2xl" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} placeholder="密码" />{mode === 'register' && <><input required className="w-full p-3.5 bg-white rounded-2xl" value={form.nickname} onChange={e=>setForm({...form, nickname:e.target.value})} placeholder="社区昵称" /><input required className="w-full p-3.5 bg-white rounded-2xl" value={form.contactValue} onChange={e=>setForm({...form, contactValue:e.target.value})} placeholder="微信号/电话 (用于私信)" /></>}{mode === 'login' && <div className="text-right"><button type="button" onClick={()=>setMode('forgot')} className="text-[10px] font-bold">忘记密码?</button></div>}<button disabled={loading} className="w-full py-3.5 bg-gray-900 text-white rounded-2xl font-bold">{loading ? '...' : (mode === 'register' ? '注册' : '登录')}</button></form>)}{mode !== 'forgot' && <button onClick={()=>setMode(mode==='login'?'register':'login')} className="w-full mt-6 text-xs text-center">{mode==='login'?'去注册':'去登录'}</button>}<button onClick={onClose} className="absolute top-4 right-4"><X/></button></div>
     </div>
  );
};

const ChatView = ({ currentUser, conversation, onClose }: any) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const refresh = useCallback(async () => { try { const data = await api.request(`/conversations/${conversation.id}/messages`); setMessages(prev => (JSON.stringify(prev) !== JSON.stringify(data) ? data : prev)); } catch {} }, [conversation.id]);
  useEffect(() => { refresh(); const i = setInterval(refresh, 3000); return () => clearInterval(i); }, [refresh]);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);
  const send = async (type: MessageType, content: string) => { if(!content && type==='text')return; try{ await api.request(`/conversations/${conversation.id}/messages`, { method: 'POST', body: JSON.stringify({ type, content }) }); setInput(''); refresh(); }catch{} };
  return (
    <div className="fixed inset-0 bg-[#FFF8F0] z-[100] flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/50 bg-[#FFF8F0]/95 pt-safe-top"><button onClick={onClose}><ChevronLeft/></button><span className="font-bold">{conversation.otherUser.nickname}</span></div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>{messages.map(m=>(<div key={m.id} className={`flex ${m.senderId===currentUser.id?'justify-end':'justify-start'}`}><div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${m.senderId===currentUser.id?'bg-green-700 text-white':'bg-white'}`}>{m.content}</div></div>))}</div>
      <div className="p-3 border-t flex gap-2 pb-safe"><button onClick={()=>confirm('分享联系方式?')&&send('contact-share','')}><Phone/></button><input className="flex-1 bg-white rounded-full px-4" value={input} onChange={e=>setInput(e.target.value)} /><button onClick={()=>send('text',input)}><Send/></button></div>
    </div>
  );
};

// ✨ Post Detail Modal (已更新：增加举报功能)
const PostDetailModal = ({ post, onClose, currentUser, onLoginNeeded, onOpenChat, onDeleted }: any) => {
  const [comments, setComments] = useState(post.comments || []);
  const [input, setInput] = useState('');
  const [isReported, setIsReported] = useState(post.isReported);
  const isAdmin = currentUser?.role === 'admin';
  const isOwner = currentUser?.id === post.authorId;
  const postComment = async () => { if(!currentUser)return onLoginNeeded(); if(!input.trim())return; try{const c = await api.request(`/posts/${post.id}/comments`, { method:'POST', body:JSON.stringify({content:input})}); setComments([...comments,c]); setInput('');}catch{} };
  const deletePost = async () => { if (!confirm('删除此贴？')) return; try { await api.request(`/posts/${post.id}`, { method: 'DELETE' }); onDeleted(); onClose(); } catch { alert('删除失败'); } };
  const handleReport = async () => { if(!currentUser) return onLoginNeeded(); if(isReported) return; if(!confirm('确认举报该内容违规？')) return; try { await api.reportPost(post.id, 'user_report'); setIsReported(true); alert('感谢反馈，我们将尽快审核'); } catch { alert('举报失败'); } };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-bottom-full duration-300 w-full h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b pt-safe-top">
          <button onClick={onClose}><X/></button>
          <div className="flex gap-4">
              {/* ✨ 举报按钮 */}
              {!isOwner && <button onClick={handleReport} className={`${isReported ? 'text-gray-300' : 'text-gray-400 hover:text-red-500'}`} disabled={isReported}><AlertTriangle size={20}/></button>}
              {(isAdmin || isOwner)&&<button onClick={deletePost}><Trash2 className="text-red-500"/></button>}
          </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5 pb-24 bg-[#FFF8F0]/30">
         <h1 className="text-2xl font-bold mb-4">{post.title}</h1>
         <div className="flex gap-3 mb-4"><Avatar src={post.author.avatar} name={post.author.nickname}/><span className="font-bold">{post.author.nickname}</span></div>
         <p className="mb-4">{post.description}</p>
         {post.imageUrls.map((u:string,i:number)=><img key={i} src={u} className="w-full rounded-xl mb-2"/>)}
         <div className="mt-6"><h3>评论</h3>{comments.map((c:any)=><div key={c.id} className="bg-white p-2 mt-2 rounded">{c.content}</div>)}</div>
      </div>
      <div className="border-t p-4 flex gap-3 items-center bg-white absolute bottom-0 w-full pb-safe"><input className="flex-1 bg-gray-100 rounded-full px-4 py-2" value={input} onChange={e=>setInput(e.target.value)}/><button onClick={postComment}><Send/></button>{!isOwner&&<button onClick={()=>{if(!currentUser)return onLoginNeeded();onOpenChat(post.authorId,post.author.nickname);}} className="bg-gray-900 text-white px-4 py-2 rounded-full">私信</button>}</div>
    </div>
  );
};

const ProfileView = ({ user, onLogout, onLogin, onOpenPost, onUpdateUser }: any) => {
  const [subView, setSubView] = useState<'menu' | 'my_posts' | 'support' | 'about' | 'edit_profile'>('menu');
  if (!user) return <div className="flex-1 flex flex-col items-center justify-center p-8"><button onClick={onLogin} className="w-full bg-green-700 text-white py-3 rounded-2xl font-bold">登录 / 注册</button></div>;
  return (
    <div className="flex-1 relative w-full h-full bg-[#FFF8F0]">
      {subView === 'menu' && (
        <div className="p-5 pt-4 w-full h-full overflow-y-auto">
           <div className="bg-white p-6 rounded-3xl shadow-soft border border-white mb-6 flex items-center gap-5">
             <Avatar src={user.avatar} name={user.nickname} size={16} className="shadow-md" />
             <div className="flex-1"><h2 className="text-xl font-black text-gray-900">{user.nickname}</h2><p className="text-xs text-gray-500 line-clamp-1 mt-1">{user.bio || '暂无简介'}</p></div>
             <button onClick={() => setSubView('edit_profile')} className="p-2 bg-gray-100 rounded-full"><Edit size={16}/></button>
           </div>
           <div className="bg-white rounded-3xl shadow-card overflow-hidden mb-6">{[{ label: '我的发布', icon: Edit, action: () => setSubView('my_posts') }, { label: '联系客服', icon: Phone, action: () => setSubView('support') }, { label: '关于我们', icon: Info, action: () => setSubView('about') }].map((item, i) => (<button key={i} onClick={item.action} className="w-full p-4 flex items-center justify-between hover:bg-[#FFF8F0]/50 transition border-b border-gray-100 last:border-none group"><div className="flex items-center gap-3"><item.icon size={16} className="text-green-700"/><span className="text-sm font-bold text-gray-900">{item.label}</span></div><ChevronRight size={16} className="text-gray-400"/></button>))}</div><button onClick={onLogout} className="w-full py-3.5 bg-white text-red-500 rounded-2xl font-bold text-sm shadow-sm border border-red-50">退出登录</button>
        </div>
      )}
      {subView === 'edit_profile' && <EditProfileModal user={user} onClose={() => setSubView('menu')} onUpdate={onUpdateUser} />}
      {subView === 'my_posts' && <MyPostsView user={user} onBack={() => setSubView('menu')} onOpenPost={onOpenPost} />}
      {subView === 'support' && <InfoPage title="联系客服" storageKey="baylink_support" user={user} onBack={() => setSubView('menu')} />}
      {subView === 'about' && <InfoPage title="关于我们" storageKey="baylink_about" user={user} onBack={() => setSubView('menu')} />}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [tab, setTab] = useState('home');
  const [showLogin, setShowLogin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  
  const [feedType, setFeedType] = useState<PostType>('client');
  const [posts, setPosts] = useState<PostData[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // ✨ 新增：首次加载状态，解决冷启动白屏问题
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [keyword, setKeyword] = useState('');
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const [chatConv, setChatConv] = useState<Conversation | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null); 
  const [regionFilter, setRegionFilter] = useState<string>('全部');
  const [categoryFilter, setCategoryFilter] = useState<string>('全部');

  useEffect(() => { setPage(1); setHasMore(true); fetchPosts(1, true); }, [feedType, regionFilter, categoryFilter, keyword]);
  useEffect(() => { const u = localStorage.getItem('currentUser'); if(u) setUser(JSON.parse(u)); }, []);

  const fetchPosts = async (pageNum: number, isRefresh: boolean = false) => {
    try {
      if (!isRefresh) setIsLoadingMore(true); else setIsInitialLoading(true);
      
      let queryParams = `?type=${feedType}&page=${pageNum}&limit=5`;
      if (keyword) queryParams += `&keyword=${encodeURIComponent(keyword)}`;
      
      const res = await api.request(`/posts${queryParams}`);
      const newPosts = res.posts || [];
      const more = res.hasMore;

      // 简单的前端过滤(防抖动)
      let filtered = newPosts;
      if (regionFilter !== '全部') filtered = filtered.filter((p: any) => p.city.includes(regionFilter));
      if (categoryFilter !== '全部') filtered = filtered.filter((p: any) => p.category === categoryFilter);

      if (isRefresh) setPosts(filtered); else setPosts(prev => [...prev, ...filtered]);
      setHasMore(more);
    } catch (e) { console.error(e); } finally { setIsLoadingMore(false); setIsInitialLoading(false); }
  };

  const handleLoadMore = () => { const nextPage = page + 1; setPage(nextPage); fetchPosts(nextPage, false); };
  const openChat = async (targetId: string, nickname?: string) => { try { const c = await api.request('/conversations/open-or-create', { method: 'POST', body: JSON.stringify({ targetUserId: targetId }) }); setChatConv({ id: c.id, otherUser: { id: targetId, nickname: nickname || 'User' }, lastMessage: '', updatedAt: Date.now() }); } catch { alert('Error'); } };
  const handleLogout = () => { localStorage.removeItem('currentUser'); setUser(null); setTab('home'); };

  return (
    <div className="fixed inset-0 bg-[#FFF8F0] flex justify-center font-sans text-gray-900">
      <div className="w-full max-w-[480px] bg-[#FFF8F0] h-full shadow-2xl relative flex flex-col border-x border-white/50">
        {tab === 'home' && <header className="px-5 pt-safe-top pb-2 flex justify-between items-center bg-[#FFF8F0] z-20 shrink-0"><div className="flex flex-col"><h1 className="font-rounded font-black text-2xl text-green-700 tracking-tighter flex items-center gap-1">BAYLINK <div className="w-2 h-2 bg-orange-500 rounded-full mt-1"></div></h1><span className="text-[10px] text-gray-500 font-bold tracking-widest">湾区邻里 · 互助平台</span></div><div onClick={()=>!user&&setShowLogin(true)} className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold cursor-pointer"><Avatar src={user?.avatar} name={user?.nickname} size={10}/></div></header>}
        
        <main className="flex-1 min-h-0 overflow-y-auto bg-[#FFF8F0] hide-scrollbar relative flex flex-col w-full" id="scroll-container">
           {tab === 'home' && (
               <div className="p-4 pb-24">
                   <div className="relative mb-4 mt-1"><Search className="absolute left-4 top-3.5 text-gray-400" size={18} /><input className="w-full bg-white rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium shadow-sm focus:ring-2 focus:ring-green-700/20 outline-none" placeholder="搜索..." value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchPosts(1, true)} /></div>
                   <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-4 px-1"><FilterTag label="全部地区" active={regionFilter === '全部'} onClick={() => setRegionFilter('全部')} />{REGIONS.map(r => <FilterTag key={r} label={r} active={regionFilter === r} onClick={() => setRegionFilter(r)} />)}</div>
                   <div className="bg-gray-100 p-1 rounded-2xl flex shadow-inner mb-4"><button onClick={()=>setFeedType('client')} className={`flex-1 py-3 rounded-xl text-xs font-bold ${feedType==='client'?'bg-orange-500 text-white':'text-gray-500'}`}><span>🙋‍♂️</span> 找帮忙 (求助)</button><button onClick={()=>setFeedType('provider')} className={`flex-1 py-3 rounded-xl text-xs font-bold ${feedType==='provider'?'bg-green-700 text-white':'text-gray-500'}`}><span>🤝</span> 我接单 (提供)</button></div>
                   <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 px-1 mb-4"><button onClick={() => setCategoryFilter('全部')} className={`px-3.5 py-2 rounded-xl text-[11px] font-bold border shadow-sm ${categoryFilter==='全部'?'bg-gray-800 text-white border-gray-800':'bg-white text-gray-700 border-white'}`}>全部</button>{CATEGORIES.map(c => <button key={c} onClick={() => setCategoryFilter(c)} className={`px-3.5 py-2 rounded-xl text-[11px] font-bold border shadow-sm ${categoryFilter===c?'bg-gray-800 text-white border-gray-800':'bg-white text-gray-700 border-white'}`}>{c}</button>)}</div>
                   <OfficialAds isAdmin={user?.role==='admin'} />
                   
                   {/* ✨ 优化体验：Loading 状态 */}
                   {isInitialLoading && posts.length === 0 ? (
                      <div className="py-20 text-center space-y-4">
                        <Loader2 className="animate-spin w-10 h-10 text-green-700 mx-auto"/>
                        <div><p className="text-gray-900 font-bold">正在连接社区...</p><p className="text-xs text-gray-500 mt-1">云服务器唤醒中，请稍候 ☕️</p></div>
                      </div>
                   ) : (
                      posts.map(p => <PostCard key={p.id} post={p} onClick={()=>setSelectedPost(p)} onContactClick={()=>{if(!user)return setShowLogin(true); openChat(p.authorId, p.author.nickname);}} onAvatarClick={(uid: string) => setViewingUserId(uid)} />)
                   )}
                   
                   {!isInitialLoading && posts.length > 0 && hasMore && <button onClick={handleLoadMore} disabled={isLoadingMore} className="w-full py-3 mt-4 bg-white text-gray-500 text-xs font-bold rounded-xl border border-gray-200 shadow-sm hover:bg-gray-50 disabled:opacity-50">{isLoadingMore ? <Loader2 className="animate-spin mx-auto w-4 h-4"/> : '加载更多'}</button>}
                   {!isInitialLoading && posts.length > 0 && !hasMore && <div className="text-center py-6 text-gray-300 text-xs font-bold">没有更多内容了</div>}
               </div>
           )}
           {tab === 'messages' && <div className="flex flex-col h-full w-full"><div className="px-5 pt-safe-top pb-4 bg-[#FFF8F0] border-b border-white/50"><h2 className="text-2xl font-black">消息</h2></div><MessagesList currentUser={user} onOpenChat={(c)=>{setChatConv(c)}}/></div>}
           {tab === 'notifications' && <div className="flex-1 flex items-center justify-center text-gray-400">暂无通知</div>}
           {tab === 'profile' && <ProfileView user={user} onLogin={()=>setShowLogin(true)} onLogout={handleLogout} onOpenPost={setSelectedPost} onUpdateUser={setUser} />}
        </main>

        <div className="bg-[#FFF8F0]/90 backdrop-blur-md border-t border-gray-200 px-6 py-2 pb-safe flex justify-between items-center z-40 relative shrink-0">
           <button onClick={()=>setTab('home')}><Home className={tab==='home'?'text-green-700':'text-gray-400'}/></button>
           <button onClick={()=>setTab('messages')}><MessageCircle className={tab==='messages'?'text-green-700':'text-gray-400'}/></button>
           <div className="-mt-10"><button onClick={()=>user?setShowCreate(true):setShowLogin(true)} className="w-16 h-16 bg-gray-900 rounded-full shadow-lg flex items-center justify-center text-white"><Plus size={32}/></button></div>
           <button onClick={()=>setTab('notifications')}><Bell className={tab==='notifications'?'text-green-700':'text-gray-400'}/></button>
           <button onClick={()=>setTab('profile')}><UserIcon className={tab==='profile'?'text-green-700':'text-gray-400'}/></button>
        </div>

        {showLogin && <LoginModal onClose={()=>setShowLogin(false)} onLogin={setUser}/>}
        {showCreate && <CreatePostModal user={user} onClose={()=>setShowCreate(false)} onCreated={() => fetchPosts(1, true)}/>}
        {selectedPost && <PostDetailModal post={selectedPost} currentUser={user} onClose={()=>setSelectedPost(null)} onLoginNeeded={()=>setShowLogin(true)} onOpenChat={openChat} onDeleted={()=>{setSelectedPost(null);fetchPosts(1, true);}}/>}
        {chatConv && user && <ChatView currentUser={user} conversation={chatConv} onClose={()=>setChatConv(null)}/>}
        {viewingUserId && <PublicProfileModal userId={viewingUserId} onClose={() => setViewingUserId(null)} onChat={openChat} currentUser={user} />}
      </div>
    </div>
  );
}