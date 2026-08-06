// 共享 API client：全站唯一的请求入口（含鉴权头、401 会话过期广播、错误规范化）
import { friendlyErrorMessage } from './format';
import type { UserData } from './types';

// 默认 Render 线上 API；仅本地跑后端时在 .env.local 设 VITE_API_BASE_URL=http://localhost:3000/api
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://baylink-api.onrender.com/api';
export const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://baylink-api.onrender.com';

export const triggerSessionExpired = () => { window.dispatchEvent(new Event('session-expired')); };
export const safeParse = (str: string | null) => { try { return str ? JSON.parse(str) : null; } catch { return null; } };

/** 从 localStorage 读当前登录用户（带 token）。 */
export const getStoredUser = (): (UserData & { token?: string }) | null => safeParse(localStorage.getItem('currentUser'));

/** 构造带鉴权的请求头；给少数不走 api.request 的调用（如 AI 面板的宽松错误语义）复用。 */
export const authHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const user = getStoredUser();
  if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;
  return headers;
};

export const api = {
  request: async (endpoint: string, options: any = {}) => {
    const headers: any = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const user = getStoredUser();
    if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
      let data: any = {};
      const text = await res.text();
      try { data = text ? JSON.parse(text) : {}; } catch { data = { error: '操作失败，请稍后再试' }; }
      if (res.status === 401) {
        const isPublicAuth = endpoint.includes('/auth/login')
          || endpoint.includes('/auth/forgot-password')
          || endpoint.includes('/auth/reset-password');
        if (!isPublicAuth) {
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
      if (err?.handled) throw err;
      if (err?.status === 401 || err?.status === 403) throw err;
      if (err?.error || err?.status) throw err;
      throw { error: friendlyErrorMessage(err, '网络连接异常，请稍后再试。') };
    }
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
