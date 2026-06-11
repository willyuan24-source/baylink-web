import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

export type ReportReason =
  | 'spam'
  | 'scam'
  | 'harassment'
  | 'illegal'
  | 'misleading'
  | 'duplicate'
  | 'other';

export const REPORT_REASON_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: '垃圾广告' },
  { value: 'scam', label: '诈骗 / 可疑交易' },
  { value: 'harassment', label: '骚扰 / 不友善' },
  { value: 'illegal', label: '违法 / 危险内容' },
  { value: 'misleading', label: '虚假 / 误导信息' },
  { value: 'duplicate', label: '重复内容' },
  { value: 'other', label: '其他' },
];

type ReportModalProps = {
  targetType: 'post' | 'user';
  targetId: string;
  onClose: () => void;
  onSubmit: (reason: ReportReason, detail: string) => Promise<void>;
};

export const ReportModal = ({ targetType, targetId, onClose, onSubmit }: ReportModalProps) => {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(reason, detail.trim());
      onClose();
    } catch (err: any) {
      setError(err?.error || err?.message || '举报提交失败，请稍后再试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 px-4 pb-24 pt-6 backdrop-blur-sm sm:items-center sm:pb-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-baylink-border/40 px-4 py-3">
          <h3 className="text-base font-bold text-baylink-text">
            {targetType === 'user' ? '举报用户' : '举报帖子'}
          </h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-baylink-muted hover:bg-baylink-section">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 py-4">
          <p className="mb-3 text-sm text-baylink-text-secondary">
            {targetType === 'user'
              ? '请选择举报该用户的原因，管理员会尽快查看。'
              : '请选择举报该帖子的原因，管理员会尽快查看。'}
          </p>
          <div className="space-y-2">
            {REPORT_REASON_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition ${
                  reason === opt.value
                    ? 'border-baylink-green/50 bg-baylink-green/5 text-baylink-text'
                    : 'border-baylink-border/50 text-baylink-text-secondary hover:border-baylink-border'
                }`}
              >
                <input
                  type="radio"
                  name={`report-${targetId}`}
                  value={opt.value}
                  checked={reason === opt.value}
                  onChange={() => setReason(opt.value)}
                  className="accent-baylink-green"
                />
                <span className="font-medium">{opt.label}</span>
              </label>
            ))}
          </div>
          <textarea
            className="mt-3 w-full resize-none rounded-xl border border-baylink-border/50 bg-baylink-section/30 px-3 py-2.5 text-sm outline-none focus:border-baylink-green/40 focus:ring-1 focus:ring-baylink-green/20"
            rows={3}
            maxLength={500}
            placeholder="补充说明（可选）"
            value={detail}
            onChange={(e) => setDetail(e.target.value.slice(0, 500))}
          />
          <p className="mt-1 text-right text-[10px] text-baylink-muted">{detail.length}/500</p>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 border-t border-baylink-border/40 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-baylink-border/60 py-2.5 text-sm font-semibold text-baylink-text-secondary"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!reason || submitting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-baylink-green py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            提交举报
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
