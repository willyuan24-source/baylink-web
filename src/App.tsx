import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, Heart, Send, Plus, MapPin, 
  User as UserIcon, X, ShieldCheck, Trash2, Edit, 
  AlertCircle, Phone, Search, Home, Bell, 
  ChevronDown, CheckCircle, Loader2, ChevronLeft, 
  Save, RefreshCw, Clock, Filter, MoreHorizontal, Star, Menu, LogOut, ChevronRight,
  MessageSquare, Lock, Mail as MailIcon, ArrowRight
} from 'lucide-react';

// BAYLINK APP V8.0 - 布局与显示终极修复版

/**
 * ================= CONFIGURATION =================
 */
const API_BASE_URL = 'https://baylink-api.onrender.com/api'; 

// --- Types ---
type Role = 'user' | 'admin';
type PostType = 'client' | 'provider';
interface UserData {
  id: string; email: string; nickname: string; role: Role;
  contactType: 'phone'|'wechat'|'email'; contactValue: string; isBanned: boolean; token?: string;
}
interface AdData { id: string; title: string; content: string; imageUrl?: string; isVerified: boolean; }
interface PostData {
  id: string; authorId: string; author: { nickname: string; avatarUrl?: string; };
  type: PostType; title: string; city: string; category: string; timeInfo: string; budget: string;
  description: string; contactInfo: string | null; imageUrls: string[];
  likesCount: number; hasLiked: boolean; commentsCount: number; comments?: any[];
  createdAt: number; isContacted?: boolean;
}
interface Conversation {
  id: string; otherUser: { id: string; nickname: string; }; lastMessage?: string; updatedAt: number;
}
interface Message { id: string; senderId: string; type: 'text'|'contact-request'|'contact-share'; content: string; createdAt: number; }

// --- Constants ---
const REGIONS = ["旧金山", "中半岛", "东湾", "南湾"];
const CATEGORIES = ["租屋", "维修", "清洁", "搬家", "接送", "翻译", "兼职", "闲置", "其他"];

// --- API Client ---
const triggerSessionExpired = () => {
  const event = new Event('session-expired');
  window.dispatchEvent(event);
};

const api = {
  request: async (endpoint: string, options: any = {}) => {
    const headers: any = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      try {
        const token = JSON.parse(userStr).token;
        if(token) headers['Authorization'] = `Bearer ${token}`;
      } catch (e) { 
        localStorage.removeItem('currentUser'); 
      }
    }
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
      if (res.status === 401 || res.status === 403) {
        triggerSessionExpired();
        throw { status: res.status, message: '登录已过期' };
      }
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    } catch (err: any) {
      console.error("API Error:", err);
      if (err.status === 401 || err.status === 403) throw err;
      throw { message: err.error || err.message || '网络错误' };
    }
  }
};

/**
 * ================= SUB-COMPONENTS =================
 */

// 🦴 Skeleton Loader
const SkeletonCard = () => (
  <div className="bg-white p-5 rounded-2xl shadow-sm mb-3 border border-white animate-pulse">
    <div className="flex justify-between mb-3">
      <div className="flex gap-3 items-center">
        <div className="w-10 h-10 bg-brand-light rounded-full"/>
        <div className="space-y-2">
          <div className="w-24 h-3 bg-brand-light rounded"/>
          <div className="w-16 h-2 bg-brand-light rounded"/>
        </div>
      </div>
      <div className="w-16 h-6 bg-brand-light rounded-md"/>
    </div>
    <div className="w-3/4 h-4 bg-brand-light rounded mb-2"/>
    <div className="w-full h-3 bg-brand-light rounded mb-4"/>
    <div className="flex justify-between pt-2">
      <div className="w-20 h-3 bg-brand-light rounded"/>
      <div className="w-20 h-8 bg-brand-light rounded-full"/>
    </div>
  </div>
);

// 🏷️ Filter Tag Component
const FilterTag = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 whitespace-nowrap border shadow-sm ${
      active 
        ? 'bg-brand-forest text-white border-brand-forest shadow-brand-forest/20' 
        : 'bg-white text-brand-gray border-brand-light hover:border-brand-forest/30 hover:text-brand-dark'
    }`}
  >
    {label}
  </button>
);

// 📄 Info Page (管理员可编辑)
const InfoPage = ({ title, storageKey, user, onBack }: any) => {
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    setContent(saved || '暂无内容，管理员可点击右上角编辑。');
    setEditValue(saved || '');
  }, [storageKey]);

  const handleSave = () => {
    localStorage.setItem(storageKey, editValue);
    setContent(editValue);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-brand-cream flex flex-col w-full h-full">
      <div className="px-4 py-3 border-b border-white/50 flex items-center justify-between bg-brand-cream/95 backdrop-blur sticky top-0 pt-safe-top shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 hover:bg-white rounded-full transition"><ChevronLeft size={24} className="text-brand-dark"/></button>
          <span className="font-bold text-lg text-brand-dark">{title}</span>
        </div>
        {user?.role === 'admin' && !isEditing && (
          <button onClick={() => setIsEditing(true)} className="text-brand-forest text-sm font-bold flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm"><Edit size={14}/> 编辑</button>
        )}
        {isEditing && (
          <button onClick={handleSave} className="text-white bg-brand-forest text-sm font-bold flex items-center gap-1 px-3 py-1.5 rounded-full shadow-md"><Save size={14}/> 保存</button>
        )}
      </div>
      <div className="flex-1 p-5 overflow-y-auto bg-white">
        {isEditing ? (
          <textarea className="w-full h-full p-4 bg-gray-50 border rounded-xl text-sm outline-none resize-none shadow-inner" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="在这里输入内容..." />
        ) : (
          <div className="text-brand-dark text-sm leading-relaxed whitespace-pre-wrap">{content}</div>
        )}
      </div>
    </div>
  );
};

// 📰 My Posts View
const MyPostsView = ({ user, onBack, onOpenPost }: any) => {
  const [myPosts, setMyPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const allPosts = await api.request('/posts'); 
        const filtered = allPosts.filter((p: PostData) => p.authorId === user.id);
        setMyPosts(filtered);
      } catch (e) {
        console.error(e);
      } finally { setLoading(false); }
    };
    load();
  }, [user.id]);

  return (
    <div className="fixed inset-0 z-50 bg-brand-cream flex flex-col w-full h-full">
      <div className="px-4 py-3 border-b border-white/50 flex items-center gap-2 bg-brand-cream/95 backdrop-blur sticky top-0 pt-safe-top shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-white rounded-full transition"><ChevronLeft size={24} className="text-brand-dark"/></button>
        <span className="font-bold text-lg text-brand-dark">我的发布</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pb-24 bg-[#FAFAFA]">
        {loading ? <div className="text-center py-10 text-brand-gray text-xs">加载中...</div> : 
         myPosts.length > 0 ? myPosts.map(p => <PostCard key={p.id} post={p} onClick={() => onOpenPost(p)} onContactClick={()=>{}} />) : 
         <div className="text-center py-20 opacity-60">
            <div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-soft"><Edit size={32} className="text-brand-gray/50"/></div>
            <p className="text-sm font-bold text-brand-gray">你还没有发布过内容</p>
         </div>}
      </div>
    </div>
  );
};

// 🏠 Post Card
const PostCard = ({ post, onClick, onContactClick }: any) => {
  const isProvider = post.type === 'provider';
  return (
    <div onClick={onClick} className="bg-white p-5 rounded-2xl shadow-card border border-white hover:border-brand-forest/20 transition-all duration-300 cursor-pointer mb-3 group active:scale-[0.98]">
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-3 items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ${isProvider ? 'bg-brand-forest' : 'bg-brand-orange'}`}>
            {post.author.nickname ? post.author.nickname[0] : <UserIcon size={16}/>}
          </div>
          <div>
            <div className="text-sm font-bold text-brand-dark flex items-center gap-1">
              {post.author.nickname} 
              <ShieldCheck size={12} className="text-brand-forest" fill="#E8F5E9" />
            </div>
            <div className="text-[10px] text-brand-gray flex items-center gap-2 mt-0.5">
              <span>{new Date(post.createdAt).toLocaleDateString()}</span>
              <span className="w-0.5 h-2 bg-brand-light"></span>
              <span className="flex items-center gap-0.5"><MapPin size={10}/> 湾区</span>
            </div>
          </div>
        </div>
        <div className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${isProvider ? 'bg-brand-forest/5 text-brand-forest border-brand-forest/20' : 'bg-brand-orange/5 text-brand-orange border-brand-orange/20'}`}>
          {isProvider ? '我帮忙' : '求帮助'}
        </div>
      </div>
      
      <div className="mb-3">
        <h3 className="font-bold text-[15px] text-brand-dark mb-1.5 line-clamp-1 group-hover:text-brand-forest transition-colors">{post.title}</h3>
        <p className="text-xs text-brand-gray leading-relaxed line-clamp-2">{post.description}</p>
      </div>

      <div className="flex justify-between items-center mb-4 border-b border-brand-light/50 pb-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="bg-brand-cream px-2 py-0.5 rounded text-[10px] text-brand-dark/70 font-medium border border-brand-light">{post.category}</span>
          <span className="bg-brand-cream px-2 py-0.5 rounded text-[10px] text-brand-dark/70 font-medium border border-brand-light">{post.city}</span>
        </div>
        <div className="font-bold text-sm text-brand-orange font-mono">{post.budget}</div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-brand-gray">
           <button className="flex items-center gap-1 text-xs hover:text-brand-orange transition"><Heart size={16}/> {post.likesCount}</button>
           <button className="flex items-center gap-1 text-xs hover:text-brand-forest transition"><MessageSquare size={16}/> {post.commentsCount}</button>
        </div>
        <button 
          onClick={(e) => {e.stopPropagation(); onContactClick(post);}}
          className="text-xs bg-brand-dark text-white px-4 py-2 rounded-full font-bold shadow-md hover:bg-brand-forest transition flex items-center gap-1"
        >
          <MessageCircle size={12} /> 私信 TA
        </button>
      </div>
    </div>
  );
};

// 📣 Official Ads Banner
const OfficialAds = ({ isAdmin }: { isAdmin: boolean }) => {
  const [ads, setAds] = useState<AdData[]>([]);
  useEffect(() => { const f = async () => { try { setAds(await api.request('/ads')); } catch {} }; f(); }, []);
  if (ads.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-3 px-1"><h3 className="font-bold text-brand-dark text-sm flex items-center gap-1"><Star size={14} className="text-brand-orange" fill="currentColor"/> 官方推荐</h3>{isAdmin && <span className="text-[10px] bg-brand-light px-1.5 py-0.5 rounded text-brand-gray">管理</span>}</div>
      <div className="flex overflow-x-auto gap-3 pb-2 hide-scrollbar snap-x">
        {ads.map(ad => (
          <div key={ad.id} className="snap-center min-w-[280px] bg-white rounded-xl shadow-sm p-3 flex gap-3 border border-brand-light shrink-0 relative overflow-hidden group">
             <div className="absolute right-0 top-0 w-16 h-16 bg-brand-forest/5 rounded-bl-full -mr-4 -mt-4"></div>{ad.imageUrl && <img src={ad.imageUrl} className="w-16 h-16 rounded-lg object-cover bg-gray-100 shadow-sm z-10" />}
             <div className="flex flex-col justify-center z-10 flex-1"><div className="flex items-center gap-1 mb-1"><span className="text-[9px] bg-brand-forest text-white px-1.5 py-0.5 rounded-md font-bold">官方认证</span></div><div className="font-bold text-brand-dark text-sm line-clamp-1 mb-0.5">{ad.title}</div><div className="text-[10px] text-brand-gray line-clamp-1">{ad.content}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 📝 Create Post Modal
const CreatePostModal = ({ onClose, onCreated, user }: any) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ title: '', city: REGIONS[0], category: CATEGORIES[0], budget: '', description: '', timeInfo: '', type: 'client' as PostType, contactInfo: user?.contactValue || '' });
  const [submitting, setSubmitting] = useState(false);
  
  const handleSubmit = async () => {
    if (!form.title || !form.budget) return alert('请完善信息');
    setSubmitting(true);
    try {
      await api.request('/posts', { method: 'POST', body: JSON.stringify({ ...form, imageUrls: [] }) });
      onCreated(); onClose();
    } catch (err: any) { alert(err.message === 'TODAY_LIMIT_REACHED' ? '今日发布已达上限' : '发布失败'); } 
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-[70]">
      <div className="bg-brand-cream w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6"><div><h3 className="text-xl font-extrabold text-brand-dark font-rounded flex items-center gap-2">发布需求 <span className="text-xs font-normal text-brand-gray bg-white px-2 py-1 rounded-full border border-brand-light">Step {step}/3</span></h3><div className="flex gap-1 mt-2">{[1, 2, 3].map(i => (<div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i <= step ? 'w-8 bg-brand-forest' : 'w-2 bg-brand-light'}`} />))}</div></div><button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-brand-light text-brand-dark shadow-sm"><X size={20}/></button></div>
        {step === 1 && (
          <div className="space-y-6">
            <div><label className="block text-sm font-bold text-brand-dark mb-3">你的目标是？</label><div className="flex gap-3"><button onClick={() => setForm({...form, type: 'client'})} className={`flex-1 py-5 rounded-2xl border-2 font-bold text-base transition flex flex-col items-center gap-2 ${form.type === 'client' ? 'border-brand-orange bg-brand-orange/5 text-brand-orange' : 'border-brand-light bg-white text-brand-gray'}`}><span>🤔</span> 找人帮忙</button><button onClick={() => setForm({...form, type: 'provider'})} className={`flex-1 py-5 rounded-2xl border-2 font-bold text-base transition flex flex-col items-center gap-2 ${form.type === 'provider' ? 'border-brand-forest bg-brand-forest/5 text-brand-forest' : 'border-brand-light bg-white text-brand-gray'}`}><span>💪</span> 我来接单</button></div></div>
            <div><label className="block text-sm font-bold text-brand-dark mb-3">选择分类</label><div className="flex flex-wrap gap-2">{CATEGORIES.map(c => (<button key={c} onClick={() => setForm({...form, category: c})} className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition ${form.category === c ? 'bg-brand-dark text-white border-brand-dark shadow-lg' : 'bg-white text-brand-gray border-brand-light hover:border-brand-gray'}`}>{c}</button>))}</div></div>
            <button onClick={() => setStep(2)} className="w-full py-4 bg-brand-dark text-white rounded-2xl font-bold mt-2 text-base shadow-lg hover:opacity-90 transition">下一步</button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1"><label className="text-xs font-bold text-brand-gray">标题</label><input className="w-full p-4 bg-white border-none rounded-2xl font-bold text-lg outline-none focus:ring-2 focus:ring-brand-forest/20 text-brand-dark placeholder:text-gray-300" placeholder="例如：周末搬家求助..." value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-brand-gray">详细描述</label><textarea className="w-full p-4 bg-white border-none rounded-2xl text-sm outline-none h-36 resize-none focus:ring-2 focus:ring-brand-forest/20 text-brand-dark placeholder:text-gray-300" placeholder="请描述具体需求、时间、地点细节..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
            <div className="flex justify-between gap-3 pt-2"><button onClick={() => setStep(1)} className="flex-1 py-3.5 border border-brand-light bg-white rounded-2xl font-bold text-brand-gray hover:bg-gray-50">上一步</button><button onClick={() => setStep(3)} className="flex-[2] py-3.5 bg-brand-dark text-white rounded-2xl font-bold shadow-lg hover:opacity-90">下一步</button></div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <div><label className="block text-xs font-bold text-brand-gray mb-2">所在区域</label><div className="grid grid-cols-2 gap-2">{REGIONS.map(r => (<button key={r} onClick={() => setForm({...form, city: r})} className={`py-2.5 rounded-xl text-xs font-bold border transition ${form.city === r ? 'bg-brand-forest text-white border-brand-forest' : 'bg-white text-brand-gray border-brand-light'}`}>{r}</button>))}</div></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-bold text-brand-gray mb-1">预算/报价 ($)</label><input className="w-full p-3 bg-white rounded-xl font-bold text-brand-orange border-none outline-none" placeholder="$0" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} /></div><div><label className="block text-xs font-bold text-brand-gray mb-1">时间要求</label><input className="w-full p-3 bg-white rounded-xl text-sm border-none outline-none" placeholder="如: 周末" value={form.timeInfo} onChange={e => setForm({...form, timeInfo: e.target.value})} /></div></div>
            <div className="flex justify-between gap-3 mt-6"><button onClick={() => setStep(2)} className="flex-1 py-3.5 border border-brand-light bg-white rounded-2xl font-bold text-brand-gray hover:bg-gray-50">上一步</button><button onClick={handleSubmit} disabled={submitting} className="flex-[2] py-3.5 bg-brand-forest text-white rounded-2xl font-bold shadow-lg shadow-brand-forest/30 hover:bg-brand-forest/90 transition flex items-center justify-center gap-2">{submitting ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18}/>} 确认发布</button></div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Login/Forgot Modal ---
const LoginModal = ({ onClose, onLogin }: any) => {
  const [mode, setMode] = useState<'login'|'register'|'forgot'>('login');
  const [form, setForm] = useState({ email: '', password: '', nickname: '', contactType: 'wechat', contactValue: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'forgot') {
        if(!forgotEmail) return alert('请输入邮箱');
        alert(`重置密码邮件已发送至 ${forgotEmail}`); 
        setMode('login');
        return;
    }
    try {
      const endpoint = mode === 'register' ? '/auth/register' : '/auth/login';
      const user = await api.request(endpoint, { method: 'POST', body: JSON.stringify(form) });
      localStorage.setItem('currentUser', JSON.stringify(user));
      onLogin(user); onClose();
    } catch (err: any) { alert(err.message || '失败'); }
  };

  return (
     <div className="fixed inset-0 bg-brand-dark/80 flex items-center justify-center p-6 z-[60] backdrop-blur-sm">
       <div className="bg-brand-cream p-8 rounded-[2rem] shadow-2xl w-full max-w-xs relative">
         <h2 className="text-3xl font-extrabold mb-1 text-center text-brand-forest font-rounded tracking-tight">BAYLINK</h2>
         <p className="text-center text-xs text-brand-gray mb-8 tracking-widest uppercase">Bay Area Neighborhood</p>
         
         {mode === 'forgot' ? (
             <form onSubmit={handleSubmit} className="space-y-4">
                <div className="text-center mb-4">
                    <div className="w-12 h-12 bg-brand-light rounded-full flex items-center justify-center mx-auto mb-2"><Lock size={20} className="text-brand-gray"/></div>
                    <p className="text-sm text-brand-dark font-bold">找回密码</p>
                </div>
                <input required className="w-full p-3.5 bg-white border-none rounded-2xl text-sm shadow-sm focus:ring-2 focus:ring-brand-forest/20 outline-none" value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} placeholder="请输入注册邮箱" />
                <button className="w-full py-3.5 bg-brand-dark text-white rounded-2xl font-bold mt-2 hover:opacity-90 transition shadow-lg">发送重置邮件</button>
                <button type="button" onClick={()=>setMode('login')} className="w-full mt-2 text-xs text-brand-gray hover:text-brand-forest flex items-center justify-center gap-1"><ArrowRight size={12}/> 想起密码了？去登录</button>
             </form>
         ) : (
             <form onSubmit={handleSubmit} className="space-y-3">
               <input required className="w-full p-3.5 bg-white border-none rounded-2xl text-sm shadow-sm focus:ring-2 focus:ring-brand-forest/20 outline-none" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} placeholder="邮箱账号" />
               <input required type="password" className="w-full p-3.5 bg-white border-none rounded-2xl text-sm shadow-sm focus:ring-2 focus:ring-brand-forest/20 outline-none" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} placeholder="密码" />
               {mode === 'register' && <input required className="w-full p-3.5 bg-white border-none rounded-2xl text-sm shadow-sm focus:ring-2 focus:ring-brand-forest/20 outline-none" value={form.nickname} onChange={e=>setForm({...form, nickname:e.target.value})} placeholder="社区昵称" />}
               {mode === 'register' && <input required className="w-full p-3.5 bg-white border-none rounded-2xl text-sm shadow-sm focus:ring-2 focus:ring-brand-forest/20 outline-none" value={form.contactValue} onChange={e=>setForm({...form, contactValue:e.target.value})} placeholder="微信号/电话 (用于私信)" />}
               
               {mode === 'login' && (
                   <div className="text-right">
                       <button type="button" onClick={()=>setMode('forgot')} className="text-[10px] text-brand-gray hover:text-brand-forest font-bold">忘记密码?</button>
                   </div>
               )}

               <button className="w-full py-3.5 bg-brand-dark text-white rounded-2xl font-bold mt-2 hover:opacity-90 transition shadow-lg">{mode === 'register' ? '加入社区' : '回到社区'}</button>
             </form>
         )}
         
         {mode !== 'forgot' && (
             <button onClick={()=>setMode(mode === 'login' ? 'register' : 'login')} className="w-full mt-6 text-xs text-brand-gray hover:text-brand-forest transition">
                {mode === 'login' ? '新邻居？创建账号' : '已有账号？去登录'}
             </button>
         )}
         <button onClick={onClose} className="absolute top-5 right-5 text-brand-gray/50 hover:text-brand-dark"><X size={20}/></button>
       </div>
     </div>
  );
};

// --- Chat View ---
const ChatView = ({ currentUser, conversation, onClose }: any) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const refresh = useCallback(async () => { try { const data = await api.request(`/conversations/${conversation.id}/messages`); setMessages(prev => (JSON.stringify(prev) !== JSON.stringify(data) ? data : prev)); } catch {} }, [conversation.id]);
  useEffect(() => { refresh(); const i = setInterval(refresh, 3000); return () => clearInterval(i); }, [refresh]);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);
  const send = async (type: MessageType, content: string) => {
    if (!content && type === 'text') return;
    try { await api.request(`/conversations/${conversation.id}/messages`, { method: 'POST', body: JSON.stringify({ type, content }) }); setInput(''); refresh(); } catch { alert('发送失败'); }
  };
  return (
    <div className="fixed inset-0 bg-brand-cream z-[100] flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/50 bg-brand-cream/95 backdrop-blur pt-safe-top">
        <button onClick={onClose} className="p-1 hover:bg-white rounded-full transition"><ChevronLeft size={24} className="text-brand-dark"/></button>
        <span className="font-bold text-sm text-brand-dark">{conversation.otherUser.nickname}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
        {messages.map(m => {
          const isMe = m.senderId === currentUser.id;
          return (<div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm shadow-sm ${isMe ? 'bg-brand-forest text-white rounded-br-sm' : 'bg-white text-brand-dark border border-white rounded-bl-sm'} ${m.type === 'contact-share' ? 'bg-brand-orange/10 border-brand-orange/20 text-brand-orange' : ''}`}>{m.type === 'contact-share' && <div className="text-[10px] font-bold mb-1 flex items-center gap-1"><Phone size={10}/> 联系方式</div>}{m.content}</div></div>);
        })}
      </div>
      <div className="p-3 bg-brand-cream border-t border-white/50 flex gap-2 items-center pb-safe">
        <button onClick={() => confirm('分享联系方式？') && send('contact-share', '')} className="p-2 bg-white rounded-full text-brand-forest shadow-sm"><Phone size={18}/></button>
        <input className="flex-1 bg-white rounded-full px-4 py-2.5 text-sm outline-none shadow-sm focus:ring-2 focus:ring-brand-forest/20" value={input} onChange={e => setInput(e.target.value)} placeholder="输入消息..." />
        <button onClick={() => send('text', input)} className="p-2 bg-brand-forest rounded-full text-white shadow-lg hover:scale-105 transition"><Send size={18}/></button>
      </div>
    </div>
  );
};

// --- Post Detail Modal ---
const PostDetailModal = ({ post, onClose, currentUser, onLoginNeeded, onOpenChat, onDeleted }: any) => {
  const [comments, setComments] = useState(post.comments || []);
  const [input, setInput] = useState('');
  const isAdmin = currentUser?.role === 'admin';
  const isOwner = currentUser?.id === post.authorId;
  const postComment = async () => {
    if (!currentUser) return onLoginNeeded();
    if (!input.trim()) return;
    try { const c = await api.request(`/posts/${post.id}/comments`, { method: 'POST', body: JSON.stringify({ content: input }) }); setComments([...comments, c]); setInput(''); } catch { alert('评论失败'); }
  };
  const deletePost = async () => { if (!confirm('删除此贴？')) return; try { await api.request(`/posts/${post.id}`, { method: 'DELETE' }); onDeleted(); onClose(); } catch { alert('删除失败'); } };
  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-bottom-full duration-300">
      <div className="flex items-center justify-between px-4 py-3 border-b pt-safe-top">
        <button onClick={onClose}><X size={24} className="text-brand-dark"/></button>
        {(isAdmin || isOwner) && <button onClick={deletePost} className="text-red-500 flex items-center gap-1 text-xs font-bold bg-red-50 px-3 py-1 rounded-full"><Trash2 size={14}/> 删除</button>}
      </div>
      <div className="flex-1 overflow-y-auto p-5 pb-24 bg-brand-cream/30">
        <div className="flex gap-2 mb-4"><span className="bg-brand-forest/10 text-brand-forest px-2.5 py-1 rounded-lg text-xs font-bold">{post.city}</span><span className="bg-brand-orange/10 text-brand-orange px-2.5 py-1 rounded-lg text-xs font-bold">{post.category}</span></div>
        <h1 className="text-2xl font-extrabold text-brand-dark mb-4 leading-tight">{post.title}</h1>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-white mb-6 flex justify-between items-center">
          <div><div className="text-xs text-brand-gray font-bold mb-0.5">预算/报价</div><div className="font-mono text-lg font-bold text-brand-orange">{post.budget}</div></div>
          <div className="w-px h-8 bg-gray-100"></div>
          <div className="text-right"><div className="text-xs text-brand-gray font-bold mb-0.5">时间要求</div><div className="font-bold text-brand-dark">{post.timeInfo}</div></div>
        </div>
        <p className="text-sm text-brand-dark leading-relaxed whitespace-pre-wrap mb-6">{post.description}</p>
        {post.imageUrls.map((url:string, i:number) => <img key={i} src={url} className="w-full rounded-2xl mb-3 border border-white shadow-sm" />)}
        <div className="mt-8 pt-6 border-t border-gray-200"><h3 className="font-bold text-brand-dark mb-4">评论 ({comments.length})</h3>{comments.map((c:any) => (<div key={c.id} className="flex gap-3 mb-4"><div className="w-8 h-8 bg-brand-cream rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-brand-forest border border-white shadow-sm">{c.authorName[0]}</div><div className="bg-white p-3 rounded-2xl rounded-tl-none text-sm shadow-sm border border-white flex-1"><div className="font-bold text-brand-dark text-xs mb-1">{c.authorName}</div>{c.content}</div></div>))}</div>
      </div>
      <div className="border-t p-4 flex gap-3 items-center bg-white absolute bottom-0 w-full pb-safe shadow-lg">
        <input className="flex-1 bg-brand-cream rounded-full px-5 py-3 text-sm outline-none transition focus:ring-2 focus:ring-brand-forest/20" placeholder={currentUser ? "发表评论..." : "登录后评论"} value={input} onChange={e => setInput(e.target.value)} disabled={!currentUser} />
        <button onClick={postComment} disabled={!input} className="text-brand-forest p-2 hover:bg-brand-cream rounded-full transition"><Send size={20}/></button>
        {!isOwner && <button onClick={() => { if(!currentUser) return onLoginNeeded(); onOpenChat(post.authorId, post.author.nickname); }} className="bg-brand-dark text-white px-5 py-3 rounded-full text-sm font-bold shadow-lg hover:bg-brand-forest transition active:scale-95">私信 TA</button>}
      </div>
    </div>
  );
};

// 👤 Profile View 
const ProfileView = ({ user, onLogout, onLogin, onOpenPost }: any) => {
  const [subView, setSubView] = useState<'menu' | 'my_posts' | 'support' | 'about'>('menu');

  if (!user) return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center w-full h-full">
       <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-float text-brand-gray/30"><UserIcon size={48} /></div>
       <p className="text-brand-gray text-sm mb-6">登录后体验更多社区功能</p>
       <button onClick={onLogin} className="w-full bg-brand-forest text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-brand-forest/20 active:scale-95 transition">登录 / 注册</button>
    </div>
  );

  const initial = user.nickname ? user.nickname[0] : (user.email ? user.email[0].toUpperCase() : 'U');
  const displayName = user.nickname || user.email || 'User';

  return (
    <div className="flex-1 relative w-full h-full bg-brand-cream">
      {subView === 'menu' && (
        <div className="p-5 pt-4 w-full">
           {/* User Card */}
           <div className="bg-white p-6 rounded-3xl shadow-soft border border-white mb-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-forest/5 rounded-bl-full -mr-10 -mt-10"></div>
              <div className="flex items-center gap-5 relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-brand-forest to-green-600 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-md">
                  {initial}
                </div>
                <div>
                  <h2 className="text-xl font-black text-brand-dark">{displayName}</h2>
                  <div className="flex gap-2 mt-1.5">
                    <span className="text-[10px] bg-brand-forest/10 text-brand-forest px-2 py-0.5 rounded-md font-bold">{user.role === 'admin' ? '管理员' : '认证邻居'}</span>
                    <span className="text-[10px] bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-md font-bold">信用极好</span>
                  </div>
                </div>
              </div>
           </div>

           {/* Menu List */}
           <div className="bg-white rounded-3xl shadow-card overflow-hidden mb-6">
              {[
                { label: '我的发布', icon: Edit, action: () => setSubView('my_posts') },
                { label: '联系客服', icon: Phone, action: () => setSubView('support') },
                { label: '关于我们', icon: Info, action: () => setSubView('about') },
              ].map((item, i) => (
                <button key={i} onClick={item.action} className="w-full p-4 flex items-center justify-between hover:bg-brand-cream/50 transition border-b border-brand-light last:border-none group">
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-brand-cream flex items-center justify-center text-brand-forest"><item.icon size={16}/></div>
                     <span className="text-sm font-bold text-brand-dark">{item.label}</span>
                   </div>
                   <ChevronRight size={16} className="text-brand-gray/50 group-hover:text-brand-forest transition"/>
                </button>
              ))}
           </div>

           <button onClick={onLogout} className="w-full py-3.5 bg-white text-red-500 rounded-2xl font-bold text-sm shadow-sm hover:bg-red-50 transition flex items-center justify-center gap-2 border border-red-50">
             <LogOut size={16}/> 退出登录
           </button>
        </div>
      )}

      {subView === 'my_posts' && <MyPostsView user={user} onBack={() => setSubView('menu')} onOpenPost={onOpenPost} />}
      {subView === 'support' && <InfoPage title="联系客服" storageKey="baylink_support" user={user} onBack={() => setSubView('menu')} />}
      {subView === 'about' && <InfoPage title="关于我们" storageKey="baylink_about" user={user} onBack={() => setSubView('menu')} />}
    </div>
  );
};

/**
 * ================= MAIN APP SHELL =================
 */
export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [tab, setTab] = useState('home');
  const [showLogin, setShowLogin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [feedType, setFeedType] = useState<PostType>('client');
  const [regionFilter, setRegionFilter] = useState<string>('全部');
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const [chatConv, setChatConv] = useState<Conversation | null>(null);
  const [myConvs, setMyConvs] = useState<Conversation[]>([]);

  // 自动登出处理
  useEffect(() => {
    const handleSessionExpired = () => {
      localStorage.removeItem('currentUser');
      setUser(null);
      alert('登录已过期，请重新登录');
      setTab('profile');
    };
    window.addEventListener('session-expired', handleSessionExpired);
    return () => window.removeEventListener('session-expired', handleSessionExpired);
  }, []);

  useEffect(() => {
    const u = localStorage.getItem('currentUser');
    if (u) setUser(JSON.parse(u));
    fetchPosts();
  }, [feedType]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      let data = await api.request(`/posts?type=${feedType}&keyword=${keyword}`);
      if (regionFilter !== '全部') {
         data = data.filter((p: PostData) => p.city.includes(regionFilter));
      }
      setPosts(data);
    } catch(e) { console.error(e); } 
    finally { setLoading(false); }
  }, [feedType, keyword, regionFilter]);

  const handleRefresh = () => { setLoading(true); setTimeout(() => fetchPosts(), 800); };

  const openChat = async (targetId: string, nickname?: string) => {
    try {
      const c = await api.request('/conversations/open-or-create', { method: 'POST', body: JSON.stringify({ targetUserId: targetId }) });
      setChatConv({ id: c.id, otherUser: { id: targetId, nickname: nickname || 'User' }, lastMessage: '', updatedAt: Date.now() });
    } catch { alert('错误'); }
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setUser(null);
    setTab('home');
  };

  return (
    <div className="fixed inset-0 bg-brand-cream flex justify-center font-sans text-brand-dark">
      <div className="w-full max-w-[480px] bg-brand-cream h-full shadow-2xl relative flex flex-col border-x border-white/50">
        
        {/* 1. TOP BAR */}
        <header className="px-5 pt-safe-top pb-2 flex justify-between items-center bg-brand-cream z-20 shrink-0">
           <div className="flex flex-col">
             <h1 className="font-rounded font-black text-2xl text-brand-forest tracking-tighter flex items-center gap-1">BAYLINK <div className="w-2 h-2 bg-brand-orange rounded-full mt-1"></div></h1>
             <span className="text-[10px] text-brand-gray font-bold tracking-widest">湾区邻里 · 互助平台</span>
           </div>
           <div className="flex items-center gap-3">
             <button className="p-2 bg-white rounded-full shadow-sm text-brand-dark hover:text-brand-forest transition"><Search size={20} strokeWidth={2.5} /></button>
             <div onClick={() => !user && setShowLogin(true)} className="w-10 h-10 rounded-full bg-brand-dark text-white flex items-center justify-center font-bold shadow-md cursor-pointer border-2 border-white hover:scale-105 transition">
               {user ? (user.nickname ? user.nickname[0] : <UserIcon size={16}/>) : <UserIcon size={20}/>}
             </div>
           </div>
        </header>

        {/* CONTENT AREA */}
        <main className="flex-1 overflow-y-auto bg-brand-cream hide-scrollbar relative flex flex-col">
            
            {tab === 'home' && (
              <>
                <div className="px-4 pb-3 z-10 bg-brand-cream/95 backdrop-blur-sm sticky top-0 shadow-sm shadow-brand-forest/5">
                  
                  {/* Search */}
                  <div className="relative mb-4 mt-1">
                    <Search className="absolute left-4 top-3.5 text-brand-gray/50" size={18} />
                    <input 
                      className="w-full bg-white rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium shadow-soft focus:ring-2 focus:ring-brand-forest/20 outline-none transition placeholder:text-brand-gray/40 text-brand-dark"
                      placeholder="搜索互助信息..."
                      value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchPosts()}
                    />
                  </div>

                  {/* Region Filter */}
                  <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-4 px-1">
                    <FilterTag label="全部地区" active={regionFilter === '全部'} onClick={() => { setRegionFilter('全部'); fetchPosts(); }} />
                    {REGIONS.map(r => (
                      <FilterTag key={r} label={r} active={regionFilter === r} onClick={() => { setRegionFilter(r); fetchPosts(); }} />
                    ))}
                  </div>

                  {/* Type Toggle */}
                  <div className="bg-brand-light p-1 rounded-2xl flex shadow-inner mb-4">
                    <button onClick={() => setFeedType('client')} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 ${feedType === 'client' ? 'bg-brand-orange text-white shadow-md' : 'text-brand-gray hover:bg-white/50'}`}>
                       <span>🙋‍♂️</span> 找帮忙 (求助)
                    </button>
                    <button onClick={() => setFeedType('provider')} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 ${feedType === 'provider' ? 'bg-brand-forest text-white shadow-md' : 'text-brand-gray hover:bg-white/50'}`}>
                       <span>🤝</span> 我接单 (提供)
                    </button>
                  </div>
                  
                  {/* Categories */}
                  <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 px-1">
                    {CATEGORIES.map(c => (
                      <button key={c} className="text-[11px] text-brand-dark font-bold whitespace-nowrap bg-white px-3.5 py-2 rounded-xl border border-white shadow-sm hover:border-brand-forest/20 active:scale-95 transition-all">{c}</button>
                    ))}
                  </div>
                </div>

                {/* 7. POST LIST */}
                <main className="flex-1 overflow-y-auto px-4 pb-24 hide-scrollbar">
                  <OfficialAds isAdmin={user?.role === 'admin'} />

                  <div onClick={handleRefresh} className="flex justify-center py-3 text-brand-gray/50 text-[10px] font-bold tracking-wider uppercase cursor-pointer hover:text-brand-forest transition">
                    {loading ? <Loader2 className="animate-spin" size={14}/> : 'Pull to Refresh'}
                  </div>

                  {loading ? (
                    [1,2,3].map(i => <SkeletonCard key={i}/>)
                  ) : posts.length > 0 ? (
                    posts.map(p => <PostCard key={p.id} post={p} onClick={() => setSelectedPost(p)} onContactClick={async () => { if(!user) return setShowLogin(true); await api.request(`/posts/${p.id}/contact-mark`, {method:'POST'}); fetchPosts(); openChat(p.authorId, p.author.nickname); }} />)
                  ) : (
                    <div className="text-center py-24 opacity-60">
                      <div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-soft"><Search size={32} className="text-brand-gray/50"/></div>
                      <p className="text-sm font-bold text-brand-gray">暂无相关信息</p>
                      <button onClick={()=>setShowCreate(true)} className="mt-4 text-brand-forest text-xs font-bold hover:underline">发布第一条？</button>
                    </div>
                  )}
                </main>
              </>
            )}

            {tab === 'messages' && (
                <div className="flex flex-col h-full w-full">
                   <div className="px-5 pt-2 pb-4 bg-brand-cream"><h2 className="text-2xl font-black text-brand-dark">消息列表</h2></div>
                   <MessagesList currentUser={user} onOpenChat={(c) => { setChatConv(c); }} />
                </div>
            )}
            
            {tab === 'notifications' && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-60 w-full">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-soft"><Bell size={32} className="text-brand-gray/50" /></div>
                    <h3 className="font-bold text-brand-dark mb-2">暂无新通知</h3>
                    <p className="text-brand-gray text-xs">重要的社区动态会出现在这里</p>
                </div>
            )}

            {tab === 'profile' && (
              <div className="w-full h-full">
                 <ProfileView user={user} onLogin={() => setShowLogin(true)} onLogout={handleLogout} onOpenPost={setSelectedPost} />
              </div>
            )}

        </main>

        {/* 8. BOTTOM NAV */}
        <div className="bg-white/90 backdrop-blur-md border-t border-brand-light px-6 py-2 pb-safe flex justify-between items-center z-40 relative shadow-[0_-4px_24px_rgba(0,0,0,0.04)] shrink-0">
           <button onClick={() => setTab('home')} className={`flex flex-col items-center gap-1 p-2 transition-all ${tab==='home' ? 'text-brand-forest scale-110' : 'text-brand-gray hover:text-brand-dark'}`}>
             <Home size={24} strokeWidth={tab==='home'?2.5:2} />
             <span className="text-[9px] font-bold">首页</span>
           </button>
           
           <button onClick={() => setTab('messages')} className={`flex flex-col items-center gap-1 p-2 transition-all ${tab==='messages' ? 'text-brand-forest scale-110' : 'text-brand-gray hover:text-brand-dark'}`}>
             <MessageCircle size={24} strokeWidth={tab==='messages'?2.5:2} />
             <span className="text-[9px] font-bold">消息</span>
           </button>

           {/* Floating Publish Button */}
           <div className="-mt-10 group">
             <button onClick={() => user ? setShowCreate(true) : setShowLogin(true)} className="w-16 h-16 bg-brand-dark rounded-full shadow-float flex items-center justify-center text-white group-hover:scale-110 group-active:scale-95 transition-all duration-300 border-[5px] border-brand-cream">
               <Plus size={32} strokeWidth={3} />
             </button>
           </div>

           <button onClick={() => setTab('notifications')} className={`flex flex-col items-center gap-1 p-2 transition-all ${tab==='notifications' ? 'text-brand-forest scale-110' : 'text-brand-gray hover:text-brand-dark'}`}>
             <Bell size={24} strokeWidth={tab==='notifications'?2.5:2} />
             <span className="text-[9px] font-bold">通知</span>
           </button>

           <button onClick={() => setTab('profile')} className={`flex flex-col items-center gap-1 p-2 transition-all ${tab==='profile' ? 'text-brand-forest scale-110' : 'text-brand-gray hover:text-brand-dark'}`}>
             <UserIcon size={24} strokeWidth={tab==='profile'?2.5:2} />
             <span className="text-[9px] font-bold">我的</span>
           </button>
        </div>

        {/* Modals */}
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={setUser} />}
        {showCreate && <CreatePostModal user={user} onClose={() => setShowCreate(false)} onCreated={fetchPosts} />}
        {selectedPost && <PostDetailModal post={selectedPost} currentUser={user} onClose={() => setSelectedPost(null)} onLoginNeeded={() => setShowLogin(true)} onOpenChat={openChat} onDeleted={() => {setSelectedPost(null); fetchPosts();}} />}
        {chatConv && user && <ChatView currentUser={user} conversation={chatConv} onClose={() => setChatConv(null)} />}
      </div>
    </div>
  );
}