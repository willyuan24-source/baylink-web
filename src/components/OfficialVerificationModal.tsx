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

type OfficialVerificationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    type: OfficialVerificationType;
    description: string;
    website?: string;
    license?: string;
    socialLink?: string;
  }) => Promise<{ message: string; user: any }>;
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
        website: website.trim() || undefined,
        license: license.trim() || undefined,
        socialLink: socialLink.trim() || undefined,
      });
      onSuccess(res.user);
      showToast(res.message || '认证申请已提交，BAYLINK 会尽快审核。', 'success');
      onClose();
    } catch (err: any) {
      showToast(err?.error || err?.message || '提交失败，请稍后再试', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[24px] bg-[#FFF8F0] p-6 shadow-2xl">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-white hover:text-gray-900">
          <X size={18} />
        </button>
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <BadgeCheck size={24} />
          </div>
          <h3 className="text-xl font-black text-gray-900">申请官方认证</h3>
          <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
            官方认证适合房产经纪、本地服务商、商家、社区组织或 BAYLINK 认可的可信账号。提交后需要人工审核。
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-500">认证类型</label>
            <select
              className="w-full rounded-xl bg-white p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-amber-500/20"
              value={type}
              onChange={(e) => setType(e.target.value as OfficialVerificationType)}
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-500">认证说明 *</label>
            <textarea
              className="h-24 w-full resize-none rounded-xl bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
              placeholder="介绍你的身份、服务范围、资质或社区角色…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-500">Website</label>
            <input className="w-full rounded-xl bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/20" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-500">License / 资质编号</label>
            <input className="w-full rounded-xl bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/20" value={license} onChange={(e) => setLicense(e.target.value)} placeholder="如 DRE# xxxxx" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-500">Social link</label>
            <input className="w-full rounded-xl bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/20" value={socialLink} onChange={(e) => setSocialLink(e.target.value)} placeholder="LinkedIn / 小红书 / 其他链接" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gray-900 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-gray-800 disabled:opacity-60"
          >
            {loading ? <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" />提交中...</span> : '提交申请'}
          </button>
        </form>
      </div>
    </div>
  );
};
