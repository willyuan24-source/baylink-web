import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { translateText } from '../../i18n/locale';
import { emptyMovingChecklist, MAX_CUSTOM_MOVING_TASKS, MAX_MOVING_TASK_LENGTH, MOVING_CHECKLIST_GROUPS,
  movingChecklistProgress, movingChecklistText, readMovingChecklist, saveMovingChecklist, validateMovingTask,
  type MovingChecklistState } from '../../lib/moving-checklist';

type MovingChecklistProps = { storageScope: string; onToast: (message: string, type?: 'success' | 'error' | 'info') => void };
export function MovingChecklistTool(props: MovingChecklistProps) {
  return <MovingChecklistSession key={props.storageScope} {...props} />;
}

function MovingChecklistSession({ storageScope, onToast }: MovingChecklistProps) {
  const [initial] = useState(() => readMovingChecklist(storageScope));
  const [state, setState] = useState(initial.state);
  const [readBlocked, setReadBlocked] = useState(!!initial.error);
  const [storageError, setStorageError] = useState(initial.error);
  const [saved, setSaved] = useState(false);
  const [customText, setCustomText] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const [copyText, setCopyText] = useState('');
  const active = useRef(true);
  const copyBusy = useRef(false);
  const fieldId = useId();
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const progress = movingChecklistProgress(state);

  const persist = (next: MovingChecklistState) => {
    setState(next);
    const error = saveMovingChecklist(storageScope, next);
    setStorageError(error);
    setSaved(!error);
    if (error) onToast(error, 'error');
  };
  const toggle = (id: string) => {
    if (readBlocked) return;
    if (id.startsWith('custom-')) persist({ ...state, custom: state.custom.map(item => item.id === id ? { ...item, done: !item.done } : item) });
    else persist({ ...state, completed: state.completed.includes(id) ? state.completed.filter(item => item !== id) : [...state.completed, id] });
  };
  const add = () => {
    if (readBlocked) return;
    const result = validateMovingTask(customText);
    if (result.error) { setInputError(result.error); return; }
    if (state.custom.length >= MAX_CUSTOM_MOVING_TASKS) { setInputError('自定义待办已满 20 条，请先删除不需要的项目。'); return; }
    const id = `custom-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    persist({ ...state, custom: [...state.custom, { id, label: result.label, done: false }] });
    setCustomText('');
    setInputError(null);
  };
  const reset = () => {
    const next = emptyMovingChecklist();
    const error = saveMovingChecklist(storageScope, next);
    setStorageError(error ? '重置未保存，原清单仍保留在页面中。请检查浏览器存储设置后重试。' : null);
    if (error) { onToast('重置未保存，原清单仍保留在页面中。请重试。', 'error'); return; }
    setState(next);
    setReadBlocked(false);
    setSaved(true);
    setCustomText('');
    setInputError(null);
    setConfirmReset(false);
    setCopyStatus('idle');
    onToast('清单已重置，可以开始新的搬家计划。', 'success');
  };
  const retryRead = () => {
    const result = readMovingChecklist(storageScope);
    setStorageError(result.error);
    if (!result.error) { setState(result.state); setReadBlocked(false); }
  };
  const copy = async () => {
    if (copyBusy.current) return;
    copyBusy.current = true;
    const text = movingChecklistText(state, translateText);
    setCopyText(text);
    setCopyStatus('copying');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      if (active.current) { setCopyStatus('copied'); onToast('搬家清单已复制。', 'success'); }
    } catch {
      if (active.current) { setCopyStatus('failed'); onToast('浏览器未允许复制，请使用下方文本手动复制。', 'info'); }
    } finally { copyBusy.current = false; }
  };

  return <div className="tool-form tool-checklist">
    <p className="tool-note">按搬家阶段逐项确认。清单保存在当前账号或访客的本机浏览器中，不跨设备同步；无需填写个人地址或上传照片。</p>
    <div className="tool-checklist-progress">
      <p role="status">已完成 {progress.completed} / {progress.total} 项{saved ? ' · 已保存到此浏览器' : ''}</p>
      <progress aria-label="搬家清单完成进度" value={progress.completed} max={progress.total} />
    </div>
    {storageError && <div className="tool-error" role="alert"><p>{storageError}</p>{readBlocked && <button type="button" className="tool-button-secondary" onClick={retryRead}>重试读取清单</button>}</div>}
    {MOVING_CHECKLIST_GROUPS.map(group => <fieldset key={group.id} className="tool-checklist-group" disabled={readBlocked}>
      <legend>{group.title}</legend>
      {group.items.map(item => <label key={item.id} className="tool-checklist-item"><input type="checkbox" checked={state.completed.includes(item.id)} onChange={() => toggle(item.id)} /><span>{item.label}</span></label>)}
    </fieldset>)}
    <fieldset className="tool-checklist-group tool-checklist-custom" disabled={readBlocked}>
      <legend>自己补充 <span>({state.custom.length} / {MAX_CUSTOM_MOVING_TASKS})</span></legend>
      {state.custom.map(item => <div key={item.id} className="tool-checklist-item">
        <label><input type="checkbox" checked={item.done} onChange={() => toggle(item.id)} /><span translate="no">{item.label}</span></label>
        <button type="button" className="tool-button-secondary" aria-label={`删除待办：${item.label}`} onClick={() => { persist({ ...state, custom: state.custom.filter(task => task.id !== item.id) }); setInputError(null); }}>删除</button>
      </div>)}
      <form className="tool-actions" onSubmit={event => { event.preventDefault(); add(); }}>
        <div className="tool-field"><label htmlFor={fieldId}>新待办</label><input id={fieldId} type="text" maxLength={MAX_MOVING_TASK_LENGTH} value={customText} placeholder="例如：留出一箱第一晚要用的物品" aria-describedby={`${fieldId}-hint${inputError ? ` ${fieldId}-error` : ''}`} onChange={event => { setCustomText(event.target.value); setInputError(null); }} onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault(); }} /><small id={`${fieldId}-hint`}>最多 80 个字符；自定义待办最多 20 条。</small></div>
        <button type="submit" className="tool-button-secondary">添加待办</button>
      </form>
      {inputError && <p id={`${fieldId}-error`} className="tool-error" role="alert">{inputError}</p>}
    </fieldset>
    <div className="tool-actions">
      <button type="button" className="tool-button" disabled={copyStatus === 'copying' || readBlocked} onClick={() => void copy()}>{copyStatus === 'copying' ? '正在复制…' : copyStatus === 'copied' ? '已复制清单' : '复制清单'}</button>
      <button type="button" className="tool-button-secondary" onClick={() => setConfirmReset(true)}>重置清单</button>
    </div>
    {confirmReset && <div className="tool-checklist-reset tool-output" role="group" aria-label="确认重置搬家清单"><p>清除所有完成标记和自定义待办，恢复初始模板？</p><div className="tool-actions"><button type="button" className="tool-button-secondary" onClick={() => setConfirmReset(false)}>保留清单</button><button type="button" className="tool-button" onClick={reset}>确认重置</button></div></div>}
    {copyStatus === 'failed' && <div className="tool-output"><p role="status" className="tool-note">浏览器未允许复制，请选中下方文本手动复制。</p><textarea aria-label="可手动复制的搬家清单" readOnly rows={12} value={copyText} onFocus={event => event.currentTarget.select()} /></div>}
    <p className="tool-note"><Link to="/guides/bay-area-utilities-address-change-guide">查看水电网与地址变更指南</Link></p>
  </div>;
}
