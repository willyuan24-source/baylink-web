// 应用布局层：组合会话（useSession）、邻里 feed（useCommunityFeed，只在 feed 页取数）、站点外框（SiteChrome，与预渲染同一份标记）
// 和覆盖层（OverlayHost：帖子/用户/聊天/登录等弹层，按需加载）。页面内容由 <Outlet context> 渲染；/posts/:id 与 /users/:id 通过
// background-location 模式覆盖在来源页之上。
import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useNavigate, type Location } from 'react-router-dom';
import { api } from '../lib/api';
import type { HOME_CHANNELS } from '../lib/constants';
import { filterPostsByBlockedUsers, friendlyErrorMessage } from '../lib/format';
import { clearFeedCache } from '../lib/feedCache';
import { setPageMetadata, SITE_STRUCTURED_DATA } from '../lib/seo';
import { TOOLS_METADATA } from '../data/tool-catalog';
import { EXPLORE_METADATA } from '../lib/explore-metadata';
import { ABOUT_METADATA } from '../lib/about-metadata';
import { GUIDES_METADATA } from '../lib/guides-metadata';
import { categoryHubMetadata, LEGAL_METADATA } from '../lib/hub-metadata';
import { HUB_CARDS } from '../lib/hub-cards';
import type {
  AdDetailItem, Conversation, PostData, PostType, PublicUserProfile, ReportTarget,
} from '../lib/types';
import { getSlugFromCategory, tabFromPathname, isKnownAppPath } from '../routing';
import type { AppContextValue } from './context';
import { usePageScroll } from './usePageScroll';
import { useContactIntent } from './useContactIntent';
import { useConversationOpener } from './useConversationOpener';
import { withConversationContext } from '../lib/conversation-context';
import { useCloseOverlay } from './overlay-close';
import { getLocale } from '../i18n/locale';
import { useSession } from './useSession';
import { useCommunityFeed } from './useCommunityFeed';
import { COMMUNITY_VISIBLE } from '../data/site-flags';
import { OverlayHost } from './OverlayHost';
import { BootMainSettled, bootMainFallback } from './boot-main';
import { confirmDialog } from '../components/ui/confirm';
import type { ToastAction } from '../components/Toast';
import type { BayBayConversationDraft } from '../components/BayBayAssistantEntry';
import type { ReportReason } from '../components/ReportModal';
import { SiteChrome } from '../components/SiteChrome';
import { RouteSettled } from './RouteProgress';
import { RouteArrival } from './route-arrival';
import { preloadBayBay } from './baybay-preload';

// realLocation 必须由 App（Router 层）传入：本组件渲染在 <Routes location={背景位置}> 之内，
// 这里 useLocation() 只能拿到背景位置，而覆盖层（/posts/:id、/users/:id、聊天）要按真实 URL 渲染
export default function AppLayout({ realLocation }: { realLocation: Location }) {
  const location = realLocation;
  usePageScroll(location);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; });
  const tab = tabFromPathname(location.pathname);
  const tabRef = useRef(tab);
  useEffect(() => { tabRef.current = tab; }, [tab]);

  // ✨ Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; action?: ToastAction; id: number } | null>(null);
  // id 让相同内容的 toast 也能通过 key 强制重挂载，从而每次调用都重置计时
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info', action?: ToastAction) => setToast({ message, type, action, id: Date.now() }), []);
  // E2E-08: a failure toast (e.g. a photo that could not be processed) must not outlive the save that then succeeded.
  const dismissErrorToast = useCallback(() => setToast(current => current?.type === 'error' ? null : current), []);

  const [showLogin, setShowLogin] = useState(false);
  const [quickExploreOpen, setQuickExploreOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  const quickSearchOpenerRef = useRef<HTMLElement | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetPasswordToken, setResetPasswordToken] = useState<string | null>(null);
  const [baybayLoaded, setBaybayLoaded] = useState(false);
  const [baybayPanelOpen, setBaybayPanelOpen] = useState(false);
  const baybayOpenerRef = useRef<HTMLElement | null>(null);
  const [baybaySessionRevision, setBaybaySessionRevision] = useState(0);
  const baybayLoginDraft = useRef<BayBayConversationDraft | null>(null);
  const baybayResumeOwner = useRef<string | null>(null);
  const [baybayResumedConversation, setBaybayResumedConversation] = useState<{ ownerId: string; draft: BayBayConversationDraft } | null>(null);
  const [baybayPendingQuestion, setBaybayPendingQuestion] = useState<{ text: string; scope: string; mode: 'send' | 'draft' } | null>(null);
  const [baybayCategoryHint, setBaybayCategoryHint] = useState<string | undefined>(undefined);
  const [baybayPendingQuestionId, setBaybayPendingQuestionId] = useState(0);
  const baybayQuestionSequence = useRef(0);
  const [showCreate, setShowCreate] = useState(false);
  const pendingCreateRef = useRef(false);
  const [editingPost, setEditingPost] = useState<PostData | null>(null);
  const [createDefaultType, setCreateDefaultType] = useState<PostType | undefined>(undefined);
  const [createDefaultCategory, setCreateDefaultCategory] = useState<string | undefined>(undefined);
  const [createInitialIntent, setCreateInitialIntent] = useState('');
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const selectedPostRef = useRef(selectedPost);
  useEffect(() => { selectedPostRef.current = selectedPost; });
  const [postDetailRefreshing, setPostDetailRefreshing] = useState(false);
  const [postRouteMissing, setPostRouteMissing] = useState(false);
  const [postRouteLoading, setPostRouteLoading] = useState(false);
  const [postRouteError, setPostRouteError] = useState<string | null>(null);
  const [postRetry, setPostRetry] = useState(0);
  const [chatConv, setChatConv] = useState<Conversation | null>(null);
  const [chatRouteStatus, setChatRouteStatus] = useState<AppContextValue['chatRouteStatus']>('idle');
  const [chatRouteError, setChatRouteError] = useState<string | null>(null);
  const [chatRetry, setChatRetry] = useState(0);
  const retryChatRoute = () => setChatRetry((value) => value + 1);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [sharingPost, setSharingPost] = useState<PostData | null>(null);
  const [showBlockedUsersModal, setShowBlockedUsersModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [detailAd, setDetailAd] = useState<AdDetailItem | null>(null);
  const [adsRefreshKey, setAdsRefreshKey] = useState(0);
  const [featuredRefreshKey, setFeaturedRefreshKey] = useState(0);

  // The feed is created after the session (it needs the reader); the session's callbacks reach it through this ref.
  const feedRef = useRef<ReturnType<typeof useCommunityFeed> | null>(null);
  const session = useSession({
    onNewMessage: (threadId) => {
      if (tabRef.current === 'messages') return;
      // G1: one tap from the toast to the thread (the payload carries its conversationId).
      showToast('收到新私信', 'info', { label: getLocale() === 'en' ? 'View' : '查看', onClick: () => navigateRef.current(threadId ? `/messages/${threadId}` : '/messages') });
    },
    onCleared: () => {
      feedRef.current?.resetFeed();
      // Storage events can replace a token for the same account in one batched update.
      // Rotate the assistant session even when the final user ID has not changed.
      setBaybaySessionRevision(value => value + 1);
      setSelectedPost(null);
      setChatConv(null);
      setReportTarget(null);
      setShowCreate(false);
      setShowBlockedUsersModal(false);
      setSharingPost(null);
    },
    onExpired: () => { setShowLogin(true); showToast('登录已过期，请重新登录。', 'error'); },
    onBlocksLoaded: (ids) => feedRef.current?.hideBlockedAuthors(ids),
  });
  const { user, setUser, blockedUserIds, setBlockedUserIds, messagesBadgeCount } = session;
  const feed = useCommunityFeed({ location, navigate, userId: user?.id, blockedUserIds });
  useEffect(() => { feedRef.current = feed; });
  const { posts, setPosts, categorySlug, fetchPosts, feedType, feedLocation } = feed;

  const openSearch = (query = '') => {
    if (!quickExploreOpen) quickSearchOpenerRef.current = document.activeElement as HTMLElement | null;
    setQuickQuery(query); setQuickExploreOpen(true);
  };
  useEffect(() => {
    const toggleSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !event.isComposing && !document.getElementById('root')?.inert) {
        event.preventDefault();
        quickSearchOpenerRef.current = document.activeElement as HTMLElement | null;
        setQuickQuery('');
        setQuickExploreOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', toggleSearch);
    return () => window.removeEventListener('keydown', toggleSearch);
  }, []);

  const baybaySessionScope = user?.id || 'guest';
  useEffect(() => { if (baybayPanelOpen) setBaybayLoaded(true); }, [baybayPanelOpen]);
  const openBayBay = useCallback((question?: string, options?: { mode?: 'send' | 'draft' }) => {
    if (!baybayPanelOpen) baybayOpenerRef.current = document.activeElement as HTMLElement | null;
    if (question?.trim()) {
      setBaybayPendingQuestionId(++baybayQuestionSequence.current);
      setBaybayPendingQuestion({ text: question.trim().slice(0, 500), scope: baybaySessionScope, mode: options?.mode || 'send' });
    }
    setBaybayCategoryHint(categorySlug);
    setBaybayPanelOpen(true);
  }, [categorySlug, baybaySessionScope, baybayPanelOpen]);
  useEffect(() => {
    setBaybayPanelOpen(baybayResumeOwner.current === user?.id && !!user?.id);
    baybayResumeOwner.current = null;
    setBaybayResumedConversation(null);
    baybayLoginDraft.current = null;
    setBaybayPendingQuestion(null);
    setBaybayCategoryHint(undefined);
  }, [baybaySessionScope, baybaySessionRevision, user?.id]);

  const postIdParam = location.pathname.match(/^\/posts\/([^/]+)\/?$/)?.[1];
  const userIdParam = location.pathname.match(/^\/users\/([^/]+)\/?$/)?.[1];
  const threadIdParam = location.pathname.match(/^\/messages\/([^/]+)\/?$/)?.[1];
  const chatPostTitle = typeof location.state?.postTitle === 'string' ? location.state.postTitle : undefined;
  const chatPostId = typeof location.state?.postId === 'string' ? location.state.postId : undefined;
  const guideSlugParam = location.pathname.match(/^\/guides\/([^/]+)\/?$/)?.[1];

  // G4 / N3: Back only within this document; after a reload or from another site, the background page or `fallback`.
  const closeOverlay = useCloseOverlay(location, navigate);
  const postFallback = (post?: PostData | null) => `/category/${(post?.category && getSlugFromCategory(post.category)) || 'rent'}`;

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
    if (slug) navigate(feedLocation(`/category/${slug}`));
    else navigate(feedLocation('/'));
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

  // 每次站内导航同步分享摘要与 canonical，避免沿用前一页的元数据。
  useEffect(() => {
    if (!isKnownAppPath(location.pathname)) return; // 404 页独立管理 noindex。
    if (postIdParam || guideSlugParam || userIdParam) return;
    const path = location.pathname;
    if (path === '/verify-email' || path === '/notifications/unsubscribe') return;
    if (/^\/(events|plan|play|calendar|my-week|ai-in-the-bay|together|archive)\/?$/.test(path)) return; // These pages own their metadata.
    if (/^\/(events|offers|openings)\//.test(path)) return; // Each discovery page owns its metadata, including unknown-item 404s.
    if (path === '/this-month' || path === '/this-month/') return; // MonthlyPage owns its dated edition metadata.
    if (path === '/guides' || path === '/guides/') { setPageMetadata(GUIDES_METADATA); return; }
    if (path === '/tools' || path === '/tools/') { setPageMetadata(TOOLS_METADATA); return; }
    if (path === '/explore' || path === '/explore/') { setPageMetadata(EXPLORE_METADATA); return; }
    if (path === '/about' || path === '/about/') { setPageMetadata(ABOUT_METADATA); return; }
    // Hubs with reviewed English (lib/hub-metadata.ts), the same records the prerender writes (I18N-SEO-02)
    if (path.startsWith('/category/')) { setPageMetadata(categoryHubMetadata(categorySlug || '')); return; }
    if (LEGAL_METADATA[path.replace(/\/$/, '')]) { setPageMetadata(LEGAL_METADATA[path.replace(/\/$/, '')]); return; }
    if (path.startsWith('/guides')) {
      // /guides/:slug 的具体标题由 GuideDetailPage 设置（guides 语料已懒加载，布局层不再 import）
      if (!guideSlugParam) document.title = GUIDES_METADATA.title;
    } else if (path.startsWith('/messages')) {
      document.title = '消息｜BAYLINK';
    } else if (/^\/me\/bookings\/?$/.test(path)) {
      document.title = '服务预约｜BAYLINK';
    } else if (path === '/me') {
      document.title = '我的｜BAYLINK';
    } else {
      document.title = 'BAYLINK｜湾区去哪、怎么办——有来源的中文答案';
    }
    setPageMetadata({
      title: document.title,
      description: '湾区活动、免费福利与实用生活指南，附官方来源和核对日期。搜索下一步，或向 BayBay 提问。',
      path,
      image: path === '/' ? HUB_CARDS.home : undefined,
      structuredData: path === '/' ? SITE_STRUCTURED_DATA : undefined,
      noindex: path.startsWith('/messages') || path.startsWith('/users/') || path === '/me' || path.startsWith('/me/') || path.startsWith('/reset-password') || path === '/verify-email' || path === '/notifications/unsubscribe',
    });
  }, [location.pathname, categorySlug, postIdParam, userIdParam, guideSlugParam]);

  useEffect(() => {
    if (!userIdParam) return;
    let cancelled = false;
    api.getUserPublicProfile(userIdParam).then((p: PublicUserProfile) => {
      if (!cancelled) setPageMetadata({ title: `${p.nickname}｜BAYLINK`, description: '查看邻居资料与公开发布的信息。', path: `/users/${userIdParam}`, noindex: true, preserveText: true });
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
    // A post already on screen stays there while it refreshes: the feed arriving after a shared link must not swap the open
    // detail (and its menu or comment draft) for the loading shell and back.
    const shown = found || (selectedPostRef.current?.id === postIdParam ? selectedPostRef.current : null);
    if (shown) {
      setSelectedPost(shown);
      setPostRouteMissing(false);
      setPostRouteLoading(false);
      if (found) setPageMetadata({ title: `${found.title}｜BAYLINK`, description: found.description.slice(0, 160), path: `/posts/${postIdParam}`, image: found.imageUrls?.[0], type: 'article', noindex: found.status === 'closed', preserveText: true });
    } else {
      setSelectedPost(null);
      setPostRouteLoading(true);
      setPostRouteMissing(false);
      setPageMetadata({ title: '正在加载信息｜BAYLINK', description: '正在读取发布信息。', path: `/posts/${postIdParam}`, noindex: true });
    }
    let cancelled = false;
    (async () => {
      if (shown) setPostDetailRefreshing(true);
      try {
        const p = await api.request(`/posts/${postIdParam}`);
        if (!cancelled) {
          setSelectedPost(p);
          setPostRouteMissing(false);
          setPageMetadata({ title: `${p.title}｜BAYLINK`, description: String(p.description || '').slice(0, 160), path: `/posts/${postIdParam}`, image: p.imageUrls?.[0], type: 'article', noindex: p.status === 'closed', preserveText: true });
        }
      } catch (error) {
        if (!cancelled) {
          const status = (error as { status?: number })?.status;
          if (status === 404 || status === 403) {
            setSelectedPost(null);
            setPostRouteMissing(true);
            setPageMetadata({ title: '内容不可访问｜BAYLINK', description: '内容不存在、已移除或不可访问。', path: `/posts/${postIdParam}`, noindex: true });
          } else if (!shown) {
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
        if (c) { setChatConv(withConversationContext(c, chatPostTitle, chatPostId)); setChatRouteStatus('ready'); }
        else setChatRouteStatus('not-found');
      } catch (error) {
        if (cancelled) return;
        setChatRouteStatus('error');
        // '' lets the messages page say it in its own words when the server gave no usable reason.
        setChatRouteError(friendlyErrorMessage(error, '') || null);
      }
    })();
    return () => { cancelled = true; };
  }, [threadIdParam, user, chatRetry, chatPostTitle, chatPostId]);

  // H44: the post and profile sheets are warmed by the community board (CommunityBoard.tsx), the one page that lists posts;
  // warming them here cost every page ~31 script requests after the first paint.

  // G78 (api #38 contract): a reset e-mail carries its token in the fragment (#token=…), which no server log or Referer
  // sees; links already sent with ?token= keep working until the owner sets PASSWORD_RESET_LINK_STYLE=fragment (at least
  // 7 days after this ships, then the query form can go). Either way the token is read once and leaves the address bar
  // and this history entry at once; the token already read stays for the open dialog.
  useEffect(() => {
    if (!/^\/reset-password\/?$/.test(location.pathname)) { setResetPasswordToken(null); return; }
    const query = new URLSearchParams(location.search);
    const token = new URLSearchParams(location.hash.replace(/^#/, '')).get('token') || query.get('token');
    if (!token) return;
    setResetPasswordToken(token);
    query.delete('token');
    const search = query.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '', hash: '' }, { replace: true, state: location.state });
  }, [location.pathname, location.search, location.hash, location.state, navigate]);

  const handleResetPasswordSuccess = () => {
    navigate('/', { replace: true });
    setResetPasswordToken(null);
    setShowLogin(true);
  };

  const handleOpenForgotPassword = () => {
    setShowLogin(false);
    setShowForgotPassword(true);
  };

  const openContactConversation = useConversationOpener({
    routeKey: location.key,
    onOpened: (conversation, { postTitle, postId }) => {
      setChatConv(conversation);
      navigate(`/messages/${conversation.id}`, { state: { postTitle, postId } });
    },
    onError: (error) => showToast(friendlyErrorMessage(error, '无法打开聊天'), 'error'),
  });
  const { openChat, requestPostContact, completeContactLogin, cancelPendingContact } = useContactIntent({
    user,
    onLoginNeeded: () => { pendingCreateRef.current = false; setShowLogin(true); },
    onOpen: openContactConversation,
  });

  const openConversation = (c: Conversation) => { setChatConv(c); navigate(`/messages/${c.id}`); };

  const clearAccountSession = () => {
    session.endLocalSession();
    navigate('/');
  };

  const handleLogout = () => {
    const logout = api.request('/auth/logout', { method: 'POST' });
    session.endLocalSession();
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
      ...(reportTarget.targetType === 'message' ? { conversationId: reportTarget.conversationId } : {}),
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
      if (userIdParam === blockedId) closeOverlay('/');
      if (chatConv?.otherUser.id === blockedId) { setChatConv(null); navigate('/messages'); }
    } catch (e) {
      showToast(friendlyErrorMessage(e, '屏蔽失败'), 'error');
    }
  };

  const handleToggleBlockUser = (userId: string) => {
    if (blockedUserIds.includes(userId)) handleUnblockUser(userId);
    else handleBlockUser(userId);
  };

  const openCreate = (type?: PostType, category?: string, initialIntent = '') => {
    if (!COMMUNITY_VISIBLE) { showToast(getLocale() === 'en' ? 'The neighborhood board is paused, and so is posting.' : '邻里信息暂停中，暂时不能发布。', 'info'); return; }
    cancelPendingContact();
    setEditingPost(null);
    setCreateDefaultType(type);
    setCreateDefaultCategory(category);
    setCreateInitialIntent(initialIntent);
    if (user) setShowCreate(true);
    else { pendingCreateRef.current = true; setShowLogin(true); }
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
      navigate('/events');
      return;
    }
    const slug = ch.category ? getSlugFromCategory(ch.category) : undefined;
    navigate(feedLocation(slug ? `/category/${slug}` : '/', { feedType: ch.feedType || feedType, regionFilter: '全部', keyword: '' }));
  };

  const ctx: AppContextValue = {
    user, setUser, showToast, setShowLogin, handleLogout, clearAccountSession, messagesBadgeCount,
    chatRouteStatus, chatRouteError, retryChatRoute,
    posts, feedType, setFeedType: feed.setFeedType, keyword: feed.keyword, setKeyword: feed.setKeyword, searchPostsNow: feed.searchPostsNow,
    regionFilter: feed.regionFilter, setRegionFilter: feed.setRegionFilter, categoryFilter: feed.categoryFilter,
    feedError: feed.feedError, isInitialLoading: feed.isInitialLoading, isLoadingMore: feed.isLoadingMore, hasMore: feed.hasMore, handleLoadMore: feed.handleLoadMore, retryFeed: feed.retryFeed,
    blockedUserIds,
    navigateToPost, navigateToCategory, openUserProfile, openRecentPostFromProfile, openPostById, handleChannelClick,
    openCreate, openEditPost, handleDeletePost, handleToggleFeature, handleToggleLike,
    handleToggleBlockUser, openReportTarget, openChat, requestPostContact, openConversation,
    setViewingImage, setSharingPost, openAdDetail,
    openBlockedUsersModal: () => { if (!user) { setShowLogin(true); return; } setShowBlockedUsersModal(true); },
    setBaybayPanelOpen, openBayBay, warmBayBay: preloadBayBay, openSearch,
    adsRefreshKey, featuredRefreshKey,
    contactRequestRefreshKey: session.contactRequestRefreshKey, setContactRequestRefreshKey: session.setContactRequestRefreshKey, setPendingContactRequestCount: session.setPendingContactRequestCount,
  };

  const closeCreate = () => { setShowCreate(false); setEditingPost(null); setCreateDefaultCategory(undefined); setCreateInitialIntent(''); };
  const overlays = <OverlayHost
    locationKey={location.key}
    user={user}
    socket={session.socket}
    blockedUserIds={blockedUserIds}
    showToast={showToast}
    navigate={navigate}
    toast={toast}
    closeToast={() => setToast(null)}
    ad={{ item: detailAd, close: () => setDetailAd(null), isAdmin: user?.role === 'admin', onDelete: user?.role === 'admin' ? handleDeleteAdFromDetail : undefined }}
    search={{ open: quickExploreOpen, query: quickQuery, openerRef: quickSearchOpenerRef, close: () => setQuickExploreOpen(false), onSearch: (value) => navigate(feedLocation('/', { keyword: value })), onAsk: openBayBay }}
    baybay={{
      open: baybayPanelOpen, loaded: baybayLoaded, scope: baybaySessionScope, sessionKey: `${baybaySessionScope}:${baybaySessionRevision}`, openerRef: baybayOpenerRef,
      initialConversation: baybayResumedConversation?.ownerId === user?.id ? baybayResumedConversation?.draft : undefined,
      pendingQuestion: baybayPendingQuestion?.scope === baybaySessionScope ? baybayPendingQuestion.text : null,
      pendingQuestionMode: baybayPendingQuestion?.mode, pendingQuestionId: baybayPendingQuestionId,
      currentPath: location.pathname + location.search, categoryHint: baybayCategoryHint, showLogin,
      onLoginNeeded: (draft) => { baybayLoginDraft.current = user ? null : draft; pendingCreateRef.current = false; setShowLogin(true); },
      onOpenChange: (open) => {
        setBaybayPanelOpen(open);
        if (!open) {
          setBaybayPendingQuestion(null);
          setBaybayCategoryHint(undefined);
        }
      },
      onPendingQuestionConsumed: (id) => { if (id === baybayQuestionSequence.current) setBaybayPendingQuestion(null); },
      onCreatePost: (opts) => openCreate(opts?.postType, opts?.category, opts?.initialIntent),
    }}
    login={{
      open: showLogin,
      close: () => { setShowLogin(false); pendingCreateRef.current = false; baybayLoginDraft.current = null; cancelPendingContact(); },
      onLogin: (loggedInUser) => { if (baybayLoginDraft.current) { baybayResumeOwner.current = loggedInUser.id; setBaybayResumedConversation({ ownerId: loggedInUser.id, draft: baybayLoginDraft.current }); } baybayLoginDraft.current = null; setBaybaySessionRevision(value => value + 1); clearFeedCache(); setPosts([]); setUser(loggedInUser); if (pendingCreateRef.current) setShowCreate(true); completeContactLogin(loggedInUser); },
      onForgotPassword: handleOpenForgotPassword,
    }}
    forgotPassword={{ open: showForgotPassword, close: () => setShowForgotPassword(false) }}
    resetPassword={{ token: resetPasswordToken, close: () => { navigate('/', { replace: true }); setResetPasswordToken(null); }, onSuccess: handleResetPasswordSuccess }}
    create={{
      open: showCreate, editingPost, defaultType: createDefaultType, defaultCategory: createDefaultCategory, initialIntent: createInitialIntent,
      close: closeCreate,
      onSaved: () => { dismissErrorToast(); fetchPosts(1, true); setFeaturedRefreshKey((k) => k + 1); },
      onManageAvailability: openPostById,
    }}
    post={{
      id: postIdParam, selected: selectedPost, loading: postRouteLoading, missing: postRouteMissing, error: postRouteError, refreshing: postDetailRefreshing,
      close: (post) => closeOverlay(postFallback(post)),
      retry: () => setPostRetry((value) => value + 1),
      detail: {
        onLoginNeeded: () => setShowLogin(true),
        onContactLoginNeeded: () => { if (selectedPost) requestPostContact(selectedPost); },
        onOpenChat: (id: string, nickname?: string, title?: string) => openChat(id, nickname, title, selectedPost?.id),
        onOpenUserProfile: openUserProfile,
        // The editor mounts in this layout, so it survives the overlay closing; open it first (G4).
        onEdit: (p: PostData) => { openEditPost(p); closeOverlay(postFallback(p)); },
        onToggleFeature: handleToggleFeature,
        onDeleted: () => { navigate('/'); fetchPosts(1, true); setFeaturedRefreshKey((k) => k + 1); },
        onImageClick: (src: string) => setViewingImage(src),
        onShare: (p: PostData) => setSharingPost(p),
        onLike: handleToggleLike,
        onReport: (p: PostData) => openReportTarget({ targetType: 'post', targetId: p.id, authorId: p.authorId }),
        onToggleBlockUser: handleToggleBlockUser,
        onAskBayBay: (question: string) => {
          openBayBay(question);
          setBaybayCategoryHint(selectedPost?.category ? (getSlugFromCategory(selectedPost.category) || undefined) : undefined);
        },
      },
    }}
    chat={{ conversation: chatConv, ready: chatRouteStatus === 'ready', threadId: threadIdParam, close: () => { setChatConv(null); navigate('/messages'); }, onViewProfile: openUserProfile, onReportMessage: openReportTarget, onToggleBlockUser: handleToggleBlockUser }}
    profile={{
      userId: userIdParam, close: () => closeOverlay('/'),
      card: { onChat: openChat, onOpenRecentPost: openRecentPostFromProfile, onLoginNeeded: () => setShowLogin(true), onReportUser: (id: string) => openReportTarget({ targetType: 'user', targetId: id }), onToggleBlockUser: handleToggleBlockUser },
    }}
    blockedUsers={{ open: showBlockedUsersModal, close: () => setShowBlockedUsersModal(false), onUnblock: handleUnblockUser }}
    report={{ target: reportTarget, close: () => setReportTarget(null), onSubmit: handleSubmitReport }}
    image={{ src: viewingImage, close: () => setViewingImage(null) }}
    share={{ post: sharingPost, close: () => setSharingPost(null) }}
  />;

  return (
    <SiteChrome
      pathname={location.pathname}
      user={user}
      messagesCount={messagesBadgeCount}
      onAsk={() => openBayBay()}
      onSearch={() => openSearch()}
      onLogin={() => setShowLogin(true)}
      onAccount={() => user ? navigate('/me') : setShowLogin(true)}
      onCreate={() => openCreate()}
      onLogout={handleLogout}
      realLocation={realLocation}
      overlays={overlays}
    >
      {/* The first route keeps the prerendered page on screen while its chunk settles (boot-main.ts): no blank frame. */}
      {/* Later routes: the old page stays during the router's transition and this bar shows at the top after 150ms while
          <html data-route-wait> is set (RouteSettled, lib/route-activity.ts); a suspension outside a transition keeps the
          page height with the same bar (site-chrome.css), never a spinner. */}
      <div className="site-route-progress site-route-bar" aria-hidden="true" />
      <Suspense fallback={bootMainFallback(location.pathname) ?? <div className="site-route-wait" aria-busy="true"><span className="site-route-progress" /></div>}>
        <BootMainSettled />
        <RouteSettled pathname={location.pathname} search={location.search} />
        <RouteArrival />
        <Outlet context={ctx} />
      </Suspense>
    </SiteChrome>
  );
}
