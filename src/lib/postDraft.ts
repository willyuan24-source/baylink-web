import type { ContactPreferenceValue } from '../components/ContactPreferenceForm';
import type { PostType } from './types';

export type PostDraftForm = {
  title: string; city: string; category: string; budget: string;
  description: string; timeInfo: string; type: PostType; contactInfo: string;
};
export type PostDraft = {
  version: 1; updatedAt: number; form: PostDraftForm; step: number;
  contactPreference: ContactPreferenceValue; aiIntent: string;
  defaultCoverUrl: string | null; hadPhotos: boolean;
};
type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const key = (userId: string) => `baylink.post-draft.v1:${encodeURIComponent(userId)}`;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number) => typeof value === 'string' && value.length <= max;

export function readPostDraft(userId: string, storage?: DraftStorage): PostDraft | null {
  if (!userId) return null;
  try {
    const raw = (storage ?? localStorage).getItem(key(userId));
    if (!raw || raw.length > 30000) return null;
    const draft: unknown = JSON.parse(raw);
    if (!record(draft) || draft.version !== 1 || !Number.isFinite(draft.updatedAt) || !record(draft.form)) return null;
    const form = draft.form;
    if (!['client', 'provider'].includes(String(form.type))
      || !['title', 'city', 'category', 'budget', 'timeInfo', 'contactInfo'].every(field => text(form[field], 1000))
      || !text(form.description, 2000) || !text(draft.aiIntent, 3000)
      || typeof draft.step !== 'number' || ![1, 2, 3].includes(draft.step) || typeof draft.hadPhotos !== 'boolean'
      || !(draft.defaultCoverUrl === null || (text(draft.defaultCoverUrl, 300) && String(draft.defaultCoverUrl).startsWith('/default-covers/')))) return null;
    const preference = draft.contactPreference;
    if (!record(preference) || !['dm_first', 'auto_send', 'manual_approve'].includes(String(preference.mode))
      || !Array.isArray(preference.methods) || preference.methods.length > 4
      || !preference.methods.every(method => record(method) && ['wechat', 'phone', 'email', 'other'].includes(String(method.type))
        && ['label', 'value', 'note'].every(field => text(method[field], 1000)) && typeof method.enabled === 'boolean')) return null;
    return draft as PostDraft;
  } catch { return null; }
}

export function hasPostDraftContent(draft: PostDraft) {
  return draft.step > 1 || draft.hadPhotos || !!draft.defaultCoverUrl || !!draft.aiIntent.trim()
    || ['title', 'description', 'budget', 'timeInfo'].some(field => draft.form[field as keyof PostDraftForm].trim())
    || draft.contactPreference.methods.some(method => !!method.value.trim());
}

export function savePostDraft(userId: string, draft: PostDraft, storage?: DraftStorage): boolean {
  if (!userId) return false;
  try {
    const target = storage ?? localStorage;
    if (hasPostDraftContent(draft)) target.setItem(key(userId), JSON.stringify({
      version: 1, updatedAt: draft.updatedAt, step: draft.step,
      form: { title: draft.form.title, city: draft.form.city, category: draft.form.category, budget: draft.form.budget,
        description: draft.form.description, timeInfo: draft.form.timeInfo, type: draft.form.type, contactInfo: draft.form.contactInfo },
      contactPreference: draft.contactPreference, aiIntent: draft.aiIntent,
      defaultCoverUrl: draft.defaultCoverUrl, hadPhotos: draft.hadPhotos,
    }));
    else target.removeItem(key(userId));
    return true;
  } catch { return false; }
}

export function clearPostDraft(userId: string, storage?: DraftStorage): boolean {
  try { (storage ?? localStorage).removeItem(key(userId)); return true; }
  catch { return false; }
}
