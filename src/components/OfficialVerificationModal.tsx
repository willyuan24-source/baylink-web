import React, { useState } from 'react';
import { X, Loader2, BadgeCheck } from 'lucide-react';

export type OfficialVerificationType =
  | 'realtor'
  | 'service_provider'
  | 'business'
  | 'official_account'
  | 'community_org'
  | 'other';

const TYPE_OPTIONS: { value: OfficialVerificationType; label: string }[] = [
  { value: 'realtor', label: '房产经纪' },
  { value: 'service_provider', label: '本地服务商' },
  { value: 'business', label: '商家' },
  { value: 'official_account', label: '官方账号' },
  { value: 'community_org', label: '社区组织' },
  { value: 'other', label: '其他' },
];

const EMPTY_OPTIONAL_VALUES = new Set(['没有', '无', 'none', 'n/a', 'na', 'null', 'undefined']);

const normalizeOptionalField = (value: string): string | undefined => {
  const s = value.trim();
  if (!s) return undefined;
  const lower = s.toLowerCase();
  if (EMPTY_OPTIONAL_VALUES.has(lower) || EMPTY_OPTIONAL_VALUES.has(s)) return undefined;
  return s;
};

const fieldClass = 'w-full rounded-2xl border border-black/[0.06] bg-white/90 p-3 text-sm text-baylink-text outline-none focus:border-baylink-green/40 focus:ring-2 focus:ring-baylink-green/15';

type OfficialVerificationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    type: OfficialVerificationType;
    description: string;
    website?: string;
    license?: string;
    socialLink?: string;
  }) => Promise<{ success?: boolean; user: any; message?: string }>;
  onSuccess: (user: any) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
};

export const OfficialVerificationModal = ({
  isOpen,
  onClose,
  onSubmit,
  onSuccess,
  showToast,
}: OfficialVerificationModalProps) => {
  const [type, setType] = useState<OfficialVerificationType>('realtor');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [license, setLicense] = useState('');
  const [socialLink, setSocialLink] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      showToast('请填写认证说明', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await onSubmit({
        type,
        description: description.trim(),
        website: normalizeOptionalField(website),
        license: normalizeOptionalField(license),
        socialLink: normalizeOptionalField(socialLink),
      });
      if (!res?.user) throw { error: '提交失败，请稍后再试' };
      onSuccess(res.user);
      showToast(res.message || '认证申请已提交，BAYLINK 会尽快审核。', 'success');
      onClose();
    } catch (err: any) {
      const msg = String(err?.error || err?.message || '').trim();
      const fallback = '提交失败，请检查内容后重试';
      if (!msg || msg === 'undefined' || /failed to fetch|network error/i.test(msg)) {
        showToast(/failed to fetch|network error/i.test(msg) ? '网络连接异常，请稍后再试' : fallback, 'error');
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md">
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[28px] border border-black/[0.04] bg-baylink-bg-alt/95 p-6 shadow-elevated backdrop-blur-xl">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full border border-black/[0.06] bg-white/90 p-2 text-baylink-muted transition hover:text-baylink-text">
          <X size={18} />
        </button>
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-100">
            <BadgeCheck size={24} />
          </div>
          <h3 className="text-xl font-bold text-baylink-text">申请官方认证</h3>
          <p className="mt-2 text-[12px] leading-relaxed text-baylink-muted">
            官方认证适合房产经纪、本地服务商、商家、社区组织或 BAYLINK 认可的可信账号。提交后需要人工审核。
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-baylink-muted">认证类型</label>
            <select
              className={fieldClass}
              value={type}
              onChange={(e) => setType(e.target.value as OfficialVerificationType)}
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-baylink-muted">认证说明 *</label>
            <textarea
              className={`${fieldClass} h-24 resize-none`}
              placeholder="介绍你的身份、服务范围、资质或社区角色…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-baylink-muted">Website</label>
            <input className={fieldClass} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-baylink-muted">License / 资质编号</label>
            <input className={fieldClass} value={license} onChange={(e) => setLicense(e.target.value)} placeholder="如 DRE# xxxxx" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-baylink-muted">Social link</label>
            <input className={fieldClass} value={socialLink} onChange={(e) => setSocialLink(e.target.value)} placeholder="LinkedIn / 小红书 / 其他链接" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-baylink-green py-3.5 text-sm font-semibold text-white shadow-rest transition hover:bg-baylink-green-hover disabled:opacity-60"
          >
            {loading ? <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" />提交中...</span> : '提交申请'}
          </button>
        </form>
      </div>
    </div>
  );
};
