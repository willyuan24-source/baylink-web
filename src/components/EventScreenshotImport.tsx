import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, Check, ImagePlus, LoaderCircle, Sparkles, X } from 'lucide-react';
import { ModalShell } from './ui/Modal';
import { api } from '../lib/api';
import { EMPTY_EVENT, EVENT_LIMITS, downloadImportedEvent, eventDraftError, parseEventDraft, type EventDraft, type ImportedEvent } from '../lib/imported-events';
import { useImportedEvents } from '../lib/useImportedEvents';
import { todayInBay } from '../lib/planner';
import { getLocale, translateText, useLocale } from '../i18n/locale';
import { compressImageFile, fileToDataUrl } from '../utils/imageCompression';

export function EventScreenshotImport({ userId }: { userId?: string }) {
  const location = useLocation(); const navigate = useNavigate();
  const locale = useLocale(); const t = (text: string) => translateText(text, locale);
  const [open, setOpen] = useState(false);
  const routeOpen = new URLSearchParams(location.search).get('import') === 'event';
  const close = () => {
    setOpen(false);
    if (routeOpen) { const params = new URLSearchParams(location.search); params.delete('import'); navigate({ pathname: location.pathname, search: params.toString() }, { replace: true }); }
  };
  return <>
    <section className="event-import-entry" aria-label={t('导入活动截图')}>
      <div className="event-import-icon"><ImagePlus size={23} /></div>
      <div><h2>{t('看到喜欢的活动，先留住。')}</h2><p>{t('一张截图，整理成你的私人活动卡。')}</p></div>
      <button type="button" onClick={() => setOpen(true)}>{t('导入活动截图')} <ArrowRight size={16} /></button>
    </section>
    {(open || routeOpen) && <EventImportDialog key={userId || 'guest'} userId={userId} onClose={close} />}
  </>;
}

export function EventImportDialog({ userId, event, onClose }: { userId?: string; event?: ImportedEvent; onClose: () => void }) {
  const locale = useLocale(); const t = (text: string) => translateText(text, locale);
  const library = useImportedEvents(userId); const headingId = useId(); const fieldId = useId();
  const [draft, setDraft] = useState<EventDraft>(event || { ...EMPTY_EVENT });
  const [image, setImage] = useState(''); const [fileName, setFileName] = useState('');
  const [stage, setStage] = useState<'image' | 'edit'>(event ? 'edit' : 'image');
  const [preparing, setPreparing] = useState(false); const [recognizing, setRecognizing] = useState(false);
  const [confirmed, setConfirmed] = useState(false); const [error, setError] = useState('');
  const [saved, setSaved] = useState<ImportedEvent>(); const [extracted, setExtracted] = useState(false);
  const generation = useRef(0); const active = useRef<AbortController>(); const fileInput = useRef<HTMLInputElement>(null);
  const editHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => { generation.current++; active.current?.abort(); }, []);
  useEffect(() => { if (stage === 'edit') editHeading.current?.focus(); }, [stage]);
  useEffect(() => {
    generation.current++; active.current?.abort(); setRecognizing(false); setPreparing(false);
  }, [locale]);
  const cancel = () => { generation.current++; active.current?.abort(); setRecognizing(false); setPreparing(false); };
  const chooseFile = async (file?: File) => {
    if (!file) return;
    cancel(); const sequence = generation.current;
    setError(''); setImage(''); setFileName(''); setPreparing(true);
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('请选择不超过 10 MB 的 JPG、PNG 或 WebP 图片。');
      const compressed = await compressImageFile(file, { maxWidth: 1800, maxHeight: 1800, quality: .86, skipBelowBytes: 1024 * 1024 });
      if (compressed.file.size > 2 * 1024 * 1024) throw new Error('图片压缩后仍过大，请裁剪到活动信息区域后重试。');
      const data = await fileToDataUrl(compressed.file);
      if (sequence !== generation.current) return;
      setImage(data); setFileName(file.name);
    } catch (e) { if (sequence === generation.current) setError(e instanceof Error && /^(请选择|图片压缩)/.test(e.message) ? e.message : '这张图片暂时无法读取，请换一张图片或手动填写。'); }
    finally { if (sequence === generation.current) setPreparing(false); }
  };
  const recognize = async () => {
    if (!image || recognizing || preparing) return;
    const sequence = ++generation.current; const requestLocale = locale; const controller = new AbortController(); active.current = controller;
    setRecognizing(true); setError('');
    try {
      const result = await api.request('/ai/event-extract', { method: 'POST', signal: controller.signal, body: JSON.stringify({ image, locale }) });
      if (sequence !== generation.current || controller.signal.aborted || requestLocale !== getLocale()) return;
      const parsed = result?.ok === true && parseEventDraft(result.draft);
      if (!parsed) throw new Error('invalid');
      setDraft(parsed); setConfirmed(false); setExtracted(true); setStage('edit');
    } catch (e) {
      if (sequence === generation.current && !controller.signal.aborted) setError((e as { status?: number })?.status === 429 ? '识别请求较多，请稍后重试，也可以手动填写。' : '暂时无法识别这张图片。可以重试，或直接手动填写。');
    } finally { if (sequence === generation.current) setRecognizing(false); }
  };
  const update = (key: keyof EventDraft, value: string) => { setDraft(previous => ({ ...previous, [key]: value })); setConfirmed(false); setError(''); };
  const save = async () => {
    const problem = eventDraftError(draft);
    if (problem) { setError(problem); return; }
    if (!confirmed) return;
    setError(''); const clean = parseEventDraft(draft)!;
    const result = await library.save(clean, event?.id); if (result) setSaved(result);
  };
  const field = (key: keyof EventDraft, label: string, type = 'text', required = false) => <label className={`event-field event-field-${key}`} htmlFor={`${fieldId}-${key}`}>
    <span>{t(label)}{required && <span aria-hidden="true"> *</span>}</span>
    <input id={`${fieldId}-${key}`} type={type} value={draft[key]} required={required} maxLength={EVENT_LIMITS[key]} translate="no" disabled={library.busy} onChange={e => update(key, e.target.value)} />
  </label>;
  return <ModalShell onClose={() => { if (!library.busy) onClose(); }} className="event-import-backdrop" labelledBy={headingId}>
    <div className="event-import-dialog">
      <header className="event-import-header"><div><span className="event-import-eyebrow">BAYBAY · {t('活动小帮手')}</span><h2 id={headingId}>{t(saved ? '活动已留好。' : event ? '修改私人活动' : '把截图变成一次出发')}</h2></div><button type="button" className="event-icon-button" disabled={library.busy} aria-label={t('关闭')} onClick={onClose}><X size={22} /></button></header>
      {saved ? <div className="event-import-success"><div className="event-success-icon"><Check size={28} /></div><h3 translate="no">{saved.title}</h3><p translate="no">{saved.date}{saved.startTime && ` · ${saved.startTime}`}</p><p>{t(userId ? '仅自己可见，已保存到你的账号。' : '仅保存在此浏览器，请导出日历留一份。')}</p><div className="event-import-actions"><Link className="event-primary" to="/my-week" onClick={onClose}>{t('查看我的这周')} <ArrowRight size={16} /></Link><button type="button" onClick={() => downloadImportedEvent(saved)}><CalendarDays size={16} />{t('导出日历')}</button></div></div> : <>
        {!event && <ol className="event-import-steps" aria-label={t('导入步骤')}><li aria-current={stage === 'image' ? 'step' : undefined}><span>1</span>{t('选一张截图')}</li><li aria-current={stage === 'edit' ? 'step' : undefined}><span>2</span>{t('核对并保存')}</li></ol>}
        <div className={`event-import-body ${stage === 'edit' && image ? 'has-preview' : ''}`}>
          {stage === 'image' ? <div className="event-upload-stage">
            <input ref={fileInput} className="event-file-input" tabIndex={-1} type="file" accept="image/jpeg,image/png,image/webp" aria-label={t('选择活动截图')} onChange={e => { void chooseFile(e.target.files?.[0]); e.target.value = ''; }} />
            <button className={`event-upload-zone ${image ? 'has-image' : ''}`} type="button" disabled={preparing || recognizing} onClick={() => fileInput.current?.click()}>
              {image ? <img src={image} alt={t('已选活动截图')} /> : <ImagePlus size={36} />}
              <strong>{t(preparing ? '正在整理图片…' : image ? '换一张截图' : '选择活动截图')}</strong>
              <span>{image ? <span translate="no">{fileName}</span> : 'JPG / PNG / WebP · ≤ 10 MB'}</span>
            </button>
            <p className="event-help">{t('点击识别后，图片会交给 AI 整理；确认后仅保存活动文字。')}</p>
            {recognizing && <p role="status" className="event-processing"><LoaderCircle size={18} className="event-spin" />{t('正在读活动名称、日期和地点…')}</p>}
          </div> : <>
            {image && <aside className="event-original"><img src={image} alt={t('原始活动截图，供核对')} /><p>{t('对照原图，检查日期和地点。')}</p></aside>}
            <div className="event-editor"><h3 ref={editHeading} tabIndex={-1}>{t(event ? '活动信息' : '确认这场活动')}</h3>
              <p className="event-help">{t(extracted ? '这是 AI 整理的草稿，空白或不准确的地方请补充。' : '填写活动名称和完整日期，就可以保存。')}</p>
              <div className="event-field-grid">{field('title', '活动名称', 'text', true)}{field('date', '活动日期', 'date', true)}{field('city', '城市')}{field('startTime', '开始时间', 'time')}{field('endTime', '结束时间', 'time')}{field('venue', '场地名称')}</div>
              <p className="event-help">{t('时间按湾区当地时间；未填时间时，只保存日期提醒。')}</p>
              {!draft.date && extracted && <p className="event-warning">{t('尚未确认完整日期，请核对年份后填写。')}</p>}
              {draft.date && draft.date < todayInBay() && <p className="event-warning">{t('这个日期已经过去，请确认是否选对年份。')}</p>}
              <details className="event-extra"><summary>{t('地址、费用和更多信息')}</summary><div className="event-field-grid">{field('address', '详细地址')}{field('price', '费用说明')}{field('sourceUrl', '官方来源链接', 'url')}<label className="event-field event-field-description" htmlFor={`${fieldId}-description`}><span>{t('备注')}</span><textarea id={`${fieldId}-description`} value={draft.description} translate="no" maxLength={EVENT_LIMITS.description} rows={3} disabled={library.busy} onChange={e => update('description', e.target.value)} /></label></div></details>
              <label className="event-confirm"><input type="checkbox" checked={confirmed} disabled={library.busy} onChange={e => setConfirmed(e.target.checked)} /><span>{t('我已核对活动名称、日期和地点。')}</span></label>
              <p className="event-help">{t(userId ? '仅自己可见，保存到我的这周。' : '无需登录，仅保存在此浏览器。')}</p>
            </div>
          </>}
          {(error || library.error) && <div role="alert" className="event-error"><p>{t(error || library.error)}</p>{library.error && <button type="button" disabled={library.busy || library.loading} onClick={() => void library.refresh()}>{t('重新加载记录')}</button>}</div>}
        </div>
        <footer className="event-import-footer">{stage === 'image' ? <>
          <button type="button" disabled={recognizing || preparing} onClick={() => { cancel(); setStage('edit'); }}>{t('手动填写')}</button>
          {recognizing ? <button type="button" onClick={cancel}>{t('停止识别')}</button> : <button type="button" className="event-primary" disabled={!image || preparing} onClick={() => void recognize()}><Sparkles size={17} />{t('识别活动')}</button>}
        </> : <>
          {!event ? <button type="button" disabled={library.busy} onClick={() => { setError(''); setStage('image'); }}>{t('返回截图')}</button> : <button type="button" disabled={library.busy} onClick={onClose}>{t('取消')}</button>}
          <button type="button" className="event-primary" disabled={!confirmed || library.busy || library.loading} onClick={() => void save()}>{library.busy ? <LoaderCircle className="event-spin" size={17} /> : <Check size={17} />}{t(library.busy ? '正在保存…' : event ? '保存修改' : '保存到我的这周')}</button>
        </>}</footer>
      </>}
    </div>
  </ModalShell>;
}
