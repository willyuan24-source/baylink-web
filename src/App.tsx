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
    return <div className={`rounded-full bg-gradient-to-br from-green-600 to-teal-500 text-white flex items-center justify-center font-bold shadow-sm ${className}`} style={{ width: `${displaySize}px`, height: `${displaySize}px`, fontSize: `${displaySize * 0.4}px` }}>{name ? name[0].toUpperCase() : <UserIcon size={displaySize * 0.5} />}</div>;
};

// ✨ Toast 组件
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const bgClass = type === 'success' ? 'bg-gray-900' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-3 px-6 py-3.5 rounded-full shadow-2xl animate-in slide-in-from-top-5 fade-in duration-300 text-white ${bgClass}`}>
      {type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
      <span className="text-sm font-bold tracking-wide">{message}</span>
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
  <button onClick={onClick} className={`px-5 py-2 rounded-full text-xs font-bold transition-all duration-300 active:scale-95 whitespace-nowrap shadow-sm ${active ? 'bg-gray-900 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}`}>{label}</button>
);

const ImageViewer = ({ src, onClose }: { src: string, onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
    <button onClick={onClose} className="absolute top-6 right-6 p-3 bg-white/10 text-white rounded-full hover:bg-white/30 transition"><X size={24}/></button>
    <img src={src} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl scale-in-95 animate-in duration-300" onClick={e => e.stopPropagation()} />
  </div>
);

const PostCard = ({ post, onClick, onContactClick, onAvatarClick, onImageClick }: any) => {
  const isProvider = post.type === 'provider';
  const hasImage = post.imageUrls && post.imageUrls.length > 0;
  return (
    <div onClick={onClick} className="bg-white rounded-[1.5rem] shadow-soft-glow mb-5 overflow-hidden group cursor-pointer border border-white/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <div className="flex justify-between items-center p-4 pb-2">
        <div className="flex gap-3 items-center">
          <div onClick={(e) => { e.stopPropagation(); onAvatarClick && onAvatarClick(post.authorId); }} className="cursor-pointer hover:opacity-80 transition active:scale-95">
              <Avatar src={post.author.avatar} name={post.author.nickname} size={10} />
          </div>
          <div><div className="text-sm font-bold text-gray-900 flex items-center gap-1">{post.author.nickname} <TrustBadge user={post.author} size={12}/></div><div className="text-[10px] text-gray-400 font-medium">{post.city} · {new Date(post.createdAt).toLocaleDateString()}</div></div>
        </div>
        <button className="text-gray-300 hover:text-gray-600 transition"><MoreHorizontal size={20}/></button>
      </div>
      {hasImage ? (
        <div className="relative mt-2">
           <img src={post.imageUrls[0]} alt={post.title} className="w-full h-64 object-cover" onClick={(e) => {e.stopPropagation(); onImageClick(post.imageUrls[0])}}/>
           <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-bold shadow-lg backdrop-blur-md ${isProvider ? 'bg-green-500/90 text-white' : 'bg-orange-500/90 text-white'}`}>{isProvider ? '🤝 我接单' : '🙋‍♂️ 找帮忙'}</div>
        </div>
      ) : (
        <div className={`mx-4 mt-2 p-6 rounded-2xl ${isProvider ? 'bg-gradient-to-br from-green-50 to-teal-50' : 'bg-gradient-to-br from-orange-50 to-red-50'}`}>
           <div className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold mb-2 ${isProvider ? 'bg-green-200 text-green-800' : 'bg-orange-200 text-orange-800'}`}>{isProvider ? '提供服务' : '寻求帮助'}</div>
           <h3 className="font-black text-xl text-gray-900 mb-2 line-clamp-2">{post.title}</h3>
           <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed opacity-80">{post.description}</p>
        </div>
      )}
      <div className="p-4 pt-3">
         {hasImage && <h3 className="font-bold text-lg text-gray-900 mb-2 leading-tight">{post.title}</h3>}
         {hasImage && <p className="text-sm text-gray-500 line-clamp-2 mb-3">{post.description}</p>}
         <div className="flex items-center justify-between mb-4"><span className="bg-gray-100 px-2.5 py-1 rounded-lg text-[11px] font-bold text-gray-600">#{post.category}</span><div className="font-black text-base text-gray-900">{post.budget}</div></div>
         <div className="flex items-center justify-between pt-3 border-t border-gray-50">
            <div className="flex gap-5 text-gray-400">
               <button className="flex items-center gap-1.5 text-xs font-bold hover:text-red-500 transition group/btn"><Heart size={18} className="group-hover/btn:scale-110 transition"/> {post.likesCount}</button>
               <button className="flex items-center gap-1.5 text-xs font-bold hover:text-blue-500 transition"><MessageSquare size={18}/> {post.commentsCount}</button>
            </div>
            <button onClick={(e) => {e.stopPropagation(); onContactClick(post);}} className="text-xs bg-gray-900 text-white px-4 py-2 rounded-full font-bold shadow-md hover:bg-gray-800 active:scale-95 transition flex items-center gap-1.5"><MessageCircle size={14} /> 私信</button>
         </div>
      </div>
    </div>
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
      <div className="flex justify-between items-center mb-3 px-1"><h3 className="font-bold text-gray-900 text-sm flex items-center gap-1"><Sparkles size={14} className="text-orange-500 fill-orange-500"/> 官方推荐</h3>{isAdmin && <button onClick={() => { setEditingAd({}); setIsManagerOpen(true); }} className="text-[10px] bg-gray-800 text-white px-2 py-1 rounded-md font-bold hover:bg-green-700 transition flex items-center gap-1"><Plus size={10}/> 添加</button>}</div>
      <div className="flex overflow-x-auto gap-4 pb-4 hide-scrollbar snap-x px-1">{ads.length > 0 ? ads.map(ad => (<div key={ad.id} className="snap-center min-w-[260px] bg-white rounded-2xl shadow-sm p-3 flex gap-3 border border-gray-100 shrink-0 relative overflow-hidden group cursor-pointer hover:shadow-md transition" onClick={() => { setEditingAd(isAdmin ? ad : {...ad, readonly: true} as any); setIsManagerOpen(true); }}><div className="absolute right-0 top-0 w-20 h-20 bg-green-50 rounded-bl-full -mr-6 -mt-6 transition group-hover:scale-110"></div>{ad.imageUrl && <img src={ad.imageUrl} className="w-16 h-16 rounded-xl object-cover bg-gray-100 shadow-sm z-10" />}<div className="flex flex-col justify-center z-10 flex-1"><div className="flex items-center gap-1 mb-1"><span className="text-[9px] bg-black text-white px-1.5 py-0.5 rounded-md font-bold">精选</span></div><div className="font-bold text-gray-900 text-sm line-clamp-1 mb-0.5">{ad.title}</div><div className="text-[10px] text-gray-500 line-clamp-1">{ad.content}</div></div>{isAdmin && <button onClick={(e) => {e.stopPropagation(); handleDeleteAd(ad.id);}} className="absolute top-2 right-2 p-1 bg-white rounded-full text-red-500 shadow-sm"><Trash2 size={12}/></button>}</div>)) : <div className="p-4 bg-white rounded-xl border border-dashed border-gray-200 text-center text-xs text-gray-400 w-full">暂无推荐内容</div>}</div>
      {isManagerOpen && <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl"><h3 className="text-lg font-bold mb-4">{editingAd && (editingAd as any).readonly ? '推荐详情' : '管理官方推荐'}</h3>{editingAd && (editingAd as any).readonly ? <div className="space-y-3">{editingAd.imageUrl && <img src={editingAd.imageUrl} className="w-full h-40 object-cover rounded-xl" />}<h4 className="font-bold text-lg">{editingAd.title}</h4><p className="text-sm text-gray-600 leading-relaxed">{editingAd.content}</p><button onClick={() => setIsManagerOpen(false)} className="w-full py-3 bg-gray-100 text-gray-800 rounded-xl font-bold mt-4">关闭</button></div> : <div className="space-y-3"><input className="w-full p-3 bg-gray-50 border rounded-xl text-sm" placeholder="标题" value={editingAd?.title || ''} onChange={e => setEditingAd(p => ({...p, title: e.target.value}))} /><textarea className="w-full p-3 bg-gray-50 border rounded-xl text-sm h-24 resize-none" placeholder="内容描述" value={editingAd?.content || ''} onChange={e => setEditingAd(p => ({...p, content: e.target.value}))} /><input className="w-full p-3 bg-gray-50 border rounded-xl text-sm" placeholder="图片 URL (可选)" value={editingAd?.imageUrl || ''} onChange={e => setEditingAd(p => ({...p, imageUrl: e.target.value}))} /><div className="flex gap-2 mt-4"><button onClick={() => setIsManagerOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm">取消</button><button onClick={handleSaveAd} className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm">保存发布</button></div></div>}</div></div>}
    </div>
  );
};

// --- CreatePostModal (已完全修复格式 & 快捷标签版) ---
const CreatePostModal = ({ onClose, onCreated, user, showToast }: any) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ title: '', city: REGIONS[0], category: CATEGORIES[0], budget: '', description: '', timeInfo: '', type: 'client' as PostType, contactInfo: user?.contactValue || '' });
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false); 

  const getPlaceholder = (category: string) => {
    switch(category) {
      case '搬家': return '例如：本周六求两位壮汉从 Daly City 搬到 SF，有电梯...';
      case '接送': return '例如：SFO接机，三个行李箱，需七座车...';
      case '维修': return '例如：厨房水槽漏水，求熟悉管道的师傅...';
      case '闲置': return '例如：出一台九成新 Dyson 吸尘器，原箱在...';
      default: return '详细描述你的需求，越具体越容易找到人帮忙...';
    }
  };

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
    if (!form.title || !form.budget) return showToast('请完善标题和预算信息', 'error');
    setSubmitting(true);
    try { 
      await api.request('/posts', { method: 'POST', body: JSON.stringify({ ...form, imageUrls: images }) }); 
      onCreated(); 
      setIsSuccess(true); 
    } catch (err: any) { 
      showToast(err.message === 'TODAY_LIMIT_REACHED' ? '今日发布已达上限' : '发布失败，请稍后重试', 'error'); 
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
           <h2 className="text-2xl font-black text-gray-900 mb-2">发布成功！</h2>
           <p className="text-gray-500 mb-8 text-sm">你的需求已推送给湾区邻居们。</p>
           <button onClick={onClose} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-lg hover:bg-gray-800 transition active:scale-95">知道了</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-[70]">
      <div className="bg-[#FFF8F0] w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div><h3 className="text-xl font-extrabold text-gray-900">发布需求 <span className="text-xs font-normal bg-white px-2 py-1 rounded-full border border-gray-100 ml-2">Step {step}/3</span></h3></div>
          <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-gray-100"><X size={20}/></button>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold mb-3 text-gray-500 uppercase tracking-wider">你的目标</label>
              <div className="flex gap-4">
                <button 
                  onClick={() => setForm({...form, type: 'client'})} 
                  className={`flex-1 py-6 rounded-2xl border-2 font-bold transition-all active:scale-95 ${form.type==='client'?'border-orange-500 bg-orange-50 text-orange-600 shadow-md':'border-transparent bg-white text-gray-400'}`}
                >
                  <span className="text-2xl block mb-2">🙋‍♂️</span> 找帮忙
                </button>
                <button 
                  onClick={() => setForm({...form, type: 'provider'})} 
                  className={`flex-1 py-6 rounded-2xl border-2 font-bold transition-all active:scale-95 ${form.type==='provider'?'border-green-600 bg-green-50 text-green-700 shadow-md':'border-transparent bg-white text-gray-400'}`}
                >
                  <span className="text-2xl block mb-2">🤝</span> 我接单
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold mb-3 text-gray-500 uppercase tracking-wider">选择分类</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button 
                    key={c} 
                    onClick={() => setForm({...form, category: c})} 
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${form.category===c?'bg-gray-900 text-white border-gray-900 shadow-md':'bg-white text-gray-600 border-transparent hover:bg-gray-50'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setStep(2)} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold mt-4 shadow-lg hover:bg-gray-800 active:scale-95 transition">下一步</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <input className="w-full p-5 bg-white rounded-2xl font-bold text-lg outline-none placeholder:text-gray-300" placeholder="起个吸引人的标题..." value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            
            {SMART_TAGS[form.category] && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {SMART_TAGS[form.category].map(tag => (
                        <button key={tag} onClick={() => addTagToDesc(tag)} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-md hover:bg-gray-200 transition border border-gray-200 hover:border-gray-400 active:scale-95">#{tag}</button>
                    ))}
                </div>
            )}

            <textarea className="w-full p-5 bg-white rounded-2xl h-40 resize-none outline-none placeholder:text-gray-300" placeholder={getPlaceholder(form.category)} value={form.description} onChange={e => setForm({...form, description: e.target.value})}/>
            
            <div className="flex gap-3 overflow-x-auto pb-2">
              {images.map((img,i)=> (
                <div key={i} className="relative shrink-0">
                  <img src={img} className="w-20 h-20 rounded-xl object-cover shadow-sm"/>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border border-white"></div>
                </div>
              ))}
              <label className="w-20 h-20 shrink-0 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-green-500 hover:text-green-500 text-gray-400 transition bg-white">
                <Plus/><span className="text-[10px] mt-1">添加图片</span>
                <input type="file" hidden onChange={handleImageUpload}/>
              </label>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={()=>setStep(1)} className="flex-1 py-3 bg-white text-gray-500 rounded-2xl font-bold hover:bg-gray-50">上一步</button>
              <button onClick={()=>setStep(3)} className="flex-[2] py-3 bg-gray-900 text-white rounded-2xl font-bold shadow-lg">下一步</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {REGIONS.map(r => (
                <button 
                  key={r} 
                  onClick={() => setForm({...form, city: r})} 
                  className={`py-3 rounded-2xl text-xs font-bold border transition-all ${form.city===r?'bg-green-600 text-white border-green-600 shadow-md':'bg-white text-gray-500 border-transparent hover:bg-gray-50'}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="bg-white p-2 rounded-2xl">
              <input className="w-full p-3 bg-transparent outline-none font-bold text-center text-lg" placeholder="💰 预算 (如: $50/小时)" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})}/>
            </div>
            <div className="bg-white p-2 rounded-2xl">
              <input className="w-full p-3 bg-transparent outline-none font-bold text-center text-lg" placeholder="⏰ 时间 (如: 周末)" value={form.timeInfo} onChange={e => setForm({...form, timeInfo: e.target.value})}/>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={()=>setStep(2)} className="flex-1 py-3 bg-white text-gray-500 rounded-2xl font-bold hover:bg-gray-50">上一步</button>
              <button onClick={handleSubmit} disabled={submitting} className="flex-[2] py-3 bg-green-700 text-white rounded-2xl font-bold shadow-lg hover:bg-green-800 active:scale-95 transition">
                {submitting?'发布中...':'确认发布'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 🌟 MAIN APP 组件
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

  // 🖥️ PC 侧边栏
  const LeftSidebar = () => (
    <div className="hidden lg:flex flex-col w-64 h-screen sticky top-0 p-8 border-r border-gray-200 bg-white/80 backdrop-blur-xl overflow-y-auto">
      <div className="mb-10 pl-2">
        <h1 className="font-black text-3xl text-transparent bg-clip-text bg-gradient-to-r from-green-700 to-teal-600 tracking-tighter flex items-center gap-1">BAYLINK <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div></h1>
        <span className="text-[10px] text-gray-400 font-bold tracking-[0.2em] uppercase block mt-1">湾区华人互助平台</span>
      </div>
      <nav className="space-y-3 flex-1">
        <button onClick={() => setTab('home')} className={`w-full text-left px-5 py-4 rounded-2xl font-bold transition flex items-center gap-4 ${tab==='home'?'bg-gray-900 text-white shadow-lg shadow-gray-200':'text-gray-500 hover:bg-gray-50'}`}><Home size={22}/> 首页</button>
        <button onClick={() => setTab('messages')} className={`w-full text-left px-5 py-4 rounded-2xl font-bold transition flex items-center gap-4 ${tab==='messages'?'bg-gray-900 text-white shadow-lg shadow-gray-200':'text-gray-500 hover:bg-gray-50'}`}>
            <div className="relative"><MessageCircle size={22}/>{hasNotification && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></div>}</div> 消息
        </button>
        <button onClick={() => setTab('profile')} className={`w-full text-left px-5 py-4 rounded-2xl font-bold transition flex items-center gap-4 ${tab==='profile'?'bg-gray-900 text-white shadow-lg shadow-gray-200':'text-gray-500 hover:bg-gray-50'}`}><UserIcon size={22}/> 我的</button>
      </nav>
      {tab === 'home' && (
        <div className="mt-8 bg-gray-50 p-5 rounded-3xl border border-gray-100">
           <h3 className="text-xs font-black text-gray-400 mb-4 uppercase tracking-widest">探索分类</h3>
           <div className="flex flex-wrap gap-2">
             <button onClick={() => setCategoryFilter('全部')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${categoryFilter==='全部'?'bg-gray-900 text-white':'bg-white text-gray-600 border hover:border-gray-300'}`}>全部</button>
             {CATEGORIES.map(c => <button key={c} onClick={() => setCategoryFilter(c)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${categoryFilter===c?'bg-gray-900 text-white':'bg-white text-gray-600 border hover:border-gray-300'}`}>{c}</button>)}
           </div>
        </div>
      )}
    </div>
  );

  // 🖥️ PC 右侧栏
  const RightSidebar = () => (
    <div className="hidden lg:block w-80 h-screen sticky top-0 p-8 border-l border-gray-200 bg-white/80 backdrop-blur-xl overflow-y-auto">
       {user ? (
          <div className="bg-white p-6 rounded-[2rem] shadow-soft-glow border border-gray-100 mb-8">
             <div className="flex items-center gap-4 mb-4">
                <Avatar src={user.avatar} name={user.nickname} size={12} />
                <div><div className="font-bold text-gray-900 text-lg">{user.nickname} <TrustBadge user={user} size={14}/></div><div className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md inline-block">{user.role==='admin'?'管理员':'认证用户'}</div></div>
             </div>
             <button onClick={() => setShowCreate(true)} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold text-sm shadow-xl hover:scale-[1.02] transition flex items-center justify-center gap-2"><Plus size={18}/> 发布新需求</button>
          </div>
       ) : (
          <div className="bg-gradient-to-br from-green-700 to-teal-600 p-8 rounded-[2rem] shadow-xl shadow-green-900/20 text-white mb-8 text-center relative overflow-hidden">
             <div className="relative z-10"><h3 className="font-black text-xl mb-2">加入 BayLink</h3><p className="text-sm opacity-90 mb-6 font-medium">连接湾区华人，互助更简单</p><button onClick={() => setShowLogin(true)} className="w-full py-3 bg-white text-green-800 rounded-xl font-bold text-sm hover:bg-green-50 transition shadow-lg">立即登录</button></div>
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
          </div>
       )}
       <div>
          <h3 className="text-xs font-black text-gray-400 mb-4 uppercase tracking-widest">热门推荐</h3>
          <OfficialAds isAdmin={user?.role === 'admin'} showToast={showToast} />
       </div>
       <div className="mt-12 text-[10px] text-gray-300 text-center font-medium">© 2025 BayLink Inc. <br/> Designed for Bay Area Community</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F2F4F6] flex justify-center lg:justify-between font-sans text-gray-900 relative">
      {/* ✨ 全局 Toast 容器 */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <LeftSidebar />
      <div className="w-full max-w-[500px] bg-[#FFF8F0] min-h-screen shadow-2xl relative flex flex-col border-x border-white mx-auto">
        <div className="lg:hidden">{tab === 'home' && <header className="px-6 pt-safe-top pb-4 flex justify-between items-center bg-[#FFF8F0]/90 backdrop-blur-md z-20 sticky top-0">
            <div className="flex flex-col">
                <h1 className="font-black text-2xl text-transparent bg-clip-text bg-gradient-to-r from-green-700 to-teal-600 tracking-tighter flex items-center gap-1">BAYLINK <div className="w-2 h-2 bg-orange-500 rounded-full mt-1"></div></h1>
                <p className="text-[10px] text-gray-400 font-bold tracking-[0.2em] uppercase mt-0.5">湾区华人互助平台</p>
            </div>
            <div onClick={()=>!user&&setShowLogin(true)} className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold cursor-pointer shadow-md active:scale-95 transition"><Avatar src={user?.avatar} name={user?.nickname} size={10}/></div>
        </header>}</div>
        
        <main className="flex-1 min-h-0 overflow-y-auto bg-transparent hide-scrollbar relative flex flex-col w-full" id="scroll-container">
           {tab === 'home' && (
               <div className="p-5 pb-32">
                   <div className="relative mb-6 mt-2 group"><Search className="absolute left-5 top-4 text-gray-400 group-focus-within:text-green-600 transition" size={20} /><input className="w-full bg-white rounded-[1.5rem] pl-14 pr-6 py-4 text-sm font-bold shadow-soft-glow focus:ring-2 focus:ring-green-500/20 outline-none transition placeholder:font-normal" placeholder="搜索互助信息..." value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchPosts(1, true)} /></div>
                   
                   {/* ✨ 首页 Hero Section: 移动端适配 */}
                   {!keyword && (
                    <div className="mb-8 px-1">
                        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
                        <div className="relative z-10">
                            <h2 className="text-xl sm:text-2xl font-black mb-1">湾区生活，互助更简单</h2>
                            <p className="text-gray-400 text-xs mb-6 opacity-80 font-medium">本周已有 128 位邻居完成了互助</p>
                            <div className="flex gap-3">
                            <button onClick={() => { setFeedType('client'); setShowCreate(true); }} className="flex-1 py-3 bg-white text-gray-900 rounded-xl font-bold text-xs sm:text-sm shadow-lg hover:bg-gray-100 transition active:scale-95 whitespace-nowrap">
                                👋 我要找人
                            </button>
                            <button onClick={() => { setFeedType('provider'); setCategoryFilter('全部'); }} className="flex-1 py-3 bg-white/10 text-white border border-white/20 rounded-xl font-bold text-xs sm:text-sm hover:bg-white/20 transition active:scale-95 backdrop-blur-md whitespace-nowrap">
                                💰 我要接单
                            </button>
                            </div>
                        </div>
                        <div className="absolute top-[-20px] right-[-20px] w-32 h-32 bg-green-500/20 rounded-full blur-3xl animate-pulse"></div>
                        <div className="absolute bottom-[-20px] left-[-20px] w-32 h-32 bg-orange-500/20 rounded-full blur-3xl animate-pulse"></div>
                        </div>
                    </div>
                   )}

                   <div className="lg:hidden">
                       <div className="flex gap-3 overflow-x-auto hide-scrollbar mb-6 px-1"><FilterTag label="全部地区" active={regionFilter === '全部'} onClick={() => setRegionFilter('全部')} />{REGIONS.map(r => <FilterTag key={r} label={r} active={regionFilter === r} onClick={() => setRegionFilter(r)} />)}</div>
                       <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 px-1 mb-6"><button onClick={() => setCategoryFilter('全部')} className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${categoryFilter==='全部'?'bg-gray-900 text-white border-gray-900 shadow-md':'bg-white text-gray-600 border-transparent'}`}>全部</button>{CATEGORIES.map(c => <button key={c} onClick={() => setCategoryFilter(c)} className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${categoryFilter===c?'bg-gray-900 text-white border-gray-900 shadow-md':'bg-white text-gray-600 border-transparent'}`}>{c}</button>)}</div>
                   </div>

                   <div className="bg-white p-1.5 rounded-[1.5rem] flex shadow-soft-glow mb-8 border border-white"><button onClick={()=>setFeedType('client')} className={`flex-1 py-3.5 rounded-xl text-sm font-black transition-all ${feedType==='client'?'bg-orange-500 text-white shadow-md':'text-gray-400 hover:bg-gray-50'}`}>🙋‍♂️ 找帮忙</button><button onClick={()=>setFeedType('provider')} className={`flex-1 py-3.5 rounded-xl text-sm font-black transition-all ${feedType==='provider'?'bg-green-600 text-white shadow-md':'text-gray-400 hover:bg-gray-50'}`}>🤝 我接单</button></div>
                   
                   <div className="lg:hidden"><OfficialAds isAdmin={user?.role==='admin'} showToast={showToast} /></div>
                   
                   {isInitialLoading && posts.length === 0 ? <div className="py-32 text-center space-y-6"><Loader2 className="animate-spin w-12 h-12 text-green-600 mx-auto"/><div className="animate-pulse"><p className="text-gray-900 font-black text-lg">正在连接社区...</p><p className="text-sm text-gray-400 mt-2 font-medium">云端数据加载中，请稍候 ☕️</p></div></div> : posts.map(p => <PostCard key={p.id} post={p} onClick={()=>setSelectedPost(p)} onContactClick={()=>{if(!user)return setShowLogin(true); openChat(p.authorId, p.author.nickname);}} onAvatarClick={(uid: string) => setViewingUserId(uid)} onImageClick={(src:string) => setViewingImage(src)} />)}
                   
                   {!isInitialLoading && posts.length > 0 && hasMore && <button onClick={handleLoadMore} disabled={isLoadingMore} className="w-full py-4 mt-6 bg-white text-gray-900 text-sm font-black rounded-2xl shadow-soft-glow hover:scale-[1.02] transition disabled:opacity-50">{isLoadingMore ? <Loader2 className="animate-spin mx-auto w-5 h-5"/> : '加载更多'}</button>}
                   {!isInitialLoading && posts.length > 0 && !hasMore && <div className="text-center py-10 text-gray-300 text-xs font-bold uppercase tracking-widest">没有更多内容了</div>}
               </div>
           )}
           {tab === 'messages' && <div className="flex flex-col h-full w-full"><div className="px-6 pt-safe-top pb-6 bg-[#FFF8F0]/90 backdrop-blur-md sticky top-0 z-10"><h2 className="text-3xl font-black text-gray-900">消息</h2></div><MessagesList currentUser={user} onOpenChat={(c)=>{setChatConv(c)}}/></div>}
           {tab === 'notifications' && <div className="flex-1 flex flex-col items-center justify-center text-gray-300"><div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4"><Bell size={40}/></div><p className="font-bold">暂无通知</p></div>}
           {tab === 'profile' && <ProfileView user={user} onLogin={()=>setShowLogin(true)} onLogout={handleLogout} onOpenPost={setSelectedPost} onUpdateUser={setUser} showToast={showToast} />}
        </main>

        <div className="lg:hidden absolute bottom-6 left-6 right-6 bg-gray-900/90 backdrop-blur-xl text-white px-6 py-4 rounded-[2rem] flex justify-between items-center z-40 shadow-2xl border border-white/10">
           <button onClick={()=>setTab('home')} className={`transition active:scale-90 ${tab==='home'?'text-green-400':'text-gray-500'}`}><Home size={24}/></button>
           <button onClick={()=>setTab('messages')} className={`transition active:scale-90 relative ${tab==='messages'?'text-green-400':'text-gray-500'}`}>
                <MessageCircle size={24}/>
                {/* ✨ 移动端消息红点 */}
                {hasNotification && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></div>}
           </button>
           <button onClick={()=>user?setShowCreate(true):setShowLogin(true)} className="w-14 h-14 bg-gradient-to-br from-green-500 to-teal-400 rounded-full shadow-lg shadow-green-900/50 flex items-center justify-center text-white -mt-12 border-4 border-[#FFF8F0] active:scale-90 transition"><Plus size={28} strokeWidth={3}/></button>
           <button onClick={()=>setTab('notifications')} className={`transition active:scale-90 ${tab==='notifications'?'text-green-400':'text-gray-500'}`}><Bell size={24}/></button>
           <button onClick={()=>setTab('profile')} className={`transition active:scale-90 ${tab==='profile'?'text-green-400':'text-gray-500'}`}><UserIcon size={24}/></button>
        </div>

        {/* Modals */}
        {showLogin && <LoginModal onClose={()=>setShowLogin(false)} onLogin={setUser} showToast={showToast}/>}
        {showCreate && <CreatePostModal user={user} onClose={()=>setShowCreate(false)} onCreated={() => fetchPosts(1, true)} showToast={showToast}/>}
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