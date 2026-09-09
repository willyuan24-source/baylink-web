import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../../lib/api';
import {
  buildCommunicationIntent, COMMUNICATION_FACTS_LIMIT, COMMUNICATION_LANGUAGES,
  COMMUNICATION_SCENARIOS, COMMUNICATION_TONES, type CommunicationInput,
} from '../../lib/communication-intent';

type Props = { onToast: (message: string, type?: 'success' | 'error' | 'info') => void };
type GuideResponse = { ok?: boolean; answer?: unknown; degraded?: boolean; responseMode?: string };

export function AiCommunicationTool({ onToast }: Props) {
  const fieldId = useId();
  const [scenario, setScenario] = useState<CommunicationInput['scenario']>('landlord');
  const [language, setLanguage] = useState<CommunicationInput['language']>('en');
  const [tone, setTone] = useState<CommunicationInput['tone']>('natural');
  const [facts, setFacts] = useState('');
  const [output, setOutput] = useState('');
  const [hasDraft, setHasDraft] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [copying, setCopying] = useState(false);
  const mounted = useRef(true);
  const requestVersion = useRef(0);
  const copyVersion = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestVersion.current += 1;
      copyVersion.current += 1;
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, []);

  const invalidate = () => {
    requestVersion.current += 1;
    copyVersion.current += 1;
    activeRequest.current?.abort();
    activeRequest.current = null;
    setLoading(false);
    setCopying(false);
    setOutput('');
    setHasDraft(false);
    setError('');
    setStatus('');
  };

  const generate = async () => {
    if (activeRequest.current) return;
    let message: string;
    try { message = buildCommunicationIntent({ scenario, language, tone, facts }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '请检查填写的内容。'); return; }
    invalidate();
    const version = ++requestVersion.current;
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    const isCurrent = () => mounted.current && version === requestVersion.current && !controller.signal.aborted;
    try {
      const response: GuideResponse | null = await api.request('/ai/guide-chat', {
        method: 'POST', signal: controller.signal,
        body: JSON.stringify({ message, context: { currentPath: '/tools' } }),
      });
      if (!isCurrent()) return;
      if (response?.ok !== true || response.degraded !== false || response.responseMode !== 'ai'
        || typeof response.answer !== 'string' || !response.answer.trim()) {
        setError('AI 暂时未能生成消息草稿，请稍后重试。你填写的内容已保留。');
        return;
      }
      setOutput(response.answer.trim());
      setHasDraft(true);
      setStatus('草稿已生成。请核对事实并按需要修改，再自行发送。');
    } catch (reason) {
      if (!isCurrent()) return;
      const httpStatus = typeof reason === 'object' && reason !== null && 'status' in reason ? reason.status : undefined;
      setError(httpStatus === 429
        ? '生成请求较多，请稍等一分钟后重试。你填写的内容已保留。'
        : '暂时无法生成，请稍后重试。你填写的内容已保留。');
    } finally {
      if (isCurrent()) { activeRequest.current = null; setLoading(false); }
    }
  };

  const copyOutput = async () => {
    if (copying || !output.trim()) return;
    const version = ++copyVersion.current;
    setCopying(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(output);
      if (mounted.current && version === copyVersion.current) {
        setStatus('草稿已复制，请确认后自行发送。');
        onToast('草稿已复制', 'success');
      }
    } catch {
      if (mounted.current && version === copyVersion.current) {
        setStatus('浏览器未允许复制，请选中草稿文字手动复制。');
        onToast('请选中草稿文字手动复制', 'info');
      }
    } finally {
      if (mounted.current && version === copyVersion.current) setCopying(false);
    }
  };

  return (
    <div className="tool-form">
      <p className="tool-note">把需要沟通的事实写下来，生成一条适合联系房东、维修人员或邻居的消息。</p>
      <div className="tool-grid">
        <div className="tool-field">
          <label htmlFor={`${fieldId}-scenario`}>沟通场景</label>
          <select id={`${fieldId}-scenario`} value={scenario} onChange={event => { invalidate(); setScenario(event.target.value as CommunicationInput['scenario']); }}>
            {Object.entries(COMMUNICATION_SCENARIOS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="tool-field">
          <label htmlFor={`${fieldId}-language`}>输出语言</label>
          <select id={`${fieldId}-language`} value={language} onChange={event => { invalidate(); setLanguage(event.target.value as CommunicationInput['language']); }}>
            {Object.entries(COMMUNICATION_LANGUAGES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="tool-field">
          <label htmlFor={`${fieldId}-tone`}>表达语气</label>
          <select id={`${fieldId}-tone`} value={tone} onChange={event => { invalidate(); setTone(event.target.value as CommunicationInput['tone']); }}>
            {Object.entries(COMMUNICATION_TONES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>
      <div className="tool-field">
        <label htmlFor={`${fieldId}-facts`}>需要表达的事实</label>
        <textarea id={`${fieldId}-facts`} rows={5} value={facts} maxLength={COMMUNICATION_FACTS_LIMIT} autoComplete="off"
          aria-describedby={`${fieldId}-facts-note ${fieldId}-consent`}
          placeholder="例如：厨房水龙头从昨天开始漏水。我周五下午在家，想询问是否可以安排维修。"
          onChange={event => { invalidate(); setFacts(event.target.value); }} />
        <p id={`${fieldId}-facts-note`} className="tool-note">{facts.length} / {COMMUNICATION_FACTS_LIMIT} 字。只填写你想在消息里表达的实际情况。如有网址，请在生成后补入草稿。</p>
      </div>
      <p id={`${fieldId}-consent`} className="tool-note">点击生成会交给 AI 处理，确认后自行发送。本页不自动保存内容。</p>
      <div className="tool-actions">
        <button type="button" className="tool-button" disabled={loading || !facts.trim()} onClick={() => { void generate(); }}>
          {loading ? '正在生成…' : hasDraft ? '重新生成草稿' : '生成消息草稿'}
        </button>
        {loading && <button type="button" className="tool-button tool-button-secondary" onClick={() => { invalidate(); setStatus('已取消生成，可调整内容后重试。'); }}>取消生成</button>}
      </div>
      {loading && <p role="status" className="tool-note">正在整理消息，可继续修改输入或取消生成。</p>}
      {error && <p role="alert" className="tool-error">{error}</p>}
      {hasDraft && <div className="tool-output">
        <div className="tool-field">
          <label htmlFor={`${fieldId}-output`}>消息草稿（可编辑）</label>
          <textarea id={`${fieldId}-output`} rows={9} value={output} autoComplete="off" aria-describedby={`${fieldId}-output-note`}
            onChange={event => { copyVersion.current += 1; setCopying(false); setStatus(''); setOutput(event.target.value); }} />
        </div>
        <p id={`${fieldId}-output-note`} className="tool-note">请核对金额、日期和称呼。修改上方事实或选项后，需要重新生成。</p>
        <div className="tool-actions">
          <button type="button" className="tool-button tool-button-secondary" disabled={copying || !output.trim()} onClick={() => { void copyOutput(); }}>
            {copying ? '正在复制…' : '复制草稿'}
          </button>
        </div>
      </div>}
      {status && <p role="status" className="tool-note">{status}</p>}
    </div>
  );
}
