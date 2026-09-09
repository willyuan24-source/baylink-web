// 编辑资料全屏弹层 + 手机号验证弹窗 + 标签选择字段
import React, { useRef, useState } from 'react';
import { X, ShieldCheck, Camera, Smartphone, Check, Loader2 } from 'lucide-react';
import { ModalShell } from '../../components/ui/Modal';
import { api, safeParse } from '../../lib/api';
import Avatar from '../../components/Avatar';
import { INTEREST_PRESETS, PROFILE_TAG_PRESETS, REGIONS } from '../../lib/constants';
import { friendlyErrorMessage, getPhoneVerificationTrustLabel, validateContactValue } from '../../lib/format';
import { compressImageFile, fileToDataUrl, UnsupportedImageError } from '../../utils/imageCompression';

const ProfileTagField = ({
  label,
  hint,
  presets,
  tags,
  max,
  onChange,
  showToast,
}: {
  label: string;
  hint: string;
  presets: string[];
  tags: string[];
  max: number;
  onChange: (next: string[]) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) => {
  const [custom, setCustom] = useState('');
  const toggle = (tag: string) => {
    if (tags.includes(tag)) {
      onChange(tags.filter((t) => t !== tag));
      return;
    }
    if (tags.length >= max) {
      showToast(`最多选择 ${max} 个标签`, 'error');
      return;
    }
    onChange([...tags, tag]);
  };
  const addCustom = () => {
    const tag = custom.trim().slice(0, 20);
    if (!tag) return;
    if (tags.includes(tag)) { setCustom(''); return; }
    if (tags.length >= max) {
      showToast(`最多选择 ${max} 个标签`, 'error');
      return;
    }
    onChange([...tags, tag]);
    setCustom('');
  };
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-gray-500 ml-1">{label}</label>
      <p className="mb-2 text-[11px] text-baylink-muted ml-1">{hint}</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => toggle(p)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
              tags.includes(p)
                ? 'bg-baylink-green text-white'
                : 'border border-baylink-border/60 bg-white text-baylink-text-secondary hover:border-baylink-green/30'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      {tags.filter((t) => !presets.includes(t)).length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {tags.filter((t) => !presets.includes(t)).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="rounded-full bg-baylink-green/15 px-2 py-0.5 text-[11px] text-baylink-green"
            >
              {t} ×
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl bg-white px-3 py-2 text-xs outline-none shadow-sm focus:ring-2 focus:ring-green-500/20"
          placeholder="自定义标签，回车添加"
          value={custom}
          maxLength={20}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) { e.preventDefault(); addCustom(); } }}
        />
        <button type="button" onClick={addCustom} className="shrink-0 rounded-xl bg-baylink-section px-3 py-2 text-[11px] font-semibold text-baylink-text">添加</button>
      </div>
    </div>
  );
};

export const PhoneVerificationModal = ({ user, onClose, onVerified, showToast }: any) => {
    const [step, setStep] = useState(1);
    const [phone, setPhone] = useState(user.phone || '');
    const [code, setCode] = useState('');
    const [devCode, setDevCode] = useState('');
    const [loading, setLoading] = useState(false);

    const sendCode = async () => {
        const digits = phone.replace(/\D/g, '');
        if (!digits || (digits.length !== 10 && !(digits.length === 11 && digits.startsWith('1')))) {
          return showToast('请输入有效的美国手机号。', 'error');
        }
        setLoading(true);
        try {
            const res = await api.startPhoneVerification(phone);
            if (import.meta.env.DEV && res.devCode) setDevCode(res.devCode);
            showToast('验证码已发送', 'success');
            setStep(2);
        } catch(e: any) {
            showToast(friendlyErrorMessage(e, '验证码发送失败，请稍后再试。'), 'error');
        }
        finally { setLoading(false); }
    };

    const verifyCode = async () => {
        if (!code || code.trim().length < 6) return showToast('请输入6位验证码', 'error');
        setLoading(true);
        try {
            const res = await api.verifyPhoneCode(code.trim());
            const stored = localStorage.getItem('currentUser');
            const current = stored ? safeParse(stored) : {};
            const nextUser = { ...current, ...res.user };
            localStorage.setItem('currentUser', JSON.stringify(nextUser));
            onVerified(nextUser);
            showToast('手机号验证已完成', 'success');
            onClose();
        } catch(e: any) { showToast(friendlyErrorMessage(e, '验证码错误'), 'error'); }
        finally { setLoading(false); }
    };

    return (
        // 两步短信验证流程，误触遮罩不关闭（关闭会丢失已发送的验证码步骤）
        <ModalShell onClose={onClose} closeOnBackdrop={false} label="手机号验证" className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl relative">
                <button type="button" aria-label="关闭个人资料编辑" onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-900"><X size={20}/></button>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4 mx-auto"><ShieldCheck size={24}/></div>
                <h3 className="text-xl font-black text-center mb-1">手机号验证</h3>
                <p className="mb-4 text-center text-[11px] leading-relaxed text-gray-500">手机号只用于账号安全和提升社区信任，不会公开显示。</p>
                {step === 1 ? (
                    <div className="space-y-4">
                        <input className="w-full p-3.5 bg-gray-50 rounded-xl text-sm font-medium text-center outline-none border border-transparent focus:border-blue-500 focus:bg-white transition placeholder:text-[11px] placeholder:font-normal" placeholder="例如：4156012119 或 +14156012119" value={phone} onChange={e => setPhone(e.target.value)} />
                        <button onClick={sendCode} disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 active:scale-95 transition">{loading ? '发送中...' : '发送验证码'}</button>
                        <p className="text-[11px] leading-relaxed text-gray-500">
                          By clicking &ldquo;发送验证码 / Send verification code&rdquo;, you agree to receive one-time SMS verification codes from BAYLINK at the mobile number provided for account security and phone verification. Message frequency varies based on your verification requests. Msg &amp; data rates may apply. Reply STOP to opt out or HELP for help. View our{' '}
                          <a href="/privacy" className="font-semibold text-baylink-green hover:underline">Privacy Policy</a>
                          {' '}and{' '}
                          <a href="/terms" className="font-semibold text-baylink-green hover:underline">Terms of Service</a>.
                        </p>
                        <p className="text-center text-[11px] text-baylink-muted">
                          <a href="/sms-consent" className="text-baylink-green hover:underline">SMS Verification Consent</a>
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {import.meta.env.DEV && devCode && (
                          <p className="text-center text-[11px] text-amber-700">开发测试码：{devCode}</p>
                        )}
                        <input className="w-full p-4 bg-gray-50 rounded-xl font-bold text-center outline-none border border-transparent focus:border-blue-500 focus:bg-white transition tracking-widest text-lg" placeholder="6位验证码" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                        <button onClick={verifyCode} disabled={loading} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 active:scale-95 transition">{loading ? '验证中...' : '完成验证'}</button>
                    </div>
                )}
            </div>
        </ModalShell>
    );
};

export const EditProfileModal = ({ user, onClose, onUpdate, showToast }: any) => {
    const [form, setForm] = useState({
      nickname: user.nickname || '',
      contactType: user.contactType || 'wechat',
      contactValue: user.contactValue || '',
      bio: user.bio || '',
      avatar: user.avatar || '',
      area: user.area || '',
      city: user.city || '',
      profileTags: user.profileTags || [],
      interests: user.interests || [],
      website: user.website || '',
      xiaohongshu: user.xiaohongshu || '',
      socialLinks: { linkedin: user.socialLinks?.linkedin || '', instagram: user.socialLinks?.instagram || '' },
    });
    const [saving, setSaving] = useState(false);
    const [showVerify, setShowVerify] = useState(false);
    const [avatarProcessing, setAvatarProcessing] = useState(false);
    const avatarProcessingRef = useRef(false);
    const savingRef = useRef(false);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (avatarProcessingRef.current || savingRef.current) return;
        const input = e.target;
        const file = input.files?.[0];
        if (!file) return;
        avatarProcessingRef.current = true;
        setAvatarProcessing(true);
        try {
            const { file: compressedFile } = await compressImageFile(file, { maxWidth: 768, maxHeight: 768, quality: 0.86 });
            const dataUrl = await fileToDataUrl(compressedFile);
            setForm((p) => ({ ...p, avatar: dataUrl }));
        } catch (err) {
            console.warn('[avatar] image process failed', err);
            showToast(err instanceof UnsupportedImageError ? err.message : '图片处理失败', 'error');
        } finally {
            avatarProcessingRef.current = false;
            setAvatarProcessing(false);
            input.value = '';
        }
    };

    const handleSave = async () => {
      if (savingRef.current) return;
      if (avatarProcessingRef.current) return showToast('头像还在处理中，请稍候再保存。', 'info');
      if (!form.nickname.trim()) return showToast('请填写昵称', 'error');
      const contactChanged = form.contactType !== (user.contactType || 'wechat') || form.contactValue !== (user.contactValue || '');
      if (contactChanged || form.contactValue.trim()) {
        const contactError = validateContactValue(form.contactType, form.contactValue);
        if (contactError) return showToast(contactError, 'error');
      }
      savingRef.current = true;
      setSaving(true);
      try {
        const { contactType, contactValue, ...publicFields } = form;
        const updated = await api.updateProfile({ ...publicFields, nickname: form.nickname.trim(),
          ...(contactChanged || contactValue.trim() ? { contactType, contactValue: contactValue.trim() } : {}) });
        const newUserData = { ...user, ...updated };
        localStorage.setItem('currentUser', JSON.stringify(newUserData));
        onUpdate(newUserData);
        onClose();
        showToast('资料已更新', 'success');
      } catch (e: any) {
        showToast(friendlyErrorMessage(e, '保存失败'), 'error');
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    };

    return (
        <ModalShell onClose={onClose} closeOnBackdrop={false} label="编辑资料" className="fixed inset-0 z-[90] bg-[#FFF8F0] flex flex-col animate-in slide-in-from-bottom duration-200">
             <div className="px-4 py-3 border-b border-white/50 flex items-center justify-between bg-[#FFF8F0]/80 backdrop-blur-md pt-safe-top">
                <button onClick={onClose} className="text-gray-500 hover:text-gray-900 font-bold text-sm">取消</button><span className="font-bold text-lg text-gray-900">编辑资料</span><button onClick={handleSave} disabled={saving || avatarProcessing} className="text-green-700 font-bold text-sm disabled:opacity-50">{avatarProcessing ? '头像处理中…' : saving ? '保存中...' : '完成'}</button>
             </div>
             <div className="flex-1 p-5 overflow-y-auto pb-8">
                 <div className="flex flex-col items-center mb-6"><div className="relative group"><Avatar src={form.avatar} name={form.nickname} size={24} /><label htmlFor="edit-profile-avatar-input" className="absolute bottom-0 right-0 bg-gray-900 text-white p-3 rounded-full cursor-pointer shadow-xl hover:scale-110 transition border-2 border-white">{avatarProcessing ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18}/>}<input id="edit-profile-avatar-input" type="file" accept="image/*" disabled={avatarProcessing || saving} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={handleAvatarUpload} aria-label="上传头像" /></label></div>{avatarProcessing && <p role="status" className="mt-2 text-xs text-baylink-muted">正在处理头像，请稍候再保存。</p>}</div>

                 <div className="bg-white p-4 rounded-2xl shadow-sm mb-5 flex items-center justify-between border border-blue-50">
                     <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-full ${user.isPhoneVerified ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}><Smartphone size={20}/></div>
                         <div><div className="font-bold text-sm text-gray-900">手机号验证</div><div className="text-[11px] text-baylink-muted">{getPhoneVerificationTrustLabel(user.isPhoneVerified)}</div></div>
                     </div>
                     {!user.isPhoneVerified ? (
                         <button onClick={() => setShowVerify(true)} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold shadow-md hover:bg-blue-700 transition">验证手机号</button>
                     ) : (
                         <div className="text-blue-600 text-xs font-bold flex items-center gap-1"><Check size={14}/> 已验证</div>
                     )}
                 </div>

                  <div className="space-y-5">
                      <div className="rounded-2xl border border-baylink-border bg-white p-4 space-y-2">
                        <label htmlFor="profile-contact-type" className="block text-xs font-semibold">账号联系方式类型</label>
                        <select id="profile-contact-type" value={form.contactType} onChange={(e) => setForm({ ...form, contactType: e.target.value })} className="w-full rounded-xl border border-baylink-border p-3 text-sm">
                          <option value="wechat">微信</option><option value="phone">电话</option><option value="email">邮箱</option>
                        </select>
                        <label htmlFor="profile-contact-value" className="block text-xs font-semibold">{form.contactType === 'phone' ? '电话号码' : form.contactType === 'email' ? '联系邮箱' : '微信号'}</label>
                        <input id="profile-contact-value" type={form.contactType === 'phone' ? 'tel' : form.contactType === 'email' ? 'email' : 'text'} value={form.contactValue} onChange={(e) => setForm({ ...form, contactValue: e.target.value })} className="w-full rounded-xl border border-baylink-border p-3 text-sm" />
                        <p className="text-[11px] leading-relaxed text-baylink-muted">不会显示在公开资料中。分享账号联系方式时使用；每条帖子的联系方式可在发帖时单独设置。</p>
                      </div>
                     <div><label className="block text-xs font-bold text-gray-500 mb-2 ml-1">昵称</label><input className="w-full p-4 bg-white rounded-2xl border-none outline-none text-sm font-bold text-gray-900 shadow-sm focus:ring-2 focus:ring-green-500/20 transition" value={form.nickname} onChange={e => setForm({...form, nickname: e.target.value})} /></div>
                     <div>
                       <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">一句话介绍</label>
                       <p className="mb-2 text-[11px] text-baylink-muted ml-1">让别人快速了解你是谁、在找什么或提供什么</p>
                       <textarea className="w-full p-4 bg-white rounded-2xl border-none outline-none text-sm h-24 resize-none font-medium text-gray-700 shadow-sm focus:ring-2 focus:ring-green-500/20 transition" value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} placeholder="例如：在南湾工作三年，常发租房和二手信息…" />
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                       <div>
                         <label className="block text-xs font-bold text-gray-500 mb-2 ml-1">所在区域</label>
                         <select className="w-full p-3 bg-white rounded-xl text-sm shadow-sm outline-none focus:ring-2 focus:ring-green-500/20" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })}>
                           <option value="">选择大区</option>
                           {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                         </select>
                       </div>
                       <div>
                         <label className="block text-xs font-bold text-gray-500 mb-2 ml-1">所在城市</label>
                         <input className="w-full p-3 bg-white rounded-xl text-sm shadow-sm outline-none focus:ring-2 focus:ring-green-500/20" placeholder="如 Millbrae" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                       </div>
                     </div>
                     <ProfileTagField
                       label="身份标签"
                       hint="选择最能代表你身份的标签，最多 8 个"
                       presets={PROFILE_TAG_PRESETS}
                       tags={form.profileTags}
                       max={8}
                       onChange={(profileTags) => setForm((p) => ({ ...p, profileTags }))}
                       showToast={showToast}
                     />
                     <ProfileTagField
                       label="兴趣标签"
                       hint="分享你的兴趣，方便附近用户认识你，最多 12 个"
                       presets={INTEREST_PRESETS}
                       tags={form.interests}
                       max={12}
                       onChange={(interests) => setForm((p) => ({ ...p, interests }))}
                       showToast={showToast}
                     />
                     <div className="space-y-3 pt-1">
                       <p className="text-xs font-bold text-gray-500 ml-1">社交链接</p>
                       <div>
                         <label className="block text-[11px] text-baylink-muted mb-1 ml-1">Instagram</label>
                         <input className="w-full p-3 bg-white rounded-xl text-sm shadow-sm outline-none focus:ring-2 focus:ring-green-500/20" placeholder="用户名或完整链接" value={form.socialLinks.instagram} onChange={e => setForm({ ...form, socialLinks: { ...form.socialLinks, instagram: e.target.value } })} />
                       </div>
                       <div>
                         <label className="block text-[11px] text-baylink-muted mb-1 ml-1">小红书</label>
                         <input className="w-full p-3 bg-white rounded-xl text-sm shadow-sm outline-none focus:ring-2 focus:ring-green-500/20" placeholder="主页链接或 ID" value={form.xiaohongshu} onChange={e => setForm({ ...form, xiaohongshu: e.target.value })} />
                       </div>
                       <div>
                         <label className="block text-[11px] text-baylink-muted mb-1 ml-1">个人网站</label>
                         <input className="w-full p-3 bg-white rounded-xl text-sm shadow-sm outline-none focus:ring-2 focus:ring-green-500/20" placeholder="https://..." value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
                       </div>
                     </div>
                 </div>
             </div>
             {showVerify && <PhoneVerificationModal user={user} onClose={() => setShowVerify(false)} onVerified={onUpdate} showToast={showToast} />}
        </ModalShell>
    );
};
