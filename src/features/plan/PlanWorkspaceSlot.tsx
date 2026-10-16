import { Suspense, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { useApp } from '../../app/context';
import { translateText, useLocale, type Locale } from '../../i18n/locale';
import { pathLanguage } from '../../lib/language-path';
import { ErrorState } from '../../components/ui/States';
import { SkeletonFeed } from '../../components/ui/SkeletonCard';
import { isPlanReady, isPlanWanted, planWantedAtOnce, readPlan, retryPlan, subscribePlanWanted, wantPlan } from './plan-catalog';
import { PlanDaysPreview } from './PlanDaysPreview';
import { guestPlanDays } from './guest-plans';
import { useOnline } from './use-online';

/**
 * Where 行程's workspace renders (WEB-PLAN-DATA): everything below the page header, in one element that adds no box
 * (`.planner-data-slot { display: contents }`), so the header renders at once and the workspace when the planner catalog
 * and the workspace's own chunk are in (plan-catalog.ts).
 *
 * H20 (WEB-PERF-3): a plain visit does not load them at boot. 已排的日子 renders first from this device's saved plans
 * (PlanDaysPreview), and the rest of the page is, at boot, the prerendered workspace of this very page (captured before the
 * app replaces it, as boot-main.ts keeps the prerendered page: no blank frame and no skeleton over content that is already
 * on screen). The workspace then loads on the reader's first interaction with the page (a tap, a key, a scroll, the
 * mouse), at idle when saved days need their stops' names (a guest's saved days, an account), and at once for a link that
 * opens a plan or a draft (`planWantedAtOnce`) or a tap on 问 BayBay. After an in-app navigation it loads at once, with
 * skeleton rows under the saved days meanwhile. A failed load shows the error state with 重试 (RC-25).
 */
let bootSlot: { html: string; locale: Locale } | null = captureBootSlot();

function captureBootSlot(): { html: string; locale: Locale } | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;
  const slot = document.querySelector<HTMLElement>('#root main[data-prerender-path="/plan"] [data-plan-slot]');
  if (!slot) return null;
  // 已排的日子 renders from this browser's saved plans (PlanDaysPreview), never as the prerender's empty list.
  const copy = slot.cloneNode(true) as HTMLElement;
  copy.querySelector('#plan-days')?.remove();
  const html = copy.innerHTML.trim();
  return html ? { html, locale: pathLanguage(window.location.pathname) } : null;
}

/** The prerendered workspace is shown once, while the first workspace of this page load is on its way. */
const forgetBootSlot = () => { bootSlot = null; };

function SlotFallback() {
  const locale = useLocale();
  const app = useApp();
  const boot = bootSlot && bootSlot.locale === locale ? bootSlot.html : null;
  return <div className="planner-data-slot" data-plan-slot="" aria-busy="true">
    <PlanDaysPreview signedIn={!!app?.user} />
    {boot ? <div className="planner-data-slot" dangerouslySetInnerHTML={{ __html: boot }} /> : <SkeletonFeed rows count={4} />}
  </div>;
}

/** Reads the catalog: suspends while it loads, shows the error state when it failed, else renders the workspace. */
function PlanCatalogGate({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const online = useOnline();
  const [, setAttempt] = useState(0);
  const { failed } = readPlan(locale);
  // The workspace or the error state is on screen: a later wait (a retry, a language switch) shows skeleton rows instead.
  useEffect(forgetBootSlot, []);
  if (!failed) return children;
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  return <div className="planner-data-slot" data-plan-slot="">
    {!online && <p className="planner-offline" role="status"><WifiOff size={18} aria-hidden="true" />{t('你现在离线：行程要联网后才能打开。', 'You are offline. Your plans open once you are back online.')}</p>}
    <ErrorState title={t('行程暂时没能加载', 'Your plans didn’t load')} onRetry={() => { retryPlan(locale); setAttempt(count => count + 1); }} />
  </div>;
}

/** What starts the workspace on a plain visit: the reader's first move on the page. */
const INTERACTIONS = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel', 'scroll', 'focusin'] as const;

type IdleWindow = Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };

/** Until then the slot shows the days-first preview and the prerendered workspace, and asks for the rest when the reader acts. */
function DeferredSlot({ idle }: { idle: boolean }) {
  useEffect(() => {
    const options = { capture: true, passive: true } as const;
    for (const type of INTERACTIONS) window.addEventListener(type, wantPlan, options);
    // Saved days (or an account's) need the catalog for their stops' names and covers: load them when the page is idle.
    const idleWindow = window as IdleWindow;
    const useIdle = !!idleWindow.requestIdleCallback && !!idleWindow.cancelIdleCallback;
    const timer = !idle ? undefined : useIdle ? idleWindow.requestIdleCallback!(wantPlan, { timeout: 2000 }) : window.setTimeout(wantPlan, 1000);
    return () => {
      for (const type of INTERACTIONS) window.removeEventListener(type, wantPlan, options);
      if (timer !== undefined) { if (useIdle) idleWindow.cancelIdleCallback!(timer); else window.clearTimeout(timer); }
    };
  }, [idle]);
  return <SlotFallback />;
}

export function PlanWorkspaceSlot({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const app = useApp();
  const { search } = useLocation();
  const wanted = useSyncExternalStore(subscribePlanWanted, isPlanWanted, () => true);
  // Leaving the page: a later visit shows skeleton rows, never this page load's snapshot.
  useEffect(() => forgetBootSlot, []);
  // Only the first page of a visit waits for the reader, with the prerendered workspace on screen; after an in-app move to
  // 行程 (a tap that already asked for it) the workspace loads at once.
  if (!wanted && bootSlot?.locale === locale && !isPlanReady(locale) && !planWantedAtOnce(search)) return <DeferredSlot idle={!!app?.user || guestPlanDays().length > 0} />;
  return <Suspense fallback={<SlotFallback />}><PlanCatalogGate>{children}</PlanCatalogGate></Suspense>;
}
