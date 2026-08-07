// 管理员视图：官方认证审核 + 举报管理（含账号状态调整 / 操作日志）
import { useState, useEffect } from 'react';
import { ChevronLeft, Loader2, AlertTriangle, X } from 'lucide-react';
import { ModalShell } from '../../components/ui/Modal';
import { confirmDialog, promptDialog } from '../../components/ui/confirm';
import { api } from '../../lib/api';
import Avatar from '../../components/Avatar';
import {
  ACCOUNT_STATUS_LABELS, MODERATION_ACTION_LABELS, MODERATION_TARGET_TYPE_LABELS, REPORT_REASON_LABELS,
} from '../../lib/constants';
import { friendlyErrorMessage, getOfficialTypeLabel, getPhoneVerificationTrustLabel } from '../../lib/format';

type ModerationLogItem = {
  id: string;
  admin: { id: string; nickname: string };
  action: string;
  targetType: string;
  targetId: string;
  targetUserId?: string;
  targetPostId?: string;
  targetReportId?: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  note?: string;
  createdAt: number;
};

type AdminReportItem = {
  id: string;
  reporter: { id: string; nickname: string; avatar?: string; isPhoneVerified?: boolean; isOfficialVerified?: boolean; accountStatus?: string } | null;
  targetType: 'post' | 'user';
  targetId: string;
  reason: string;
  detail: string;
  status: string;
  adminNote?: string;
  createdAt: number;
  reviewedAt?: number | null;
  targetUser: {
    id: string;
    nickname: string;
    avatar?: string;
    isPhoneVerified?: boolean;
    isOfficialVerified?: boolean;
    accountStatus?: string;
    accountStatusReason?: string;
    accountStatusUpdatedAt?: number | null;
    accountStatusUpdatedBy?: string;
  } | null;
  targetPost: { id: string; title: string; category?: string; area?: string; createdAt?: number; adminHidden?: boolean } | null;
};

type OfficialVerificationRequestItem = {
  id: string;
  userId?: string;
  nickname: string;
  avatar?: string;
  isPhoneVerified?: boolean;
  phoneVerifiedAt?: number | null;
  isOfficialVerified?: boolean;
  officialVerification: {
    status: string;
    type?: string;
    description?: string;
    website?: string;
    license?: string;
    socialLink?: string;
    submittedAt?: number;
    reviewedAt?: number | null;
    rejectionReason?: string;
  };
};

const getOfficialRequestUserId = (r: OfficialVerificationRequestItem) => r.id || r.userId || '';

export const AdminOfficialVerificationsView = ({ onBack, showToast }: { onBack: () => void; showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) => {
  const [requests, setRequests] = useState<OfficialVerificationRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getOfficialVerificationRequests('pending');
      setRequests(Array.isArray(res.requests) ? res.requests : []);
    } catch (e: any) {
      showToast(e?.error || '加载认证申请失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (userId: string) => {
    if (!(await confirmDialog({ title: '通过认证', message: '确认通过该用户的官方认证？', confirmText: '通过' }))) return;
    setUpdatingId(userId);
    try {
      await api.reviewOfficialVerification(userId, { status: 'approved' });
      setRequests((prev) => prev.filter((r) => getOfficialRequestUserId(r) !== userId));
      showToast('已通过官方认证', 'success');
    } catch (e: any) {
      showToast(friendlyErrorMessage(e, '操作失败，请稍后再试'), 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReject = async (userId: string) => {
    if (!(await confirmDialog({ title: '拒绝认证', message: '确认拒绝该认证申请？', confirmText: '拒绝', danger: true }))) return;
    setUpdatingId(userId);
    try {
      await api.reviewOfficialVerification(userId, {
        status: 'rejected',
        rejectionReason: rejectReason.trim() || '资料不足，请补充官网或 license 信息。',
      });
      setRequests((prev) => prev.filter((r) => getOfficialRequestUserId(r) !== userId));
      setRejectingId(null);
      setRejectReason('');
      showToast('已拒绝认证申请', 'success');
    } catch (e: any) {
      showToast(friendlyErrorMessage(e, '操作失败，请稍后再试'), 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-[#FAFAFA]">
      <div className="flex items-center gap-3 border-b border-baylink-border/40 bg-white px-4 py-3 pt-safe-top">
        <button type="button" onClick={onBack} className="rounded-full p-2 hover:bg-baylink-section"><ChevronLeft size={20} /></button>
        <h2 className="text-lg font-bold text-baylink-text">官方认证审核</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {loading ? (
          <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-baylink-green" /></div>
        ) : requests.length === 0 ? (
          <p className="py-16 text-center text-sm text-baylink-muted">当前没有待审核的认证申请</p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => {
              const requestUserId = getOfficialRequestUserId(r);
              const phoneVerified = r.isPhoneVerified === true;
              return (
              <div key={requestUserId} className="rounded-2xl border border-baylink-border/50 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <Avatar src={r.avatar} name={r.nickname} size={10} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-baylink-text">{r.nickname}</div>
                    <div className="mt-1 text-xs text-baylink-text-secondary">
                      认证类型：{getOfficialTypeLabel(r.officialVerification?.type) || '—'}
                    </div>
                    <div className="mt-0.5 text-[11px] text-baylink-muted">
                      {getPhoneVerificationTrustLabel(phoneVerified)}
                      {phoneVerified && r.phoneVerifiedAt ? (
                        <span className="ml-1">· {new Date(r.phoneVerifiedAt).toLocaleDateString()}</span>
                      ) : null}
                    </div>
                    {r.officialVerification?.submittedAt && (
                      <div className="text-[10px] text-baylink-muted">申请时间：{new Date(r.officialVerification.submittedAt).toLocaleString()}</div>
                    )}
                  </div>
                </div>
                {!phoneVerified && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                    <span>该用户尚未完成手机验证，建议谨慎审核；你仍然可以通过或拒绝该认证申请。</span>
                  </div>
                )}
                {r.officialVerification?.description && (
                  <p className="mt-3 text-xs leading-relaxed text-baylink-text-secondary">{r.officialVerification.description}</p>
                )}
                <div className="mt-2 space-y-1 text-[11px] text-baylink-muted">
                  {r.officialVerification?.website && <p>网站：{r.officialVerification.website}</p>}
                  {r.officialVerification?.license && <p>资质：{r.officialVerification.license}</p>}
                  {r.officialVerification?.socialLink && <p>社交：{r.officialVerification.socialLink}</p>}
                </div>
                {rejectingId === requestUserId ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      className="w-full rounded-xl border border-baylink-border/50 p-2 text-xs outline-none"
                      placeholder="拒绝原因（可选）"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button type="button" disabled={updatingId === requestUserId} onClick={() => handleReject(requestUserId)} className="flex-1 rounded-lg bg-red-500 py-2 text-xs font-bold text-white disabled:opacity-50">确认拒绝</button>
                      <button type="button" onClick={() => { setRejectingId(null); setRejectReason(''); }} className="rounded-lg border border-baylink-border/60 px-3 py-2 text-xs font-semibold">取消</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button type="button" disabled={updatingId === requestUserId} onClick={() => handleApprove(requestUserId)} className="flex-1 rounded-lg bg-baylink-green py-2 text-xs font-bold text-white disabled:opacity-50">通过</button>
                    <button type="button" disabled={updatingId === requestUserId} onClick={() => setRejectingId(requestUserId)} className="flex-1 rounded-lg border border-baylink-border/60 py-2 text-xs font-semibold text-baylink-text-secondary disabled:opacity-50">拒绝</button>
                  </div>
                )}
              </div>
            );})}
          </div>
        )}
      </div>
    </div>
  );
};

export const AdminReportsView = ({ onBack, showToast }: { onBack: () => void; showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) => {
  const [reports, setReports] = useState<AdminReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'open' | 'reviewed' | 'dismissed' | 'all'>('open');
  const [typeFilter, setTypeFilter] = useState<'all' | 'post' | 'user'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<{ userId: string; nickname: string; status: 'active' | 'limited' | 'suspended' } | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logs, setLogs] = useState<ModerationLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminReports(statusFilter, typeFilter);
      setReports(Array.isArray(res.reports) ? res.reports : []);
    } catch (e: any) {
      showToast(e?.error || '加载举报列表失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter, typeFilter]);

  const handleStatus = async (id: string, status: 'open' | 'reviewed' | 'dismissed') => {
    setUpdatingId(id);
    try {
      await api.updateAdminReport(id, { status });
      await load();
      showToast(
        status === 'reviewed' ? '已标记为已处理' : status === 'dismissed' ? '已忽略' : '已重新打开',
        'success',
      );
    } catch (e: any) {
      showToast(friendlyErrorMessage(e, '操作失败，请稍后再试'), 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleHidePost = async (postId: string, hidden: boolean) => {
    setUpdatingId(postId);
    try {
      if (hidden) {
        await api.unhideAdminPost(postId);
        showToast('帖子已恢复公开', 'success');
      } else {
        const reason = await promptDialog({
          title: '隐藏帖子',
          message: '帖子将从公开列表移除（不会删除数据）。可填写隐藏原因：',
          confirmText: '隐藏',
          danger: true,
          input: { placeholder: '隐藏原因（可选）', defaultValue: '疑似违规，等待进一步核实' },
        });
        // 取消即中止（旧版 prompt 取消会以默认原因照样隐藏，属旧 bug，这里保留新语义但给出明确反馈）
        if (reason === null) { showToast('已取消，帖子未隐藏', 'info'); return; }
        await api.hideAdminPost(postId, reason || '管理员隐藏');
        showToast('帖子已从公开列表隐藏', 'success');
      }
      await load();
    } catch (e: any) {
      showToast(friendlyErrorMessage(e, '操作失败，请稍后再试'), 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const statusLabel = (s: string) => {
    if (s === 'open') return '待处理';
    if (s === 'reviewed') return '已处理';
    if (s === 'dismissed') return '已忽略';
    return s;
  };

  const accountStatusActionLabel = (s: 'active' | 'limited' | 'suspended') => {
    if (s === 'limited') return '限制';
    if (s === 'suspended') return '暂停';
    return '恢复正常';
  };

  const openStatusModal = (userId: string, nickname: string, status: 'active' | 'limited' | 'suspended') => {
    setStatusModal({ userId, nickname, status });
    setStatusReason('');
  };

  const handleAccountStatusUpdate = async () => {
    if (!statusModal) return;
    setUpdatingId(statusModal.userId);
    try {
      await api.updateAdminAccountStatus(statusModal.userId, {
        status: statusModal.status,
        reason: statusReason.trim() || undefined,
      });
      showToast(`已将 ${statusModal.nickname} 设为${ACCOUNT_STATUS_LABELS[statusModal.status]}`, 'success');
      setStatusModal(null);
      setStatusReason('');
      await load();
    } catch (e: any) {
      showToast(friendlyErrorMessage(e, '更新账号状态失败'), 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const openLogsModal = async () => {
    setShowLogsModal(true);
    setLogsLoading(true);
    try {
      const res = await api.getModerationLogs(50);
      setLogs(Array.isArray(res.logs) ? res.logs : []);
    } catch (e: any) {
      showToast(e?.error || '加载操作日志失败', 'error');
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-[#FAFAFA]">
      <div className="flex items-center gap-3 border-b border-baylink-border/40 bg-white px-4 py-3 pt-safe-top">
        <button type="button" onClick={onBack} className="rounded-full p-2 hover:bg-baylink-section"><ChevronLeft size={20} /></button>
        <h2 className="flex-1 text-lg font-bold text-baylink-text">举报管理</h2>
        <button type="button" onClick={openLogsModal} className="rounded-lg border border-baylink-border/50 px-3 py-1.5 text-[11px] font-semibold text-baylink-text-secondary hover:bg-baylink-section">
          管理员操作日志
        </button>
      </div>
      <div className="border-b border-baylink-border/40 bg-white px-4 py-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          {(['open', 'reviewed', 'dismissed', 'all'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusFilter === s ? 'bg-baylink-green text-white' : 'bg-baylink-section text-baylink-muted'}`}>
              {s === 'all' ? '全部状态' : statusLabel(s)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'post', 'user'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTypeFilter(t)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${typeFilter === t ? 'bg-gray-900 text-white' : 'bg-baylink-section text-baylink-muted'}`}>
              {t === 'all' ? '全部类型' : t === 'post' ? '帖子' : '用户'}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-amber-700">隐藏帖子只会从公开列表移除，不会删除数据。</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {loading ? (
          <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-baylink-green" /></div>
        ) : reports.length === 0 ? (
          <p className="py-16 text-center text-sm text-baylink-muted">当前没有符合条件的举报</p>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => {
              const postId = r.targetPost?.id || (r.targetType === 'post' ? r.targetId : '');
              const postHidden = !!r.targetPost?.adminHidden;
              return (
              <div key={r.id} className="rounded-2xl border border-baylink-border/50 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-baylink-muted">{new Date(r.createdAt).toLocaleString()}</div>
                    <div className="mt-1 text-sm font-semibold text-baylink-text">
                      {REPORT_REASON_LABELS[r.reason] || r.reason}
                      <span className="ml-2 text-xs font-normal text-baylink-muted">
                        · {r.targetType === 'post' ? '帖子举报' : '用户举报'}
                      </span>
                    </div>
                    {r.detail && <p className="mt-1 text-xs text-baylink-text-secondary line-clamp-4">{r.detail}</p>}
                    {r.reporter && (
                      <p className="mt-2 text-[11px] text-baylink-muted">
                        举报人：{r.reporter.nickname}
                        {r.reporter.isPhoneVerified ? ' · 手机已验证' : ' · 手机未验证'}
                        {r.reporter.accountStatus && r.reporter.accountStatus !== 'active' ? ` · 账号${ACCOUNT_STATUS_LABELS[r.reporter.accountStatus] || r.reporter.accountStatus}` : ''}
                      </p>
                    )}
                    {r.targetUser && (
                      <div className="mt-2 rounded-xl border border-baylink-border/40 bg-baylink-section/30 px-3 py-2 text-[11px]">
                        <p className="font-semibold text-baylink-text">{r.targetType === 'user' ? '被举报用户' : '帖子作者'}：{r.targetUser.nickname}</p>
                        <p className="mt-0.5 text-baylink-muted">账号状态：{ACCOUNT_STATUS_LABELS[r.targetUser.accountStatus || 'active'] || r.targetUser.accountStatus}</p>
                        {r.targetUser.accountStatusReason && (
                          <p className="mt-1 text-baylink-text-secondary line-clamp-2">限制原因：{r.targetUser.accountStatusReason}</p>
                        )}
                      </div>
                    )}
                    {r.targetType === 'post' && r.targetPost && (
                      <div className="mt-2 rounded-xl bg-baylink-section/40 px-3 py-2 text-[11px] text-baylink-text-secondary">
                        <p className="font-semibold text-baylink-text line-clamp-2">{r.targetPost.title}</p>
                        <p className="mt-0.5">{r.targetPost.category}{r.targetPost.area ? ` · ${r.targetPost.area}` : ''}</p>
                        {postHidden && <p className="mt-1 text-amber-700 font-semibold">已从公开列表隐藏</p>}
                      </div>
                    )}
                    {r.targetType === 'post' && !r.targetPost && (
                      <p className="mt-1 text-[11px] text-baylink-muted">关联帖子已不存在</p>
                    )}
                    {r.adminNote && <p className="mt-1 text-[10px] text-baylink-muted">管理员备注：{r.adminNote}</p>}
                  </div>
                  <span className="shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">{statusLabel(r.status)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.status === 'open' && (
                    <>
                      <button type="button" disabled={updatingId === r.id} onClick={() => handleStatus(r.id, 'reviewed')} className="flex-1 min-w-[120px] rounded-lg bg-baylink-green py-2 text-xs font-bold text-white disabled:opacity-50">标记已处理</button>
                      <button type="button" disabled={updatingId === r.id} onClick={() => handleStatus(r.id, 'dismissed')} className="flex-1 min-w-[120px] rounded-lg border border-baylink-border/60 py-2 text-xs font-semibold text-baylink-text-secondary disabled:opacity-50">忽略</button>
                    </>
                  )}
                  {(r.status === 'reviewed' || r.status === 'dismissed') && (
                    <button type="button" disabled={updatingId === r.id} onClick={() => handleStatus(r.id, 'open')} className="w-full rounded-lg border border-baylink-border/60 py-2 text-xs font-semibold text-baylink-text-secondary disabled:opacity-50">重新打开</button>
                  )}
                  {r.targetType === 'post' && postId && (
                    <button
                      type="button"
                      disabled={updatingId === postId}
                      onClick={() => handleHidePost(postId, postHidden)}
                      className="w-full rounded-lg border border-amber-200 bg-amber-50 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50"
                    >
                      {postHidden ? '恢复帖子公开' : '隐藏帖子'}
                    </button>
                  )}
                  {r.targetUser && (
                    <div className="flex w-full flex-wrap gap-2">
                      <button type="button" disabled={updatingId === r.targetUser!.id} onClick={() => openStatusModal(r.targetUser!.id, r.targetUser!.nickname, 'limited')} className="flex-1 min-w-[90px] rounded-lg border border-orange-200 bg-orange-50 py-2 text-xs font-semibold text-orange-800 disabled:opacity-50">限制账号</button>
                      <button type="button" disabled={updatingId === r.targetUser!.id} onClick={() => openStatusModal(r.targetUser!.id, r.targetUser!.nickname, 'suspended')} className="flex-1 min-w-[90px] rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">暂停账号</button>
                      <button type="button" disabled={updatingId === r.targetUser!.id} onClick={() => openStatusModal(r.targetUser!.id, r.targetUser!.nickname, 'active')} className="flex-1 min-w-[90px] rounded-lg border border-baylink-border/60 py-2 text-xs font-semibold text-baylink-text-secondary disabled:opacity-50">恢复正常</button>
                    </div>
                  )}
                </div>
              </div>
            );})}
          </div>
        )}
      </div>
      {statusModal && (
        <ModalShell onClose={() => setStatusModal(null)} label="调整账号状态" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-baylink-text">调整账号状态</h3>
            <p className="mt-2 text-sm text-baylink-text-secondary">
              你正在将 <span className="font-semibold text-baylink-text">{statusModal.nickname}</span> 的状态改为：
              <span className="font-semibold text-baylink-text"> {accountStatusActionLabel(statusModal.status)}</span>
            </p>
            <textarea
              className="mt-3 w-full resize-none rounded-xl border border-baylink-border/50 p-3 text-sm outline-none focus:border-baylink-green/40"
              rows={3}
              maxLength={300}
              placeholder="管理员备注 / 原因（可选）"
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value.slice(0, 300))}
            />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setStatusModal(null)} className="flex-1 rounded-xl border border-baylink-border/60 py-2.5 text-sm font-semibold text-baylink-text-secondary">取消</button>
              <button type="button" disabled={updatingId === statusModal.userId} onClick={handleAccountStatusUpdate} className="flex-1 rounded-xl bg-baylink-green py-2.5 text-sm font-bold text-white disabled:opacity-50">确认更新</button>
            </div>
          </div>
        </ModalShell>
      )}
      {showLogsModal && (
        <ModalShell onClose={() => setShowLogsModal(false)} label="管理员操作日志" className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-baylink-border/40 px-4 py-3">
              <h3 className="text-base font-bold text-baylink-text">管理员操作日志</h3>
              <button type="button" onClick={() => setShowLogsModal(false)} className="rounded-full p-2 hover:bg-baylink-section"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {logsLoading ? (
                <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-baylink-green" /></div>
              ) : logs.length === 0 ? (
                <p className="py-12 text-center text-sm text-baylink-muted">还没有管理员操作记录</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => {
                    const noteOrReason = log.reason?.trim() || log.note?.trim() || '';
                    return (
                      <div key={log.id} className="rounded-xl border border-baylink-border/40 bg-baylink-section/20 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-baylink-text">
                            {MODERATION_ACTION_LABELS[log.action] || log.action}
                          </p>
                          <span className="shrink-0 text-[10px] text-baylink-muted">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-baylink-text-secondary">
                          管理员：{log.admin?.nickname || 'Admin'}
                          {' · '}
                          目标：{MODERATION_TARGET_TYPE_LABELS[log.targetType] || log.targetType}
                        </p>
                        {noteOrReason && (
                          <p className="mt-1 text-[11px] text-baylink-muted line-clamp-3">
                            {log.reason?.trim() ? `原因：${log.reason}` : `备注：${log.note}`}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
};
