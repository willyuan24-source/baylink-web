import { CalendarDays } from 'lucide-react';
import { useLocale } from '../i18n/locale';
import { useUiCopy } from './ui/ui-copy';
import { editionCoverageLabel } from '../lib/edition-label';
import { useBayAreaToday } from '../lib/useBayAreaToday';

// Its own module: GuideDetail imports it from here, so guide pages do not download the events column. `checkedAt` is the guide's
// content date (updatedAt), so it prints as 内容更新, never as a source check.
export function GuideEditionNotice({ editionMonth, startDate, throughDate, checkedAt, today: suppliedToday, offers = true }: { editionMonth: string; startDate?: string; throughDate?: string; checkedAt: string; today?: string; offers?: boolean }) {
  const today = useBayAreaToday(suppliedToday);
  const locale = useLocale();
  const { t } = useUiCopy();
  const archived = throughDate ? today > throughDate : today.slice(0, 7) > editionMonth;
  const label = editionCoverageLabel({ editionMonth, editionStartDate: startDate, editionThroughDate: throughDate }, locale);
  return <aside className={`bl-guide-edition-notice${archived ? ' bl-guide-edition-notice--archive' : ''}`} aria-label="攻略期次与内容日期">
    <CalendarDays size={21} aria-hidden="true" /><div><strong>{archived ? `往期攻略 · ${label}` : `${label} · 本期攻略`}</strong><p data-template-note="">{offers ? (archived ? '这篇攻略记录的是该期资料核对的优惠，不能当作实时优惠。活动可能已结束或条件已变更，领取前请查看品牌官网和门店说明。' : '这篇攻略按本期资料整理。优惠有领取条件与有效期，是否可领请以品牌官方页面和参与门店为准。') : (archived ? '这是按该期资料整理的出行攻略。最新活动、开放与预约安排，请查看文末官方来源。' : '这篇攻略供本期出行安排；出发前请通过文末官方来源确认开放、交通与预约。')}</p><span>{t('内容更新', 'Content updated')} <time dateTime={checkedAt}>{checkedAt}</time> · {t('日期按湾区当地时间判断', 'dates follow Bay Area time')}</span></div>
  </aside>;
}
