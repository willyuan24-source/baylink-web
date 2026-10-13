import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { WifiOff } from 'lucide-react';
import { translateText, useLocale, type Locale } from '../../i18n/locale';
import { pathLanguage } from '../../lib/language-path';
import { ErrorState } from '../../components/ui/States';
import { SkeletonFeed } from '../../components/ui/SkeletonCard';
import { readPlan, retryPlan } from './plan-catalog';
import { useOnline } from './use-online';

/**
 * Where 行程's workspace renders (WEB-PLAN-DATA): everything below the page header, in one element that adds no box
 * (`.planner-data-slot { display: contents }`), so the header renders at once and the workspace when the planner catalog
 * is in (plan-catalog.ts).
 *
 * While the catalog loads, the slot shows, at boot, the prerendered workspace of this very page (captured before the app
 * replaces it, as boot-main.ts keeps the prerendered page: no blank frame and no skeleton over content that is already on
 * screen), and after an in-app navigation, skeleton rows. A failed load shows the error state with 重试 (RC-25).
 */
let bootSlot: { html: string; locale: Locale } | null = captureBootSlot();

function captureBootSlot(): { html: string; locale: Locale } | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;
  const html = document.querySelector<HTMLElement>('#root main[data-prerender-path="/plan"] [data-plan-slot]')?.innerHTML.trim();
  return html ? { html, locale: pathLanguage(window.location.pathname) } : null;
}

/** The prerendered workspace is shown once, while the first workspace of this page load is on its way. */
const forgetBootSlot = () => { bootSlot = null; };

function SlotFallback() {
  const locale = useLocale();
  if (bootSlot && bootSlot.locale === locale) return <div className="planner-data-slot" data-plan-slot="" aria-busy="true" dangerouslySetInnerHTML={{ __html: bootSlot.html }} />;
  return <div className="planner-data-slot" data-plan-slot=""><SkeletonFeed rows count={4} /></div>;
}

/** Reads the catalog: suspends while it loads, shows the error state when it failed, else renders the workspace. */
function PlanCatalogGate({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const online = useOnline();
  const [, setAttempt] = useState(0);
  const { failed } = readPlan(locale);
  useEffect(() => { if (!failed) forgetBootSlot(); }, [failed]);
  if (!failed) return children;
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  return <div className="planner-data-slot" data-plan-slot="">
    {!online && <p className="planner-offline" role="status"><WifiOff size={18} aria-hidden="true" />{t('你现在离线：行程要联网后才能打开。', 'You are offline. Your plans open once you are back online.')}</p>}
    <ErrorState title={t('行程暂时没能加载', 'Your plans didn’t load')} onRetry={() => { retryPlan(locale); setAttempt(count => count + 1); }} />
  </div>;
}

export function PlanWorkspaceSlot({ children }: { children: ReactNode }) {
  // Leaving the page: a later visit shows skeleton rows, never this page load's snapshot.
  useEffect(() => forgetBootSlot, []);
  return <Suspense fallback={<SlotFallback />}><PlanCatalogGate>{children}</PlanCatalogGate></Suspense>;
}
