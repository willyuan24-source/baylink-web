import { useCallback, useEffect, useRef, useState } from 'react';
import { Flag, MessageCircle, RefreshCw, Send } from 'lucide-react';
import type { AppContextValue } from '../../app/context';
import { outings, type Outing, type OutingMessage } from '../../lib/outings';
import { useOutingCopy, useOutingNow } from './outing-copy';
import { outingError, type OutingSession } from './outing-session';

const accessRevoked = (error: unknown) => !!error && typeof error === 'object' && 'status' in error && [401, 403, 404].includes(Number(error.status));

export function OutingReport({ outingId, messageId, session, onClose }: { outingId: string; messageId?: string; session: OutingSession; onClose: () => void }) {
  const { t } = useOutingCopy(); const [reason, setReason] = useState('misleading'), [details, setDetails] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState(false);
  const active = useRef(false), lock = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (lock.current || !session.current()) return;
    lock.current = true; setBusy(true); setError(''); const controller = session.controller();
    try { await outings.report(outingId, reason, details.trim(), messageId, controller.signal); if (active.current && session.current()) setSent(true); }
    catch (error) { if (active.current && session.current()) setError(outingError(error, t)); }
    finally { session.release(controller); if (active.current && session.current()) { lock.current = false; setBusy(false); } }
  };
  return <form className="outing-report" onSubmit={event => void submit(event)} aria-label={t('举报内容', 'Report content')}>
    {sent ? <p role="status">{t('举报已提交，平台会审核；这不会自动取消小队。', 'Your report was submitted for review. This does not automatically cancel the outing.')}</p> : <>
      <label>{t('举报原因', 'Reason')}<select value={reason} onChange={e => setReason(e.target.value)} disabled={busy}>{[['spam','广告与垃圾信息','Spam'],['scam','疑似诈骗','Suspected scam'],['harassment','骚扰','Harassment'],['illegal','涉嫌违法','Illegal content'],['misleading','误导信息','Misleading information'],['duplicate','重复内容','Duplicate'],['other','其他','Other']].map(([value, zh, en]) => <option value={value} key={value}>{t(zh,en)}</option>)}</select></label>
      <label>{t('补充说明（不填写敏感资料）', 'Details (no sensitive information)')}<textarea value={details} maxLength={1000} onChange={e => setDetails(e.target.value)} disabled={busy} /></label>
      {error && <p role="alert">{error}</p>}<button className="outing-secondary" disabled={busy} type="submit">{busy ? t('正在提交…','Submitting…') : t('提交举报','Submit report')}</button>
    </>}<button className="outing-link-button" disabled={busy} type="button" onClick={onClose}>{t('关闭','Close')}</button>
  </form>;
}

export function OutingDiscussion({ outing, app, session, refreshOuting }: { outing: Outing; app: AppContextValue; session: OutingSession; refreshOuting: () => Promise<boolean> }) {
  const { t, locale } = useOutingCopy();
  const now = useOutingNow();
  const [messages, setMessages] = useState<OutingMessage[]>([]), [loading, setLoading] = useState(true), [readError, setReadError] = useState('');
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [report, setReport] = useState(''), [versionReady, setVersionReady] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const active = useRef(false), serial = useRef(0), lock = useRef(false), draftVersion = useRef(0);
  const canRead = outing.me?.status === 'confirmed';
  const canWrite = canRead && outing.status === 'open' && outing.endAt > now && outing.me?.confirmedVersion === outing.planVersion;
  const load = useCallback(async () => {
    if (!canRead || !session.current()) return false;
    const version = ++serial.current, controller = session.controller(); setLoading(true);
    try { const result = await outings.messages(outing.id, controller.signal); if (active.current && session.current() && version === serial.current) { setMessages(result.messages); setReadError(''); setAccessDenied(false); return true; } }
    catch (reason) { if (active.current && session.current() && version === serial.current) { setReadError(outingError(reason, t, true)); if (accessRevoked(reason)) { setMessages([]); setReport(''); setAccessDenied(true); setVersionReady(false); } } }
    finally { session.release(controller); if (active.current && session.current() && version === serial.current) setLoading(false); }
    return false;
  }, [canRead, outing.id, session, t]);
  useEffect(() => { active.current = true; void load(); return () => { active.current = false; ++serial.current; }; }, [load]);
  const send = async (event: React.FormEvent) => {
    event.preventDefault(); if (lock.current || accessDenied || !canWrite || !versionReady || !text.trim() || !session.current()) return;
    const submitted = text.trim(), inputVersion = draftVersion.current;
    const payload = { mode: 'message', id: outing.id, text: submitted }, key = session.key(payload), controller = session.controller();
    lock.current = true; ++serial.current; setBusy(true); setError('');
    try {
      const response = await outings.sendMessage(outing, submitted, key, controller.signal);
      if (!active.current || !session.current()) return;
      setMessages(previous => [...previous.filter(message => message.id !== response.message.id), response.message]);
      if (inputVersion === draftVersion.current) setText(''); session.clearKey(payload);
      setVersionReady(false); const refreshed = await refreshOuting(); if (active.current && session.current()) setVersionReady(refreshed);
    } catch (reason) { if (active.current && session.current()) { if (accessRevoked(reason)) { setMessages([]); setReport(''); setAccessDenied(true); setVersionReady(false); setReadError(outingError(reason, t, true)); } else setError(outingError(reason, t)); } }
    finally { session.release(controller); if (active.current && session.current()) { lock.current = false; setBusy(false); setLoading(false); } }
  };
  const refreshVersion = async (includeMessages = false) => {
    setVersionReady(false);
    const messagesReady = includeMessages ? await load() : !accessDenied;
    if (!active.current || !session.current()) return;
    const refreshed = await refreshOuting();
    if (active.current && session.current()) setVersionReady(messagesReady && refreshed);
  };
  if (!canRead) return <section className="outing-discussion outing-surface"><h2><MessageCircle size={18} /> {t('小队讨论', 'Team discussion')}</h2><p className="outing-footnote">{t('发起人接受申请后，可以在这里与成员沟通。讨论内容仅对当前已确认成员开放。', 'Once the host accepts your request, you can talk with the team here. Discussion is visible only to current confirmed members.')}</p></section>;
  return <section className="outing-discussion outing-surface"><div className="outing-toolbar"><div><h2>{t('小队讨论', 'Team discussion')}</h2><p className="outing-footnote">{t('成员可见 · 点刷新读取新消息，不是实时聊天', 'Members only · Refresh for new messages; this is not live chat')}</p></div><button className="outing-secondary" disabled={loading || busy} onClick={() => void refreshVersion(true)}><RefreshCw size={15} />{t('刷新讨论', 'Refresh discussion')}</button></div>
    {loading && <p role="status">{t('正在读取讨论…','Loading discussion…')}</p>}{readError && <p className="outing-error" role="alert">{readError}</p>}
    {!loading && !readError && !messages.length && <p className="outing-footnote">{t('还没有消息。先打个招呼，确认集合入口和需要准备的东西。', 'No messages yet. Say hello and confirm the meeting entrance and what to bring.')}</p>}
    {accessDenied && <p className="outing-notice">{t('当前无法访问成员讨论，已隐藏之前读取的消息。请刷新核实成员权限后再继续。', 'Member discussion is unavailable. Previously loaded messages are hidden. Refresh to verify your access before continuing.')}</p>}
    <ol className="outing-message-list">{messages.filter(message => !app.blockedUserIds.includes(message.senderId)).map(message => <li key={message.id} className="outing-message"><div className="outing-message-header"><button className="outing-person" onClick={() => app.openUserProfile(message.senderId)}>{message.senderName}</button><time dateTime={new Date(message.createdAt).toISOString()}>{new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : locale === 'zh-Hant' ? 'zh-TW' : 'zh-CN', { timeZone:'America/Los_Angeles', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }).format(message.createdAt)}</time></div><p>{message.text}</p>{message.senderId !== app.user?.id && <button className="outing-link-button" onClick={() => setReport(message.id)}><Flag size={13} />{t('举报消息','Report message')}</button>}{report === message.id && <OutingReport outingId={outing.id} messageId={message.id} session={session} onClose={() => setReport('')} />}</li>)}</ol>
    {accessDenied ? null : !canWrite ? <p className="outing-notice">{outing.me?.confirmedVersion !== outing.planVersion ? t('安排已更新。请先在上方确认新的安排，再发送消息。','The plan changed. Reconfirm the new details above before sending messages.') : t('小队已结束或取消，讨论保留供成员查看。','This outing has ended or been cancelled. Members can still read its discussion.')}</p> : <form onSubmit={event => void send(event)}><label>{t('给小队发消息','Message the team')}<textarea maxLength={2000} value={text} onChange={e => { draftVersion.current++; setText(e.target.value); }} placeholder={t('在站内确认集合；不要发送证件、付款信息或他人联系方式。','Confirm meeting details here. Do not send identity documents, payment information or someone else’s contact details.')} /></label><div className="outing-composer-footer"><span className="outing-footnote">{text.length}/2000</span><button className="outing-primary" disabled={busy || !versionReady || !text.trim()} type="submit"><Send size={15} />{busy ? t('正在发送…','Sending…') : t('发送消息','Send message')}</button></div>{error && <div className="outing-error" role="alert"><p>{error}</p><button type="button" className="outing-secondary" disabled={busy} onClick={() => void refreshVersion(true)}>{t('刷新后核实','Refresh to check')}</button></div>}{!versionReady && !busy && <div className="outing-notice"><p>{t('继续发送前，请先刷新核对小队安排和成员权限。','Refresh to verify the outing details and your membership before sending.')}</p><button className="outing-secondary" type="button" onClick={() => void refreshVersion()}>{t('刷新小队','Refresh outing')}</button></div>}</form>}
  </section>;
}
