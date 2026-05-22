/** Category URL slugs (English) ↔ display names (Chinese). */
export const SLUG_TO_CATEGORY: Record<string, string> = {
  rent: '租屋',
  used: '闲置',
  moving: '搬家',
  cleaning: '清洁',
  ride: '接送',
  repair: '维修',
  translation: '翻译',
  'part-time': '兼职',
  other: '其他',
};

export const CATEGORY_TO_SLUG: Record<string, string> = {
  租屋: 'rent',
  闲置: 'used',
  搬家: 'moving',
  清洁: 'cleaning',
  接送: 'ride',
  维修: 'repair',
  翻译: 'translation',
  兼职: 'part-time',
  其他: 'other',
};

export const getCategoryFromSlug = (slug?: string): string => {
  if (!slug) return '全部';
  return SLUG_TO_CATEGORY[slug] || '全部';
};

export const getSlugFromCategory = (category: string): string | null => {
  if (category === '全部') return null;
  return CATEGORY_TO_SLUG[category] || null;
};

export const postShareUrl = (postId: string) => `${window.location.origin}/posts/${postId}`;
export const userShareUrl = (userId: string) => `${window.location.origin}/users/${userId}`;

export type AppTab = 'home' | 'guides' | 'notifications' | 'messages' | 'profile';

export const tabFromPathname = (pathname: string): AppTab => {
  if (pathname.startsWith('/guides')) return 'guides';
  if (pathname.startsWith('/recommend')) return 'notifications';
  if (pathname.startsWith('/messages')) return 'messages';
  if (pathname === '/me') return 'profile';
  return 'home';
};

export const isGuidesPath = (pathname: string) => pathname.startsWith('/guides');

export const isHomePath = (pathname: string) =>
  pathname === '/' || pathname.startsWith('/category/');
