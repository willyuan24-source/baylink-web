import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';
import { friendlyErrorMessage } from '../lib/format';
import './site-dialogs.css';
import { useUiCopy } from './ui/ui-copy';

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
  targetType: 'post' | 'user' | 'message';
  targetId: string;
  conversationId?: string;
  onClose: () => void;
  onSubmit: (reason: ReportReason, detail: string) => Promise<void>;
};

/** Report a post, a user or one message (RC-24: on the WEB-UI Sheet; a stray tap outside keeps what was typed). */
export const ReportModal = ({ targetType, targetId, onClose, onSubmit }: ReportModalProps) => {
  const label = targetType === 'message' ? '举报私信' : targetType === 'user' ? '举报用户' : '举报帖子';
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { t } = useUiCopy();

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(reason, detail.trim());
      onClose();
    } catch (err) {
      setError(friendlyErrorMessage(err, '举报提交失败，请稍后再试'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={label} closeOnBackdrop={false} footer={<>
      <Button variant="secondary" onClick={onClose}>取消</Button>
      <Button variant="primary" onClick={handleSubmit} disabled={!reason || submitting} icon={submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : undefined}>提交举报</Button>
    </>}>
      <p className="site-dialog-intro">
        {targetType === 'message' ? '选中消息交由管理员审核；不会上传整段会话或联系方式卡。' : targetType === 'user'
          ? '请选择举报该用户的原因，管理员会尽快查看。'
          : '请选择举报该帖子的原因，管理员会尽快查看。'}
      </p>
      <fieldset className="site-dialog-choices">
        <legend>{t('举报原因', 'Reason')}</legend>
        {REPORT_REASON_OPTIONS.map((opt) => (
          <label key={opt.value} className="site-dialog-choice">
            <input type="radio" name={`report-${targetId}`} value={opt.value} checked={reason === opt.value} onChange={() => setReason(opt.value)} />
            <span>{opt.label}</span>
          </label>
        ))}
      </fieldset>
      <label className="site-dialog-label" htmlFor={`report-detail-${targetId}`}>补充说明（可选）</label>
      <textarea
        id={`report-detail-${targetId}`}
        className="site-dialog-field"
        rows={3}
        maxLength={500}
        placeholder="补充说明（可选）"
        value={detail}
        onChange={(e) => setDetail(e.target.value.slice(0, 500))}
      />
      <p className="site-dialog-count">{detail.length}/500</p>
      {error && <p role="alert" className="site-dialog-error">{error}</p>}
    </Sheet>
  );
};

export default ReportModal;
