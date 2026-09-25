import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { ArrowRight, Award, Check, Compass, Navigation, Sparkles, X } from 'lucide-react';
import { translateText, type Locale } from '../../i18n/locale';
import { adventureCount, BAY_ADVENTURES, type AdventureText } from './bay-adventures';
import type { useBayAdventures } from './useBayAdventures';
import { useUnifiedDialog } from './useUnifiedDialog';

export type BayAdventureJournalProps = {
  locale: Locale; adventure: ReturnType<typeof useBayAdventures>; nearKey: string | null;
  onNavigate: (key: string) => void; onClose: () => void;
};

export default function BayAdventureJournal({ locale, adventure, nearKey, onNavigate, onClose }: BayAdventureJournalProps) {
  const titleId = useId(), activeTitle = useRef<HTMLHeadingElement>(null);
  const { panel, closeButton, onKeyDown } = useUnifiedDialog(onClose);
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const text = (value: AdventureText) => t(value.zh, value.en);
  const { progress, activeQuest, nextKey } = adventure;
  const count = activeQuest ? adventureCount(progress, activeQuest) : 0;
  const currentStep = activeQuest?.steps[count], lastStep = activeQuest?.steps[count - 1];
  const completed = BAY_ADVENTURES.filter(quest => adventureCount(progress, quest) === quest.steps.length);
  const currentView = `${activeQuest?.id}:${count}`, previousView = useRef(currentView);
  useEffect(() => {
    if (previousView.current !== currentView) activeTitle.current?.focus({ preventScroll: true });
    previousView.current = currentView;
  }, [currentView]);
  const navigate = (key: string) => { onNavigate(key); onClose(); };

  return <div className="unified-dialog-backdrop" onPointerDown={event => event.stopPropagation()} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={panel} className="unified-dialog bay-adventure-journal" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown} onKeyUp={event => event.stopPropagation()}>
      <button ref={closeButton} type="button" className="unified-dialog-close" aria-label={t('关闭旅行任务', 'Close travel adventures')} onClick={onClose}><X size={20} /></button>
      <div className="unified-dialog-eyebrow"><Compass size={15} />BAYBAY’S BAY JOURNAL</div>
      <h3 id={titleId}>{t('把湾区连成一段故事', 'One Bay, many little stories')}</h3>
      <p className="bay-adventure-intro">{t('选一条路线，跟着导航走近每一站，再亲手收下回忆。', 'Pick a trail, follow the route to each stop and collect a memory when you arrive.')}</p>
      <div className="bay-adventure-badges" aria-label={t('旅行徽章', 'Adventure badges')}>
        <span><Award size={18} /><b>{completed.length}</b> / {BAY_ADVENTURES.length} {t('枚徽章', 'badges')}</span>
        {completed.map(quest => <span key={quest.id} className="bay-adventure-earned" title={text(quest.badge)}><i aria-hidden="true">{quest.symbol}</i>{text(quest.badge)}</span>)}
      </div>

      {activeQuest && <section className={`bay-adventure-active${!nextKey ? ' is-complete' : ''}`} style={{ '--adventure-accent': activeQuest.color } as CSSProperties}>
        <div className="bay-adventure-active-heading"><span className="bay-adventure-symbol" aria-hidden="true">{activeQuest.symbol}</span><div><span className="unified-dialog-eyebrow">{nextKey ? t('正在进行', 'ON YOUR TRAIL') : t('旅程完成', 'TRAIL COMPLETE')}</span><h4 ref={activeTitle} tabIndex={-1}>{text(activeQuest.title)}</h4></div><strong>{count}/{activeQuest.steps.length}</strong></div>
        <ol className="bay-adventure-stops">{activeQuest.steps.map((step, index) => <li key={step.key} className={index < count ? 'is-collected' : index === count ? 'is-next' : ''}>
          <span className="bay-adventure-step-number" aria-hidden="true">{index < count ? <Check size={14} /> : index + 1}</span>
          <div><strong>{text(step.title)}</strong><small>{index < count ? t('已收集', 'Collected') : index === count ? t('下一站', 'Next stop') : t('之后前往', 'Later on the trail')}</small>{!nextKey && index < count && <p className="bay-adventure-saved-memory">{text(step.memory)}</p>}</div>
          {index === count && <button type="button" onClick={() => navigate(step.key)} aria-label={t(`导航到${step.title.zh}`, `Navigate to ${step.title.en}`)}><Navigation size={16} /></button>}
        </li>)}</ol>
        <div className="bay-adventure-arrival" aria-live="polite" aria-atomic="true">
          {lastStep && nextKey && <p className="bay-adventure-memory"><Sparkles size={15} /><span>{text(lastStep.memory)}</span></p>}
          {currentStep && <p>{nearKey === nextKey ? t('你已经走到这一站了，留下这次小小的回忆。', 'You have reached this stop. Collect your little memory.') : t('先跟着地图路线走近下一站，到达后就能收集。', 'Follow the map route to the next stop, then collect your memory.')}</p>}
          {!nextKey && <p className="bay-adventure-complete"><Award size={24} /><strong>{text(activeQuest.badge)}</strong><span>{t('这枚徽章已放进你的旅行册。', 'This badge is now in your Bay journal.')}</span></p>}
        </div>
        <div className="bay-adventure-active-actions">
          {currentStep && <>
            <button type="button" className="unified-button unified-button--primary" disabled={nearKey !== nextKey} onClick={() => adventure.checkIn(nearKey)}><Sparkles size={16} />{text(currentStep.action)}</button>
            {nearKey !== nextKey && <button type="button" className="unified-button" onClick={() => navigate(currentStep.key)}><Navigation size={16} />{t('带我去下一站', 'Route to the next stop')}</button>}
          </>}
          <button type="button" className="bay-adventure-pause" onClick={() => { adventure.cancel(); closeButton.current?.focus(); }}>{nextKey ? t('稍后继续', 'Save for later') : t('再选一段旅程', 'Choose another trail')}</button>
        </div>
      </section>}

      <div className="bay-adventure-choices">{BAY_ADVENTURES.filter(quest => quest.id !== activeQuest?.id).map(quest => {
        const collected = adventureCount(progress, quest), done = collected === quest.steps.length;
        return <article key={quest.id} className="bay-adventure-card" style={{ '--adventure-accent': quest.color } as CSSProperties}>
          <span className="bay-adventure-symbol" aria-hidden="true">{quest.symbol}</span>
          <div><h4>{text(quest.title)}</h4><p>{text(quest.description)}</p><small>{done ? text(quest.badge) : t(`${quest.steps.length} 站探索`, `${quest.steps.length} stops`)}{collected > 0 && !done && ` · ${collected}/${quest.steps.length}`}</small></div>
          <button type="button" className="unified-button" onClick={() => adventure.accept(quest.id)}>{done ? <Award size={15} /> : <ArrowRight size={15} />}{done ? t('查看回忆', 'View memories') : collected ? t('继续旅程', 'Continue trail') : t('开始旅程', 'Start trail')}</button>
        </article>;
      })}</div>
      <p className="bay-adventure-note">{adventure.persistent ? t('进度保存在当前浏览器。旅行章与徽章是游戏纪念，不代表现实到访或实物奖励。', 'Progress is saved in this browser. Stamps and badges are game keepsakes, not proof of real visits or physical prizes.') : t('浏览器暂时无法保存，进度仅保留在本次打开期间。徽章为游戏纪念。', 'Browser storage is unavailable; progress lasts for this session only. Badges are game keepsakes.')}</p>
    </section>
  </div>;
}
