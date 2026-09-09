// 共享格式化 / 校验 / 错误映射工具
import { OFFICIAL_VERIFICATION_TYPE_LABELS } from './constants';
import type { AdData, AdDetailItem, PostData, PostType, UserData } from './types';

export const friendlyErrorMessage = (err: unknown, fallback = '操作失败，请稍后再试。'): string => {
  const raw = err && typeof err === 'object'
    ? String((err as { error?: string; message?: string }).error || (err as { message?: string }).message || '').trim()
    : typeof err === 'string' ? err.trim() : '';
  if (!raw || raw === 'undefined' || raw === 'null') return fallback;
  if (/failed to fetch|networkerror|network error|load failed/i.test(raw)) return '网络连接异常，请稍后再试。';
  if (/^request failed$/i.test(raw) || /^something went wrong$/i.test(raw)) return fallback;
  if (/^failed$/i.test(raw)) return fallback;
  if (/^unauthorized$/i.test(raw)) return '请先登录';
  if (/^forbidden$/i.test(raw)) return '暂无权限执行此操作';
  if ([...raw].every((character) => character.codePointAt(0)! <= 0x7f)) return fallback;
  return raw;
};

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const validateEmail = (email: string) => EMAIL_REGEX.test(email.trim());
export const validatePassword = (password: string) =>
  password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);

export const validateContactValue = (type: string, value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return '请填写联系方式';
  if (type === 'email') return validateEmail(trimmed) ? null : '请输入有效的联系邮箱';
  if (type === 'phone') {
    const digits = trimmed.replace(/\D/g, '');
    return /^[+\d\s().-]+$/.test(trimmed) && digits.length >= 7 && digits.length <= 15 ? null : '请输入有效的电话号码，可包含国家代码';
  }
  if (type === 'wechat') return !/\s/.test(trimmed) && trimmed.length <= 64 ? null : '请填写不含空格的微信号';
  return '请选择联系方式类型';
};

export const PUBLIC_CONTACT_NOTICE = '标题和正文会公开显示。建议把微信、电话或邮箱填在「联系方式设置」，通过站内私信或请求方式分享。';

export const getJoinDays = (user: Partial<UserData> & { _id?: string }): number | null => {
  const oneDayMs = 86400000;
  let joinedAt: number | null = null;
  if (user.createdAt != null) {
    joinedAt = typeof user.createdAt === 'number' ? user.createdAt : new Date(user.createdAt as string | Date).getTime();
  } else if (user.id && /^\d{10,}$/.test(String(user.id))) {
    joinedAt = Number(user.id);
  } else if (user._id && String(user._id).length === 24) {
    joinedAt = parseInt(String(user._id).substring(0, 8), 16) * 1000;
  } else if (user.id && String(user.id).length === 24) {
    joinedAt = parseInt(String(user.id).substring(0, 8), 16) * 1000;
  }
  if (joinedAt == null || Number.isNaN(joinedAt)) return null;
  return Math.max(1, Math.ceil((Date.now() - joinedAt) / oneDayMs));
};

// --- 帖子 ---

export const isPostEdited = (post: { createdAt?: number; updatedAt?: number }) =>
  !!post.updatedAt && !!post.createdAt && post.updatedAt > post.createdAt + 500;

/** 中文日期：同年显示「6月12日」，跨年显示「2025年12月8日」 */
export const formatChineseDate = (ts: number) => {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const base = `${d.getMonth() + 1}月${d.getDate()}日`;
  return sameYear ? base : `${d.getFullYear()}年${base}`;
};

export const formatPostDateLine = (post: { createdAt: number; updatedAt?: number; city?: string }) => {
  const date = formatChineseDate(post.createdAt);
  const edited = isPostEdited(post) ? ' · 已编辑' : '';
  return `${post.city || ''} · ${date}${edited}`.replace(/^ · /, '');
};

export type PostWritingHints = {
  titlePlaceholder: string;
  descriptionPlaceholder: string;
  quickTags: string[];
  checklist: string[];
};

export const getPostWritingHints = (category: string, type: PostType): PostWritingHints => {
  const isClient = type === 'client';
  const hints: Record<string, PostWritingHints> = {
    租屋: {
      titlePlaceholder: 'San Mateo 单间出租，$1600/月，近 Caltrain',
      descriptionPlaceholder: '请写清楚位置、价格、入住时间、是否包水电、是否可养宠物。联系方式请在下一步单独设置。',
      quickTags: ['近Caltrain', '独立卫浴', '可短租', '包水电'],
      checklist: ['位置', '价格', '入住时间', '租住条件'],
    },
    闲置: {
      titlePlaceholder: '搬家出 IKEA 沙发，$150，San Mateo 自取',
      descriptionPlaceholder: '请写清楚物品状态、价格、是否可议价、取货地点、是否需要自取。',
      quickTags: ['搬家出', '可议价', '自取', '九成新'],
      checklist: ['物品状态', '价格', '取货地点'],
    },
    清洁: {
      titlePlaceholder: isClient ? '需要退房清洁 / 深度清洁' : '提供退房清洁 / 深度清洁服务，可预约',
      descriptionPlaceholder: '请写清楚服务城市、价格范围、可预约时间、是否自带工具。',
      quickTags: ['退房清洁', '深度清洁', '可预约'],
      checklist: ['服务范围', '价格', '预约时间'],
    },
    搬家: {
      titlePlaceholder: isClient ? '周末搬家需要帮忙' : '提供搬家服务，周末可预约',
      descriptionPlaceholder: '请写清楚出发地、目的地、时间、楼层、是否有大件家具。',
      quickTags: ['周末搬家', '有家具', '需要帮手'],
      checklist: ['出发地', '目的地', '时间'],
    },
    接送: {
      titlePlaceholder: 'SFO 接机 / 湾区机场接送，可预约',
      descriptionPlaceholder: '请写清楚出发地、目的地、时间、人数、行李数量。',
      quickTags: ['SFO', '机场接送', '可预约'],
      checklist: ['路线', '时间', '人数'],
    },
    维修: {
      titlePlaceholder: isClient ? '需要修水龙头' : '提供家庭维修服务',
      descriptionPlaceholder: '请写清楚问题、位置、可上门时间、是否需要报价。',
      quickTags: ['水电维修', '上门服务', '可报价'],
      checklist: ['问题描述', '位置', '上门时间'],
    },
    翻译: {
      titlePlaceholder: '需要 DMV / 医院 / 文件翻译协助',
      descriptionPlaceholder: '请写清楚翻译语言、场景、时间、是否需要现场陪同。',
      quickTags: ['文件翻译', '现场翻译', '中英'],
      checklist: ['语言', '场景', '时间'],
    },
    兼职: {
      titlePlaceholder: isClient ? '周末兼职帮忙' : '招短期帮手',
      descriptionPlaceholder: '请写清楚工作内容、地点、时间、报酬、是否需要经验。',
      quickTags: ['短期兼职', '周末', '现金结算'],
      checklist: ['工作内容', '地点', '报酬'],
    },
    其他: {
      titlePlaceholder: '请简单说明你想发布的信息',
      descriptionPlaceholder: '请写清楚地点、时间、预算或价格。联系方式请在下一步单独设置。',
      quickTags: [],
      checklist: ['地点', '时间', '预算'],
    },
  };
  return hints[category] || hints['其他'];
};

export const validatePostForm = (form: { title: string; description: string; category: string; city: string; budget: string }) => {
  const title = form.title.trim();
  const desc = form.description.trim();
  const budget = (form.budget || '').trim();
  if (title.length < 5) return '标题至少需要 5 个字';
  if (title.length > 80) return '标题最多 80 个字';
  if (desc.length < 10) return '请补充更多细节，至少 10 个字';
  if (desc.length > 2000) return '正文最多 2000 个字';
  if (!form.category) return '请选择分类';
  if (!form.city) return '请选择地区';
  if (budget.length > 30) return '预算/价格最多 30 个字';
  return null;
};

export const mapPostSaveError = (err: any, isEdit = false): string => {
  const msg = err?.error || err?.message || '';
  if (msg.includes('你的账号当前受到限制，暂时无法发布内容')) return msg;
  if (err?.status === 403 && msg.includes('账号当前受到限制')) return msg;
  if (err?.status === 429) {
    if (msg.includes('请不要重复发布相同内容')) return msg;
    if (msg.includes('今天发布次数已达到上限')) return msg;
    if (msg.includes('操作太频繁')) return msg;
    if (/frequently/i.test(msg)) return '发布太频繁了，请稍后再试';
    if (/daily|limit/i.test(msg)) return '今日发布已达上限，请明天再试';
    return msg || '发布太频繁了，请稍后再试';
  }
  if (/Title must be at least/i.test(msg)) return '标题至少需要 5 个字';
  if (/Description must be at least/i.test(msg)) return '请补充更多细节，至少 10 个字';
  if (/Description must be at most/i.test(msg)) return '正文最多 2000 个字';
  if (/Title must be at most/i.test(msg)) return '标题最多 80 个字';
  if (isEdit) return friendlyErrorMessage(err, '修改失败，请稍后再试');
  return friendlyErrorMessage(err, '发布失败，请稍后重试');
};

export const filterPostsByBlockedUsers = (list: PostData[], blockedUserIds: string[]): PostData[] => {
  if (!blockedUserIds.length) return list;
  const blocked = new Set(blockedUserIds);
  return list.filter((p) => !blocked.has(p.authorId));
};

// --- 广告 ---

export const getAdTitle = (ad: Partial<AdData> & { title?: string }) => ad.title || '';
export const getAdContent = (ad: Partial<AdData> & { content?: string; description?: string }) =>
  ad.content || ad.description || '';
export const getAdImageUrl = (ad: Partial<AdData> & { imageUrl?: string }) => ad.imageUrl || '';
export const toAdDetailItem = (ad: Partial<AdData> & { isDemo?: boolean }): AdDetailItem => ({
  id: ad.id || Date.now().toString(),
  title: getAdTitle(ad),
  content: getAdContent(ad),
  imageUrl: getAdImageUrl(ad) || undefined,
  isVerified: ad.isVerified ?? true,
  isDemo: ad.isDemo,
});

export const isValidHttpUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const looksLikeImageUrl = (value: string) => {
  const v = value.trim();
  return /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(v)
    || v.includes('res.cloudinary.com')
    || v.includes('images.unsplash.com')
    || v.includes('i.imgur.com');
};

export const validateAdImageUrl = (imageUrl: string): string | null => {
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;
  if (!isValidHttpUrl(trimmed)) return '请输入有效的图片 URL';
  if (/imgur\.com\/a\//i.test(trimmed) || (/imgur\.com/i.test(trimmed) && !trimmed.includes('i.imgur.com'))) {
    return '请使用图片直链，例如以 .jpg、.png 或 .webp 结尾的地址';
  }
  if (!looksLikeImageUrl(trimmed)) return '请使用图片直链，例如以 .jpg、.png 或 .webp 结尾的地址';
  return null;
};

export const mapAdSaveError = (err: any) => {
  const status = err?.status;
  const msg = (err?.error || err?.message || '').toString();
  if (status === 400) {
    if (msg.includes('Invalid image URL')) return '请输入有效的图片 URL';
    return msg || '请求参数无效';
  }
  if (status === 401) return '请重新登录';
  if (status === 403) return '只有管理员可以操作';
  if (status === 500 || status === 502) return '保存失败，请稍后再试';
  return '保存失败，请稍后再试';
};

// --- 账号 / 认证 ---

export const mapAuthError = (err: any, mode: 'login' | 'register') => {
  const msg = (err?.error || err?.message || '').toString();
  if (msg.includes('Email already registered') || msg.includes('User exists')) return '该邮箱已注册，请直接登录';
  if (msg.includes('Invalid email') || msg.toLowerCase().includes('email format')) return '请输入有效的邮箱地址';
  if (msg.includes('Password must') || (msg.includes('password') && msg.includes('uppercase'))) return '密码至少8位，并包含大写字母、小写字母和数字';
  if (msg.includes('Missing required')) return '请填写完整注册信息';
  if (msg.includes('User not found') || msg.includes('Invalid credentials')) return '账号或密码不正确';
  if (msg.includes('Invalid password')) return '账号或密码不正确';
  if (mode === 'register') return friendlyErrorMessage(err, '注册失败，请检查填写信息');
  return friendlyErrorMessage(err, '登录失败，请检查账号密码');
};

export const getOfficialTypeLabel = (type?: string) =>
  type ? (OFFICIAL_VERIFICATION_TYPE_LABELS[type] || type) : '';

export const getPhoneVerificationTrustLabel = (verified?: boolean) =>
  verified ? '手机号：已验证' : '手机号：未验证';

export const getMyOfficialTrustLabel = (user: UserData) => {
  const status = user?.officialVerification?.status || (user?.isOfficialVerified ? 'approved' : 'none');
  if (status === 'approved' || user?.isOfficialVerified) return '资料审核：已通过';
  if (status === 'pending') return '资料审核：审核中';
  if (status === 'rejected') return '资料审核：未通过，可重新申请';
  return '资料审核：未申请';
};

export const showAccountStatusNotice = (user: UserData, showToast: (msg: string, type?: 'success' | 'error' | 'info') => void) => {
  const status = user.accountStatus || 'active';
  if (status === 'suspended') {
    showToast('你的账号当前受到限制，部分功能暂时不可用。', 'error');
  } else if (status === 'limited') {
    showToast('你的账号部分功能受到限制，暂时无法发布内容或发送私信。', 'info');
  }
};

// --- 个人资料 ---

export const calcProfileCompletion = (user: Partial<UserData>): number => {
  let score = 0;
  if (user.avatar?.trim()) score += 20;
  if (user.bio?.trim()) score += 20;
  if (user.area?.trim() || user.city?.trim()) score += 15;
  if ((user.profileTags?.length || 0) >= 1) score += 15;
  if ((user.interests?.length || 0) >= 1) score += 15;
  const hasSocial = user.socialLinks?.instagram?.trim() || user.xiaohongshu?.trim() || user.website?.trim();
  if (hasSocial) score += 15;
  return score;
};

export const formatProfileLocation = (area?: string, city?: string) => {
  const parts = [area?.trim(), city?.trim()].filter(Boolean);
  return parts.join(' · ');
};

export const normalizeWebsiteUrl = (raw: string): string | null => {
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
};

export const normalizeInstagramUrl = (raw: string): string | null => {
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, '').replace(/^instagram\.com\//i, '');
  return `https://instagram.com/${handle}`;
};
