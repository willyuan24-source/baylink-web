import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Ban, Copy, ExternalLink, FileCheck, Mail, RotateCcw } from 'lucide-react';
import { api } from '../../lib/api';
import { contentReviewToday } from '../../lib/content-review';
import { translateText, useLocale } from '../../i18n/locale';
import {
  decisionKey, imageOf, parseMediaCandidates, permissionMailto, readMediaDecisions, RECORDABLE_BASES, rightsRecord, writeMediaDecisions,
  type MediaCandidate, type MediaDecision, type MediaRightsRecord, type RecordableBasis,
} from './media-request';

const HORIZON_DAYS = 21;
const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const BASIS_LABELS: Record<RecordableBasis, { zh: string; en: string }> = {
  permission: { zh: '主办方书面授权', en: 'Organizer’s written permission' },
  'press-kit': { zh: '主办方媒体包条款', en: 'Press-kit terms' },
  cc: { zh: 'CC 授权（近 8 年内拍摄）', en: 'Creative Commons licence (taken within 8 years)' },
  'public-domain': { zh: '公有领域（如美国联邦政府作品）', en: 'Public domain (e.g. US federal works)' },
};
const DECISION_LABELS: Record<MediaDecision['decision'], { zh: string; en: string }> = {
  requested: { zh: '已打开授权邮件', en: 'Permission email opened' },
  recorded: { zh: '已记录授权依据，等店主批准下载', en: 'Basis recorded; awaiting the owner’s download approval' },
  rejected: { zh: '已拒绝', en: 'Rejected' },
};

/**
 * Organiser images for listings in the next 21 days (content.md §4.3; RC-32). URLs only: no image is downloaded or shown
 * here, and none is published without `rights.basis`. Decisions stay in this browser (there is no API for them yet).
 */
export function MediaCandidateQueue({ today: suppliedToday }: { today?: string }) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const today = suppliedToday || contentReviewToday();
  const [candidates, setCandidates] = useState<MediaCandidate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, MediaDecision>>(readMediaDecisions);
  const [stored, setStored] = useState(true);
  const [show, setShow] = useState({ later: false, flagged: false, done: false });
  const [recording, setRecording] = useState<string | null>(null);
  // Decided in this visit: the card stays (with its record and Undo) until the next visit, whatever the filter.
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    let active = true;
    api.request('/admin/source-monitor/media-candidates').then(parseMediaCandidates, () => null).then(list => {
      if (!active) return;
      if (list) setCandidates(list); else setFailed(true);
    });
    return () => { active = false; };
  }, []);
  const horizon = addDays(today, HORIZON_DAYS);
  const visible = useMemo(() => (candidates || []).filter(candidate => (show.done || !decisions[decisionKey(candidate)] || touched.has(decisionKey(candidate)))
    && (show.flagged || !(candidate.likelyLogo || candidate.siteDefault))
    && (show.later || (!!candidate.nextDate && candidate.nextDate >= today && candidate.nextDate <= horizon))), [candidates, decisions, touched, show, today, horizon]);
  const decide = (candidate: MediaCandidate, decision: MediaDecision['decision'] | null, record?: MediaRightsRecord) => {
    setTouched(previous => new Set(previous).add(decisionKey(candidate)));
    setDecisions(previous => {
      const next = { ...previous };
      if (decision) next[decisionKey(candidate)] = { decision, at: new Date().toISOString(), ...(record ? { record } : {}) };
      else delete next[decisionKey(candidate)];
      setStored(writeMediaDecisions(next));
      return next;
    });
  };

  return <section className="media-queue" aria-labelledby="media-queue-title">
    <h2 id="media-queue-title">{t('主办方官方图片候选', 'Organizer image candidates')}</h2>
    <p className="source-monitor-note">{t(`来源监测从官方页面记下的图片网址（og:image），按活动日期排列，默认只看 ${HORIZON_DAYS} 天内的。这里不下载、不显示图片；没有授权依据（rights.basis）的图片不会上线。`,
      `Image URLs (og:image) the source monitor noted on official pages, by listing date; by default only the next ${HORIZON_DAYS} days. Nothing is downloaded or shown here, and no image goes live without a rights basis.`)}</p>
    <p className="source-monitor-note">{t('处理结果只保存在这台设备的浏览器里。记录授权依据后会复制一段记录，请交给内容编辑放进素材登记表，并由店主批准下载。', 'Decisions are kept in this browser only. Recording a basis copies a record: hand it to the content editor for the media register, for the owner to approve the download.')}</p>
    {!stored && <p role="alert" className="source-monitor-error">{t('这台设备无法保存处理结果（浏览器存储不可用）。', 'This browser cannot keep decisions (storage is unavailable).')}</p>}
    <div className="source-monitor-filters" role="group" aria-label={t('筛选候选图片', 'Filter candidates')}>
      <button type="button" aria-pressed={show.later} onClick={() => setShow(value => ({ ...value, later: !value.later }))}>{t('包括更晚或无日期的', 'Include later or undated')}</button>
      <button type="button" aria-pressed={show.flagged} onClick={() => setShow(value => ({ ...value, flagged: !value.flagged }))}>{t('包括疑似标志或全站默认图', 'Include likely logos and site defaults')}</button>
      <button type="button" aria-pressed={show.done} onClick={() => setShow(value => ({ ...value, done: !value.done }))}>{t('包括已处理的', 'Include handled')}</button>
    </div>
    {failed ? <p role="alert" className="source-monitor-error">{t('无法读取图片候选，请稍后重试。', 'Could not load image candidates. Please try again.')}</p>
      : !candidates ? <p role="status">{t('正在加载…', 'Loading…')}</p>
      : !visible.length ? <p className="source-monitor-empty">{t('当前筛选下没有待处理的图片候选。', 'No image candidates need attention in this filter.')}</p>
      : <div className="source-monitor-list">{visible.map(candidate => {
        const key = decisionKey(candidate), decision = decisions[key], image = imageOf(candidate);
        const listing = candidate.listings[0];
        return <article className="source-monitor-card media-candidate" key={key}>
          <div className="source-monitor-card-top">
            <div>
              <p className="source-monitor-chips"><span className="source-monitor-status">{candidate.nextDate || t('无日期', 'No date')}</span>
                {candidate.likelyLogo && <span className="source-monitor-field">{t('疑似标志', 'Likely logo')}</span>}
                {candidate.siteDefault && <span className="source-monitor-field">{t('全站默认图', 'Site default')}</span>}
                {decision && <span className="source-monitor-field">{t(DECISION_LABELS[decision.decision].zh, DECISION_LABELS[decision.decision].en)}</span>}</p>
              <h3 translate="no">{listing ? <a href={listing.path}>{translateText(listing.title, locale)}</a> : translateText(candidate.title, locale)}</h3>
              <p className="source-monitor-note">{t('图片网址：', 'Image URL: ')}<a href={image} target="_blank" rel="noopener noreferrer" className="media-candidate-url">{image}</a>
                {candidate.ogImageWidth && candidate.ogImageHeight ? ` · ${candidate.ogImageWidth}×${candidate.ogImageHeight}` : ''}</p>
              {candidate.ogImageAlt && <p className="source-monitor-note">{t('官方替代文字：', 'Official alt text: ')}<span translate="no">{candidate.ogImageAlt}</span></p>}
            </div>
            <a href={candidate.url} target="_blank" rel="noopener noreferrer">{t('查看官方页面', 'Open official page')} <ExternalLink size={16} aria-hidden="true" /></a>
          </div>
          <div className="source-monitor-actions">
            <a className="source-monitor-button" href={permissionMailto(candidate)} onClick={() => decide(candidate, 'requested')}><Mail size={16} aria-hidden="true" />{t('请求授权', 'Request permission')}</a>
            <button type="button" aria-expanded={recording === key} onClick={() => setRecording(value => value === key ? null : key)}><FileCheck size={16} aria-hidden="true" />{t('记录 PD·CC 依据', 'Record PD / CC basis')}</button>
            {decision ? <button type="button" onClick={() => decide(candidate, null)}><RotateCcw size={16} aria-hidden="true" />{t('撤销', 'Undo')}</button>
              : <button type="button" onClick={() => decide(candidate, 'rejected')}><Ban size={16} aria-hidden="true" />{t('拒绝', 'Reject')}</button>}
          </div>
          {recording === key && <RightsForm candidate={candidate} today={today} t={t} onRecorded={record => decide(candidate, 'recorded', record)} />}
          {decision?.record && recording !== key && <details className="source-monitor-evidence"><summary>{t('查看已记录的授权依据', 'View the recorded basis')}</summary><pre className="media-record">{JSON.stringify(decision.record, null, 2)}</pre></details>}
        </article>;
      })}</div>}
  </section>;
}

function RightsForm({ candidate, today, t, onRecorded }: { candidate: MediaCandidate; today: string; t: (zh: string, en: string) => string; onRecorded: (record: MediaRightsRecord) => void }) {
  const [basis, setBasis] = useState<RecordableBasis>('permission');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [scope, setScope] = useState(t('仅用于这场活动在 BAYLINK 的介绍页', 'Only beside this event’s own BAYLINK listing'));
  const [promoAllowed, setPromoAllowed] = useState(false);
  const [grantedAt, setGrantedAt] = useState('');
  const [result, setResult] = useState<{ text: string; copied: boolean } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const id = decisionKey(candidate).replace(/[^\w-]/gu, '-').slice(0, 80);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const record = rightsRecord(candidate, { basis, evidenceUrl, scope, promoAllowed, grantedAt: grantedAt || undefined }, today);
    setInvalid(!record);
    if (!record) return;
    const text = JSON.stringify(record, null, 2);
    let copied = false;
    try { await navigator.clipboard.writeText(text); copied = true; } catch { /* the record stays on screen to copy by hand */ }
    setResult({ text, copied });
    onRecorded(record);
  };
  return <form className="media-rights-form" onSubmit={event => void submit(event)}>
    <label htmlFor={`basis-${id}`}>{t('授权依据', 'Rights basis')}</label>
    <select id={`basis-${id}`} value={basis} onChange={event => setBasis(event.target.value as RecordableBasis)}>
      {RECORDABLE_BASES.map(value => <option key={value} value={value}>{t(BASIS_LABELS[value].zh, BASIS_LABELS[value].en)}</option>)}
    </select>
    <label htmlFor={`evidence-${id}`}>{t('证明网址（授权邮件存档、许可页或媒体包条款）', 'Evidence URL (permission archive, licence page or press-kit terms)')}</label>
    <input id={`evidence-${id}`} type="url" inputMode="url" required value={evidenceUrl} onChange={event => setEvidenceUrl(event.target.value)} placeholder="https://" />
    <label htmlFor={`scope-${id}`}>{t('使用范围', 'Where it may be used')}</label>
    <input id={`scope-${id}`} type="text" required maxLength={200} value={scope} onChange={event => setScope(event.target.value)} />
    {basis === 'permission' && <><label htmlFor={`granted-${id}`}>{t('授权日期', 'Date granted')}</label>
      <input id={`granted-${id}`} type="date" required value={grantedAt} onChange={event => setGrantedAt(event.target.value)} /></>}
    <label className="media-rights-check"><input type="checkbox" checked={promoAllowed} onChange={event => setPromoAllowed(event.target.checked)} />{t('也可用于分享卡和推广（仅当授权明确允许）', 'Also for share cards and promotion (only if the terms say so)')}</label>
    {invalid && <p role="alert" className="source-monitor-error">{t('请填写 https 开头的证明网址和使用范围；书面授权还需要授权日期。', 'Enter an https evidence URL and the scope; written permission also needs the date granted.')}</p>}
    <button type="submit" className="source-monitor-primary"><Copy size={16} aria-hidden="true" />{t('记录并复制', 'Record and copy')}</button>
    {result && <><p role="status" className="source-monitor-note">{result.copied ? t('已复制记录。请交给内容编辑。', 'Record copied. Hand it to the content editor.') : t('无法自动复制，请手动复制下面的记录。', 'Could not copy automatically; copy the record below by hand.')}</p><pre className="media-record">{result.text}</pre></>}
  </form>;
}
