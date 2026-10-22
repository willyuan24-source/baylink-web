import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useApp } from '../app/context';
import { useLocale, translateText } from '../i18n/locale';
import { setPageMetadata } from '../lib/seo';
import { PLAN_METADATA } from '../lib/planner-core';
import { createCoverPage, type ResolvedCover } from '../lib/cover';
import { Button } from '../components/ui/Button';
import { PageContainer, PageHeader } from '../components/ui/PageHeader';
import { PlanWorkspaceSlot } from '../features/plan/PlanWorkspaceSlot';
import { PlanWeekendPicks } from '../features/plan/PlanWeekendPicks';
import { loadPlan, opensPlan, planLoadFailed, PlanWorkspace } from '../features/plan/plan-catalog';
// The page's own layout. The planner's panels, the screenshot import and the BayBay hand-off notes are global CSS
// (main.tsx), before tokens.css's .planner-page reading scale, as the prerendered workspace needs them.
import '../styles/plan-page.css';

export default function PlannerPage() {
  const app = useApp();
  // Drafts, inferred preferences and in-flight searches belong to one account.
  return <PlannerShell key={app?.user?.id || 'guest'} />;
}

/**
 * 行程's header renders at once (WEB-PLAN-DATA); the workspace below it reads the planner catalog, which loads after the
 * first paint (features/plan). The workspace reports the library's busy state (the whole page is one fieldset, disabled
 * while a save runs) and its 问 BayBay draft; a tap on 问 BayBay before the workspace is in opens BayBay as soon as it is.
 */
function PlannerShell() {
  const app = useApp();
  const locale = useLocale();
  useEffect(() => { setPageMetadata(PLAN_METADATA); }, [locale]);
  const [busy, setBusy] = useState(false);
  // H54: this weekend's picks open a plain visit; a plan with stops (a link that opens one, or the first stop chosen) puts
  // 这一天的安排 first instead (FC3-01).
  const { search } = useLocation();
  // The first frame already knows: a link with stops (or a saved plan or a BayBay plan to open) hides the strip at once; a
  // question link (?q=, ?baybayBrief=) keeps it, as its workspace opens the form, not a plan.
  const [planOpen, setPlanOpen] = useState(() => opensPlan(search));
  // One cover registry for the page: a photo the picks show is not shown again in the workspace below (VISUAL-10).
  const coverPage = useMemo(() => createCoverPage(), []);
  // The picks' pictures, listed first in the workspace's 本页图片来源 (every picture on the page is credited, DECISIONS 23).
  const [pickCovers, setPickCovers] = useState<readonly ResolvedCover[]>([]);
  // 问 BayBay with the current plan, once the workspace is in; a tap before that waits for it.
  const askPlan = useRef<{ ask?: () => void; waiting: boolean }>({ waiting: false });
  const registerAsk = useCallback((ask?: () => void) => {
    askPlan.current.ask = ask;
    if (ask && askPlan.current.waiting) { askPlan.current.waiting = false; ask(); }
  }, []);
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  // Without the catalog (offline, a lost chunk) there is no plan to describe: BayBay opens with the general draft.
  const askGeneral = () => app?.openBayBay?.(t('帮我排一天湾区出游：', 'Help me plan a day out in the Bay Area: '), { mode: 'draft' });
  const ask = () => {
    if (askPlan.current.ask) { askPlan.current.ask(); return; }
    if (planLoadFailed(locale)) { askGeneral(); return; }
    askPlan.current.waiting = true;
    loadPlan(locale).catch(() => { if (askPlan.current.waiting) { askPlan.current.waiting = false; askGeneral(); } });
  };
  return <PageContainer size="wide" className="planner-page"><fieldset className="planner-interaction-scope" disabled={busy}>
    <PageHeader title={t('行程', 'Plans')}
      lede={t('把想去的活动和地点排进一天：时间、门票和路线一起看，存好后发给家人。', 'Put the events and places you want into one day, with times, tickets and routes in view. Save it and send it to family.')}
      actions={<><Button variant="primary" icon={<Sparkles size={18} aria-hidden="true" />} onClick={ask}>{t('问 BayBay 排一天', 'Ask BayBay to plan a day')}</Button><Button variant="text" to="/my-week">{t('我的这周', 'My Week')}</Button></>} />
    {!planOpen && <PlanWeekendPicks coverPage={coverPage} onCovers={setPickCovers} />}
    <PlanWorkspaceSlot><PlanWorkspace onBusy={setBusy} registerAsk={registerAsk} onPlanOpen={setPlanOpen} coverPage={coverPage} creditsFirst={planOpen ? undefined : pickCovers} /></PlanWorkspaceSlot>
  </fieldset></PageContainer>;
}
