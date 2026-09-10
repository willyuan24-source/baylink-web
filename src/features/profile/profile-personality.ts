import type { Locale } from '../../i18n/locale';

export const PROFILE_THEMES = [
  { id: 'bay', title: '海湾蓝', description: '像海风一样自在' },
  { id: 'sunset', title: '落日橘', description: '把日常染上暖色' },
  { id: 'redwood', title: '红杉绿', description: '在自然里慢下来' },
  { id: 'lavender', title: '雾紫色', description: '留一点灵感与想象' },
] as const;
export type ProfileTheme = typeof PROFILE_THEMES[number]['id'];
export const resolveProfileTheme = (value: unknown): ProfileTheme => PROFILE_THEMES.some(theme => theme.id === value) ? value as ProfileTheme : 'bay';

export function safeProfileLink(value?: string): string | null {
  if (!value?.trim()) return null;
  try {
    const raw = value.trim();
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return null;
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function commonProfileInterests(own: string[] = [], other: string[] = []): string[] {
  const normalize = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase();
  const ownSet = new Set(own.map(normalize).filter(Boolean));
  const seen = new Set<string>();
  return other.filter(value => { const key = normalize(value); if (!key || !ownSet.has(key) || seen.has(key)) return false; seen.add(key); return true; });
}

export const profileShareUrl = (id: string, locale: Locale) => `https://www.baylink.us/users/${encodeURIComponent(id)}?lang=${locale}`;
