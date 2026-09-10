// 共享类型定义：App 各页面 / 组件 / api client 共用
export type Role = 'user' | 'admin';
export type PostType = 'client' | 'provider';
export type ProfileTheme = 'bay' | 'sunset' | 'redwood' | 'lavender';

export interface UserData {
  id: string; email: string; nickname: string; role: Role;
  contactType: 'phone'|'wechat'|'email'; contactValue: string; isBanned: boolean; token?: string;
  bio?: string; avatar?: string;
  profileTheme?: ProfileTheme; statusText?: string; coverImage?: string;
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

export interface AdData { id: string; title: string; content: string; imageUrl?: string; isVerified: boolean; description?: string; createdAt?: string | number; }

export type AdDetailItem = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  isVerified?: boolean;
  isDemo?: boolean;
};

export interface PostData {
  id: string; authorId: string; author: { id?: string; nickname: string; avatar?: string; isPhoneVerified?: boolean; isOfficialVerified?: boolean; isAdmin?: boolean; role?: Role; };
  type: PostType; title: string; city: string; category: string; timeInfo: string; budget: string;
  description: string; contactInfo: string | null; imageUrls: string[];
  likesCount: number; hasLiked: boolean; commentsCount: number; comments?: any[];
  createdAt: number; updatedAt?: number;
  status?: 'active' | 'closed';
  confirmedAt?: number | null;
  isFeatured?: boolean;
  featuredAt?: number | string;
  featuredBy?: string;
  isContacted?: boolean; isReported?: boolean;
  contactPreference?: {
    mode: 'dm_first' | 'auto_send' | 'manual_approve';
    methods: Array<{ type: string; label: string; value?: string; note?: string; enabled: boolean }>;
    updatedAt?: number | null;
  };
}

export type PublicUserProfile = {
  id: string;
  nickname: string;
  avatar?: string;
  bio?: string;
  profileTheme?: ProfileTheme;
  statusText?: string;
  coverImage?: string;
  area?: string;
  city?: string;
  profileTags?: string[];
  interests?: string[];
  website?: string;
  xiaohongshu?: string;
  role: Role;
  isAdmin?: boolean;
  createdAt?: number;
  isPhoneVerified?: boolean;
  isOfficialVerified?: boolean;
  officialVerification?: { status?: 'none' | 'pending' | 'approved' | 'rejected'; type?: string };
  socialLinks?: { linkedin?: string; instagram?: string };
  postCount: number;
  recentPosts: Array<{ id?: string; _id?: string; title: string; description?: string; category: string; city: string; type?: PostType; budget?: string; imageUrls?: string[]; createdAt: number; updatedAt?: number }>;
  viewerHasBlockedUser?: boolean;
  viewerIsBlockedByUser?: boolean;
};

export interface Conversation {
  id: string;
  otherUser: { id: string; nickname: string; avatar?: string; isPhoneVerified?: boolean; isOfficialVerified?: boolean; isAdmin?: boolean; role?: Role; profileTheme?: ProfileTheme; statusText?: string; city?: string; };
  unreadCount?: number;
  lastMessage?: string;
  updatedAt: number;
  lastPostTitle?: string; // ✨ 上下文
  lastPostId?: string;
}

export interface Message {
  id: string;
  conversationId?: string;
  senderId: string;
  type: 'text' | 'contact-request' | 'contact-share' | 'contact_card';
  messageType?: 'text' | 'system' | 'contact_card';
  content: string;
  replyTo?: { id: string; senderId: string; content: string };
  reactions?: Array<{ emoji: string; userIds: string[] }>;
  reactionVersion?: number;
  contactCard?: {
    postId?: string;
    contactRequestId?: string;
    methods: Array<{ type: string; label?: string; value: string; note?: string }>;
  };
  createdAt: number;
}

export type ReportTarget = { targetType: 'post' | 'user'; targetId: string; authorId?: string };

export type DefaultCover = {
  id: string;
  title: string;
  type: 'client' | 'provider';
  category: string;
  url: string;
  tags: string[];
};
