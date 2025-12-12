// 文件路径: src/types/index.ts

export type Role = 'user' | 'admin';
export type PostType = 'client' | 'provider';

export interface UserData {
  id: string; 
  email: string; 
  nickname: string; 
  role: Role;
  contactType: 'phone'|'wechat'|'email'; 
  contactValue: string; 
  isBanned: boolean; 
  token?: string;
  bio?: string; 
  avatar?: string;
  socialLinks?: { linkedin?: string; instagram?: string; };
}

export interface AdData { 
  id: string; 
  title: string; 
  content: string; 
  imageUrl?: string; 
  isVerified: boolean; 
}

export interface PostData {
  id: string; 
  authorId: string; 
  author: { nickname: string; avatar?: string; }; 
  type: PostType; 
  title: string; 
  city: string; 
  category: string; 
  timeInfo: string; 
  budget: string;
  description: string; 
  contactInfo: string | null; 
  imageUrls: string[];
  likesCount: number; 
  hasLiked: boolean; 
  commentsCount: number; 
  comments?: any[];
  createdAt: number; 
  isContacted?: boolean;
  isReported?: boolean;
}

export interface Conversation { 
  id: string; 
  otherUser: { id: string; nickname: string; avatar?: string; }; 
  lastMessage?: string; 
  updatedAt: number; 
}

export interface Message { 
  id: string; 
  senderId: string; 
  type: 'text'|'contact-request'|'contact-share'; 
  content: string; 
  createdAt: number; 
}