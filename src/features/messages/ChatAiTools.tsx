import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Languages, Loader2, Sparkles, X } from 'lucide-react';
import { api } from '../../lib/api';
import { translateText, useLocale, type Locale } from '../../i18n/locale';
import type { Message } from '../../lib/types';

type AiRequest = { mode: 'translate'; messageId: string; targetLocale: Locale }
  | { mode: 'draft'; intent: string; messageId?: string; targetLocale: Locale };

/** Results stay in this mounted conversation, never in shared or persistent caches. */
function useChatAi(conversationId: string, context: string) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [completion, setCompletion] = useState(0);
  const [failed, setFailed] = useState(false);
  const request = useRef<AbortController | null>(null);
  const cancel = useCallback(() => {
    request.current?.abort();
    request.current = null;
    setPending(false);
    setResult(null);
    setFailed(false);
  }, []);

  useEffect(() => {
    cancel();
    return () => { request.current?.abort(); request.current = null; };
  }, [conversationId, context, cancel]);

  const run = async (body: AiRequest) => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true); setFailed(false); setResult(null);
    try {
      const response = await api.request(`/conversations/${encodeURIComponent(conversationId)}/ai`, {
        method: 'POST', body: JSON.stringify(body), signal: controller.signal,
      });
      if (request.current !== controller || controller.signal.aborted) return;
      if (!response?.ok || typeof response.text !== 'string' || !response.text.trim()
        || response.text.length > (body.mode === 'draft' ? 2000 : 16000)) throw new Error('Invalid AI response');
      setResult(response.text.trim());
      setCompletion(value => value + 1);
    } catch {
      if (request.current === controller && !controller.signal.aborted) setFailed(true);
    } finally {
      if (request.current === controller) { request.current = null; setPending(false); }
    }
  };
  return { pending, result, completion, failed, run, cancel, setResult };
}

export function ChatAiTranslation({ conversationId, message }: { conversationId: string; message: Message }) {
  const locale = useLocale();
  return <TranslationSession key={JSON.stringify([conversationId, message.id, message.content, locale])} conversationId={conversationId} message={message} locale={locale} />;
}

function TranslationSession({ conversationId, message, locale }: { conversationId: string; message: Message; locale: Locale }) {
  const tr = (text: string) => translateText(text, locale);
  const ai = useChatAi(conversationId, message.id);
  const [original, setOriginal] = useState(false);
  const translated = !!ai.result && !original;
  return <div className="chat-ai-message" translate="no">
    <p lang={translated ? locale : undefined}>{translated ? ai.result : message.content}</p>
    {translated && <span className="chat-ai-translation-label" lang={locale}>{tr('AI 译文')}</span>}
    <button type="button" className="chat-ai-translate" lang={locale} disabled={ai.pending}
      onClick={() => { if (ai.result) setOriginal(value => !value); else void ai.run({ mode: 'translate', messageId: message.id, targetLocale: locale }); }}>
      {ai.pending ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Languages size={13} aria-hidden="true" />}
      {tr(ai.pending ? '正在翻译…' : translated ? '查看原文' : ai.result ? '查看译文' : '翻译')}
    </button>
    {ai.failed && <p className="chat-ai-translation-error" lang={locale} role="alert">{tr('暂时无法翻译，请重试。')}</p>}
  </div>;
}

type ChatAiComposerProps = {
  conversationId: string;
  selectedMessage: Message | null;
  composerValue: string;
  onApply: (text: string) => void;
  onClose: () => void;
};

export function ChatAiComposer({ conversationId, selectedMessage, composerValue, onApply, onClose }: ChatAiComposerProps) {
  const locale = useLocale();
  const tr = (text: string) => translateText(text, locale);
  const [intent, setIntent] = useState('');
  const [language, setLanguage] = useState<Locale | null>(null);
  const targetLocale = language ?? locale;
  const context = JSON.stringify([selectedMessage?.id, selectedMessage?.content, composerValue, targetLocale]);
  const ai = useChatAi(conversationId, context);
  const intentId = 'chat-ai-reply-intent';
  const resultRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!ai.completion) return;
    draftRef.current?.focus({ preventScroll: true });
    resultRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [ai.completion]);

  return <section id="chat-ai-composer" className="chat-ai-panel" aria-label={tr('BayBay 回复助手')} translate="no" lang={locale}>
    <div className="chat-ai-panel-heading"><h3><Sparkles size={16} aria-hidden="true" />{tr('BayBay 回复助手')}</h3><button type="button" aria-label={tr('关闭回复助手')} onClick={onClose}><X size={18} /></button></div>
    <p className="chat-ai-panel-hint">{tr('只根据你填写的意思和引用的消息拟稿，不会自动发送。')}</p>
    {selectedMessage && <blockquote className="chat-ai-reply-context"><span>{tr('参考这条消息')}</span><p translate="no">{selectedMessage.content}</p></blockquote>}
    <label htmlFor={intentId}>{tr('你想怎么回复？')}</label>
    <textarea id={intentId} autoFocus rows={2} value={intent} maxLength={1000} translate="no"
      placeholder={tr('例如：周六下午可以取货，请对方确认地点。')}
      onChange={event => { ai.cancel(); setIntent(event.target.value); }} />
    <div className="chat-ai-controls"><label>{tr('回复语言')}<select value={targetLocale} onChange={event => { ai.cancel(); setLanguage(event.target.value as Locale); }}>
      <option value="en">English</option><option value="zh-Hans">简体中文</option><option value="zh-Hant">繁體中文</option>
    </select></label><button type="button" className="chat-ai-generate" disabled={ai.pending || !intent.trim()} onClick={() => void ai.run({ mode: 'draft', intent: intent.trim(), targetLocale, ...(selectedMessage ? { messageId: selectedMessage.id } : {}) })}>
      {ai.pending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}{tr(ai.pending ? '正在拟写…' : '生成回复草稿')}
    </button></div>
    {ai.failed && <p className="chat-ai-error" role="alert">{tr('暂时无法生成回复，请重试。')}</p>}
    {ai.result !== null && <div ref={resultRef} className="chat-ai-result"><p className="chat-ai-ready" role="status"><CheckCircle2 size={16} aria-hidden="true" />{tr('草稿已生成')}</p><label htmlFor="chat-ai-reply-draft">{tr('检查并修改草稿')}</label>
      <textarea ref={draftRef} id="chat-ai-reply-draft" rows={3} value={ai.result} maxLength={2000} translate="no" lang={targetLocale} onChange={event => ai.setResult(event.target.value)} />
      <p className="chat-ai-panel-hint">{tr('放入输入框后，由你确认发送。')}</p>
      <button type="button" className="chat-ai-apply" disabled={!ai.result.trim()} onClick={() => { if (ai.result !== null) onApply(ai.result); }}>{tr(composerValue ? '替换输入框内容' : '放入输入框')}</button>
    </div>}
  </section>;
}
