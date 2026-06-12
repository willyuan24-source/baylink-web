import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getCategoryFromSlug,
  getSlugFromCategory,
  postShareUrl,
  tabFromPathname,
  isHomePath,
  isGuidesPath,
} from './routing';
import { BRAND } from './brandAssets';
import { BayBayAssistantEntry } from './components/BayBayAssistantEntry';
import { BayBayFloatingLauncher } from './components/BayBayFloatingLauncher';
import { BayBayPostAssist, type AiPostDraft } from './components/BayBayPostAssist';
import ReportModal, { type ReportReason } from './components/ReportModal';
import { AuthBrandHeader } from './components/AuthBrandHeader';
import { ForgotPasswordModal } from './components/ForgotPasswordModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { PrivacyPolicyView } from './components/PrivacyPolicyView';
import { TermsView } from './components/TermsView';
import { SmsConsentView } from './components/SmsConsentView';
import { OfficialVerificationModal } from './components/OfficialVerificationModal';
import { BlockedUsersModal } from './components/BlockedUsersModal';
import { CategoryGuideStrip } from './components/CategoryGuideStrip';
import { GuidesHome } from './components/GuidesHome';
import { GuideDetail } from './components/GuideDetail';
import { getGuideBySlug } from './data/guides';
import { 
  MessageCircle, Send, Plus, MapPin, 
  User as UserIcon, X, ShieldCheck, Trash2, Edit, 
  AlertCircle, Phone, Search, Home, Bell, 
  ChevronDown, CheckCircle, Loader2, ChevronLeft, 
  Save, RefreshCw, Clock, Filter, MoreHorizontal, Star, BookOpen, Menu, LogOut, ChevronRight,
  MessageSquare, Lock, Mail as MailIcon, ArrowRight, Info, Image as ImageIcon, ExternalLink, Camera,
  Linkedin, Instagram, AlertTriangle, Share2, Copy, Check, Sparkles, Zap, Shield, FileText, BadgeCheck, Smartphone, Flag, UserX
} from 'lucide-react';

// 引入库
import { io, Socket } from 'socket.io-client';
import { compressImageFile, fileToDataUrl, isLikelyImageFile, MAX_IMAGE_UPLOAD_BYTES } from './utils/imageCompression';

// BAYLINK APP V25.10 Final - Production Ready (最终上线版)

// 默认 Render 线上 API；仅本地跑后端时在 .env.local 设 VITE_API_BASE_URL=http://localhost:3000/api
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://baylink-api.onrender.com/api';
const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://baylink-api.onrender.com';

const REGIONS = ["旧金山", "中半岛", "东湾", "南湾"];

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
    // REGIONS 无「北湾」，Marin 一带归入旧金山侧选项
    region: '旧金山',
    patterns: [/北湾/, /\bmarin\b/i, /\bsan\s*rafael\b/i, /\bsausalito\b/i],
  },
];

const resolveCityFromArea = (area: string, current: string): string => {
  const a = area.trim();
  if (!a) return current;
  if (REGIONS.includes(a)) return a;
  for (const { region, patterns } of AREA_TO_REGION) {
    if (!REGIONS.includes(region)) continue;
    if (patterns.some((p) => p.test(a))) return region;
  }
  return current;
};

const resolveCityFromDraft = (draft: AiPostDraft, current: string): string => {
  const locationText = `${draft.area || ''} ${draft.title || ''} ${draft.description || ''}`.trim();
  if (!locationText) return current;
  return resolveCityFromArea(locationText, current);
};
const CATEGORIES = ["租屋", "维修", "清洁", "搬家", "接送", "翻译", "兼职", "闲置", "其他"];

const CATEGORY_EMOJI: Record<string, string> = {
  "租屋": "🏠", "维修": "🔧", "清洁": "🧹", "搬家": "🚚", "接送": "🚗",
  "翻译": "📝", "兼职": "💼", "闲置": "♻️", "其他": "📌",
};

const HOME_CHANNELS = [
  { id: 'rent', title: '租房', sub: '整租 / 合租 / 短租', emoji: '🏠', category: '租屋', feedType: 'provider' as PostType },
  { id: 'used', title: '二手', sub: '家具 / 电器 / 好物', emoji: '♻️', category: '闲置', feedType: 'provider' as PostType },
  { id: 'service', title: '本地服务', sub: '清洁 / 搬家 / 维修', emoji: '🧹', category: '清洁', feedType: 'provider' as PostType },
  { id: 'ride', title: '接送', sub: '机场 / 临时 / 通勤', emoji: '🚗', category: '接送', feedType: 'provider' as PostType },
  { id: 'featured', title: '推荐', sub: '官方精选 / 认证信息', emoji: '⭐', category: null, feedType: null },
];

const HOT_FALLBACK = [
  { id: 'demo-1', tag: '房源', title: 'Millbrae 2B2B 公寓整租', desc: '步行到 BART，带停车位，包水电网', price: '$2,850 / 月', location: 'Millbrae · 5 分钟前', coverType: 'rent' as const },
  { id: 'demo-2', tag: '二手', title: 'Moving Sale：沙发 + 茶几', desc: '九成新，需自提，可议价', price: '$150', location: 'San Mateo · 1 小时前', coverType: 'used' as const },
  { id: 'demo-3', tag: '服务', title: '专业退房清洁服务', desc: '深度清洁，可预约，口碑商家', price: '$120 起', location: 'Daly City · 2 小时前', coverType: 'service' as const },
];

// 🏷️ 快捷标签
const SMART_TAGS: Record<string, string[]> = {
  "租屋": ["长租", "短租", "带家具", "近BART", "找室友"],
  "维修": ["水管", "电路", "屋顶", "家电", "需自带工具"],
  "清洁": ["全屋清洁", "地毯清洗", "退房扫除", "垃圾清运"],
  "搬家": ["有电梯", "需拆装", "只有纸箱", "需大车", "跨湾区"],
  "接送": ["SFO接机", "SJC接机", "早起", "带宠物", "七座车"],
  "闲置": ["九成新", "全新未拆", "可送货", "自取", "原箱在"],
  "兼职": ["现金", "周末", "远程", "需英语"],
};

type DefaultCover = {
  id: string;
  title: string;
  type: 'client' | 'provider';
  category: string;
  url: string;
  tags: string[];
};

const DEFAULT_COVERS: DefaultCover[] = [
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

const isDefaultCoverUrl = (url: string) => url.includes('/default-covers/');

const findDefaultCoverFromUrl = (url: string): DefaultCover | null =>
  DEFAULT_COVERS.find((c) => url === c.url || url.endsWith(c.url) || url.includes(c.url)) || null;

const splitPostImages = (urls: string[] = []) => {
  const uploaded = urls.filter((u) => !isDefaultCoverUrl(u));
  const defaultUrl = urls.find(isDefaultCoverUrl);
  const cover = defaultUrl ? findDefaultCoverFromUrl(defaultUrl) : null;
  return { uploaded, cover };
};

const buildSubmitImageUrls = (uploaded: string[], cover: DefaultCover | null) => {
  if (uploaded.length > 0) return uploaded.slice(0, 3);
  if (cover?.url) return [cover.url];
  return [];
};

/** Normalize post image fields from API into a string array. */
const normalizePostImages = (post: { imageUrls?: string[]; images?: string[]; imageUrl?: string } | null | undefined): string[] => {
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

const getRecommendedCovers = (type: 'client' | 'provider', category: string) => {
  const ids = getRecommendedCoverIds(type, category);
  const recommended = DEFAULT_COVERS.filter((c) => ids.includes(c.id));
  const others = DEFAULT_COVERS.filter((c) => !ids.includes(c.id));
  return { recommended, others, all: DEFAULT_COVERS };
};

const suggestDefaultCoverFromText = (text: string, type: 'client' | 'provider', category: string): DefaultCover | null => {
  const t = text;
  if (/房源|出租|整租|合租|有房/.test(t) && type === 'provider') return DEFAULT_COVERS.find((c) => c.id === 'rental-available') || null;
  if (/求租|找房|租房/.test(t)) return DEFAULT_COVERS.find((c) => c.id === 'rent-wanted') || null;
  if (/室友|合租/.test(t)) return DEFAULT_COVERS.find((c) => c.id === 'roommate') || null;
  if (/搬家/.test(t)) return DEFAULT_COVERS.find((c) => c.id === (type === 'provider' ? 'moving-service' : 'moving-wanted')) || null;
  if (/清洁|打扫|退房/.test(t)) return DEFAULT_COVERS.find((c) => c.id === (type === 'provider' ? 'cleaning-service' : 'cleaning-wanted')) || null;
  if (/接送|机场|SFO|接机/.test(t)) return DEFAULT_COVERS.find((c) => c.id === (type === 'provider' ? 'ride-service' : 'ride-wanted')) || null;
  if (/求购|想买/.test(t)) return DEFAULT_COVERS.find((c) => c.id === 'used-wanted') || null;
  if (/二手|出售|卖出|转让|出.+沙发|moving sale/i.test(t)) return DEFAULT_COVERS.find((c) => c.id === 'used-selling') || null;
  if (/维修|修理|修.+水龙头|水电/.test(t)) return DEFAULT_COVERS.find((c) => c.id === 'repair-service') || null;
  const { recommended } = getRecommendedCovers(type, category);
  return recommended[0] || null;
};

// --- 类型定义 ---
type Role = 'user' | 'admin';
type PostType = 'client' | 'provider';

interface UserData {
  id: string; email: string; nickname: string; role: Role;
  contactType: 'phone'|'wechat'|'email'; contactValue: string; isBanned: boolean; token?: string;
  bio?: string; avatar?: string;
  area?: string; city?: string;
  profileTags?: string[]; interests?: string[];
  website?: string; xiaohongshu?: string;
  createdAt?: number;
  isPhoneVerified?: boolean; isOfficialVerified?: boolean; // ✨ 信任字段
  accountStatus?: 'active' | 'limited' | 'suspended';
  phone?: string;
  officialVerification?: {
    status?: 'none' | 'pending' | 'approved' | 'rejected';
    type?: string;
    description?: string;
    website?: string;
    license?: string;
    socialLink?: string;
    submittedAt?: number;
    reviewedAt?: number;
    rejectionReason?: string;
  };
  socialLinks?: { linkedin?: string; instagram?: string; };
}

interface AdData { id: string; title: string; content: string; imageUrl?: string; isVerified: boolean; description?: string; createdAt?: string | number; }

const getAdSortTime = (ad: AdData): number => {
  if (ad.createdAt == null) return 0;
  return typeof ad.createdAt === 'number' ? ad.createdAt : new Date(ad.createdAt).getTime();
};

/** Homepage HotRecommend: latest 3 only (by createdAt desc, else API order). */
const pickLatestHomeAds = (ads: AdData[], limit = 3): AdData[] => {
  const list = ads.slice();
  if (list.some((a) => a.createdAt != null)) {
    list.sort((a, b) => getAdSortTime(b) - getAdSortTime(a));
  }
  return list.slice(0, limit);
};

type AdDetailItem = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  isVerified?: boolean;
  isDemo?: boolean;
};

const getAdTitle = (ad: Partial<AdData> & { title?: string }) => ad.title || '';
const getAdContent = (ad: Partial<AdData> & { content?: string; description?: string }) =>
  ad.content || ad.description || '';
const getAdImageUrl = (ad: Partial<AdData> & { imageUrl?: string }) => ad.imageUrl || '';
const toAdDetailItem = (ad: Partial<AdData> & { isDemo?: boolean }): AdDetailItem => ({
  id: ad.id || Date.now().toString(),
  title: getAdTitle(ad),
  content: getAdContent(ad),
  imageUrl: getAdImageUrl(ad) || undefined,
  isVerified: ad.isVerified ?? true,
  isDemo: ad.isDemo,
});

interface PostData {
  id: string; authorId: string; author: { id?: string; nickname: string; avatar?: string; isPhoneVerified?: boolean; isOfficialVerified?: boolean; }; 
  type: PostType; title: string; city: string; category: string; timeInfo: string; budget: string;
  description: string; contactInfo: string | null; imageUrls: string[];
  likesCount: number; hasLiked: boolean; commentsCount: number; comments?: any[];
  createdAt: number; updatedAt?: number;
  isFeatured?: boolean;
  featuredAt?: number | string;
  featuredBy?: string;
  isContacted?: boolean; isReported?: boolean;
}

type PublicUserProfile = {
  id: string;
  nickname: string;
  avatar?: string;
  bio?: string;
  area?: string;
  city?: string;
  profileTags?: string[];
  interests?: string[];
  website?: string;
  xiaohongshu?: string;
  role: Role;
  createdAt?: number;
  isPhoneVerified?: boolean;
  isOfficialVerified?: boolean;
  officialVerification?: { status: string; type?: string };
  socialLinks?: { linkedin?: string; instagram?: string };
  postCount: number;
  recentPosts: Array<{ id?: string; _id?: string; title: string; description?: string; category: string; city: string; type?: PostType; budget?: string; imageUrls?: string[]; createdAt: number; updatedAt?: number }>;
  viewerHasBlockedUser?: boolean;
  viewerIsBlockedByUser?: boolean;
};

const PROFILE_TAG_PRESETS = [
  '新来湾区', '本地老湾区', '留学生', '上班族', '房东', '租客',
  '服务提供者', '二手卖家', '活动组织者', '本地达人',
];

const INTEREST_PRESETS = [
  '美食', '咖啡', '奶茶', 'Hiking', '健身', '摄影', '桌游', '电影', '宠物', '亲子',
  '二手家具', '租房', '找室友', '搬家', '清洁', '接送', '维修', '湾区活动',
];

const calcProfileCompletion = (user: Partial<UserData>): number => {
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

const formatProfileLocation = (area?: string, city?: string) => {
  const parts = [area?.trim(), city?.trim()].filter(Boolean);
  return parts.join(' · ');
};

const normalizeWebsiteUrl = (raw: string): string | null => {
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
};

const normalizeInstagramUrl = (raw: string): string | null => {
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, '').replace(/^instagram\.com\//i, '');
  return `https://instagram.com/${handle}`;
};

const TagPills = ({ tags, variant = 'profile' }: { tags: string[]; variant?: 'profile' | 'interest' }) => (
  <div className="flex flex-wrap gap-1.5">
    {tags.map((t) => (
      <span
        key={t}
        className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
          variant === 'profile'
            ? 'bg-baylink-green/10 text-baylink-green'
            : 'bg-baylink-section/80 text-baylink-text-secondary'
        }`}
      >
        {t}
      </span>
    ))}
  </div>
);

const ProfileTagField = ({
  label,
  hint,
  presets,
  tags,
  max,
  onChange,
  showToast,
}: {
  label: string;
  hint: string;
  presets: string[];
  tags: string[];
  max: number;
  onChange: (next: string[]) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) => {
  const [custom, setCustom] = useState('');
  const toggle = (tag: string) => {
    if (tags.includes(tag)) {
      onChange(tags.filter((t) => t !== tag));
      return;
    }
    if (tags.length >= max) {
      showToast(`最多选择 ${max} 个标签`, 'error');
      return;
    }
    onChange([...tags, tag]);
  };
  const addCustom = () => {
    const tag = custom.trim().slice(0, 20);
    if (!tag) return;
    if (tags.includes(tag)) { setCustom(''); return; }
    if (tags.length >= max) {
      showToast(`最多选择 ${max} 个标签`, 'error');
      return;
    }
    onChange([...tags, tag]);
    setCustom('');
  };
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-gray-500 ml-1">{label}</label>
      <p className="mb-2 text-[10px] text-baylink-muted ml-1">{hint}</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => toggle(p)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition ${
              tags.includes(p)
                ? 'bg-baylink-green text-white'
                : 'border border-baylink-border/60 bg-white text-baylink-text-secondary hover:border-baylink-green/30'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      {tags.filter((t) => !presets.includes(t)).length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {tags.filter((t) => !presets.includes(t)).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="rounded-full bg-baylink-green/15 px-2 py-0.5 text-[10px] text-baylink-green"
            >
              {t} ×
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl bg-white px-3 py-2 text-xs outline-none shadow-sm focus:ring-2 focus:ring-green-500/20"
          placeholder="自定义标签，回车添加"
          value={custom}
          maxLength={20}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
        />
        <button type="button" onClick={addCustom} className="shrink-0 rounded-xl bg-baylink-section px-3 py-2 text-[10px] font-semibold text-baylink-text">添加</button>
      </div>
    </div>
  );
};

const isPostEdited = (post: { createdAt?: number; updatedAt?: number }) =>
  !!post.updatedAt && !!post.createdAt && post.updatedAt > post.createdAt + 500;

const formatPostDateLine = (post: { createdAt: number; updatedAt?: number; city?: string }) => {
  const date = new Date(post.createdAt).toLocaleDateString();
  const edited = isPostEdited(post) ? ' · 已编辑' : '';
  return `${post.city || ''} · ${date}${edited}`.replace(/^ · /, '');
};

type PostWritingHints = {
  titlePlaceholder: string;
  descriptionPlaceholder: string;
  quickTags: string[];
  checklist: string[];
};

const getPostWritingHints = (category: string, type: PostType): PostWritingHints => {
  const isClient = type === 'client';
  const hints: Record<string, PostWritingHints> = {
    租屋: {
      titlePlaceholder: 'San Mateo 单间出租，$1600/月，近 Caltrain',
      descriptionPlaceholder: '请写清楚位置、价格、入住时间、是否包水电、是否可养宠物、联系方式。',
      quickTags: ['近Caltrain', '独立卫浴', '可短租', '包水电'],
      checklist: ['位置', '价格', '入住时间', '联系方式'],
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
      descriptionPlaceholder: '请写清楚地点、时间、预算或价格、联系方式。',
      quickTags: [],
      checklist: ['地点', '时间', '预算'],
    },
  };
  return hints[category] || hints['其他'];
};

const detectRegionFromText = (text: string): string | null => {
  if (/san\s*mateo|millbrae|daly\s*city/i.test(text)) return '中半岛';
  if (/fremont/i.test(text)) return '东湾';
  if (/san\s*jose/i.test(text)) return '南湾';
  if (/旧金山|san\s*francisco|\bsf\b/i.test(text)) return '旧金山';
  for (const r of REGIONS) if (text.includes(r)) return r;
  return null;
};

const organizePostFromBrief = (input: string, category: string, type: PostType) => {
  const trimmed = input.trim();
  const region = detectRegionFromText(trimmed) || REGIONS[0];
  const priceMatch = trimmed.match(/\$?\s*(\d{2,5})(?:\s*\/\s*月|\/月|每月)?/i);
  const budget = priceMatch ? `$${priceMatch[1]}${/\/月|每月|\/\s*月/i.test(trimmed) ? '/月' : ''}` : '';
  const monthMatch = trimmed.match(/(\d{1,2})\s*月/);
  const monthNote = monthMatch ? `${monthMatch[1]} 月` : '';
  const place = trimmed.match(/(San Mateo|Millbrae|Daly City|Fremont|San Jose|旧金山|湾区)/i)?.[0] || region;

  let title = '';
  let description = '';
  if (category === '租屋') {
    title = `${place} 房间出租${budget ? `，${budget}` : ''}${/caltrain|bart/i.test(trimmed) ? '，近 Caltrain' : ''}`;
    description = `位于 ${place}，交通方便${/caltrain|bart/i.test(trimmed) ? '，靠近 Caltrain' : ''}。\n${budget ? `租金 ${budget}` : '租金面议'}${monthNote ? `，预计 ${monthNote} 可入住` : ''}。\n适合正在湾区找房的朋友。\n有兴趣可以私信联系了解更多细节。`;
  } else if (category === '闲置') {
    title = `${place} 闲置好物${budget ? `，${budget}` : ''}`;
    description = `${trimmed}\n\n取货地点：${place}。\n${budget ? `价格 ${budget}，` : ''}欢迎私信了解详情。`;
  } else {
    const action = type === 'client' ? '需要帮助' : '可提供服务';
    title = `${place} ${category}信息${budget ? `，${budget}` : ''}`;
    description = `${trimmed}\n\n地区：${region}。\n${budget ? `预算/价格：${budget}。` : ''}\n${action}，欢迎私信联系。`;
  }
  return { title: title.slice(0, 80), description: description.slice(0, 2000), budget, city: region };
};

const validatePostForm = (form: { title: string; description: string; category: string; city: string; budget: string }) => {
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

const mapPostSaveError = (err: any, isEdit = false): string => {
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

interface Conversation { 
  id: string; 
  otherUser: { id: string; nickname: string; avatar?: string; isPhoneVerified?: boolean; isOfficialVerified?: boolean; }; 
  lastMessage?: string; 
  updatedAt: number;
  lastPostTitle?: string; // ✨ 上下文
}

interface Message { id: string; conversationId?: string; senderId: string; type: 'text'|'contact-request'|'contact-share'; content: string; createdAt: number; }

// --- 工具函数 ---
const triggerSessionExpired = () => { window.dispatchEvent(new Event('session-expired')); };
const safeParse = (str: string | null) => { try { return str ? JSON.parse(str) : null; } catch { return null; } };

const friendlyErrorMessage = (err: unknown, fallback = '操作失败，请稍后再试。'): string => {
  const raw = err && typeof err === 'object'
    ? String((err as { error?: string; message?: string }).error || (err as { message?: string }).message || '').trim()
    : typeof err === 'string' ? err.trim() : '';
  if (!raw || raw === 'undefined' || raw === 'null') return fallback;
  if (/failed to fetch|networkerror|network error|load failed/i.test(raw)) return '网络连接异常，请稍后再试。';
  if (/^request failed$/i.test(raw) || /^something went wrong$/i.test(raw)) return fallback;
  if (/^failed$/i.test(raw)) return fallback;
  if (/^unauthorized$/i.test(raw)) return '请先登录';
  if (/^forbidden$/i.test(raw)) return '暂无权限执行此操作';
  if (/^[\x00-\x7F]+$/.test(raw)) return fallback;
  return raw;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validateEmail = (email: string) => EMAIL_REGEX.test(email.trim());
const validatePassword = (password: string) =>
  password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);

const getJoinDays = (user: Partial<UserData> & { _id?: string }): number | null => {
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

const isValidHttpUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const looksLikeImageUrl = (value: string) => {
  const v = value.trim();
  return /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(v)
    || v.includes('res.cloudinary.com')
    || v.includes('images.unsplash.com')
    || v.includes('i.imgur.com');
};

const validateAdImageUrl = (imageUrl: string): string | null => {
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;
  if (!isValidHttpUrl(trimmed)) return '请输入有效的图片 URL';
  if (/imgur\.com\/a\//i.test(trimmed) || (/imgur\.com/i.test(trimmed) && !trimmed.includes('i.imgur.com'))) {
    return '请使用图片直链，例如以 .jpg、.png 或 .webp 结尾的地址';
  }
  if (!looksLikeImageUrl(trimmed)) return '请使用图片直链，例如以 .jpg、.png 或 .webp 结尾的地址';
  return null;
};

const mapAdSaveError = (err: any) => {
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

const mapAuthError = (err: any, mode: 'login' | 'register') => {
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

// --- 子组件 ---

const Avatar = ({ src, name, size = 10, className = "" }: { src?: string, name?: string, size?: number, className?: string }) => {
    const displaySize = size * 4; 
    if (src) return <img src={src} alt={name || "User"} className={`rounded-full object-cover border border-gray-100 bg-white ${className}`} style={{ width: `${displaySize}px`, height: `${displaySize}px` }} />;
    return <div className={`rounded-full bg-gradient-to-br from-[#5a8f72] to-[#3d6b55] text-white flex items-center justify-center font-semibold ${className}`} style={{ width: `${displaySize}px`, height: `${displaySize}px`, fontSize: `${displaySize * 0.4}px` }}>{name ? name[0].toUpperCase() : <UserIcon size={displaySize * 0.5} />}</div>;
};

// ✨ Toast 组件
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const styles = type === 'success'
    ? 'toast-success shadow-card'
    : type === 'error'
    ? 'toast-error shadow-card'
    : 'bg-white text-baylink-text border-baylink-border/60 shadow-card';
  const iconColor = type === 'success' ? 'text-[#2d6b4f]' : type === 'error' ? 'text-[#B4534B]' : 'text-baylink-muted';
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-3 px-5 py-3 rounded-2xl border animate-in slide-in-from-top-5 fade-in duration-300 max-w-[90vw] ${styles}`}>
      <span className={iconColor}>{type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}</span>
      <span className="text-sm font-semibold">{message}</span>
    </div>
  );
};

// ✨ 信任徽章（手机验证与官方认证独立展示）
const TrustBadge = ({ user, size = 16, showText = false }: { user: Partial<UserData>, size?: number, showText?: boolean }) => {
    const phoneVerified = !!user?.isPhoneVerified;
    const officialVerified = !!user?.isOfficialVerified;
    if (!phoneVerified && !officialVerified) return null;
    return (
        <span className="inline-flex flex-wrap items-center gap-1">
            {phoneVerified && (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-blue-600" title="手机验证已完成">
                    <ShieldCheck size={size} fill="#3B82F6" className="text-white" />
                    {showText && <span className="text-[10px] font-bold">已验证</span>}
                </span>
            )}
            {officialVerified && (
                <span className="inline-flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-50 px-1.5 py-0.5 text-yellow-600" title="BAYLINK 官方认证账号">
                    <BadgeCheck size={size} fill="#FBBF24" className="text-white" />
                    {showText && <span className="text-[10px] font-bold">官方认证</span>}
                </span>
            )}
        </span>
    );
};

// --- API ---
const api = {
  request: async (endpoint: string, options: any = {}) => {
    const headers: any = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      const user = safeParse(userStr);
      if (user && user.token) headers['Authorization'] = `Bearer ${user.token}`;
    }
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
      let data: any = {};
      const text = await res.text();
      try { data = text ? JSON.parse(text) : {}; } catch { data = { error: '操作失败，请稍后再试' }; }
      if (res.status === 401) {
        const isPublicAuth = endpoint.includes('/auth/login')
          || endpoint.includes('/auth/forgot-password')
          || endpoint.includes('/auth/reset-password');
        if (!isPublicAuth) {
          triggerSessionExpired();
          throw { status: res.status, message: '登录已过期', handled: true };
        }
      }
      if (!res.ok) throw { ...data, status: res.status };
      return data;
    } catch (err: any) {
      if (err?.handled) throw err;
      if (err?.status === 401 || err?.status === 403) throw err;
      if (err?.error || err?.status) throw err;
      throw { error: friendlyErrorMessage(err, '网络连接异常，请稍后再试。') };
    }
  },
  getUserProfile: async (userId: string) => await api.request(`/users/${userId}`),
  getUserPublicProfile: async (userId: string) => await api.request(`/users/${userId}/public`),
  updateProfile: async (data: Partial<UserData>) => await api.request('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  submitReport: async (body: { targetType: 'post' | 'user'; targetId: string; reason: string; detail?: string }) =>
    await api.request('/reports', { method: 'POST', body: JSON.stringify(body) }),
  blockUser: async (userId: string) =>
    await api.request(`/users/${userId}/block`, { method: 'POST', body: JSON.stringify({}) }),
  unblockUser: async (userId: string) =>
    await api.request(`/users/${userId}/block`, { method: 'DELETE' }),
  getMyBlocks: async () => await api.request('/users/me/blocks'),
  getAdminReports: async (status = 'open', type = 'all') =>
    await api.request(`/admin/reports?status=${encodeURIComponent(status)}&type=${encodeURIComponent(type)}`),
  updateAdminReport: async (id: string, payload: { status: 'open' | 'reviewed' | 'dismissed'; adminNote?: string }) =>
    await api.request(`/admin/reports/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  hideAdminPost: async (postId: string, reason?: string) =>
    await api.request(`/admin/posts/${postId}/hide`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  unhideAdminPost: async (postId: string) =>
    await api.request(`/admin/posts/${postId}/unhide`, { method: 'PATCH', body: JSON.stringify({}) }),
  updateAdminAccountStatus: async (userId: string, payload: { status: 'active' | 'limited' | 'suspended'; reason?: string }) =>
    await api.request(`/admin/users/${userId}/account-status`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getModerationLogs: async (limit = 50) =>
    await api.request(`/admin/moderation-logs?limit=${limit}`),
  verifyPhone: async (phone: string, code?: string) => await api.request('/auth/verify-phone', { method: 'POST', body: JSON.stringify({ phone, code }) }),
  startPhoneVerification: async (phone: string) =>
    await api.request('/users/me/phone/start', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyPhoneCode: async (code: string) =>
    await api.request('/users/me/phone/verify', { method: 'POST', body: JSON.stringify({ code }) }),
  forgotPassword: async (email: string) =>
    await api.request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: async (token: string, newPassword: string) =>
    await api.request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
  submitOfficialVerification: async (payload: Record<string, string | undefined>) =>
    await api.request('/users/me/official-verification', { method: 'POST', body: JSON.stringify(payload) }),
  getOfficialVerificationRequests: async (status = 'pending') =>
    await api.request(`/admin/official-verifications?status=${encodeURIComponent(status)}`),
  reviewOfficialVerification: async (userId: string, payload: { status: 'approved' | 'rejected'; rejectionReason?: string }) =>
    await api.request(`/admin/users/${userId}/official-verification`, { method: 'PATCH', body: JSON.stringify(payload) }),
};

const filterPostsByBlockedUsers = (list: PostData[], blockedUserIds: string[]): PostData[] => {
  if (!blockedUserIds.length) return list;
  const blocked = new Set(blockedUserIds);
  return list.filter((p) => !blocked.has(p.authorId));
};

const OFFICIAL_VERIFICATION_TYPE_LABELS: Record<string, string> = {
  realtor: '房产经纪',
  service_provider: '本地服务商',
  business: '商家',
  official_account: '官方账号',
  community_org: '社区组织',
  other: '其他',
};

const getOfficialTypeLabel = (type?: string) =>
  type ? (OFFICIAL_VERIFICATION_TYPE_LABELS[type] || type) : '';

const getPhoneVerificationTrustLabel = (verified?: boolean) =>
  verified ? '手机验证：已完成' : '手机验证：未完成';

const getMyOfficialTrustLabel = (user: UserData) => {
  const status = user?.officialVerification?.status || (user?.isOfficialVerified ? 'approved' : 'none');
  if (status === 'approved' || user?.isOfficialVerified) return '官方认证：已通过';
  if (status === 'pending') return '官方认证：审核中';
  if (status === 'rejected') return '官方认证：未通过，可重新申请';
  return '官方认证：未申请';
};

const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  active: '正常',
  limited: '已限制',
  suspended: '已暂停',
};

const MODERATION_ACTION_LABELS: Record<string, string> = {
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

const MODERATION_TARGET_TYPE_LABELS: Record<string, string> = {
  user: '用户',
  post: '帖子',
  report: '举报',
  official_verification: '官方认证',
};

const showAccountStatusNotice = (user: UserData, showToast: (msg: string, type?: 'success' | 'error' | 'info') => void) => {
  const status = user.accountStatus || 'active';
  if (status === 'suspended') {
    showToast('你的账号当前受到限制，部分功能暂时不可用。', 'error');
  } else if (status === 'limited') {
    showToast('你的账号部分功能受到限制，暂时无法发布内容或发送私信。', 'info');
  }
};

const REPORT_REASON_LABELS: Record<string, string> = {
  spam: '垃圾广告',
  scam: '诈骗 / 可疑交易',
  harassment: '骚扰 / 不友善',
  illegal: '违法 / 危险内容',
  misleading: '虚假 / 误导信息',
  duplicate: '重复内容',
  other: '其他',
  false_info: '虚假 / 误导信息',
};

type ReportTarget = { targetType: 'post' | 'user'; targetId: string; authorId?: string };

// --- 组件 ---

const FilterTag = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
  <button onClick={onClick} className={`chip ${active ? 'chip-active' : 'chip-inactive'}`}>{label}</button>
);

const CategoryChip = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => {
  const emoji = CATEGORY_EMOJI[label];
  const display = label === '全部' ? '全部' : emoji ? `${emoji} ${label}` : label;
  return <button onClick={onClick} className={`chip ${active ? 'chip-active' : 'chip-inactive'}`}>{display}</button>;
};

const HotRecommendCover = ({ coverType, isDemo }: { coverType: 'rent' | 'used' | 'service'; isDemo?: boolean }) => (
  <div className={`hot-cover hot-cover--${coverType}`} aria-hidden="true">
    {isDemo && <span className="hot-cover-badge">示例推荐</span>}
    {coverType === 'rent' && (
      <>
        <span className="hot-cover-el hot-cover-wall" />
        <span className="hot-cover-el hot-cover-window" />
        <span className="hot-cover-el hot-cover-sofa" />
        <span className="hot-cover-el hot-cover-floor" />
      </>
    )}
    {coverType === 'used' && (
      <>
        <span className="hot-cover-el hot-cover-wall-warm" />
        <span className="hot-cover-el hot-cover-sofa-lg" />
        <span className="hot-cover-el hot-cover-table" />
      </>
    )}
    {coverType === 'service' && (
      <>
        <span className="hot-cover-el hot-cover-window-svc" />
        <span className="hot-cover-el hot-cover-spray" />
        <span className="hot-cover-el hot-cover-bucket" />
      </>
    )}
  </div>
);

const BayHero = ({ onPublishNeed, onBrowseResources }: { onPublishNeed: () => void; onBrowseResources: () => void }) => (
  <section className="mb-2 sm:mb-3">
    <div className="baylink-hero-photo bay-hero-card relative min-h-[188px] max-h-[220px] sm:min-h-[272px] sm:max-h-[300px]">
      <div className="baylink-hero-inner">
        <div className="baylink-hero-content">
          <h2 className="baylink-hero-title">湾区华人本地生活平台</h2>
          <p className="baylink-hero-subtitle">
            租房、二手、本地服务、接送和生活指南，一站式连接湾区邻里。
          </p>
          <div className="baylink-hero-cta">
            <button type="button" onClick={onPublishNeed} className="baylink-hero-btn-primary">
              发布需求
            </button>
            <button type="button" onClick={onBrowseResources} className="baylink-hero-btn-secondary">
              浏览资源
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const ChannelShortcuts = ({ onChannel }: { onChannel: (ch: typeof HOME_CHANNELS[number]) => void }) => (
  <section className="mb-1.5 sm:mb-3">
    <div className="channel-scroll flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-5 sm:gap-2.5 sm:overflow-visible sm:px-0">
      {HOME_CHANNELS.map((ch) => (
        <button key={ch.id} type="button" onClick={() => onChannel(ch)} className={`channel-card channel-card--${ch.id}`}>
          <span className={`channel-card-icon ${ch.id === 'featured' ? 'bg-amber-50' : ch.id === 'ride' ? 'bg-orange-50' : 'bg-baylink-green-light'}`} aria-hidden="true">{ch.emoji}</span>
          <div className="channel-card-title">{ch.title}</div>
          <div className="channel-card-sub hidden sm:block">{ch.sub}</div>
          <div className="channel-card-sub sm:hidden">{ch.sub.replace(/ \/ /g, '·')}</div>
        </button>
      ))}
    </div>
  </section>
);

const HotRecommendCard = ({ tag, title, desc, price, location, imageUrl, isDemo, isFeatured, coverType, onClick }: {
  tag: string; title: string; desc: string; price?: string; location?: string;
  imageUrl?: string; isDemo?: boolean; isFeatured?: boolean; coverType?: 'rent' | 'used' | 'service';
  onClick?: () => void;
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = imageUrl && !imgFailed;
  return (
  <article
    className={`hot-recommend-card ${onClick ? 'cursor-pointer hover:border-baylink-green/25' : ''}`}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
  >
    <div className="hot-recommend-media">
      {showImage ? (
        <img src={imageUrl} alt="" className="hot-recommend-img" onError={() => setImgFailed(true)} />
      ) : coverType ? (
        <HotRecommendCover coverType={coverType} isDemo={isDemo} />
      ) : (
        <div className="hot-cover hot-cover--default" aria-hidden="true" />
      )}
    </div>
    <div className="hot-recommend-body">
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-px text-[9px] font-semibold ${isDemo ? 'bg-baylink-section text-baylink-muted' : isFeatured ? 'bg-amber-50 text-amber-700' : 'bg-baylink-green-light text-baylink-green'}`}>
          {isDemo ? tag : isFeatured ? <><Sparkles size={8} /> 精选</> : <><Shield size={8} /> {tag || '官方'}</>}
        </span>
      </div>
      <h4 className="line-clamp-2 text-[13px] font-bold leading-snug text-baylink-text lg:line-clamp-1">{title}</h4>
      <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-baylink-muted">{desc}</p>
      {price && <p className="mt-1 text-[13px] font-bold text-baylink-green lg:mt-1.5">{price}</p>}
      {location && <p className="mt-0.5 flex items-center gap-0.5 text-[10px] text-baylink-muted"><Clock size={9} />{location}</p>}
    </div>
  </article>
  );
};

const HotRecommend = ({ onOpenPost, refreshKey, onViewMore, onPublish, onAskBayBay }: {
  onOpenPost: (post: PostData) => void;
  refreshKey?: number;
  onViewMore?: () => void;
  onPublish?: () => void;
  onAskBayBay?: () => void;
}) => {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.request('/posts/featured?limit=3');
        setPosts(res.posts || []);
      } catch (e) {
        console.error('fetch featured', e);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshKey]);

  const gridColsClass =
    posts.length === 1 ? 'hot-recommend-grid--cols-1' : posts.length === 2 ? 'hot-recommend-grid--cols-2' : '';

  return (
    <section className="mb-1.5 sm:mb-3">
      <div className="mb-1 flex items-start justify-between gap-2 px-0.5 sm:mb-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1 text-[13px] font-semibold text-baylink-text sm:text-sm">
            <Sparkles size={14} className="text-baylink-green sm:w-[15px] sm:h-[15px]" /> 热门推荐
          </h3>
          <p className="mt-0.5 hidden text-[11px] text-baylink-muted sm:block">精选优质邻里信息</p>
        </div>
        {onViewMore && (
          <button type="button" onClick={onViewMore} className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-baylink-green transition hover:bg-baylink-green-light active:scale-95 sm:text-xs">
            更多
          </button>
        )}
      </div>
      {loading ? (
        <div className="py-5 text-center sm:py-8"><Loader2 className="mx-auto h-5 w-5 animate-spin text-baylink-green sm:h-6 sm:w-6" /></div>
      ) : posts.length > 0 ? (
        <div className={`hot-recommend-grid ${gridColsClass}`.trim()}>
          {posts.map((post) => {
            const imgs = normalizePostImages(post);
            return (
              <HotRecommendCard
                key={post.id}
                tag={post.category}
                title={post.title}
                desc={post.description}
                price={post.budget}
                location={`${post.city} · ${new Date(post.createdAt).toLocaleDateString()}`}
                imageUrl={imgs[0]}
                isFeatured
                onClick={() => onOpenPost(post)}
              />
            );
          })}
        </div>
      ) : (
        <div className="hot-recommend-empty">
          <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-baylink-green-light ring-1 ring-baylink-green/15">
            <Sparkles size={18} className="text-baylink-green" />
          </div>
          <p className="text-[13px] font-semibold text-baylink-text">暂时还没有热门推荐</p>
          <p className="mx-auto mt-1 max-w-[260px] text-[11px] leading-relaxed text-baylink-muted">
            你可以先浏览最新发布，或者让 BayBay 帮你找合适的信息。
          </p>
          {(onAskBayBay || onPublish) && (
            <div className="mt-3 flex justify-center gap-2">
              {onAskBayBay && (
                <button type="button" onClick={onAskBayBay} className="rounded-xl border border-baylink-green/20 bg-baylink-green-light px-3.5 py-2 text-[11px] font-semibold text-baylink-green transition hover:bg-baylink-green/[0.12] active:scale-95">
                  问问 BayBay
                </button>
              )}
              {onPublish && (
                <button type="button" onClick={onPublish} className="rounded-xl border border-black/[0.06] bg-white/90 px-3.5 py-2 text-[11px] font-semibold text-baylink-text transition hover:bg-baylink-section/40 active:scale-95">
                  发布需求
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

const FeaturedPostsSection = ({ onOpenPost, refreshKey, compact, currentUser, onToggleFeature, onOpenProfile }: {
  onOpenPost: (post: PostData) => void;
  refreshKey?: number;
  compact?: boolean;
  currentUser?: UserData | null;
  onToggleFeature?: (post: PostData) => void;
  onOpenProfile?: (userId: string) => void;
}) => {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.request('/posts/featured');
        setPosts(res.posts || []);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshKey]);

  if (loading) {
    return <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-baylink-green" /></div>;
  }
  if (posts.length === 0) {
    return (
      <div className="mb-6 rounded-2xl border border-dashed border-baylink-border bg-white p-6 text-center">
        <Sparkles size={22} className="mx-auto mb-2 text-baylink-muted opacity-50" />
        <p className="text-sm font-semibold text-baylink-text-secondary">暂无热门推荐</p>
        <p className="mt-1 text-[11px] leading-relaxed text-baylink-muted">管理员精选的优质帖子会显示在这里</p>
      </div>
    );
  }
  return (
    <div className={compact ? 'mb-6 space-y-3' : 'mb-6 grid grid-cols-1 gap-3 md:grid-cols-2'}>
      {posts.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          currentUser={currentUser}
          onToggleFeature={onToggleFeature}
          onClick={() => onOpenPost(p)}
          onContactClick={() => {}}
          onAvatarClick={onOpenProfile}
          onImageClick={() => {}}
        />
      ))}
    </div>
  );
};

const FeedSwitch = ({ feedType, onClient, onProvider }: { feedType: PostType, onClient: () => void, onProvider: () => void }) => (
  <div className="mb-2 flex gap-0.5 rounded-xl border border-baylink-border/30 bg-white/65 p-0.5">
    <button onClick={onProvider} className={`flex-1 rounded-[10px] px-2 py-1.5 text-left transition-all ${feedType==='provider'?'feed-switch-active':'feed-switch-inactive'}`}>
      <div className="text-[12px] font-semibold leading-tight">本地资源</div>
      <div className="mt-0.5 hidden text-[11px] font-normal leading-snug opacity-80 sm:block">房源、服务、二手</div>
    </button>
    <button onClick={onClient} className={`flex-1 rounded-[10px] px-2 py-1.5 text-left transition-all ${feedType==='client'?'feed-switch-active':'feed-switch-inactive'}`}>
      <div className="text-[12px] font-semibold leading-tight">邻里需求</div>
      <div className="mt-0.5 hidden text-[11px] font-normal leading-snug opacity-80 sm:block">看看谁需要帮忙</div>
    </button>
  </div>
);

const EmptyFeed = ({ feedType, onPublishService, onPublishInfo, keyword }: { feedType: PostType, onPublishService: () => void, onPublishInfo: () => void, keyword?: string }) => {
  if (keyword?.trim()) {
    return (
      <div className="py-5 px-4 text-center bg-white rounded-2xl border border-baylink-border/50 shadow-sm">
        <p className="text-sm font-medium text-baylink-text mb-0.5">没有找到相关内容</p>
        <p className="text-xs text-baylink-muted">换个关键词试试，或浏览其他分类</p>
      </div>
    );
  }
  return feedType === 'provider' ? (
    <div className="py-5 px-4 text-center bg-white rounded-2xl border border-baylink-border/50 shadow-sm">
      <p className="text-sm font-medium text-baylink-text mb-0.5">还没有资源内容</p>
      <p className="text-xs text-baylink-muted mb-3">提供你的服务、房源或二手资源，让附近的人找到你</p>
      <button onClick={onPublishService} className="btn-primary px-5 py-2 text-xs inline-flex items-center gap-1.5"><Plus size={14}/> 提供服务</button>
    </div>
  ) : (
    <div className="py-5 px-4 text-center bg-white rounded-2xl border border-baylink-border/50 shadow-sm">
      <p className="text-sm font-medium text-baylink-text mb-0.5">还没有新的需求</p>
      <p className="text-xs text-baylink-muted mb-3">附近需求会显示在这里，也可以先发布你的信息</p>
      <button onClick={onPublishInfo} className="btn-primary px-5 py-2 text-xs inline-flex items-center gap-1.5"><Plus size={14}/> 发布信息</button>
    </div>
  );
};

const ImageViewer = ({ src, onClose }: { src: string, onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
    <button onClick={onClose} className="absolute top-6 right-6 p-3 bg-white/10 text-white rounded-full hover:bg-white/30 transition"><X size={24}/></button>
    <img src={src} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl scale-in-95 animate-in duration-300" onClick={e => e.stopPropagation()} />
  </div>
);

const ShareModal = ({ post, onClose, showToast }: any) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = postShareUrl(post.id);
  const authorName = post.author?.nickname || '匿名用户';
  const authorAvatar = post.author?.avatar;
  const descriptionPreview = (post.description || '').slice(0, 50);

  const handleCopy = () => {
    navigator.clipboard.writeText(`【${post.title}】\n${descriptionPreview}${descriptionPreview ? '...' : ''}\n点击查看: ${shareUrl}`);
    setCopied(true);
    showToast('链接已复制到剪贴板', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-6 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-sm overflow-hidden rounded-[28px] border border-black/[0.04] bg-baylink-bg-alt/95 shadow-elevated backdrop-blur-xl">
        <div className="border-b border-black/[0.04] px-5 pb-4 pt-5">
          <div className="mb-3 flex items-center justify-center gap-2">
            <img src={BRAND.baybayAvatar} alt="" className="h-7 w-7 rounded-lg object-cover ring-1 ring-baylink-green/15" width={28} height={28} />
            <span className="text-sm font-bold tracking-tight text-baylink-text">BAYLINK</span>
          </div>
          <h3 className="text-center text-base font-semibold text-baylink-text">分享这条帖子</h3>
          <p className="mt-1 text-center text-[11px] text-baylink-muted">复制链接，发给湾区邻里</p>
        </div>
        <div className="p-5">
          <div className="surface-inset mb-3 p-3.5">
            <div className="mb-2.5 flex items-center gap-2.5">
              <Avatar src={authorAvatar} name={authorName} size={9} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-baylink-text">{authorName}</div>
                <div className="text-[11px] text-baylink-muted">{new Date(post.createdAt).toLocaleDateString()} · {post.city}</div>
              </div>
            </div>
            <h2 className="mb-1.5 text-[15px] font-semibold leading-snug text-baylink-text">{post.title}</h2>
            <p className="line-clamp-3 text-[13px] leading-relaxed text-baylink-text-secondary">“{post.description}”</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCopy} className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition active:scale-[0.98] ${copied ? 'bg-baylink-green-light text-baylink-green' : 'bg-baylink-green text-white shadow-rest hover:bg-baylink-green-hover'}`}>
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? '已复制' : '复制链接'}
            </button>
            <button onClick={onClose} className="rounded-xl border border-black/[0.06] bg-white/90 px-4 text-[12px] font-medium text-baylink-muted transition hover:bg-baylink-section/50 active:scale-[0.98]">关闭</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoPage = ({ title, storageKey, user, onBack, showToast }: any) => {
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.request(`/content/${storageKey}`);
        setContent(data.value || '暂无内容');
        setEditValue(data.value || '');
      } catch (e) {
        setContent('加载失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [storageKey]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.request('/content', { method: 'POST', body: JSON.stringify({ key: storageKey, value: editValue }) });
      setContent(editValue);
      setIsEditing(false);
      showToast('页面内容已更新', 'success');
    } catch (e) {
      showToast('保存失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-[#FFF8F0] flex flex-col w-full h-full">
      <div className="px-4 py-3 border-b border-white/50 flex items-center justify-between bg-[#FFF8F0]/80 backdrop-blur-md sticky top-0 pt-safe-top shrink-0 z-10">
        <div className="flex items-center gap-3"><button onClick={onBack} className="p-2 hover:bg-white/50 rounded-full transition active:scale-90"><ChevronLeft size={24} className="text-gray-900" /></button><span className="font-bold text-lg text-gray-900">{title}</span></div>
        {user?.role === 'admin' && !isEditing && <button onClick={() => setIsEditing(true)} className="text-green-700 text-sm font-bold flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm"><Edit size={14} /> 编辑</button>}
        {isEditing && <button onClick={handleSave} disabled={loading} className="text-white bg-green-700 text-sm font-bold flex items-center gap-1 px-3 py-1.5 rounded-full shadow-md"><Save size={14} /> {loading ? '...' : '发布'}</button>}
      </div>
      <div className="flex-1 p-6 overflow-y-auto bg-white/50">{!loading && (isEditing ? <textarea className="w-full h-full p-4 bg-white border rounded-2xl text-sm outline-none resize-none shadow-sm" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="在这里输入内容..." /> : <div className="text-gray-900 text-base leading-relaxed whitespace-pre-wrap">{content}</div>)}</div>
    </div>
  );
};

const MyPostsView = ({ user, onBack, onOpenPost }: any) => {
  const [myPosts, setMyPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const all = await api.request('/posts');
        const list = Array.isArray(all) ? all : (all.posts || []);
        setMyPosts(list.filter((p: any) => p.authorId === user.id));
      } catch {} finally {
        setLoading(false);
      }
    };
    load();
  }, [user.id]);

  return (
    <div className="fixed inset-0 z-[80] bg-[#FFF8F0] flex flex-col w-full h-full">
      <div className="px-4 py-3 border-b border-white/50 flex items-center gap-3 bg-[#FFF8F0]/80 backdrop-blur-md sticky top-0 pt-safe-top shrink-0 z-10"><button onClick={onBack} className="p-2 hover:bg-white/50 rounded-full transition active:scale-90"><ChevronLeft size={24} className="text-gray-900" /></button><span className="font-bold text-lg text-gray-900">我的发布</span></div>
      <div className="flex-1 overflow-y-auto p-4 pb-24 bg-[#FAFAFA]">{loading ? <div className="text-center py-10 text-gray-400 text-xs">加载中...</div> : myPosts.length > 0 ? myPosts.map(p => <PostCard key={p.id} post={p} onClick={() => onOpenPost(p)} onContactClick={() => {}} onAvatarClick={() => {}} onImageClick={() => {}} />) : <div className="text-center py-20 opacity-60"><div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-soft"><Edit size={32} className="text-gray-400" /></div><p className="text-sm font-bold text-gray-500">你还没有发布过内容</p><p className="text-xs text-gray-400 mt-1">发布第一条信息，让附近用户看到你</p></div>}</div>
    </div>
  );
};

const PostCard = ({ post, onClick, onContactClick, onAvatarClick, onImageClick, onShare, currentUser, onEdit, onDelete, onToggleFeature, onReport, onToggleBlockUser, blockedUserIds }: any) => {
  const isProvider = post.type === 'provider';
  const postImages = normalizePostImages(post);
  const hasImage = postImages.length > 0;
  const coverUrl = hasImage ? postImages[0] : '';
  const isSystemCover = !!coverUrl && isDefaultCoverUrl(coverUrl);
  const isAdmin = currentUser?.role === 'admin';
  const isOwner = currentUser?.id === post.authorId;
  const canManage = currentUser && (isOwner || isAdmin);
  const showReport = !isOwner;
  const hasMenu = showReport || canManage || isAdmin;
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <article onClick={onClick} className="surface-card mb-3 overflow-hidden group cursor-pointer transition-all duration-200 hover:shadow-elevated hover:border-baylink-green/10">
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
        <div onClick={(e) => { e.stopPropagation(); onAvatarClick && onAvatarClick(post.authorId); }} className="cursor-pointer shrink-0">
            <Avatar src={post.author.avatar} name={post.author.nickname} size={7} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-baylink-text flex items-center gap-1 truncate">
            <span className="font-medium">{post.author.nickname}</span>
            <span className="opacity-80 scale-90 origin-left"><TrustBadge user={post.author} size={9}/></span>
          </div>
          <div className="text-[11px] text-baylink-muted/85">{formatPostDateLine(post)}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${isProvider ? 'bg-baylink-section/80 text-baylink-muted' : 'bg-baylink-green-light/90 text-baylink-green'}`}>
            {isProvider ? '资源' : '需求'}
          </span>
          {hasMenu && (
            <div className="relative">
              <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }} className="p-1 text-baylink-muted hover:text-baylink-text rounded-lg hover:bg-baylink-section/80">
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
                  <div className="absolute right-0 top-full z-20 mt-1 min-w-[120px] rounded-xl border border-baylink-border/60 bg-white py-1 shadow-lg">
                    {showReport && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onReport?.(post); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-baylink-text-secondary hover:bg-baylink-section/60">
                        <Flag size={13} /> 举报帖子
                      </button>
                    )}
                    {showReport && onToggleBlockUser && post.authorId && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleBlockUser(post.authorId); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-baylink-text-secondary hover:bg-baylink-section/60">
                        <UserX size={13} /> {blockedUserIds?.includes(post.authorId) ? '取消屏蔽' : '屏蔽该用户'}
                      </button>
                    )}
                    {isAdmin && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleFeature?.(post); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-amber-700 hover:bg-amber-50">
                        <Star size={13} /> {post.isFeatured ? '取消热门推荐' : '加入热门推荐'}
                      </button>
                    )}
                    {canManage && (
                      <>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit?.(post); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-baylink-text hover:bg-baylink-section/60">
                          <Edit size={13} /> 编辑
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete?.(post); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50">
                          <Trash2 size={13} /> 删除
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="px-4 pb-2.5">
         <h3 className="font-semibold text-base text-baylink-text leading-snug line-clamp-2 mb-1.5">{post.title}</h3>
         {hasImage ? (
           <div className="relative mb-2.5 overflow-hidden rounded-xl border border-black/[0.04] bg-gradient-to-br from-baylink-section/60 to-baylink-green-light/30">
             <img
               src={coverUrl}
               alt={post.title}
               className={`aspect-[16/10] w-full ${isSystemCover ? 'object-contain bg-baylink-section/50 p-2' : 'object-cover'}`}
               onClick={(e) => { e.stopPropagation(); onImageClick && onImageClick(coverUrl); }}
             />
             {isSystemCover && (
               <span className="absolute left-2.5 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-baylink-muted shadow-rest">封面</span>
             )}
           </div>
         ) : null}
         <p className="text-[13px] text-baylink-text-secondary line-clamp-2 leading-relaxed">{post.description}</p>
      </div>
      <div className="px-4 pb-3.5 flex items-center justify-between gap-2 border-t border-black/[0.03] pt-2.5 mx-4 mb-0.5">
         <div className="flex flex-wrap items-center gap-1.5 min-w-0">
           {post.budget && <span className="text-sm font-semibold text-baylink-green truncate">{post.budget}</span>}
           <span className="text-[11px] text-baylink-muted">#{post.category}</span>
         </div>
         <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={(e) => { e.stopPropagation(); onShare && onShare(post); }} className="p-1.5 text-baylink-muted/80 hover:text-baylink-text-secondary transition rounded-lg hover:bg-baylink-section/60" title="分享">
              <Share2 size={14}/>
            </button>
            <button onClick={(e) => {e.stopPropagation(); onContactClick(post);}} className="text-[11px] font-semibold border border-baylink-green/25 bg-baylink-green/[0.08] text-baylink-green px-2.5 py-1.5 rounded-lg hover:bg-baylink-green/[0.12] active:scale-[0.98] transition flex items-center gap-1">
              <MessageCircle size={13} /> 私信
            </button>
         </div>
      </div>
    </article>
  );
};

const MessagesList = ({ currentUser, onOpenChat, onOpenProfile }: { currentUser: UserData | null; onOpenChat: (conv: Conversation) => void; onOpenProfile?: (userId: string) => void }) => {
  const [convs, setConvs] = useState<Conversation[]>([]);
  useEffect(() => { if (!currentUser) return; const load = async () => { try { const res = await api.request('/conversations'); if (Array.isArray(res)) setConvs(res); } catch {} }; load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, [currentUser]);
  if (!currentUser) return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center w-full min-h-[300px] bg-baylink-bg">
      <div className="surface-card w-20 h-20 rounded-full flex items-center justify-center mb-4"><MessageCircle size={32} className="text-baylink-muted" /></div>
      <h3 className="font-semibold text-baylink-text mb-2">请先登录</h3>
    </div>
  );
  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 w-full bg-baylink-bg">
      {convs.length > 0 ? (
        <div className="space-y-3">
          {convs.map(c => (
            <div
              key={c.id}
              onClick={() => onOpenChat(c)}
              className="surface-card flex min-h-[72px] items-center gap-3.5 p-4 cursor-pointer transition hover:border-baylink-green/15 active:scale-[0.99]"
            >
              <div onClick={(e) => { e.stopPropagation(); onOpenProfile?.(c.otherUser.id); }} className="shrink-0 cursor-pointer">
                <Avatar src={c.otherUser.avatar} name={c.otherUser.nickname} size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2 mb-0.5">
                  <span
                    onClick={(e) => { e.stopPropagation(); onOpenProfile?.(c.otherUser.id); }}
                    className="text-[17px] font-semibold text-baylink-text flex items-center gap-1 cursor-pointer hover:text-baylink-green truncate"
                  >
                    {c.otherUser.nickname} <TrustBadge user={c.otherUser} size={12} />
                  </span>
                  <span className="type-footnote shrink-0">{new Date(c.updatedAt).toLocaleDateString()}</span>
                </div>
                <p className="text-[14px] text-baylink-text-secondary truncate">{c.lastMessage || '点击开始聊天'}</p>
              </div>
              <ChevronRight size={16} className="text-baylink-muted opacity-50 shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <div className="surface-card mx-1 mt-8 px-6 py-10 text-center">
          <MessageCircle size={28} className="mx-auto mb-3 text-baylink-green/60" />
          <p className="text-[17px] font-semibold text-baylink-text">还没有消息</p>
          <p className="mt-2 text-[14px] leading-relaxed text-baylink-text-secondary">看到合适的房源、二手或服务，可以点「私信」开始沟通。</p>
        </div>
      )}
    </div>
  );
};

const UserProfileModal = ({ userId, onClose, currentUser, onChat, onOpenRecentPost, showToast, onReportUser, onToggleBlockUser, blockedUserIds, onLoginNeeded }: {
  userId: string;
  onClose: () => void;
  currentUser: UserData | null;
  onChat?: (targetId: string, nickname?: string) => void;
  onOpenRecentPost?: (post: { id?: string; _id?: string }) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onReportUser?: (userId: string) => void;
  onToggleBlockUser?: (userId: string) => void;
  blockedUserIds?: string[];
  onLoginNeeded?: () => void;
}) => {
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    (async () => {
      setLoading(true);
      setFailed(false);
      try {
        setProfile(await api.getUserPublicProfile(userId));
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const joinDays = profile ? getJoinDays(profile) : null;
  const locationLine = profile ? formatProfileLocation(profile.area, profile.city) : '';
  const profileTags = profile?.profileTags?.filter(Boolean) || [];
  const interests = profile?.interests?.filter(Boolean) || [];
  const hasTags = profileTags.length > 0 || interests.length > 0;
  const instaUrl = profile?.socialLinks?.instagram ? normalizeInstagramUrl(profile.socialLinks.instagram) : null;
  const websiteUrl = profile?.website ? normalizeWebsiteUrl(profile.website) : null;
  const xhsRaw = profile?.xiaohongshu?.trim() || '';
  const xhsUrl = xhsRaw && /^https?:\/\//i.test(xhsRaw) ? xhsRaw : null;
  const hasSocial = !!(instaUrl || websiteUrl || xhsRaw);
  const isBlocked = profile ? (blockedUserIds?.includes(profile.id) || profile.viewerHasBlockedUser) : false;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[86vh] w-full max-w-md flex-col overflow-hidden rounded-[28px] bg-baylink-bg-alt shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-baylink-border/40 px-5 py-3">
          <h3 className="text-base font-bold text-baylink-text">湾区生活名片</h3>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-baylink-muted hover:bg-baylink-section"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-baylink-green" /></div>
          ) : failed || !profile ? (
            <p className="py-12 text-center text-sm text-baylink-muted">无法查看该用户资料</p>
          ) : (
            <>
              <div className="rounded-2xl border border-baylink-green/15 bg-gradient-to-br from-baylink-green/[0.06] via-white to-[#FFF8F0]/80 p-4">
                <div className="flex items-start gap-3">
                  <Avatar src={profile.avatar} name={profile.nickname} size={16} className="shrink-0 ring-2 ring-white" />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-lg font-bold text-baylink-text leading-tight">{profile.nickname}</h4>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <span className={`rounded-md px-1.5 py-px text-[9px] font-bold ${profile.role === 'admin' ? 'bg-baylink-green text-white' : 'bg-baylink-section text-baylink-muted'}`}>
                        {profile.role === 'admin' ? '管理员' : '社区居民'}
                      </span>
                      <TrustBadge user={profile} size={11} showText />
                    </div>
                    {locationLine && (
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-baylink-text-secondary">
                        <MapPin size={11} className="shrink-0 text-baylink-green/70" />
                        <span className="truncate">{locationLine}</span>
                      </p>
                    )}
                    {joinDays != null && (
                      <p className="mt-0.5 text-[10px] text-baylink-muted">加入 BAYLINK {joinDays} 天</p>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-left text-[13px] leading-relaxed text-baylink-text-secondary">
                  {profile.bio?.trim() || 'TA 还没介绍自己，先看看最近发布吧。'}
                </p>
              </div>

              {hasTags && (
                <div className="mt-3 space-y-2.5 rounded-xl border border-baylink-border/40 bg-white p-3">
                  {profileTags.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold text-baylink-muted">身份标签</p>
                      <TagPills tags={profileTags} variant="profile" />
                    </div>
                  )}
                  {interests.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold text-baylink-muted">兴趣</p>
                      <TagPills tags={interests} variant="interest" />
                    </div>
                  )}
                </div>
              )}

              {hasSocial && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {instaUrl && (
                    <a href={instaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-baylink-border/50 bg-white px-2.5 py-1 text-[10px] font-medium text-baylink-text-secondary hover:border-baylink-green/30">
                      <Instagram size={12} className="text-[#E1306C]" /> Instagram
                    </a>
                  )}
                  {xhsRaw && (
                    xhsUrl ? (
                      <a href={xhsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-baylink-border/50 bg-white px-2.5 py-1 text-[10px] font-medium text-baylink-text-secondary hover:border-baylink-green/30">
                        小红书
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-baylink-border/50 bg-white px-2.5 py-1 text-[10px] font-medium text-baylink-text-secondary">
                        小红书 · {xhsRaw}
                      </span>
                    )
                  )}
                  {websiteUrl && (
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-baylink-border/50 bg-white px-2.5 py-1 text-[10px] font-medium text-baylink-text-secondary hover:border-baylink-green/30">
                      <ExternalLink size={11} /> 个人网站
                    </a>
                  )}
                </div>
              )}

              <div className="mt-3 rounded-xl border border-baylink-border/40 bg-white p-3 text-[11px] text-baylink-text-secondary">
                <p className="font-semibold text-baylink-text mb-2 text-xs">信任信息</p>
                <div className="space-y-1.5">
                  <p>已加入 BAYLINK <span className="font-medium text-baylink-text">{joinDays ?? '—'}</span> 天</p>
                  <p>发布 <span className="font-medium text-baylink-text">{profile.postCount}</span> 条本地信息</p>
                  <p>{getPhoneVerificationTrustLabel(profile.isPhoneVerified)}</p>
                  {profile.isOfficialVerified && (
                    <>
                      <p>官方认证：已通过</p>
                      {profile.officialVerification?.type && (
                        <p>认证类型：{getOfficialTypeLabel(profile.officialVerification.type)}</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <h5 className="text-xs font-bold text-baylink-text">最近发布</h5>
                {profile.recentPosts.length > 0 ? (
                  <>
                  <p className="mb-2 text-[10px] text-baylink-muted">查看 TA 最近的本地信息</p>
                  <div className="space-y-2">
                    {profile.recentPosts.map((rp) => {
                      const postId = rp.id || rp._id;
                      return (
                      <button
                        key={postId || rp.title}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!postId) {
                            showToast?.('帖子链接不可用', 'error');
                            return;
                          }
                          onOpenRecentPost?.(rp);
                        }}
                        className="flex w-full min-h-[56px] cursor-pointer gap-2 rounded-xl border border-baylink-border/50 bg-white p-3 text-left transition hover:border-baylink-green/30 hover:bg-baylink-green/[0.02] active:scale-[0.99]"
                      >
                        {normalizePostImages(rp)[0] ? (
                          <img src={normalizePostImages(rp)[0]} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-baylink-section text-[10px] text-baylink-muted">无图</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-1 text-sm font-semibold text-baylink-text">{rp.title}</div>
                          <div className="text-[10px] text-baylink-muted">{rp.city} · #{rp.category}</div>
                        </div>
                        <ChevronRight size={16} className="shrink-0 self-center text-gray-300" />
                      </button>
                    );})}
                  </div>
                  </>
                ) : (
                  <p className="mt-2 text-[11px] text-baylink-muted">TA 还没有发布过内容</p>
                )}
              </div>
            </>
          )}
        </div>
        {!loading && profile && currentUser?.id !== profile.id && (
          <div className="border-t border-baylink-border/40 px-5 py-4 space-y-2">
            <button
              type="button"
              onClick={() => { onChat?.(profile.id, profile.nickname); onClose(); }}
              className="w-full rounded-xl bg-baylink-green py-3 text-sm font-semibold text-white shadow-rest transition hover:bg-baylink-green-hover active:scale-[0.98]"
            >
              {onChat ? '继续聊天' : '发私信'}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!currentUser) { onLoginNeeded?.(); return; }
                  onReportUser?.(profile.id);
                }}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-baylink-border/60 py-2.5 text-xs font-semibold text-baylink-text-secondary hover:bg-baylink-section/50"
              >
                <Flag size={13} /> 举报用户
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!currentUser) { onLoginNeeded?.(); return; }
                  onToggleBlockUser?.(profile.id);
                }}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-baylink-border/60 py-2.5 text-xs font-semibold text-baylink-text-secondary hover:bg-baylink-section/50"
              >
                <UserX size={13} /> {isBlocked ? '取消屏蔽' : '屏蔽用户'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PublicProfileModal = ({ userId, onClose, onChat, currentUser, showToast }: any) => {
    const [profile, setProfile] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => { const load = async () => { try { setProfile(await api.getUserProfile(userId)); } catch (e) { showToast('无法获取用户信息', 'error'); onClose(); } finally { setLoading(false); } }; load(); }, [userId]);
    if (loading || !profile) return <div className="fixed inset-0 z-[100] bg-white/90 flex items-center justify-center"><Loader2 className="animate-spin text-green-700"/></div>;
    return (
        <div className="fixed inset-0 z-[90] bg-[#FFF8F0] flex flex-col animate-in slide-in-from-bottom duration-200">
             <div className="px-4 py-3 border-b border-white/50 flex items-center justify-between bg-[#FFF8F0]/80 backdrop-blur-md pt-safe-top">
                <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-gray-100 transition active:scale-90"><X size={20}/></button>
                <span className="font-bold text-lg text-gray-900">用户主页</span><div className="w-9"></div>
             </div>
             <div className="flex-1 p-6 overflow-y-auto flex flex-col items-center">
                 <div className="relative mb-4">
                    <Avatar src={profile.avatar} name={profile.nickname} size={24} className="shadow-xl border-4 border-white"/>
                    <div className="absolute -bottom-2 -right-2"><TrustBadge user={profile} size={24} /></div>
                 </div>
                 <h2 className="text-2xl font-black text-gray-900 mb-1 flex items-center gap-2 flex-wrap">{profile.nickname} <TrustBadge user={profile} size={12} showText /></h2>
                 <div className="flex flex-wrap gap-2 mb-4">
                     <span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${profile.role === 'admin' ? 'bg-green-700 text-white' : 'bg-gray-200 text-gray-600'}`}>{profile.role === 'admin' ? '管理员' : '社区居民'}</span>
                 </div>
                 <div className="w-full bg-white p-4 rounded-2xl shadow-sm border border-white mb-6 text-sm text-gray-600">
                   <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">信任信息</h3>
                   <p>{getPhoneVerificationTrustLabel(profile.isPhoneVerified)}</p>
                   {profile.isOfficialVerified && <p className="mt-1">官方认证：已通过</p>}
                 </div>
                 {profile.socialLinks && (<div className="flex gap-4 mb-6">{profile.socialLinks.linkedin && <a href={profile.socialLinks.linkedin} target="_blank" className="p-3 bg-white rounded-full text-[#0077b5] shadow-sm hover:scale-110 transition"><Linkedin size={20}/></a>}{profile.socialLinks.instagram && <a href={profile.socialLinks.instagram} target="_blank" className="p-3 bg-white rounded-full text-[#E1306C] shadow-sm hover:scale-110 transition"><Instagram size={20}/></a>}</div>)}
                 <div className="w-full bg-white p-6 rounded-3xl shadow-sm border border-white mb-6"><h3 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">个人简介</h3><p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-sm">{profile.bio || "这个用户很懒，还没有写简介。"}</p></div>
                 {currentUser?.id !== profile.id && <button onClick={() => { onChat(profile.id, profile.nickname); onClose(); }} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition flex items-center justify-center gap-2"><MessageCircle size={20}/> 发送私信</button>}
             </div>
        </div>
    );
};

const PhoneVerificationModal = ({ user, onClose, onVerified, showToast }: any) => {
    const [step, setStep] = useState(1);
    const [phone, setPhone] = useState(user.phone || '');
    const [code, setCode] = useState('');
    const [devCode, setDevCode] = useState('');
    const [loading, setLoading] = useState(false);

    const sendCode = async () => {
        const digits = phone.replace(/\D/g, '');
        if (!digits || (digits.length !== 10 && !(digits.length === 11 && digits.startsWith('1')))) {
          return showToast('请输入有效的美国手机号。', 'error');
        }
        setLoading(true);
        try {
            const res = await api.startPhoneVerification(phone);
            if (import.meta.env.DEV && res.devCode) setDevCode(res.devCode);
            showToast('验证码已发送', 'success');
            setStep(2);
        } catch(e: any) {
            showToast(friendlyErrorMessage(e, '验证码发送失败，请稍后再试。'), 'error');
        }
        finally { setLoading(false); }
    };

    const verifyCode = async () => {
        if (!code || code.trim().length < 6) return showToast('请输入6位验证码', 'error');
        setLoading(true);
        try {
            const res = await api.verifyPhoneCode(code.trim());
            const stored = localStorage.getItem('currentUser');
            const current = stored ? safeParse(stored) : {};
            const nextUser = { ...current, ...res.user };
            localStorage.setItem('currentUser', JSON.stringify(nextUser));
            onVerified(nextUser);
            showToast('手机验证已完成', 'success');
            onClose();
        } catch(e: any) { showToast(friendlyErrorMessage(e, '验证码错误'), 'error'); }
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-900"><X size={20}/></button>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4 mx-auto"><ShieldCheck size={24}/></div>
                <h3 className="text-xl font-black text-center mb-1">手机验证</h3>
                <p className="mb-4 text-center text-[11px] leading-relaxed text-gray-500">手机号只用于账号安全和提升社区信任，不会公开显示。</p>
                {step === 1 ? (
                    <div className="space-y-4">
                        <input className="w-full p-3.5 bg-gray-50 rounded-xl text-sm font-medium text-center outline-none border border-transparent focus:border-blue-500 focus:bg-white transition placeholder:text-[11px] placeholder:font-normal" placeholder="例如：4156012119 或 +14156012119" value={phone} onChange={e => setPhone(e.target.value)} />
                        <button onClick={sendCode} disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 active:scale-95 transition">{loading ? '发送中...' : '发送验证码'}</button>
                        <p className="text-[10px] leading-relaxed text-gray-500">
                          By clicking &ldquo;发送验证码 / Send verification code&rdquo;, you agree to receive one-time SMS verification codes from BAYLINK at the mobile number provided for account security and phone verification. Message frequency varies based on your verification requests. Msg &amp; data rates may apply. Reply STOP to opt out or HELP for help. View our{' '}
                          <a href="/privacy" className="font-semibold text-baylink-green hover:underline">Privacy Policy</a>
                          {' '}and{' '}
                          <a href="/terms" className="font-semibold text-baylink-green hover:underline">Terms of Service</a>.
                        </p>
                        <p className="text-center text-[10px] text-gray-400">
                          <a href="/sms-consent" className="text-baylink-green hover:underline">SMS Verification Consent</a>
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {import.meta.env.DEV && devCode && (
                          <p className="text-center text-[10px] text-amber-700">开发测试码：{devCode}</p>
                        )}
                        <input className="w-full p-4 bg-gray-50 rounded-xl font-bold text-center outline-none border border-transparent focus:border-blue-500 focus:bg-white transition tracking-widest text-lg" placeholder="6位验证码" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                        <button onClick={verifyCode} disabled={loading} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 active:scale-95 transition">{loading ? '验证中...' : '完成验证'}</button>
                    </div>
                )}
            </div>
        </div>
    );
};

const EditProfileModal = ({ user, onClose, onUpdate, showToast }: any) => {
    const [form, setForm] = useState({
      nickname: user.nickname || '',
      bio: user.bio || '',
      avatar: user.avatar || '',
      area: user.area || '',
      city: user.city || '',
      profileTags: user.profileTags || [],
      interests: user.interests || [],
      website: user.website || '',
      xiaohongshu: user.xiaohongshu || '',
      socialLinks: { linkedin: user.socialLinks?.linkedin || '', instagram: user.socialLinks?.instagram || '' },
    });
    const [saving, setSaving] = useState(false);
    const [showVerify, setShowVerify] = useState(false);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target;
        const file = input.files?.[0];
        if (!file) return;
        try {
            const { file: compressedFile } = await compressImageFile(file, { maxWidth: 768, maxHeight: 768, quality: 0.86 });
            const dataUrl = await fileToDataUrl(compressedFile);
            setForm((p) => ({ ...p, avatar: dataUrl }));
        } catch (err) {
            console.warn('[avatar] image process failed', err);
            showToast('图片处理失败', 'error');
        } finally {
            input.value = '';
        }
    };

    const handleSave = async () => {
      if (!form.nickname) return;
      setSaving(true);
      try {
        const updated = await api.updateProfile(form);
        const newUserData = { ...user, ...updated };
        localStorage.setItem('currentUser', JSON.stringify(newUserData));
        onUpdate(newUserData);
        onClose();
        showToast('资料已更新', 'success');
      } catch {
        showToast('保存失败', 'error');
      } finally {
        setSaving(false);
      }
    };

    return (
        <div className="fixed inset-0 z-[90] bg-[#FFF8F0] flex flex-col animate-in slide-in-from-bottom duration-200">
             <div className="px-4 py-3 border-b border-white/50 flex items-center justify-between bg-[#FFF8F0]/80 backdrop-blur-md pt-safe-top">
                <button onClick={onClose} className="text-gray-500 hover:text-gray-900 font-bold text-sm">取消</button><span className="font-bold text-lg text-gray-900">编辑资料</span><button onClick={handleSave} disabled={saving} className="text-green-700 font-bold text-sm disabled:opacity-50">{saving ? '保存中...' : '完成'}</button>
             </div>
             <div className="flex-1 p-5 overflow-y-auto pb-8">
                 <div className="flex flex-col items-center mb-6"><div className="relative group"><Avatar src={form.avatar} name={form.nickname} size={24} /><label htmlFor="edit-profile-avatar-input" className="absolute bottom-0 right-0 bg-gray-900 text-white p-3 rounded-full cursor-pointer shadow-xl hover:scale-110 transition border-2 border-white"><Camera size={18}/><input id="edit-profile-avatar-input" type="file" accept="image/*" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={handleAvatarUpload} aria-label="上传头像" /></label></div></div>

                 <div className="bg-white p-4 rounded-2xl shadow-sm mb-5 flex items-center justify-between border border-blue-50">
                     <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-full ${user.isPhoneVerified ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}><Smartphone size={20}/></div>
                         <div><div className="font-bold text-sm text-gray-900">手机验证</div><div className="text-[10px] text-gray-400">{getPhoneVerificationTrustLabel(user.isPhoneVerified)}</div></div>
                     </div>
                     {!user.isPhoneVerified ? (
                         <button onClick={() => setShowVerify(true)} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold shadow-md hover:bg-blue-700 transition">验证手机号</button>
                     ) : (
                         <div className="text-blue-600 text-xs font-bold flex items-center gap-1"><Check size={14}/> 已认证</div>
                     )}
                 </div>

                 <div className="space-y-5">
                     <div><label className="block text-xs font-bold text-gray-500 mb-2 ml-1">昵称</label><input className="w-full p-4 bg-white rounded-2xl border-none outline-none text-sm font-bold text-gray-900 shadow-sm focus:ring-2 focus:ring-green-500/20 transition" value={form.nickname} onChange={e => setForm({...form, nickname: e.target.value})} /></div>
                     <div>
                       <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">一句话介绍</label>
                       <p className="mb-2 text-[10px] text-baylink-muted ml-1">让别人快速了解你是谁、在找什么或提供什么</p>
                       <textarea className="w-full p-4 bg-white rounded-2xl border-none outline-none text-sm h-24 resize-none font-medium text-gray-700 shadow-sm focus:ring-2 focus:ring-green-500/20 transition" value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} placeholder="例如：在南湾工作三年，常发租房和二手信息…" />
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                       <div>
                         <label className="block text-xs font-bold text-gray-500 mb-2 ml-1">所在区域</label>
                         <select className="w-full p-3 bg-white rounded-xl text-sm shadow-sm outline-none focus:ring-2 focus:ring-green-500/20" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })}>
                           <option value="">选择大区</option>
                           {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                         </select>
                       </div>
                       <div>
                         <label className="block text-xs font-bold text-gray-500 mb-2 ml-1">所在城市</label>
                         <input className="w-full p-3 bg-white rounded-xl text-sm shadow-sm outline-none focus:ring-2 focus:ring-green-500/20" placeholder="如 Millbrae" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                       </div>
                     </div>
                     <ProfileTagField
                       label="身份标签"
                       hint="选择最能代表你身份的标签，最多 8 个"
                       presets={PROFILE_TAG_PRESETS}
                       tags={form.profileTags}
                       max={8}
                       onChange={(profileTags) => setForm((p) => ({ ...p, profileTags }))}
                       showToast={showToast}
                     />
                     <ProfileTagField
                       label="兴趣标签"
                       hint="分享你的兴趣，方便附近用户认识你，最多 12 个"
                       presets={INTEREST_PRESETS}
                       tags={form.interests}
                       max={12}
                       onChange={(interests) => setForm((p) => ({ ...p, interests }))}
                       showToast={showToast}
                     />
                     <div className="space-y-3 pt-1">
                       <p className="text-xs font-bold text-gray-500 ml-1">社交链接</p>
                       <div>
                         <label className="block text-[10px] text-baylink-muted mb-1 ml-1">Instagram</label>
                         <input className="w-full p-3 bg-white rounded-xl text-sm shadow-sm outline-none focus:ring-2 focus:ring-green-500/20" placeholder="用户名或完整链接" value={form.socialLinks.instagram} onChange={e => setForm({ ...form, socialLinks: { ...form.socialLinks, instagram: e.target.value } })} />
                       </div>
                       <div>
                         <label className="block text-[10px] text-baylink-muted mb-1 ml-1">小红书</label>
                         <input className="w-full p-3 bg-white rounded-xl text-sm shadow-sm outline-none focus:ring-2 focus:ring-green-500/20" placeholder="主页链接或 ID" value={form.xiaohongshu} onChange={e => setForm({ ...form, xiaohongshu: e.target.value })} />
                       </div>
                       <div>
                         <label className="block text-[10px] text-baylink-muted mb-1 ml-1">个人网站</label>
                         <input className="w-full p-3 bg-white rounded-xl text-sm shadow-sm outline-none focus:ring-2 focus:ring-green-500/20" placeholder="https://..." value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
                       </div>
                     </div>
                 </div>
             </div>
             {showVerify && <PhoneVerificationModal user={user} onClose={() => setShowVerify(false)} onVerified={onUpdate} showToast={showToast} />}
        </div>
    );
};

const AdThumb = ({ src, className, contain }: { src: string; className?: string; contain?: boolean }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={`bg-baylink-section shrink-0 ${className || 'w-14 h-14 rounded-xl'}`} />;
  return <img src={src} alt="" className={`${className || ''} ${contain ? 'ad-thumb-contain' : ''}`} onError={() => setFailed(true)} />;
};

const AdDetailImage = ({ src }: { src: string }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="ad-detail-image-placeholder">图片无法加载</div>;
  return <img src={src} alt="" className="ad-detail-image" onError={() => setFailed(true)} />;
};

const AdDetailModal = ({ ad, onClose, isAdmin, onDelete }: {
  ad: AdDetailItem;
  onClose: () => void;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
}) => {
  const imageUrl = getAdImageUrl(ad);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-full max-w-[calc(100vw-32px)] max-h-[86vh] flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl sm:max-w-[520px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex shrink-0 items-center justify-between border-b border-baylink-border/40 px-5 py-4">
          <h3 className="text-lg font-bold text-baylink-text pr-8">推荐详情</h3>
          <button type="button" onClick={onClose} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-baylink-muted hover:bg-baylink-section" aria-label="关闭"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {imageUrl ? <AdDetailImage src={imageUrl} /> : null}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-0.5 rounded-md bg-baylink-green-light px-2 py-0.5 text-[10px] font-semibold text-baylink-green">
              <Shield size={10} /> 官方推荐
            </span>
            {ad.isDemo && <span className="rounded-md bg-baylink-section px-2 py-0.5 text-[10px] text-baylink-muted">示例推荐</span>}
          </div>
          <h4 className="mt-2 text-xl font-bold leading-snug text-baylink-text">{getAdTitle(ad)}</h4>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-baylink-text-secondary">{getAdContent(ad)}</p>
        </div>
        <div className="shrink-0 border-t border-baylink-border/40 px-5 py-4">
          {isAdmin && !ad.isDemo && onDelete ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => onDelete(ad.id)} className="flex-1 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600">删除</button>
              <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-700">关闭</button>
            </div>
          ) : (
            <button type="button" onClick={onClose} className="w-full rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-800">关闭</button>
          )}
        </div>
      </div>
    </div>
  );
};

const AdFormModal = ({ editingAd, onClose, onChange, onSave }: {
  editingAd: Partial<AdData>;
  onClose: () => void;
  onChange: (patch: Partial<AdData>) => void;
  onSave: () => void;
}) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <h3 className="mb-4 text-lg font-bold">管理官方推荐</h3>
      <div className="space-y-3">
        <input className="w-full rounded-xl border bg-gray-50 p-3 text-sm" placeholder="标题" value={editingAd.title || ''} onChange={(e) => onChange({ title: e.target.value })} />
        <textarea className="h-24 w-full resize-none rounded-xl border bg-gray-50 p-3 text-sm" placeholder="内容描述" value={editingAd.content || ''} onChange={(e) => onChange({ content: e.target.value })} />
        <input className="w-full rounded-xl border bg-gray-50 p-3 text-sm" placeholder="图片直链 URL（可选，需 .jpg/.png/.webp）" value={editingAd.imageUrl || ''} onChange={(e) => onChange({ imageUrl: e.target.value })} />
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-600">取消</button>
          <button type="button" onClick={onSave} className="flex-1 rounded-xl bg-gray-900 py-3 text-sm font-bold text-white">保存发布</button>
        </div>
      </div>
    </div>
  </div>
);

const OfficialAdListCard = ({ ad, isAdmin, onOpenDetail, onDelete }: {
  ad: AdData;
  isAdmin: boolean;
  onOpenDetail: (ad: AdDetailItem) => void;
  onDelete: (id: string) => void;
}) => {
  const imageUrl = getAdImageUrl(ad);
  return (
    <div
      role="button"
      tabIndex={0}
      className="relative flex w-full cursor-pointer gap-3 overflow-hidden rounded-2xl border border-baylink-border/60 bg-white p-3.5 shadow-card transition hover:border-baylink-green/25 active:scale-[0.995] sm:rounded-3xl"
      onClick={() => onOpenDetail(toAdDetailItem(ad))}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail(toAdDetailItem(ad)); } }}
    >
      {imageUrl ? (
        <AdThumb src={imageUrl} contain className="h-[88px] w-[88px] shrink-0 rounded-xl sm:h-24 sm:w-24" />
      ) : (
        <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-xl bg-baylink-section sm:h-24 sm:w-24">
          <BadgeCheck size={22} className="text-baylink-muted/40" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
        <span className="mb-1 inline-flex w-fit items-center gap-0.5 rounded-md bg-baylink-green-light px-1.5 py-0.5 text-[9px] font-semibold text-baylink-green">
          <Shield size={8} /> 官方推荐
        </span>
        <div className="line-clamp-2 text-[14px] font-bold leading-snug text-baylink-text">{getAdTitle(ad)}</div>
        <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-baylink-muted">{getAdContent(ad)}</div>
      </div>
      {isAdmin && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(ad.id); }} className="absolute right-2.5 top-2.5 rounded-full bg-white p-1.5 text-red-500 shadow-sm">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
};

const OfficialAds = ({ isAdmin, showToast, onOpenDetail, refreshKey, layout = 'carousel' }: {
  isAdmin: boolean;
  showToast: any;
  onOpenDetail: (ad: AdDetailItem) => void;
  refreshKey?: number;
  layout?: 'carousel' | 'list';
}) => {
  const [ads, setAds] = useState<AdData[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Partial<AdData>>({});
  const fetchAds = async () => { try { setAds(await api.request('/ads')); } catch (e) { console.error('fetch ads', e); } };
  useEffect(() => { fetchAds(); }, [refreshKey]);
  const handleSaveAd = async () => {
    if (!editingAd?.title?.trim()) return showToast('请填写标题', 'error');
    const imageUrl = (editingAd.imageUrl || '').trim();
    const imageErr = validateAdImageUrl(editingAd.imageUrl || '');
    if (imageErr) return showToast(imageErr, 'error');
    const payload = {
      title: editingAd.title.trim(),
      content: (editingAd.content || '').trim(),
      imageUrl,
    };
    try {
      await api.request('/ads', { method: 'POST', body: JSON.stringify(payload) });
      setEditingAd({});
      setIsFormOpen(false);
      fetchAds();
      showToast('推荐已发布', 'success');
    } catch (e: any) {
      showToast(mapAdSaveError(e), 'error');
    }
  };
  const handleDeleteAd = async (id: string) => { if(!confirm('确定删除这条推荐？')) return; try { await api.request(`/ads/${id}`, { method: 'DELETE' }); fetchAds(); showToast('已删除', 'success'); } catch (e: any) { showToast(friendlyErrorMessage(e, '删除失败，请稍后再试'), 'error'); } };
  const emptyState = (
    <div className="w-full rounded-2xl border border-dashed border-baylink-border bg-white p-6 text-center">
      <BadgeCheck size={22} className="mx-auto mb-2 text-baylink-muted opacity-50" />
      <p className="text-sm font-semibold text-baylink-text-secondary">暂无推荐内容</p>
      <p className="mt-1 text-[11px] leading-relaxed text-baylink-muted">管理员添加的官方推荐和认证广告会显示在这里</p>
    </div>
  );

  return (
    <div className={layout === 'list' ? 'w-full' : 'mb-6'}>
      <div className={`flex items-center justify-between px-1 ${layout === 'list' ? 'mb-4' : 'mb-3'}`}>
        {layout === 'carousel' ? (
          <h3 className="flex items-center gap-1 text-sm font-bold text-baylink-text"><BadgeCheck size={14} className="text-baylink-green" /> 官方推荐</h3>
        ) : (
          <span className="sr-only">官方推荐列表</span>
        )}
        {isAdmin && (
          <button type="button" onClick={() => { setEditingAd({ title: '', content: '', imageUrl: '' }); setIsFormOpen(true); }} className="flex items-center gap-1 rounded-lg bg-baylink-green px-2.5 py-1.5 text-[10px] font-semibold text-white transition hover:bg-baylink-green-hover sm:text-xs">
            <Plus size={12} /> 添加
          </button>
        )}
      </div>
      {ads.length > 0 ? (
        layout === 'list' ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {ads.map((ad) => (
              <OfficialAdListCard key={ad.id} ad={ad} isAdmin={isAdmin} onOpenDetail={onOpenDetail} onDelete={handleDeleteAd} />
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar snap-x px-1">
            {ads.map((ad) => (
              <div
                key={ad.id}
                role="button"
                tabIndex={0}
                className="group relative flex min-w-[240px] shrink-0 cursor-pointer snap-center gap-3 overflow-hidden rounded-2xl border border-baylink-border/60 bg-white p-3 shadow-card transition hover:border-baylink-green/30"
                onClick={() => onOpenDetail(toAdDetailItem(ad))}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail(toAdDetailItem(ad)); } }}
              >
                <div className="absolute -right-5 -top-5 h-16 w-16 rounded-bl-full bg-baylink-green-light" />
                {getAdImageUrl(ad) && <AdThumb src={getAdImageUrl(ad)} contain className="z-10 h-14 w-14 shrink-0 rounded-xl" />}
                <div className="z-10 flex min-w-0 flex-1 flex-col justify-center">
                  <div className="mb-1 flex items-center gap-1"><span className="inline-flex items-center gap-0.5 rounded-md bg-baylink-green-light px-1.5 py-0.5 text-[9px] font-semibold text-baylink-green"><Shield size={8} /> 官方</span></div>
                  <div className="mb-0.5 line-clamp-1 text-sm font-semibold text-baylink-text">{getAdTitle(ad)}</div>
                  <div className="line-clamp-1 text-[10px] text-baylink-muted">{getAdContent(ad)}</div>
                </div>
                {isAdmin && <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteAd(ad.id); }} className="absolute right-2 top-2 z-20 rounded-full bg-white p-1 text-red-500 shadow-sm"><Trash2 size={12} /></button>}
              </div>
            ))}
          </div>
        )
      ) : emptyState}
      {isFormOpen && (
        <AdFormModal
          editingAd={editingAd}
          onClose={() => { setIsFormOpen(false); setEditingAd({}); }}
          onChange={(patch) => setEditingAd((p) => ({ ...p, ...patch }))}
          onSave={handleSaveAd}
        />
      )}
    </div>
  );
};

const DefaultCoverPicker = ({
  type,
  category,
  selected,
  onSelect,
  expanded,
  onToggleExpanded,
  open,
  onToggleOpen,
}: {
  type: PostType;
  category: string;
  selected: DefaultCover | null;
  onSelect: (cover: DefaultCover | null) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  open: boolean;
  onToggleOpen: () => void;
}) => {
  const { recommended, others } = getRecommendedCovers(type, category);
  const displayCovers = expanded ? [...recommended, ...others] : recommended.slice(0, 4);

  const toggleCover = (cover: DefaultCover) => {
    onSelect(selected?.id === cover.id ? null : cover);
  };

  return (
    <div className="rounded-xl border border-baylink-border/50 bg-white p-3">
      <p className="text-[11px] font-semibold text-baylink-text">没有照片？选择默认封面</p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-baylink-muted">适合求租、找室友、接送、清洁、二手等信息，一键配图更容易被看到。</p>
      {selected && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-baylink-green-light/30 p-2">
          <img src={selected.url} alt={selected.title} className="h-12 w-12 shrink-0 rounded-lg object-contain bg-baylink-section/50" />
          <span className="min-w-0 flex-1 text-[11px] font-semibold text-baylink-text">已选：{selected.title}</span>
          <button type="button" onClick={() => onSelect(null)} className="shrink-0 text-[10px] font-semibold text-baylink-muted hover:text-red-500">清除封面</button>
        </div>
      )}
      <button type="button" onClick={onToggleOpen} className="mt-2 w-full rounded-lg border border-baylink-border/60 bg-baylink-section/40 py-2 text-xs font-semibold text-baylink-text transition hover:border-baylink-green/40">
        {open ? '收起封面' : '选择默认封面'}
      </button>
      {open && (
        <div className="mt-3">
          <p className="mb-2 text-[10px] font-semibold text-baylink-muted">推荐封面</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {displayCovers.map((cover) => {
              const isSelected = selected?.id === cover.id;
              return (
                <button
                  key={cover.id}
                  type="button"
                  onClick={() => toggleCover(cover)}
                  className={`relative overflow-hidden rounded-xl border-2 bg-white p-1 shadow-sm transition ${isSelected ? 'border-baylink-green ring-1 ring-baylink-green/30' : 'border-baylink-border/50 hover:border-baylink-green/35'}`}
                >
                  <img src={cover.url} alt={cover.title} className="aspect-[4/3] w-full rounded-lg object-contain bg-baylink-section/40" />
                  <p className="mt-1 truncate px-0.5 text-center text-[9px] font-medium text-baylink-text-secondary">{cover.title}</p>
                  {isSelected && (
                    <span className="absolute right-1 top-1 rounded-md bg-baylink-green px-1 py-px text-[8px] font-bold text-white">已选择</span>
                  )}
                </button>
              );
            })}
          </div>
          {!expanded && others.length > 0 && (
            <button type="button" onClick={onToggleExpanded} className="mt-2 w-full text-center text-[10px] font-semibold text-baylink-green">
              查看更多封面（共 {DEFAULT_COVERS.length} 张）
            </button>
          )}
          {expanded && (
            <button type="button" onClick={onToggleExpanded} className="mt-2 w-full text-center text-[10px] font-semibold text-baylink-muted">
              收起全部封面
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// --- CreatePostModal ---
const CreatePostModal = ({ onClose, onCreated, onUpdated, user, showToast, defaultType = 'client', defaultCategory, mode = 'create', editingPost }: {
  onClose: () => void;
  onCreated: () => void;
  onUpdated?: () => void;
  user: UserData;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  defaultType?: PostType;
  defaultCategory?: string;
  mode?: 'create' | 'edit';
  editingPost?: PostData | null;
}) => {
  const isEdit = mode === 'edit' && !!editingPost;
  const [step, setStep] = useState(isEdit ? 2 : 1);
  const [form, setForm] = useState(() => isEdit && editingPost ? {
    title: editingPost.title,
    city: editingPost.city || REGIONS[0],
    category: editingPost.category || CATEGORIES[0],
    budget: editingPost.budget || '',
    description: editingPost.description || '',
    timeInfo: editingPost.timeInfo || '',
    type: editingPost.type,
    contactInfo: user?.contactValue || '',
  } : {
    title: '', city: REGIONS[0],
    category: (defaultCategory && CATEGORIES.includes(defaultCategory) ? defaultCategory : CATEGORIES[0]),
    budget: '', description: '', timeInfo: '',
    type: (defaultType || 'client') as PostType, contactInfo: user?.contactValue || '',
  });
  const initialImg = isEdit && editingPost?.imageUrls ? splitPostImages(editingPost.imageUrls) : { uploaded: [], cover: null as DefaultCover | null };
  const [uploadedImages, setUploadedImages] = useState<string[]>(initialImg.uploaded);
  const [selectedDefaultCover, setSelectedDefaultCover] = useState<DefaultCover | null>(initialImg.cover);
  const [coversPickerOpen, setCoversPickerOpen] = useState(false);
  const [coversExpanded, setCoversExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [postTrustWarning, setPostTrustWarning] = useState<string | null>(null);
  const [antiSpamAnswer, setAntiSpamAnswer] = useState('');
  const [imageCompressing, setImageCompressing] = useState(false);
  const [imageCompressHint, setImageCompressHint] = useState<string | null>(null);

  const isClient = form.type === 'client';
  const isAdmin = user?.role === 'admin';
  const hints = getPostWritingHints(form.category, form.type);
  const budgetPlaceholder = isClient ? '预算 / 可支付金额（如: $50/小时）' : '价格 / 收费方式（如: $80起 / 按小时）';

  const typeCardClass = (selected: boolean) =>
    selected ? 'border-baylink-green bg-baylink-green-light text-[#2d6b4f] shadow-sm'
      : 'border-baylink-border bg-white text-baylink-text-secondary hover:border-baylink-green/35';
  const categoryClass = (active: boolean) => active ? 'chip chip-active' : 'chip chip-inactive';

  const addTagToDesc = (tag: string) => {
    setForm((prev) => ({ ...prev, description: prev.description ? `${prev.description} #${tag} ` : `#${tag} ` }));
  };

  const appendQuickTagsToDescription = (description: string, tags: string[]) => {
    const normalized = tags
      .map((t) => String(t).replace(/\s+/g, '').replace(/^#/, '').trim())
      .filter(Boolean)
      .slice(0, 5);
    let desc = description.trim();
    const missing = normalized.filter((tag) => !new RegExp(`#${tag}\\b`, 'i').test(desc));
    if (missing.length === 0) return desc;
    const suffix = missing.map((t) => `#${t}`).join(' ');
    return `${desc}\n\n${suffix}`.trim();
  };

  const applyAiDraft = (draft: AiPostDraft, options?: { appendQuickTags?: boolean }) => {
    setForm((prev) => {
      const next = { ...prev };
      if (draft.title?.trim()) next.title = draft.title.trim();
      let description = draft.description?.trim() || '';
      if (options?.appendQuickTags && draft.quickTags?.length) {
        description = appendQuickTagsToDescription(description, draft.quickTags);
      }
      if (description) next.description = description;
      if (draft.type === 'client' || draft.type === 'provider') next.type = draft.type;
      const catLabel = getCategoryFromSlug(draft.category);
      if (catLabel && catLabel !== '全部' && CATEGORIES.includes(catLabel)) next.category = catLabel;
      if (draft.budget?.trim()) next.budget = draft.budget.trim();
      if (draft.timeInfo?.trim()) next.timeInfo = draft.timeInfo.trim();
      next.city = resolveCityFromDraft(draft, prev.city);
      return next;
    });
    if (uploadedImages.length === 0 && draft.coverSuggestion?.startsWith('/default-covers/')) {
      const cover = findDefaultCoverFromUrl(draft.coverSuggestion);
      if (cover) setSelectedDefaultCover(cover);
    }
    showToast('BayBay 已帮你填好草稿，你可以继续修改后发布', 'success');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const files = input.files;
    if (!files?.length) return;

    if (uploadedImages.length + files.length > 3) {
      showToast('最多只能上传3张图片', 'error');
      input.value = '';
      return;
    }

    setImageCompressing(true);
    setImageCompressHint('图片处理中...');

    const newImages: string[] = [];
    let anyCompressed = false;

    try {
      for (const file of Array.from(files)) {
        if (!isLikelyImageFile(file)) continue;

        if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
          showToast('图片过大，请换一张或截图后上传', 'error');
          continue;
        }

        try {
          const result = await compressImageFile(file);
          if (result.compressed) anyCompressed = true;
          const dataUrl = await fileToDataUrl(result.file);
          newImages.push(dataUrl);
        } catch (err) {
          console.warn('[CreatePost] image compress/read failed, using original', err);
          try {
            const dataUrl = await fileToDataUrl(file);
            newImages.push(dataUrl);
          } catch { /* skip broken file */ }
        }
      }

      if (newImages.length > 0) {
        setUploadedImages((prev) => [...prev, ...newImages].slice(0, 3));
      }

      setImageCompressHint(anyCompressed ? '图片已优化，上传更快' : null);
    } finally {
      setImageCompressing(false);
      input.value = '';
    }
  };

  const handleSubmit = async () => {
    const err = validatePostForm(form);
    if (err) return showToast(err, 'error');
    if (!isEdit && !isAdmin && antiSpamAnswer !== '旧金山湾区') {
      return showToast('请先完成验证', 'error');
    }
    setSubmitting(true);
    const finalImageUrls = buildSubmitImageUrls(uploadedImages, selectedDefaultCover);
    const payload = { ...form, imageUrls: finalImageUrls };
    try {
      if (isEdit && editingPost) {
        await api.request(`/posts/${editingPost.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        onUpdated?.();
        onCreated();
        showToast('信息已更新', 'success');
        onClose();
      } else {
        const res = await api.request('/posts', { method: 'POST', body: JSON.stringify(payload) });
        onCreated();
        const warning = typeof res?.trustWarning === 'string' ? res.trustWarning : null;
        setPostTrustWarning(warning);
        setIsSuccess(true);
        if (warning) showToast(warning, 'info');
      }
    } catch (err: any) {
      const toastMsg = mapPostSaveError(err, isEdit);
      if (/image|upload|图片/i.test(err?.error || '')) showToast('图片上传失败，请换一张图', 'error');
      else showToast(toastMsg, 'error');
      setSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-md animate-in zoom-in-95">
        <div className="relative m-4 w-full max-w-sm overflow-hidden rounded-[28px] border border-black/[0.04] bg-baylink-bg-alt/95 p-8 text-center shadow-elevated backdrop-blur-xl">
           <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-baylink-green-light text-baylink-green">
              <CheckCircle size={36} />
           </div>
           <h2 className="mb-2 text-xl font-bold text-baylink-text">发布成功</h2>
           <p className="mb-4 text-sm text-baylink-muted">你的信息已推送给湾区邻居们。</p>
           {postTrustWarning && (
             <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs leading-relaxed text-amber-800">
               {postTrustWarning}
             </p>
           )}
           <button onClick={onClose} className="w-full py-3.5 btn-primary">知道了</button>
        </div>
      </div>
    );
  }

  const goToStep3 = () => {
    const err = validatePostForm(form);
    if (err) return showToast(err, 'error');
    setStep(3);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[70]">
      <div className="bg-baylink-bg w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto pb-safe-bar shadow-2xl border border-baylink-border/40">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-lg font-bold text-baylink-text">{isEdit ? '编辑信息' : '发布信息'}</h3>
            <span className="text-[11px] text-baylink-muted">Step {step}/3</span>
          </div>
          <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-baylink-section border border-baylink-border/50"><X size={18} className="text-baylink-muted"/></button>
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-baylink-text mb-0.5">你想发布什么？</label>
              <p className="text-[11px] text-baylink-muted mb-3">选择后，我们会帮你匹配更合适的展示方式</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setForm({...form, type: 'client'})}
                  className={`flex-1 p-3.5 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${typeCardClass(form.type==='client')}`}
                >
                  {form.type === 'client' && <span className="text-[9px] font-semibold bg-baylink-green/15 text-baylink-green px-1.5 py-px rounded mb-1.5 inline-block">当前选择</span>}
                  <div className="text-sm font-bold leading-tight">发布需求</div>
                  <div className="text-[11px] mt-1 opacity-90 leading-snug">找房、找人帮忙、找服务</div>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({...form, type: 'provider'})}
                  className={`flex-1 p-3.5 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${typeCardClass(form.type==='provider')}`}
                >
                  {form.type === 'provider' && <span className="text-[9px] font-semibold bg-baylink-green/15 text-baylink-green px-1.5 py-px rounded mb-1.5 inline-block">当前选择</span>}
                  <div className="text-sm font-bold leading-tight">提供资源</div>
                  <div className="text-[11px] mt-1 opacity-90 leading-snug">房源、二手、服务、接送</div>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-baylink-text mb-2">选择分类</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button key={c} type="button" onClick={() => setForm({...form, category: c})} className={categoryClass(form.category===c)}>{c}</button>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => setStep(2)} className="w-full py-3.5 btn-primary mt-2">下一步</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <BayBayPostAssist
              postType={form.type}
              categorySlug={getSlugFromCategory(form.category)}
              areaHint={form.city}
              user={user}
              showToast={showToast}
              onApply={applyAiDraft}
              requestAiAssist={(body) =>
                api.request('/ai/post-assist', { method: 'POST', body: JSON.stringify(body) })
              }
            />
            <div>
              <div className="mb-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0 px-0.5">
                <span className="text-[11px] font-semibold text-baylink-text">帖子标题</span>
                <span className="text-[10px] text-baylink-muted">一句话说清楚需求或服务</span>
              </div>
              <input
                className="w-full p-4 bg-white rounded-xl font-semibold text-base outline-none border border-baylink-border/60 placeholder:text-baylink-muted focus:border-baylink-green/40 focus:ring-1 focus:ring-baylink-green/10"
                placeholder={hints.titlePlaceholder}
                value={form.title}
                maxLength={80}
                onChange={e => setForm({...form, title: e.target.value})}
              />
            </div>
            {hints.quickTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {hints.quickTags.map((tag) => (
                  <button key={tag} type="button" onClick={() => addTagToDesc(tag)} className="text-[10px] bg-white text-baylink-text-secondary px-2 py-1 rounded-md border border-baylink-border hover:border-baylink-green/40 hover:bg-baylink-green-light/50 active:scale-95 transition">#{tag}</button>
                ))}
              </div>
            )}
            {hints.checklist.length > 0 && (
              <p className="text-[10px] text-baylink-muted leading-relaxed px-0.5">建议包含：{hints.checklist.join('、')}</p>
            )}
            <div>
              <div className="mb-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0 px-0.5">
                <span className="text-[11px] font-semibold text-baylink-text">详细内容</span>
                <span className="text-[10px] text-baylink-muted">补充位置、价格、时间、联系方式等</span>
              </div>
              <textarea
                className="w-full p-4 bg-white rounded-xl h-36 resize-none outline-none border border-baylink-border/60 placeholder:text-baylink-muted text-sm leading-relaxed focus:border-baylink-green/40 focus:ring-1 focus:ring-baylink-green/10"
                placeholder={hints.descriptionPlaceholder}
                value={form.description}
                maxLength={2000}
                onChange={e => setForm({...form, description: e.target.value})}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {uploadedImages.map((img, i) => (
                <div key={i} className="relative shrink-0">
                  <img src={img} alt="" className="h-[72px] w-[72px] rounded-xl border border-baylink-border/50 object-cover" />
                  <button type="button" onClick={() => setUploadedImages((prev) => prev.filter((_, idx) => idx !== i))} className="absolute -right-1 -top-1 rounded-full bg-white p-0.5 text-red-500 shadow-sm"><X size={12} /></button>
                </div>
              ))}
              {uploadedImages.length < 3 && (
                <label
                  htmlFor="create-post-image-input"
                  className="relative flex h-[72px] w-[72px] shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-baylink-border bg-white text-baylink-muted transition hover:border-baylink-green/50 hover:text-baylink-green"
                >
                  <input
                    id="create-post-image-input"
                    type="file"
                    accept="image/*"
                    multiple
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                    onChange={handleImageUpload}
                    aria-label="添加图片"
                  />
                  <span className="pointer-events-none flex flex-col items-center justify-center">
                    {imageCompressing ? <Loader2 size={18} className="animate-spin text-baylink-green" /> : <Plus size={18} />}
                    <span className="mt-0.5 text-[10px]">{imageCompressing ? '处理中' : '添加图片'}</span>
                  </span>
                </label>
              )}
            </div>
            {imageCompressing && (
              <p className="flex items-center gap-1 text-[10px] text-baylink-muted px-0.5">
                <Loader2 size={11} className="animate-spin" /> 图片处理中...
              </p>
            )}
            {!imageCompressing && imageCompressHint && (
              <p className="text-[10px] text-baylink-green px-0.5">{imageCompressHint}</p>
            )}
            {uploadedImages.length > 0 && (
              <p className="text-[10px] text-baylink-muted px-0.5">已上传真实照片，发布时将优先使用照片</p>
            )}
            <DefaultCoverPicker
              type={form.type}
              category={form.category}
              selected={selectedDefaultCover}
              onSelect={setSelectedDefaultCover}
              open={coversPickerOpen}
              onToggleOpen={() => setCoversPickerOpen((v) => !v)}
              expanded={coversExpanded}
              onToggleExpanded={() => setCoversExpanded((v) => !v)}
            />

            <div className="flex gap-2 mt-3">
              <button type="button" onClick={()=>setStep(1)} className="flex-1 py-3 bg-white text-baylink-text-secondary rounded-xl font-semibold border border-baylink-border hover:bg-baylink-section/50">上一步</button>
              <button type="button" onClick={goToStep3} className="flex-[2] py-3 btn-primary">下一步</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-baylink-text-secondary mb-2">选择地区</label>
              <div className="grid grid-cols-2 gap-2">
                {REGIONS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm({...form, city: r})}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${form.city===r ? 'chip-active' : 'chip-inactive'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white p-1 rounded-xl border border-baylink-border/60">
              <input
                className="w-full p-3 bg-transparent outline-none font-semibold text-center text-base placeholder:text-baylink-muted"
                placeholder={budgetPlaceholder}
                value={form.budget}
                maxLength={30}
                onChange={e => setForm({...form, budget: e.target.value})}
              />
            </div>
            <div className="bg-white p-1 rounded-xl border border-baylink-border/60">
              <input
                className="w-full p-3 bg-transparent outline-none font-medium text-center text-sm placeholder:text-baylink-muted"
                placeholder="可服务 / 需要的时间（如: 周末、本周）"
                value={form.timeInfo}
                onChange={e => setForm({...form, timeInfo: e.target.value})}
              />
            </div>
            {!isEdit && !isAdmin && (
              <div className="rounded-xl border border-baylink-border/60 bg-white p-3">
                <p className="text-xs font-semibold text-baylink-text mb-2">为了防止垃圾内容，请完成验证</p>
                <p className="text-[11px] text-baylink-muted mb-2">BayLink 主要服务哪个地区？</p>
                <div className="space-y-1.5">
                  {['旧金山湾区', '纽约', '洛杉矶'].map((opt) => (
                    <label key={opt} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer ${antiSpamAnswer === opt ? 'border-baylink-green bg-baylink-green-light/40' : 'border-baylink-border'}`}>
                      <input type="radio" name="antiSpam" className="accent-baylink-green" checked={antiSpamAnswer === opt} onChange={() => setAntiSpamAnswer(opt)} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={()=>setStep(2)} className="flex-1 py-3 bg-white text-baylink-text-secondary rounded-xl font-semibold border border-baylink-border">上一步</button>
              <button type="button" onClick={handleSubmit} disabled={submitting} className="flex-[2] py-3 btn-primary disabled:opacity-50">
                {submitting ? (isEdit ? '保存中...' : '发布中...') : (isEdit ? '保存修改' : '确认发布')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const LoginModal = ({ onClose, onLogin, showToast, onForgotPassword }: { onClose: () => void; onLogin: (user: UserData) => void; showToast: (message: string, type?: 'success' | 'error' | 'info') => void; onForgotPassword: () => void }) => {
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', nickname: '', contactType: 'wechat', contactValue: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'register') {
      if (!form.email.trim() || !form.password || !form.nickname.trim() || !form.contactValue.trim()) {
        setError('请填写完整注册信息');
        return;
      }
      if (!validateEmail(form.email)) {
        setError('请输入有效的邮箱地址');
        return;
      }
      if (!validatePassword(form.password)) {
        setError('密码至少8位，并包含大写字母、小写字母和数字');
        return;
      }
      if (!confirmPassword) {
        setError('请再次输入密码');
        return;
      }
      if (form.password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
    }

    setLoading(true);
    try {
      const payload = { email: form.email, password: form.password, nickname: form.nickname, contactType: form.contactType, contactValue: form.contactValue };
      const user = await api.request(mode === 'register' ? '/auth/register' : '/auth/login', { method: 'POST', body: JSON.stringify(payload) });
      localStorage.setItem('currentUser', JSON.stringify(user));
      onLogin(user);
      onClose();
      showToast(mode === 'register' ? '欢迎加入 BayLink!' : '欢迎回来', 'success');
      if (mode === 'login') showAccountStatusNotice(user, showToast);
    } catch (e: any) {
      setError(mapAuthError(e, mode === 'register' ? 'register' : 'login'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full rounded-2xl border border-black/[0.06] bg-white/90 p-3.5 text-sm font-medium text-baylink-text outline-none placeholder:text-baylink-muted focus:border-baylink-green/40 focus:ring-2 focus:ring-baylink-green/15';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-6 backdrop-blur-md animate-in fade-in">
      <div className="relative max-h-[90vh] w-full max-w-xs overflow-y-auto rounded-[28px] border border-black/[0.04] bg-baylink-bg-alt/95 p-7 shadow-elevated backdrop-blur-xl">
        <AuthBrandHeader />
        <p className="-mt-3 mb-5 text-center text-[12px] font-medium text-baylink-text">{mode === 'register' ? '创建你的湾区账号' : '欢迎回来'}</p>
        {error && <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-600"><AlertCircle size={14} />{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
            <input required type={mode === 'register' ? 'email' : 'text'} autoComplete={mode === 'register' ? 'email' : 'username'} className={inputClass} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder={mode === 'register' ? '邮箱地址' : '邮箱账号'} />
            <input required type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} className={inputClass} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="密码" />
            {mode === 'register' && (
              <>
                <input required type="password" autoComplete="new-password" className={inputClass} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="确认密码" />
                <input required className={inputClass} value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} placeholder="社区昵称" />
                <input required className={inputClass} value={form.contactValue} onChange={e => setForm({ ...form, contactValue: e.target.value })} placeholder="微信号 / 电话" />
              </>
            )}
            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-[11px] font-semibold text-baylink-muted hover:text-baylink-green"
                >
                  忘记密码?
                </button>
              </div>
            )}
            {mode === 'register' && (
              <p className="px-1 text-center text-[11px] leading-relaxed text-baylink-muted">
                注册即代表你同意
                <a href="/terms" className="mx-0.5 font-semibold text-baylink-green hover:underline">《服务条款》</a>
                和
                <a href="/privacy" className="mx-0.5 font-semibold text-baylink-green hover:underline">《隐私政策》</a>
              </p>
            )}
            <button disabled={loading} className="w-full rounded-2xl bg-baylink-green py-3.5 font-semibold text-white shadow-rest transition hover:bg-baylink-green-hover active:scale-[0.98] disabled:opacity-60">{loading ? '处理中...' : (mode === 'register' ? '注册账号' : '立即登录')}</button>
        </form>
        <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setConfirmPassword(''); }} className="mt-5 w-full text-center text-xs text-baylink-muted hover:text-baylink-text">{mode === 'login' ? '还没有账号？去注册' : '已有账号？去登录'}</button>
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full border border-black/[0.06] bg-white/90 p-2 text-baylink-muted transition hover:text-baylink-text"><X size={18} /></button>
      </div>
    </div>
  );
};

const extractQuickTagsFromDescription = (description: string): string[] => {
  const matches = String(description || '').match(/#([^\s#]+)/g) || [];
  return [...new Set(matches.map((m) => m.slice(1).trim()).filter(Boolean))].slice(0, 8);
};

const formatPostDetailAuthorMeta = (post: PostData) => {
  const author = post.author as PostData['author'] & {
    city?: string;
    area?: string;
    profileTags?: string[];
    role?: string;
  };
  const location =
    post.city?.trim() ||
    author.city?.trim() ||
    author.area?.trim() ||
    formatProfileLocation(author.area, author.city) ||
    '';
  const tagLabel = author.profileTags?.map((t) => t?.trim()).filter(Boolean)?.[0];
  let identity = tagLabel;
  if (!identity) {
    if (author.isOfficialVerified) identity = '官方认证';
    else if (author.role === 'admin') identity = '管理员';
    else identity = '社区用户';
  }
  const dateStr = new Date(post.createdAt).toLocaleDateString();
  const parts = [location, identity, dateStr];
  if (isPostEdited(post)) parts.push('已编辑');
  return parts.filter((p) => p && String(p).trim()).join(' · ');
};

const PostDetailModal = ({ post, onClose, currentUser, onLoginNeeded, onOpenChat, onOpenUserProfile, onDeleted, onEdit, onToggleFeature, onImageClick, onShare, showToast, onReport, onToggleBlockUser, blockedUserIds, detailRefreshing }: any) => {
  const [comments, setComments] = useState(post.comments || []);
  const [input, setInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setComments(post.comments || []);
  }, [post.id, post.comments]);
  const isAdmin = currentUser?.role === 'admin';
  const isOwner = currentUser?.id === post.authorId;
  const showReport = !isOwner;
  const hasMenu = showReport || isAdmin || isOwner;
  const authorName = post.author?.nickname || '匿名用户';
  const authorAvatar = post.author?.avatar;
  const authorId = post.authorId;
  const canOpenProfile = !!authorId && !!onOpenUserProfile;
  const imageUrls = normalizePostImages(post);
  const quickTags = extractQuickTagsFromDescription(post.description);

  const handleOpenAuthorProfile = () => {
    if (!canOpenProfile) return;
    onOpenUserProfile(authorId);
  };

  const postComment = async () => {
    if (!currentUser) return onLoginNeeded();
    if (!input.trim()) return;
    try {
      const c = await api.request(`/posts/${post.id}/comments`, { method: 'POST', body: JSON.stringify({ content: input }) });
      setComments([...comments, c]);
      setInput('');
      showToast('评论已发送', 'success');
    } catch {
      showToast('评论失败', 'error');
    }
  };

  const deletePost = async () => {
    if (!confirm('删除此贴？')) return;
    try {
      await api.request(`/posts/${post.id}`, { method: 'DELETE' });
      onDeleted();
      onClose();
      showToast('帖子已删除', 'success');
    } catch {
      showToast('删除失败', 'error');
    }
  };

  const openReport = () => {
    if (!currentUser) return onLoginNeeded();
    setMenuOpen(false);
    onReport?.(post);
  };

  const chromeIconBtn = 'p-2.5 rounded-full bg-white/75 backdrop-blur-xl border border-black/[0.04] shadow-rest text-baylink-text transition hover:bg-white active:scale-95';

  return (
    <div className="fixed inset-0 bg-baylink-bg z-50 flex flex-col animate-in slide-in-from-bottom-full duration-300 w-full h-full sm:rounded-t-[2rem] sm:top-10 sm:max-w-md sm:mx-auto sm:shadow-elevated">
      <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl pt-safe-top shrink-0">
        <button type="button" onClick={onClose} className={chromeIconBtn} aria-label="关闭"><X size={20} /></button>
        <div className="flex gap-2 items-center">
          <button type="button" onClick={() => onShare(post)} className={`${chromeIconBtn} hover:text-baylink-green`} aria-label="分享"><Share2 size={20} /></button>
          {hasMenu && (
            <div className="relative">
              <button type="button" onClick={() => setMenuOpen((v) => !v)} className={chromeIconBtn} aria-label="更多">
                <MoreHorizontal size={20} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-1 min-w-[128px] rounded-xl border border-black/[0.06] bg-white py-1 shadow-elevated">
                    {showReport && (
                      <button type="button" onClick={openReport} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-baylink-text-secondary hover:bg-baylink-section/60">
                        <Flag size={13} /> 举报帖子
                      </button>
                    )}
                    {showReport && onToggleBlockUser && authorId && (
                      <button type="button" onClick={() => { setMenuOpen(false); onToggleBlockUser(authorId); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-baylink-text-secondary hover:bg-baylink-section/60">
                        <UserX size={13} /> {blockedUserIds?.includes(authorId) ? '取消屏蔽' : '屏蔽该用户'}
                      </button>
                    )}
                    {isAdmin && (
                      <button type="button" onClick={() => { setMenuOpen(false); onToggleFeature?.(post); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-amber-700 hover:bg-amber-50">
                        <Star size={13} /> {post.isFeatured ? '取消热门推荐' : '加入热门推荐'}
                      </button>
                    )}
                    {(isAdmin || isOwner) && (
                      <button type="button" onClick={() => { setMenuOpen(false); onEdit?.(post); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-baylink-text hover:bg-baylink-section/60">
                        <Edit size={13} /> 编辑
                      </button>
                    )}
                    {(isAdmin || isOwner) && (
                      <button type="button" onClick={() => { setMenuOpen(false); deletePost(); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50">
                        <Trash2 size={13} /> 删除
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5 pb-32 bg-baylink-bg">
        <h1 className="text-[24px] sm:text-[28px] font-semibold tracking-tight text-baylink-text mb-5 leading-tight">{post.title}</h1>
        <div className="surface-card flex gap-2.5 mb-6 items-center p-3">
          <button
            type="button"
            disabled={!canOpenProfile}
            onClick={handleOpenAuthorProfile}
            className={`shrink-0 rounded-full transition ${canOpenProfile ? 'cursor-pointer hover:opacity-80 active:scale-95' : 'cursor-default'}`}
            aria-label={canOpenProfile ? `查看 ${authorName} 的资料` : undefined}
          >
            <Avatar src={authorAvatar} name={authorName} size={10} />
          </button>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              disabled={!canOpenProfile}
              onClick={handleOpenAuthorProfile}
              className={`flex max-w-full items-center gap-1 text-left text-[15px] font-semibold text-baylink-text transition ${canOpenProfile ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
            >
              <span className="truncate">{authorName}</span>
              <TrustBadge user={post.author} size={10} />
            </button>
            <p className="type-footnote mt-0.5 line-clamp-2 leading-snug">{formatPostDetailAuthorMeta(post)}</p>
          </div>
          <button type="button" onClick={() => { if (!currentUser) return onLoginNeeded(); onOpenChat(post.authorId, authorName, post.title); }} className="shrink-0 bg-baylink-green text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-rest hover:bg-baylink-green-hover active:scale-95 transition">私信</button>
        </div>
        {(post.budget || post.timeInfo || post.category || post.city || quickTags.length > 0) && (
          <div className="surface-card mb-5 p-3.5 space-y-2">
            {detailRefreshing && (
              <p className="type-caption text-baylink-muted flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> 正在同步最新内容…</p>
            )}
            <div className="flex flex-wrap gap-2">
              {post.category && (
                <span className="rounded-lg bg-baylink-section/80 px-2.5 py-1 text-[11px] font-semibold text-baylink-text-secondary">分类：{post.category}</span>
              )}
              {post.city && (
                <span className="rounded-lg bg-baylink-section/80 px-2.5 py-1 text-[11px] font-semibold text-baylink-text-secondary">区域：{post.city}</span>
              )}
              {post.budget && (
                <span className="rounded-lg bg-baylink-green/[0.08] px-2.5 py-1 text-[11px] font-bold text-baylink-green">预算/价格：{post.budget}</span>
              )}
              {post.timeInfo && (
                <span className="rounded-lg bg-baylink-section/80 px-2.5 py-1 text-[11px] font-semibold text-baylink-text-secondary">时间：{post.timeInfo}</span>
              )}
            </div>
            {quickTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {quickTags.map((tag) => (
                  <span key={tag} className="rounded-full border border-baylink-green/15 bg-baylink-green/[0.06] px-2 py-0.5 text-[10px] font-medium text-baylink-green">#{tag}</span>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="mb-6 whitespace-pre-wrap text-[16px] leading-7 text-baylink-text-secondary">{post.description}</p>
        <div className="space-y-3 mb-8">
          {imageUrls.map((u: string, i: number) => (
            <div key={i} className="relative overflow-hidden rounded-[22px] bg-baylink-section/50">
              <img
                src={u}
                alt=""
                onClick={() => onImageClick(u)}
                className={`w-full cursor-zoom-in rounded-[22px] shadow-rest transition hover:opacity-95 ${isDefaultCoverUrl(u) ? 'max-h-[360px] object-contain bg-baylink-section/80 p-2' : ''}`}
              />
              {isDefaultCoverUrl(u) && (
                <span className="absolute left-3 top-3 rounded-md bg-black/40 px-1.5 py-0.5 type-caption text-white/90">系统封面</span>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-baylink-border/50 pt-6">
          <h3 className="type-section-title mb-4 flex items-center gap-2"><MessageSquare size={18} className="text-baylink-green" /> 评论 ({comments.length})</h3>
          {comments.length === 0 ? <div className="text-center type-footnote text-baylink-muted py-6">暂无评论，快来抢沙发~</div> : comments.map((c: any) => (
            <div key={c.id} className="surface-card p-3.5 mb-3 text-[15px] leading-relaxed">
              <span className="font-semibold text-baylink-text mr-2">{c.authorName}</span>
              <span className="text-baylink-text-secondary">{c.content}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-black/[0.06] px-4 pt-3 pb-safe-bar flex gap-3 items-center bg-white/80 backdrop-blur-xl absolute bottom-0 w-full">
        <input className="flex-1 bg-white border border-black/[0.06] rounded-full px-5 py-3 outline-none text-[15px] text-baylink-text transition placeholder:text-baylink-muted focus:border-baylink-green/40 focus:ring-2 focus:ring-baylink-green/15" placeholder="写下你的评论..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && postComment()} />
        <button type="button" onClick={postComment} className={`p-3 rounded-full text-white transition active:scale-90 ${input.trim() ? 'bg-baylink-green shadow-rest hover:bg-baylink-green-hover' : 'bg-baylink-border'}`} disabled={!input.trim()} aria-label="发送评论"><Send size={20} /></button>
      </div>
    </div>
  );
};

const ChatView = ({ currentUser, conversation, onClose, socket, onViewProfile, onToggleBlockUser, blockedUserIds, showToast }: any) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.request(`/conversations/${conversation.id}/messages`);
        setMessages(data);
      } catch {}
    };
    load();
  }, [conversation.id]);

  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = (msg: Message) => {
      if (msg.conversationId === conversation.id) {
        setMessages(prev => [...prev, msg]);
      }
    };
    socket.on('new_message', handleNewMessage);
    return () => { socket.off('new_message', handleNewMessage); };
  }, [socket, conversation.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const send = async (type: Message['type'], content: string) => {
    if (sending) return;
    if (!content && type === 'text') return;
    const optimisticMsg: Message = { id: Date.now().toString(), senderId: currentUser.id, conversationId: conversation.id, type, content, createdAt: Date.now() };
    const prevInput = input;
    setMessages(prev => [...prev, optimisticMsg]);
    if (type === 'text') setInput('');
    setSending(true);
    try {
      await api.request(`/conversations/${conversation.id}/messages`, { method: 'POST', body: JSON.stringify({ type, content }) });
    } catch (err: any) {
      setMessages(prev => prev.filter((m) => m.id !== optimisticMsg.id));
      if (type === 'text') setInput(prevInput);
      showToast?.(friendlyErrorMessage(err, '发送失败，请稍后再试'), 'error');
    } finally {
      setSending(false);
    }
  };

  const chromeIconBtn = 'shrink-0 rounded-full bg-white/75 backdrop-blur-xl border border-black/[0.04] p-2 text-baylink-text shadow-rest transition hover:bg-white active:scale-95';

  return (
    <div className="fixed inset-0 bg-baylink-bg z-[100] flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-black/[0.06] bg-white/75 backdrop-blur-xl pt-safe-top shrink-0">
        <button type="button" onClick={onClose} className={chromeIconBtn} aria-label="返回"><ChevronLeft size={20} /></button>
        <span className="min-w-0 flex-1 truncate text-[17px] font-semibold text-baylink-text">{conversation.otherUser.nickname}</span>
        <button type="button" onClick={() => onViewProfile?.(conversation.otherUser.id)} className="shrink-0 rounded-xl border border-black/[0.06] bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold text-baylink-text hover:bg-baylink-section/60">
          查看资料
        </button>
        <button
          type="button"
          onClick={() => onToggleBlockUser?.(conversation.otherUser.id)}
          className="shrink-0 rounded-xl border border-black/[0.06] bg-white/80 px-2.5 py-1.5 text-baylink-text-secondary hover:bg-baylink-section/60"
          title={blockedUserIds?.includes(conversation.otherUser.id) ? '取消屏蔽' : '屏蔽用户'}
          aria-label={blockedUserIds?.includes(conversation.otherUser.id) ? '取消屏蔽' : '屏蔽用户'}
        >
          <UserX size={14} className="inline" />
        </button>
      </div>

      <div className="mx-4 mt-3 mb-1 flex items-center gap-2.5 rounded-2xl border border-baylink-green/10 bg-baylink-green/[0.08] px-3.5 py-2.5">
        <div className="shrink-0 rounded-lg bg-white/70 p-1.5 border border-baylink-green/10">
          <FileText size={14} className="text-baylink-green" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="type-caption text-baylink-muted">正在沟通</div>
          <div className="text-[13px] font-medium text-baylink-text line-clamp-1">{conversation.lastPostTitle || '互助需求沟通'}</div>
        </div>
        <span className="type-caption shrink-0 rounded-full border border-baylink-green/10 bg-white/70 px-2 py-0.5 text-baylink-text-secondary">交易前请核实</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5" ref={scrollRef}>
        {messages.map((m, i) => {
          const isMine = m.senderId === currentUser.id;
          const nextMsg = messages[i + 1];
          const showOtherAvatar = !isMine && (!nextMsg || nextMsg.senderId === currentUser.id);
          return (
            <div key={m.id} className={`flex items-end gap-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
              {!isMine && (
                showOtherAvatar ? (
                  <Avatar
                    src={conversation.otherUser.avatar}
                    name={conversation.otherUser.nickname}
                    size={7}
                    className="shrink-0 self-end mb-1"
                  />
                ) : (
                  <div className="mb-1 w-7 h-7 shrink-0 self-end" aria-hidden />
                )
              )}
              <div
                className={`max-w-[75%] px-4 py-3 rounded-2xl text-[15px] leading-relaxed ${
                  isMine
                    ? 'bg-baylink-ink text-white shadow-rest rounded-tr-md'
                    : 'bg-white border border-black/[0.04] text-baylink-text shadow-rest rounded-tl-md'
                }`}
              >
                {m.content}
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-black/[0.06] px-3 pt-2.5 pb-safe-bar flex gap-2.5 items-center bg-white/80 backdrop-blur-xl shrink-0">
        <button
          type="button"
          onClick={() => confirm('确定向对方分享你的联系方式？') && send('contact-share', '')}
          disabled={sending}
          className="shrink-0 rounded-full border border-black/[0.06] bg-baylink-section/50 p-2.5 text-baylink-text-secondary transition hover:bg-baylink-section active:scale-95 disabled:opacity-50"
          aria-label="分享联系方式"
        >
          <Phone size={18} />
        </button>
        <input
          className="flex-1 bg-white border border-black/[0.06] rounded-full px-5 py-3 outline-none text-[15px] text-baylink-text placeholder:text-baylink-muted focus:border-baylink-green/40 focus:ring-2 focus:ring-baylink-green/15"
          placeholder="输入消息..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !sending && input.trim() && send('text', input)}
        />
        <button
          type="button"
          onClick={() => send('text', input)}
          disabled={!input.trim() || sending}
          className={`shrink-0 p-3 rounded-full text-white transition active:scale-90 disabled:opacity-50 ${input.trim() && !sending ? 'bg-baylink-green shadow-rest hover:bg-baylink-green-hover' : 'bg-baylink-border'}`}
          aria-label="发送消息"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
};

type ModerationLogItem = {
  id: string;
  admin: { id: string; nickname: string };
  action: string;
  targetType: string;
  targetId: string;
  targetUserId?: string;
  targetPostId?: string;
  targetReportId?: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  note?: string;
  createdAt: number;
};

type AdminReportItem = {
  id: string;
  reporter: { id: string; nickname: string; avatar?: string; isPhoneVerified?: boolean; isOfficialVerified?: boolean; accountStatus?: string } | null;
  targetType: 'post' | 'user';
  targetId: string;
  reason: string;
  detail: string;
  status: string;
  adminNote?: string;
  createdAt: number;
  reviewedAt?: number | null;
  targetUser: {
    id: string;
    nickname: string;
    avatar?: string;
    isPhoneVerified?: boolean;
    isOfficialVerified?: boolean;
    accountStatus?: string;
    accountStatusReason?: string;
    accountStatusUpdatedAt?: number | null;
    accountStatusUpdatedBy?: string;
  } | null;
  targetPost: { id: string; title: string; category?: string; area?: string; createdAt?: number; adminHidden?: boolean } | null;
};

type OfficialVerificationRequestItem = {
  id: string;
  userId?: string;
  nickname: string;
  avatar?: string;
  isPhoneVerified?: boolean;
  phoneVerifiedAt?: number | null;
  isOfficialVerified?: boolean;
  officialVerification: {
    status: string;
    type?: string;
    description?: string;
    website?: string;
    license?: string;
    socialLink?: string;
    submittedAt?: number;
    reviewedAt?: number | null;
    rejectionReason?: string;
  };
};

const getOfficialRequestUserId = (r: OfficialVerificationRequestItem) => r.id || r.userId || '';

const AdminOfficialVerificationsView = ({ onBack, showToast }: { onBack: () => void; showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) => {
  const [requests, setRequests] = useState<OfficialVerificationRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getOfficialVerificationRequests('pending');
      setRequests(Array.isArray(res.requests) ? res.requests : []);
    } catch (e: any) {
      showToast(e?.error || '加载认证申请失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (userId: string) => {
    if (!confirm('确认通过该用户的官方认证？')) return;
    setUpdatingId(userId);
    try {
      await api.reviewOfficialVerification(userId, { status: 'approved' });
      setRequests((prev) => prev.filter((r) => getOfficialRequestUserId(r) !== userId));
      showToast('已通过官方认证', 'success');
    } catch (e: any) {
      showToast(friendlyErrorMessage(e, '操作失败，请稍后再试'), 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReject = async (userId: string) => {
    if (!confirm('确认拒绝该认证申请？')) return;
    setUpdatingId(userId);
    try {
      await api.reviewOfficialVerification(userId, {
        status: 'rejected',
        rejectionReason: rejectReason.trim() || '资料不足，请补充官网或 license 信息。',
      });
      setRequests((prev) => prev.filter((r) => getOfficialRequestUserId(r) !== userId));
      setRejectingId(null);
      setRejectReason('');
      showToast('已拒绝认证申请', 'success');
    } catch (e: any) {
      showToast(friendlyErrorMessage(e, '操作失败，请稍后再试'), 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-[#FAFAFA]">
      <div className="flex items-center gap-3 border-b border-baylink-border/40 bg-white px-4 py-3 pt-safe-top">
        <button type="button" onClick={onBack} className="rounded-full p-2 hover:bg-baylink-section"><ChevronLeft size={20} /></button>
        <h2 className="text-lg font-bold text-baylink-text">官方认证审核</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {loading ? (
          <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-baylink-green" /></div>
        ) : requests.length === 0 ? (
          <p className="py-16 text-center text-sm text-baylink-muted">当前没有待审核的认证申请</p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => {
              const requestUserId = getOfficialRequestUserId(r);
              const phoneVerified = r.isPhoneVerified === true;
              return (
              <div key={requestUserId} className="rounded-2xl border border-baylink-border/50 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <Avatar src={r.avatar} name={r.nickname} size={10} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-baylink-text">{r.nickname}</div>
                    <div className="mt-1 text-xs text-baylink-text-secondary">
                      认证类型：{getOfficialTypeLabel(r.officialVerification?.type) || '—'}
                    </div>
                    <div className="mt-0.5 text-[11px] text-baylink-muted">
                      {getPhoneVerificationTrustLabel(phoneVerified)}
                      {phoneVerified && r.phoneVerifiedAt ? (
                        <span className="ml-1">· {new Date(r.phoneVerifiedAt).toLocaleDateString()}</span>
                      ) : null}
                    </div>
                    {r.officialVerification?.submittedAt && (
                      <div className="text-[10px] text-baylink-muted">申请时间：{new Date(r.officialVerification.submittedAt).toLocaleString()}</div>
                    )}
                  </div>
                </div>
                {!phoneVerified && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                    <span>该用户尚未完成手机验证，建议谨慎审核；你仍然可以通过或拒绝该认证申请。</span>
                  </div>
                )}
                {r.officialVerification?.description && (
                  <p className="mt-3 text-xs leading-relaxed text-baylink-text-secondary">{r.officialVerification.description}</p>
                )}
                <div className="mt-2 space-y-1 text-[11px] text-baylink-muted">
                  {r.officialVerification?.website && <p>网站：{r.officialVerification.website}</p>}
                  {r.officialVerification?.license && <p>资质：{r.officialVerification.license}</p>}
                  {r.officialVerification?.socialLink && <p>社交：{r.officialVerification.socialLink}</p>}
                </div>
                {rejectingId === requestUserId ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      className="w-full rounded-xl border border-baylink-border/50 p-2 text-xs outline-none"
                      placeholder="拒绝原因（可选）"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button type="button" disabled={updatingId === requestUserId} onClick={() => handleReject(requestUserId)} className="flex-1 rounded-lg bg-red-500 py-2 text-xs font-bold text-white disabled:opacity-50">确认拒绝</button>
                      <button type="button" onClick={() => { setRejectingId(null); setRejectReason(''); }} className="rounded-lg border border-baylink-border/60 px-3 py-2 text-xs font-semibold">取消</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button type="button" disabled={updatingId === requestUserId} onClick={() => handleApprove(requestUserId)} className="flex-1 rounded-lg bg-baylink-green py-2 text-xs font-bold text-white disabled:opacity-50">通过</button>
                    <button type="button" disabled={updatingId === requestUserId} onClick={() => setRejectingId(requestUserId)} className="flex-1 rounded-lg border border-baylink-border/60 py-2 text-xs font-semibold text-baylink-text-secondary disabled:opacity-50">拒绝</button>
                  </div>
                )}
              </div>
            );})}
          </div>
        )}
      </div>
    </div>
  );
};

const AdminReportsView = ({ onBack, showToast }: { onBack: () => void; showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) => {
  const [reports, setReports] = useState<AdminReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'open' | 'reviewed' | 'dismissed' | 'all'>('open');
  const [typeFilter, setTypeFilter] = useState<'all' | 'post' | 'user'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<{ userId: string; nickname: string; status: 'active' | 'limited' | 'suspended' } | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logs, setLogs] = useState<ModerationLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminReports(statusFilter, typeFilter);
      setReports(Array.isArray(res.reports) ? res.reports : []);
    } catch (e: any) {
      showToast(e?.error || '加载举报列表失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter, typeFilter]);

  const handleStatus = async (id: string, status: 'open' | 'reviewed' | 'dismissed') => {
    setUpdatingId(id);
    try {
      await api.updateAdminReport(id, { status });
      await load();
      showToast(
        status === 'reviewed' ? '已标记为已处理' : status === 'dismissed' ? '已忽略' : '已重新打开',
        'success',
      );
    } catch (e: any) {
      showToast(friendlyErrorMessage(e, '操作失败，请稍后再试'), 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleHidePost = async (postId: string, hidden: boolean) => {
    setUpdatingId(postId);
    try {
      if (hidden) {
        await api.unhideAdminPost(postId);
        showToast('帖子已恢复公开', 'success');
      } else {
        const reason = window.prompt('隐藏原因（可选）', '疑似违规，等待进一步核实') || '管理员隐藏';
        await api.hideAdminPost(postId, reason);
        showToast('帖子已从公开列表隐藏', 'success');
      }
      await load();
    } catch (e: any) {
      showToast(friendlyErrorMessage(e, '操作失败，请稍后再试'), 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const statusLabel = (s: string) => {
    if (s === 'open') return '待处理';
    if (s === 'reviewed') return '已处理';
    if (s === 'dismissed') return '已忽略';
    return s;
  };

  const accountStatusActionLabel = (s: 'active' | 'limited' | 'suspended') => {
    if (s === 'limited') return '限制';
    if (s === 'suspended') return '暂停';
    return '恢复正常';
  };

  const openStatusModal = (userId: string, nickname: string, status: 'active' | 'limited' | 'suspended') => {
    setStatusModal({ userId, nickname, status });
    setStatusReason('');
  };

  const handleAccountStatusUpdate = async () => {
    if (!statusModal) return;
    setUpdatingId(statusModal.userId);
    try {
      await api.updateAdminAccountStatus(statusModal.userId, {
        status: statusModal.status,
        reason: statusReason.trim() || undefined,
      });
      showToast(`已将 ${statusModal.nickname} 设为${ACCOUNT_STATUS_LABELS[statusModal.status]}`, 'success');
      setStatusModal(null);
      setStatusReason('');
      await load();
    } catch (e: any) {
      showToast(friendlyErrorMessage(e, '更新账号状态失败'), 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const openLogsModal = async () => {
    setShowLogsModal(true);
    setLogsLoading(true);
    try {
      const res = await api.getModerationLogs(50);
      setLogs(Array.isArray(res.logs) ? res.logs : []);
    } catch (e: any) {
      showToast(e?.error || '加载操作日志失败', 'error');
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-[#FAFAFA]">
      <div className="flex items-center gap-3 border-b border-baylink-border/40 bg-white px-4 py-3 pt-safe-top">
        <button type="button" onClick={onBack} className="rounded-full p-2 hover:bg-baylink-section"><ChevronLeft size={20} /></button>
        <h2 className="flex-1 text-lg font-bold text-baylink-text">举报管理</h2>
        <button type="button" onClick={openLogsModal} className="rounded-lg border border-baylink-border/50 px-3 py-1.5 text-[11px] font-semibold text-baylink-text-secondary hover:bg-baylink-section">
          管理员操作日志
        </button>
      </div>
      <div className="border-b border-baylink-border/40 bg-white px-4 py-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          {(['open', 'reviewed', 'dismissed', 'all'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusFilter === s ? 'bg-baylink-green text-white' : 'bg-baylink-section text-baylink-muted'}`}>
              {s === 'all' ? '全部状态' : statusLabel(s)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'post', 'user'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTypeFilter(t)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${typeFilter === t ? 'bg-gray-900 text-white' : 'bg-baylink-section text-baylink-muted'}`}>
              {t === 'all' ? '全部类型' : t === 'post' ? '帖子' : '用户'}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-amber-700">隐藏帖子只会从公开列表移除，不会删除数据。</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {loading ? (
          <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-baylink-green" /></div>
        ) : reports.length === 0 ? (
          <p className="py-16 text-center text-sm text-baylink-muted">当前没有符合条件的举报</p>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => {
              const postId = r.targetPost?.id || (r.targetType === 'post' ? r.targetId : '');
              const postHidden = !!r.targetPost?.adminHidden;
              return (
              <div key={r.id} className="rounded-2xl border border-baylink-border/50 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-baylink-muted">{new Date(r.createdAt).toLocaleString()}</div>
                    <div className="mt-1 text-sm font-semibold text-baylink-text">
                      {REPORT_REASON_LABELS[r.reason] || r.reason}
                      <span className="ml-2 text-xs font-normal text-baylink-muted">
                        · {r.targetType === 'post' ? '帖子举报' : '用户举报'}
                      </span>
                    </div>
                    {r.detail && <p className="mt-1 text-xs text-baylink-text-secondary line-clamp-4">{r.detail}</p>}
                    {r.reporter && (
                      <p className="mt-2 text-[11px] text-baylink-muted">
                        举报人：{r.reporter.nickname}
                        {r.reporter.isPhoneVerified ? ' · 手机已验证' : ' · 手机未验证'}
                        {r.reporter.accountStatus && r.reporter.accountStatus !== 'active' ? ` · 账号${ACCOUNT_STATUS_LABELS[r.reporter.accountStatus] || r.reporter.accountStatus}` : ''}
                      </p>
                    )}
                    {r.targetUser && (
                      <div className="mt-2 rounded-xl border border-baylink-border/40 bg-baylink-section/30 px-3 py-2 text-[11px]">
                        <p className="font-semibold text-baylink-text">{r.targetType === 'user' ? '被举报用户' : '帖子作者'}：{r.targetUser.nickname}</p>
                        <p className="mt-0.5 text-baylink-muted">账号状态：{ACCOUNT_STATUS_LABELS[r.targetUser.accountStatus || 'active'] || r.targetUser.accountStatus}</p>
                        {r.targetUser.accountStatusReason && (
                          <p className="mt-1 text-baylink-text-secondary line-clamp-2">限制原因：{r.targetUser.accountStatusReason}</p>
                        )}
                      </div>
                    )}
                    {r.targetType === 'post' && r.targetPost && (
                      <div className="mt-2 rounded-xl bg-baylink-section/40 px-3 py-2 text-[11px] text-baylink-text-secondary">
                        <p className="font-semibold text-baylink-text line-clamp-2">{r.targetPost.title}</p>
                        <p className="mt-0.5">{r.targetPost.category}{r.targetPost.area ? ` · ${r.targetPost.area}` : ''}</p>
                        {postHidden && <p className="mt-1 text-amber-700 font-semibold">已从公开列表隐藏</p>}
                      </div>
                    )}
                    {r.targetType === 'post' && !r.targetPost && (
                      <p className="mt-1 text-[11px] text-baylink-muted">关联帖子已不存在</p>
                    )}
                    {r.adminNote && <p className="mt-1 text-[10px] text-baylink-muted">管理员备注：{r.adminNote}</p>}
                  </div>
                  <span className="shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">{statusLabel(r.status)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.status === 'open' && (
                    <>
                      <button type="button" disabled={updatingId === r.id} onClick={() => handleStatus(r.id, 'reviewed')} className="flex-1 min-w-[120px] rounded-lg bg-baylink-green py-2 text-xs font-bold text-white disabled:opacity-50">标记已处理</button>
                      <button type="button" disabled={updatingId === r.id} onClick={() => handleStatus(r.id, 'dismissed')} className="flex-1 min-w-[120px] rounded-lg border border-baylink-border/60 py-2 text-xs font-semibold text-baylink-text-secondary disabled:opacity-50">忽略</button>
                    </>
                  )}
                  {(r.status === 'reviewed' || r.status === 'dismissed') && (
                    <button type="button" disabled={updatingId === r.id} onClick={() => handleStatus(r.id, 'open')} className="w-full rounded-lg border border-baylink-border/60 py-2 text-xs font-semibold text-baylink-text-secondary disabled:opacity-50">重新打开</button>
                  )}
                  {r.targetType === 'post' && postId && (
                    <button
                      type="button"
                      disabled={updatingId === postId}
                      onClick={() => handleHidePost(postId, postHidden)}
                      className="w-full rounded-lg border border-amber-200 bg-amber-50 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50"
                    >
                      {postHidden ? '恢复帖子公开' : '隐藏帖子'}
                    </button>
                  )}
                  {r.targetUser && (
                    <div className="flex w-full flex-wrap gap-2">
                      <button type="button" disabled={updatingId === r.targetUser!.id} onClick={() => openStatusModal(r.targetUser!.id, r.targetUser!.nickname, 'limited')} className="flex-1 min-w-[90px] rounded-lg border border-orange-200 bg-orange-50 py-2 text-xs font-semibold text-orange-800 disabled:opacity-50">限制账号</button>
                      <button type="button" disabled={updatingId === r.targetUser!.id} onClick={() => openStatusModal(r.targetUser!.id, r.targetUser!.nickname, 'suspended')} className="flex-1 min-w-[90px] rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">暂停账号</button>
                      <button type="button" disabled={updatingId === r.targetUser!.id} onClick={() => openStatusModal(r.targetUser!.id, r.targetUser!.nickname, 'active')} className="flex-1 min-w-[90px] rounded-lg border border-baylink-border/60 py-2 text-xs font-semibold text-baylink-text-secondary disabled:opacity-50">恢复正常</button>
                    </div>
                  )}
                </div>
              </div>
            );})}
          </div>
        )}
      </div>
      {statusModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={() => setStatusModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-baylink-text">调整账号状态</h3>
            <p className="mt-2 text-sm text-baylink-text-secondary">
              你正在将 <span className="font-semibold text-baylink-text">{statusModal.nickname}</span> 的状态改为：
              <span className="font-semibold text-baylink-text"> {accountStatusActionLabel(statusModal.status)}</span>
            </p>
            <textarea
              className="mt-3 w-full resize-none rounded-xl border border-baylink-border/50 p-3 text-sm outline-none focus:border-baylink-green/40"
              rows={3}
              maxLength={300}
              placeholder="管理员备注 / 原因（可选）"
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value.slice(0, 300))}
            />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setStatusModal(null)} className="flex-1 rounded-xl border border-baylink-border/60 py-2.5 text-sm font-semibold text-baylink-text-secondary">取消</button>
              <button type="button" disabled={updatingId === statusModal.userId} onClick={handleAccountStatusUpdate} className="flex-1 rounded-xl bg-baylink-green py-2.5 text-sm font-bold text-white disabled:opacity-50">确认更新</button>
            </div>
          </div>
        </div>
      )}
      {showLogsModal && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setShowLogsModal(false)}>
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-baylink-border/40 px-4 py-3">
              <h3 className="text-base font-bold text-baylink-text">管理员操作日志</h3>
              <button type="button" onClick={() => setShowLogsModal(false)} className="rounded-full p-2 hover:bg-baylink-section"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {logsLoading ? (
                <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-baylink-green" /></div>
              ) : logs.length === 0 ? (
                <p className="py-12 text-center text-sm text-baylink-muted">还没有管理员操作记录</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => {
                    const noteOrReason = log.reason?.trim() || log.note?.trim() || '';
                    return (
                      <div key={log.id} className="rounded-xl border border-baylink-border/40 bg-baylink-section/20 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-baylink-text">
                            {MODERATION_ACTION_LABELS[log.action] || log.action}
                          </p>
                          <span className="shrink-0 text-[10px] text-baylink-muted">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-baylink-text-secondary">
                          管理员：{log.admin?.nickname || 'Admin'}
                          {' · '}
                          目标：{MODERATION_TARGET_TYPE_LABELS[log.targetType] || log.targetType}
                        </p>
                        {noteOrReason && (
                          <p className="mt-1 text-[11px] text-baylink-muted line-clamp-3">
                            {log.reason?.trim() ? `原因：${log.reason}` : `备注：${log.note}`}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const getOfficialVerificationStatusLabel = (user: UserData) => getMyOfficialTrustLabel(user);

const ProfileView = ({ user, onLogout, onLogin, onOpenPost, onUpdateUser, showToast, onOpenBlockedUsers }: any) => {
  const [subView, setSubView] = useState<'menu' | 'my_posts' | 'support' | 'about' | 'edit_profile' | 'admin_reports' | 'admin_official'>('menu');
  const [showOfficialModal, setShowOfficialModal] = useState(false);
  const officialStatus = user?.officialVerification?.status || (user?.isOfficialVerified ? 'approved' : 'none');
  const joinDays = user ? getJoinDays(user) : null;
  const completion = user ? calcProfileCompletion(user) : 0;
  const locationLine = user ? formatProfileLocation(user.area, user.city) : '';
  const myProfileTags = user?.profileTags?.filter(Boolean) || [];
  const myInterests = user?.interests?.filter(Boolean) || [];
  const myInsta = user?.socialLinks?.instagram ? normalizeInstagramUrl(user.socialLinks.instagram) : null;
  const myWebsite = user?.website ? normalizeWebsiteUrl(user.website) : null;
  const myXhs = user?.xiaohongshu?.trim() || '';

  if (!user) return <div className="flex-1 flex flex-col items-center justify-center p-8"><div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6 shadow-soft-glow animate-bounce"><Zap size={40} /></div><h2 className="text-2xl font-black text-gray-900 mb-2">欢迎来到 BayLink</h2><p className="text-gray-500 text-center mb-8 text-sm">连接湾区邻里，让互助更简单。</p><button onClick={onLogin} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold shadow-xl hover:bg-gray-800 transition active:scale-95">立即登录 / 注册</button></div>;

  return (
    <div className="flex-1 relative w-full h-full bg-[#FAFAFA]">
      {subView === 'menu' && (
        <div className="p-6 pt-8 w-full h-full overflow-y-auto pb-24">
          <div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-black text-gray-900">我的名片</h1><button onClick={onLogout} className="p-2 bg-white rounded-full text-red-500 shadow-sm hover:bg-red-50"><LogOut size={20} /></button></div>

          {user.accountStatus === 'limited' && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              你的账号部分功能受到限制，暂时无法发布内容或发送私信。
            </div>
          )}
          {user.accountStatus === 'suspended' && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              你的账号当前受到限制，部分功能暂时不可用。
            </div>
          )}

          {completion < 100 && (
            <div className="mb-4 rounded-2xl border border-baylink-green/20 bg-baylink-green/[0.06] px-4 py-3">
              <p className="text-sm font-bold text-baylink-text">资料完成度 {completion}%</p>
              <p className="mt-0.5 text-[11px] text-baylink-muted leading-snug">完善地区、兴趣和简介，让附近用户更容易认识你。</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-baylink-section">
                <div className="h-full rounded-full bg-baylink-green transition-all" style={{ width: `${completion}%` }} />
              </div>
            </div>
          )}

          <div className="bg-white p-5 rounded-[1.75rem] shadow-soft-glow mb-4 relative overflow-hidden group border border-baylink-border/30">
            <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-green-100/80 to-transparent rounded-full -mr-8 -mt-8" />
            <div className="flex items-start gap-4 relative z-10">
              <Avatar src={user.avatar} name={user.nickname} size={16} className="shadow-md border-2 border-white shrink-0" />
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black text-gray-900 flex items-center gap-2 flex-wrap">{user.nickname} <TrustBadge user={user} size={14} /></h2>
                {locationLine && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-baylink-text-secondary">
                    <MapPin size={11} className="text-baylink-green/70 shrink-0" />{locationLine}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{user.bio || '写一句介绍，展示你的本地生活名片'}</p>
                {joinDays != null && <p className="text-[10px] text-baylink-muted mt-1">加入 {joinDays} 天</p>}
              </div>
              <button onClick={() => setSubView('edit_profile')} className="p-2.5 bg-baylink-section rounded-xl hover:bg-baylink-green/10 transition shrink-0" title="编辑资料"><Edit size={16} className="text-baylink-green" /></button>
            </div>
            {(myProfileTags.length > 0 || myInterests.length > 0) && (
              <div className="mt-4 space-y-2 relative z-10">
                {myProfileTags.length > 0 && <TagPills tags={myProfileTags} variant="profile" />}
                {myInterests.length > 0 && <TagPills tags={myInterests} variant="interest" />}
              </div>
            )}
            {(myInsta || myWebsite || myXhs) && (
              <div className="mt-3 flex flex-wrap gap-2 relative z-10">
                {myInsta && (
                  <a href={myInsta} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-baylink-border/50 bg-baylink-bg px-2 py-0.5 text-[10px] text-baylink-text-secondary">
                    <Instagram size={11} /> Instagram
                  </a>
                )}
                {myXhs && <span className="rounded-full border border-baylink-border/50 bg-baylink-bg px-2 py-0.5 text-[10px] text-baylink-text-secondary">小红书 · {myXhs}</span>}
                {myWebsite && (
                  <a href={myWebsite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-baylink-border/50 bg-baylink-bg px-2 py-0.5 text-[10px] text-baylink-text-secondary">
                    <ExternalLink size={10} /> 网站
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="mb-4 rounded-[1.5rem] border border-baylink-border/40 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500 mb-2">信任信息</p>
            <div className="space-y-1 text-[11px] text-gray-600">
              {joinDays != null && <p>已加入 BAYLINK <span className="font-medium text-gray-900">{joinDays}</span> 天</p>}
              <p>{getPhoneVerificationTrustLabel(user.isPhoneVerified)}</p>
              <p>{getMyOfficialTrustLabel(user)}</p>
              {(officialStatus === 'approved' || user.isOfficialVerified) && user.officialVerification?.type && (
                <p>认证类型：{getOfficialTypeLabel(user.officialVerification.type)}</p>
              )}
            </div>
          </div>

          <div className="mb-4 rounded-[1.5rem] border border-amber-200/60 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <BadgeCheck size={18} className="shrink-0 text-amber-500" />
                  <span className="font-bold text-gray-900">官方认证</span>
                  {(officialStatus === 'approved' || user.isOfficialVerified) && <TrustBadge user={user} size={12} />}
                </div>
                <p className="mt-1 text-[11px] text-gray-500">{getOfficialVerificationStatusLabel(user)}</p>
                {officialStatus === 'rejected' && user.officialVerification?.rejectionReason && (
                  <p className="mt-1 text-[10px] text-red-500 line-clamp-2">{user.officialVerification.rejectionReason}</p>
                )}
              </div>
              {officialStatus === 'pending' ? (
                <span className="shrink-0 rounded-lg bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-700">审核中</span>
              ) : (officialStatus === 'approved' || user.isOfficialVerified) ? (
                <span className="shrink-0 rounded-lg bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-700">已通过</span>
              ) : (
                <button type="button" onClick={() => setShowOfficialModal(true)} className="shrink-0 rounded-lg bg-gray-900 px-3 py-1.5 text-[10px] font-bold text-white">
                  {officialStatus === 'rejected' ? '重新申请' : '申请认证'}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <button onClick={() => setSubView('my_posts')} className="bg-white p-5 rounded-[1.5rem] shadow-sm hover:shadow-md transition text-left group"><div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 mb-3 group-hover:scale-110 transition"><Edit size={20} /></div><div className="font-bold text-gray-900">我的发布</div><div className="text-[10px] text-gray-400">管理帖子</div></button>
            <button onClick={() => setSubView('support')} className="bg-white p-5 rounded-[1.5rem] shadow-sm hover:shadow-md transition text-left group"><div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-3 group-hover:scale-110 transition"><Phone size={20} /></div><div className="font-bold text-gray-900">联系客服</div><div className="text-[10px] text-gray-400">帮助支持</div></button>
          </div>
          <button onClick={onOpenBlockedUsers} className="mb-4 w-full bg-white p-5 rounded-[1.5rem] shadow-sm hover:shadow-md transition flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 group-hover:scale-110 transition"><UserX size={20} /></div>
              <div><div className="font-bold text-gray-900">已屏蔽用户</div><div className="text-[10px] text-gray-400">管理私信屏蔽名单</div></div>
            </div>
            <ChevronRight size={18} className="text-gray-300" />
          </button>
          <button onClick={() => setSubView('about')} className="w-full bg-white p-5 rounded-[1.5rem] shadow-sm hover:shadow-md transition flex items-center justify-between group"><div className="flex items-center gap-4"><div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 group-hover:scale-110 transition"><Info size={20} /></div><div className="font-bold text-gray-900">关于我们</div></div><ChevronRight size={18} className="text-gray-300" /></button>
          <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-gray-400">
            <a href="/terms" className="hover:text-baylink-green transition">服务条款</a>
            <a href="/privacy" className="hover:text-baylink-green transition">隐私政策</a>
            <a href="/sms-consent" className="hover:text-baylink-green transition">SMS Verification</a>
          </div>
          {user.role === 'admin' && (
            <>
              <button onClick={() => setSubView('admin_official')} className="mt-4 w-full bg-white p-5 rounded-[1.5rem] shadow-sm hover:shadow-md transition flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 group-hover:scale-110 transition"><BadgeCheck size={20} /></div>
                  <div><div className="font-bold text-gray-900">官方认证审核</div><div className="text-[10px] text-gray-400">查看并处理认证申请</div></div>
                </div>
                <ChevronRight size={18} className="text-gray-300" />
              </button>
              <button onClick={() => setSubView('admin_reports')} className="mt-4 w-full bg-white p-5 rounded-[1.5rem] shadow-sm hover:shadow-md transition flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-red-500 group-hover:scale-110 transition"><Flag size={20} /></div>
                  <div><div className="font-bold text-gray-900">举报管理</div><div className="text-[10px] text-gray-400">查看并处理用户举报</div></div>
                </div>
                <ChevronRight size={18} className="text-gray-300" />
              </button>
            </>
          )}
        </div>
      )}
      {showOfficialModal && (
        <OfficialVerificationModal
          isOpen={showOfficialModal}
          onClose={() => setShowOfficialModal(false)}
          onSubmit={(payload) => api.submitOfficialVerification(payload)}
          onSuccess={(updatedUser) => {
            const stored = localStorage.getItem('currentUser');
            const current = stored ? safeParse(stored) : {};
            const nextUser = { ...current, ...updatedUser };
            localStorage.setItem('currentUser', JSON.stringify(nextUser));
            onUpdateUser(nextUser);
          }}
          showToast={showToast}
        />
      )}
      {subView === 'admin_official' && <AdminOfficialVerificationsView onBack={() => setSubView('menu')} showToast={showToast} />}
      {subView === 'admin_reports' && <AdminReportsView onBack={() => setSubView('menu')} showToast={showToast} />}
      {subView === 'edit_profile' && <EditProfileModal user={user} onClose={() => setSubView('menu')} onUpdate={onUpdateUser} showToast={showToast} />}
      {subView === 'my_posts' && <MyPostsView user={user} onBack={() => setSubView('menu')} onOpenPost={onOpenPost} />}
      {subView === 'support' && <InfoPage title="联系客服" storageKey="baylink_support" user={user} onBack={() => setSubView('menu')} showToast={showToast} />}
      {subView === 'about' && <InfoPage title="关于我们" storageKey="baylink_about" user={user} onBack={() => setSubView('menu')} showToast={showToast} />}
    </div>
  );
};

const PostNotFoundView = ({ onBack }: { onBack: () => void }) => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-baylink-bg p-6">
    <p className="text-lg font-bold text-baylink-text">内容不存在或已被移除。</p>
    <p className="mt-2 text-sm text-baylink-muted">链接可能已失效，或内容已被管理员处理</p>
    <button type="button" onClick={onBack} className="mt-6 rounded-xl bg-baylink-green px-6 py-3 text-sm font-bold text-white">返回</button>
  </div>
);

// 🌟 MAIN APP 组件
export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = tabFromPathname(location.pathname);
  const categorySlug = location.pathname.startsWith('/category/')
    ? location.pathname.split('/category/')[1]?.split('/')[0]
    : undefined;

  const [user, setUser] = useState<UserData | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetPasswordToken, setResetPasswordToken] = useState<string | null>(null);
  const [baybayPanelOpen, setBaybayPanelOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingPost, setEditingPost] = useState<PostData | null>(null);
  
  const [feedType, setFeedType] = useState<PostType>('provider');
  const [createDefaultType, setCreateDefaultType] = useState<PostType>('client');
  const [createDefaultCategory, setCreateDefaultCategory] = useState<string | undefined>(undefined);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [feedError, setFeedError] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const [postDetailRefreshing, setPostDetailRefreshing] = useState(false);
  const sessionExpiredHandledRef = useRef(false);
  const [postRouteMissing, setPostRouteMissing] = useState(false);
  const [postRouteLoading, setPostRouteLoading] = useState(false);
  const [chatConv, setChatConv] = useState<Conversation | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string>('全部');
  const [categoryFilter, setCategoryFilter] = useState<string>('全部');
  
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [sharingPost, setSharingPost] = useState<PostData | null>(null);

  // ✨ Toast & Socket State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [hasNotification, setHasNotification] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [showBlockedUsersModal, setShowBlockedUsersModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [detailAd, setDetailAd] = useState<AdDetailItem | null>(null);
  const [adsRefreshKey, setAdsRefreshKey] = useState(0);
  const [featuredRefreshKey, setFeaturedRefreshKey] = useState(0);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => setToast({ message, type });

  const postIdParam = location.pathname.startsWith('/posts/') ? location.pathname.split('/posts/')[1]?.split('/')[0] : undefined;
  const userIdParam = location.pathname.startsWith('/users/') ? location.pathname.split('/users/')[1]?.split('/')[0] : undefined;
  const threadIdParam = location.pathname.match(/^\/messages\/([^/]+)/)?.[1];
  const guideSlugParam = location.pathname.startsWith('/guides/') ? location.pathname.split('/guides/')[1]?.split('/')[0] : undefined;
  const isGuidesList = location.pathname === '/guides';

  const navigateBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const navigateToPost = (post: PostData) => navigate(`/posts/${post.id}`);
  const openRecentPostFromProfile = (post: { id?: string; _id?: string }) => {
    const postId = post?.id || post?._id;
    if (!postId) {
      showToast('帖子链接不可用', 'error');
      return;
    }
    navigate(`/posts/${postId}`);
  };
  const navigateToCategory = (category: string) => {
    const slug = getSlugFromCategory(category);
    if (slug) navigate(`/category/${slug}`);
    else navigate('/');
  };

  const openAdDetail = (ad: AdDetailItem) => setDetailAd(ad);
  const handleDeleteAdFromDetail = async (id: string) => {
    if (!confirm('确定删除?')) return;
    try {
      await api.request(`/ads/${id}`, { method: 'DELETE' });
      setDetailAd(null);
      setAdsRefreshKey((k) => k + 1);
      showToast('已删除', 'success');
    } catch (e) {
      showToast(friendlyErrorMessage(e, '删除失败，请稍后再试'), 'error');
    }
  };

  // ✨ Socket 初始化 (已优化：防抖，防止切Tab重连)
  useEffect(() => {
    if (user && !socket) {
        const newSocket = io(SOCKET_URL);
        newSocket.on('connect', () => { 
            console.log('Socket Connected');
            newSocket.emit('join_room', user.id); 
        });
        
        // 监听全局新消息（用于显示小红点）
        newSocket.on('new_message', () => {
            if (tab !== 'messages') { // 如果当前不在消息页，就显示红点
                setHasNotification(true);
                showToast('收到新私信', 'info');
            }
        });

        setSocket(newSocket);
        return () => { newSocket.disconnect(); }
    } else if (!user && socket) {
        // 用户登出，断开连接
        socket.disconnect();
        setSocket(null);
    }
  }, [user]); // 依赖仅为 user，tab 变化不触发重连

  // 切换到消息页时，清除红点
  useEffect(() => {
      if (tab === 'messages') setHasNotification(false);
  }, [tab]);

  // URL → 分类筛选
  useEffect(() => {
    if (isHomePath(location.pathname)) {
      setCategoryFilter(getCategoryFromSlug(categorySlug));
    }
  }, [location.pathname, categorySlug]);

  // document.title
  useEffect(() => {
    if (postIdParam) return;
    if (userIdParam) return;
    const path = location.pathname;
    if (path.startsWith('/category/')) {
      const cat = getCategoryFromSlug(categorySlug);
      document.title = `${cat}｜BAYLINK`;
    } else if (path.startsWith('/guides/') && guideSlugParam) {
      const g = getGuideBySlug(guideSlugParam);
      document.title = g ? `${g.title}｜BAYLINK` : '湾区生活指南｜BAYLINK';
    } else if (path.startsWith('/guides')) {
      document.title = '湾区生活指南｜BAYLINK';
    } else if (path.startsWith('/recommend')) {
      document.title = '推荐｜BAYLINK';
    } else if (path.startsWith('/messages')) {
      document.title = '消息｜BAYLINK';
    } else if (path === '/me') {
      document.title = '我的｜BAYLINK';
    } else if (path === '/privacy') {
      document.title = '隐私政策｜BAYLINK';
    } else if (path === '/terms') {
      document.title = '服务条款｜BAYLINK';
    } else if (path === '/sms-consent') {
      document.title = 'SMS Verification Consent｜BAYLINK';
    } else {
      document.title = 'BAYLINK｜湾区华人本地生活信息平台';
    }
  }, [location.pathname, categorySlug, postIdParam, userIdParam, guideSlugParam]);

  useEffect(() => {
    if (!userIdParam) return;
    let cancelled = false;
    api.getUserPublicProfile(userIdParam).then((p: PublicUserProfile) => {
      if (!cancelled) document.title = `${p.nickname}｜BAYLINK`;
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [userIdParam]);

  // /posts/:id 加载详情（有缓存先展示，始终拉取完整帖子）
  useEffect(() => {
    if (!postIdParam) {
      setPostRouteMissing(false);
      setPostRouteLoading(false);
      setPostDetailRefreshing(false);
      return;
    }
    const found = posts.find((p) => p.id === postIdParam);
    if (found) {
      setSelectedPost(found);
      setPostRouteMissing(false);
      setPostRouteLoading(false);
      document.title = `${found.title}｜BAYLINK`;
    } else {
      setPostRouteLoading(true);
      setPostRouteMissing(false);
    }
    let cancelled = false;
    (async () => {
      if (found) setPostDetailRefreshing(true);
      try {
        const p = await api.request(`/posts/${postIdParam}`);
        if (!cancelled) {
          setSelectedPost(p);
          setPostRouteMissing(false);
          document.title = `${p.title}｜BAYLINK`;
        }
      } catch {
        if (!cancelled && !found) {
          setSelectedPost(null);
          setPostRouteMissing(true);
          document.title = '内容不存在｜BAYLINK';
        }
      } finally {
        if (!cancelled) {
          setPostRouteLoading(false);
          setPostDetailRefreshing(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [postIdParam, posts]);

  // /messages/:threadId 打开聊天
  useEffect(() => {
    if (!threadIdParam || !user) {
      if (!threadIdParam) setChatConv(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const convs = await api.request('/conversations');
        if (cancelled || !Array.isArray(convs)) return;
        const c = convs.find((x: Conversation) => x.id === threadIdParam);
        if (c) setChatConv(c);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [threadIdParam, user?.id]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(keyword.trim()), 400);
    return () => clearTimeout(t);
  }, [keyword]);

  useEffect(() => { setPage(1); setHasMore(true); fetchPosts(1, true); }, [feedType, regionFilter, categoryFilter, debouncedKeyword]);
  useEffect(() => { const u = localStorage.getItem('currentUser'); if(u) setUser(JSON.parse(u)); }, []);

  useEffect(() => {
    const onSessionExpired = () => {
      if (!localStorage.getItem('currentUser')) return;
      if (sessionExpiredHandledRef.current) return;
      sessionExpiredHandledRef.current = true;
      localStorage.removeItem('currentUser');
      setSocket((prev) => { prev?.disconnect(); return null; });
      setUser(null);
      setBlockedUserIds([]);
      setShowLogin(true);
      showToast('登录已过期，请重新登录。', 'error');
      window.setTimeout(() => { sessionExpiredHandledRef.current = false; }, 3000);
    };
    window.addEventListener('session-expired', onSessionExpired);
    return () => window.removeEventListener('session-expired', onSessionExpired);
  }, []);

  useEffect(() => {
    if (location.pathname === '/reset-password') {
      const token = new URLSearchParams(location.search).get('token');
      setResetPasswordToken(token || null);
    } else {
      setResetPasswordToken(null);
    }
  }, [location.pathname, location.search]);

  const handleResetPasswordSuccess = () => {
    window.history.replaceState({}, '', '/');
    setResetPasswordToken(null);
    setShowLogin(true);
  };

  const handleOpenForgotPassword = () => {
    setShowLogin(false);
    setShowForgotPassword(true);
  };

  useEffect(() => {
    if (!user) {
      setBlockedUserIds([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getMyBlocks();
        if (cancelled) return;
        const ids: string[] = (res.blocks || []).map((b: { id: string }) => b.id).filter(Boolean);
        setBlockedUserIds(ids);
        setPosts((prev) => filterPostsByBlockedUsers(prev, ids));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const fetchPosts = async (pageNum: number, isRefresh: boolean = false, keywordOverride?: string) => {
    const searchKw = keywordOverride ?? debouncedKeyword;
    try {
      if (!isRefresh) setIsLoadingMore(true);
      else { setIsInitialLoading(true); setFeedError(false); }
      let queryParams = `?type=${feedType}&page=${pageNum}&limit=5`;
      if (searchKw) queryParams += `&keyword=${encodeURIComponent(searchKw)}`;
      const res = await api.request(`/posts${queryParams}`);
      const newPosts = res.posts || [];
      const more = res.hasMore;
      let filtered = newPosts;
      if (regionFilter !== '全部') filtered = filtered.filter((p: any) => p.city.includes(regionFilter));
      if (categoryFilter !== '全部') filtered = filtered.filter((p: any) => p.category === categoryFilter);
      if (user && blockedUserIds.length) filtered = filterPostsByBlockedUsers(filtered, blockedUserIds);
      if (isRefresh) setPosts(filtered); else setPosts(prev => [...prev, ...filtered]);
      setHasMore(more);
      setFeedError(false);
    } catch (e) {
      console.error(e);
      if (isRefresh) setFeedError(true);
    } finally { setIsLoadingMore(false); setIsInitialLoading(false); }
  };

  const retryFeed = () => {
    setPage(1);
    setHasMore(true);
    fetchPosts(1, true);
  };

  const searchPostsNow = () => {
    const kw = keyword.trim();
    setDebouncedKeyword(kw);
    setPage(1);
    setHasMore(true);
    fetchPosts(1, true, kw);
  };

  const handleLoadMore = () => { const nextPage = page + 1; setPage(nextPage); fetchPosts(nextPage, false); };
  
  // ✨ 已修复：传入 postTitle 作为聊天上下文
  const openChat = async (targetId: string, nickname?: string, postTitle?: string) => { 
      try { 
          const c = await api.request('/conversations/open-or-create', { method: 'POST', body: JSON.stringify({ targetUserId: targetId }) }); 
          const conv: Conversation = { 
              id: c.id, 
              otherUser: { id: targetId, nickname: nickname || 'User' }, 
              lastMessage: '', 
              updatedAt: Date.now(),
              lastPostTitle: postTitle
          };
          setChatConv(conv);
          navigate(`/messages/${c.id}`);
      } catch (e: any) { showToast(friendlyErrorMessage(e, '无法打开聊天'), 'error'); }
  };
  
  const handleLogout = () => { localStorage.removeItem('currentUser'); if(socket) socket.disconnect(); setUser(null); setBlockedUserIds([]); navigate('/'); showToast('已退出登录', 'info'); };

  const openReportTarget = (target: ReportTarget) => {
    if (!user) { showToast('请先登录后举报', 'info'); setShowLogin(true); return; }
    setReportTarget(target);
  };

  const handleSubmitReport = async (reason: ReportReason, detail: string) => {
    if (!reportTarget) return;
    const res = await api.submitReport({
      targetType: reportTarget.targetType,
      targetId: reportTarget.targetId,
      reason,
      detail: detail || undefined,
    });
    showToast(res?.message || '举报已提交，感谢你的反馈。', 'success');
    const blockHintUserId = reportTarget.targetType === 'user' ? reportTarget.targetId : reportTarget.authorId;
    if (blockHintUserId && blockHintUserId !== user?.id) {
      showToast('你也可以屏蔽该用户，避免后续私信骚扰。', 'info');
    }
    setReportTarget(null);
  };

  const handleUnblockUser = async (blockedId: string) => {
    if (!user) return;
    try {
      const res = await api.unblockUser(blockedId);
      setBlockedUserIds((prev) => prev.filter((id) => id !== blockedId));
      showToast(res?.message || '已取消屏蔽。', 'success');
    } catch (e: any) {
      showToast(e?.error || '取消屏蔽失败', 'error');
      throw e;
    }
  };

  const handleBlockUser = async (blockedId: string) => {
    if (!user) { showToast('请先登录', 'info'); setShowLogin(true); return; }
    if (blockedId === user.id) return;
    if (!confirm('屏蔽这个用户？\n\n屏蔽后，对方将无法继续给你发送私信。你也不能主动给对方发私信，除非之后取消屏蔽。')) return;
    try {
      const res = await api.blockUser(blockedId);
      setBlockedUserIds((prev) => {
        const next = prev.includes(blockedId) ? prev : [...prev, blockedId];
        setPosts((p) => filterPostsByBlockedUsers(p, next));
        return next;
      });
      showToast(res?.message || '已屏蔽该用户。', 'success');
      if (userIdParam === blockedId) navigateBack();
      if (chatConv?.otherUser.id === blockedId) { setChatConv(null); navigate('/messages'); }
    } catch (e: any) {
      showToast(e?.error || '屏蔽失败', 'error');
    }
  };

  const handleToggleBlockUser = (userId: string) => {
    if (blockedUserIds.includes(userId)) handleUnblockUser(userId);
    else handleBlockUser(userId);
  };

  const openCreate = (type: PostType = 'client', category?: string) => {
    setEditingPost(null);
    setCreateDefaultType(type);
    setCreateDefaultCategory(category);
    if (user) setShowCreate(true);
    else setShowLogin(true);
  };

  const openCreateFromSlug = (type: PostType, categorySlug?: string) => {
    const label = categorySlug ? getCategoryFromSlug(categorySlug) : undefined;
    openCreate(type, label && label !== '全部' ? label : undefined);
  };

  const openEditPost = (post: PostData) => {
    if (!user) return setShowLogin(true);
    setEditingPost(post);
    setShowCreate(true);
  };

  const handleDeletePost = async (post: PostData) => {
    if (!confirm('删除此贴？')) return;
    try {
      await api.request(`/posts/${post.id}`, { method: 'DELETE' });
      if (postIdParam === post.id) navigate('/');
      else if (selectedPost?.id === post.id) setSelectedPost(null);
      fetchPosts(1, true);
      setFeaturedRefreshKey((k) => k + 1);
      showToast('帖子已删除', 'success');
    } catch {
      showToast('删除失败', 'error');
    }
  };

  const openUserProfile = (userId: string) => navigate(`/users/${userId}`);

  const handleToggleFeature = async (post: PostData) => {
    if (user?.role !== 'admin') return;
    const endpoint = post.isFeatured ? `/posts/${post.id}/unfeature` : `/posts/${post.id}/feature`;
    try {
      const updated = await api.request(endpoint, { method: 'PATCH' });
      showToast(post.isFeatured ? '已取消热门推荐' : '已加入热门推荐', 'success');
      setFeaturedRefreshKey((k) => k + 1);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, ...updated } : p)));
      if (selectedPost?.id === post.id) setSelectedPost({ ...selectedPost, ...updated });
    } catch {
      showToast('操作失败，请稍后再试', 'error');
    }
  };

  const handleChannelClick = (ch: typeof HOME_CHANNELS[number]) => {
    if (ch.id === 'featured') {
      navigate('/recommend');
      return;
    }
    if (ch.feedType) setFeedType(ch.feedType);
    setRegionFilter('全部');
    setKeyword('');
    if (ch.category) navigateToCategory(ch.category);
    else navigate('/');
  };

  // 🖥️ PC 侧边栏
  const LeftSidebar = () => (
    <div className="hidden lg:flex flex-col w-[200px] xl:w-[220px] h-screen sticky top-0 py-6 px-4 border-r border-baylink-border/60 bg-baylink-bg-alt overflow-y-auto shrink-0">
      <div className="mb-5 px-0.5">
        <img
          src={BRAND.logoHorizontal}
          alt="BAYLINK"
          className="h-9 w-auto max-w-[180px] object-contain object-left"
          width={180}
          height={36}
        />
        <span className="text-[11px] text-baylink-muted block mt-0.5 leading-tight">连接湾区真实生活信息</span>
      </div>
      <nav className="space-y-0.5 flex-1">
        <button onClick={() => navigate('/')} className={`w-full text-left py-2.5 rounded-lg font-medium text-sm transition flex items-center gap-2.5 ${isHomePath(location.pathname)?'nav-item-active':'nav-item-inactive'}`}><Home size={18} strokeWidth={isHomePath(location.pathname)?2.5:2}/> 首页</button>
        <button onClick={() => navigate('/guides')} className={`w-full text-left py-2.5 rounded-lg font-medium text-sm transition flex items-center gap-2.5 ${isGuidesPath(location.pathname)?'nav-item-active':'nav-item-inactive'}`}><BookOpen size={18} strokeWidth={isGuidesPath(location.pathname)?2.5:2}/> 湾区指南</button>
        <button onClick={() => navigate('/messages')} className={`w-full text-left py-2.5 rounded-lg font-medium text-sm transition flex items-center gap-2.5 ${tab==='messages'?'nav-item-active':'nav-item-inactive'}`}>
            <div className="relative"><MessageCircle size={18} strokeWidth={tab==='messages'?2.5:2}/>{hasNotification && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-baylink-orange rounded-full"></div>}</div> 消息
        </button>
        <button onClick={() => navigate(user ? '/me' : '/')} className={`w-full text-left py-2.5 rounded-lg font-medium text-sm transition flex items-center gap-2.5 ${tab==='profile'?'nav-item-active':'nav-item-inactive'}`}><UserIcon size={18} strokeWidth={tab==='profile'?2.5:2}/> 我的</button>
      </nav>
      {isHomePath(location.pathname) && (
        <div className="mt-4 sidebar-panel">
           <h3 className="sidebar-section-title mb-2.5">探索分类</h3>
           <div className="flex flex-wrap gap-1.5">
             <button onClick={() => navigateToCategory('全部')} className={`chip ${categoryFilter==='全部'?'chip-active':'chip-inactive'}`}>全部</button>
             {CATEGORIES.map(c => <CategoryChip key={c} label={c} active={categoryFilter===c} onClick={() => navigateToCategory(c)} />)}
           </div>
        </div>
      )}
    </div>
  );

  // 🖥️ PC 右侧栏
  const RightSidebar = () => (
    <div className="hidden lg:block w-[280px] xl:w-[300px] h-screen sticky top-0 py-6 px-4 border-l border-baylink-border/50 bg-baylink-bg overflow-y-auto shrink-0">
       {user ? (
          <div className="sidebar-panel mb-3">
             <div className="flex items-center gap-2.5 mb-3">
                <Avatar src={user.avatar} name={user.nickname} size={9} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-baylink-text truncate">{user.nickname}</div>
                  <div className="text-[11px] text-baylink-muted">{user.role==='admin'?'管理员':'湾区邻居'}</div>
                </div>
             </div>
             <button onClick={() => openCreate('client')} className="w-full py-2.5 btn-primary text-[11px] flex items-center justify-center gap-1"><Plus size={15}/> 发布需求</button>
          </div>
       ) : (
          <div className="sidebar-panel mb-3 text-center py-4">
             <h3 className="sidebar-section-title mb-1">加入 BAYLINK</h3>
             <p className="text-[11px] text-baylink-muted mb-3">连接湾区华人邻里</p>
             <button onClick={() => setShowLogin(true)} className="w-full py-2.5 btn-primary text-[11px]">立即登录</button>
          </div>
       )}
       <BayBayAssistantEntry
         variant="sidebar"
         onNavigate={navigate}
         onCreatePostClick={(opts) => openCreate(opts?.postType || 'client', opts?.category)}
       />
       <div className="sidebar-panel mb-2.5">
         <h3 className="sidebar-section-title mb-2">热门方向</h3>
         <p className="mb-2 text-[11px] text-baylink-muted">常见邻里需求参考</p>
         <div className="space-y-1 text-[12px] text-baylink-text-secondary">
           {['退房清洁', '周末搬家', '近 BART 长租', '机场接送'].map((t) => (
             <div key={t} className="rounded-lg bg-baylink-section/35 px-2.5 py-1.5">{t}</div>
           ))}
         </div>
       </div>
       <div className="sidebar-note mb-2.5">
         <h3 className="sidebar-section-title mb-1 flex items-center gap-1.5"><MapPin size={13} className="text-baylink-green/70"/> 湾区参考</h3>
         <p className="text-[11px] leading-relaxed">半岛、南湾、东湾都是常见发帖区域</p>
       </div>
       <div className="sidebar-note mb-3 flex gap-2">
         <Shield size={13} className="text-baylink-green/70 shrink-0 mt-0.5"/>
         <p className="text-[11px] leading-relaxed">建议优先联系已认证用户，线下交易注意安全。</p>
       </div>
       <div>
          <h3 className="sidebar-section-title mb-2.5">官方推荐</h3>
          <OfficialAds isAdmin={user?.role === 'admin'} showToast={showToast} onOpenDetail={openAdDetail} refreshKey={adsRefreshKey} />
       </div>
       <div className="mt-6 text-[11px] text-baylink-muted/80 text-center space-y-1.5">
         <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
           <a href="/terms" className="hover:text-baylink-green transition">服务条款</a>
           <a href="/privacy" className="hover:text-baylink-green transition">隐私政策</a>
           <a href="/sms-consent" className="hover:text-baylink-green transition">SMS Verification</a>
         </div>
         <div>© 2025 BayLink</div>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-baylink-bg flex justify-center lg:justify-start font-sans text-baylink-text relative overflow-x-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {detailAd && (
        <AdDetailModal
          ad={detailAd}
          onClose={() => setDetailAd(null)}
          isAdmin={user?.role === 'admin'}
          onDelete={user?.role === 'admin' ? handleDeleteAdFromDetail : undefined}
        />
      )}
      
      <LeftSidebar />
      <div className="w-full max-w-[500px] lg:max-w-[640px] xl:max-w-[680px] bg-baylink-bg-alt min-h-screen lg:shadow-none shadow-card relative flex flex-col lg:border-x border-baylink-border/50 mx-auto lg:mx-0 flex-1 min-w-0">
        <div className="lg:hidden">{isHomePath(location.pathname) && <header className="px-4 pt-safe-top pb-2 flex justify-between items-center gap-2 bg-baylink-bg/90 backdrop-blur-sm z-20 sticky top-0">
            <div className="min-w-0 flex-1 pr-1">
                <img
                  src={BRAND.logoHorizontal}
                  alt="BAYLINK"
                  className="h-7 w-auto max-w-[min(156px,calc(100vw-6rem))] object-contain object-left"
                  width={156}
                  height={28}
                />
                <p className="text-[11px] text-baylink-muted mt-px leading-tight">连接湾区真实生活信息</p>
            </div>
            <button onClick={()=>!user?setShowLogin(true):navigate('/me')} className="shrink-0 rounded-full ring-1 ring-baylink-border/60 active:scale-95 transition overflow-hidden"><Avatar src={user?.avatar} name={user?.nickname} size={8}/></button>
        </header>}</div>
        
        <main className="flex-1 min-h-0 overflow-y-auto bg-transparent hide-scrollbar relative flex flex-col w-full" id="scroll-container">
           {isHomePath(location.pathname) && (
               <div className="px-4 pt-1 sm:px-5 sm:pt-2 pb-[5.5rem] lg:pb-8 max-w-full overflow-x-hidden">
                   <div className="relative mb-1 sm:mb-2 group">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-baylink-muted/70 group-focus-within:text-baylink-green/80 transition pointer-events-none" size={16} />
                     <input className="search-input" placeholder="搜索房源、服务、二手、接送..." value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchPostsNow()} />
                   </div>
                   
                   {!keyword && (
                     <>
                       <BayHero
                         onPublishNeed={() => openCreate('client')}
                         onBrowseResources={() => {
                           setFeedType('provider');
                           document.getElementById('home-feed-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                         }}
                       />
                       <div id="baybay-home-entry">
                         <BayBayAssistantEntry
                           variant="inline"
                           onNavigate={navigate}
                           onCreatePostClick={(opts) => openCreate(opts?.postType || 'client', opts?.category)}
                           categoryHint={categorySlug}
                         />
                       </div>
                       <div className="hidden md:block">
                         <ChannelShortcuts onChannel={handleChannelClick} />
                       </div>
                       <HotRecommend
                         onOpenPost={navigateToPost}
                         refreshKey={featuredRefreshKey}
                         onViewMore={() => navigate('/recommend')}
                         onAskBayBay={() => document.getElementById('baybay-home-entry')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                         onPublish={() => openCreate('client')}
                       />
                     </>
                   )}

                   <div id="home-feed-section">
                   <FeedSwitch feedType={feedType} onClient={() => setFeedType('client')} onProvider={() => setFeedType('provider')} />
                   </div>

                   <div className="hidden lg:flex gap-1.5 overflow-x-auto hide-scrollbar mb-2">{['全部', ...REGIONS].map(r => <FilterTag key={r} label={r === '全部' ? '全部地区' : r} active={regionFilter === r} onClick={() => setRegionFilter(r)} />)}</div>

                   <div className="lg:hidden mb-1.5">
                       <div className="flex gap-1.5 overflow-x-auto hide-scrollbar -mx-1 px-1"><FilterTag label="全部" active={regionFilter === '全部'} onClick={() => setRegionFilter('全部')} />{REGIONS.map(r => <FilterTag key={r} label={r} active={regionFilter === r} onClick={() => setRegionFilter(r)} />)}</div>
                   </div>
                   <div className="mb-2">
                       <div className="flex gap-1.5 overflow-x-auto hide-scrollbar lg:flex-wrap -mx-1 px-1 lg:mx-0 lg:px-0">
                         <CategoryChip label="全部" active={categoryFilter==='全部'} onClick={() => navigateToCategory('全部')} />
                         {CATEGORIES.map(c => <CategoryChip key={c} label={c} active={categoryFilter===c} onClick={() => navigateToCategory(c)} />)}
                       </div>
                   </div>

                   {categorySlug && categoryFilter !== '全部' && !keyword && (
                     <CategoryGuideStrip
                       categorySlug={categorySlug}
                       onOpenGuide={(slug) => navigate(`/guides/${slug}`)}
                     />
                   )}
                   
                   <div className="flex items-center justify-between mb-2 px-0.5">
                     <h3 className="text-xs font-semibold text-baylink-text">社区动态</h3>
                     <span className="text-[11px] text-baylink-muted">{feedType === 'provider' ? '本地资源' : '邻里需求'}</span>
                   </div>
                   
                   {feedError && posts.length === 0 && !isInitialLoading ? (
                     <div className="py-14 text-center space-y-4 px-4">
                       <p className="text-sm text-baylink-text-secondary">加载失败，可能是网络较慢，请稍后重试。</p>
                       <button type="button" onClick={retryFeed} className="rounded-xl bg-baylink-green px-5 py-2.5 text-sm font-semibold text-white shadow-rest hover:bg-baylink-green-hover active:scale-95 transition">重新加载</button>
                     </div>
                   ) : isInitialLoading && posts.length === 0 ? (
                     <div className="py-16 text-center space-y-3">
                       <Loader2 className="animate-spin w-9 h-9 text-baylink-green mx-auto"/>
                       <p className="text-sm text-baylink-muted">加载中...</p>
                       <p className="text-[11px] text-baylink-muted/80">首次加载可能需要几秒钟，请稍候。</p>
                     </div>
                   ) : posts.length === 0 ? (
                     <EmptyFeed
                       feedType={feedType}
                       keyword={keyword}
                       onPublishService={() => openCreate('provider')}
                       onPublishInfo={() => openCreate('client')}
                     />
                   ) : (
                     <>
                       {posts.map(p => <PostCard key={p.id} post={p} currentUser={user} onEdit={openEditPost} onDelete={handleDeletePost} onToggleFeature={handleToggleFeature} onReport={(post: PostData) => openReportTarget({ targetType: 'post', targetId: post.id, authorId: post.authorId })} onToggleBlockUser={handleToggleBlockUser} blockedUserIds={blockedUserIds} onClick={()=>navigateToPost(p)} onContactClick={()=>{if(!user)return setShowLogin(true); openChat(p.authorId, p.author.nickname);}} onAvatarClick={openUserProfile} onImageClick={(src:string) => setViewingImage(src)} onShare={(post: PostData) => setSharingPost(post)} />)}
                       {!isInitialLoading && hasMore && <button onClick={handleLoadMore} disabled={isLoadingMore} className="w-full py-3 mt-3 bg-white text-baylink-text text-sm font-semibold rounded-2xl border border-baylink-border shadow-card hover:border-baylink-green/30 transition disabled:opacity-50">{isLoadingMore ? <Loader2 className="animate-spin mx-auto w-5 h-5 text-baylink-green"/> : '加载更多'}</button>}
                       {!hasMore && <div className="text-center py-6 text-baylink-muted text-xs">— 已浏览全部 —</div>}
                     </>
                   )}

               </div>
           )}
           {(isGuidesList || (isGuidesPath(location.pathname) && guideSlugParam)) && (
             guideSlugParam ? (
               <GuideDetail
                 slug={guideSlugParam}
                 onBack={navigateBack}
                 onOpenGuide={(slug) => navigate(`/guides/${slug}`)}
                 onNavigate={navigate}
                 onOpenPost={() => {
                   if (!user) { setShowLogin(true); return; }
                   openCreate('client');
                 }}
               />
             ) : (
               <GuidesHome onOpenGuide={(slug) => navigate(`/guides/${slug}`)} />
             )
           )}
           {tab === 'messages' && !threadIdParam && <div className="flex flex-col h-full w-full pb-24 lg:pb-0 bg-baylink-bg"><div className="px-5 pt-safe-top pb-4 bg-white/75 backdrop-blur-xl sticky top-0 z-10 border-b border-black/[0.06]"><h2 className="type-page-title">消息</h2></div><MessagesList currentUser={user} onOpenChat={(c)=>{ setChatConv(c); navigate(`/messages/${c.id}`); }} onOpenProfile={openUserProfile}/></div>}
           {tab === 'notifications' && (
             <div className="flex flex-col h-full w-full pb-24 lg:pb-0">
               <div className="px-5 pt-safe-top pb-3 bg-baylink-bg/95 backdrop-blur-sm sticky top-0 z-10 border-b border-baylink-border/40">
                 <h2 className="text-lg font-bold text-baylink-text">推荐</h2>
                 <p className="text-[11px] text-baylink-muted mt-0.5 leading-relaxed">热门推荐为精选帖子，官方推荐为认证服务与广告</p>
               </div>
               <div className="flex-1 overflow-y-auto p-4">
                 <h3 className="mb-2 flex items-center gap-1 text-sm font-bold text-baylink-text"><Sparkles size={14} className="text-baylink-green" /> 热门推荐</h3>
                 <FeaturedPostsSection onOpenPost={navigateToPost} refreshKey={featuredRefreshKey} compact currentUser={user} onToggleFeature={handleToggleFeature} onOpenProfile={openUserProfile} />
                 <h3 className="mb-2 mt-2 flex items-center gap-1 text-sm font-bold text-baylink-text"><BadgeCheck size={14} className="text-baylink-green" /> 官方推荐</h3>
                 <OfficialAds isAdmin={user?.role === 'admin'} showToast={showToast} onOpenDetail={openAdDetail} refreshKey={adsRefreshKey} layout="list" />
               </div>
             </div>
           )}
           {(tab === 'profile' || location.pathname === '/me') && <ProfileView user={user} onLogin={()=>setShowLogin(true)} onLogout={handleLogout} onOpenPost={navigateToPost} onUpdateUser={setUser} showToast={showToast} onOpenBlockedUsers={() => { if (!user) { setShowLogin(true); return; } setShowBlockedUsersModal(true); }} />}
           {location.pathname === '/privacy' && <PrivacyPolicyView />}
           {location.pathname === '/terms' && <TermsView />}
           {location.pathname === '/sms-consent' && <SmsConsentView />}
        </main>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/75 backdrop-blur-xl border-t border-black/[0.06] pb-safe-bar max-w-[500px] mx-auto">
          <div className="flex justify-around items-center px-0.5 pt-1.5 pb-0.5">
           <button onClick={()=>navigate('/')} className={`flex flex-col items-center gap-0 py-1 min-w-[48px] transition active:scale-95 ${isHomePath(location.pathname)?'tab-bar-active':'text-baylink-muted/80'}`}>
             <Home size={20} strokeWidth={isHomePath(location.pathname)?2.5:1.75}/><span className={`text-[10px] mt-0.5 ${isHomePath(location.pathname)?'font-medium':'font-normal'}`}>首页</span>
           </button>
           <button onClick={()=>navigate('/guides')} className={`flex flex-col items-center gap-0 py-1 min-w-[48px] transition active:scale-95 ${tab==='guides'?'tab-bar-active':'text-baylink-muted/80'}`}>
             <BookOpen size={20} strokeWidth={tab==='guides'?2.5:1.75}/><span className={`text-[10px] mt-0.5 ${tab==='guides'?'font-medium':'font-normal'}`}>指南</span>
           </button>
           <button onClick={()=>openCreate('client')} className="flex flex-col items-center -mt-3 active:scale-95 transition px-1">
             <div className="w-10 h-10 bg-baylink-green rounded-[18px] shadow-rest flex items-center justify-center text-white ring-2 ring-baylink-bg/90"><Plus size={20} strokeWidth={2.5}/></div>
             <span className="text-[10px] font-medium text-baylink-green mt-0.5">发布</span>
           </button>
           <button onClick={()=>navigate('/messages')} className={`flex flex-col items-center gap-0 py-1 min-w-[48px] transition active:scale-95 relative ${tab==='messages'?'tab-bar-active':'text-baylink-muted/80'}`}>
             <MessageCircle size={20} strokeWidth={tab==='messages'?2.5:1.75}/>
             {hasNotification && <div className="absolute top-0.5 right-2.5 w-1.5 h-1.5 bg-baylink-orange rounded-full"></div>}
             <span className={`text-[10px] mt-0.5 ${tab==='messages'?'font-medium':'font-normal'}`}>消息</span>
           </button>
           <button onClick={()=>navigate('/me')} className={`flex flex-col items-center gap-0 py-1 min-w-[48px] transition active:scale-95 ${tab==='profile'?'tab-bar-active':'text-baylink-muted/80'}`}>
             <UserIcon size={20} strokeWidth={tab==='profile'?2.5:1.75}/><span className={`text-[10px] mt-0.5 ${tab==='profile'?'font-medium':'font-normal'}`}>我的</span>
           </button>
          </div>
        </nav>

        <BayBayAssistantEntry
          variant="headless"
          panelOpen={baybayPanelOpen}
          onPanelOpenChange={setBaybayPanelOpen}
          onNavigate={navigate}
          onCreatePostClick={(opts) => openCreate(opts?.postType || 'client', opts?.category)}
        />
        <BayBayFloatingLauncher
          baybayPanelOpen={baybayPanelOpen}
          onWriteRent={() => openCreateFromSlug('client', 'rent')}
          onLocalHelp={() => openCreateFromSlug('client', 'other')}
          onAskBayBay={() => setBaybayPanelOpen(true)}
          onPromoteService={() => openCreateFromSlug('provider', 'other')}
        />

        {/* Modals */}
        {showLogin && (
          <LoginModal
            onClose={() => setShowLogin(false)}
            onLogin={setUser}
            showToast={showToast}
            onForgotPassword={handleOpenForgotPassword}
          />
        )}
        {showForgotPassword && (
          <ForgotPasswordModal
            isOpen={showForgotPassword}
            onClose={() => setShowForgotPassword(false)}
            onSubmit={(email) => api.forgotPassword(email)}
          />
        )}
        {resetPasswordToken && (
          <ResetPasswordModal
            isOpen={!!resetPasswordToken}
            token={resetPasswordToken}
            onClose={() => {
              window.history.replaceState({}, '', '/');
              setResetPasswordToken(null);
            }}
            onSuccess={handleResetPasswordSuccess}
            onSubmit={(token, newPassword) => api.resetPassword(token, newPassword)}
          />
        )}
        {showCreate && user && (
          <CreatePostModal
            user={user}
            mode={editingPost ? 'edit' : 'create'}
            editingPost={editingPost}
            defaultType={createDefaultType}
            defaultCategory={createDefaultCategory}
            onClose={() => { setShowCreate(false); setEditingPost(null); setCreateDefaultCategory(undefined); }}
            onCreated={() => { fetchPosts(1, true); setFeaturedRefreshKey((k) => k + 1); }}
            onUpdated={() => { fetchPosts(1, true); setFeaturedRefreshKey((k) => k + 1); }}
            showToast={showToast}
          />
        )}
        {postIdParam && postRouteLoading && !selectedPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80"><Loader2 className="h-8 w-8 animate-spin text-baylink-green" /></div>
        )}
        {postIdParam && postRouteMissing && <PostNotFoundView onBack={navigateBack} />}
        {postIdParam && selectedPost && !postRouteMissing && (
          <PostDetailModal
            post={selectedPost}
            detailRefreshing={postDetailRefreshing}
            currentUser={user}
            onClose={navigateBack}
            onLoginNeeded={() => setShowLogin(true)}
            onOpenChat={openChat}
            onOpenUserProfile={openUserProfile}
            onEdit={(p: PostData) => { navigateBack(); openEditPost(p); }}
            onToggleFeature={handleToggleFeature}
            onDeleted={() => { navigate('/'); fetchPosts(1, true); setFeaturedRefreshKey((k) => k + 1); }}
            onImageClick={(src: string) => setViewingImage(src)}
            onShare={(p: PostData) => setSharingPost(p)}
            onReport={(p: PostData) => openReportTarget({ targetType: 'post', targetId: p.id, authorId: p.authorId })}
            onToggleBlockUser={handleToggleBlockUser}
            blockedUserIds={blockedUserIds}
            showToast={showToast}
          />
        )}
        {chatConv && user && threadIdParam && (
          <ChatView
            currentUser={user}
            conversation={chatConv}
            onClose={() => { setChatConv(null); navigate('/messages'); }}
            socket={socket}
            onViewProfile={openUserProfile}
            onToggleBlockUser={handleToggleBlockUser}
            blockedUserIds={blockedUserIds}
            showToast={showToast}
          />
        )}
        {userIdParam && (
          <UserProfileModal
            userId={userIdParam}
            onClose={navigateBack}
            currentUser={user}
            onChat={openChat}
            onOpenRecentPost={openRecentPostFromProfile}
            showToast={showToast}
            onLoginNeeded={() => setShowLogin(true)}
            onReportUser={(id) => openReportTarget({ targetType: 'user', targetId: id })}
            onToggleBlockUser={handleToggleBlockUser}
            blockedUserIds={blockedUserIds}
          />
        )}
        {showBlockedUsersModal && user && (
          <BlockedUsersModal
            isOpen={showBlockedUsersModal}
            onClose={() => setShowBlockedUsersModal(false)}
            loadBlocks={api.getMyBlocks}
            onUnblock={handleUnblockUser}
            showToast={showToast}
            Avatar={Avatar}
          />
        )}
        {reportTarget && (
          <ReportModal
            targetType={reportTarget.targetType}
            targetId={reportTarget.targetId}
            onClose={() => setReportTarget(null)}
            onSubmit={handleSubmitReport}
          />
        )}
        {viewingUserId && <PublicProfileModal userId={viewingUserId} onClose={() => setViewingUserId(null)} onChat={openChat} currentUser={user} showToast={showToast}/>}
        {viewingImage && <ImageViewer src={viewingImage} onClose={() => setViewingImage(null)} />}
        {sharingPost && <ShareModal post={sharingPost} onClose={() => setSharingPost(null)} showToast={showToast} />}
      </div>
      <RightSidebar />
    </div>
  );
}
