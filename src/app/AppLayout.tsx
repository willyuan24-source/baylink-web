// 应用布局层：共享状态容器 + 侧栏/底部导航 chrome + URL 驱动的覆盖层（帖子/用户/聊天）+ 全局弹层
// 页面内容由 <Outlet context> 渲染；/posts/:id 与 /users/:id 通过 background-location 模式覆盖在来源页之上
import { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useLocation, useNavigate, type Location } from 'react-router-dom';
import {
  MessageCircle, Plus, User as UserIcon, Home, BookOpen, Search, Shield, Loader2,
} from 'lucide-react';
import type { Socket } from 'socket.io-client';
import { BRAND } from '../brandAssets';
import { api, SOCKET_URL } from '../lib/api';
import { CATEGORIES, HOME_CHANNELS } from '../lib/constants';
import { filterPostsByBlockedUsers, friendlyErrorMessage } from '../lib/format';
import type {
  AdDetailItem, Conversation, PostData, PostType, PublicUserProfile, ReportTarget, UserData,
} from '../lib/types';
import {
  getCategoryFromSlug, getSlugFromCategory, tabFromPathname, isHomePath, isGuidesPath,
} from '../routing';
import type { AppContextValue } from './context';

import Avatar from '../components/Avatar';
import { ConfirmHost, confirmDialog } from '../components/ui/confirm';
import { Toast } from '../components/Toast';
import { ImageViewer } from '../components/ImageViewer';
import { PostNotFoundView } from '../components/PostNotFoundView';
import { BayBayAssistantEntry } from '../components/BayBayAssistantEntry';
import { BayBayFloatingLauncher } from '../components/BayBayFloatingLauncher';
import { ForgotPasswordModal } from '../components/ForgotPasswordModal';
import { ResetPasswordModal } from '../components/ResetPasswordModal';
import { BlockedUsersModal } from '../components/BlockedUsersModal';
import ReportModal, { type ReportReason } from '../components/ReportModal';
import { PostShareSheet } from '../components/PostShareSheet';
import { CategoryChip } from '../features/home/HomeSections';
import { AdDetailModal, OfficialAds } from '../features/ads/OfficialAds';
import { LoginModal } from '../features/auth/LoginModal';

// 大弹层懒加载：发帖（含图片压缩管线）/ 帖子详情 / 聊天 / 用户名片只在打开时才拉取代码
const CreatePostModal = lazy(() => import('../features/posts/CreatePostModal').then((m) => ({ default: m.CreatePostModal })));
const PostDetailModal = lazy(() => import('../features/posts/PostDetailModal').then((m) => ({ default: m.PostDetailModal })));
const UserProfileModal = lazy(() => import('../features/users/UserProfileModal').then((m) => ({ default: m.UserProfileModal })));
const ChatView = lazy(() => import('../features/messages/ChatView').then((m) => ({ default: m.ChatView })));

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = tabFromPathname(location.pathname);
  const tabRef = useRef(tab);
  useEffect(() => { tabRef.current = tab; }, [tab]);
  const categorySlug = location.pathname.startsWith('/category/')
    ? location.pathname.split('/category/')[1]?.split('/')[0]
    : undefined;

  const [user, setUser] = useState<UserData | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetPasswordToken, setResetPasswordToken] = useState<string | null>(null);
  const [baybayPanelOpen, setBaybayPanelOpen] = useState(false);
  const [baybayPendingQuestion, setBaybayPendingQuestion] = useState<string | null>(null);
  const [baybayCategoryHint, setBaybayCategoryHint] = useState<string | undefined>(undefined);
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
  const fetchSeqRef = useRef(0);
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const [postDetailRefreshing, setPostDetailRefreshing] = useState(false);
  const sessionExpiredHandledRef = useRef(false);
  const [postRouteMissing, setPostRouteMissing] = useState(false);
  const [postRouteLoading, setPostRouteLoading] = useState(false);
  const [chatConv, setChatConv] = useState<Conversation | null>(null);
  const [regionFilter, setRegionFilter] = useState<string>('全部');
  const [categoryFilter, setCategoryFilter] = useState<string>('全部');

  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [sharingPost, setSharingPost] = useState<PostData | null>(null);

  // ✨ Toast & Socket State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; id: number } | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [hasNotification, setHasNotification] = useState(false);
  const [pendingContactRequestCount, setPendingContactRequestCount] = useState(0);
  const [contactRequestRefreshKey, setContactRequestRefreshKey] = useState(0);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [showBlockedUsersModal, setShowBlockedUsersModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [detailAd, setDetailAd] = useState<AdDetailItem | null>(null);
  const [adsRefreshKey, setAdsRefreshKey] = useState(0);
  const [featuredRefreshKey, setFeaturedRefreshKey] = useState(0);
  // id 让相同内容的 toast 也能通过 key 强制重挂载，从而每次调用都重置 3 秒计时
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => setToast({ message, type, id: Date.now() });

  const postIdParam = location.pathname.startsWith('/posts/') ? location.pathname.split('/posts/')[1]?.split('/')[0] : undefined;
  const userIdParam = location.pathname.startsWith('/users/') ? location.pathname.split('/users/')[1]?.split('/')[0] : undefined;
  const threadIdParam = location.pathname.match(/^\/messages\/([^/]+)/)?.[1];
  const guideSlugParam = location.pathname.startsWith('/guides/') ? location.pathname.split('/guides/')[1]?.split('/')[0] : undefined;

  const navigateBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  // 帖子 / 用户覆盖层带上 backgroundLocation：来源页保持挂载在覆盖层之下（滚动位置、feed 状态都不丢）。
  // 已在覆盖层中再跳覆盖层时沿用同一个背景，避免背景层层嵌套。
  const overlayNavState = () => {
    const bg = (location.state as { backgroundLocation?: Location } | null)?.backgroundLocation;
    return { backgroundLocation: bg || location };
  };

  const navigateToPost = (post: PostData) => navigate(`/posts/${post.id}`, { state: overlayNavState() });
  const openRecentPostFromProfile = (post: { id?: string; _id?: string }) => {
    const postId = post?.id || post?._id;
    if (!postId) {
      showToast('帖子链接不可用', 'error');
      return;
    }
    navigate(`/posts/${postId}`, { state: overlayNavState() });
  };
  const navigateToCategory = (category: string) => {
    const slug = getSlugFromCategory(category);
    if (slug) navigate(`/category/${slug}`);
    else navigate('/');
  };

  const openAdDetail = (ad: AdDetailItem) => setDetailAd(ad);
  const handleDeleteAdFromDetail = async (id: string) => {
    if (!(await confirmDialog({ title: '删除推荐', message: '确定删除这条官方推荐？', confirmText: '删除', danger: true }))) return;
    try {
      await api.request(`/ads/${id}`, { method: 'DELETE' });
      setDetailAd(null);
      setAdsRefreshKey((k) => k + 1);
      showToast('已删除', 'success');
    } catch (e) {
      showToast(friendlyErrorMessage(e, '删除失败，请稍后再试'), 'error');
    }
  };

  // ✨ Socket 初始化：握手携带 JWT，服务端仅允许加入本人 room
  // socket.io-client 动态加载：未登录访客的首包不用背这份体积
  useEffect(() => {
    if (!user?.token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    let cancelled = false;
    let created: Socket | null = null;
    (async () => {
      const { io } = await import('socket.io-client');
      if (cancelled) return;

      const newSocket = io(SOCKET_URL, {
        auth: { token: user.token },
      });
      created = newSocket;

      newSocket.on('connect', () => {
        console.log('Socket Connected');
        newSocket.emit('join_room');
      });

      newSocket.on('connect_error', () => {
        // 鉴权失败时不影响页面渲染
      });

      newSocket.on('new_message', () => {
        if (tabRef.current !== 'messages') {
          setHasNotification(true);
          showToast('收到新私信', 'info');
        }
      });

      setSocket(newSocket);
    })();
    return () => { cancelled = true; created?.disconnect(); };
  }, [user?.id, user?.token]);

  // 切换到消息页时，清除私信未读红点（联系方式请求 badge 由 pending count 单独控制）
  useEffect(() => {
      if (tab === 'messages') setHasNotification(false);
  }, [tab]);

  const refreshPendingContactRequestCount = useCallback(async () => {
    if (!user) {
      setPendingContactRequestCount(0);
      return;
    }
    try {
      const res = await api.getContactRequests('owner', 'pending');
      setPendingContactRequestCount((res.requests || []).length);
    } catch {
      setPendingContactRequestCount(0);
    }
  }, [user]);

  useEffect(() => {
    refreshPendingContactRequestCount();
    if (!user) return;
    const interval = setInterval(refreshPendingContactRequestCount, 30000);
    return () => clearInterval(interval);
  }, [user, refreshPendingContactRequestCount, contactRequestRefreshKey]);

  const showMessagesBadge = hasNotification || pendingContactRequestCount > 0;
  const messagesBadgeCount = pendingContactRequestCount > 0 ? Math.min(pendingContactRequestCount, 99) : 0;

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
    } else if (path.startsWith('/guides')) {
      // /guides/:slug 的具体标题由 GuideDetailPage 设置（guides 语料已懒加载，布局层不再 import）
      if (!guideSlugParam) document.title = '湾区生活指南｜BAYLINK';
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
    // 请求代际守卫：每次调用使之前 in-flight 的请求失效，
    // 防止用户中途切换筛选/Tab 时，旧请求的结果把新列表和 page/hasMore 写脏
    const seq = ++fetchSeqRef.current;
    const searchKw = keywordOverride ?? debouncedKeyword;
    try {
      if (!isRefresh) setIsLoadingMore(true);
      else { setIsInitialLoading(true); setFeedError(false); }
      // 服务端每页 5 条，而地区/分类目前在客户端过滤：筛选激活时一页可能被滤到 0 条，
      // 表现为"点了加载更多却什么都没出现"。这里自动连续翻页直到凑够一批可见帖子或翻完。
      const MIN_VISIBLE_PER_LOAD = 5;
      const MAX_PAGES_PER_LOAD = 4;
      const hasClientFilter = regionFilter !== '全部' || categoryFilter !== '全部' || (!!user && blockedUserIds.length > 0);
      const collected: PostData[] = [];
      const seenIds = new Set<string>();
      let currentPage = pageNum;
      let more = true;
      let pagesFetched = 0;
      while (true) {
        let queryParams = `?type=${feedType}&page=${currentPage}&limit=5`;
        if (searchKw) queryParams += `&keyword=${encodeURIComponent(searchKw)}`;
        const res = await api.request(`/posts${queryParams}`);
        if (fetchSeqRef.current !== seq) return; // 已被更新的请求接管，丢弃本次结果
        const newPosts: PostData[] = res.posts || [];
        more = res.hasMore;
        pagesFetched += 1;
        let filtered = newPosts;
        if (regionFilter !== '全部') filtered = filtered.filter((p: any) => (p.city || '').includes(regionFilter));
        if (categoryFilter !== '全部') filtered = filtered.filter((p: any) => p.category === categoryFilter);
        if (user && blockedUserIds.length) filtered = filterPostsByBlockedUsers(filtered, blockedUserIds);
        for (const p of filtered) {
          if (!seenIds.has(p.id)) { seenIds.add(p.id); collected.push(p); }
        }
        if (!more || !hasClientFilter || collected.length >= MIN_VISIBLE_PER_LOAD || pagesFetched >= MAX_PAGES_PER_LOAD) break;
        // 只在确定还要再翻一页时才前进，保证 setPage 记录的是"实际拉取过"的最后一页，
        // 否则下次 加载更多 会从未拉取的页码之后开始，凭空跳过一页帖子
        currentPage += 1;
      }
      setPage(currentPage);
      if (isRefresh) {
        setPosts(collected);
      } else {
        // 两次翻页之间可能有新帖发布导致服务端分页偏移，按 id 去重避免重复卡片/重复 key
        setPosts(prev => {
          const prevIds = new Set(prev.map(p => p.id));
          return [...prev, ...collected.filter(p => !prevIds.has(p.id))];
        });
      }
      setHasMore(more);
      setFeedError(false);
    } catch (e) {
      if (fetchSeqRef.current !== seq) return;
      console.error(e);
      if (isRefresh) setFeedError(true);
    } finally {
      // 只清理本次调用自己设置的加载标记（即使已被新请求取代也要清，避免标记卡死）
      if (!isRefresh) setIsLoadingMore(false); else setIsInitialLoading(false);
    }
  };

  const retryFeed = () => {
    setPage(1);
    setHasMore(true);
    fetchPosts(1, true);
  };

  const searchPostsNow = () => {
    const kw = keyword.trim();
    setPage(1);
    setHasMore(true);
    if (kw === debouncedKeyword) {
      // 关键词没变时 effect 不会触发，手动刷新一次
      fetchPosts(1, true, kw);
    } else {
      // 关键词变了交给 debouncedKeyword 的 effect 去拉取，避免同一次搜索发两个请求
      setDebouncedKeyword(kw);
    }
  };

  const handleLoadMore = () => { fetchPosts(page + 1, false); };

  // ✨ 已修复：传入 postTitle 作为聊天上下文
  const openChat = async (targetId: string, nickname?: string, postTitle?: string) => {
      try {
          const c = await api.request('/conversations/open-or-create', { method: 'POST', body: JSON.stringify({ targetUserId: targetId }) });
          const conv: Conversation = {
              id: c.id,
              otherUser: c.otherUser || { id: targetId, nickname: nickname || 'User' },
              lastMessage: '',
              updatedAt: c.updatedAt || Date.now(),
              lastPostTitle: postTitle
          };
          setChatConv(conv);
          navigate(`/messages/${c.id}`);
      } catch (e: any) { showToast(friendlyErrorMessage(e, '无法打开聊天'), 'error'); }
  };

  const openConversation = (c: Conversation) => { setChatConv(c); navigate(`/messages/${c.id}`); };

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
    if (!(await confirmDialog({
      title: '屏蔽这个用户？',
      message: '屏蔽后，对方将无法继续给你发送私信。你也不能主动给对方发私信，除非之后取消屏蔽。',
      confirmText: '屏蔽',
      danger: true,
    }))) return;
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
    if (!(await confirmDialog({ title: '删除此贴？', message: '删除后其他用户将无法再看到这条信息。', confirmText: '删除', danger: true }))) return;
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

  const openUserProfile = (userId: string) => navigate(`/users/${userId}`, { state: overlayNavState() });

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

  const applyPostLikeState = (postId: string, liked: boolean, likesCount: number) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, hasLiked: liked, likesCount } : p)));
    setSelectedPost((prev) => (prev?.id === postId ? { ...prev, hasLiked: liked, likesCount } : prev));
  };

  const handleToggleLike = async (
    post: PostData,
    onSynced?: (postId: string, liked: boolean, likesCount: number) => void,
  ) => {
    if (!user) return setShowLogin(true);
    const prevLiked = post.hasLiked;
    const prevCount = post.likesCount;
    const optimisticLiked = !prevLiked;
    const optimisticCount = Math.max(0, prevCount + (optimisticLiked ? 1 : -1));
    applyPostLikeState(post.id, optimisticLiked, optimisticCount);
    onSynced?.(post.id, optimisticLiked, optimisticCount);
    try {
      const res = await api.togglePostLike(post.id);
      applyPostLikeState(post.id, !!res.liked, res.likesCount);
      onSynced?.(post.id, !!res.liked, res.likesCount);
    } catch (e: any) {
      applyPostLikeState(post.id, prevLiked, prevCount);
      onSynced?.(post.id, prevLiked, prevCount);
      showToast(friendlyErrorMessage(e, '操作失败，请稍后再试'), 'error');
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

  const ctx: AppContextValue = {
    user, setUser, showToast, setShowLogin, handleLogout,
    posts, feedType, setFeedType, keyword, setKeyword, searchPostsNow,
    regionFilter, setRegionFilter, categoryFilter,
    feedError, isInitialLoading, isLoadingMore, hasMore, handleLoadMore, retryFeed,
    blockedUserIds,
    navigateToPost, navigateToCategory, openUserProfile, openRecentPostFromProfile, handleChannelClick,
    openCreate, openEditPost, handleDeletePost, handleToggleFeature, handleToggleLike,
    handleToggleBlockUser, openReportTarget, openChat, openConversation,
    setViewingImage, setSharingPost, openAdDetail,
    openBlockedUsersModal: () => { if (!user) { setShowLogin(true); return; } setShowBlockedUsersModal(true); },
    setBaybayPanelOpen,
    adsRefreshKey, featuredRefreshKey,
    contactRequestRefreshKey, setContactRequestRefreshKey, setPendingContactRequestCount,
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
            <div className="relative">
              <MessageCircle size={18} strokeWidth={tab==='messages'?2.5:2}/>
              {showMessagesBadge && (
                messagesBadgeCount > 0 ? (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] rounded-full bg-baylink-orange px-1 py-0.5 text-center text-[9px] font-bold leading-none text-white">{messagesBadgeCount}</span>
                ) : (
                  <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-baylink-orange" />
                )
              )}
            </div> 消息
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
       <BayBayAssistantEntry
         variant="sidebar"
         onNavigate={navigate}
         onCreatePostClick={(opts) => openCreate(opts?.postType || 'client', opts?.category)}
       />
       <div className="sidebar-panel mb-2.5">
         <h3 className="sidebar-section-title mb-2">热门方向</h3>
         <p className="mb-2 text-[11px] text-baylink-muted">大家常找的本地信息，点一下直接搜</p>
         <div className="space-y-1 text-[12px] text-baylink-text-secondary">
           {['退房清洁', '周末搬家', '近 BART 长租', '机场接送'].map((t) => (
             <button
               key={t}
               type="button"
               onClick={() => { setKeyword(t); navigate('/'); }}
               className="flex w-full items-center justify-between rounded-lg bg-baylink-section/35 px-2.5 py-1.5 text-left transition hover:bg-baylink-green/[0.08] hover:text-baylink-green"
             >
               {t}
               <Search size={11} className="text-baylink-muted/50" />
             </button>
           ))}
         </div>
       </div>
       <div className="sidebar-note mb-2.5 flex gap-2">
         <Shield size={13} className="text-baylink-green/70 shrink-0 mt-0.5"/>
         <p className="text-[11px] leading-relaxed">建议优先联系已认证用户，看房、面交、付款前先核实，线下交易注意安全。</p>
       </div>
       <div className="mb-3">
          <OfficialAds isAdmin={user?.role === 'admin'} showToast={showToast} onOpenDetail={openAdDetail} refreshKey={adsRefreshKey} />
       </div>
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
       <div className="mt-6 text-[11px] text-baylink-muted/80 text-center space-y-1.5">
         <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
           <a href="/terms" className="hover:text-baylink-green transition">服务条款</a>
           <a href="/privacy" className="hover:text-baylink-green transition">隐私政策</a>
           <a href="/sms-consent" className="hover:text-baylink-green transition">短信条款</a>
         </div>
         <div>© {new Date().getFullYear()} BAYLINK</div>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-baylink-bg flex justify-center font-sans text-baylink-text relative overflow-x-hidden">
      <ConfirmHost />
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {detailAd && (
        <AdDetailModal
          ad={detailAd}
          onClose={() => setDetailAd(null)}
          isAdmin={user?.role === 'admin'}
          onDelete={user?.role === 'admin' ? handleDeleteAdFromDetail : undefined}
        />
      )}

      {LeftSidebar()}
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
           <Suspense fallback={<div className="flex flex-1 items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-baylink-green" /></div>}>
             <Outlet context={ctx} />
           </Suspense>
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
             <div className="relative">
               <MessageCircle size={20} strokeWidth={tab==='messages'?2.5:1.75}/>
               {showMessagesBadge && (
                 messagesBadgeCount > 0 ? (
                   <span className="absolute -top-1 -right-2 min-w-[14px] rounded-full bg-baylink-orange px-1 py-0.5 text-center text-[8px] font-bold leading-none text-white">{messagesBadgeCount}</span>
                 ) : (
                   <div className="absolute top-0 right-0 h-1.5 w-1.5 rounded-full bg-baylink-orange" />
                 )
               )}
             </div>
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
          onPanelOpenChange={(open) => {
            setBaybayPanelOpen(open);
            if (!open) {
              setBaybayPendingQuestion(null);
              setBaybayCategoryHint(undefined);
            }
          }}
          pendingQuestion={baybayPendingQuestion}
          onPendingQuestionConsumed={() => setBaybayPendingQuestion(null)}
          categoryHint={baybayCategoryHint}
          onNavigate={navigate}
          onCreatePostClick={(opts) => openCreate(opts?.postType || 'client', opts?.category)}
        />
        <BayBayFloatingLauncher
          baybayPanelOpen={baybayPanelOpen}
          hidden={!!(
            showCreate ||
            postIdParam ||
            threadIdParam ||
            tab === 'messages' ||
            showLogin ||
            sharingPost ||
            viewingImage ||
            userIdParam ||
            reportTarget ||
            detailAd
          )}
          onWriteRent={() => openCreateFromSlug('client', 'rent')}
          onLocalHelp={() => openCreateFromSlug('client', 'other')}
          onAskBayBay={() => setBaybayPanelOpen(true)}
          onPromoteService={() => openCreateFromSlug('provider', 'other')}
        />

        {/* Modals（懒加载弹层的 chunk 就绪前不渲染任何占位；帖子详情的数据加载态已有独立 spinner） */}
        <Suspense fallback={null}>
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
            onLike={handleToggleLike}
            onReport={(p: PostData) => openReportTarget({ targetType: 'post', targetId: p.id, authorId: p.authorId })}
            onToggleBlockUser={handleToggleBlockUser}
            blockedUserIds={blockedUserIds}
            showToast={showToast}
            onAskBayBay={(question: string) => {
              setBaybayPendingQuestion(question);
              setBaybayCategoryHint(selectedPost?.category ? (getSlugFromCategory(selectedPost.category) || undefined) : undefined);
              setBaybayPanelOpen(true);
            }}
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
        {viewingImage && <ImageViewer src={viewingImage} onClose={() => setViewingImage(null)} />}
        {sharingPost && <PostShareSheet post={sharingPost} onClose={() => setSharingPost(null)} showToast={showToast} />}
        </Suspense>
      </div>
      {RightSidebar()}
    </div>
  );
}
