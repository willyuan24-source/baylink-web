import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, Heart, Send, Plus, MapPin, 
  User as UserIcon, X, ShieldCheck, Trash2, Edit, 
  AlertCircle, Phone, Search, Home, Bell, 
  ChevronDown, CheckCircle, Loader2, ChevronLeft, 
  Save, RefreshCw, Clock, Filter, MoreHorizontal, Star, Menu, LogOut, ChevronRight,
  MessageSquare, Lock, Mail as MailIcon, ArrowRight, Info, Image as ImageIcon, ExternalLink, Camera,
  Linkedin, Instagram, AlertTriangle, Share2, Copy, Check, Sparkles, Zap, Shield, FileText, BadgeCheck, Smartphone
} from 'lucide-react';

// 引入库
import imageCompression from 'browser-image-compression';
import { io, Socket } from 'socket.io-client';

// BAYLINK APP V25.10 Final - Production Ready (最终上线版)

// ✨ 配置: 自动适配 Render 环境或本地环境
const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : 'https://baylink-api.onrender.com/api';
const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://baylink-api.onrender.com';

const REGIONS = ["旧金山", "中半岛", "东湾", "南湾"];
const CATEGORIES = ["租屋", "维修", "清洁", "搬家", "接送", "翻译", "兼职", "闲置", "其他"];

const CATEGORY_EMOJI: Record<string, string> = {
  "租屋": "🏠", "维修": "🔧", "清洁": "🧹", "搬家": "🚚", "接送": "🚗",
  "翻译": "📝", "兼职": "💼", "闲置": "♻️", "其他": "📌",
};

const NEARBY_HAPPENING = [
  { title: '南湾搬家服务', sub: '周末可约', tag: '搬家' },
  { title: 'SF 长租房源', sub: '近 BART', tag: '长租' },
  { title: '东湾退房清洁', sub: '可当天沟通', tag: '清洁' },
  { title: '半岛机场接送', sub: '可预约', tag: '接送' },
];

// 🏷️ 快捷标签
const SMART_TAGS: Record<string, string[]> = {
  "租屋": ["长租", "短租", "带家具", "近BART", "找室友"],
  "维修": ["水管", "电路", "屋顶", "家电", "需自带工具"],
  "清洁": ["全屋清洁", "地毯清洗", "退房扫除", "垃圾清运"],
  "搬家": ["有电梯", "需拆装", "只有纸箱", "需大车", "跨湾区"],
  "接送": ["SFO接机", "SJC接机", "早起", "带宠物", "七座车"],
  "闲置": ["九成新", "全新未拆", "可送货", "自取", "原箱在"],
  "兼职": ["现金", "周末", "远程", "需英语"],
};

// --- 类型定义 ---
type Role = 'user' | 'admin';
type PostType = 'client' | 'provider';

interface UserData {
  id: string; email: string; nickname: string; role: Role;
  contactType: 'phone'|'wechat'|'email'; contactValue: string; isBanned: boolean; token?: string;
  bio?: string; avatar?: string;
  isPhoneVerified?: boolean; isOfficialVerified?: boolean; // ✨ 信任字段
  socialLinks?: { linkedin?: string; instagram?: string; };
}

interface AdData { id: string; title: string; content: string; imageUrl?: string; isVerified: boolean; }

interface PostData {
  id: string; authorId: string; author: { nickname: string; avatar?: string; isPhoneVerified?: boolean; isOfficialVerified?: boolean; }; 
  type: PostType; title: string; city: string; category: string; timeInfo: string; budget: string;
  description: string; contactInfo: string | null; imageUrls: string[];
  likesCount: number; hasLiked: boolean; commentsCount: number; comments?: any[];
  createdAt: number; isContacted?: boolean; isReported?: boolean;
}

interface Conversation { 
  id: string; 
  otherUser: { id: string; nickname: string; avatar?: string; isPhoneVerified?: boolean; isOfficialVerified?: boolean; }; 
  lastMessage?: string; 
  updatedAt: number;
  lastPostTitle?: string; // ✨ 上下文
}

interface Message { id: string; conversationId?: string; senderId: string; type: 'text'|'contact-request'|'contact-share'; content: string; createdAt: number; }

// --- 工具函数 ---
const triggerSessionExpired = () => { window.dispatchEvent(new Event('session-expired')); };
const safeParse = (str: string | null) => { try { return str ? JSON.parse(str) : null; } catch { return null; } };

// ✨ 图片压缩
const compressImage = async (file: File): Promise<File> => {
  const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1280, useWebWorker: true };
  try { return await imageCompression(file, options); } 
  catch (error) { console.error("Compression failed:", error); return file; }
};

// --- 子组件 ---

const Avatar = ({ src, name, size = 10, className = "" }: { src?: string, name?: string, size?: number, className?: string }) => {
    const displaySize = size * 4; 
    if (src) return <img src={src} alt={name || "User"} className={`rounded-full object-cover border border-gray-100 bg-white ${className}`} style={{ width: `${displaySize}px`, height: `${displaySize}px` }} />;
    return <div className={`rounded-full bg-gradient-to-br from-[#5a8f72] to-[#3d6b55] text-white flex items-center justify-center font-semibold ${className}`} style={{ width: `${displaySize}px`, height: `${displaySize}px`, fontSize: `${displaySize * 0.4}px` }}>{name ? name[0].toUpperCase() : <UserIcon size={displaySize * 0.5} />}</div>;
};

// ✨ Toast 组件
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const styles = type === 'success'
    ? 'toast-success shadow-card'
    : type === 'error'
    ? 'toast-error shadow-card'
    : 'bg-white text-baylink-text border-baylink-border/60 shadow-card';
  const iconColor = type === 'success' ? 'text-[#2d6b4f]' : type === 'error' ? 'text-[#B4534B]' : 'text-baylink-muted';
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-3 px-5 py-3 rounded-2xl border animate-in slide-in-from-top-5 fade-in duration-300 max-w-[90vw] ${styles}`}>
      <span className={iconColor}>{type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}</span>
      <span className="text-sm font-semibold">{message}</span>
    </div>
  );
};

// ✨ 信任徽章
const TrustBadge = ({ user, size = 16, showText = false }: { user: Partial<UserData>, size?: number, showText?: boolean }) => {
    if (user?.isOfficialVerified) {
        return (
            <div className="flex items-center gap-1 text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded-full border border-yellow-200" title="官方认证">
                <BadgeCheck size={size} fill="#FBBF24" className="text-white"/>
                {showText && <span className="text-[10px] font-bold">官方严选</span>}
            </div>
        );
    }
    if (user?.isPhoneVerified) {
        return (
            <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200" title="实名认证">
                <ShieldCheck size={size} fill="#3B82F6" className="text-white"/>
                {showText && <span className="text-[10px] font-bold">已实名</span>}
            </div>
        );
    }
    return null;
};

// --- API ---
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
  reportPost: async (postId: string, reason: string) => await api.request(`/posts/${postId}/report`, { method: 'POST', body: JSON.stringify({ reason }) }),
  verifyPhone: async (phone: string, code?: string) => await api.request('/auth/verify-phone', { method: 'POST', body: JSON.stringify({ phone, code }) })
};

// --- 组件 ---

const FilterTag = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
  <button onClick={onClick} className={`chip ${active ? 'chip-active' : 'chip-inactive'}`}>{label}</button>
);

const CategoryChip = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => {
  const emoji = CATEGORY_EMOJI[label];
  const display = label === '全部' ? '全部' : emoji ? `${emoji} ${label}` : label;
  return <button onClick={onClick} className={`chip ${active ? 'chip-active' : 'chip-inactive'}`}>{display}</button>;
};

const NearbyHappening = () => (
  <section className="mb-2">
    <h3 className="text-xs font-semibold text-baylink-text-secondary mb-1.5 px-0.5">附近正在发生</h3>
    <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1 snap-x snap-mandatory">
      {NEARBY_HAPPENING.map((item) => (
        <div key={item.title} className="mini-card">
          <span className="text-[9px] text-baylink-muted bg-baylink-section/80 px-1.5 py-px rounded-md inline-block mb-1">{item.tag}</span>
          <div className="text-[13px] font-medium text-baylink-text leading-tight line-clamp-1">{item.title}</div>
          <div className="text-[10px] text-baylink-muted mt-0.5">{item.sub}</div>
        </div>
      ))}
    </div>
  </section>
);

const FeedSwitch = ({ feedType, onClient, onProvider }: { feedType: PostType, onClient: () => void, onProvider: () => void }) => (
  <div className="bg-white p-0.5 rounded-xl flex gap-0.5 shadow-sm mb-2 border border-baylink-border/40">
    <button onClick={onProvider} className={`flex-1 py-2 px-2 rounded-[10px] transition-all text-left ${feedType==='provider'?'feed-switch-active':'feed-switch-inactive'}`}>
      <div className="text-[13px] font-semibold leading-tight">找服务</div>
      <div className="text-[10px] opacity-75 mt-0.5 font-normal leading-snug">看看附近谁能帮你</div>
    </button>
    <button onClick={onClient} className={`flex-1 py-2 px-2 rounded-[10px] transition-all text-left ${feedType==='client'?'feed-switch-active':'feed-switch-inactive'}`}>
      <div className="text-[13px] font-semibold leading-tight">接单机会</div>
      <div className="text-[10px] opacity-75 mt-0.5 font-normal leading-snug">看看附近谁需要服务</div>
    </button>
  </div>
);

const EmptyFeed = ({ feedType, onPublishService, onPublishInfo }: { feedType: PostType, onPublishService: () => void, onPublishInfo: () => void }) => (
  feedType === 'provider' ? (
    <div className="py-5 px-4 text-center bg-white rounded-2xl border border-baylink-border/50 shadow-sm">
      <p className="text-sm font-medium text-baylink-text mb-0.5">还没有服务内容</p>
      <p className="text-xs text-baylink-muted mb-3">发布你的服务，让附近的人找到你</p>
      <button onClick={onPublishService} className="btn-primary px-5 py-2 text-xs inline-flex items-center gap-1.5"><Plus size={14}/> 发布服务</button>
    </div>
  ) : (
    <div className="py-5 px-4 text-center bg-white rounded-2xl border border-baylink-border/50 shadow-sm">
      <p className="text-sm font-medium text-baylink-text mb-0.5">还没有新的需求</p>
      <p className="text-xs text-baylink-muted mb-3">附近需求会显示在这里，也可以先发布你的服务</p>
      <button onClick={onPublishInfo} className="btn-primary px-5 py-2 text-xs inline-flex items-center gap-1.5"><Plus size={14}/> 发布信息</button>
    </div>
  )
);

const ImageViewer = ({ src, onClose }: { src: string, onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
    <button onClick={onClose} className="absolute top-6 right-6 p-3 bg-white/10 text-white rounded-full hover:bg-white/30 transition"><X size={24}/></button>
    <img src={src} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl scale-in-95 animate-in duration-300" onClick={e => e.stopPropagation()} />
  </div>
);

const ShareModal = ({ post, onClose, showToast }: any) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = window.location.href;
  const authorName = post.author?.nickname || '匿名用户';
  const authorAvatar = post.author?.avatar;
  const descriptionPreview = (post.description || '').slice(0, 50);

  const handleCopy = () => {
    navigator.clipboard.writeText(`【${post.title}】\n${descriptionPreview}${descriptionPreview ? '...' : ''}\n点击查看: ${shareUrl}`);
    setCopied(true);
    showToast('链接已复制到剪贴板', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl transform transition-all scale-100">
        <div className="bg-gradient-to-br from-green-700 to-teal-600 p-8 text-white text-center relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-2xl font-black mb-1 tracking-tight">BAYLINK</h3>
            <p className="text-[10px] opacity-80 uppercase tracking-[0.2em] font-medium mt-1">湾区华人互助平台</p>
          </div>
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-yellow-400/20 rounded-full blur-3xl"></div>
        </div>
        <div className="p-6">
          <div className="flex gap-3 items-center mb-5">
            <Avatar src={authorAvatar} name={authorName} size={12} />
            <div>
              <div className="font-bold text-gray-900 text-lg">{authorName}</div>
              <div className="text-xs text-gray-400 font-medium">{new Date(post.createdAt).toLocaleDateString()} · {post.city}</div>
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3 leading-snug">{post.title}</h2>
          <div className="bg-gray-50 p-4 rounded-2xl text-sm text-gray-600 mb-6 line-clamp-3 leading-relaxed border border-gray-100 italic">“{post.description}”</div>
          <div className="flex gap-3">
            <button onClick={handleCopy} className={`flex-1 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-200'}`}>
              {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? '已复制' : '复制链接'}
            </button>
            <button onClick={onClose} className="p-3.5 bg-gray-100 rounded-xl hover:bg-gray-200 transition active:scale-95"><X size={20} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoPage = ({ title, storageKey, user, onBack, showToast }: any) => {
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

const MyPostsView = ({ user, onBack, onOpenPost }: any) => {
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
      <div className="flex-1 overflow-y-auto p-4 pb-24 bg-[#FAFAFA]">{loading ? <div className="text-center py-10 text-gray-400 text-xs">加载中...</div> : myPosts.length > 0 ? myPosts.map(p => <PostCard key={p.id} post={p} onClick={() => onOpenPost(p)} onContactClick={() => {}} onAvatarClick={() => {}} onImageClick={() => {}} />) : <div className="text-center py-20 opacity-60"><div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-soft"><Edit size={32} className="text-gray-400" /></div><p className="text-sm font-bold text-gray-500">你还没有发布过内容</p></div>}</div>
    </div>
  );
};

const PostCard = ({ post, onClick, onContactClick, onAvatarClick, onImageClick, onShare }: any) => {
  const isProvider = post.type === 'provider';
  const hasImage = post.imageUrls && post.imageUrls.length > 0;
  return (
    <article onClick={onClick} className="bg-white rounded-2xl shadow-sm mb-3 overflow-hidden group cursor-pointer border border-baylink-border/30 transition-all duration-200 hover:shadow-card-hover">
      <div className="flex items-center gap-2 px-3.5 pt-3 pb-1.5">
        <div onClick={(e) => { e.stopPropagation(); onAvatarClick && onAvatarClick(post.authorId); }} className="cursor-pointer shrink-0">
            <Avatar src={post.author.avatar} name={post.author.nickname} size={7} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-baylink-text flex items-center gap-1 truncate">
            <span className="font-medium">{post.author.nickname}</span>
            <TrustBadge user={post.author} size={10}/>
          </div>
          <div className="text-[10px] text-baylink-muted/90">{post.city} · {new Date(post.createdAt).toLocaleDateString()}</div>
        </div>
        <span className={`shrink-0 text-[9px] px-1.5 py-px rounded-md ${isProvider ? 'bg-baylink-section text-baylink-muted' : 'bg-baylink-chip-active/80 text-[#4a6b5a]'}`}>
          {isProvider ? '服务' : '需求'}
        </span>
      </div>
      <div className="px-3.5 pb-2">
         <h3 className="font-semibold text-[15px] text-baylink-text leading-snug line-clamp-2 mb-1">{post.title}</h3>
         {hasImage ? (
           <div className="rounded-xl overflow-hidden bg-baylink-section/50 mb-2">
             <img src={post.imageUrls[0]} alt={post.title} className="w-full aspect-[16/10] object-cover" onClick={(e) => {e.stopPropagation(); onImageClick && onImageClick(post.imageUrls[0])}}/>
           </div>
         ) : null}
         <p className="text-[13px] text-baylink-text-secondary line-clamp-2 leading-relaxed">{post.description}</p>
      </div>
      <div className="px-3.5 pb-3 flex items-center justify-between gap-2">
         <div className="flex items-center gap-2 min-w-0">
           <span className="text-[10px] text-baylink-muted bg-baylink-section/60 px-1.5 py-px rounded">#{post.category}</span>
           {post.budget && <span className="text-xs font-medium text-baylink-text truncate">{post.budget}</span>}
         </div>
         <div className="flex items-center gap-1 shrink-0">
            <button onClick={(e) => e.stopPropagation()} className="p-1.5 text-baylink-muted/70 hover:text-baylink-muted transition" title="喜欢">
              <Heart size={14} className="opacity-60"/> {(post.likesCount > 0) && <span className="sr-only">{post.likesCount}</span>}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onShare && onShare(post); }} className="p-1.5 text-baylink-muted hover:text-baylink-text-secondary transition" title="分享">
              <Share2 size={14}/>
            </button>
            <button onClick={(e) => {e.stopPropagation(); onContactClick(post);}} className="text-[11px] font-semibold bg-baylink-green text-white px-3 py-1.5 rounded-lg hover:bg-baylink-green-hover active:scale-[0.98] transition flex items-center gap-1">
              <MessageCircle size={13} /> 私信
            </button>
         </div>
      </div>
    </article>
  );
};

const MessagesList = ({ currentUser, onOpenChat }: { currentUser: UserData | null, onOpenChat: (conv: Conversation) => void }) => {
  const [convs, setConvs] = useState<Conversation[]>([]);
  useEffect(() => { if (!currentUser) return; const load = async () => { try { const res = await api.request('/conversations'); if (Array.isArray(res)) setConvs(res); } catch {} }; load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, [currentUser]);
  if (!currentUser) return <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-60 w-full min-h-[300px]"><div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-soft"><MessageCircle size={32} className="text-gray-400" /></div><h3 className="font-bold text-gray-900 mb-2">请先登录</h3></div>;
  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 w-full">{convs.length > 0 ? <div className="space-y-3">{convs.map(c => <div key={c.id} onClick={() => onOpenChat(c)} className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition cursor-pointer border border-transparent hover:border-green-100"><Avatar src={c.otherUser.avatar} name={c.otherUser.nickname} size={12} /><div className="flex-1 min-w-0"><div className="flex justify-between mb-1"><span className="font-bold text-gray-900 flex items-center gap-1">{c.otherUser.nickname} <TrustBadge user={c.otherUser} size={12}/></span><span className="text-[10px] text-gray-500">{new Date(c.updatedAt).toLocaleDateString()}</span></div><p className="text-xs text-gray-500 truncate">{c.lastMessage || '点击开始聊天'}</p></div><ChevronRight size={16} className="text-gray-300" /></div>)}</div> : <div className="text-center py-20 opacity-60"><div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-soft"><MessageCircle size={32} className="text-gray-400"/></div><p className="text-sm font-bold text-gray-500">暂无消息</p></div>}</div>
  );
};

const PublicProfileModal = ({ userId, onClose, onChat, currentUser, showToast }: any) => {
    const [profile, setProfile] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => { const load = async () => { try { setProfile(await api.getUserProfile(userId)); } catch (e) { showToast('无法获取用户信息', 'error'); onClose(); } finally { setLoading(false); } }; load(); }, [userId]);
    if (loading || !profile) return <div className="fixed inset-0 z-[100] bg-white/90 flex items-center justify-center"><Loader2 className="animate-spin text-green-700"/></div>;
    return (
        <div className="fixed inset-0 z-[90] bg-[#FFF8F0] flex flex-col animate-in slide-in-from-bottom duration-200">
             <div className="px-4 py-3 border-b border-white/50 flex items-center justify-between bg-[#FFF8F0]/80 backdrop-blur-md pt-safe-top">
                <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-gray-100 transition active:scale-90"><X size={20}/></button>
                <span className="font-bold text-lg text-gray-900">用户主页</span><div className="w-9"></div>
             </div>
             <div className="flex-1 p-6 overflow-y-auto flex flex-col items-center">
                 <div className="relative mb-4">
                    <Avatar src={profile.avatar} name={profile.nickname} size={24} className="shadow-xl border-4 border-white"/>
                    <div className="absolute -bottom-2 -right-2"><TrustBadge user={profile} size={24} /></div>
                 </div>
                 <h2 className="text-2xl font-black text-gray-900 mb-1 flex items-center gap-2">{profile.nickname}</h2>
                 <div className="flex gap-2 mb-6">
                     <span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${profile.role === 'admin' ? 'bg-green-700 text-white' : 'bg-gray-200 text-gray-600'}`}>{profile.role === 'admin' ? '管理员' : '社区居民'}</span>
                     {profile.isPhoneVerified && <span className="text-xs bg-blue-100 text-blue-600 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1"><ShieldCheck size={12}/> 实名认证</span>}
                 </div>
                 {profile.socialLinks && (<div className="flex gap-4 mb-6">{profile.socialLinks.linkedin && <a href={profile.socialLinks.linkedin} target="_blank" className="p-3 bg-white rounded-full text-[#0077b5] shadow-sm hover:scale-110 transition"><Linkedin size={20}/></a>}{profile.socialLinks.instagram && <a href={profile.socialLinks.instagram} target="_blank" className="p-3 bg-white rounded-full text-[#E1306C] shadow-sm hover:scale-110 transition"><Instagram size={20}/></a>}</div>)}
                 <div className="w-full bg-white p-6 rounded-3xl shadow-sm border border-white mb-6"><h3 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">个人简介</h3><p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-sm">{profile.bio || "这个用户很懒，还没有写简介。"}</p></div>
                 {currentUser?.id !== profile.id && <button onClick={() => { onChat(profile.id, profile.nickname); onClose(); }} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition flex items-center justify-center gap-2"><MessageCircle size={20}/> 发送私信</button>}
             </div>
        </div>
    );
};

const PhoneVerificationModal = ({ user, onClose, onVerified, showToast }: any) => {
    const [step, setStep] = useState(1);
    const [phone, setPhone] = useState(user.contactValue || '');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    const sendCode = async () => {
        if (!phone || phone.length < 10) return showToast('请输入有效的手机号', 'error');
        setLoading(true);
        try {
            await api.verifyPhone(phone);
            showToast('验证码已发送', 'success');
            setStep(2);
        } catch(e: any) { showToast(e.message || '发送失败', 'error'); } 
        finally { setLoading(false); }
    };

    const verifyCode = async () => {
        if (!code) return showToast('请输入验证码', 'error');
        setLoading(true);
        try {
            const res = await api.verifyPhone(phone, code);
            localStorage.setItem('currentUser', JSON.stringify(res.user));
            onVerified(res.user);
            showToast('认证成功！', 'success');
            onClose();
        } catch(e: any) { showToast(e.message || '验证码错误', 'error'); }
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-900"><X size={20}/></button>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4 mx-auto"><ShieldCheck size={24}/></div>
                <h3 className="text-xl font-black text-center mb-2">实名认证</h3>
                {step === 1 ? (
                    <div className="space-y-4">
                        <input className="w-full p-4 bg-gray-50 rounded-xl font-bold text-center outline-none border border-transparent focus:border-blue-500 focus:bg-white transition" placeholder="输入手机号 (如 +1...)" value={phone} onChange={e => setPhone(e.target.value)} />
                        <button onClick={sendCode} disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 active:scale-95 transition">{loading ? '发送中...' : '发送验证码'}</button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <input className="w-full p-4 bg-gray-50 rounded-xl font-bold text-center outline-none border border-transparent focus:border-blue-500 focus:bg-white transition tracking-widest text-lg" placeholder="验证码" value={code} onChange={e => setCode(e.target.value)} />
                        <button onClick={verifyCode} disabled={loading} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 active:scale-95 transition">{loading ? '验证中...' : '确认验证'}</button>
                    </div>
                )}
            </div>
        </div>
    );
};

const EditProfileModal = ({ user, onClose, onUpdate, showToast }: any) => {
    const [form, setForm] = useState({ nickname: user.nickname || '', bio: user.bio || '', avatar: user.avatar || '', socialLinks: { linkedin: user.socialLinks?.linkedin || '', instagram: user.socialLinks?.instagram || '' }});
    const [saving, setSaving] = useState(false);
    const [showVerify, setShowVerify] = useState(false);
    
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { 
        const file = e.target.files?.[0]; 
        if (file) { 
            try {
                const compressedFile = await compressImage(file);
                const reader = new FileReader(); 
                reader.onloadend = () => setForm(p => ({ ...p, avatar: reader.result as string })); 
                reader.readAsDataURL(compressedFile); 
            } catch (err) { showToast('图片处理失败', 'error'); }
        } 
    };

    const handleSave = async () => { if (!form.nickname) return; setSaving(true); try { const updated = await api.updateProfile(form); const newUserData = { ...user, ...updated }; localStorage.setItem('currentUser', JSON.stringify(newUserData)); onUpdate(newUserData); onClose(); showToast('资料已更新', 'success'); } catch (e) { showToast('保存失败', 'error'); } finally { setSaving(false); } };
    
    return (
        <div className="fixed inset-0 z-[90] bg-[#FFF8F0] flex flex-col animate-in slide-in-from-bottom duration-200">
             <div className="px-4 py-3 border-b border-white/50 flex items-center justify-between bg-[#FFF8F0]/80 backdrop-blur-md pt-safe-top">
                <button onClick={onClose} className="text-gray-500 hover:text-gray-900 font-bold text-sm">取消</button><span className="font-bold text-lg text-gray-900">编辑资料</span><button onClick={handleSave} disabled={saving} className="text-green-700 font-bold text-sm disabled:opacity-50">{saving ? '保存中...' : '完成'}</button>
             </div>
             <div className="flex-1 p-6 overflow-y-auto">
                 <div className="flex flex-col items-center mb-8"><div className="relative group"><Avatar src={form.avatar} name={form.nickname} size={24} /><label className="absolute bottom-0 right-0 bg-gray-900 text-white p-3 rounded-full cursor-pointer shadow-xl hover:scale-110 transition border-2 border-white"><Camera size={18}/><input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} /></label></div></div>
                 
                 <div className="bg-white p-4 rounded-2xl shadow-sm mb-6 flex items-center justify-between border border-blue-50">
                     <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-full ${user.isPhoneVerified ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}><Smartphone size={20}/></div>
                         <div><div className="font-bold text-sm text-gray-900">实名认证</div><div className="text-[10px] text-gray-400">{user.isPhoneVerified ? '已验证手机号' : '未验证手机号'}</div></div>
                     </div>
                     {!user.isPhoneVerified ? (
                         <button onClick={() => setShowVerify(true)} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold shadow-md hover:bg-blue-700 transition">去认证</button>
                     ) : (
                         <div className="text-blue-600 text-xs font-bold flex items-center gap-1"><Check size={14}/> 已认证</div>
                     )}
                 </div>

                 <div className="space-y-5">
                     <div><label className="block text-xs font-bold text-gray-500 mb-2 ml-1">昵称</label><input className="w-full p-4 bg-white rounded-2xl border-none outline-none text-sm font-bold text-gray-900 shadow-sm focus:ring-2 focus:ring-green-500/20 transition" value={form.nickname} onChange={e => setForm({...form, nickname: e.target.value})} /></div>
                     <div><label className="block text-xs font-bold text-gray-500 mb-2 ml-1">个人简介</label><textarea className="w-full p-4 bg-white rounded-2xl border-none outline-none text-sm h-32 resize-none font-medium text-gray-700 shadow-sm focus:ring-2 focus:ring-green-500/20 transition" value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} placeholder="介绍一下你自己..." /></div>
                 </div>
             </div>
             {showVerify && <PhoneVerificationModal user={user} onClose={() => setShowVerify(false)} onVerified={onUpdate} showToast={showToast} />}
        </div>
    );
};

const OfficialAds = ({ isAdmin, showToast }: { isAdmin: boolean, showToast: any }) => {
  const [ads, setAds] = useState<AdData[]>([]);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Partial<AdData> | null>(null);
  const fetchAds = async () => { try { setAds(await api.request('/ads')); } catch {} };
  useEffect(() => { fetchAds(); }, []);
  const handleSaveAd = async () => { if (!editingAd?.title) return; try { await api.request('/ads', { method: 'POST', body: JSON.stringify(editingAd) }); setEditingAd(null); setIsManagerOpen(false); fetchAds(); showToast('推荐已发布', 'success'); } catch {} };
  const handleDeleteAd = async (id: string) => { if(!confirm('确定删除?')) return; try { await api.request(`/ads/${id}`, { method: 'DELETE' }); fetchAds(); showToast('已删除', 'success'); } catch {} };
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-3 px-1"><h3 className="font-bold text-baylink-text text-sm flex items-center gap-1"><BadgeCheck size={14} className="text-baylink-green"/> 官方推荐</h3>{isAdmin && <button onClick={() => { setEditingAd({}); setIsManagerOpen(true); }} className="text-[10px] bg-baylink-green text-white px-2 py-1 rounded-lg font-semibold hover:bg-baylink-green-hover transition flex items-center gap-1"><Plus size={10}/> 添加</button>}</div>
      <div className="flex overflow-x-auto gap-3 pb-2 hide-scrollbar snap-x px-1">{ads.length > 0 ? ads.map(ad => (<div key={ad.id} className="snap-center min-w-[240px] bg-white rounded-2xl shadow-card p-3 flex gap-3 border border-baylink-border/60 shrink-0 relative overflow-hidden group cursor-pointer hover:border-baylink-green/30 transition" onClick={() => { setEditingAd(isAdmin ? ad : {...ad, readonly: true} as any); setIsManagerOpen(true); }}><div className="absolute right-0 top-0 w-16 h-16 bg-baylink-green-light rounded-bl-full -mr-5 -mt-5"></div>{ad.imageUrl && <img src={ad.imageUrl} className="w-14 h-14 rounded-xl object-cover bg-baylink-section z-10 shrink-0" />}<div className="flex flex-col justify-center z-10 flex-1 min-w-0"><div className="flex items-center gap-1 mb-1"><span className="text-[9px] bg-baylink-green-light text-baylink-green px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-0.5"><Shield size={8}/> 官方</span></div><div className="font-semibold text-baylink-text text-sm line-clamp-1 mb-0.5">{ad.title}</div><div className="text-[10px] text-baylink-muted line-clamp-1">{ad.content}</div></div>{isAdmin && <button onClick={(e) => {e.stopPropagation(); handleDeleteAd(ad.id);}} className="absolute top-2 right-2 p-1 bg-white rounded-full text-red-500 shadow-sm z-20"><Trash2 size={12}/></button>}</div>)) : <div className="p-5 bg-white rounded-2xl border border-dashed border-baylink-border text-center w-full"><BadgeCheck size={20} className="text-baylink-muted mx-auto mb-2 opacity-50"/><p className="text-xs font-semibold text-baylink-text-secondary">暂无推荐内容</p><p className="text-[10px] text-baylink-muted mt-1">优质服务将显示在这里</p></div>}</div>
      {isManagerOpen && <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl"><h3 className="text-lg font-bold mb-4">{editingAd && (editingAd as any).readonly ? '推荐详情' : '管理官方推荐'}</h3>{editingAd && (editingAd as any).readonly ? <div className="space-y-3">{editingAd.imageUrl && <img src={editingAd.imageUrl} className="w-full h-40 object-cover rounded-xl" />}<h4 className="font-bold text-lg">{editingAd.title}</h4><p className="text-sm text-gray-600 leading-relaxed">{editingAd.content}</p><button onClick={() => setIsManagerOpen(false)} className="w-full py-3 bg-gray-100 text-gray-800 rounded-xl font-bold mt-4">关闭</button></div> : <div className="space-y-3"><input className="w-full p-3 bg-gray-50 border rounded-xl text-sm" placeholder="标题" value={editingAd?.title || ''} onChange={e => setEditingAd(p => ({...p, title: e.target.value}))} /><textarea className="w-full p-3 bg-gray-50 border rounded-xl text-sm h-24 resize-none" placeholder="内容描述" value={editingAd?.content || ''} onChange={e => setEditingAd(p => ({...p, content: e.target.value}))} /><input className="w-full p-3 bg-gray-50 border rounded-xl text-sm" placeholder="图片 URL (可选)" value={editingAd?.imageUrl || ''} onChange={e => setEditingAd(p => ({...p, imageUrl: e.target.value}))} /><div className="flex gap-2 mt-4"><button onClick={() => setIsManagerOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm">取消</button><button onClick={handleSaveAd} className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm">保存发布</button></div></div>}</div></div>}
    </div>
  );
};

// --- CreatePostModal (已完全修复格式 & 快捷标签版) ---
const CreatePostModal = ({ onClose, onCreated, user, showToast, defaultType = 'client' }: any) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ title: '', city: REGIONS[0], category: CATEGORIES[0], budget: '', description: '', timeInfo: '', type: (defaultType || 'client') as PostType, contactInfo: user?.contactValue || '' });
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false); 

  const isClient = form.type === 'client';
  const titlePlaceholder = isClient
    ? '例如：周六需要搬家帮手 / San Mateo 退房清洁'
    : '例如：湾区退房清洁可接单 / 提供机场接送服务';
  const descPlaceholder = isClient
    ? '说清楚地点、时间、预算、需要做什么，越具体越容易找到合适的人。'
    : '介绍你的服务范围、可服务地区、价格方式、可预约时间和经验。';
  const budgetPlaceholder = isClient
    ? '预算 / 可支付金额（如: $50/小时）'
    : '价格 / 收费方式（如: $80起 / 按小时）';

  const typeCardClass = (selected: boolean) =>
    selected
      ? 'border-baylink-green bg-baylink-green-light text-[#2d6b4f] shadow-sm'
      : 'border-baylink-border bg-white text-baylink-text-secondary hover:border-baylink-green/35';
  const categoryClass = (active: boolean) =>
    active ? 'chip chip-active' : 'chip chip-inactive';

  const addTagToDesc = (tag: string) => {
      setForm(prev => ({ ...prev, description: prev.description ? `${prev.description} #${tag} ` : `#${tag} ` }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { 
    const files = e.target.files; 
    if (files) { 
      if (images.length + files.length > 3) return showToast('最多只能上传3张图片', 'error'); 
      const fileArray = Array.from(files);
      const compressedImages: string[] = [];
      await Promise.all(fileArray.map(async (file) => {
          try {
              const compressedFile = await compressImage(file);
              const reader = new FileReader();
              const result = await new Promise<string>((resolve) => {
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(compressedFile);
              });
              compressedImages.push(result);
          } catch(e) { console.error(e); }
      }));
      setImages(prev => [...prev, ...compressedImages].slice(0,3));
    } 
  };
  
  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim()) return showToast('请先填写标题和描述', 'error');
    if (!form.budget.trim()) return showToast(isClient ? '请填写预算或价格' : '请填写价格或收费方式', 'error');
    if (!form.city) return showToast('请选择地区', 'error');
    setSubmitting(true);
    try { 
      await api.request('/posts', { method: 'POST', body: JSON.stringify({ ...form, imageUrls: images }) }); 
      onCreated(); 
      setIsSuccess(true); 
    } catch (err: any) { 
      const m = err?.message || '';
      const toastMsg = m === 'TODAY_LIMIT_REACHED' ? '今日发布已达上限'
        : /image|upload|图片/i.test(m) ? '图片上传失败，请换一张图'
        : m && m !== '失败' ? m : '发布失败，请稍后重试';
      showToast(toastMsg, 'error'); 
      setSubmitting(false); 
    } 
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center z-[70] animate-in zoom-in-95">
        <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 text-center shadow-2xl m-4 relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-teal-500"></div>
           <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 animate-bounce">
              <CheckCircle size={40} />
           </div>
           <h2 className="text-2xl font-bold text-baylink-text mb-2">发布成功！</h2>
           <p className="text-baylink-muted mb-8 text-sm">你的信息已推送给湾区邻居们。</p>
           <button onClick={onClose} className="w-full py-3.5 btn-primary">知道了</button>
        </div>
      </div>
    );
  }

  const goToStep3 = () => {
    if (!form.title.trim()) return showToast('请先填写标题', 'error');
    if (!form.description.trim()) return showToast('请先填写描述', 'error');
    setStep(3);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[70]">
      <div className="bg-baylink-bg w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto shadow-2xl border border-baylink-border/40">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-lg font-bold text-baylink-text">发布信息</h3>
            <span className="text-[11px] text-baylink-muted">Step {step}/3</span>
          </div>
          <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-baylink-section border border-baylink-border/50"><X size={18} className="text-baylink-muted"/></button>
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-baylink-text mb-0.5">你想发布什么？</label>
              <p className="text-[11px] text-baylink-muted mb-3">选择后，我们会帮你匹配更合适的展示方式</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setForm({...form, type: 'client'})}
                  className={`flex-1 p-3.5 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${typeCardClass(form.type==='client')}`}
                >
                  {form.type === 'client' && <span className="text-[9px] font-semibold bg-baylink-green/15 text-baylink-green px-1.5 py-px rounded mb-1.5 inline-block">当前选择</span>}
                  <div className="text-sm font-bold leading-tight">发布需求</div>
                  <div className="text-[11px] mt-1 opacity-90 leading-snug">我想找人帮忙 / 找服务 / 找房源</div>
                  <div className="hidden sm:block text-[10px] mt-1 opacity-70">搬家、清洁、维修、接送、租房</div>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({...form, type: 'provider'})}
                  className={`flex-1 p-3.5 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${typeCardClass(form.type==='provider')}`}
                >
                  {form.type === 'provider' && <span className="text-[9px] font-semibold bg-baylink-green/15 text-baylink-green px-1.5 py-px rounded mb-1.5 inline-block">当前选择</span>}
                  <div className="text-sm font-bold leading-tight">发布服务</div>
                  <div className="text-[11px] mt-1 opacity-90 leading-snug">我可以接单 / 提供服务</div>
                  <div className="hidden sm:block text-[10px] mt-1 opacity-70">清洁、搬家、维修、接送、翻译</div>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-baylink-text mb-2">选择分类</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button key={c} type="button" onClick={() => setForm({...form, category: c})} className={categoryClass(form.category===c)}>{c}</button>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => setStep(2)} className="w-full py-3.5 btn-primary mt-2">下一步</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <input
              className="w-full p-4 bg-white rounded-xl font-semibold text-base outline-none border border-baylink-border/60 placeholder:text-baylink-muted focus:border-baylink-green/40 focus:ring-1 focus:ring-baylink-green/10"
              placeholder={titlePlaceholder}
              value={form.title}
              onChange={e => setForm({...form, title: e.target.value})}
            />
            
            {SMART_TAGS[form.category] && (
                <div className="flex flex-wrap gap-1.5">
                    {SMART_TAGS[form.category].map(tag => (
                        <button key={tag} type="button" onClick={() => addTagToDesc(tag)} className="text-[10px] bg-white text-baylink-text-secondary px-2 py-1 rounded-md border border-baylink-border hover:border-baylink-green/40 hover:bg-baylink-green-light/50 active:scale-95 transition">#{tag}</button>
                    ))}
                </div>
            )}

            <textarea
              className="w-full p-4 bg-white rounded-xl h-36 resize-none outline-none border border-baylink-border/60 placeholder:text-baylink-muted text-sm leading-relaxed focus:border-baylink-green/40 focus:ring-1 focus:ring-baylink-green/10"
              placeholder={descPlaceholder}
              value={form.description}
              onChange={e => setForm({...form, description: e.target.value})}
            />
            
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {images.map((img,i)=> (
                <div key={i} className="relative shrink-0">
                  <img src={img} className="w-[72px] h-[72px] rounded-xl object-cover border border-baylink-border/50"/>
                </div>
              ))}
              <label className="w-[72px] h-[72px] shrink-0 flex flex-col items-center justify-center border-2 border-dashed border-baylink-border rounded-xl cursor-pointer hover:border-baylink-green/50 hover:text-baylink-green text-baylink-muted transition bg-white">
                <Plus size={18}/><span className="text-[10px] mt-0.5">添加图片</span>
                <input type="file" hidden accept="image/*" onChange={handleImageUpload}/>
              </label>
            </div>

            <div className="flex gap-2 mt-3">
              <button type="button" onClick={()=>setStep(1)} className="flex-1 py-3 bg-white text-baylink-text-secondary rounded-xl font-semibold border border-baylink-border hover:bg-baylink-section/50">上一步</button>
              <button type="button" onClick={goToStep3} className="flex-[2] py-3 btn-primary">下一步</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-baylink-text-secondary mb-2">选择地区</label>
              <div className="grid grid-cols-2 gap-2">
                {REGIONS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm({...form, city: r})}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${form.city===r ? 'chip-active' : 'chip-inactive'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white p-1 rounded-xl border border-baylink-border/60">
              <input
                className="w-full p-3 bg-transparent outline-none font-semibold text-center text-base placeholder:text-baylink-muted"
                placeholder={budgetPlaceholder}
                value={form.budget}
                onChange={e => setForm({...form, budget: e.target.value})}
              />
            </div>
            <div className="bg-white p-1 rounded-xl border border-baylink-border/60">
              <input
                className="w-full p-3 bg-transparent outline-none font-medium text-center text-sm placeholder:text-baylink-muted"
                placeholder="可服务 / 需要的时间（如: 周末、本周）"
                value={form.timeInfo}
                onChange={e => setForm({...form, timeInfo: e.target.value})}
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={()=>setStep(2)} className="flex-1 py-3 bg-white text-baylink-text-secondary rounded-xl font-semibold border border-baylink-border">上一步</button>
              <button type="button" onClick={handleSubmit} disabled={submitting} className="flex-[2] py-3 btn-primary disabled:opacity-50">
                {submitting ? '发布中...' : '确认发布'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const LoginModal = ({ onClose, onLogin, showToast }: any) => {
  const [mode, setMode] = useState<'login'|'register'|'forgot'>('login');
  const [form, setForm] = useState({ email: '', password: '', nickname: '', contactType: 'wechat', contactValue: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'forgot') {
      if (!forgotEmail) return setError('请输入邮箱');
      setLoading(true);
      setTimeout(() => {
        showToast(`重置链接已发送至 ${forgotEmail}`, 'success');
        setLoading(false);
        setMode('login');
      }, 1500);
      return;
    }

    setLoading(true);
    try {
      const user = await api.request(mode === 'register' ? '/auth/register' : '/auth/login', { method: 'POST', body: JSON.stringify(form) });
      localStorage.setItem('currentUser', JSON.stringify(user));
      onLogin(user);
      onClose();
      showToast(mode === 'register' ? '欢迎加入 BayLink!' : '欢迎回来', 'success');
    } catch (e: any) {
      let msg = e.message || '操作失败，请稍后重试';
      if (msg.includes('User not found')) msg = '该账号尚未注册，请先注册';
      else if (msg.includes('Invalid password')) msg = '账号或密码不正确';
      else if (msg.includes('User exists')) msg = '邮箱已注册，请直接登录';
      else if (mode === 'register' && (!form.email || !form.password || !form.nickname)) msg = '请填写完整信息';
      else if (msg === '失败' || msg === '操作失败，请稍后重试') {
        msg = mode === 'register' ? '注册失败，请检查填写信息' : '登录失败，请检查账号密码';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/80 flex items-center justify-center p-6 z-[60] backdrop-blur-md animate-in fade-in">
      <div className="bg-[#FFF8F0] p-8 rounded-[2.5rem] shadow-2xl w-full max-w-xs relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-teal-500"></div>
        <h2 className="text-3xl font-black mb-1 text-center text-gray-900">BAYLINK</h2>
        <p className="text-center text-[10px] text-gray-400 mb-8 tracking-[0.2em] font-medium uppercase">湾区华人互助平台</p>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-xs font-medium flex items-center gap-2 animate-pulse"><AlertCircle size={14} />{error}</div>}
        {mode === 'forgot' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input required className="w-full p-4 bg-white rounded-2xl font-bold placeholder:font-normal" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="请输入注册邮箱" />
            <button disabled={loading} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition">{loading ? '...' : '发送重置邮件'}</button>
            <button type="button" onClick={() => setMode('login')} className="w-full text-xs text-center mt-2 text-gray-500">返回登录</button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input required className="w-full p-4 bg-white rounded-2xl font-bold placeholder:font-normal" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="邮箱账号" />
            <input required type="password" className="w-full p-4 bg-white rounded-2xl font-bold placeholder:font-normal" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="密码" />
            {mode === 'register' && (
              <>
                <input required className="w-full p-4 bg-white rounded-2xl font-bold placeholder:font-normal" value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} placeholder="社区昵称" />
                <input required className="w-full p-4 bg-white rounded-2xl font-bold placeholder:font-normal" value={form.contactValue} onChange={e => setForm({ ...form, contactValue: e.target.value })} placeholder="微信号/电话" />
              </>
            )}
            {mode === 'login' && <div className="text-right"><button type="button" onClick={() => setMode('forgot')} className="text-[10px] font-bold text-gray-400 hover:text-gray-900">忘记密码?</button></div>}
            <button disabled={loading} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-lg hover:bg-gray-800 active:scale-95 transition">{loading ? 'Loading...' : (mode === 'register' ? '注册账号' : '立即登录')}</button>
          </form>
        )}
        {mode !== 'forgot' && <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="w-full mt-6 text-xs text-center text-gray-500">{mode === 'login' ? '还没有账号？去注册' : '已有账号？去登录'}</button>}
        <button onClick={onClose} className="absolute top-5 right-5 p-2 bg-white rounded-full text-gray-400 hover:text-gray-900 transition"><X size={18} /></button>
      </div>
    </div>
  );
};

const PostDetailModal = ({ post, onClose, currentUser, onLoginNeeded, onOpenChat, onDeleted, onImageClick, onShare, showToast }: any) => {
  const [comments, setComments] = useState(post.comments || []);
  const [input, setInput] = useState('');
  const [isReported, setIsReported] = useState(post.isReported);
  const isAdmin = currentUser?.role === 'admin';
  const isOwner = currentUser?.id === post.authorId;
  const authorName = post.author?.nickname || '匿名用户';
  const authorAvatar = post.author?.avatar;
  const imageUrls = Array.isArray(post.imageUrls) ? post.imageUrls : [];

  const postComment = async () => {
    if (!currentUser) return onLoginNeeded();
    if (!input.trim()) return;
    try {
      const c = await api.request(`/posts/${post.id}/comments`, { method: 'POST', body: JSON.stringify({ content: input }) });
      setComments([...comments, c]);
      setInput('');
      showToast('评论已发送', 'success');
    } catch {
      showToast('评论失败', 'error');
    }
  };

  const deletePost = async () => {
    if (!confirm('删除此贴？')) return;
    try {
      await api.request(`/posts/${post.id}`, { method: 'DELETE' });
      onDeleted();
      onClose();
      showToast('帖子已删除', 'success');
    } catch {
      showToast('删除失败', 'error');
    }
  };

  const handleReport = async () => {
    if (!currentUser) return onLoginNeeded();
    if (isReported) return;
    if (!confirm('确认举报该内容违规？')) return;
    try {
      await api.reportPost(post.id, 'user_report');
      setIsReported(true);
      showToast('感谢反馈，我们将尽快审核', 'success');
    } catch {
      showToast('举报失败', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-bottom-full duration-300 w-full h-full sm:rounded-t-[2rem] sm:top-10 sm:max-w-md sm:mx-auto sm:shadow-2xl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 pt-safe-top">
        <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition"><X size={20} /></button>
        <div className="flex gap-3">
          <button onClick={() => onShare(post)} className="p-2 bg-gray-100 rounded-full hover:bg-green-100 hover:text-green-700 transition"><Share2 size={20} /></button>
          {!isOwner && <button onClick={handleReport} className={`p-2 rounded-full transition ${isReported ? 'bg-gray-100 text-gray-300' : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500'}`} disabled={isReported}><AlertTriangle size={20} /></button>}
          {(isAdmin || isOwner) && <button onClick={deletePost} className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100"><Trash2 size={20} /></button>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 pb-32 bg-[#FAFAFA]">
        <h1 className="text-2xl font-black mb-4 leading-tight text-gray-900">{post.title}</h1>
        <div className="flex gap-3 mb-6 items-center bg-white p-3 rounded-2xl shadow-sm border border-gray-50">
          <Avatar src={authorAvatar} name={authorName} size={10} />
          <div className="flex-1">
            <div className="font-bold text-gray-900">{authorName}</div>
            <div className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleDateString()}</div>
          </div>
          <button onClick={() => { if (!currentUser) return onLoginNeeded(); onOpenChat(post.authorId, authorName, post.title); }} className="bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-gray-800 active:scale-95 transition">私信</button>
        </div>
        <p className="mb-6 whitespace-pre-wrap text-gray-700 leading-relaxed text-sm">{post.description}</p>
        <div className="space-y-3 mb-8">{imageUrls.map((u: string, i: number) => <img key={i} src={u} onClick={() => onImageClick(u)} className="w-full rounded-2xl shadow-sm cursor-zoom-in hover:opacity-95 transition" />)}</div>
        <div className="border-t border-gray-200 pt-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><MessageSquare size={18} /> 评论 ({comments.length})</h3>
          {comments.length === 0 ? <div className="text-center text-gray-400 text-xs py-4">暂无评论，快来抢沙发~</div> : comments.map((c: any) => <div key={c.id} className="bg-white p-3 mb-3 rounded-2xl border border-gray-50 text-sm"><span className="font-bold text-gray-900 mr-2">{c.authorName}:</span><span className="text-gray-600">{c.content}</span></div>)}
        </div>
      </div>
      <div className="border-t p-4 flex gap-3 items-center bg-white absolute bottom-0 w-full pb-safe">
        <input className="flex-1 bg-gray-100 rounded-full px-5 py-3 outline-none text-sm transition focus:ring-2 focus:ring-green-500/20 focus:bg-white" placeholder="写下你的评论..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && postComment()} />
        <button onClick={postComment} className={`p-3 rounded-full text-white transition active:scale-90 ${input.trim() ? 'bg-green-600 shadow-lg' : 'bg-gray-300'}`} disabled={!input.trim()}><Send size={20} /></button>
      </div>
    </div>
  );
};

const ChatView = ({ currentUser, conversation, onClose, socket }: any) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.request(`/conversations/${conversation.id}/messages`);
        setMessages(data);
      } catch {}
    };
    load();
  }, [conversation.id]);

  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = (msg: Message) => {
      if (msg.conversationId === conversation.id) {
        setMessages(prev => [...prev, msg]);
      }
    };
    socket.on('new_message', handleNewMessage);
    return () => { socket.off('new_message', handleNewMessage); };
  }, [socket, conversation.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const send = async (type: Message['type'], content: string) => {
    if (!content && type === 'text') return;
    const optimisticMsg: Message = { id: Date.now().toString(), senderId: currentUser.id, conversationId: conversation.id, type, content, createdAt: Date.now() };
    setMessages(prev => [...prev, optimisticMsg]);
    setInput('');
    try {
      await api.request(`/conversations/${conversation.id}/messages`, { method: 'POST', body: JSON.stringify({ type, content }) });
    } catch {
      alert('发送失败');
    }
  };

  return (
    <div className="fixed inset-0 bg-[#FFF8F0] z-[100] flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/50 bg-[#FFF8F0]/80 backdrop-blur-md pt-safe-top"><button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-gray-100"><ChevronLeft /></button><span className="font-bold text-lg">{conversation.otherUser.nickname}</span></div>

      <div className="bg-orange-50 px-4 py-3 border-b border-orange-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-orange-200 p-1.5 rounded-lg"><FileText size={16} className="text-orange-700" /></div>
          <div>
            <div className="text-[10px] text-orange-600 font-bold uppercase">正在沟通</div>
            <div className="text-xs font-bold text-gray-900 line-clamp-1">{conversation.lastPostTitle || '互助需求沟通'}</div>
          </div>
        </div>
        <div className="text-[10px] bg-white px-2 py-1 rounded-md text-gray-400 font-bold shadow-sm border border-gray-100">交易前请核实</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>{messages.map(m => (<div key={m.id} className={`flex ${m.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${m.senderId === currentUser.id ? 'bg-gray-900 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none'}`}>{m.content}</div></div>))}</div>
      <div className="p-3 border-t flex gap-3 pb-safe items-center bg-white"><button onClick={() => confirm('分享联系方式?') && send('contact-share', '')} className="p-2 bg-green-100 text-green-700 rounded-full hover:bg-green-200"><Phone size={20} /></button><input className="flex-1 bg-gray-100 rounded-full px-5 py-3 outline-none" placeholder="输入消息..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send('text', input)} /><button onClick={() => send('text', input)} className="p-3 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition active:scale-90"><Send size={18} /></button></div>
    </div>
  );
};

const ProfileView = ({ user, onLogout, onLogin, onOpenPost, onUpdateUser, showToast }: any) => {
  const [subView, setSubView] = useState<'menu' | 'my_posts' | 'support' | 'about' | 'edit_profile'>('menu');

  if (!user) return <div className="flex-1 flex flex-col items-center justify-center p-8"><div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6 shadow-soft-glow animate-bounce"><Zap size={40} /></div><h2 className="text-2xl font-black text-gray-900 mb-2">欢迎来到 BayLink</h2><p className="text-gray-500 text-center mb-8 text-sm">连接湾区邻里，让互助更简单。</p><button onClick={onLogin} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold shadow-xl hover:bg-gray-800 transition active:scale-95">立即登录 / 注册</button></div>;

  return (
    <div className="flex-1 relative w-full h-full bg-[#FAFAFA]">
      {subView === 'menu' && (
        <div className="p-6 pt-8 w-full h-full overflow-y-auto">
          <div className="flex justify-between items-center mb-8"><h1 className="text-3xl font-black text-gray-900">我的主页</h1><button onClick={onLogout} className="p-2 bg-white rounded-full text-red-500 shadow-sm hover:bg-red-50"><LogOut size={20} /></button></div>

          <div className="bg-white p-6 rounded-[2rem] shadow-soft-glow mb-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-100 to-transparent rounded-full -mr-10 -mt-10 transition group-hover:scale-110"></div>
            <div className="flex items-center gap-5 relative z-10">
              <Avatar src={user.avatar} name={user.nickname} size={18} className="shadow-lg border-4 border-white" />
              <div className="flex-1">
                <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">{user.nickname} <TrustBadge user={user} size={16} /></h2>
                <p className="text-xs text-gray-500 line-clamp-1 mt-1 font-medium">{user.bio || '写句签名展示自己吧~'}</p>
              </div>
              <button onClick={() => setSubView('edit_profile')} className="p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition"><Edit size={18} /></button>
            </div>
            <div className="mt-6 flex divide-x divide-gray-100">
              <div className="flex-1 text-center"><div className="text-lg font-black text-gray-900">12</div><div className="text-[10px] text-gray-400 font-bold uppercase">成功互助</div></div>
              <div className="flex-1 text-center"><div className="text-lg font-black text-gray-900">100%</div><div className="text-[10px] text-gray-400 font-bold uppercase">好评率</div></div>
              <div className="flex-1 text-center"><div className="text-lg font-black text-gray-900">365</div><div className="text-[10px] text-gray-400 font-bold uppercase">加入天数</div></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <button onClick={() => setSubView('my_posts')} className="bg-white p-5 rounded-[1.5rem] shadow-sm hover:shadow-md transition text-left group"><div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 mb-3 group-hover:scale-110 transition"><Edit size={20} /></div><div className="font-bold text-gray-900">我的发布</div><div className="text-[10px] text-gray-400">管理帖子</div></button>
            <button onClick={() => setSubView('support')} className="bg-white p-5 rounded-[1.5rem] shadow-sm hover:shadow-md transition text-left group"><div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-3 group-hover:scale-110 transition"><Phone size={20} /></div><div className="font-bold text-gray-900">联系客服</div><div className="text-[10px] text-gray-400">帮助支持</div></button>
          </div>
          <button onClick={() => setSubView('about')} className="w-full bg-white p-5 rounded-[1.5rem] shadow-sm hover:shadow-md transition flex items-center justify-between group"><div className="flex items-center gap-4"><div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 group-hover:scale-110 transition"><Info size={20} /></div><div className="font-bold text-gray-900">关于我们</div></div><ChevronRight size={18} className="text-gray-300" /></button>
        </div>
      )}
      {subView === 'edit_profile' && <EditProfileModal user={user} onClose={() => setSubView('menu')} onUpdate={onUpdateUser} showToast={showToast} />}
      {subView === 'my_posts' && <MyPostsView user={user} onBack={() => setSubView('menu')} onOpenPost={onOpenPost} />}
      {subView === 'support' && <InfoPage title="联系客服" storageKey="baylink_support" user={user} onBack={() => setSubView('menu')} showToast={showToast} />}
      {subView === 'about' && <InfoPage title="关于我们" storageKey="baylink_about" user={user} onBack={() => setSubView('menu')} showToast={showToast} />}
    </div>
  );
};

// 🌟 MAIN APP 组件
export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [tab, setTab] = useState('home');
  const [showLogin, setShowLogin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  
  const [feedType, setFeedType] = useState<PostType>('provider');
  const [createDefaultType, setCreateDefaultType] = useState<PostType>('client');
  const [posts, setPosts] = useState<PostData[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [keyword, setKeyword] = useState('');
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const [chatConv, setChatConv] = useState<Conversation | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null); 
  const [regionFilter, setRegionFilter] = useState<string>('全部');
  const [categoryFilter, setCategoryFilter] = useState<string>('全部');
  
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [sharingPost, setSharingPost] = useState<PostData | null>(null);

  // ✨ Toast & Socket State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [hasNotification, setHasNotification] = useState(false); 

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => setToast({ message, type });

  // ✨ Socket 初始化 (已优化：防抖，防止切Tab重连)
  useEffect(() => {
    if (user && !socket) {
        const newSocket = io(SOCKET_URL);
        newSocket.on('connect', () => { 
            console.log('Socket Connected');
            newSocket.emit('join_room', user.id); 
        });
        
        // 监听全局新消息（用于显示小红点）
        newSocket.on('new_message', () => {
            if (tab !== 'messages') { // 如果当前不在消息页，就显示红点
                setHasNotification(true);
                showToast('收到新私信', 'info');
            }
        });

        setSocket(newSocket);
        return () => { newSocket.disconnect(); }
    } else if (!user && socket) {
        // 用户登出，断开连接
        socket.disconnect();
        setSocket(null);
    }
  }, [user]); // 依赖仅为 user，tab 变化不触发重连

  // 切换到消息页时，清除红点
  useEffect(() => {
      if (tab === 'messages') setHasNotification(false);
  }, [tab]);

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
      let filtered = newPosts;
      if (regionFilter !== '全部') filtered = filtered.filter((p: any) => p.city.includes(regionFilter));
      if (categoryFilter !== '全部') filtered = filtered.filter((p: any) => p.category === categoryFilter);
      if (isRefresh) setPosts(filtered); else setPosts(prev => [...prev, ...filtered]);
      setHasMore(more);
    } catch (e) { console.error(e); } finally { setIsLoadingMore(false); setIsInitialLoading(false); }
  };

  const handleLoadMore = () => { const nextPage = page + 1; setPage(nextPage); fetchPosts(nextPage, false); };
  
  // ✨ 已修复：传入 postTitle 作为聊天上下文
  const openChat = async (targetId: string, nickname?: string, postTitle?: string) => { 
      try { 
          const c = await api.request('/conversations/open-or-create', { method: 'POST', body: JSON.stringify({ targetUserId: targetId }) }); 
          setChatConv({ 
              id: c.id, 
              otherUser: { id: targetId, nickname: nickname || 'User' }, 
              lastMessage: '', 
              updatedAt: Date.now(),
              lastPostTitle: postTitle // 传递上下文
          }); 
      } catch { showToast('无法打开聊天', 'error'); } 
  };
  
  const handleLogout = () => { localStorage.removeItem('currentUser'); if(socket) socket.disconnect(); setUser(null); setTab('home'); showToast('已退出登录', 'info'); };

  const openCreate = (type: PostType = 'client') => {
    setCreateDefaultType(type);
    if (user) setShowCreate(true);
    else setShowLogin(true);
  };

  // 🖥️ PC 侧边栏
  const LeftSidebar = () => (
    <div className="hidden lg:flex flex-col w-[200px] xl:w-[220px] h-screen sticky top-0 py-6 px-4 border-r border-baylink-border/60 bg-baylink-bg-alt overflow-y-auto shrink-0">
      <div className="mb-6 px-1">
        <h1 className="font-bold text-xl text-gradient tracking-tight flex items-center gap-1">BAYLINK<span className="w-1.5 h-1.5 rounded-full bg-baylink-orange mt-1"></span></h1>
        <span className="text-[10px] text-baylink-muted block mt-0.5">湾区本地生活</span>
      </div>
      <nav className="space-y-0.5 flex-1">
        <button onClick={() => setTab('home')} className={`w-full text-left py-2.5 rounded-lg font-medium text-sm transition flex items-center gap-2.5 ${tab==='home'?'nav-item-active':'nav-item-inactive'}`}><Home size={18} strokeWidth={tab==='home'?2.5:2}/> 首页</button>
        <button onClick={() => setTab('messages')} className={`w-full text-left py-2.5 rounded-lg font-medium text-sm transition flex items-center gap-2.5 ${tab==='messages'?'nav-item-active':'nav-item-inactive'}`}>
            <div className="relative"><MessageCircle size={18} strokeWidth={tab==='messages'?2.5:2}/>{hasNotification && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-baylink-orange rounded-full"></div>}</div> 消息
        </button>
        <button onClick={() => setTab('profile')} className={`w-full text-left py-2.5 rounded-lg font-medium text-sm transition flex items-center gap-2.5 ${tab==='profile'?'nav-item-active':'nav-item-inactive'}`}><UserIcon size={18} strokeWidth={tab==='profile'?2.5:2}/> 我的</button>
      </nav>
      {tab === 'home' && (
        <div className="mt-4 sidebar-panel">
           <h3 className="text-[10px] text-baylink-muted mb-2">探索分类</h3>
           <div className="flex flex-wrap gap-1">
             <button onClick={() => setCategoryFilter('全部')} className={`chip text-[10px] py-1 px-2.5 ${categoryFilter==='全部'?'chip-active':'chip-inactive'}`}>全部</button>
             {CATEGORIES.map(c => <CategoryChip key={c} label={c} active={categoryFilter===c} onClick={() => setCategoryFilter(c)} />)}
           </div>
        </div>
      )}
    </div>
  );

  // 🖥️ PC 右侧栏
  const RightSidebar = () => (
    <div className="hidden lg:block w-[280px] xl:w-[300px] h-screen sticky top-0 py-6 px-4 border-l border-baylink-border/50 bg-baylink-bg overflow-y-auto shrink-0">
       {user ? (
          <div className="sidebar-panel mb-3">
             <div className="flex items-center gap-2 mb-2.5">
                <Avatar src={user.avatar} name={user.nickname} size={9} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-baylink-text truncate">{user.nickname}</div>
                  <div className="text-[10px] text-baylink-muted">{user.role==='admin'?'管理员':'湾区邻居'}</div>
                </div>
             </div>
             <button onClick={() => openCreate('client')} className="w-full py-2 btn-primary text-xs flex items-center justify-center gap-1"><Plus size={15}/> 发布信息</button>
          </div>
       ) : (
          <div className="sidebar-panel mb-3 text-center py-4">
             <h3 className="text-sm font-medium text-baylink-text mb-1">加入 BAYLINK</h3>
             <p className="text-[11px] text-baylink-muted mb-3">连接湾区华人邻居</p>
             <button onClick={() => setShowLogin(true)} className="w-full py-2 btn-primary text-xs">立即登录</button>
          </div>
       )}
       <div className="sidebar-panel mb-2.5">
         <h3 className="text-[11px] font-medium text-baylink-text mb-2">本周大家在找</h3>
         <div className="space-y-1.5 text-[11px] text-baylink-text-secondary">
           {['退房清洁', '周末搬家', '近 BART 长租', '机场接送'].map((t) => (
             <div key={t} className="py-0.5">{t}</div>
           ))}
         </div>
       </div>
       <div className="sidebar-note mb-2.5">
         <h3 className="text-[11px] font-medium text-baylink-text mb-1 flex items-center gap-1"><MapPin size={12} className="text-baylink-muted"/> 附近活跃</h3>
         <p className="text-[10px] leading-relaxed">半岛、南湾、东湾本周都有新帖</p>
       </div>
       <div className="sidebar-note mb-3 flex gap-2">
         <Shield size={12} className="text-baylink-muted shrink-0 mt-0.5"/>
         <p className="text-[10px] leading-relaxed">建议优先联系已认证用户，线下交易注意安全。</p>
       </div>
       <div>
          <h3 className="text-[11px] text-baylink-muted mb-2">官方推荐</h3>
          <OfficialAds isAdmin={user?.role === 'admin'} showToast={showToast} />
       </div>
       <div className="mt-6 text-[10px] text-baylink-muted/80 text-center">© 2025 BayLink</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-baylink-bg flex justify-center lg:justify-start font-sans text-baylink-text relative overflow-x-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <LeftSidebar />
      <div className="w-full max-w-[500px] lg:max-w-[640px] xl:max-w-[680px] bg-baylink-bg-alt min-h-screen lg:shadow-none shadow-card relative flex flex-col lg:border-x border-baylink-border/50 mx-auto lg:mx-0 flex-1 min-w-0">
        <div className="lg:hidden">{tab === 'home' && <header className="px-4 pt-safe-top pb-2 flex justify-between items-center bg-baylink-bg/90 backdrop-blur-sm z-20 sticky top-0">
            <div>
                <h1 className="font-bold text-lg text-gradient tracking-tight flex items-center gap-1">BAYLINK<span className="w-1 h-1 rounded-full bg-baylink-orange"></span></h1>
            </div>
            <button onClick={()=>!user?setShowLogin(true):setTab('profile')} className="rounded-full ring-1 ring-baylink-border/60 active:scale-95 transition overflow-hidden"><Avatar src={user?.avatar} name={user?.nickname} size={8}/></button>
        </header>}</div>
        
        <main className="flex-1 min-h-0 overflow-y-auto bg-transparent hide-scrollbar relative flex flex-col w-full" id="scroll-container">
           {tab === 'home' && (
               <div className="px-4 pt-2 sm:px-5 pb-[5.5rem] lg:pb-8 max-w-full overflow-x-hidden">
                   <div className="relative mb-2 group">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-baylink-muted/70 group-focus-within:text-baylink-green/80 transition pointer-events-none" size={16} />
                     <input className="search-input" placeholder="搜索服务、租房、接送、二手..." value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchPosts(1, true)} />
                   </div>
                   
                   {!keyword && (
                    <div className="mb-2 max-h-[28vh] lg:max-h-none">
                        <div className="hero-welcome rounded-xl px-3.5 py-3 text-white shadow-sm relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              <span className="trust-badge-pill">Bay Area</span>
                              <span className="trust-badge-pill">128+ 互助</span>
                            </div>
                            <h2 className="text-[15px] font-semibold leading-snug mb-0.5">湾区生活，别再靠群里乱翻</h2>
                            <p className="text-white/65 text-[10px] mb-2.5 leading-relaxed">租房、搬家、维修、接送，一站发布与发现。</p>
                            <div className="flex gap-1.5">
                            <button onClick={() => openCreate('client')} className="flex-[1.35] py-1.5 bg-white text-baylink-green rounded-lg font-bold text-[11px] shadow-sm hover:bg-white/95 transition active:scale-[0.98]">
                                发布需求
                            </button>
                            <button onClick={() => { setFeedType('provider'); openCreate('provider'); }} className="flex-1 py-1.5 bg-white/10 text-white/90 border border-white/15 rounded-lg font-medium text-[11px] hover:bg-white/15 transition active:scale-[0.98]">
                                发布服务
                            </button>
                            </div>
                        </div>
                        </div>
                    </div>
                   )}

                   {!keyword && <NearbyHappening />}

                   <FeedSwitch feedType={feedType} onClient={() => setFeedType('client')} onProvider={() => setFeedType('provider')} />

                   <div className="hidden lg:flex gap-1.5 overflow-x-auto hide-scrollbar mb-2">{['全部', ...REGIONS].map(r => <FilterTag key={r} label={r === '全部' ? '全部地区' : r} active={regionFilter === r} onClick={() => setRegionFilter(r)} />)}</div>

                   <div className="lg:hidden mb-1.5">
                       <div className="flex gap-1.5 overflow-x-auto hide-scrollbar -mx-1 px-1"><FilterTag label="全部" active={regionFilter === '全部'} onClick={() => setRegionFilter('全部')} />{REGIONS.map(r => <FilterTag key={r} label={r} active={regionFilter === r} onClick={() => setRegionFilter(r)} />)}</div>
                   </div>
                   <div className="mb-2">
                       <div className="flex gap-1.5 overflow-x-auto hide-scrollbar lg:flex-wrap -mx-1 px-1 lg:mx-0 lg:px-0">
                         <CategoryChip label="全部" active={categoryFilter==='全部'} onClick={() => setCategoryFilter('全部')} />
                         {CATEGORIES.map(c => <CategoryChip key={c} label={c} active={categoryFilter===c} onClick={() => setCategoryFilter(c)} />)}
                       </div>
                   </div>
                   
                   <div className="flex items-center justify-between mb-2 px-0.5">
                     <h3 className="text-xs font-semibold text-baylink-text">社区动态</h3>
                     <span className="text-[10px] text-baylink-muted">{feedType === 'provider' ? '附近服务' : '附近需求'}</span>
                   </div>
                   
                   {isInitialLoading && posts.length === 0 ? (
                     <div className="py-16 text-center space-y-3"><Loader2 className="animate-spin w-9 h-9 text-baylink-green mx-auto"/><p className="text-sm text-baylink-muted">加载中...</p></div>
                   ) : posts.length === 0 ? (
                     <EmptyFeed
                       feedType={feedType}
                       onPublishService={() => openCreate('provider')}
                       onPublishInfo={() => openCreate('client')}
                     />
                   ) : (
                     <>
                       {posts.map(p => <PostCard key={p.id} post={p} onClick={()=>setSelectedPost(p)} onContactClick={()=>{if(!user)return setShowLogin(true); openChat(p.authorId, p.author.nickname);}} onAvatarClick={(uid: string) => setViewingUserId(uid)} onImageClick={(src:string) => setViewingImage(src)} onShare={(post: PostData) => setSharingPost(post)} />)}
                       {!isInitialLoading && hasMore && <button onClick={handleLoadMore} disabled={isLoadingMore} className="w-full py-3 mt-3 bg-white text-baylink-text text-sm font-semibold rounded-2xl border border-baylink-border shadow-card hover:border-baylink-green/30 transition disabled:opacity-50">{isLoadingMore ? <Loader2 className="animate-spin mx-auto w-5 h-5 text-baylink-green"/> : '加载更多'}</button>}
                       {!hasMore && <div className="text-center py-6 text-baylink-muted text-xs">— 已浏览全部 —</div>}
                     </>
                   )}

                   <div className="mt-6 lg:hidden"><OfficialAds isAdmin={user?.role==='admin'} showToast={showToast} /></div>
               </div>
           )}
           {tab === 'messages' && <div className="flex flex-col h-full w-full pb-24 lg:pb-0"><div className="px-5 pt-safe-top pb-4 bg-baylink-bg/95 backdrop-blur-md sticky top-0 z-10 border-b border-baylink-border/40"><h2 className="text-2xl font-bold text-baylink-text">消息</h2></div><MessagesList currentUser={user} onOpenChat={(c)=>{setChatConv(c)}}/></div>}
           {tab === 'notifications' && <div className="flex-1 flex flex-col items-center justify-center text-gray-300"><div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4"><Bell size={40}/></div><p className="font-bold">暂无通知</p></div>}
           {tab === 'profile' && <ProfileView user={user} onLogin={()=>setShowLogin(true)} onLogout={handleLogout} onOpenPost={setSelectedPost} onUpdateUser={setUser} showToast={showToast} />}
        </main>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-baylink-border/50 pb-safe max-w-[500px] mx-auto">
          <div className="flex justify-around items-center px-0.5 pt-1 pb-0.5">
           <button onClick={()=>setTab('home')} className={`flex flex-col items-center gap-0 py-1 min-w-[48px] transition active:scale-95 ${tab==='home'?'tab-bar-active':'text-baylink-muted/80'}`}>
             <Home size={20} strokeWidth={tab==='home'?2.5:1.75}/><span className={`text-[9px] mt-0.5 ${tab==='home'?'font-medium':'font-normal'}`}>首页</span>
           </button>
           <button onClick={()=>setTab('notifications')} className={`flex flex-col items-center gap-0 py-1 min-w-[48px] transition active:scale-95 ${tab==='notifications'?'tab-bar-active':'text-baylink-muted/80'}`}>
             <Search size={20} strokeWidth={tab==='notifications'?2.5:1.75}/><span className={`text-[9px] mt-0.5 ${tab==='notifications'?'font-medium':'font-normal'}`}>发现</span>
           </button>
           <button onClick={()=>openCreate('client')} className="flex flex-col items-center -mt-2 active:scale-95 transition px-1">
             <div className="w-9 h-9 bg-baylink-green rounded-lg shadow-sm flex items-center justify-center text-white ring-2 ring-baylink-bg"><Plus size={20} strokeWidth={2.5}/></div>
             <span className="text-[9px] font-medium text-baylink-green mt-px">发布</span>
           </button>
           <button onClick={()=>setTab('messages')} className={`flex flex-col items-center gap-0 py-1 min-w-[48px] transition active:scale-95 relative ${tab==='messages'?'tab-bar-active':'text-baylink-muted/80'}`}>
             <MessageCircle size={20} strokeWidth={tab==='messages'?2.5:1.75}/>
             {hasNotification && <div className="absolute top-0.5 right-2.5 w-1.5 h-1.5 bg-baylink-orange rounded-full"></div>}
             <span className={`text-[9px] mt-0.5 ${tab==='messages'?'font-medium':'font-normal'}`}>消息</span>
           </button>
           <button onClick={()=>setTab('profile')} className={`flex flex-col items-center gap-0 py-1 min-w-[48px] transition active:scale-95 ${tab==='profile'?'tab-bar-active':'text-baylink-muted/80'}`}>
             <UserIcon size={20} strokeWidth={tab==='profile'?2.5:1.75}/><span className={`text-[9px] mt-0.5 ${tab==='profile'?'font-medium':'font-normal'}`}>我的</span>
           </button>
          </div>
        </nav>

        {/* Modals */}
        {showLogin && <LoginModal onClose={()=>setShowLogin(false)} onLogin={setUser} showToast={showToast}/>}
        {showCreate && <CreatePostModal user={user} defaultType={createDefaultType} onClose={()=>setShowCreate(false)} onCreated={() => fetchPosts(1, true)} showToast={showToast}/>}
        {selectedPost && <PostDetailModal post={selectedPost} currentUser={user} onClose={()=>setSelectedPost(null)} onLoginNeeded={()=>setShowLogin(true)} onOpenChat={openChat} onDeleted={()=>{setSelectedPost(null);fetchPosts(1, true);}} onImageClick={(src:string) => setViewingImage(src)} onShare={(p: PostData) => setSharingPost(p)} showToast={showToast}/>}
        {chatConv && user && <ChatView currentUser={user} conversation={chatConv} onClose={()=>setChatConv(null)} socket={socket}/>}
        {viewingUserId && <PublicProfileModal userId={viewingUserId} onClose={() => setViewingUserId(null)} onChat={openChat} currentUser={user} showToast={showToast}/>}
        {viewingImage && <ImageViewer src={viewingImage} onClose={() => setViewingImage(null)} />}
        {sharingPost && <ShareModal post={sharingPost} onClose={() => setSharingPost(null)} showToast={showToast} />}
      </div>
      <RightSidebar />
    </div>
  );
}
