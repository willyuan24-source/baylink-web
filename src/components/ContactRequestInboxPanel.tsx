import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Avatar from './Avatar';
import { friendlyErrorMessage } from '../lib/format';
import { useUiCopy } from './ui/ui-copy';
import '../features/messages/messages-hub.css';

export type ContactRequestInboxItem = {
  id: string;
  postId: string;
  postTitle?: string;
  status: string;
  requestMessage?: string;
  requester?: { id: string; nickname: string; avatar?: string };
};

type ContactRequestInboxPanelProps = {
  fetchPending: () => Promise<ContactRequestInboxItem[]>;
  onApprove: (id: string) => Promise<void>;
  onDecline: (id: string) => Promise<void>;
  onOpenChat: (userId: string, nickname: string, postTitle: string) => void;
  onOpenPost?: (postId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onCountChange?: (count: number) => void;
  refreshKey?: number;
  /** Controlled open state (the 联系请求 round entry on /messages); uncontrolled when omitted. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Keep the section on screen with an empty line when there is nothing to answer (after the round entry is tapped). */
  showEmpty?: boolean;
  id?: string;
};

export const ContactRequestInboxPanel = ({
  fetchPending,
  onApprove,
  onDecline,
  onOpenChat,
  onOpenPost,
  showToast,
  onCountChange,
  refreshKey = 0,
  expanded: controlledExpanded,
  onExpandedChange,
  showEmpty = false,
  id,
}: ContactRequestInboxPanelProps) => {
  const { t } = useUiCopy();
  const [requests, setRequests] = useState<ContactRequestInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownExpanded, setOwnExpanded] = useState(false);
  const expanded = controlledExpanded ?? ownExpanded;
  const setExpanded = (next: boolean) => { if (controlledExpanded === undefined) setOwnExpanded(next); onExpandedChange?.(next); };
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const callbacks = useRef({ fetchPending, onCountChange });
  const active = useRef(true);
  const loadSequence = useRef(0);
  const actionPending = useRef(false);
  const completedIds = useRef(new Set<string>());
  const requestsRef = useRef<ContactRequestInboxItem[]>([]);
  const copy = useRef(t);
  useEffect(() => { copy.current = t; });

  useEffect(() => { callbacks.current = { fetchPending, onCountChange }; }, [fetchPending, onCountChange]);
  useEffect(() => { active.current = true; return () => { active.current = false; loadSequence.current += 1; }; }, []);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    try {
      const response = await callbacks.current.fetchPending();
      if (!Array.isArray(response)) throw new Error('Unexpected contact request response');
      if (!active.current || sequence !== loadSequence.current) return;
      const list = [...new Map(response.filter(request => !completedIds.current.has(request.id)).map(request => [request.id, request])).values()];
      requestsRef.current = list;
      setRequests(list);
      callbacks.current.onCountChange?.(list.length);
      setError(null);
    } catch (err) {
      if (active.current && sequence === loadSequence.current) setError(friendlyErrorMessage(err, copy.current('联系方式请求加载失败。', 'Unable to load contact requests.')));
    } finally {
      if (active.current && sequence === loadSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleAction = async (requestId: string, approve: boolean) => {
    if (actionPending.current) return;
    actionPending.current = true;
    setActingId(requestId);
    try {
      await (approve ? onApprove(requestId) : onDecline(requestId));
      if (!active.current) return;
      completedIds.current.add(requestId);
      const next = requestsRef.current.filter(request => request.id !== requestId);
      requestsRef.current = next;
      setRequests(next);
      callbacks.current.onCountChange?.(next.length);
      showToast(approve ? t('已发送联系方式', 'Contact details sent') : t('已拒绝请求', 'Request declined'), approve ? 'success' : 'info');
    } catch (err) {
      if (active.current) showToast(friendlyErrorMessage(err, t('操作失败，请重试。', 'Action failed. Please try again.')), 'error');
    } finally {
      if (active.current) { actionPending.current = false; setActingId(null); }
    }
  };

  if (requests.length === 0 && !error && !showEmpty) return loading ? <p role="status" className="msg-requests__hint">{t('正在加载联系方式请求…', 'Loading contact requests…')}</p> : null;

  const count = requests.length;
  return (
    <section className="msg-requests" id={id} aria-labelledby="msg-requests-title">
      <div className="msg-requests__head">
        <div>
          <h2 id="msg-requests-title" className="msg-requests__title">{count ? t(`${count} 个联系方式请求待处理`, `Contact requests to answer: ${count}`) : t('联系方式请求', 'Contact requests')}</h2>
          <p className="msg-requests__hint">{t('同意后将通过私信发送联系方式卡片，不会公开在帖子详情。', "Once approved, a contact card will be sent by private message. It won't appear publicly in the post.")}</p>
        </div>
        {count > 0 && <button type="button" className="msg-requests__toggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="msg-requests-list">
          {expanded ? t('收起', 'Collapse') : t('查看请求', 'View requests')}
          {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </button>}
      </div>
      {error && <p role="alert" className="msg-requests__error">{error}<button type="button" onClick={() => void load()}>{t('重新加载', 'Reload')}</button></p>}
      {!error && !count && (loading
        ? <p role="status" className="msg-requests__empty">{t('正在加载联系方式请求…', 'Loading contact requests…')}</p>
        : <p className="msg-requests__empty">{t('暂时没有待处理的联系请求。', 'No contact requests to answer right now.')}</p>)}
      {expanded && count > 0 && (
        <ul id="msg-requests-list" className="msg-requests__list">
          {requests.map((request) => (
            <li key={request.id} className="msg-request">
              <div className="msg-request__who">
                <Avatar src={request.requester?.avatar} name={request.requester?.nickname || t('用户', 'User')} size={10} />
                <strong>{request.requester?.nickname ? <span translate="no">{request.requester.nickname}</span> : t('用户', 'User')}</strong>
              </div>
              <button type="button" className="msg-request__post" onClick={() => onOpenPost?.(request.postId)}>
                {request.postTitle ? <>{t('帖子：', 'Post: ')}<span translate="no">{request.postTitle}</span></> : t('查看相关帖子', 'View the related post')}
              </button>
              {request.requestMessage && <p className="msg-request__note" translate="no">{request.requestMessage}</p>}
              <div className="msg-request__actions">
                <button type="button" data-primary="" disabled={actingId !== null} onClick={() => void handleAction(request.id, true)}>
                  {actingId === request.id ? t('处理中…', 'Processing…') : t('同意并发送', 'Approve and send')}
                </button>
                <button type="button" disabled={actingId !== null} onClick={() => void handleAction(request.id, false)}>{t('暂不发送', "Don't send yet")}</button>
                <button type="button" disabled={!request.requester?.id} onClick={() => request.requester?.id && onOpenChat(request.requester.id, request.requester.nickname, request.postTitle || t('帖子', 'Post'))}>{t('先私信聊聊', 'Start with a private message')}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
