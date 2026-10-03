export const PLATFORM_CATEGORIES = {
  transport: '出行、公交与停车',
  food: '外卖、买菜与餐厅',
  housing: '租房与买房资讯',
  deals: '折扣、返现与比价',
  community: '邻里、二手与互助',
  events: '活动与本地资讯',
  library: '图书馆与阅读',
  alerts: '山火、空气与地震资讯',
} as const;
export const PLATFORM_FORMATS = { 'app-web': 'App 与网页', app: '以 App 为主', web: '以网页为主' } as const;
export type UsefulPlatform = {
  id: string;
  name: string;
  category: keyof typeof PLATFORM_CATEGORIES;
  format: keyof typeof PLATFORM_FORMATS;
  summary: string;
  bestFor: string;
  howTo: string;
  watchFor: string;
  coverage: string;
  url: string;
  sources: { title: string; url: string; description: string }[];
  verifiedAt: string;
};
export const USEFUL_PLATFORMS_SLUG = 'bay-area-useful-apps-platforms-guide';
