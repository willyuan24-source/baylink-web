import { useEffect, useMemo, useRef } from 'react';
import { getStoredUser } from '../../lib/session';
import { bookingRequestKey } from '../../lib/service-bookings';
import type { UserData } from '../../lib/types';
import type { BookingTranslate } from './booking-copy';

export type BookingToast = (message: string, type?: 'success' | 'error' | 'info') => void;
export const bookingSessionKey = (user: UserData | null) => `${user?.id ?? 'guest'}:${user?.token ?? ''}`;
/** Mutations belong to one mounted account. Old-account results never update the next session. */
export function useBookingSession(user: UserData | null) {
  const mounted = useRef(false), controllers = useRef(new Set<AbortController>()), keys = useRef(new Map<string, string>());
  const userId = user?.id, userToken = user?.token;
  useEffect(() => { mounted.current = true; const pending = controllers.current; return () => { mounted.current = false; pending.forEach(controller => controller.abort()); pending.clear(); }; }, []);
  return useMemo(() => ({
    current: () => { const stored = getStoredUser(); return mounted.current && (userId ? stored?.id === userId && stored?.token === userToken : !stored); },
    controller: () => { const controller = new AbortController(); controllers.current.add(controller); return controller; },
    release: (controller: AbortController) => controllers.current.delete(controller),
    key: (payload: unknown) => { const fingerprint = JSON.stringify(payload); if (!keys.current.has(fingerprint)) keys.current.set(fingerprint, bookingRequestKey()); return keys.current.get(fingerprint)!; },
    clearKey: (payload: unknown) => keys.current.delete(JSON.stringify(payload)),
  }), [userId, userToken]);
}
export function bookingError(error: unknown, t: BookingTranslate, context?: 'read' | 'remove'): string {
  const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
  if (status === 409 && context === 'remove') return t('这个时段有尚未结束的预约。请先到预约列表处理或取消，再移除时段。', 'This time has an active booking. Handle or cancel it in your booking list before removing the time.');
  if (status === 409) return t('这个时段或预约状态刚刚有变化。请刷新后重新选择。', 'This time or booking has just changed. Refresh and choose again.');
  if (status === 401) return t('请重新登录后再继续。', 'Please sign in again to continue.');
  if (status === 403) return t('暂时无法操作，请检查账号、手机号验证和帖子状态。', 'This action is unavailable. Check your account, phone verification and listing status.');
  if (status === 400 || status === 422) return t('请检查日期、时间和备注。时段不能重叠，也不能早于允许的预约时间。', 'Check your dates, times and note. Times must not overlap or be earlier than the booking window.');
  if (context === 'read') return t('暂时无法读取最新预约信息。请重试；已有记录不会因此丢失。', 'The latest booking information could not be loaded. Try again; your saved records are still there.');
  return t('暂时无法确认结果。请刷新查看；重试相同内容不会重复创建预约。', 'The result could not be confirmed. Refresh to check; retrying the same request will not create a duplicate booking.');
}
