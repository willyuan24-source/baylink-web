// Everything AppLayout shows over the page (WEB-SHELL2, split out of AppLayout): the toast, confirmations, search, BayBay,
// the sign-in / password / report / block / share dialogs, the post, chat and profile overlays. Every dialog loads on first
// use (its chunk is not in the shell graph every page downloads) and sits behind a boundary: if its chunk cannot load,
// the dialog closes with a message instead of taking the page down, and the next time it is opened it loads again.
import { Suspense, useEffect, useState, type ComponentProps, type ReactNode, type RefObject } from 'react';
import { Loader2, X } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import type { NavigateFunction } from 'react-router-dom';
import { ConfirmHost } from '../components/ui/confirm';
import { ModalShell } from '../components/ui/Modal';
// A dialog's chunk wait is DialogWait (followup 41): the site's one scrim and spinner disc, holding the page as the dialog will.
import { DialogWait } from '../components/ui/DialogWait';
import { Toast, type ToastAction } from '../components/Toast';
import { LocaleContentGate } from '../components/LocaleContentGate';
import type { BayBayConversationDraft } from '../components/BayBayAssistantEntry';
import type { ReportReason } from '../components/ReportModal';
import { lazyChunk } from '../lib/chunk-recovery';
import { ChunkBoundary } from '../components/ChunkBoundary';
import { api } from '../lib/api';
import { translateText, useLocale, type Locale } from '../i18n/locale';
import { showUnavailable } from './chunk-unavailable';
import type { AdDetailItem, Conversation, PostData, PostType, ReportTarget, UserData } from '../lib/types';
import type { AppContextValue, ShowToast } from './context';
import { useReopenAfterFailure } from './useReopenAfterFailure';
import { useExit } from '../lib/reading-preferences';

const QuickExplore = lazyChunk(() => import('../components/QuickExplore'), m => m.QuickExplore);
// The same module baybay-preload.ts warms on every 问 BayBay trigger (one chunk).
const BayBayAssistantEntry = lazyChunk(() => import('../components/BayBayAssistantEntry'), m => m.BayBayAssistantEntry);
const CreatePostModal = lazyChunk(() => import('../features/posts/CreatePostModal'), m => m.CreatePostModal);
const PostDetailModal = lazyChunk(() => import('../features/posts/PostDetailModal'), m => m.PostDetailModal);
const UserProfileModal = lazyChunk(() => import('../features/users/UserProfileModal'), m => m.UserProfileModal);
const ChatView = lazyChunk(() => import('../features/messages/ChatView'), m => m.ChatView);
const LoginModal = lazyChunk(() => import('../features/auth/LoginModal'), m => m.LoginModal);
const ForgotPasswordModal = lazyChunk(() => import('../components/ForgotPasswordModal'), m => m.ForgotPasswordModal);
const ResetPasswordModal = lazyChunk(() => import('../components/ResetPasswordModal'), m => m.ResetPasswordModal);
const BlockedUsersModal = lazyChunk(() => import('../components/BlockedUsersModal'), m => m.BlockedUsersModal);
const ReportModal = lazyChunk(() => import('../components/ReportModal'), m => m.ReportModal);
const PostShareSheet = lazyChunk(() => import('../components/PostShareSheet'), m => m.PostShareSheet);
const AdDetailModal = lazyChunk(() => import('../features/ads/OfficialAds'), m => m.AdDetailModal);
const ImageViewer = lazyChunk(() => import('../components/ImageViewer'), m => m.ImageViewer);
const PostNotFoundView = lazyChunk(() => import('../components/PostNotFoundView'), m => m.PostNotFoundView);

const copy = (locale: Locale, zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);

/**
 * "正在打开搜索… / 正在打开 BayBay…" while the dialog's chunk loads (BB launcher item e): F's Sheet frame (the .ui-sheet
 * classes of ui.css, without importing the Sheet into the shell) titled like the sheet that replaces it and at its size
 * (site-chrome.css), so it arrives in place. `drawer` is BayBay's 440px drawer with no desktop scrim (captain decision 7).
 * The close is CloseButton's markup written out (its classes, ✕ at 1.75 and name), as in Toast.tsx: this host is in the
 * entry chunk, and importing CloseButton would make the entry load Button.tsx and its card sheets, which the pages that
 * do not need them (opus-bay.html, play.html, verify-email.html) would then block on (UI9-R2 measured; ui9-r1-overlays pins it).
 */
const SheetChunkFallback = ({ title, label, onClose, restoreFocusRef, drawer }: { title: string; label: string; onClose: () => void; restoreFocusRef?: RefObject<HTMLElement>; drawer?: boolean }) => {
  const close = copy(useLocale(), '关闭', 'Close');
  return <ModalShell onClose={onClose} className={`ui-sheet-backdrop site-chunk-sheet site-chunk-sheet--${drawer ? 'drawer' : 'search'}`} label={label} restoreFocusRef={restoreFocusRef}>
    <div className="ui-sheet">
      <div className="ui-sheet__handle" aria-hidden="true" />
      <div className="ui-sheet__header">
        <p className="ui-sheet__title">{title}</p>
        <button type="button" className="ui-icon-button ui-close" aria-label={close} title={close} onClick={onClose}><X aria-hidden="true" strokeWidth={1.75} /></button>
      </div>
      <div className="ui-sheet__body site-chunk-sheet__body"><Loader2 aria-hidden="true" className="site-chunk-spinner" strokeWidth={1.75} /><p role="status">{label}</p></div>
    </div>
  </ModalShell>;
};

/**
 * Contains a dialog whose chunk failed twice (offline, a stale deploy) or that crashed: close it and say so, keep the
 * page (ChunkBoundary, shared with the header's lazy pieces). The host unmounts the boundary (or changes its key) to try
 * again; a failed boundary renders nothing.
 */
export const OverlayBoundary = ChunkBoundary;

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
  const unavailable = (close: () => void) => (lostChunk: boolean) => { close(); showUnavailable(showToast, lostChunk); };
  const lazyDialog = (close: () => void, node: ReactNode, fallback: ReactNode = <DialogWait />, options: { key?: string; onFail?: () => void } = {}) =>
    <OverlayBoundary key={options.key} onFail={lostChunk => { options.onFail?.(); unavailable(close)(lostChunk); }}><Suspense fallback={fallback}>{node}</Suspense></OverlayBoundary>;
  const baybayAttempt = useReopenAfterFailure(baybay.open);
  const postClose = () => post.close(post.selected);
  // N24: search and the image viewer stay mounted through their exit (useExit, 200ms; 0 under reduced motion and in
  // 简洁显示). The viewer keeps showing the picture it closed on.
  const searchShown = useExit(search.open);
  const [lastImage, setLastImage] = useState<string | null>(null);
  useEffect(() => { if (props.image.src) setLastImage(props.image.src); }, [props.image.src]);
  const imageShown = useExit(!!props.image.src);
  const viewerSrc = props.image.src ?? lastImage;

  return <>
    {/* locationKey is the real location: navigating (Back included) cancels a pending confirmation's stale closure. */}
    <ConfirmHost locationKey={props.locationKey} />
    {props.toast && <Toast key={props.toast.id} message={props.toast.message} type={props.toast.type} action={props.toast.action} onClose={props.closeToast} />}
    {props.ad.item && lazyDialog(props.ad.close, <AdDetailModal ad={props.ad.item} onClose={props.ad.close} isAdmin={props.ad.isAdmin} onDelete={props.ad.onDelete} />)}
    {searchShown && lazyDialog(search.close, <LocaleContentGate paths={['/guides', '/calendar', '/explore']}><QuickExplore open={search.open} initialQuery={search.query} restoreFocusRef={search.openerRef} onClose={search.close} onNavigate={props.navigate} onSearch={search.onSearch} onAsk={search.onAsk} /></LocaleContentGate>,
      <SheetChunkFallback title={t('搜索', 'Search')} label={t('正在打开搜索…', 'Opening search…')} onClose={search.close} restoreFocusRef={search.openerRef} />)}

    {(baybay.open || (baybay.loaded && !baybayAttempt.failed)) && lazyDialog(() => baybay.onOpenChange(false), <LocaleContentGate paths={['/calendar']}><BayBayAssistantEntry
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
    /></LocaleContentGate>, baybay.open ? <SheetChunkFallback drawer title={t('问 BayBay', 'Ask BayBay')} label={t('正在打开 BayBay…', 'Opening BayBay…')} onClose={() => baybay.onOpenChange(false)} restoreFocusRef={baybay.openerRef} /> : null,
    { key: baybayAttempt.key, onFail: baybayAttempt.fail })}

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
      <ModalShell onClose={postClose} label={t('正在加载信息', 'Loading')} className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--scrim)] p-6"><div className="site-chunk-card"><Loader2 aria-hidden="true" className="site-chunk-spinner" strokeWidth={1.75} /><button type="button" className="ui-button" data-variant="secondary" onClick={postClose}>{t('返回', 'Back')}</button></div></ModalShell>
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
    {props.blockedUsers.open && user && lazyDialog(props.blockedUsers.close, <BlockedUsersModal isOpen onClose={props.blockedUsers.close} loadBlocks={api.getMyBlocks} onUnblock={props.blockedUsers.onUnblock} showToast={showToast} />)}
    {props.report.target && lazyDialog(props.report.close, <ReportModal
      targetType={props.report.target.targetType}
      targetId={props.report.target.targetId}
      conversationId={props.report.target.targetType === 'message' ? props.report.target.conversationId : undefined}
      onClose={props.report.close}
      onSubmit={props.report.onSubmit}
    />)}
    {imageShown && viewerSrc && lazyDialog(props.image.close, <ImageViewer src={viewerSrc} closing={!props.image.src} onClose={props.image.close} />)}
    {props.share.post && lazyDialog(props.share.close, <PostShareSheet post={props.share.post} onClose={props.share.close} showToast={showToast} />)}
  </>;
}
