// 路由树入口：页面按 URL 匹配渲染进 AppLayout 的 <Outlet>。
// 帖子 / 用户覆盖层用 background-location 模式：带着 state.backgroundLocation 导航时，
// 页面区继续按"背景位置"渲染（来源页保持挂载），覆盖层本身由 AppLayout 按真实 URL 渲染。
// 直接深链 /posts/:id、/users/:id（无背景）时，以首页 feed 作为覆盖层背景。
// 除首页外全部路由懒加载（Suspense 边界在 AppLayout 的 <Outlet> 外层）。
import { lazy, Suspense, useEffect } from 'react';
import './i18n/router';
import { Route, Routes, useLocation, useParams, type Location } from 'react-router-dom';
import AppLayout from './app/AppLayout';
import { pageLoaders } from './route-loaders';
const HomePage = lazy(pageLoaders.home);
import { SLUG_TO_CATEGORY } from './routing';
import { OpusBayShell } from './components/OpusBayShell';
import { opusBayInHalloween } from './lib/opus-bay-metadata';
import { PlayRedirect } from './components/PlayRedirect';
import { LocaleContentGate } from './components/LocaleContentGate';
import { useLocale } from './i18n/locale';

const GuidesPage = lazy(pageLoaders.guides);
const MonthlyPage = lazy(pageLoaders.monthly);
const CalendarPage = lazy(pageLoaders.calendar);
const LocalDiscoveryPage = lazy(pageLoaders.discovery);
const ToolsPage = lazy(pageLoaders.tools);
const ExplorePage = lazy(pageLoaders.explore);
const PlannerPage = lazy(pageLoaders.plan);
// W9-E-switch: /play redirects to the game (components/PlayRedirect.tsx); pages/LittleBayPage.tsx stays in the repo, unrouted —
// revert the W9-E-switch commits to route it again
const OpusBayPage = lazy(pageLoaders.opus);
const MyWeekPage = lazy(pageLoaders.myWeek);
const AiLocalPage = lazy(pageLoaders.ai);
const GuideDetailPage = lazy(pageLoaders.guide);
const MessagesPage = lazy(pageLoaders.messages);
const RecommendPage = lazy(pageLoaders.recommend);
const ProfilePage = lazy(pageLoaders.profile);
const ServiceBookingsPage = lazy(pageLoaders.bookings);
const TogetherPage = lazy(pageLoaders.together);
const AboutPage = lazy(pageLoaders.about);
const NotFoundPage = lazy(pageLoaders.notFound);
const PrivacyPolicyView = lazy(pageLoaders.privacy);
const TermsView = lazy(pageLoaders.terms);
const SmsConsentView = lazy(pageLoaders.sms);
const NotificationTokenPage = lazy(pageLoaders.notificationToken);

const CategoryPage = () => {
  const { categorySlug } = useParams();
  return categorySlug && Object.hasOwn(SLUG_TO_CATEGORY, categorySlug) ? <HomePage /> : <NotFoundPage />;
};

export default function App() {
  const location = useLocation();
  const locale = useLocale();
  // W9-E: the site's script runs — public/boot-check.js (the old-browser notice) stands down from here on
  useEffect(() => { document.documentElement.setAttribute('data-app', 'ready'); }, []);
  const backgroundLocation = (location.state as { backgroundLocation?: Location } | null)?.backgroundLocation;

  return (
    // 注意：<Routes location> 会把内部的 LocationContext 一并替换成传入的位置，
    // 因此覆盖层所需的"真实位置"必须从这里（Router 层）作为 prop 传给 AppLayout。
    <Suspense fallback={<div className="p-6" role="status">{locale === 'en' ? 'Loading this page…' : locale === 'zh-Hant' ? '正在載入頁面…' : '正在加载页面…'}</div>}>
    <LocaleContentGate paths={[backgroundLocation?.pathname || location.pathname, location.pathname]}>
    <Routes location={backgroundLocation || location}>
      {/* Opus Bay：独立全屏 3D 世界，不套站点外框。W9-E：路由 chunk 加载时显示与预渲染 opus-bay.html 相同的首屏（不再空白、不闪首页） */}
      <Route path="/opus-bay" element={<Suspense fallback={<OpusBayShell halloween={opusBayInHalloween(new Date(), location.search)} />}><OpusBayPage /></Suspense>} />
      {/* W9-E-switch：/play 进入 3D 旧金山（/opus-bay?from=play，保留 lang）；旧的周末车票链接打开 /plan 的同一计划。不套站点外框 */}
      <Route path="/play" element={<PlayRedirect />} />
      <Route element={<AppLayout realLocation={location} />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/category/:categorySlug" element={<CategoryPage />} />
        {/* 覆盖层深链的背景页 */}
        <Route path="/posts/:postId" element={<HomePage />} />
        <Route path="/users/:userId" element={<HomePage />} />
        <Route path="/reset-password" element={<HomePage />} />
        <Route path="/guides" element={<GuidesPage />} />
        <Route path="/this-month" element={<MonthlyPage />} />
        <Route path="/this-week" element={<MonthlyPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/events/:id" element={<LocalDiscoveryPage kind="event" />} />
        <Route path="/offers/:id" element={<LocalDiscoveryPage kind="offer" />} />
        <Route path="/openings/:id" element={<LocalDiscoveryPage kind="opening" />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/plan" element={<PlannerPage />} />
        <Route path="/my-week" element={<MyWeekPage />} />
        <Route path="/ai-in-the-bay" element={<AiLocalPage />} />
        <Route path="/guides/:slug" element={<GuideDetailPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:threadId" element={<MessagesPage />} />
        <Route path="/recommend" element={<RecommendPage />} />
        <Route path="/me" element={<ProfilePage />} />
        <Route path="/me/bookings" element={<ServiceBookingsPage />} />
        <Route path="/together" element={<TogetherPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/privacy" element={<PrivacyPolicyView />} />
        <Route path="/terms" element={<TermsView />} />
        <Route path="/sms-consent" element={<SmsConsentView />} />
        <Route path="/verify-email" element={<NotificationTokenPage key="verify" purpose="verify" />} />
        <Route path="/notifications/unsubscribe" element={<NotificationTokenPage key="unsubscribe" purpose="unsubscribe" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    </LocaleContentGate>
    </Suspense>
  );
}
