// 应用布局层：共享状态容器 + 侧栏/底部导航 chrome + URL 驱动的覆盖层（帖子/用户/聊天）+ 全局弹层
// 页面内容由 <Outlet context> 渲染；/posts/:id 与 /users/:id 通过 background-location 模式覆盖在来源页之上
import { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { Link, Outlet, useNavigate, type Location } from 'react-router-dom';
import {
  MessageCircle, Plus, User as UserIcon, Home, BookOpen, Search, MapPin, ArrowUpRight, Loader2,
} from 'lucide-react';
import type { Socket } from 'socket.io-client';
import { BRAND } from '../brandAssets';
import { api, SOCKET_URL } from '../lib/api';
import { getStoredUser, removeStoredUser, SESSION_KEY } from '../lib/session';
import { HOME_CHANNELS, matchesCategory } from '../lib/constants';
import { filterPostsByBlockedUsers, friendlyErrorMessage } from '../lib/format';
import { clearFeedCache, readFeedCache, writeFeedCache } from '../lib/feedCache';
import { setPageMetadata } from '../lib/seo';
import type {
  AdDetailItem, Conversation, PostData, PostType, PublicUserProfile, ReportTarget, UserData,
} from '../lib/types';
import {
  getCategoryFromSlug, getSlugFromCategory, tabFromPathname, isHomePath, isKnownAppPath,
} from '../routing';
import type { AppContextValue } from './context';
import { usePageScroll } from './usePageScroll';

import Avatar from '../components/Avatar';
import { ConfirmHost, confirmDialog } from '../components/ui/confirm';
import { ModalShell } from '../components/ui/Modal';
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
import { SiteNavigation } from '../components/SiteNavigation';
import { QuickExplore } from '../components/QuickExplore';
import { AdDetailModal } from '../features/ads/OfficialAds';
import { LoginModal } from '../features/auth/LoginModal';

// chunk 拉取失败重试一次，瞬时网络错误 / 发版换 hash 不至于直接炸到根级 ErrorBoundary
const retryImport = <T,>(load: () => Promise<T>): Promise<T> =>
  load().catch(() => new Promise<void>((res) => setTimeout(res, 1000)).then(load));

// 大弹层懒加载：发帖（含图片压缩管线）/ 帖子详情 / 聊天 / 用户名片只在打开时才拉取代码
const CreatePostModal = lazy(() => retryImport(() => import('../features/posts/CreatePostModal').then((m) => ({ default: m.CreatePostModal }))));
const PostDetailModal = lazy(() => retryImport(() => import('../features/posts/PostDetailModal').then((m) => ({ default: m.PostDetailModal }))));
const UserProfileModal = lazy(() => retryImport(() => import('../features/users/UserProfileModal').then((m) => ({ default: m.UserProfileModal }))));
const ChatView = lazy(() => retryImport(() => import('../features/messages/ChatView').then((m) => ({ default: m.ChatView }))));

// 懒弹层 chunk 就绪前的可见占位：避免「点了没反应」和深链下的覆盖层空洞
const overlayChunkFallback = (
  <div className="fixed inset-0 z-[110] flex items-center justify-center bg-white/80">
    <Loader2 className="h-8 w-8 animate-spin text-baylink-green" />
  </div>
);

// realLocation 必须由 App（Router 层）传入：本组件渲染在 <Routes location={背景位置}> 之内，
// 这里 useLocation() 只能拿到背景位置，而覆盖层（/posts/:id、/users/:id、聊天）要按真实 URL 渲染
export default function AppLayout({ realLocation }: { realLocation: Location }) {
  const location = realLocation;
  usePageScroll(location);
  const navigate = useNavigate();
  const tab = tabFromPathname(location.pathname);
  const tabRef = useRef(tab);
  useEffect(() => { tabRef.current = tab; }, [tab]);
  const categorySlug = location.pathname.startsWith('/category/')
    ? location.pathname.split('/category/')[1]?.split('/')[0]
    : undefined;

  const [user, setUser] = useState<UserData | null>(getStoredUser);
  const [showLogin, setShowLogin] = useState(false);
  const [quickExploreOpen, setQuickExploreOpen] = useState(false);
  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !event.isComposing && !document.getElementById('root')?.inert) {
        event.preventDefault();
        setQuickExploreOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', openSearch);
    return () => window.removeEventListener('keydown', openSearch);
  }, []);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetPasswordToken, setResetPasswordToken] = useState<string | null>(null);
  const [baybayPanelOpen, setBaybayPanelOpen] = useState(false);
  const [baybayPendingQuestion, setBaybayPendingQuestion] = useState<string | null>(null);
  const [baybayCategoryHint, setBaybayCategoryHint] = useState<string | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const pendingCreateRef = useRef(false);
  const [editingPost, setEditingPost] = useState<PostData | null>(null);

  const [feedType, setFeedType] = useState<PostType>('provider');
  const [createDefaultType, setCreateDefaultType] = useState<PostType>('client');
  const [createDefaultCategory, setCreateDefaultCategory] = useState<string | undefined>(undefined);
  // 上次会话缓存的 feed 先渲染（挂载后的首次 fetch 会在后台刷新替换）。
  // 缓存只存「全部分类」默认视图：/category/:slug 冷启动不读缓存，避免首帧闪现错误分类的帖子
  const [posts, setPosts] = useState<PostData[]>(() => (categorySlug ? [] : readFeedCache('provider')));
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
  const [postRouteError, setPostRouteError] = useState<string | null>(null);
  const [postRetry, setPostRetry] = useState(0);
  const [chatConv, setChatConv] = useState<Conversation | null>(null);
  const [chatRouteStatus, setChatRouteStatus] = useState<AppContextValue['chatRouteStatus']>('idle');
  const [chatRouteError, setChatRouteError] = useState<string | null>(null);
  const [chatRetry, setChatRetry] = useState(0);
  const retryChatRoute = () => setChatRetry((value) => value + 1);
  const [regionFilter, setRegionFilter] = useState<string>('全部');
  // 直接落在 /category/:slug 时按 URL 初始化，省掉一次按「全部」发出的无效首拉
  const [categoryFilter, setCategoryFilter] = useState<string>(() =>
    isHomePath(location.pathname) ? getCategoryFromSlug(categorySlug) : '全部');
  const feedQueryKey = JSON.stringify([feedType, regionFilter, categoryFilter, debouncedKeyword, user?.id || 'guest']);
  const feedQueryKeyRef = useRef(feedQueryKey);

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
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => setToast({ message, type, id: Date.now() }), []);

  const postIdParam = location.pathname.match(/^\/posts\/([^/]+)\/?$/)?.[1];
  const userIdParam = location.pathname.match(/^\/users\/([^/]+)\/?$/)?.[1];
  const threadIdParam = location.pathname.match(/^\/messages\/([^/]+)\/?$/)?.[1];
  const chatPostTitle = typeof location.state?.postTitle === 'string' ? location.state.postTitle : undefined;
  const guideSlugParam = location.pathname.match(/^\/guides\/([^/]+)\/?$/)?.[1];

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
  const openPostById = (postId: string) => navigate(`/posts/${postId}`, { state: overlayNavState() });
  const openRecentPostFromProfile = (post: { id?: string; _id?: string }) => {
    const postId = post?.id || post?._id;
    if (!postId) {
      showToast('帖子链接不可用', 'error');
      return;
    }
    openPostById(postId);
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
      setSocket((previous) => { previous?.disconnect(); return null; });
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
  }, [user?.id, user?.token, showToast]);

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

  // 每次站内导航同步分享摘要与 canonical，避免沿用前一页的元数据。
  useEffect(() => {
    if (!isKnownAppPath(location.pathname)) return; // 404 页独立管理 noindex。
    if (postIdParam) return;
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
    if (guideSlugParam) return; // 指南正文页拥有自己的完整元数据。
    if (userIdParam) document.title = '邻居资料｜BAYLINK';
    setPageMetadata({
      title: document.title,
      description: path.startsWith('/category/') ? `浏览湾区${getCategoryFromSlug(categorySlug)}信息，联系发布者确认详情与当前有效状态。` : 'BAYLINK 湾区华人本地生活社区：查找房源、服务与二手资源，发布邻里需求，阅读湾区生活指南。',
      path,
      noindex: path.startsWith('/messages') || path.startsWith('/users/') || path === '/me' || path.startsWith('/reset-password'),
    });
  }, [location.pathname, categorySlug, postIdParam, userIdParam, guideSlugParam]);

  useEffect(() => {
    if (!userIdParam) return;
    let cancelled = false;
    api.getUserPublicProfile(userIdParam).then((p: PublicUserProfile) => {
      if (!cancelled) setPageMetadata({ title: `${p.nickname}｜BAYLINK`, description: '查看邻居资料与公开发布的信息。', path: `/users/${userIdParam}`, noindex: true });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [userIdParam]);

  // /posts/:id 加载详情（有缓存先展示，始终拉取完整帖子）
  useEffect(() => {
    setPostRouteError(null);
    if (!postIdParam) {
      setSelectedPost(null);
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
      setPageMetadata({ title: `${found.title}｜BAYLINK`, description: found.description.slice(0, 160), path: `/posts/${postIdParam}`, image: found.imageUrls?.[0], type: 'article', noindex: found.status === 'closed' });
    } else {
      setSelectedPost(null);
      setPostRouteLoading(true);
      setPostRouteMissing(false);
      setPageMetadata({ title: '正在加载信息｜BAYLINK', description: '正在读取发布信息。', path: `/posts/${postIdParam}`, noindex: true });
    }
    let cancelled = false;
    (async () => {
      if (found) setPostDetailRefreshing(true);
      try {
        const p = await api.request(`/posts/${postIdParam}`);
        if (!cancelled) {
          setSelectedPost(p);
          setPostRouteMissing(false);
          setPageMetadata({ title: `${p.title}｜BAYLINK`, description: String(p.description || '').slice(0, 160), path: `/posts/${postIdParam}`, image: p.imageUrls?.[0], type: 'article', noindex: p.status === 'closed' });
        }
      } catch (error) {
        if (!cancelled) {
          const status = (error as { status?: number })?.status;
          if (status === 404 || status === 403) {
            setSelectedPost(null);
            setPostRouteMissing(true);
            setPageMetadata({ title: '内容不可访问｜BAYLINK', description: '内容不存在、已移除或不可访问。', path: `/posts/${postIdParam}`, noindex: true });
          } else if (!found) {
            setPostRouteError(friendlyErrorMessage(error, '暂时无法加载，请重试。'));
            setPageMetadata({ title: '暂时无法加载｜BAYLINK', description: '服务暂时不可用，请稍后重试。', path: `/posts/${postIdParam}`, noindex: true });
          } else {
            showToast('详情更新失败，当前显示缓存信息，请稍后重新打开。', 'info');
          }
        }
      } finally {
        if (!cancelled) {
          setPostRouteLoading(false);
          setPostDetailRefreshing(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [postIdParam, posts, user?.id, postRetry, showToast]);

  // /messages/:threadId 打开聊天
  useEffect(() => {
    setChatConv(null);
    setChatRouteError(null);
    if (!threadIdParam || !user) {
      setChatRouteStatus('idle');
      return;
    }
    setChatRouteStatus('loading');
    let cancelled = false;
    (async () => {
      try {
        const convs = await api.request('/conversations');
        if (cancelled) return;
        if (!Array.isArray(convs)) throw new Error('无法读取会话');
        const c = convs.find((x: Conversation) => x.id === threadIdParam);
        if (c) { setChatConv({ ...c, lastPostTitle: chatPostTitle || c.lastPostTitle }); setChatRouteStatus('ready'); }
        else setChatRouteStatus('not-found');
      } catch (error) {
        if (cancelled) return;
        setChatRouteStatus('error');
        setChatRouteError(friendlyErrorMessage(error, '无法加载会话，请重试。'));
      }
    })();
    return () => { cancelled = true; };
  }, [threadIdParam, user, chatRetry, chatPostTitle]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(keyword.trim()), 400);
    return () => clearTimeout(t);
  }, [keyword]);

  // 首屏空闲后预热高频弹层 chunk，让首次点击基本即开
  useEffect(() => {
    const id = window.setTimeout(() => {
      import('../features/posts/PostDetailModal');
      import('../features/users/UserProfileModal');
    }, 2500);
    return () => window.clearTimeout(id);
  }, []);

  const clearLocalSession = useCallback(() => {
    ++fetchSeqRef.current;
    clearFeedCache();
    setUser(null);
    setSocket((prev) => { prev?.disconnect(); return null; });
    setPosts([]);
    setSelectedPost(null);
    setChatConv(null);
    setBlockedUserIds([]);
    setReportTarget(null);
    setShowCreate(false);
    setShowBlockedUsersModal(false);
    setSharingPost(null);
    setHasNotification(false);
    setPendingContactRequestCount(0);
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_KEY && event.key !== null) return;
      clearLocalSession();
      setUser(getStoredUser());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [clearLocalSession]);

  useEffect(() => {
    const onSessionExpired = () => {
      if (!localStorage.getItem('currentUser')) return;
      if (sessionExpiredHandledRef.current) return;
      sessionExpiredHandledRef.current = true;
      removeStoredUser();
      clearLocalSession();
      setShowLogin(true);
      showToast('登录已过期，请重新登录。', 'error');
      window.setTimeout(() => { sessionExpiredHandledRef.current = false; }, 3000);
    };
    window.addEventListener('session-expired', onSessionExpired);
    return () => window.removeEventListener('session-expired', onSessionExpired);
  }, [clearLocalSession, showToast]);

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
  }, [user]);

  const fetchPosts = useCallback(async (pageNum: number, isRefresh: boolean = false, keywordOverride?: string) => {
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
        let queryParams = `?type=${feedType}&page=${currentPage}&limit=6`;
        if (searchKw) queryParams += `&keyword=${encodeURIComponent(searchKw)}`;
        if (categoryFilter !== '全部') queryParams += `&category=${encodeURIComponent(categoryFilter)}`;
        if (regionFilter !== '全部') queryParams += `&city=${encodeURIComponent(regionFilter)}`;
        const res = await api.request(`/posts${queryParams}`);
        if (fetchSeqRef.current !== seq) return; // 已被更新的请求接管，丢弃本次结果
        const newPosts: PostData[] = res.posts || [];
        more = res.hasMore;
        pagesFetched += 1;
        let filtered = newPosts;
        if (regionFilter !== '全部') filtered = filtered.filter((p) => (p.city || '').includes(regionFilter));
        filtered = filtered.filter((p) => matchesCategory(p.category, categoryFilter) && p.status !== 'closed');
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
        // 只缓存默认视图（无搜索词、无筛选），供下次进入先渲染
        if (!searchKw && regionFilter === '全部' && categoryFilter === '全部') {
          writeFeedCache(feedType, collected);
        }
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
      setFeedError(true);
      if (isRefresh) setHasMore(false);
    } finally {
      // 只清理本次调用自己设置的加载标记（即使已被新请求取代也要清，避免标记卡死）
      if (fetchSeqRef.current === seq) { setIsLoadingMore(false); setIsInitialLoading(false); }
    }
  }, [feedType, regionFilter, categoryFilter, debouncedKeyword, user, blockedUserIds]);

  useEffect(() => {
    if (feedQueryKeyRef.current !== feedQueryKey) { setPosts([]); feedQueryKeyRef.current = feedQueryKey; }
    setPage(1); setHasMore(true); void fetchPosts(1, true);
  }, [fetchPosts, feedQueryKey]);

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

  const handleLoadMore = () => { if (!isLoadingMore && !isInitialLoading && hasMore) fetchPosts(page + 1, false); };

  // ✨ 已修复：传入 postTitle 作为聊天上下文
  const openChat = async (targetId: string, nickname?: string, postTitle?: string) => {
      if (!user) { setShowLogin(true); return; }
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
          navigate(`/messages/${c.id}`, { state: { postTitle } });
      } catch (e) { showToast(friendlyErrorMessage(e, '无法打开聊天'), 'error'); }
  };

  const openConversation = (c: Conversation) => { setChatConv(c); navigate(`/messages/${c.id}`); };

  const handleLogout = () => {
    const logout = api.request('/auth/logout', { method: 'POST' });
    removeStoredUser();
    clearLocalSession();
    navigate('/');
    showToast('已退出当前浏览器', 'info');
    void logout.then(() => showToast('已退出登录，会话已撤销', 'info'))
      .catch(() => showToast('当前浏览器已退出，服务端撤销尚未获确认。如需使旧会话失效，可使用重设密码。', 'error'));
  };

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
    } catch (e) {
      showToast(friendlyErrorMessage(e, '取消屏蔽失败'), 'error');
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
    } catch (e) {
      showToast(friendlyErrorMessage(e, '屏蔽失败'), 'error');
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
    else { pendingCreateRef.current = true; setShowLogin(true); }
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
    } catch (e) {
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
    chatRouteStatus, chatRouteError, retryChatRoute,
    posts, feedType, setFeedType, keyword, setKeyword, searchPostsNow,
    regionFilter, setRegionFilter, categoryFilter,
    feedError, isInitialLoading, isLoadingMore, hasMore, handleLoadMore, retryFeed,
    blockedUserIds,
    navigateToPost, navigateToCategory, openUserProfile, openRecentPostFromProfile, openPostById, handleChannelClick,
    openCreate, openEditPost, handleDeletePost, handleToggleFeature, handleToggleLike,
    handleToggleBlockUser, openReportTarget, openChat, openConversation,
    setViewingImage, setSharingPost, openAdDetail,
    openBlockedUsersModal: () => { if (!user) { setShowLogin(true); return; } setShowBlockedUsersModal(true); },
    setBaybayPanelOpen,
    adsRefreshKey, featuredRefreshKey,
    contactRequestRefreshKey, setContactRequestRefreshKey, setPendingContactRequestCount,
  };


  return (
    <div className="site-app font-sans">
      {/* locationKey 必须用真实位置：导航（含浏览器后退）时取消挂起的确认框，避免过期闭包执行 */}
      <ConfirmHost locationKey={location.key} />
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {detailAd && (
        <AdDetailModal
          ad={detailAd}
          onClose={() => setDetailAd(null)}
          isAdmin={user?.role === 'admin'}
          onDelete={user?.role === 'admin' ? handleDeleteAdFromDetail : undefined}
        />
      )}

      <a href="#scroll-container" className="site-skip-link">跳到主要内容</a>
      <SiteNavigation active={tab} category={categoryFilter} homeActive={isHomePath(location.pathname)} user={user} notification={showMessagesBadge} notificationCount={messagesBadgeCount} onCreate={() => openCreate('client')} onAsk={() => setBaybayPanelOpen(true)} onAccount={() => user ? navigate('/me') : setShowLogin(true)} />
      <div className="site-workspace">
        <header className="site-topbar">
          <Link to="/" className="site-mobile-brand" aria-label="BAYLINK 首页"><img src={BRAND.logoHorizontal} alt="BAYLINK" width="150" height="38" /></Link>
          <div className="site-location"><MapPin size={16} /><span>San Francisco Bay Area<small>我们的湾区生活</small></span></div>
          <button type="button" className="site-command-trigger" onClick={() => setQuickExploreOpen(true)} aria-label="打开快速搜索"><Search size={17} /><span>搜索生活里的答案</span><kbd>⌘ / Ctrl K</kbd></button>
          <div className="site-topbar-actions"><button type="button" className="site-topbar-publish" onClick={() => openCreate('client')}><Plus size={17} /><span>发布信息</span></button><button type="button" className="site-topbar-account" aria-label={user ? '查看我的资料' : '登录账号'} onClick={() => user ? navigate('/me') : setShowLogin(true)}>{user ? <Avatar src={user.avatar} name={user.nickname} size={9} /> : <><span>登录 / 注册</span><ArrowUpRight size={16} /></>}</button></div>
        </header>
        {quickExploreOpen && <QuickExplore onClose={() => setQuickExploreOpen(false)} onNavigate={navigate} onSearch={(value) => { setKeyword(value); navigate('/'); }} onAsk={() => setBaybayPanelOpen(true)} />}

        <main className="site-main" id="scroll-container" tabIndex={-1}>
           <Suspense fallback={<div className="flex flex-1 items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-baylink-green" /></div>}>
             <Outlet context={ctx} />
           </Suspense>
        </main>

        <nav className="site-mobile-nav pb-safe-bar" aria-label="手机导航">
          <div className="flex justify-around items-center px-0.5 pt-1.5 pb-0.5">
           <Link to="/" className={`flex flex-col items-center gap-0 py-1 min-w-[48px] transition active:scale-95 ${isHomePath(location.pathname)?'tab-bar-active':'text-baylink-muted'}`}>
             <Home size={20} strokeWidth={isHomePath(location.pathname)?2.5:1.75}/><span className={`text-[11px] mt-0.5 ${isHomePath(location.pathname)?'font-medium':'font-normal'}`}>首页</span>
           </Link>
           <Link to="/guides" className={`flex flex-col items-center gap-0 py-1 min-w-[48px] transition active:scale-95 ${tab==='guides'?'tab-bar-active':'text-baylink-muted'}`}>
             <BookOpen size={20} strokeWidth={tab==='guides'?2.5:1.75}/><span className={`text-[11px] mt-0.5 ${tab==='guides'?'font-medium':'font-normal'}`}>指南</span>
           </Link>
           <button onClick={()=>openCreate('client')} className="flex flex-col items-center -mt-3 active:scale-95 transition px-1">
             <div className="w-10 h-10 bg-baylink-green rounded-[18px] shadow-rest flex items-center justify-center text-white ring-2 ring-baylink-bg/90"><Plus size={20} strokeWidth={2.5}/></div>
             <span className="text-[11px] font-medium text-baylink-green mt-0.5">发布</span>
           </button>
           <Link to="/messages" className={`flex flex-col items-center gap-0 py-1 min-w-[48px] transition active:scale-95 relative ${tab==='messages'?'tab-bar-active':'text-baylink-muted'}`}>
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
             <span className={`text-[11px] mt-0.5 ${tab==='messages'?'font-medium':'font-normal'}`}>消息</span>
           </Link>
           <Link to="/me" className={`flex flex-col items-center gap-0 py-1 min-w-[48px] transition active:scale-95 ${tab==='profile'?'tab-bar-active':'text-baylink-muted'}`}>
             <UserIcon size={20} strokeWidth={tab==='profile'?2.5:1.75}/><span className={`text-[11px] mt-0.5 ${tab==='profile'?'font-medium':'font-normal'}`}>我的</span>
           </Link>
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

        {/* Modals（四个懒加载弹层各带 Suspense 占位，chunk 下载期间显示 spinner 遮罩而不是毫无反馈） */}
        {showLogin && (
          <LoginModal
            onClose={() => { setShowLogin(false); pendingCreateRef.current = false; }}
            onLogin={(loggedInUser) => { clearFeedCache(); setPosts([]); setUser(loggedInUser); if (pendingCreateRef.current) setShowCreate(true); }}
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
          <Suspense fallback={overlayChunkFallback}>
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
          </Suspense>
        )}
        {postIdParam && postRouteLoading && selectedPost?.id !== postIdParam && (
          <ModalShell onClose={navigateBack} label="正在加载信息" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/90"><Loader2 className="h-8 w-8 animate-spin text-baylink-green" /><button type="button" onClick={navigateBack}>返回</button></ModalShell>
        )}
        {postIdParam && postRouteMissing && <PostNotFoundView onBack={navigateBack} />}
        {postIdParam && postRouteError && !postRouteLoading && <ModalShell onClose={navigateBack} label="暂时无法加载信息" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-baylink-bg p-6"><p role="alert">{postRouteError}</p><button type="button" className="btn-primary px-6 py-3" onClick={() => setPostRetry((value) => value + 1)}>重试加载</button><button type="button" onClick={navigateBack}>返回</button></ModalShell>}
        {postIdParam && selectedPost?.id === postIdParam && !postRouteMissing && (
          <Suspense fallback={overlayChunkFallback}>
          <PostDetailModal
            key={`${user?.id || 'guest'}:${postIdParam}`}
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
          </Suspense>
        )}
        {chatConv && user && chatRouteStatus === 'ready' && chatConv.id === threadIdParam && (
          <Suspense fallback={overlayChunkFallback}>
          <ChatView
            key={`${user.id}:${chatConv.id}`}
            currentUser={user}
            conversation={chatConv}
            onClose={() => { setChatConv(null); navigate('/messages'); }}
            socket={socket}
            onViewProfile={openUserProfile}
            onToggleBlockUser={handleToggleBlockUser}
            blockedUserIds={blockedUserIds}
            showToast={showToast}
          />
          </Suspense>
        )}
        {userIdParam && (
          <Suspense fallback={overlayChunkFallback}>
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
          </Suspense>
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
      </div>

    </div>
  );
}
