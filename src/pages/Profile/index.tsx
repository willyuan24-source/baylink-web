import React, { useState, useEffect } from 'react';
import { 
  LogOut, Edit, ChevronRight, ChevronLeft, Save, Camera, Smartphone, Check, 
  User as UserIcon, ShieldCheck, BadgeCheck, Zap, Info, Phone, FileText, Loader2
} from 'lucide-react';
import imageCompression from 'browser-image-compression';

// --- 內部配置與工具 ---
const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : 'https://baylink-api.onrender.com/api';

const safeParse = (str: string | null) => { try { return str ? JSON.parse(str) : null; } catch { return null; } };
const compressImage = async (file: File): Promise<File> => {
  const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1280, useWebWorker: true };
  try { return await imageCompression(file, options); } 
  catch (error) { console.error("Compression failed:", error); return file; }
};

const apiRequest = async (endpoint: string, options: any = {}) => {
  const headers: any = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const userStr = localStorage.getItem('currentUser');
  if (userStr) {
    const user = safeParse(userStr);
    if (user && user.token) headers['Authorization'] = `Bearer ${user.token}`;
  }
  const res = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  return res.json();
};

const Avatar = ({ src, name, size = 10 }: { src?: string, name?: string, size?: number }) => {
  const displaySize = size * 4; 
  if (src) return <img src={src} alt={name || "User"} className="rounded-full object-cover border border-gray-100 bg-white" style={{ width: `${displaySize}px`, height: `${displaySize}px` }} />;
  return <div className="rounded-full bg-gradient-to-br from-green-600 to-teal-500 text-white flex items-center justify-center font-bold shadow-sm" style={{ width: `${displaySize}px`, height: `${displaySize}px`, fontSize: `${displaySize * 0.4}px` }}>{name ? name[0].toUpperCase() : <UserIcon size={displaySize * 0.5} />}</div>;
};

// --- 子組件：實名認證 ---
const PhoneVerificationModal = ({ user, onClose, onVerified, showToast }: any) => {
    const [step, setStep] = useState(1);
    const [phone, setPhone] = useState(user.contactValue || '');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    const sendCode = async () => {
        if (!phone || phone.length < 10) return showToast('請輸入有效的手機號', 'error');
        setLoading(true);
        try {
            await apiRequest('/auth/verify-phone', { method: 'POST', body: JSON.stringify({ phone }) });
            showToast('驗證碼已發送', 'success');
            setStep(2);
        } catch(e: any) { showToast('發送失敗', 'error'); } 
        finally { setLoading(false); }
    };

    const verifyCode = async () => {
        if (!code) return showToast('請輸入驗證碼', 'error');
        setLoading(true);
        try {
            const res = await apiRequest('/auth/verify-phone', { method: 'POST', body: JSON.stringify({ phone, code }) });
            localStorage.setItem('currentUser', JSON.stringify(res.user));
            onVerified(res.user);
            showToast('認證成功！', 'success');
            onClose();
        } catch(e: any) { showToast('驗證碼錯誤', 'error'); }
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-6 backdrop-blur-sm">
            <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-900"><X size={20}/></button>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4 mx-auto"><ShieldCheck size={24}/></div>
                <h3 className="text-xl font-black text-center mb-2">實名認證</h3>
                {step === 1 ? (
                    <div className="space-y-4">
                        <input className="w-full p-4 bg-gray-50 rounded-xl font-bold text-center outline-none border border-transparent focus:border-blue-500 focus:bg-white transition" placeholder="輸入手機號 (如 +1...)" value={phone} onChange={e => setPhone(e.target.value)} />
                        <button onClick={sendCode} disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg">{loading ? '發送中...' : '發送驗證碼'}</button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <input className="w-full p-4 bg-gray-50 rounded-xl font-bold text-center outline-none border border-transparent focus:border-blue-500 focus:bg-white transition tracking-widest text-lg" placeholder="驗證碼" value={code} onChange={e => setCode(e.target.value)} />
                        <button onClick={verifyCode} disabled={loading} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg">{loading ? '驗證中...' : '確認驗證'}</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- 子組件：編輯資料 ---
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
            } catch (err) { showToast('圖片處理失敗', 'error'); }
        } 
    };

    const handleSave = async () => { 
        if (!form.nickname) return; 
        setSaving(true); 
        try { 
            const updated = await apiRequest('/users/me', { method: 'PATCH', body: JSON.stringify(form) }); 
            const newUserData = { ...user, ...updated }; 
            localStorage.setItem('currentUser', JSON.stringify(newUserData)); 
            onUpdate(newUserData); 
            onClose(); 
            showToast('資料已更新', 'success'); 
        } catch (e) { showToast('保存失敗', 'error'); } 
        finally { setSaving(false); } 
    };
    
    return (
        <div className="fixed inset-0 z-[90] bg-[#FFF8F0] flex flex-col animate-in slide-in-from-bottom duration-200">
             <div className="px-4 py-3 border-b border-white/50 flex items-center justify-between bg-[#FFF8F0]/80 backdrop-blur-md pt-safe-top">
                <button onClick={onClose} className="text-gray-500 hover:text-gray-900 font-bold text-sm">取消</button><span className="font-bold text-lg text-gray-900">編輯資料</span><button onClick={handleSave} disabled={saving} className="text-green-700 font-bold text-sm disabled:opacity-50">{saving ? '保存中...' : '完成'}</button>
             </div>
             <div className="flex-1 p-6 overflow-y-auto">
                 <div className="flex flex-col items-center mb-8"><div className="relative group"><Avatar src={form.avatar} name={form.nickname} size={24} /><label className="absolute bottom-0 right-0 bg-gray-900 text-white p-3 rounded-full cursor-pointer shadow-xl border-2 border-white"><Camera size={18}/><input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} /></label></div></div>
                 
                 <div className="bg-white p-4 rounded-2xl shadow-sm mb-6 flex items-center justify-between border border-blue-50">
                     <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-full ${user.isPhoneVerified ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}><Smartphone size={20}/></div>
                         <div><div className="font-bold text-sm text-gray-900">實名認證</div><div className="text-[10px] text-gray-400">{user.isPhoneVerified ? '已驗證手機號' : '未驗證手機號'}</div></div>
                     </div>
                     {!user.isPhoneVerified ? (
                         <button onClick={() => setShowVerify(true)} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold">去認證</button>
                     ) : (
                         <div className="text-blue-600 text-xs font-bold flex items-center gap-1"><Check size={14}/> 已認證</div>
                     )}
                 </div>

                 <div className="space-y-5">
                     <div><label className="block text-xs font-bold text-gray-500 mb-2 ml-1">暱稱</label><input className="w-full p-4 bg-white rounded-2xl border-none outline-none text-sm font-bold text-gray-900 shadow-sm focus:ring-2 focus:ring-green-500/20 transition" value={form.nickname} onChange={e => setForm({...form, nickname: e.target.value})} /></div>
                     <div><label className="block text-xs font-bold text-gray-500 mb-2 ml-1">個人簡介</label><textarea className="w-full p-4 bg-white rounded-2xl border-none outline-none text-sm h-32 resize-none font-medium text-gray-700 shadow-sm focus:ring-2 focus:ring-green-500/20 transition" value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} placeholder="介紹一下你自己..." /></div>
                 </div>
             </div>
             {showVerify && <PhoneVerificationModal user={user} onClose={() => setShowVerify(false)} onVerified={onUpdate} showToast={showToast} />}
        </div>
    );
};

// --- 子組件：靜態資訊頁 (客服/關於我們) ---
const InfoPage = ({ title, storageKey, user, onBack, showToast }: any) => {
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await apiRequest(`/content/${storageKey}`);
        setContent(data.value || '暫無內容');
        setEditValue(data.value || '');
      } catch (e) { setContent('加載失敗'); } 
      finally { setLoading(false); }
    };
    load();
  }, [storageKey]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await apiRequest('/content', { method: 'POST', body: JSON.stringify({ key: storageKey, value: editValue }) });
      setContent(editValue);
      setIsEditing(false);
      showToast('頁面內容已更新', 'success');
    } catch (e) { showToast('保存失敗', 'error'); } 
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-[#FFF8F0] flex flex-col w-full h-full">
      <div className="px-4 py-3 border-b border-white/50 flex items-center justify-between bg-[#FFF8F0]/80 backdrop-blur-md sticky top-0 pt-safe-top z-10">
        <div className="flex items-center gap-3"><button onClick={onBack} className="p-2 hover:bg-white/50 rounded-full transition"><ChevronLeft size={24} className="text-gray-900" /></button><span className="font-bold text-lg text-gray-900">{title}</span></div>
        {user?.role === 'admin' && !isEditing && <button onClick={() => setIsEditing(true)} className="text-green-700 text-sm font-bold flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm"><Edit size={14} /> 編輯</button>}
        {isEditing && <button onClick={handleSave} disabled={loading} className="text-white bg-green-700 text-sm font-bold flex items-center gap-1 px-3 py-1.5 rounded-full shadow-md"><Save size={14} /> {loading ? '...' : '發布'}</button>}
      </div>
      <div className="flex-1 p-6 overflow-y-auto bg-white/50">
        {!loading && (isEditing ? <textarea className="w-full h-full p-4 bg-white border rounded-2xl text-sm outline-none resize-none shadow-sm" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="在這裡輸入內容..." /> : <div className="text-gray-900 text-base leading-relaxed whitespace-pre-wrap">{content}</div>)}
      </div>
    </div>
  );
};

// --- 子組件：我的發布管理 ---
const MyPostsView = ({ user, onBack, onOpenPost }: any) => {
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const all = await apiRequest('/posts');
        const list = Array.isArray(all) ? all : (all.posts || []);
        setMyPosts(list.filter((p: any) => p.authorId === user.id));
      } catch {} finally { setLoading(false); }
    };
    load();
  }, [user.id]);

  return (
    <div className="fixed inset-0 z-[80] bg-[#FFF8F0] flex flex-col w-full h-full">
      <div className="px-4 py-3 border-b border-white/50 flex items-center gap-3 bg-[#FFF8F0]/80 backdrop-blur-md sticky top-0 pt-safe-top shrink-0 z-10">
        <button onClick={onBack} className="p-2 hover:bg-white/50 rounded-full transition"><ChevronLeft size={24} className="text-gray-900" /></button>
        <span className="font-bold text-lg text-gray-900">我的發布</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 bg-[#FAFAFA]">
        {loading ? <div className="text-center py-10 text-gray-400 text-xs">加載中...</div> : myPosts.length > 0 ? (
          <div className="space-y-4">
            {myPosts.map(p => (
              <div key={p.id} onClick={() => onOpenPost(p)} className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition">
                <h4 className="font-bold text-gray-900 text-base mb-1">{p.title}</h4>
                <p className="text-xs text-gray-400">{p.city} · {p.category} · {p.budget}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 opacity-60">
            <p className="text-sm font-bold text-gray-500">你還沒有發布過內容</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- 主組件核心渲染 ---
export default function ProfileView({ user, onLogout, onLogin, onOpenPost, onUpdateUser, showToast }: any) {
  const [subView, setSubView] = useState<'menu' | 'my_posts' | 'support' | 'about' | 'edit_profile'>('menu');

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[80vh]">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6 shadow-soft-glow animate-bounce"><Zap size={40} /></div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">歡迎來到 BayLink</h2>
        <p className="text-gray-500 text-center mb-8 text-sm">連接灣區鄰里，讓互助更簡單。</p>
        <button onClick={onLogin} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold shadow-xl">立即登入 / 註冊</button>
      </div>
    );
  }

  return (
    <div className="flex-1 relative w-full h-full bg-[#FAFAFA]">
      {subView === 'menu' && (
        <div className="p-6 pt-8 w-full h-full overflow-y-auto">
          <div className="flex justify-between items-center mb-8"><h1 className="text-3xl font-black text-gray-900">我的主頁</h1><button onClick={onLogout} className="p-2 bg-white rounded-full text-red-500 shadow-sm"><LogOut size={20} /></button></div>

          {/* 禪意個人資料卡 */}
          <div className="bg-white p-6 rounded-[2rem] shadow-soft-glow mb-6 relative overflow-hidden group border border-gray-100">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-50 to-transparent rounded-full -mr-10 -mt-10"></div>
            <div className="flex items-center gap-5 relative z-10">
              <Avatar src={user.avatar} name={user.nickname} size={18} />
              <div className="flex-1">
                <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                  {user.nickname}
                  {user.isPhoneVerified && <span className="bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded-full border border-blue-100">✓ 已實名</span>}
                </h2>
                <p className="text-xs text-gray-500 line-clamp-2 mt-1 font-medium">{user.bio || '寫句簽名展示自己吧~'}</p>
              </div>
              <button onClick={() => setSubView('edit_profile')} className="p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition"><Edit size={18} /></button>
            </div>
            <div className="mt-6 flex divide-x divide-gray-100 border-t border-gray-50 pt-4">
              <div className="flex-1 text-center"><div className="text-lg font-black text-gray-900">12</div><div className="text-[10px] text-gray-400 font-bold uppercase">成功互助</div></div>
              <div className="flex-1 text-center"><div className="text-lg font-black text-gray-900">100%</div><div className="text-[10px] text-gray-400 font-bold uppercase">好評率</div></div>
              <div className="flex-1 text-center"><div className="text-lg font-black text-gray-900">365</div><div className="text-[10px] text-gray-400 font-bold uppercase">加入天數</div></div>
            </div>
          </div>

          {/* 功能網格 */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button onClick={() => setSubView('my_posts')} className="bg-white p-5 rounded-[1.5rem] shadow-sm hover:shadow-md transition text-left group"><div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 mb-3 group-hover:scale-110 transition"><FileText size={20} /></div><div className="font-bold text-gray-900">我的發布</div><div className="text-[10px] text-gray-400">管理帖子</div></button>
            <button onClick={() => setSubView('support')} className="bg-white p-5 rounded-[1.5rem] shadow-sm hover:shadow-md transition text-left group"><div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-3 group-hover:scale-110 transition"><Phone size={20} /></div><div className="font-bold text-gray-900">聯繫客服</div><div className="text-[10px] text-gray-400">幫助支持</div></button>
          </div>
          <button onClick={() => setSubView('about')} className="w-full bg-white p-5 rounded-[1.5rem] shadow-sm hover:shadow-md transition flex items-center justify-between group"><div className="flex items-center gap-4"><div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 group-hover:scale-110 transition"><Info size={20} /></div><div className="font-bold text-gray-900">關於我們</div></div><ChevronRight size={18} className="text-gray-300" /></button>
        </div>
      )}
      {subView === 'edit_profile' && <EditProfileModal user={user} onClose={() => setSubView('menu')} onUpdate={onUpdateUser} showToast={showToast} />}
      {subView === 'my_posts' && <MyPostsView user={user} onBack={() => setSubView('menu')} onOpenPost={onOpenPost} />}
      {subView === 'support' && <InfoPage title="聯繫客服" storageKey="baylink_support" user={user} onBack={() => setSubView('menu')} showToast={showToast} />}
      {subView === 'about' && <InfoPage title="關於我們" storageKey="baylink_about" user={user} onBack={() => setSubView('menu')} showToast={showToast} />}
    </div>
  );
}