import { useEffect, useRef, useState } from 'react';
import { Loader2, MessageCircle, Phone, Share2, Sparkles } from 'lucide-react';
import { getBayBayCategoryPrompt } from '../utils/categorySafetyTips';
import { Button } from './ui/Button';
import { useUiCopy } from './ui/ui-copy';
import { friendlyErrorMessage } from '../lib/format';
import { CategorySafetyNotice } from './CategorySafetyNotice';

type ContactPreference = {
  mode?: 'dm_first' | 'auto_send' | 'manual_approve';
};

type ContactRequestItem = {
  id: string;
  status: string;
  requestMessage?: string;
  requester?: { id: string; nickname: string; avatar?: string };
};

type PostDetailContactPanelProps = {
  post: { id: string; authorId: string; category: string; title: string; contactPreference?: ContactPreference; status?: 'active' | 'closed' };
  currentUser?: { id: string } | null;
  isOwner: boolean;
  onLoginNeeded: () => void;
  onContactLoginNeeded?: () => void;
  onOpenChat: (authorId: string, authorName: string, postTitle: string) => void;
  authorName: string;
  requestContact: (postId: string) => Promise<{ status: string; threadId?: string; error?: string }>;
  fetchOwnerPending?: () => Promise<ContactRequestItem[]>;
  approveRequest?: (id: string) => Promise<void>;
  declineRequest?: (id: string) => Promise<void>;
  onAskBayBay: (question: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onShare?: () => void;
  /** Which blocks to render — defaults to all for backward compatibility */
  section?: 'contact' | 'baybay' | 'owner' | 'all';
};

const REQUEST_STATUS_COPY: Record<string, { zh: string; en: string }> = {
  pending: { zh: '请求已发送，等待帖主确认', en: 'Request sent; waiting for the poster' },
  auto_sent: { zh: '联系方式已发送到私信', en: 'Contact details were sent to your messages' },
  approved: { zh: '联系方式已发送到私信', en: 'Contact details were sent to your messages' },
  declined: { zh: '帖主暂未发送联系方式，你仍可以通过 BAYLINK 私信联系', en: 'The poster has not shared contact details; you can still message them on BAYLINK' },
  dm_first: { zh: '该帖子仅支持站内私信', en: 'This post takes messages on BAYLINK only' },
};

const PENDING_LOAD_FAILED = '联系方式请求加载失败。';

export const PostDetailContactPanel = (props: PostDetailContactPanelProps) => (
  <ContactPanelSession key={`${props.post.id}:${props.currentUser?.id || 'guest'}:${props.section || 'all'}:${props.post.contactPreference?.mode || 'dm_first'}:${props.post.status || 'active'}`} {...props} />
);

const ContactPanelSession = ({
  post,
  currentUser,
  isOwner,
  onLoginNeeded,
  onContactLoginNeeded,
  onOpenChat,
  authorName,
  requestContact,
  fetchOwnerPending,
  approveRequest,
  declineRequest,
  onAskBayBay,
  showToast,
  onShare,
  section = 'all',
}: PostDetailContactPanelProps) => {
  const { t } = useUiCopy();
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [verificationNeeded, setVerificationNeeded] = useState(false);
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [pendingOwner, setPendingOwner] = useState<ContactRequestItem[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [pendingRetry, setPendingRetry] = useState(0);
  const [actingId, setActingId] = useState<string | null>(null);
  const active = useRef(true);
  const requestInFlight = useRef(false);
  const ownerActionInFlight = useRef(false);
  const pendingFetcher = useRef(fetchOwnerPending);
  const completedIds = useRef(new Set<string>());

  useEffect(() => { pendingFetcher.current = fetchOwnerPending; }, [fetchOwnerPending]);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  const mode = post.contactPreference?.mode || 'dm_first';
  const isClosed = post.status === 'closed';
  const canRequestContact = mode !== 'dm_first' && !isOwner && !isClosed;
  const showContact = section === 'contact' || section === 'all';
  const showBaybay = section === 'baybay' || section === 'all';
  const showOwner = section === 'owner' || section === 'all';

  useEffect(() => {
    let cancelled = false;
    if (!showOwner || !isOwner || !pendingFetcher.current) return;
    setLoadingPending(true);
    setPendingError(null);
    pendingFetcher.current()
      .then(list => { if (!cancelled) setPendingOwner(list.filter(request => !completedIds.current.has(request.id))); })
      .catch(error => { if (!cancelled) setPendingError(friendlyErrorMessage(error, PENDING_LOAD_FAILED)); })
      .finally(() => { if (!cancelled) setLoadingPending(false); });
    return () => { cancelled = true; };
  }, [showOwner, isOwner, post.id, pendingRetry]);

  const handleDm = () => {
    if (!currentUser) return (onContactLoginNeeded || onLoginNeeded)();
    if (isOwner || isClosed) return;
    onOpenChat(post.authorId, authorName, post.title);
  };

  const handleRequest = async () => {
    if (!currentUser) return onLoginNeeded();
    if (requestInFlight.current || isOwner || isClosed) return;
    if (mode === 'dm_first') {
      showToast(t('该帖子仅支持站内私信', 'This post takes messages on BAYLINK only'), 'info');
      return;
    }
    requestInFlight.current = true;
    setLoadingRequest(true);
    try {
      const res = await requestContact(post.id);
      if (!active.current) return;
      if (res.error) {
        showToast(res.error, 'error');
        if (res.status) setRequestStatus(res.status);
        return;
      }
      setRequestStatus(res.status);
      if (res.status === 'auto_sent' || res.status === 'approved') {
        showToast(t('联系方式已发送到私信', 'Contact details were sent to your messages'), 'success');
        if (res.threadId) onOpenChat(post.authorId, authorName, post.title);
      } else if (res.status === 'pending') {
        showToast(t('请求已发送，等待帖主确认', 'Request sent; waiting for the poster'), 'success');
      }
    } catch (error) {
      if (active.current) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'VERIFIED_CONTACT_REQUIRED') setVerificationNeeded(true);
        showToast(friendlyErrorMessage(error, t('请求失败，请重试。', 'The request failed. Please try again.')), 'error');
      }
    } finally {
      if (active.current) { requestInFlight.current = false; setLoadingRequest(false); }
    }
  };

  const handleOwnerAction = async (id: string, approve: boolean) => {
    const action = approve ? approveRequest : declineRequest;
    if (!action || ownerActionInFlight.current) return;
    ownerActionInFlight.current = true;
    setActingId(id);
    try {
      await action(id);
      if (!active.current) return;
      completedIds.current.add(id);
      setPendingOwner(previous => previous.filter(request => request.id !== id));
      showToast(approve ? t('已发送联系方式', 'Contact details sent') : t('已拒绝请求', 'Request declined'), approve ? 'success' : 'info');
    } catch (error) {
      if (active.current) showToast(friendlyErrorMessage(error, t('操作失败，请重试。', 'That didn’t work. Please try again.')), 'error');
    } finally {
      if (active.current) { ownerActionInFlight.current = false; setActingId(null); }
    }
  };

  const categoryPrompt = getBayBayCategoryPrompt(post.category);

  return (
    <div className="cm-contact">
      {verificationNeeded && <p role="status" className="cm-contact__note"><a href="/me">{t('请到“我的”验证手机号后再请求自动发送的联系方式。你仍可使用站内私信。', 'Verify your phone in Me to request contact details. You can still message the poster here.')}</a></p>}
      {showContact && <section aria-label={t('联系发布者', 'Contact the poster')}>
        <h2 className="cm-board__subhead">{t('联系之前', 'Before you contact')}</h2>
        <CategorySafetyNotice category={post.category} />
        <div className="cm-contact__actions">
          {section === 'all' && !isOwner && !isClosed && <Button variant="primary" icon={<MessageCircle aria-hidden="true" strokeWidth={1.75} />} onClick={handleDm}>{t('私信联系', 'Message')}</Button>}
          {isOwner && <p className="cm-contact__note">{t('这是你发布的帖子。收到的私信和联系方式请求可在消息页查看。', 'This is your post. Messages and contact requests are in Messages.')}</p>}
          {!isOwner && isClosed && <p className="cm-contact__note">{t('这条信息已结束，不再接受新的联系请求。', 'This post has ended and takes no new contact requests.')}</p>}
          {canRequestContact && <Button variant="secondary" onClick={handleRequest}
            disabled={loadingRequest || requestStatus === 'pending' || requestStatus === 'auto_sent' || requestStatus === 'approved'}
            icon={loadingRequest ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Phone aria-hidden="true" strokeWidth={1.75} />}>{t('请求联系方式', 'Ask for contact details')}</Button>}
          {!isOwner && !isClosed && mode === 'dm_first' && <p className="cm-contact__note">{t('发布者选择先通过站内私信沟通。', 'The poster prefers to talk by message first.')}</p>}
        </div>
        {onShare && <Button variant="text" icon={<Share2 aria-hidden="true" strokeWidth={1.75} />} onClick={onShare}>{t('分享给朋友', 'Share')}</Button>}
        {requestStatus && <p role="status" className="cm-contact__note">{REQUEST_STATUS_COPY[requestStatus] ? t(REQUEST_STATUS_COPY[requestStatus].zh, REQUEST_STATUS_COPY[requestStatus].en) : t('请求状态已更新，可前往消息页查看。', 'Request updated; see Messages.')}</p>}
      </section>}

      {showBaybay && <section aria-label={t('问问 BayBay', 'Ask BayBay')}>
        <h2 className="cm-board__subhead"><Sparkles aria-hidden="true" strokeWidth={1.75} />{t('问问 BayBay', 'Ask BayBay')}</h2>
        <p className="cm-contact__note">{t('不确定怎么联系？BayBay 可以帮你整理要问的问题和安全提醒。', 'Not sure what to ask? BayBay can list the questions and the safety checks.')}</p>
        <div className="cm-sheet__prompts">
          {[{ zh: '这类帖子联系前要问什么？', en: 'What should I ask before contacting?' }, { zh: '这条信息有什么需要注意？', en: 'What should I watch out for here?' }, { zh: '帮我整理一段私信开场白', en: 'Help me write a first message' }].map((q) => (
            <button key={q.zh} type="button" className="ui-chip" onClick={() => onAskBayBay(t(q.zh, q.en))}>{t(q.zh, q.en)}</button>
          ))}
          {categoryPrompt && <button type="button" className="ui-chip" onClick={() => onAskBayBay(categoryPrompt)}>{t(categoryPrompt, categoryPrompt)}</button>}
        </div>
      </section>}

      {showOwner && isOwner && <section className="cm-contact__owner" aria-label={t('联系方式请求', 'Contact requests')}>
        <h2 className="cm-board__subhead">{t('联系方式请求', 'Contact requests')}</h2>
        {pendingError && <div role="alert" className="cm-contact__note"><p>{pendingError === PENDING_LOAD_FAILED ? t(PENDING_LOAD_FAILED, 'Contact requests did not load.') : pendingError}</p><Button variant="text" onClick={() => setPendingRetry(key => key + 1)}>{t('重新加载', 'Reload')}</Button></div>}
        {loadingPending ? <p className="cm-contact__note"><Loader2 size={14} className="animate-spin" aria-hidden="true" /> {t('加载中…', 'Loading…')}</p>
          : pendingOwner.length === 0 && !pendingError ? <p className="cm-contact__note">{t('暂无待处理的联系方式请求', 'No contact requests waiting')}</p>
            : <ul className="cm-contact__requests">
              {pendingOwner.map((r) => <li key={r.id}>
                <p className="cm-contact__requester">{r.requester?.nickname ? <span translate="no">{r.requester.nickname}</span> : t('用户', 'Member')}</p>
                {r.requestMessage && <p className="cm-contact__note" translate="no">{r.requestMessage}</p>}
                <div className="cm-contact__actions">
                  <Button variant="primary" disabled={actingId !== null || !approveRequest} onClick={() => void handleOwnerAction(r.id, true)}>{actingId === r.id ? t('处理中…', 'Working…') : t('同意并发送', 'Approve and send')}</Button>
                  <Button variant="secondary" disabled={actingId !== null || !declineRequest} onClick={() => void handleOwnerAction(r.id, false)}>{t('暂不发送', 'Not now')}</Button>
                  <Button variant="text" onClick={() => r.requester?.id && onOpenChat(r.requester.id, r.requester.nickname, post.title)}>{t('先私信聊聊', 'Message first')}</Button>
                </div>
              </li>)}
            </ul>}
      </section>}
    </div>
  );
};
