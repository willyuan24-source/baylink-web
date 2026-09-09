// AppLayout 通过 <Outlet context> 传给各路由页面的共享状态与操作
import { useOutletContext } from 'react-router-dom';
import type { HOME_CHANNELS } from '../lib/constants';
import type {
  AdDetailItem, Conversation, PostData, PostType, ReportTarget, UserData,
} from '../lib/types';

export type ShowToast = (message: string, type?: 'success' | 'error' | 'info') => void;

export type AppContextValue = {
  user: UserData | null;
  setUser: (u: UserData | null) => void;
  showToast: ShowToast;
  setShowLogin: (v: boolean) => void;
  handleLogout: () => void;
  chatRouteStatus: 'idle' | 'loading' | 'ready' | 'not-found' | 'error';
  chatRouteError: string | null;
  retryChatRoute: () => void;

  // 首页 feed（状态留在布局层，跨 tab 切换不丢）
  posts: PostData[];
  feedType: PostType;
  setFeedType: (t: PostType) => void;
  keyword: string;
  setKeyword: (k: string) => void;
  searchPostsNow: () => void;
  regionFilter: string;
  setRegionFilter: (r: string) => void;
  categoryFilter: string;
  feedError: boolean;
  isInitialLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  handleLoadMore: () => void;
  retryFeed: () => void;
  blockedUserIds: string[];

  // 导航
  navigateToPost: (post: PostData) => void;
  navigateToCategory: (category: string) => void;
  openUserProfile: (userId: string) => void;
  /** 覆盖层方式打开帖子（带 backgroundLocation，来源页保持挂载） */
  openPostById: (postId: string) => void;
  openRecentPostFromProfile: (post: { id?: string; _id?: string }) => void;
  handleChannelClick: (ch: typeof HOME_CHANNELS[number]) => void;

  // 操作
  openCreate: (type?: PostType, category?: string) => void;
  openEditPost: (post: PostData) => void;
  handleDeletePost: (post: PostData) => void;
  handleToggleFeature: (post: PostData) => void;
  handleToggleLike: (post: PostData, onSynced?: (postId: string, liked: boolean, likesCount: number) => void) => void;
  handleToggleBlockUser: (userId: string) => void;
  openReportTarget: (target: ReportTarget) => void;
  openChat: (targetId: string, nickname?: string, postTitle?: string) => void;
  openConversation: (c: Conversation) => void;
  setViewingImage: (src: string | null) => void;
  setSharingPost: (post: PostData | null) => void;
  openAdDetail: (ad: AdDetailItem) => void;
  openBlockedUsersModal: () => void;
  setBaybayPanelOpen: (open: boolean) => void;

  adsRefreshKey: number;
  featuredRefreshKey: number;
  contactRequestRefreshKey: number;
  setContactRequestRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  setPendingContactRequestCount: (n: number) => void;
};

export const useApp = () => useOutletContext<AppContextValue>();
