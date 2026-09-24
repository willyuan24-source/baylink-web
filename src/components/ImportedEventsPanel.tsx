import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ImagePlus, MapPin } from 'lucide-react';
import { EventImportDialog } from './EventScreenshotImport';
import { useImportedEvents } from '../lib/useImportedEvents';
import { downloadImportedEvent, type ImportedEvent } from '../lib/imported-events';
import { todayInBay } from '../lib/planner';
import { translateText, useLocale } from '../i18n/locale';

export function ImportedEventsPanel({ userId }: { userId?: string }) {
  return <PrivateEvents key={userId || 'guest'} userId={userId} />;
}
function PrivateEvents({ userId }: { userId?: string }) {
  const library = useImportedEvents(userId); const locale = useLocale();
  const t = (text: string) => translateText(text, locale);
  const [editing, setEditing] = useState<ImportedEvent>(); const [removing, setRemoving] = useState('');
  const today = todayInBay();
  const upcoming = library.events.filter(event => event.date >= today).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  const past = library.events.filter(event => event.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const card = (event: ImportedEvent) => <article key={event.id} className="imported-event-card">
    <time dateTime={event.date} translate="no">{event.date}{event.startTime && ` · ${event.startTime}${event.endTime ? `–${event.endTime}` : ''}`}</time>
    <h3 translate="no">{event.title}</h3>
    {(event.venue || event.city || event.address) && <p translate="no"><MapPin size={15} />{[event.venue, event.address, event.city].filter(Boolean).join(' · ')}</p>}
    {event.price && <p translate="no">{event.price}</p>}
    <div className="imported-event-actions">
      <button type="button" onClick={() => downloadImportedEvent(event)}><CalendarDays size={15} />{t('存入日历')}</button>
      {(event.address || event.venue || event.city) && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([event.venue, event.address, event.city].filter(Boolean).join(', '))}`} target="_blank" rel="noopener noreferrer">{t('地图')} ↗</a>}
      {event.sourceUrl && <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer">{t('查看来源')} ↗</a>}
      <button type="button" disabled={library.busy} onClick={() => setEditing(event)}>{t('修改')}</button>
      <button type="button" className="event-remove" disabled={library.busy} onClick={() => setRemoving(event.id)}>{t('移除')}</button>
    </div>
    {removing === event.id && <div className="event-warning"><p>{t('从私人日程中移除这场活动？')}</p><div className="imported-event-actions"><button type="button" disabled={library.busy} onClick={() => void library.remove(event.id).then(success => { if (success) setRemoving(''); })}>{t('确认移除')}</button><button type="button" disabled={library.busy} onClick={() => setRemoving('')}>{t('保留')}</button></div></div>}
  </article>;
  return <section className="imported-events-panel">
    <div className="planner-section-head"><h2>{t('我导入的活动')}</h2><Link to="/plan?import=event"><ImagePlus size={16} />{t('再导入一张截图')}</Link></div>
    <p className="event-help">{t(userId ? '仅自己可见，活动信息以主办方最新说明为准。' : '仅保存在此浏览器，活动信息以主办方最新说明为准。')}</p>
    {library.loading ? <p role="status" className="event-help">{t('正在读取私人活动…')}</p> : <>
      {library.error ? <div className="event-error" role="alert"><p>{t(library.error)}</p><button type="button" disabled={library.busy} onClick={() => void library.refresh()}>{t('重新加载记录')}</button></div> : <>
        {!upcoming.length && <div className="imported-event-empty"><CalendarDays size={24} /><p>{t('把喜欢的活动截图放进来，日期、地点和日历提醒就能留在一起。')}</p></div>}
        <div className="week-plan-grid">{upcoming.map(card)}</div>
        {!!past.length && <details className="imported-events-past"><summary>{t('已结束的私人活动')} ({past.length})</summary><div className="week-plan-grid">{past.map(card)}</div></details>}
      </>}
    </>}
    {editing && <EventImportDialog key={editing.id} userId={userId} event={editing} onClose={() => setEditing(undefined)} />}
  </section>;
}
