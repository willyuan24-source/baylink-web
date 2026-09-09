import { useMemo, useSyncExternalStore } from 'react';
import type { PostData } from './types';

export type SavedPost = Pick<PostData, 'id' | 'title' | 'city' | 'category' | 'budget'> & { savedAt: number };
const CHANGE_EVENT = 'baylink-saved-posts-changed';
export const MAX_SAVED_POSTS = 100;
export const savedPostsKey = (userId?: string) => `baylink.saved-posts.v1.${userId ? `user:${encodeURIComponent(userId)}` : 'guest'}`;

export function parseSavedPosts(raw: string | null): SavedPost[] {
  try {
    const value: unknown = JSON.parse(raw || '[]');
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.slice(0, MAX_SAVED_POSTS).flatMap((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return [];
      const item = entry as Record<string, unknown>;
      if (typeof item.id !== 'string' || !item.id || item.id.length > 120 || seen.has(item.id) || typeof item.title !== 'string') return [];
      seen.add(item.id);
      const text = (key: string, max: number) => typeof item[key] === 'string' ? (item[key] as string).slice(0, max) : '';
      return [{ id: item.id, title: text('title', 160), city: text('city', 80), category: text('category', 30), budget: text('budget', 80), savedAt: typeof item.savedAt === 'number' && Number.isFinite(item.savedAt) ? item.savedAt : 0 }];
    });
  } catch { return []; }
}

/** Persist public display fields only. Contact details, author data and session tokens never enter this store. */
export function toggleSavedPost(storage: Pick<Storage, 'getItem' | 'setItem'>, userId: string | undefined, post: Pick<SavedPost, 'id' | 'title' | 'city' | 'category' | 'budget'>, now = Date.now()) {
  try {
    const key = savedPostsKey(userId);
    const previous = parseSavedPosts(storage.getItem(key));
    const removing = previous.some((item) => item.id === post.id);
    if (!removing && previous.length >= MAX_SAVED_POSTS) return { saved: false, error: '收藏已满，请先移除一些信息。' };
    const next = removing ? previous.filter((item) => item.id !== post.id)
      : parseSavedPosts(JSON.stringify([{ id: post.id, title: post.title, city: post.city, category: post.category, budget: post.budget, savedAt: now }, ...previous]));
    storage.setItem(key, JSON.stringify(next));
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }));
    return { saved: !removing, error: null };
  } catch { return { saved: false, error: '浏览器未能保存收藏，请检查存储设置后重试。' }; }
}

export function useSavedPosts(userId?: string) {
  const key = savedPostsKey(userId);
  const subscribe = (listener: () => void) => {
    const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) listener(); };
    const onChange = (event: Event) => { if ((event as CustomEvent<string>).detail === key) listener(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(CHANGE_EVENT, onChange); };
  };
  const snapshot = () => { try { return window.localStorage.getItem(key) || '[]'; } catch { return '[]'; } };
  const raw = useSyncExternalStore(subscribe, snapshot, () => '[]');
  return useMemo(() => parseSavedPosts(raw), [raw]);
}
