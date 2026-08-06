// 路由树入口：页面按 URL 匹配渲染进 AppLayout 的 <Outlet>。
// 帖子 / 用户覆盖层用 background-location 模式：带着 state.backgroundLocation 导航时，
// 页面区继续按"背景位置"渲染（来源页保持挂载），覆盖层本身由 AppLayout 按真实 URL 渲染。
// 直接深链 /posts/:id、/users/:id（无背景）时，以首页 feed 作为覆盖层背景。
import { Navigate, Route, Routes, useLocation, type Location } from 'react-router-dom';
import AppLayout from './app/AppLayout';
import HomePage from './pages/HomePage';
import GuidesPage from './pages/GuidesPage';
import GuideDetailPage from './pages/GuideDetailPage';
import MessagesPage from './pages/MessagesPage';
import RecommendPage from './pages/RecommendPage';
import ProfilePage from './pages/ProfilePage';
import { PrivacyPolicyView } from './components/PrivacyPolicyView';
import { TermsView } from './components/TermsView';
import { SmsConsentView } from './components/SmsConsentView';

export default function App() {
  const location = useLocation();
  const backgroundLocation = (location.state as { backgroundLocation?: Location } | null)?.backgroundLocation;

  return (
    <Routes location={backgroundLocation || location}>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/category/:categorySlug" element={<HomePage />} />
        {/* 覆盖层深链的背景页 */}
        <Route path="/posts/:postId" element={<HomePage />} />
        <Route path="/users/:userId" element={<HomePage />} />
        <Route path="/reset-password" element={<HomePage />} />
        <Route path="/guides" element={<GuidesPage />} />
        <Route path="/guides/:slug" element={<GuideDetailPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:threadId" element={<MessagesPage />} />
        <Route path="/recommend" element={<RecommendPage />} />
        <Route path="/me" element={<ProfilePage />} />
        <Route path="/privacy" element={<PrivacyPolicyView />} />
        <Route path="/terms" element={<TermsView />} />
        <Route path="/sms-consent" element={<SmsConsentView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
