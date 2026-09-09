import type { UserData } from './types';

export const SESSION_KEY = 'currentUser';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const optionalStringsAreValid = (record: Record<string, unknown>, fields: string[]) =>
  fields.every((field) => record[field] == null || typeof record[field] === 'string');

export function parseStoredUser(raw: string | null): UserData | null {
  try {
    const user: unknown = raw ? JSON.parse(raw) : null;
    if (!isRecord(user) || typeof user.id !== 'string' || typeof user.token !== 'string'
      || !user.id.trim() || !user.token.trim()) return null;
    // Old sessions may omit profile fields. Present fields must be safe for React
    // text rendering and the profile's string/array operations before restoring.
    if (!optionalStringsAreValid(user, ['email', 'nickname', 'contactValue', 'bio', 'avatar', 'area', 'city', 'website', 'xiaohongshu', 'phone'])) return null;
    if (['profileTags', 'interests'].some((field) => user[field] != null
      && (!Array.isArray(user[field]) || !user[field].every((item: unknown) => typeof item === 'string')))) return null;
    if (user.socialLinks != null && (!isRecord(user.socialLinks)
      || !optionalStringsAreValid(user.socialLinks, ['instagram', 'linkedin']))) return null;
    if (user.officialVerification != null && (!isRecord(user.officialVerification)
      || !optionalStringsAreValid(user.officialVerification, ['status', 'type', 'description', 'website', 'license', 'socialLink', 'rejectionReason']))) return null;
    return user as unknown as UserData;
  } catch { return null; }
}

export function getStoredUser(): UserData | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const user = parseStoredUser(raw);
    if (raw && !user) localStorage.removeItem(SESSION_KEY);
    return user;
  } catch { return null; }
}

export function removeStoredUser() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* restricted storage */ }
}
