// 共享常量：分类 / 地区 / 默认封面 / 各类标签映射
import type { AiPostDraft } from '../components/BayBayPostAssist';
import type { DefaultCover, PostType } from './types';

export const MAX_POST_IMAGES = 5;

export const REGIONS = ["旧金山", "中半岛", "东湾", "南湾", "北湾"];
export const SERVICE_CATEGORIES = ['清洁', '搬家', '维修', '翻译'];
export const matchesCategory = (actual: string, filter: string) =>
  filter === '全部' || (filter === '本地服务' ? SERVICE_CATEGORIES.includes(actual) : actual === filter);

/** 地区关键词 → 发帖表单 REGIONS（先匹配具体城市，再匹配大区，避免 Millbrae 被 SF 误判） */
const AREA_TO_REGION: { region: string; patterns: RegExp[] }[] = [
  {
    region: '中半岛',
    patterns: [
      /中半岛/,
      /\bmillbrae\b/i,
      /\bburlingame\b/i,
      /\bsan\s*mateo\b/i,
      /\bfoster\s*city\b/i,
      /\bbelmont\b/i,
      /\bsan\s*carlos\b/i,
      /\bredwood\s*city\b/i,
      /peninsula/i,
    ],
  },
  {
    region: '南湾',
    patterns: [
      /南湾/,
      /\bpalo\s*alto\b/i,
      /\bmountain\s*view\b/i,
      /\bsunnyvale\b/i,
      /\bsanta\s*clara\b/i,
      /\bcupertino\b/i,
      /\bsan\s*jose\b/i,
      /\bmilpitas\b/i,
      /south\s*bay/i,
    ],
  },
  {
    region: '东湾',
    patterns: [
      /东湾/,
      /\boakland\b/i,
      /\bberkeley\b/i,
      /\bfremont\b/i,
      /\bhayward\b/i,
      /\bunion\s*city\b/i,
      /\bnewark\b/i,
      /\balameda\b/i,
      /\bsan\s*pablo\b/i,
      /\brichmond\b/i,
      /\bconcord\b/i,
      /east\s*bay/i,
    ],
  },
  {
    region: '旧金山',
    patterns: [
      /旧金山/,
      /\bsouth\s*san\s*francisco\b/i,
      /\bsan\s*francisco\b/i,
      /\bdaly\s*city\b/i,
      /\bsf\b/i,
    ],
  },
  {
    region: '北湾',
    patterns: [/北湾/, /\bmarin\b/i, /\bsan\s*rafael\b/i, /\bsausalito\b/i, /\bnovato\b/i, /\bsanta\s*rosa\b/i, /\bnapa\b/i, /\bsonoma\b/i],
  },
];

export const resolveCityFromArea = (area: string, current: string): string => {
  const a = area.trim();
  if (!a) return current;
  if (REGIONS.includes(a)) return a;
  for (const { region, patterns } of AREA_TO_REGION) {
    if (!REGIONS.includes(region)) continue;
    if (patterns.some((p) => p.test(a))) return region;
  }
  return current;
};

export const resolveCityFromDraft = (draft: AiPostDraft, current: string): string => {
  const locationText = `${draft.area || ''} ${draft.title || ''} ${draft.description || ''}`.trim();
  if (!locationText) return current;
  return resolveCityFromArea(locationText, current);
};

export const CATEGORIES = ["租屋", "维修", "清洁", "搬家", "接送", "翻译", "兼职", "闲置", "其他"];

export const CATEGORY_EMOJI: Record<string, string> = {
  "租屋": "🏠", "维修": "🔧", "清洁": "🧹", "搬家": "🚚", "接送": "🚗",
  "翻译": "📝", "兼职": "💼", "闲置": "♻️", "其他": "📌",
};

export const HOME_CHANNELS = [
  { id: 'rent', title: '租房', sub: '整租 / 合租 / 短租', emoji: '🏠', category: '租屋', feedType: 'provider' as PostType },
  { id: 'used', title: '二手', sub: '家具 / 电器 / 好物', emoji: '♻️', category: '闲置', feedType: 'provider' as PostType },
  { id: 'service', title: '本地服务', sub: '清洁 / 搬家 / 维修', emoji: '🧹', category: '本地服务', feedType: 'provider' as PostType },
  { id: 'ride', title: '接送', sub: '机场 / 临时 / 通勤', emoji: '🚗', category: '接送', feedType: 'provider' as PostType },
  { id: 'featured', title: '推荐', sub: '编辑精选 / 本地信息', emoji: '⭐', category: null, feedType: null },
];

export const DEFAULT_COVERS: DefaultCover[] = [
  { id: 'rent-wanted', title: '求租屋', type: 'client', category: '租屋', url: '/default-covers/01_求租屋.png', tags: ['求租', '找房', '租屋'] },
  { id: 'roommate', title: '找室友', type: 'client', category: '租屋', url: '/default-covers/02_找室友.png', tags: ['室友', '合租'] },
  { id: 'help-wanted', title: '求帮助', type: 'client', category: '其他', url: '/default-covers/03_求帮助.png', tags: ['求助'] },
  { id: 'moving-wanted', title: '找搬家', type: 'client', category: '搬家', url: '/default-covers/04_找搬家.png', tags: ['搬家'] },
  { id: 'cleaning-wanted', title: '找清洁', type: 'client', category: '清洁', url: '/default-covers/05_找清洁.png', tags: ['清洁'] },
  { id: 'ride-wanted', title: '求接送', type: 'client', category: '接送', url: '/default-covers/06_求接送.png', tags: ['接送'] },
  { id: 'used-wanted', title: '求购二手', type: 'client', category: '闲置', url: '/default-covers/07_求购二手.png', tags: ['求购', '二手'] },
  { id: 'rental-available', title: '房源出租', type: 'provider', category: '租屋', url: '/default-covers/08_房源出租.png', tags: ['出租', '房源'] },
  { id: 'service-provider', title: '提供服务', type: 'provider', category: '其他', url: '/default-covers/09_提供服务.png', tags: ['服务'] },
  { id: 'available-order', title: '可接单', type: 'provider', category: '兼职', url: '/default-covers/10_可接单.png', tags: ['接单'] },
  { id: 'moving-service', title: '搬家服务', type: 'provider', category: '搬家', url: '/default-covers/11_搬家服务.png', tags: ['搬家服务'] },
  { id: 'cleaning-service', title: '清洁服务', type: 'provider', category: '清洁', url: '/default-covers/12_清洁服务.png', tags: ['清洁服务'] },
  { id: 'ride-service', title: '接送服务', type: 'provider', category: '接送', url: '/default-covers/13_接送服务.png', tags: ['接送服务'] },
  { id: 'repair-service', title: '维修服务', type: 'provider', category: '维修', url: '/default-covers/14_维修服务.png', tags: ['维修'] },
  { id: 'used-selling', title: '二手出售', type: 'provider', category: '闲置', url: '/default-covers/15_二手出售.png', tags: ['二手', '出售'] },
  { id: 'bay-area-life', title: '湾区生活', type: 'provider', category: '其他', url: '/default-covers/16_湾区生活.png', tags: ['湾区生活'] },
];

export const isDefaultCoverUrl = (url: string) => url.includes('/default-covers/');

export const findDefaultCoverFromUrl = (url: string): DefaultCover | null =>
  DEFAULT_COVERS.find((c) => url === c.url || url.endsWith(c.url) || url.includes(c.url)) || null;

export const splitPostImages = (urls: string[] = []) => {
  const uploaded = urls.filter((u) => !isDefaultCoverUrl(u));
  const defaultUrl = urls.find(isDefaultCoverUrl);
  const cover = defaultUrl ? findDefaultCoverFromUrl(defaultUrl) : null;
  return { uploaded, cover };
};

export const buildSubmitImageUrls = (uploaded: string[], cover: DefaultCover | null) => {
  if (uploaded.length > 0) return uploaded.slice(0, MAX_POST_IMAGES);
  if (cover?.url) return [cover.url];
  return [];
};

/** Normalize post image fields from API into a string array. */
export const normalizePostImages = (post: { imageUrls?: string[]; images?: string[]; imageUrl?: string } | null | undefined): string[] => {
  if (!post) return [];
  if (Array.isArray(post.imageUrls) && post.imageUrls.length > 0) {
    return post.imageUrls.filter((u): u is string => typeof u === 'string' && !!u.trim());
  }
  if (Array.isArray(post.images) && post.images.length > 0) {
    return post.images.filter((u): u is string => typeof u === 'string' && !!u.trim());
  }
  if (typeof post.imageUrl === 'string' && post.imageUrl.trim()) return [post.imageUrl.trim()];
  return [];
};

const getRecommendedCoverIds = (type: 'client' | 'provider', category: string): string[] => {
  if (type === 'client' && category === '租屋') return ['rent-wanted', 'roommate', 'help-wanted'];
  if (type === 'provider' && category === '租屋') return ['rental-available', 'bay-area-life'];
  if (type === 'client' && category === '搬家') return ['moving-wanted', 'help-wanted'];
  if (type === 'provider' && category === '搬家') return ['moving-service', 'available-order'];
  if (type === 'client' && category === '清洁') return ['cleaning-wanted', 'help-wanted'];
  if (type === 'provider' && category === '清洁') return ['cleaning-service', 'service-provider'];
  if (type === 'client' && category === '接送') return ['ride-wanted', 'help-wanted'];
  if (type === 'provider' && category === '接送') return ['ride-service', 'available-order'];
  if (type === 'client' && category === '闲置') return ['used-wanted', 'help-wanted'];
  if (type === 'provider' && category === '闲置') return ['used-selling', 'bay-area-life'];
  if (type === 'provider' && category === '维修') return ['repair-service', 'service-provider'];
  return ['bay-area-life', 'help-wanted', 'service-provider'];
};

export const getRecommendedCovers = (type: 'client' | 'provider', category: string) => {
  const ids = getRecommendedCoverIds(type, category);
  const recommended = DEFAULT_COVERS.filter((c) => ids.includes(c.id));
  const others = DEFAULT_COVERS.filter((c) => !ids.includes(c.id));
  return { recommended, others, all: DEFAULT_COVERS };
};

export const PROFILE_TAG_PRESETS = [
  '新来湾区', '本地老湾区', '留学生', '上班族', '房东', '租客',
  '服务提供者', '二手卖家', '活动组织者', '本地达人',
];

export const INTEREST_PRESETS = [
  '美食', '咖啡', '奶茶', 'Hiking', '健身', '摄影', '桌游', '电影', '宠物', '亲子',
  '二手家具', '租房', '找室友', '搬家', '清洁', '接送', '维修', '湾区活动',
];

export const OFFICIAL_VERIFICATION_TYPE_LABELS: Record<string, string> = {
  realtor: '房产经纪',
  service_provider: '本地服务商',
  business: '商家',
  official_account: '官方账号',
  community_org: '社区组织',
  other: '其他',
};

export const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  active: '正常',
  limited: '已限制',
  suspended: '已暂停',
};

export const MODERATION_ACTION_LABELS: Record<string, string> = {
  official_verification_approved: '官方认证通过',
  official_verification_rejected: '官方认证拒绝',
  report_reviewed: '举报已处理',
  report_dismissed: '举报已忽略',
  report_reopened: '举报重新打开',
  post_hidden: '帖子已隐藏',
  post_unhidden: '帖子已恢复',
  account_limited: '账号已限制',
  account_suspended: '账号已暂停',
  account_restored: '账号已恢复',
};

export const MODERATION_TARGET_TYPE_LABELS: Record<string, string> = {
  user: '用户',
  post: '帖子',
  report: '举报',
  official_verification: '官方认证',
};

export const REPORT_REASON_LABELS: Record<string, string> = {
  spam: '垃圾广告',
  scam: '诈骗 / 可疑交易',
  harassment: '骚扰 / 不友善',
  illegal: '违法 / 危险内容',
  misleading: '虚假 / 误导信息',
  duplicate: '重复内容',
  other: '其他',
  false_info: '虚假 / 误导信息',
};
