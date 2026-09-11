// 编辑资料全屏弹层 + 手机号验证弹窗 + 标签选择字段
import React, { useRef, useState } from 'react';
import { X, ShieldCheck, Camera, Smartphone, Check, Loader2, ImagePlus, LockKeyhole, Globe2, Palette, Trash2 } from 'lucide-react';
import { ModalShell } from '../../components/ui/Modal';
import { api } from '../../lib/api';
import type { UserData } from '../../lib/types';
import { INTEREST_PRESETS, PROFILE_TAG_PRESETS, REGIONS } from '../../lib/constants';
import { friendlyErrorMessage, getPhoneVerificationTrustLabel, validateContactValue } from '../../lib/format';
import { UnsupportedImageError } from '../../utils/imageCompression';
import { prepareProfileImage } from './profile-images';
import { ProfileIdentity } from './ProfileIdentity';
import { PROFILE_THEMES, resolveProfileTheme } from './profile-personality';
import { useProfileSessionGuard } from './useProfileSessionGuard';

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
            aria-pressed={tags.includes(p)}
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
              translate="no"
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

type ProfileEditorCallbacks = {
  user: UserData;
  onClose: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
};
type PhoneVerificationProps = ProfileEditorCallbacks & { onVerified: (user: UserData) => void };
export const PhoneVerificationModal = (props: PhoneVerificationProps) => <PhoneVerificationSession key={JSON.stringify([props.user.id, props.user.token])} {...props} />;
const PhoneVerificationSession = ({ user, onClose, onVerified, showToast }: PhoneVerificationProps) => {
    const isCurrentSession = useProfileSessionGuard(user);
    const [step, setStep] = useState(1);
    const [phone, setPhone] = useState(user.phone || '');
    const [code, setCode] = useState('');
    const [devCode, setDevCode] = useState('');
    const [loading, setLoading] = useState(false);
    const loadingRef = useRef(false);

    const sendCode = async () => {
        if (loadingRef.current || !isCurrentSession()) return;
        const digits = phone.replace(/\D/g, '');
        if (!digits || (digits.length !== 10 && !(digits.length === 11 && digits.startsWith('1')))) {
          return showToast('请输入有效的美国手机号。', 'error');
        }
        loadingRef.current = true; setLoading(true);
        try {
            const res = await api.startPhoneVerification(phone);
            if (!isCurrentSession()) return;
            if (import.meta.env?.DEV && res.devCode) setDevCode(res.devCode);
            showToast('验证码已发送', 'success');
            setStep(2);
        } catch(e: unknown) {
            if (isCurrentSession()) showToast(friendlyErrorMessage(e, '验证码发送失败，请稍后再试。'), 'error');
        }
        finally { loadingRef.current = false; if (isCurrentSession()) setLoading(false); }
    };

    const verifyCode = async () => {
        if (loadingRef.current || !isCurrentSession()) return;
        if (!code || code.trim().length < 6) return showToast('请输入6位验证码', 'error');
        loadingRef.current = true; setLoading(true);
        try {
            const res = await api.verifyPhoneCode(code.trim());
            if (!isCurrentSession()) return;
            const nextUser = { ...user, ...res.user };
            try { localStorage.setItem('currentUser', JSON.stringify(nextUser)); } catch { /* Verification is saved on the server. */ }
            onVerified(nextUser);
            showToast('手机号验证已完成', 'success');
            onClose();
        } catch(e: unknown) { if (isCurrentSession()) showToast(friendlyErrorMessage(e, '验证码错误'), 'error'); }
        finally { loadingRef.current = false; if (isCurrentSession()) setLoading(false); }
    };

    return (
        // 两步短信验证流程，误触遮罩不关闭（关闭会丢失已发送的验证码步骤）
        <ModalShell onClose={onClose} closeOnBackdrop={false} label="手机号验证" className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl relative">
                <button type="button" aria-label="关闭手机号验证" onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-900"><X size={20}/></button>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4 mx-auto"><ShieldCheck size={24}/></div>
                <h3 className="text-xl font-black text-center mb-1">手机号验证</h3>
                <p className="mb-4 text-center text-[11px] leading-relaxed text-gray-500">手机号只用于账号安全和提升社区信任，不会公开显示。</p>
                {step === 1 ? (
                    <div className="space-y-4">
                        <input type="tel" inputMode="tel" autoComplete="tel-national" aria-label="美国手机号" disabled={loading} className="w-full p-3.5 bg-gray-50 rounded-xl text-sm font-medium text-center outline-none border border-transparent focus:border-blue-500 focus:bg-white transition placeholder:text-[11px] placeholder:font-normal" placeholder="例如：4156012119 或 +14156012119" value={phone} onChange={e => setPhone(e.target.value)} />
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
                        {import.meta.env?.DEV && devCode && (
                          <p className="text-center text-[11px] text-amber-700">开发测试码：{devCode}</p>
                        )}
                        <input inputMode="numeric" autoComplete="one-time-code" aria-label="6位验证码" disabled={loading} className="w-full p-4 bg-gray-50 rounded-xl font-bold text-center outline-none border border-transparent focus:border-blue-500 focus:bg-white transition tracking-widest text-lg" placeholder="6位验证码" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                        <button onClick={verifyCode} disabled={loading} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 active:scale-95 transition">{loading ? '验证中...' : '完成验证'}</button>
                    </div>
                )}
            </div>
        </ModalShell>
    );
};

type EditProfileProps = ProfileEditorCallbacks & { onUpdate: (user: UserData) => void };
export const EditProfileModal = (props: EditProfileProps) => <EditProfileSession key={JSON.stringify([props.user.id, props.user.token])} {...props} />;
const EditProfileSession = ({ user, onClose, onUpdate, showToast }: EditProfileProps) => {
  const isCurrentSession = useProfileSessionGuard(user);
  const [form, setForm] = useState({
    nickname: user.nickname || '', contactType: user.contactType || 'wechat', contactValue: user.contactValue || '',
    bio: user.bio || '', statusText: user.statusText || '', avatar: user.avatar || '', coverImage: user.coverImage || '',
    profileTheme: resolveProfileTheme(user.profileTheme), area: user.area || '', city: user.city || '',
    profileTags: (user.profileTags || []) as string[], interests: (user.interests || []) as string[],
    website: user.website || '', xiaohongshu: user.xiaohongshu || '',
    socialLinks: { linkedin: user.socialLinks?.linkedin || '', instagram: user.socialLinks?.instagram || '' },
  });
  const [saving, setSaving] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [processing, setProcessing] = useState<'avatar' | 'coverImage' | null>(null);
  const processingRef = useRef(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState('');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, kind: 'avatar' | 'coverImage') => {
    if (processingRef.current || savingRef.current || !isCurrentSession()) return;
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    processingRef.current = true; setProcessing(kind);
    try { const dataUrl = await prepareProfileImage(file, kind); if (isCurrentSession()) setForm(p => ({ ...p, [kind]: dataUrl })); }
    catch (err) { if (isCurrentSession()) showToast(err instanceof UnsupportedImageError ? err.message : '图片处理失败，请换一张照片。', 'error'); }
    finally { processingRef.current = false; if (isCurrentSession()) setProcessing(null); input.value = ''; }
  };
  const handleSave = async () => {
    if (savingRef.current || !isCurrentSession()) return;
    if (processingRef.current) return showToast('图片还在处理中，请稍候再保存。', 'info');
    if (!form.nickname.trim()) return showToast('请填写昵称', 'error');
    const contactChanged = form.contactType !== (user.contactType || 'wechat') || form.contactValue !== (user.contactValue || '');
    if (contactChanged || form.contactValue.trim()) {
      const error = validateContactValue(form.contactType, form.contactValue);
      if (error) return showToast(error, 'error');
    }
    savingRef.current = true; setSaving(true); setSaveError('');
    try {
      const { contactType, contactValue, ...publicFields } = form;
      const updated = await api.updateProfile({ ...publicFields, nickname: form.nickname.trim(), statusText: form.statusText.trim(),
        ...(contactChanged || contactValue.trim() ? { contactType, contactValue: contactValue.trim() } : {}) });
      if (!isCurrentSession()) return;
      const newUserData = { ...user, ...updated };
      try { localStorage.setItem('currentUser', JSON.stringify(newUserData)); } catch { /* The server has saved the profile; session state still updates. */ }
      onUpdate(newUserData); onClose(); showToast('资料已更新', 'success');
    } catch (error) {
      if (!isCurrentSession()) return;
      const message = friendlyErrorMessage(error, '保存失败。你的修改仍在这里，可以重试。');
      setSaveError(message); showToast(message, 'error');
    } finally { savingRef.current = false; if (isCurrentSession()) setSaving(false); }
  };
  const busy = saving || !!processing;
  return <ModalShell onClose={() => { if (!savingRef.current) onClose(); }} closeOnBackdrop={false} label="编辑资料" className="profile-editor-modal fixed inset-0 z-[90] flex flex-col">
    <header className="profile-editor-header pt-safe-top"><button type="button" onClick={onClose} disabled={saving}>取消</button><div><strong>编辑你的名片</strong><span>让别人看见你的生活方式</span></div><button type="button" className="profile-editor-save" onClick={handleSave} disabled={busy}>{processing ? '图片处理中…' : saving ? '保存中...' : '保存资料'}</button></header>
    <div className="profile-editor-scroll"><div className="profile-editor-layout">
      <aside className="profile-editor-preview"><p className="profile-editor-eyebrow"><Globe2 size={14} />别人看到的名片</p><ProfileIdentity profile={{ ...user, ...form }} preview /><p className="profile-preview-note">预览随编辑更新，保存后才会公开。</p></aside>
      <fieldset disabled={saving} className="profile-editor-fields">
        {saveError && <p role="alert" className="profile-editor-error">{saveError}</p>}
        <section className="profile-editor-section"><div className="profile-section-heading"><Palette size={19} /><div><h2>你的视觉风格</h2><p>选一种颜色，再加上自己的照片。</p></div></div>
          <fieldset disabled={busy}><legend>名片主题</legend><div className="profile-theme-options">{PROFILE_THEMES.map(theme => <button key={theme.id} type="button" aria-pressed={form.profileTheme === theme.id} onClick={() => setForm(p => ({ ...p, profileTheme: theme.id }))} className={`profile-theme-option profile-theme-${theme.id}`}><span className="profile-theme-swatch">{form.profileTheme === theme.id && <Check size={18} />}</span><strong>{theme.title}</strong><small>{theme.description}</small></button>)}</div></fieldset>
          <div className="profile-image-controls">{(['avatar', 'coverImage'] as const).map(kind => <div key={kind}><label className="profile-upload-control">{processing === kind ? <Loader2 size={17} className="animate-spin" /> : kind === 'avatar' ? <Camera size={17} /> : <ImagePlus size={17} />}<span>{kind === 'avatar' ? '上传头像' : '上传封面'}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" aria-label={kind === 'avatar' ? '上传头像' : '上传封面'} disabled={busy} onChange={event => void handleImageUpload(event, kind)} /></label>{form[kind] && <button type="button" className="profile-image-remove" disabled={busy} onClick={() => setForm(p => ({ ...p, [kind]: '' }))}><Trash2 size={12} />{kind === 'avatar' ? '移除头像' : '移除封面'}</button>}</div>)}</div>
          <p className="profile-field-hint">照片不超过 10MB；封面建议用横图，主体放在中央。图片会自动缩小后上传。</p>{processing && <p role="status" className="profile-field-hint">正在处理照片，请稍候再保存。</p>}
        </section>
        <section className="profile-editor-section"><div className="profile-section-heading"><Globe2 size={19} /><div><h2>公开介绍</h2><p>这些内容会显示在你的名片上。</p></div></div>
          <div className="profile-editor-field"><label htmlFor="profile-nickname">昵称</label><input id="profile-nickname" maxLength={30} value={form.nickname} onChange={event => setForm(p => ({ ...p, nickname: event.target.value }))} /></div>
          <div className="profile-editor-field"><label htmlFor="profile-status">此刻的生活状态</label><input id="profile-status" maxLength={60} placeholder="最近在找一起徒步的朋友…" value={form.statusText} onChange={event => setForm(p => ({ ...p, statusText: event.target.value }))} /><div className="profile-field-meta"><span>一句近况，也可以是一个聊天话题。</span><span>{form.statusText.length}/60</span></div></div>
          <div className="profile-editor-field"><label htmlFor="profile-bio">一句话介绍</label><textarea id="profile-bio" maxLength={200} rows={3} placeholder="例如：住在半岛，喜欢咖啡、摄影和周末海边散步。" value={form.bio} onChange={event => setForm(p => ({ ...p, bio: event.target.value }))} /><small>{form.bio.length}/200</small></div>
          <div className="profile-field-grid"><div className="profile-editor-field"><label htmlFor="profile-area">所在区域</label><select id="profile-area" value={form.area} onChange={event => setForm(p => ({ ...p, area: event.target.value }))}><option value="">选择大区</option>{REGIONS.map(region => <option key={region} value={region}>{region}</option>)}</select></div><div className="profile-editor-field"><label htmlFor="profile-city">所在城市</label><input id="profile-city" maxLength={60} placeholder="如 Millbrae" value={form.city} onChange={event => setForm(p => ({ ...p, city: event.target.value }))} /></div></div>
          <ProfileTagField label="身份标签" hint="选择最能代表你身份的标签，最多 8 个" presets={PROFILE_TAG_PRESETS} tags={form.profileTags} max={8} onChange={profileTags => setForm(p => ({ ...p, profileTags }))} showToast={showToast} />
          <ProfileTagField label="兴趣标签" hint="分享你的兴趣，方便附近用户认识你，最多 12 个" presets={INTEREST_PRESETS} tags={form.interests} max={12} onChange={interests => setForm(p => ({ ...p, interests }))} showToast={showToast} />
        </section>
        <section className="profile-editor-section"><div className="profile-section-heading"><Globe2 size={19} /><div><h2>公开社交链接</h2><p>愿意分享的主页，让同好更容易找到你。</p></div></div>
          <div className="profile-editor-field"><label htmlFor="profile-instagram">Instagram</label><input id="profile-instagram" placeholder="用户名或完整链接" value={form.socialLinks.instagram} onChange={event => setForm(p => ({ ...p, socialLinks: { ...p.socialLinks, instagram: event.target.value } }))} /></div>
          <div className="profile-editor-field"><label htmlFor="profile-linkedin">LinkedIn</label><input id="profile-linkedin" placeholder="https://www.linkedin.com/in/..." value={form.socialLinks.linkedin} onChange={event => setForm(p => ({ ...p, socialLinks: { ...p.socialLinks, linkedin: event.target.value } }))} /></div>
          <div className="profile-field-grid"><div className="profile-editor-field"><label htmlFor="profile-xhs">小红书</label><input id="profile-xhs" placeholder="主页链接或 ID" value={form.xiaohongshu} onChange={event => setForm(p => ({ ...p, xiaohongshu: event.target.value }))} /></div><div className="profile-editor-field"><label htmlFor="profile-website">个人网站</label><input id="profile-website" placeholder="https://..." value={form.website} onChange={event => setForm(p => ({ ...p, website: event.target.value }))} /></div></div>
        </section>
        <section className="profile-editor-section profile-editor-private" aria-label="私人账号设置"><div className="profile-section-heading"><LockKeyhole size={19} /><div><h2>私人账号设置</h2><p>以下信息不会出现在公开名片上。</p></div></div>
          <div className="profile-phone-verification"><Smartphone size={21} /><div><strong>手机号验证</strong><p>{getPhoneVerificationTrustLabel(user.isPhoneVerified)}</p></div>{!user.isPhoneVerified ? <button type="button" onClick={() => setShowVerify(true)}>验证手机号</button> : <span><Check size={14} />已验证</span>}</div>
          <div className="profile-editor-field"><label htmlFor="profile-contact-type">账号联系方式类型</label><select id="profile-contact-type" value={form.contactType} onChange={event => setForm(p => ({ ...p, contactType: event.target.value as UserData['contactType'] }))}><option value="wechat">微信</option><option value="phone">电话</option><option value="email">邮箱</option></select></div>
          <div className="profile-editor-field"><label htmlFor="profile-contact-value">{form.contactType === 'phone' ? '电话号码' : form.contactType === 'email' ? '联系邮箱' : '微信号'}</label><input id="profile-contact-value" type={form.contactType === 'phone' ? 'tel' : form.contactType === 'email' ? 'email' : 'text'} value={form.contactValue} onChange={event => setForm(p => ({ ...p, contactValue: event.target.value }))} /></div>
          <p className="profile-field-hint">不会显示在公开资料中。分享账号联系方式时使用；每条帖子的联系方式可在发帖时单独设置。</p>
        </section>
      </fieldset>
    </div></div>
    {showVerify && <PhoneVerificationModal user={user} onClose={() => setShowVerify(false)} onVerified={onUpdate} showToast={showToast} />}
  </ModalShell>;
};
