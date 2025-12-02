import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, Heart, Send, Plus, MapPin, 
  User as UserIcon, X, 
  ShieldCheck, Trash2, Edit, AlertCircle, Phone, 
  MessageSquare, Search, Info, Home, 
  ChevronDown, CheckCircle, Loader2
} from 'lucide-react';

/**
 * ============================================================================
 * CONFIGURATION
 * ============================================================================
 */

// ✅ 真实后端地址
const API_BASE_URL = 'https://baylink-api.onrender.com/api'; 

// --- Types ---

type Role = 'user' | 'admin';
type ContactType = 'phone' | 'wechat' | 'email';
type PostType = 'client' | 'provider';
type MessageType = 'text' | 'contact-request' | 'contact-share';

interface UserData {
  id: string;
  email: string;
  nickname: string;
  avatarUrl?: string;
  role: Role;
  contactType: ContactType;
  contactValue: string;
  isBanned: boolean;
  token?: string;
}

interface AdData {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  isVerified: boolean;
}

interface CommentData {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: number;
  parentId?: string;
  replies?: CommentData[];
}

interface PostData {
  id: string;
  authorId: string;
  author: {
    nickname: string;
    avatarUrl?: string;
    isBanned: boolean;
  };
  type: PostType;
  title: string;
  city: string;
  category: string;
  timeInfo: string;
  budget: string;
  language: string;
  description: string;
  contactInfo: string | null;
  imageUrls: string[];        
  likesCount: number;
  hasLiked: boolean;
  commentsCount: number;
  comments?: CommentData[];
  createdAt: number;
  isContacted?: boolean;
}

interface Conversation {
  id: string;
  otherUser: {
    id: string;
    nickname: string;
    avatarUrl?: string;
  };
  lastMessage?: string;
  updatedAt: number;
}

interface Message {
  id: string;
  senderId: string;
  type: MessageType;
  content: string;
  createdAt: number;
}

// --- Constants ---
const REGIONS = [
  "旧金山 (San Francisco)",
  "中半岛 (Peninsula)",
  "东湾 (East Bay)",
  "南湾 (South Bay)"
];

const CATEGORIES = [
  "租屋 (Rentals)",
  "房屋维修", 
  "家居清洁", 
  "搬家搬运", 
  "接送代驾", 
  "陪同翻译", 
  "个人兼职 (Part-time)",
  "闲置买卖", 
  "其他"
];

/**
 * ============================================================================
 * API CLIENT
 * ============================================================================
 */
const api = {
  request: async (endpoint: string, options: any = {}) => {
    // 真实后端请求
    const headers: any = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      const token = JSON.parse(userStr).token;
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    } catch (err: any) {
      console.error("API Error:", err);
      throw { message: err.error || err.message || 'Network Error' };
    }
  }
};

/**
 * ============================================================================
 * UI COMPONENTS
 * ============================================================================
 */

// --- Login Modal ---
const LoginModal = ({ onClose, onLogin }: any) => {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', nickname: '', contactType: 'wechat', contactValue: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const user = await api.request(endpoint, { method: 'POST', body: JSON.stringify(form) });
      localStorage.setItem('currentUser', JSON.stringify(user));
      onLogin(user);
      onClose();
    } catch (err: any) {
      setError(err.message || '登录/注册失败，请检查网络或重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm relative transform transition-all">
        <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 hover:text-gray-800 transition"><X size={24} /></button>
        <h2 className="text-2xl font-bold mb-2 text-center text-gray-900">{isRegister ? '加入 BayLink' : '欢迎回来'}</h2>
        <p className="text-center text-gray-500 mb-6 text-sm">连接湾区华人的生活互助社区</p>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm flex items-center gap-2"><AlertCircle size={16}/>{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <input required type="text" className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-sm font-medium" 
              value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="邮箱地址" />
          </div>
          <div className="space-y-1">
            <input required type="password" className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-sm font-medium" 
              value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="密码" />
          </div>

          {isRegister && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <input required type="text" className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-medium" 
                value={form.nickname} onChange={e => setForm({...form, nickname: e.target.value})} placeholder="昵称 (例如：Sunnyvale小张)" />
              <div className="flex gap-2">
                <div className="flex-1">
                  <select className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none" 
                    value={form.contactType} onChange={e => setForm({...form, contactType: e.target.value as any})}>
                    <option value="wechat">微信</option>
                    <option value="phone">电话</option>
                  </select>
                </div>
                <div className="flex-[2]">
                  <input required type="text" className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-medium" 
                    value={form.contactValue} onChange={e => setForm({...form, contactValue: e.target.value})} placeholder="微信号或号码" />
                </div>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 active:scale-95 transition shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:bg-blue-300">
            {loading && <Loader2 size={18} className="animate-spin" />}
            {isRegister ? '注册账号' : '立即登录'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button onClick={() => setIsRegister(!isRegister)} className="text-sm font-medium text-blue-600 hover:text-blue-700 transition">
            {isRegister ? '已有账号？去登录' : '没有账号？创建新账号'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Create Post Modal ---
const CreatePostModal = ({ onClose, onCreated, user }: any) => {
  const [form, setForm] = useState({
    title: '', city: REGIONS[0], category: CATEGORIES[0], budget: '', 
    description: '', timeInfo: '', language: '中文', type: 'client',
    contactInfo: user?.contactValue || '' 
  });
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        // Limit file size to 1MB to prevent heavy payload
        if (file.size > 1024 * 1024) {
          alert(`图片 "${file.name}" 太大 (超过1MB)，请压缩后上传。`);
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          setImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (form.title.length > 30) {
      setError('标题不能超过30个字');
      return;
    }
    if (!form.budget) {
      setError('请填写预算/价格');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { ...form, imageUrls: images };
      await api.request('/posts', { method: 'POST', body: JSON.stringify(payload) });
      onCreated();
      onClose();
    } catch (err: any) {
      if (err.message === 'TODAY_LIMIT_REACHED') {
        setError('您今天已经发布过一条信息了，请明天再来。');
      } else {
        setError(err.message || '发布失败，请检查网络');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-3xl p-6 max-h-[85vh] overflow-y-auto shadow-2xl relative">
        <div className="sticky top-0 bg-white z-10 pb-4 border-b border-gray-100 flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">发布新需求 / 服务</h3>
            <p className="text-[11px] text-gray-400 mt-1">每个账号每天最多发布 1 条</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition"><X size={20} /></button>
        </div>
        
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm flex items-center gap-2 border border-red-100"><AlertCircle size={18}/>{error}</div>}

        <div className="space-y-6">
          <div className="bg-gray-100 p-1.5 rounded-2xl flex">
            {['client', 'provider'].map(t => (
              <button key={t} onClick={() => setForm({...form, type: t})} 
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${form.type === t ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                {t === 'client' ? '找人帮忙' : '我来接单'}
              </button>
            ))}
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">标题</label>
              <span className={`text-xs font-medium ${form.title.length > 30 ? 'text-red-500' : 'text-gray-400'}`}>{form.title.length}/30</span>
            </div>
            <input 
              maxLength={30}
              placeholder="例如：San Jose 搬家求助 / 提供机场接送" 
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-base" 
              value={form.title} 
              onChange={e => setForm({...form, title: e.target.value})} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">地区</label>
              <div className="relative">
                <select className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl appearance-none outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium" value={form.city} onChange={e => setForm({...form, city: e.target.value})}>
                  {REGIONS.map(c => <option key={c} value={c}>{c.split('(')[0].trim()}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-4 text-gray-400 pointer-events-none" size={16} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">分类</label>
              <div className="relative">
                <select className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl appearance-none outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-4 text-gray-400 pointer-events-none" size={16} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">照片 (最多3张)</label>
            <div className="flex gap-2 text-xs text-orange-600 bg-orange-50 p-2 rounded-lg items-center">
              <ShieldCheck size={14}/> <span>严禁上传违规内容，违者封号。</span>
            </div>
            <div className="flex flex-wrap gap-3 mt-2">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-gray-200 shadow-sm group">
                  <img src={img} alt="preview" className="w-full h-full object-cover" />
                  <button onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition"><X size={12} /></button>
                </div>
              ))}
              {images.length < 3 && (
                <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition group">
                  <div className="bg-blue-50 text-blue-500 p-2 rounded-full mb-1 group-hover:scale-110 transition"><Plus size={20} /></div>
                  <span className="text-[10px] font-bold text-gray-400 group-hover:text-blue-500">上传</span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">时间要求</label>
              <input placeholder="例如：本周末" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500" value={form.timeInfo} onChange={e => setForm({...form, timeInfo: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">预算 / 报价</label>
              <input placeholder="$" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} />
            </div>
          </div>

          <div className="space-y-2">
             <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">联系方式 (仅私信分享)</label>
             <div className="relative">
               <input placeholder="WeChat / Phone" className="w-full p-4 pl-10 bg-yellow-50/50 border border-yellow-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-yellow-400 text-gray-800" value={form.contactInfo} onChange={e => setForm({...form, contactInfo: e.target.value})} />
               <Phone className="absolute left-3.5 top-4 text-yellow-600" size={16} />
             </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">详细描述</label>
            <textarea placeholder="请详细描述您的需求..." className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl h-32 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>

          <button onClick={handleSubmit} disabled={submitting} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition flex items-center justify-center gap-2 disabled:bg-blue-300">
             {submitting && <Loader2 size={20} className="animate-spin" />}
             立即发布
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Official Ads ---
const OfficialAds = ({ isAdmin }: { isAdmin: boolean }) => {
  const [ads, setAds] = useState<AdData[]>([]);

  useEffect(() => {
    const fetch = async () => { 
        try { setAds(await api.request('/ads')); } catch(e) {} 
    };
    fetch();
  }, []);

  if (ads.length === 0) return null;

  return (
    <div className="mb-6 px-4">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100/50">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-blue-900 flex items-center gap-2 text-sm">
            <ShieldCheck size={18} className="text-blue-600" /> 
            湾区生活 · 官方推荐
          </h3>
          <span className="text-[10px] font-bold text-blue-600 bg-white/80 px-2 py-1 rounded-full shadow-sm">
            实名认证 · 平台担保
          </span>
        </div>
        
        <div className="flex overflow-x-auto gap-3 pb-2 snap-x hide-scrollbar">
          {ads.map(ad => (
            <div key={ad.id} className="snap-center min-w-[240px] bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden flex-shrink-0 relative group cursor-pointer hover:shadow-md transition">
              <div className="flex p-3 gap-3">
                {ad.imageUrl && (
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                    <img src={ad.imageUrl} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex flex-col justify-center">
                  <div className="font-bold text-gray-900 text-sm mb-0.5">{ad.title}</div>
                  <p className="text-xs text-gray-500 line-clamp-2 leading-tight">{ad.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Post Detail Modal ---
const PostDetailModal = ({ post, onClose, currentUser, onLoginNeeded, onOpenChat, onDeleted }: any) => {
  const [comments, setComments] = useState(post.comments || []);
  const [replyContent, setReplyContent] = useState('');
  const [deleting, setDeleting] = useState(false);
  const isAdmin = currentUser?.role === 'admin';

  const handleSendComment = async () => {
    if (!currentUser) return onLoginNeeded();
    if (!replyContent.trim()) return;
    
    try {
        const newComment = await api.request(`/posts/${post.id}/comments`, {
        method: 'POST', body: JSON.stringify({ content: replyContent })
        });
        setComments([...comments, { ...newComment, replies: [] }]); 
        setReplyContent('');
    } catch(e) {
        alert('发送评论失败');
    }
  };

  const handleDeletePost = async () => {
    if (!currentUser || !isAdmin) return;
    if (!window.confirm('确定要删除这条帖子吗？')) return;
    try {
      setDeleting(true);
      await api.request(`/posts/${post.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (e) {
      setDeleting(false);
      alert('删除失败，请稍后再试');
    }
  };

  const handlePrivateChat = () => {
    if (!currentUser) return onLoginNeeded();
    onOpenChat(post.authorId, post.author.nickname, post.author.avatarUrl);
  };

  return (
    <div className="fixed inset-0 bg-white z-[100] flex flex-col animate-in slide-in-from-bottom-full duration-300">
      <div className="px-4 py-3 border-b flex items-center gap-4 bg-white sticky top-0 z-10">
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition"><X size={24} /></button>
        <div className="flex-1 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
            {post.author.nickname[0]}
          </div>
          <span className="font-bold text-sm truncate">{post.author.nickname}</span>
        </div>
        {isAdmin && (
          <button
            disabled={deleting}
            onClick={handleDeletePost}
            className="flex items-center gap-1 text-xs font-bold text-red-500 px-2 py-1 rounded-full border border-red-200 hover:bg-red-50"
          >
            <Trash2 size={14} /> 删除
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 pb-24">
        <div className="bg-white p-5 mb-2">
          <div className="flex flex-wrap gap-2 mb-3">
             <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-bold">{post.category}</span>
             <span className="px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-bold flex items-center gap-1"><MapPin size={10}/> {post.city}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-4 leading-relaxed">{post.title}</h1>
          
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-gray-50 p-3 rounded-xl">
              <span className="text-xs text-gray-400 block mb-1">预算</span>
              <span className="text-sm font-bold text-orange-600">{post.budget || '面议'}</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl">
              <span className="text-xs text-gray-400 block mb-1">时间</span>
              <span className="text-sm font-bold text-gray-700">{post.timeInfo || '协商'}</span>
            </div>
          </div>

          <p className="text-gray-700 text-base leading-relaxed whitespace-pre-wrap mb-4">{post.description}</p>
          
          {post.imageUrls?.length > 0 && (
            <div className="space-y-2 mb-6">
              {post.imageUrls.map((url: string, i: number) => (
                <img key={i} src={url} className="w-full rounded-2xl border border-gray-100" />
              ))}
            </div>
          )}

          <div className="mt-3 p-3 rounded-xl bg-yellow-50 border border-yellow-100 text-[11px] text-yellow-800 flex items-start gap-2">
            <ShieldCheck size={14} className="mt-0.5" />
            <span>为了保护隐私，电话 / 微信不会出现在公开页面。可以通过底部「私信 TA」按钮与对方沟通，并由对方选择是否在聊天中分享联系方式。</span>
          </div>

          <div className="text-xs text-gray-400 mt-6 pt-4 border-t">
            发布于 {new Date(post.createdAt).toLocaleString()}
          </div>
        </div>

        <div className="bg-white p-5 min-h-[200px]">
          <h3 className="font-bold text-gray-900 mb-4">评论 ({comments.length})</h3>
          <div className="space-y-4">
            {comments.map((c: any) => (
              <div key={c.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-gray-500">
                  {c.authorName[0]}
                </div>
                <div className="flex-1 bg-gray-50 p-3 rounded-2xl rounded-tl-none">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-bold text-gray-700">{c.authorName}</span>
                    <span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-600">{c.content}</p>
                </div>
              </div>
            ))}
            {comments.length === 0 && <div className="text-center text-gray-400 py-8 text-sm">还没有评论，来坐沙发吧</div>}
          </div>
        </div>
      </div>

      <div className="bg-white border-t p-3 px-4 pb-safe flex items-center gap-3 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
        <div className="flex-1 relative">
          <input 
            className="w-full bg-gray-100 border-0 rounded-full py-2.5 px-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={currentUser ? "发表评论..." : "登录后评论"}
            value={replyContent}
            onChange={e => setReplyContent(e.target.value)}
            disabled={!currentUser}
          />
          <button onClick={handleSendComment} className="absolute right-2 top-1.5 p-1 text-blue-600 disabled:text-gray-400">
            <Send size={18} />
          </button>
        </div>
        <button
          onClick={handlePrivateChat}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition"
        >
          私信 TA
        </button>
      </div>
    </div>
  );
};

// --- Feed Item ---
const PostCard = ({ post, onClick, onContactClick }: any) => {
  const isProvider = post.type === 'provider';
  const contacted = !!post.isContacted;

  const handleContact = (e: React.MouseEvent) => {
    e.stopPropagation();
    onContactClick(post);
  };
  
  return (
    <div onClick={onClick} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 active:scale-[0.99] transition-transform duration-100 cursor-pointer">
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-3 items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ${isProvider ? 'bg-green-500' : 'bg-blue-500'}`}>
            {post.author.nickname[0]}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <div className="text-sm font-bold text-gray-900">{post.author.nickname}</div>
              <CheckCircle size={12} className="text-green-500" fill="currentColor" color="white" />
            </div>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              <span>{new Date(post.createdAt).getMonth()+1}月{new Date(post.createdAt).getDate()}日</span>
              <span>·</span>
              <span>{isProvider ? '服务者' : '需求方'}</span>
            </div>
          </div>
        </div>
        <div className="text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-100">
          {post.budget || '面议'}
        </div>
      </div>
      
      <h3 className="font-bold text-base mb-1.5 text-gray-900 line-clamp-1">{post.title}</h3>
      <p className="text-sm text-gray-500 mb-3 line-clamp-2 leading-relaxed">{post.description}</p>
      
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 text-xs font-medium">{post.city.split('(')[0]}</span>
        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-xs font-medium">{post.category}</span>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <div className="flex gap-4">
          <div className="flex items-center gap-1 text-xs text-gray-400 font-medium">
            <Heart size={14} /> {post.likesCount}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400 font-medium">
            <MessageSquare size={14} /> {post.commentsCount}
          </div>
        </div>
        <button
          onClick={handleContact}
          className={`text-xs font-bold px-3 py-1.5 rounded-full border transition flex items-center gap-1 ${
            contacted
              ? 'text-gray-500 border-gray-200 bg-gray-50'
              : (isProvider ? 'text-green-600 border-green-200 bg-green-50' : 'text-blue-600 border-blue-200 bg-blue-50')
          }`}
        >
          {contacted ? (
            <>
              <CheckCircle size={12} /> 已联系
            </>
          ) : (
            <>
              {isProvider ? '联系服务' : '我来帮忙'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// --- Chat View (With Polling) ---
const ChatView = ({ currentUser, conversation, onClose }: { currentUser: UserData | null, conversation: Conversation, onClose: () => void }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      const data = await api.request(`/conversations/${conversation.id}/messages`, { method: 'GET' });
      setMessages(prev => {
        if (data.length !== prev.length) return data;
        return prev;
      });
    } catch(e) {}
  }, [conversation.id]);

  useEffect(() => {
    loadMessages().then(() => {
       setTimeout(() => scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight), 50);
    });
  }, [loadMessages]);

  useEffect(() => {
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const sendText = async () => {
    if (!currentUser) return;
    if (!input.trim()) return;
    try {
      setSending(true);
      const msg = await api.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ type: 'text' as MessageType, content: input.trim() })
      });
      setInput('');
      setMessages(prev => [...prev, msg]);
      setTimeout(() => scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight), 50);
    } catch(e) {
        alert('发送失败');
    } finally {
      setSending(false);
    }
  };

  const sendContactShare = async () => {
    if (!currentUser) return;
    if (!window.confirm('确定要在当前对话中分享您的联系方式吗？')) return;
    try {
        const msg = await api.request(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ type: 'contact-share' as MessageType, content: '' })
        });
        setMessages(prev => [...prev, msg]);
        setTimeout(() => scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight), 50);
    } catch(e) {
        alert('操作失败');
    }
  };

  const renderMessageBubble = (m: Message) => {
    const isMe = m.senderId === currentUser?.id;
    const baseCls = 'max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed';
    if (m.type === 'contact-share') {
      return (
        <div className={`${baseCls} bg-yellow-50 border border-yellow-200 text-yellow-900`}>
          <div className="flex items-center gap-2 mb-1">
            <Phone size={14} className="text-yellow-700" />
            <span className="text-[11px] font-bold">联系方式已分享</span>
          </div>
          <div className="text-xs whitespace-pre-wrap">{m.content}</div>
        </div>
      );
    }
    return (
      <div className={`${baseCls} ${isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm'}`}>
        {m.content}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-white z-[120] flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
          <X size={22} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
            {conversation.otherUser.nickname?.[0] || 'U'}
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">{conversation.otherUser.nickname || '用户'}</div>
            <div className="text-[11px] text-gray-400">通过 BayLink 安全私信沟通</div>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gray-50 px-3 py-4">
        {messages.map((m) => {
          const isMe = m.senderId === currentUser?.id;
          return (
            <div key={m.id} className={`flex mb-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {renderMessageBubble(m)}
            </div>
          );
        })}
      </div>

      <div className="border-t bg-white px-3 py-2 flex items-center gap-2">
        <button
          onClick={sendContactShare}
          className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold text-yellow-700 bg-yellow-50 border border-yellow-200"
        >
          <Phone size={12} /> 分享我的联系方式
        </button>
        <div className="flex-1 flex items-center gap-2">
          <input
            className="flex-1 bg-gray-100 rounded-full px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="输入消息..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !sending && sendText()}
          />
          <button
            onClick={sendText}
            disabled={sending}
            className="p-2 rounded-full bg-blue-600 text-white disabled:bg-blue-200"
          >
            {sending ? <Loader2 size={18} className="animate-spin"/> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Messages List ---
const MessagesList = ({ currentUser, onOpenChat }: { currentUser: UserData | null, onOpenChat: (conv: Conversation) => void }) => {
  const [convs, setConvs] = useState<Conversation[]>([]);
  
  useEffect(() => {
    if (!currentUser) return;
    const load = async () => {
        try { setConvs(await api.request('/conversations')); } catch(e) {}
    }
    load();
    const interval = setInterval(async () => {
      try { setConvs(await api.request('/conversations')); } catch(e) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  if (!currentUser) return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
      <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
        <MessageCircle size={32} className="text-blue-400" />
      </div>
      <h3 className="font-bold text-gray-900 mb-2">登录后查看消息</h3>
      <p className="text-gray-500 text-sm mb-6">与发布者直接沟通，保护隐私</p>
    </div>
  );

  return (
    <div className="flex-1 bg-white">
      <div className="sticky top-0 bg-white/90 backdrop-blur z-10 p-4 border-b">
        <h2 className="text-xl font-bold text-gray-900">消息</h2>
      </div>
      <div className="divide-y">
        {convs.map(c => (
          <div
            key={c.id}
            onClick={() => onOpenChat(c)}
            className="flex items-center gap-3 p-4 hover:bg-gray-50 transition cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-500">
              {c.otherUser.nickname?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between mb-1">
                <span className="font-bold text-gray-900">{c.otherUser.nickname || '用户'}</span>
                <span className="text-xs text-gray-400">{new Date(c.updatedAt).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-gray-500 truncate">{c.lastMessage || '开始聊天...'}</p>
            </div>
          </div>
        ))}
        {convs.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">暂无消息</div>
        )}
      </div>
    </div>
  );
};

// --- Profile View ---
const ProfileView = ({ user, onLogout, onLogin }: any) => {
  if (!user) return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
      <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-gray-300">
        <UserIcon size={48} />
      </div>
      <button onClick={onLogin} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200">
        登录 / 注册
      </button>
    </div>
  );

  return (
    <div className="flex-1 bg-gray-50">
      <div className="bg-white p-6 pb-8 rounded-b-[2rem] shadow-sm mb-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600">
            {user.nickname[0]}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{user.nickname}</h2>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md mt-1 inline-block">
              {user.role === 'admin' ? '管理员' : '认证会员'}
            </span>
          </div>
        </div>
        <div className="flex gap-4 text-center">
          <div className="flex-1 bg-gray-50 p-3 rounded-2xl">
            <div className="font-bold text-lg text-gray-900">0</div>
            <div className="text-xs text-gray-500">我的发布</div>
          </div>
          <div className="flex-1 bg-gray-50 p-3 rounded-2xl">
            <div className="font-bold text-lg text-gray-900">0</div>
            <div className="text-xs text-gray-500">收藏夹</div>
          </div>
        </div>
      </div>

      <div className="bg-white mx-4 rounded-2xl shadow-sm overflow-hidden mb-6">
        {[
          { icon: Edit, label: '编辑资料' },
          { icon: ShieldCheck, label: '实名认证' },
          { icon: Info, label: '关于我们' },
        ].map((item, i) => (
          <div key={i} className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-gray-50 cursor-pointer">
             <div className="flex items-center gap-3">
               <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><item.icon size={18}/></div>
               <span className="font-medium text-gray-700">{item.label}</span>
             </div>
             <ChevronDown className="-rotate-90 text-gray-300" size={16} />
          </div>
        ))}
      </div>

      <div className="px-4">
        <button onClick={onLogout} className="w-full bg-white text-red-500 py-3 rounded-2xl font-bold shadow-sm hover:bg-red-50 transition">
          退出登录
        </button>
      </div>
    </div>
  );
};

// --- Main App ---
export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'messages' | 'profile'>('home');
  const [showLogin, setShowLogin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const [activeChatConv, setActiveChatConv] = useState<Conversation | null>(null);

  // Feed State
  const [posts, setPosts] = useState<PostData[]>([]);
  const [feedType, setFeedType] = useState<PostType>('client');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('currentUser');
    if (stored) setUser(JSON.parse(stored));
    fetchPosts();
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
        const res = await api.request(`/posts?type=${feedType}&keyword=${keyword}`);
        setPosts(res);
    } catch(e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  }, [feedType, keyword]); 

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setUser(null);
    setActiveChatConv(null);
  };

  const handleOpenChatFromPost = async (targetUserId: string, nickname?: string, avatarUrl?: string) => {
    if (!user) {
      setShowLogin(true);
      return;
    }
    try {
        const conv = await api.request('/conversations/open-or-create', {
        method: 'POST',
        body: JSON.stringify({ targetUserId })
        });
        setActiveChatConv({
        id: conv.id,
        otherUser: {
            id: targetUserId,
            nickname: nickname || '用户',
            avatarUrl
        },
        lastMessage: '',
        updatedAt: Date.now()
        });
        setActiveTab('messages');
    } catch(e) {
        alert('无法开启对话');
    }
  };

  const handleContactClick = async (post: PostData) => {
    if (!user) {
      setShowLogin(true);
      return;
    }
    await api.request(`/posts/${post.id}/contact-mark`, { method: 'POST' });
    await fetchPosts();
    await handleOpenChatFromPost(post.authorId, post.author.nickname, post.author.avatarUrl);
  };

  const renderHome = () => (
    <>
      <div className="sticky top-0 bg-white z-20 px-4 pt-safe-top pb-2 shadow-[0_2px_15px_rgba(0,0,0,0.03)]">
        <div className="flex justify-between items-center h-14 mb-2">
          <div className="flex items-center gap-1.5 cursor-pointer">
            <span className="font-extrabold text-2xl text-blue-600 tracking-tight">BayLink</span>
            <div className="bg-blue-50 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md mt-1">BETA</div>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-full pl-3 pr-2 py-1.5 cursor-pointer hover:bg-gray-200 transition">
             <MapPin size={14} className="text-gray-500" />
             <span className="text-xs font-bold text-gray-700 truncate max-w-[100px]">San Francisco Bay</span>
             <ChevronDown size={14} className="text-gray-400" />
          </div>
        </div>
        
        <div className="relative mb-3">
          <Search className="absolute left-3.5 top-3.5 text-gray-400" size={18} />
          <input 
            className="w-full bg-gray-100 border-none rounded-2xl pl-10 pr-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
            placeholder="搜索服务、需求或位置..."
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchPosts()}
          />
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl">
           <button onClick={() => setFeedType('client')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${feedType === 'client' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>
             Find Help (找人帮忙)
           </button>
           <button onClick={() => setFeedType('provider')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${feedType === 'provider' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>
             Offer Help (我来接单)
           </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-24 min-h-screen bg-[#F5F5F7]">
        <OfficialAds isAdmin={user?.role === 'admin'} />
        
        {loading ? (
          <div className="text-center py-10 text-gray-400 text-sm">加载中...</div>
        ) : posts.length > 0 ? (
          posts.map(post => (
            <PostCard 
              key={post.id} 
              post={post} 
              currentUser={user}
              onLoginNeeded={() => setShowLogin(true)}
              onClick={() => setSelectedPost(post)}
              onContactClick={handleContactClick}
            />
          ))
        ) : (
          <div className="text-center py-20">
            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300">
              <Search size={32} />
            </div>
            <p className="text-gray-400 text-sm font-medium mb-2">暂时没有相关信息</p>
            <p className="text-[11px] text-gray-400 mb-4">可以尝试修改搜索条件，或发布第一条信息</p>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="bg-[#F5F5F7] min-h-screen font-sans max-w-md mx-auto shadow-2xl overflow-hidden relative border-x border-gray-100">
      <div className="h-full overflow-y-auto hide-scrollbar">
        {activeTab === 'home' && renderHome()}
        {activeTab === 'messages' && (
          <MessagesList
            currentUser={user}
            onOpenChat={(conv) => setActiveChatConv(conv)}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileView
            user={user}
            onLogin={() => setShowLogin(true)}
            onLogout={handleLogout}
          />
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-2 pb-safe flex justify-between items-center z-40">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'home' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">首页</span>
        </button>
        
        <button onClick={() => { if(!user) setShowLogin(true); else setShowCreate(true); }} className="mb-8">
           <div className="bg-blue-600 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-blue-300 hover:scale-105 active:scale-95 transition">
             <Plus size={28} />
           </div>
        </button>

        <button onClick={() => setActiveTab('messages')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'messages' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <div className="relative">
            <MessageSquare size={24} strokeWidth={activeTab === 'messages' ? 2.5 : 2} />
            {user && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
          </div>
          <span className="text-[10px] font-medium">消息</span>
        </button>

        <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'profile' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <UserIcon size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">我的</span>
        </button>
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={setUser} />}
      {showCreate && <CreatePostModal user={user} onClose={() => setShowCreate(false)} onCreated={fetchPosts} />}
      {selectedPost && (
        <PostDetailModal 
          post={selectedPost} 
          currentUser={user} 
          onClose={() => setSelectedPost(null)} 
          onLoginNeeded={() => setShowLogin(true)}
          onOpenChat={handleOpenChatFromPost}
          onDeleted={() => { setSelectedPost(null); fetchPosts(); }}
        />
      )}
      {activeTab === 'messages' && activeChatConv && user && (
        <ChatView
          currentUser={user}
          conversation={activeChatConv}
          onClose={() => setActiveChatConv(null)}
        />
      )}
    </div>
  );
}