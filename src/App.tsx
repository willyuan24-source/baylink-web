import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, Heart, Send, Plus, MapPin, 
  User as UserIcon, X, 
  ShieldCheck, Trash2, Edit, AlertCircle, Phone, 
  MessageSquare, Search, Info, Home, 
  ChevronDown, CheckCircle, Loader2
} from 'lucide-react';

// FINAL VERSION V8: 强制样式修正 + 布局居中优化

const API_BASE_URL = 'https://baylink-api.onrender.com/api'; 

// --- Types ---
type Role = 'user' | 'admin';
type ContactType = 'phone' | 'wechat' | 'email';
type PostType = 'client' | 'provider';
type MessageType = 'text' | 'contact-request' | 'contact-share';

interface UserData {
  id: string; email: string; nickname: string; role: Role;
  contactType: ContactType; contactValue: string; isBanned: boolean; token?: string;
}
interface AdData { id: string; title: string; content: string; imageUrl?: string; isVerified: boolean; }
interface CommentData { id: string; authorId: string; authorName: string; content: string; createdAt: number; parentId?: string; replies?: CommentData[]; }
interface PostData {
  id: string; authorId: string; author: { nickname: string; avatarUrl?: string; isBanned: boolean; };
  type: PostType; title: string; city: string; category: string; timeInfo: string; budget: string;
  language: string; description: string; contactInfo: string | null; imageUrls: string[];
  likesCount: number; hasLiked: boolean; commentsCount: number; comments?: CommentData[];
  createdAt: number; isContacted?: boolean;
}
interface Conversation {
  id: string; otherUser: { id: string; nickname: string; avatarUrl?: string; };
  lastMessage?: string; updatedAt: number;
}
interface Message { id: string; senderId: string; type: MessageType; content: string; createdAt: number; }

const REGIONS = ["旧金山 (SF)", "中半岛 (Peninsula)", "东湾 (East Bay)", "南湾 (South Bay)"];
const CATEGORIES = ["租屋", "维修", "清洁", "搬家", "接送", "翻译", "兼职", "闲置", "其他"];

// --- API Client ---
const api = {
  request: async (endpoint: string, options: any = {}) => {
    const headers: any = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      try {
        const token = JSON.parse(userStr).token;
        headers['Authorization'] = `Bearer ${token}`;
      } catch (e) { localStorage.removeItem('currentUser'); }
    }
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    } catch (err: any) {
      console.error("API Error:", err);
      throw { message: err.error || err.message || '网络连接错误' };
    }
  }
};

// --- Components ---

const LoginModal = ({ onClose, onLogin }: any) => {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', nickname: '', contactType: 'wechat', contactValue: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const user = await api.request(endpoint, { method: 'POST', body: JSON.stringify(form) });
      localStorage.setItem('currentUser', JSON.stringify(user));
      onLogin(user); onClose();
    } catch (err: any) { setError(err.message || '操作失败'); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
      <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-xs animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">{isRegister ? '注册' : '登录'}</h2>
          <button onClick={onClose}><X className="text-gray-400 hover:text-gray-600" size={20}/></button>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-xs flex items-center gap-2"><AlertCircle size={14}/>{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required className="w-full p-3 bg-gray-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="邮箱" />
          <input required type="password" className="w-full p-3 bg-gray-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="密码" />
          {isRegister && (
            <>
              <input required className="w-full p-3 bg-gray-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" value={form.nickname} onChange={e => setForm({...form, nickname: e.target.value})} placeholder="昵称" />
              <div className="flex gap-2">
                <select className="w-1/3 p-3 bg-gray-50 border rounded-xl text-sm" value={form.contactType} onChange={e => setForm({...form, contactType: e.target.value as any})}><option value="wechat">微信</option><option value="phone">电话</option></select>
                <input required className="flex-1 p-3 bg-gray-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" value={form.contactValue} onChange={e => setForm({...form, contactValue: e.target.value})} placeholder="号码/ID" />
              </div>
            </>
          )}
          <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition flex justify-center gap-2">
            {loading && <Loader2 size={18} className="animate-spin" />}{isRegister ? '注册并登录' : '登录'}
          </button>
        </form>
        <button onClick={() => setIsRegister(!isRegister)} className="w-full mt-4 text-xs text-blue-600 hover:underline">{isRegister ? '已有账号？去登录' : '没有账号？去注册'}</button>
      </div>
    </div>
  );
};

const CreatePostModal = ({ onClose, onCreated, user }: any) => {
  const [form, setForm] = useState({ title: '', city: REGIONS[0], category: CATEGORIES[0], budget: '', description: '', timeInfo: '', language: '中文', type: 'client', contactInfo: user?.contactValue || '' });
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(file => {
        if (file.size > 1024 * 1024) { alert('图片过大 (>1MB)'); return; }
        const reader = new FileReader();
        reader.onloadend = () => setImages(p => [...p, reader.result as string]);
        reader.readAsDataURL(file);
      });
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.budget.trim()) { setError('请填写必填项'); return; }
    setSubmitting(true);
    try {
      await api.request('/posts', { method: 'POST', body: JSON.stringify({ ...form, imageUrls: images }) });
      onCreated(); onClose();
    } catch (err: any) { setError(err.message === 'TODAY_LIMIT_REACHED' ? '每日限发一条' : '发布失败'); } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center sm:p-4 z-50 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-full duration-300">
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-white z-10 pb-2 border-b">
          <h3 className="text-lg font-bold text-gray-900">发布信息</h3>
          <button onClick={onClose}><X className="text-gray-500" size={20}/></button>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-2 rounded-lg mb-4 text-xs">{error}</div>}
        <div className="space-y-4">
          <div className="bg-gray-100 p-1 rounded-lg flex">
            {['client', 'provider'].map(t => (
              <button key={t} onClick={() => setForm({...form, type: t})} className={`flex-1 py-2 rounded-md text-xs font-bold transition ${form.type === t ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>{t === 'client' ? '找帮忙' : '我接单'}</button>
            ))}
          </div>
          <input maxLength={30} placeholder="标题 (如: San Jose 搬家求助)" className="w-full p-3 bg-gray-50 border rounded-xl text-sm focus:border-blue-500 outline-none" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          <div className="grid grid-cols-2 gap-3">
            <select className="w-full p-3 bg-gray-50 border rounded-xl text-sm outline-none" value={form.city} onChange={e => setForm({...form, city: e.target.value})}>{REGIONS.map(c => <option key={c} value={c}>{c}</option>)}</select>
            <select className="w-full p-3 bg-gray-50 border rounded-xl text-sm outline-none" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
          </div>
          <div className="flex gap-2 overflow-x-auto py-1">
            {images.map((img, i) => <div key={i} className="relative w-16 h-16 flex-shrink-0"><img src={img} className="w-full h-full object-cover rounded-lg border" /><button onClick={() => setImages(p => p.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 bg-black/50 text-white p-0.5 rounded-bl"><X size={10}/></button></div>)}
            <label className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"><Plus size={20} className="text-gray-400"/><input type="file" accept="image/*" className="hidden" onChange={handleImage} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="时间" className="w-full p-3 bg-gray-50 border rounded-xl text-sm outline-none" value={form.timeInfo} onChange={e => setForm({...form, timeInfo: e.target.value})} />
            <input placeholder="预算/价格" className="w-full p-3 bg-gray-50 border rounded-xl text-sm outline-none" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} />
          </div>
          <textarea placeholder="详细描述..." className="w-full p-3 bg-gray-50 border rounded-xl h-24 text-sm outline-none resize-none" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          <button onClick={handleSubmit} disabled={submitting} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-95 transition">{submitting ? '发布中...' : '立即发布'}</button>
        </div>
      </div>
    </div>
  );
};

const OfficialAds = () => {
  const [ads, setAds] = useState<AdData[]>([]);
  useEffect(() => { const f = async () => { try { setAds(await api.request('/ads')); } catch {} }; f(); }, []);
  if (ads.length === 0) return null;
  return (
    <div className="mb-4 px-4">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100">
        <div className="flex justify-between items-center mb-2"><h3 className="font-bold text-blue-900 text-xs flex items-center gap-1"><ShieldCheck size={14}/> 官方推荐</h3><span className="text-[10px] bg-white px-2 py-0.5 rounded-full text-blue-600 font-bold shadow-sm">平台担保</span></div>
        <div className="flex overflow-x-auto gap-3 pb-1 hide-scrollbar snap-x">
          {ads.map(ad => (
            <div key={ad.id} className="snap-center min-w-[200px] bg-white rounded-lg shadow-sm p-2 flex gap-2 border border-blue-50 shrink-0">
              {ad.imageUrl && <img src={ad.imageUrl} className="w-12 h-12 rounded object-cover bg-gray-100" />}
              <div className="flex flex-col justify-center"><div className="font-bold text-gray-900 text-xs line-clamp-1">{ad.title}</div><div className="text-[10px] text-gray-500 line-clamp-1">{ad.content}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PostCard = ({ post, onClick, onContactClick }: any) => {
  const isProvider = post.type === 'provider';
  return (
    <div onClick={onClick} className="bg-white p-4 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-100 active:scale-[0.98] transition cursor-pointer mb-3">
      <div className="flex justify-between items-start mb-2">
        <div className="flex gap-2 items-center">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white ${isProvider ? 'bg-green-500' : 'bg-blue-500'}`}>{post.author.nickname[0]}</div>
          <div>
            <div className="text-sm font-bold text-gray-900 flex items-center gap-1">{post.author.nickname} <CheckCircle size={10} className="text-green-500" fill="currentColor" color="white"/></div>
            <div className="text-[10px] text-gray-400">{new Date(post.createdAt).toLocaleDateString()} · {isProvider ? '服务' : '求助'}</div>
          </div>
        </div>
        <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-md">{post.budget}</span>
      </div>
      <h3 className="font-bold text-base text-gray-800 mb-1 line-clamp-1">{post.title}</h3>
      <p className="text-xs text-gray-500 mb-3 line-clamp-2">{post.description}</p>
      <div className="flex gap-2 mb-3">
        <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px]">{post.city.split('(')[0]}</span>
        <span className="bg-blue-50 text-blue-500 px-2 py-0.5 rounded text-[10px]">{post.category}</span>
      </div>
      <div className="flex justify-between items-center border-t pt-2">
        <div className="flex gap-3 text-gray-400 text-xs"><span className="flex items-center gap-1"><Heart size={12}/> {post.likesCount}</span><span className="flex items-center gap-1"><MessageSquare size={12}/> {post.commentsCount}</span></div>
        <button onClick={(e) => {e.stopPropagation(); onContactClick(post);}} className={`text-xs px-3 py-1 rounded-full border font-bold ${post.isContacted ? 'bg-gray-50 text-gray-400' : 'bg-white text-blue-600 border-blue-200'}`}>{post.isContacted ? '已联系' : '私信 TA'}</button>
      </div>
    </div>
  );
};

const ChatView = ({ currentUser, conversation, onClose }: any) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try { 
      const data = await api.request(`/conversations/${conversation.id}/messages`);
      setMessages(prev => (JSON.stringify(prev) !== JSON.stringify(data) ? data : prev));
    } catch {}
  }, [conversation.id]);

  useEffect(() => { refresh(); const i = setInterval(refresh, 3000); return () => clearInterval(i); }, [refresh]);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  const send = async (type: MessageType, content: string) => {
    if (!content && type === 'text') return;
    try {
      await api.request(`/conversations/${conversation.id}/messages`, { method: 'POST', body: JSON.stringify({ type, content }) });
      setInput(''); refresh();
    } catch { alert('发送失败'); }
  };

  return (
    <div className="fixed inset-0 bg-white z-[100] flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white">
        <button onClick={onClose}><X size={20}/></button>
        <span className="font-bold text-sm">{conversation.otherUser.nickname}</span>
      </div>
      <div className="flex-1 overflow-y-auto bg-gray-50 p-3 space-y-3" ref={scrollRef}>
        {messages.map(m => {
          const isMe = m.senderId === currentUser.id;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${isMe ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 border'} ${m.type === 'contact-share' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : ''}`}>
                {m.type === 'contact-share' && <div className="text-[10px] font-bold mb-1 flex items-center gap-1"><Phone size={10}/> 联系方式</div>}
                {m.content}
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-3 bg-white border-t flex gap-2 items-center">
        <button onClick={() => confirm('分享联系方式？') && send('contact-share', '')} className="p-2 bg-gray-100 rounded-full text-gray-500"><Phone size={18}/></button>
        <input className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none" value={input} onChange={e => setInput(e.target.value)} placeholder="输入消息..." />
        <button onClick={() => send('text', input)} className="p-2 bg-blue-600 rounded-full text-white"><Send size={18}/></button>
      </div>
    </div>
  );
};

const PostDetailModal = ({ post, onClose, currentUser, onLoginNeeded, onOpenChat, onDeleted }: any) => {
  const [comments, setComments] = useState(post.comments || []);
  const [input, setInput] = useState('');
  const isAdmin = currentUser?.role === 'admin';

  const postComment = async () => {
    if (!currentUser) return onLoginNeeded();
    if (!input.trim()) return;
    try {
      const c = await api.request(`/posts/${post.id}/comments`, { method: 'POST', body: JSON.stringify({ content: input }) });
      setComments([...comments, c]); setInput('');
    } catch { alert('评论失败'); }
  };

  const deletePost = async () => {
    if (!confirm('删除此贴？')) return;
    try { await api.request(`/posts/${post.id}`, { method: 'DELETE' }); onDeleted(); onClose(); } catch { alert('删除失败'); }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-bottom-full duration-300">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <button onClick={onClose}><X size={20}/></button>
        {isAdmin && <button onClick={deletePost}><Trash2 size={18} className="text-red-500"/></button>}
      </div>
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <h1 className="text-xl font-bold mb-2">{post.title}</h1>
        <div className="flex gap-2 mb-4 text-xs text-gray-500"><span>{post.city}</span><span>•</span><span>{post.category}</span></div>
        <div className="bg-orange-50 p-3 rounded-xl mb-4 flex justify-between items-center">
          <div><div className="text-xs text-gray-400">预算</div><div className="font-bold text-orange-600">{post.budget}</div></div>
          <div><div className="text-xs text-gray-400">时间</div><div className="font-bold text-gray-700">{post.timeInfo}</div></div>
        </div>
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap mb-4">{post.description}</p>
        {post.imageUrls.map((url:string, i:number) => <img key={i} src={url} className="w-full rounded-xl mb-2 border" />)}
        
        <div className="mt-6 pt-4 border-t">
          <h3 className="font-bold mb-3 text-sm">评论 ({comments.length})</h3>
          {comments.map((c:any) => (
            <div key={c.id} className="flex gap-2 mb-3">
              <div className="w-6 h-6 bg-gray-200 rounded-full flex-shrink-0"/>
              <div className="bg-gray-50 p-2 rounded-xl text-xs flex-1">
                <div className="font-bold text-gray-600 mb-1">{c.authorName}</div>
                {c.content}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t p-3 flex gap-2 items-center bg-white absolute bottom-0 w-full pb-safe">
        <input className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none" placeholder={currentUser ? "写评论..." : "登录后评论"} value={input} onChange={e => setInput(e.target.value)} disabled={!currentUser} />
        <button onClick={postComment} disabled={!input} className="text-blue-600 p-2"><Send size={20}/></button>
        <button onClick={() => { if(!currentUser) return onLoginNeeded(); onOpenChat(post.authorId, post.author.nickname); }} className="bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold">私信</button>
      </div>
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
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const [chatConv, setChatConv] = useState<Conversation | null>(null);
  const [myConvs, setMyConvs] = useState<Conversation[]>([]);

  const fetchPosts = useCallback(async () => {
    setLoading(true); try { setPosts(await api.request(`/posts?type=${feedType}&keyword=${keyword}`)); } catch {} finally { setLoading(false); }
  }, [feedType, keyword]);

  useEffect(() => { const u = localStorage.getItem('currentUser'); if (u) setUser(JSON.parse(u)); fetchPosts(); }, [fetchPosts]);
  
  const loadConvs = async () => { if(user) try { setMyConvs(await api.request('/conversations')); } catch {} };
  useEffect(() => { if(tab === 'messages') loadConvs(); }, [tab, user]);

  const openChat = async (targetId: string, nickname?: string) => {
    try {
      const c = await api.request('/conversations/open-or-create', { method: 'POST', body: JSON.stringify({ targetUserId: targetId }) });
      setChatConv({ id: c.id, otherUser: { id: targetId, nickname: nickname || 'User' }, lastMessage: '', updatedAt: Date.now() });
    } catch { alert('错误'); }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex justify-center font-sans text-gray-900">
      <div className="w-full max-w-[480px] bg-white min-h-screen shadow-2xl relative flex flex-col border-x border-gray-200">
        
        {tab === 'home' && (
          <>
            <div className="sticky top-0 bg-white/95 backdrop-blur z-30 px-4 pt-safe-top pb-2 border-b border-gray-100">
              <div className="flex justify-between items-center h-12">
                <div className="font-black text-xl text-blue-600 tracking-tight">BayLink</div>
                <div className="bg-gray-100 px-2 py-1 rounded-full text-[10px] text-gray-500 flex items-center gap-1"><MapPin size={10}/> 湾区 <ChevronDown size={10}/></div>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-2 text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition" 
                  placeholder="搜索服务、需求..." value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchPosts()} />
              </div>
              <div className="bg-gray-100 p-1 rounded-lg flex">
                <button onClick={() => setFeedType('client')} className={`flex-1 py-1.5 rounded text-xs font-bold transition ${feedType === 'client' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>找帮忙</button>
                <button onClick={() => setFeedType('provider')} className={`flex-1 py-1.5 rounded text-xs font-bold transition ${feedType === 'provider' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500'}`}>接任务</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 pb-24 bg-[#FAFAFA] hide-scrollbar">
              <OfficialAds />
              {loading ? <div className="text-center py-10 text-gray-400 text-xs">加载中...</div> : 
               posts.length > 0 ? posts.map(p => <PostCard key={p.id} post={p} onClick={() => setSelectedPost(p)} onContactClick={async () => { if(!user) return setShowLogin(true); await api.request(`/posts/${p.id}/contact-mark`, {method:'POST'}); fetchPosts(); openChat(p.authorId, p.author.nickname); }} />) : 
               <div className="text-center py-20 text-gray-400 text-xs">暂无内容</div>}
            </div>
          </>
        )}

        {tab === 'messages' && (
          <div className="flex-1 p-4 pt-safe-top">
            <h2 className="text-xl font-bold mb-4">消息</h2>
            {!user ? <div className="text-center text-gray-400 text-sm mt-10">请先登录</div> : 
             myConvs.map(c => (
               <div key={c.id} onClick={() => setChatConv(c)} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl cursor-pointer mb-2 border border-gray-100 bg-white">
                 <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">{c.otherUser.nickname?.[0]}</div>
                 <div><div className="font-bold text-sm">{c.otherUser.nickname}</div><div className="text-xs text-gray-400 truncate w-40">{c.lastMessage || '点击查看消息'}</div></div>
               </div>
             ))}
          </div>
        )}

        {tab === 'profile' && (
          <div className="flex-1 p-6 pt-safe-top bg-gray-50">
            <div className="bg-white p-6 rounded-3xl shadow-sm text-center mb-6">
              <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto flex items-center justify-center text-2xl font-bold text-blue-600 mb-3">{user?.nickname?.[0] || <UserIcon/>}</div>
              <h2 className="text-xl font-bold">{user?.nickname || '未登录'}</h2>
              {user ? <button onClick={handleLogout} className="mt-4 px-6 py-2 bg-gray-100 text-red-500 rounded-full text-xs font-bold">退出</button> : 
               <button onClick={() => setShowLogin(true)} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-full text-xs font-bold shadow-lg">立即登录</button>}
            </div>
          </div>
        )}

        <div className="absolute bottom-0 w-full bg-white border-t px-6 py-3 pb-safe flex justify-between items-end z-40">
          <button onClick={() => setTab('home')} className={`flex flex-col items-center gap-1 ${tab==='home'?'text-blue-600':'text-gray-400'}`}><Home size={24} strokeWidth={tab==='home'?2.5:2}/><span className="text-[10px]">首页</span></button>
          <button onClick={() => {if(user) setShowCreate(true); else setShowLogin(true);}} className="mb-1"><div className="w-12 h-12 bg-blue-600 rounded-full shadow-lg flex items-center justify-center text-white hover:scale-105 transition"><Plus size={24}/></div></button>
          <button onClick={() => setTab('messages')} className={`flex flex-col items-center gap-1 ${tab==='messages'?'text-blue-600':'text-gray-400'}`}><MessageSquare size={24} strokeWidth={tab==='messages'?2.5:2}/><span className="text-[10px]">消息</span></button>
          <button onClick={() => setTab('profile')} className={`flex flex-col items-center gap-1 ${tab==='profile'?'text-blue-600':'text-gray-400'}`}><UserIcon size={24} strokeWidth={tab==='profile'?2.5:2}/><span className="text-[10px]">我的</span></button>
        </div>

        {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={setUser} />}
        {showCreate && <CreatePostModal user={user} onClose={() => setShowCreate(false)} onCreated={fetchPosts} />}
        {selectedPost && <PostDetailModal post={selectedPost} currentUser={user} onClose={() => setSelectedPost(null)} onLoginNeeded={() => setShowLogin(true)} onOpenChat={openChat} onDeleted={() => {setSelectedPost(null); fetchPosts();}} />}
        {chatConv && user && <ChatView currentUser={user} conversation={chatConv} onClose={() => setChatConv(null)} />}
      </div>
    </div>
  );
}