// Everything AppLayout shows over the page (WEB-SHELL2, split out of AppLayout): the toast, confirmations, search, BayBay,
// the sign-in / password / report / block / share dialogs, the post, chat and profile overlays. Every dialog loads on first
// use (its chunk is not in the shell graph every page downloads) and sits behind a boundary: if its chunk cannot load,
// the dialog closes with a message instead of taking the page down.
import { Component, lazy, Suspense, type ComponentProps, type ReactNode, type RefObject } from 'react';
import { Loader2 } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import type { NavigateFunction } from 'react-router-dom';
import Avatar from '../components/Avatar';
import { ConfirmHost } from '../components/ui/confirm';
import { ModalShell } from '../components/ui/Modal';
import { Toast, type ToastAction } from '../components/Toast';
import { LocaleContentGate } from '../components/LocaleContentGate';
import type { BayBayConversationDraft } from '../components/BayBayAssistantEntry';
import type { ReportReason } from '../components/ReportModal';
import { lazyChunk } from '../lib/chunk-recovery';
import { reportClientError } from '../lib/error-beacon';
import { api } from '../lib/api';
import { translateText, useLocale, type Locale } from '../i18n/locale';
import type { AdDetailItem, Conversation, PostData, PostType, ReportTarget, UserData } from '../lib/types';
import type { AppContextValue, ShowToast } from './context';

const QuickExplore = lazy(lazyChunk(() => import('../components/QuickExplore').then(m => ({ default: m.QuickExplore }))));
const BayBayAssistantEntry = lazy(lazyChunk(() => import('../components/BayBayAssistantEntry').then(m => ({ default: m.BayBayAssistantEntry }))));
const CreatePostModal = lazy(lazyChunk(() => import('../features/posts/CreatePostModal').then(m => ({ default: m.CreatePostModal }))));
const PostDetailModal = lazy(lazyChunk(() => import('../features/posts/PostDetailModal').then(m => ({ default: m.PostDetailModal }))));
const UserProfileModal = lazy(lazyChunk(() => import('../features/users/UserProfileModal').then(m => ({ default: m.UserProfileModal }))));
const ChatView = lazy(lazyChunk(() => import('../features/messages/ChatView').then(m => ({ default: m.ChatView }))));
const LoginModal = lazy(lazyChunk(() => import('../features/auth/LoginModal').then(m => ({ default: m.LoginModal }))));
const ForgotPasswordModal = lazy(lazyChunk(() => import('../components/ForgotPasswordModal').then(m => ({ default: m.ForgotPasswordModal }))));
const ResetPasswordModal = lazy(lazyChunk(() => import('../components/ResetPasswordModal').then(m => ({ default: m.ResetPasswordModal }))));
const BlockedUsersModal = lazy(lazyChunk(() => import('../components/BlockedUsersModal').then(m => ({ default: m.BlockedUsersModal }))));
const ReportModal = lazy(lazyChunk(() => import('../components/ReportModal').then(m => ({ default: m.ReportModal }))));
const PostShareSheet = lazy(lazyChunk(() => import('../components/PostShareSheet').then(m => ({ default: m.PostShareSheet }))));
const AdDetailModal = lazy(lazyChunk(() => import('../features/ads/OfficialAds').then(m => ({ default: m.AdDetailModal }))));
const ImageViewer = lazy(lazyChunk(() => import('../components/ImageViewer').then(m => ({ default: m.ImageViewer }))));
const PostNotFoundView = lazy(lazyChunk(() => import('../components/PostNotFoundView').then(m => ({ default: m.PostNotFoundView }))));

const copy = (locale: Locale, zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);

/** A spinner over the page while a dialog's chunk loads, so a tap never looks ignored (also for a deep link). */
const OverlayChunkFallback = () => <div className="fixed inset-0 z-[110] flex items-center justify-center bg-white/80"><Loader2 className="h-8 w-8 animate-spin text-baylink-green" /></div>;
const DismissibleChunkFallback = ({ label, onClose, restoreFocusRef }: { label: string; onClose: () => void; restoreFocusRef?: RefObject<HTMLElement> }) => {
  const locale = useLocale();
  return <ModalShell onClose={onClose} className="fixed inset-0 z-[110] flex items-center justify-center bg-white/90 p-5" label={label} restoreFocusRef={restoreFocusRef}>
    <div className="rounded-2xl border border-baylink-border bg-white p-8 text-center">
      <Loader2 aria-hidden="true" className="mx-auto h-8 w-8 animate-spin text-baylink-green" />
      <p role="status" className="mt-4 text-base">{label}</p>
      <button type="button" onClick={onClose} className="mt-5 min-h-11 rounded-xl border border-baylink-border px-6 text-base">{copy(locale, '关闭', 'Close')}</button>
    </div>
  </ModalShell>;
};

/**
 * Contains a dialog whose chunk failed twice (offline, a stale deploy) or that crashed: close it and say so, keep the
 * page. Reported like the root boundary (the beacon files a lost chunk as `chunk`, anything else as `render`).
 */
export class OverlayBoundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { reportClientError('render', error); this.props.onFail(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export type OverlayHostProps = {
  locationKey: string;
  user: UserData | null;
  socket: Socket | null;
  blockedUserIds: string[];
  showToast: ShowToast;
  navigate: NavigateFunction;
  toast: { message: string; type: 'success' | 'error' | 'info'; action?: ToastAction; id: number } | null;
  closeToast: () => void;
  ad: { item: AdDetailItem | null; close: () => void; isAdmin: boolean; onDelete?: (id: string) => Promise<void> };
  search: { open: boolean; query: string; openerRef: RefObject<HTMLElement>; close: () => void; onSearch: (value: string) => void; onAsk: AppContextValue['openBayBay'] };
  baybay: {
    open: boolean; loaded: boolean; scope: string; sessionKey: string; openerRef: RefObject<HTMLElement>;
    initialConversation?: BayBayConversationDraft; pendingQuestion: string | null; pendingQuestionMode?: 'send' | 'draft'; pendingQuestionId: number;
    currentPath: string; categoryHint?: string; showLogin: boolean;
    onLoginNeeded: (draft: BayBayConversationDraft) => void; onOpenChange: (open: boolean) => void; onPendingQuestionConsumed: (id?: number) => void;
    onCreatePost: (options?: { postType?: PostType; category?: string; initialIntent?: string }) => void;
  };
  login: { open: boolean; close: () => void; onLogin: (user: UserData) => void; onForgotPassword: () => void };
  forgotPassword: { open: boolean; close: () => void };
  resetPassword: { token: string | null; close: () => void; onSuccess: () => void };
  create: { open: boolean; editingPost: PostData | null; defaultType?: PostType; defaultCategory?: string; initialIntent: string; close: () => void; onSaved: () => void; onManageAvailability: (postId: string) => void };
  post: {
    id?: string; selected: PostData | null; loading: boolean; missing: boolean; error: string | null; refreshing: boolean;
    close: (post?: PostData | null) => void; retry: () => void;
    detail: Omit<ComponentProps<typeof PostDetailModal>, 'post' | 'onClose' | 'detailRefreshing' | 'currentUser' | 'blockedUserIds' | 'showToast'>;
  };
  chat: { conversation: Conversation | null; ready: boolean; threadId?: string; close: () => void; onViewProfile: (userId: string) => void; onReportMessage: (target: ReportTarget) => void; onToggleBlockUser: (userId: string) => void };
  profile: { userId?: string; close: () => void; card: Omit<ComponentProps<typeof UserProfileModal>, 'userId' | 'onClose' | 'currentUser' | 'showToast' | 'blockedUserIds'> };
  blockedUsers: { open: boolean; close: () => void; onUnblock: (id: string) => Promise<void> };
  report: { target: ReportTarget | null; close: () => void; onSubmit: (reason: ReportReason, detail: string) => Promise<void> };
  image: { src: string | null; close: () => void };
  share: { post: PostData | null; close: () => void };
};

export function OverlayHost(props: OverlayHostProps) {
  const { user, showToast, blockedUserIds, post, chat, profile, baybay, search } = props;
  const locale = useLocale();
  const t = (zh: string, en: string) => copy(locale, zh, en);
  const unavailable = (close: () => void) => () => { close(); showToast(t('暂时打不开，请检查网络后重试。', 'This could not open. Check your connection and try again.'), 'error'); };
  const lazyDialog = (close: () => void, node: ReactNode, fallback: ReactNode = <OverlayChunkFallback />) =>
    <OverlayBoundary onFail={unavailable(close)}><Suspense fallback={fallback}>{node}</Suspense></OverlayBoundary>;
  const postClose = () => post.close(post.selected);

  return <>
    {/* locationKey is the real location: navigating (Back included) cancels a pending confirmation's stale closure. */}
    <ConfirmHost locationKey={props.locationKey} />
    {props.toast && <Toast key={props.toast.id} message={props.toast.message} type={props.toast.type} action={props.toast.action} onClose={props.closeToast} />}
    {props.ad.item && lazyDialog(props.ad.close, <AdDetailModal ad={props.ad.item} onClose={props.ad.close} isAdmin={props.ad.isAdmin} onDelete={props.ad.onDelete} />)}
    {search.open && lazyDialog(search.close, <LocaleContentGate paths={['/guides', '/calendar', '/explore']}><QuickExplore initialQuery={search.query} restoreFocusRef={search.openerRef} onClose={search.close} onNavigate={props.navigate} onSearch={search.onSearch} onAsk={search.onAsk} /></LocaleContentGate>,
      <DismissibleChunkFallback label={t('正在打开搜索…', 'Opening search…')} onClose={search.close} restoreFocusRef={search.openerRef} />)}

    {(baybay.open || baybay.loaded) && lazyDialog(() => baybay.onOpenChange(false), <LocaleContentGate paths={['/calendar']}><BayBayAssistantEntry
      key={baybay.scope}
      ownerId={user?.id}
      sessionKey={baybay.sessionKey}
      initialConversation={baybay.initialConversation}
      onLoginNeeded={baybay.onLoginNeeded}
      variant="headless"
      restoreFocusRef={baybay.openerRef}
      panelOpen={baybay.open && !baybay.showLogin}
      onPanelOpenChange={baybay.onOpenChange}
      pendingQuestion={baybay.pendingQuestion}
      pendingQuestionMode={baybay.pendingQuestionMode}
      pendingQuestionId={baybay.pendingQuestionId}
      onPendingQuestionConsumed={baybay.onPendingQuestionConsumed}
      currentPath={baybay.currentPath}
      categoryHint={baybay.categoryHint}
      blockedUserIds={blockedUserIds}
      onNavigate={props.navigate}
      onCreatePostClick={baybay.onCreatePost}
    /></LocaleContentGate>, baybay.open ? <DismissibleChunkFallback label={t('正在打开 BayBay…', 'Opening BayBay…')} onClose={() => baybay.onOpenChange(false)} restoreFocusRef={baybay.openerRef} /> : null)}

    {props.login.open && lazyDialog(props.login.close, <LoginModal onClose={props.login.close} onLogin={props.login.onLogin} showToast={showToast} onForgotPassword={props.login.onForgotPassword} />)}
    {props.forgotPassword.open && lazyDialog(props.forgotPassword.close, <ForgotPasswordModal isOpen onClose={props.forgotPassword.close} onSubmit={(email) => api.forgotPassword(email)} />)}
    {props.resetPassword.token && lazyDialog(props.resetPassword.close, <ResetPasswordModal isOpen token={props.resetPassword.token} onClose={props.resetPassword.close} onSuccess={props.resetPassword.onSuccess} onSubmit={(token, newPassword) => api.resetPassword(token, newPassword)} />)}
    {props.create.open && user && lazyDialog(props.create.close, <CreatePostModal
      key={`${user.id}:${props.create.editingPost?.id || 'new'}`}
      user={user}
      mode={props.create.editingPost ? 'edit' : 'create'}
      editingPost={props.create.editingPost}
      defaultType={props.create.defaultType}
      defaultCategory={props.create.defaultCategory}
      initialIntent={props.create.editingPost ? undefined : props.create.initialIntent}
      onClose={props.create.close}
      onCreated={props.create.onSaved}
      onUpdated={props.create.onSaved}
      onManageAvailability={props.create.onManageAvailability}
      showToast={showToast}
    />)}

    {post.id && post.loading && post.selected?.id !== post.id && (
      <ModalShell onClose={postClose} label={t('正在加载信息', 'Loading')} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/90"><Loader2 className="h-8 w-8 animate-spin text-baylink-green" /><button type="button" onClick={postClose}>{t('返回', 'Back')}</button></ModalShell>
    )}
    {post.id && post.missing && lazyDialog(postClose, <PostNotFoundView onBack={postClose} />)}
    {post.id && post.error && !post.loading && <ModalShell onClose={postClose} label={t('暂时无法加载信息', 'This could not load')} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-baylink-bg p-6"><p role="alert">{post.error}</p><button type="button" className="btn-primary px-6 py-3" onClick={post.retry}>{t('重试加载', 'Try again')}</button><button type="button" onClick={postClose}>{t('返回', 'Back')}</button></ModalShell>}
    {post.id && post.selected?.id === post.id && !post.missing && lazyDialog(postClose, <PostDetailModal
      key={`${user?.id || 'guest'}:${post.id}`}
      post={post.selected}
      detailRefreshing={post.refreshing}
      currentUser={user}
      onClose={postClose}
      blockedUserIds={blockedUserIds}
      showToast={showToast}
      {...post.detail}
    />)}
    {chat.conversation && user && chat.ready && chat.conversation.id === chat.threadId && lazyDialog(chat.close, <ChatView
      key={`${user.id}:${chat.conversation.id}`}
      currentUser={user}
      conversation={chat.conversation}
      onClose={chat.close}
      socket={props.socket}
      onViewProfile={chat.onViewProfile}
      onReportMessage={chat.onReportMessage}
      onToggleBlockUser={chat.onToggleBlockUser}
      blockedUserIds={blockedUserIds}
      showToast={showToast}
    />)}
    {profile.userId && lazyDialog(profile.close, <UserProfileModal
      {...profile.card}
      userId={profile.userId}
      onClose={profile.close}
      currentUser={user}
      showToast={showToast}
      blockedUserIds={blockedUserIds}
    />)}
    {props.blockedUsers.open && user && lazyDialog(props.blockedUsers.close, <BlockedUsersModal isOpen onClose={props.blockedUsers.close} loadBlocks={api.getMyBlocks} onUnblock={props.blockedUsers.onUnblock} showToast={showToast} Avatar={Avatar} />)}
    {props.report.target && lazyDialog(props.report.close, <ReportModal
      targetType={props.report.target.targetType}
      targetId={props.report.target.targetId}
      conversationId={props.report.target.targetType === 'message' ? props.report.target.conversationId : undefined}
      onClose={props.report.close}
      onSubmit={props.report.onSubmit}
    />)}
    {props.image.src && lazyDialog(props.image.close, <ImageViewer src={props.image.src} onClose={props.image.close} />)}
    {props.share.post && lazyDialog(props.share.close, <PostShareSheet post={props.share.post} onClose={props.share.close} showToast={showToast} />)}
  </>;
}
