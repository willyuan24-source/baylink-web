import { CalendarCheck } from 'lucide-react';
import { translateText, useLocale } from '../i18n/locale';
import { eventFor, placeFor, sharePlanUrl, stopPath, stopTitle, type SavedPlan } from '../lib/planner';
import type { usePlannerLibrary } from '../lib/planner-library';
import { recordProductEvent } from '../lib/product-events';
import { eventOccursOn } from '../lib/event-calendar';
import type { ResolvedCover } from '../lib/cover';
import { planDisplayTitle } from '../features/saves/plan-title';
import { Button } from './ui/Button';
import { RowCard } from './ui/Card';
import { StatusChip } from './ui/Badges';
import { EmptyState, ErrorState } from './ui/States';
import { SkeletonFeed } from './ui/SkeletonCard';
import { PlannerStopThumb } from './PlannerStopCover';
import { planDayLabel } from '../lib/plan-stop-cover';

const PLACE_KIND = { attraction: ['景点', 'Place'], restaurant: ['餐饮', 'Dining'], cafe: ['咖啡与小食', 'Coffee'], shop: ['商店', 'Shop'] } as const;

/**
 * 已排的日子 (行程, plan T13 + FC3-01): every upcoming saved plan — made here, by 加入这天计划 (the events calendar on
 * this base; home and detail pages save into the same plans as they gain the action), or by BayBay — one day per group,
 * each stop a RowCard with its cover and the plan's date. An event that does not run on the plan's day says so. Loading,
 * API failure and the empty state use the WEB-UI primitives (RC-25); the page shows the offline line above.
 */
export function PlannerDayPlans({ library, plans, covers, today, editingId }: { library: ReturnType<typeof usePlannerLibrary>; plans: readonly SavedPlan[]; covers: readonly ResolvedCover[]; today: string; editingId?: string }) {
  const locale = useLocale();
  const english = locale === 'en';
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  const coverFor = (plan: SavedPlan, index: number) => covers[plans.slice(0, plans.indexOf(plan)).reduce((sum, item) => sum + item.stops.length, 0) + index];
  const days = [...new Set(plans.map(plan => plan.date))];
  return <section id="plan-days" className="plan-days" aria-labelledby="plan-days-title" data-testid="plan-days">
    <div className="plan-section-head"><h2 id="plan-days-title">{t('已排的日子', 'Planned days')}</h2>{plans.length > 0 && <Button variant="text" to="/my-week#plans">{t('在我的这周查看', 'See them in My Week')}</Button>}</div>
    {library.loading ? <SkeletonFeed rows count={2} />
      : !library.ready && library.error ? <ErrorState headingLevel="h3" homeTo={null} onRetry={() => void library.refresh()} title={t('暂时读不到已排的日子', 'Your planned days didn’t load')}
        body={t('可能是网络不稳或服务繁忙。已保存的行程不会因此消失。', 'The connection or our service may be busy. Your saved plans are not lost.')} />
        : !plans.length ? <EmptyState headingLevel="h3" icon={CalendarCheck} title={t('还没有排好的日子', 'No days planned yet')}
          body={t('把活动加入某一天的计划（比如在活动日历点「加入这天计划」），那一天就会出现在这里；也可以在下面挑一个地点开始。', 'Add an event to a day’s plan (for example with “Add to this day’s plan” on the events calendar) and that day appears here. Or start from a place below.')}
          actions={<Button variant="tonal" to="/events">{t('看本周末活动', 'See this weekend’s events')}</Button>} />
          : <ol className="plan-days__list">{days.map(date => <li key={date} id={`plan-day-${date}`} className="plan-days__day">
            <p className="plan-days__date"><time dateTime={date}>{planDayLabel(date, english)}</time></p>
            {plans.filter(plan => plan.date === date).map(plan => {
              const shown = planDisplayTitle(plan.title, locale);
              return <article key={plan.id} className="plan-days__plan" aria-label={shown.text}>
                <div className="plan-days__plan-head">
                  <h3 translate={shown.auto ? undefined : 'no'}>{shown.text}</h3>
                  {plan.id === editingId && <StatusChip tone="info">{t('正在编辑', 'Editing')}</StatusChip>}
                </div>
                <ul className="plan-days__stops" aria-label={t('这一天的站点', 'Stops this day')}>{plan.stops.map((stop, index) => {
                  const event = stop.kind === 'event' ? eventFor(stop.id) : undefined;
                  const place = stop.kind === 'place' ? placeFor(stop.id) : undefined;
                  const path = stopPath(stop);
                  const external = /^https?:/.test(path);
                  const kind = place ? PLACE_KIND[place.category ?? 'attraction'] : undefined;
                  const meta = event ? [event.city, event.costLabel] : [place?.city, kind ? t(kind[0], kind[1]) : undefined];
                  return <li key={`${stop.kind}:${stop.id}`}>
                    <RowCard title={translateText(stopTitle(stop), locale)} {...(external ? { href: path } : { to: path })} heading="h4"
                      thumb={<PlannerStopThumb stop={stop} cover={coverFor(plan, index)} today={today} day={date} />}
                      date={<>{t(`第 ${index + 1} 站`, `Stop ${index + 1}`)}{event && !eventOccursOn(event, date) && <> <StatusChip tone="warning">{t('不在这一天', 'Not on this day')}</StatusChip></>}</>}
                      meta={meta.filter(Boolean).map(part => translateText(part!, locale)).join(' · ')} />
                  </li>;
                })}</ul>
                <div className="plan-days__actions">
                  <Button variant="secondary" to={`/plan?edit=${encodeURIComponent(plan.id)}`}>{t('打开这一天', 'Open this day')}</Button>
                  <Button variant="text" href={sharePlanUrl(plan)} onClick={() => recordProductEvent('plan_shared')}>{t('分享版', 'Shareable version')}</Button>
                </div>
              </article>;
            })}
          </li>)}</ol>}
  </section>;
}
