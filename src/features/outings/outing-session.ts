import { useLayoutEffect, useMemo, useRef } from 'react';
import { getStoredUser } from '../../lib/session';
import { outingRequestKey } from '../../lib/outings';
import type { UserData } from '../../lib/types';
import type { OutingTranslate } from './outing-copy';

export const outingSessionKey = (user: UserData | null) => `${user?.id ?? 'guest'}:${user?.token ?? ''}`;
export function useOutingSession(user: UserData | null) {
  const mounted = useRef(false), controllers = useRef(new Set<AbortController>()), keys = useRef(new Map<string, string>());
  const id = user?.id, token = user?.token;
  useLayoutEffect(() => { mounted.current = true; const pending = controllers.current; return () => { mounted.current = false; pending.forEach(controller => controller.abort()); pending.clear(); }; }, []);
  return useMemo(() => ({
    current: () => { const stored = getStoredUser(); return mounted.current && (id ? stored?.id === id && stored?.token === token : !stored); },
    controller: () => { const controller = new AbortController(); controllers.current.add(controller); return controller; },
    release: (controller: AbortController) => controllers.current.delete(controller),
    key: (payload: unknown) => { const signature = JSON.stringify(payload); if (!keys.current.has(signature)) keys.current.set(signature, outingRequestKey()); return keys.current.get(signature)!; },
    clearKey: (payload: unknown) => keys.current.delete(JSON.stringify(payload)),
  }), [id, token]);
}
export type OutingSession = ReturnType<typeof useOutingSession>;
export function outingError(error: unknown, t: OutingTranslate, read = false) {
  const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
  if (status === 401) return t('登录已失效，请重新登录。输入内容仍在当前页面。', 'Your sign-in expired. Sign in again; your input is still on this page.');
  if (status === 403) return t('暂时不能执行这项操作。请检查手机号验证、成员权限或账号状态。', 'This action is unavailable. Check phone verification, membership permissions or account status.');
  if (status === 404) return t('这支小队暂时不可访问，可能已下架或权限发生变化。', 'This outing is unavailable. It may have been removed or your access may have changed.');
  if (status === 409) return t('小队安排或名额已变化。请刷新查看最新信息，再确认操作；你的输入仍保留。', 'The plan or available places changed. Refresh and review before trying again; your input is preserved.');
  if (status === 400 || status === 422) return t('请检查日期、时间、人数和文字内容；集合地点须为你核对过的公共场所。', 'Check the date, times, capacity and text. Use a public meeting place you have checked.');
  return read ? t('暂时无法读取小队。请重试，这不代表没有小队。', 'Outings could not be loaded. Try again; this does not mean there are no outings.') : t('暂时无法确认是否保存成功。请先刷新查看，再重试相同内容；不要重复发起新小队。', 'The result could not be confirmed. Refresh to check, then retry the same content; do not create a second outing.');
}
