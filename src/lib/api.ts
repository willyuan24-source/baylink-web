// 共享 API client：全站唯一的请求入口（含鉴权头、401 会话过期广播、错误规范化）
import { friendlyErrorMessage } from './format';
import type { UserData } from './types';
import { getStoredUser } from './session';
export { getStoredUser } from './session';

// 开发默认仅连接本地服务；Vercel 构建默认连接线上 API。
export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL
  || (import.meta.env?.DEV ? 'http://localhost:3000/api' : 'https://baylink-api.onrender.com/api')).replace(/\/$/, '');
export const SOCKET_URL = import.meta.env?.VITE_SOCKET_URL || new URL(API_BASE_URL, typeof window === 'undefined' ? 'https://www.baylink.us' : window.location.origin).origin;

export const triggerSessionExpired = () => { window.dispatchEvent(new Event('session-expired')); };
export const safeParse = (str: string | null) => { try { return str ? JSON.parse(str) : null; } catch { return null; } };

/** 从 localStorage 读当前登录用户（带 token）。 */

/** 构造带鉴权的请求头；给少数不走 api.request 的调用（如 AI 面板的宽松错误语义）复用。 */
export const authHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const user = getStoredUser();
  if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;
  return headers;
};

export const api = {
  request: async (endpoint: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const user = getStoredUser();
    if (user?.token) headers.set('Authorization', `Bearer ${user.token}`);
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) controller.abort();
    const timer = setTimeout(abort, 45000);
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers, signal: controller.signal });
      let data: any = {};
      const text = await res.text();
      try { data = text ? JSON.parse(text) : {}; } catch { throw { status: res.status >= 400 ? res.status : 502, error: '服务返回了无效数据，请稍后重试。' }; }
      if (res.status === 401) {
        const isPublicAuth = endpoint.includes('/auth/login')
          || endpoint.includes('/auth/forgot-password')
          || endpoint.includes('/auth/reset-password');
        if (!isPublicAuth && user?.token && getStoredUser()?.token === user.token) {
          triggerSessionExpired();
          throw { status: res.status, message: '登录已过期', handled: true };
        }
      }
      if (!res.ok) {
        const err: any = { ...data, status: res.status };
        if (typeof data.status === 'string') err.requestStatus = data.status;
        throw err;
      }
      return data;
    } catch (err: any) {
      if (controller.signal.aborted) throw { error: '请求已中断或超时。若刚提交了信息，请先刷新确认结果，再决定是否重新提交。' };
      if (err?.handled) throw err;
      if (err?.status === 401 || err?.status === 403) throw err;
      if (err?.error || err?.status) throw err;
      throw { error: friendlyErrorMessage(err, '网络连接异常，请稍后再试。') };
    } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
  },
  getUserProfile: async (userId: string) => await api.request(`/users/${userId}`),
  getUserPublicProfile: async (userId: string) => await api.request(`/users/${userId}/public`),
  updateProfile: async (data: Partial<UserData>) => await api.request('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  submitReport: async (body: { targetType: 'post' | 'user'; targetId: string; reason: string; detail?: string }) =>
    await api.request('/reports', { method: 'POST', body: JSON.stringify(body) }),
  blockUser: async (userId: string) =>
    await api.request(`/users/${userId}/block`, { method: 'POST', body: JSON.stringify({}) }),
  unblockUser: async (userId: string) =>
    await api.request(`/users/${userId}/block`, { method: 'DELETE' }),
  getMyBlocks: async () => await api.request('/users/me/blocks'),
  getAdminReports: async (status = 'open', type = 'all') =>
    await api.request(`/admin/reports?status=${encodeURIComponent(status)}&type=${encodeURIComponent(type)}`),
  updateAdminReport: async (id: string, payload: { status: 'open' | 'reviewed' | 'dismissed'; adminNote?: string }) =>
    await api.request(`/admin/reports/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  hideAdminPost: async (postId: string, reason?: string) =>
    await api.request(`/admin/posts/${postId}/hide`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  unhideAdminPost: async (postId: string) =>
    await api.request(`/admin/posts/${postId}/unhide`, { method: 'PATCH', body: JSON.stringify({}) }),
  updateAdminAccountStatus: async (userId: string, payload: { status: 'active' | 'limited' | 'suspended'; reason?: string }) =>
    await api.request(`/admin/users/${userId}/account-status`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getModerationLogs: async (limit = 50) =>
    await api.request(`/admin/moderation-logs?limit=${limit}`),
  startPhoneVerification: async (phone: string) =>
    await api.request('/users/me/phone/start', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyPhoneCode: async (code: string) =>
    await api.request('/users/me/phone/verify', { method: 'POST', body: JSON.stringify({ code }) }),
  forgotPassword: async (email: string) =>
    await api.request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: async (token: string, newPassword: string) =>
    await api.request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
  submitOfficialVerification: async (payload: Record<string, string | undefined>) =>
    await api.request('/users/me/official-verification', { method: 'POST', body: JSON.stringify(payload) }),
  getOfficialVerificationRequests: async (status = 'pending') =>
    await api.request(`/admin/official-verifications?status=${encodeURIComponent(status)}`),
  reviewOfficialVerification: async (userId: string, payload: { status: 'approved' | 'rejected'; rejectionReason?: string }) =>
    await api.request(`/admin/users/${userId}/official-verification`, { method: 'PATCH', body: JSON.stringify(payload) }),
  requestPostContact: async (postId: string, requestMessage?: string) =>
    await api.request(`/posts/${postId}/contact-requests`, { method: 'POST', body: JSON.stringify({ requestMessage: requestMessage || '' }) }),
  getContactRequests: async (role: 'owner' | 'requester', status?: string) => {
    const statusQ = status ? `&status=${encodeURIComponent(status)}` : '';
    return api.request(`/contact-requests?role=${encodeURIComponent(role)}${statusQ}`);
  },
  approveContactRequest: async (requestId: string) =>
    await api.request(`/contact-requests/${requestId}/approve`, { method: 'PATCH', body: JSON.stringify({}) }),
  declineContactRequest: async (requestId: string) =>
    await api.request(`/contact-requests/${requestId}/decline`, { method: 'PATCH', body: JSON.stringify({}) }),
  togglePostLike: async (postId: string) =>
    await api.request(`/posts/${postId}/like`, { method: 'POST', body: JSON.stringify({}) }),
};
