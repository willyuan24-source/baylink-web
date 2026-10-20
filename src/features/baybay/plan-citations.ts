import { plannerWebCheckedDate } from '../../lib/planner-web-search';
import type { BayBayEvidence, BayBayPlanStop } from '../../lib/baybay-assistant';
import { bayBayPageKey } from './site-path';

/** The admission facts' page and a source's page are one page (origin, path without trailing slashes, query). */
const sameSourcePage = (left: string | undefined, right: string) => {
  if (!left) return false;
  try { const a = new URL(left), b = new URL(right); return a.origin === b.origin && a.pathname.replace(/\/+$/, '') === b.pathname.replace(/\/+$/, '') && a.search === b.search; }
  catch { return false; }
};

type Citation = { id: string; source: BayBayEvidence; priceSource?: BayBayEvidence };
/**
 * A stop's citations, one per source page (bayBayPageKey: www, trailing slashes and absolute or relative BAYLINK links
 * compare equal). When two ids name one page, the one that carries the admission evidence stays, so its stamp is not
 * lost. A citation that is the stop's own title link is dropped when another citation remains and it carries no
 * admission evidence (the live L07 stop 3 listed its own guide page again under the title).
 */
export function stopCitations(stop: BayBayPlanStop, sources: ReadonlyMap<string, BayBayEvidence>): Citation[] {
  const facts = stop.admissionFacts;
  const byPage = new Map<string, Citation>();
  for (const id of stop.sourceIds) {
    const source = sources.get(id);
    if (!source) continue;
    const priceSource = facts?.sourceIds.includes(id) && sameSourcePage(facts.sourceUrl, source.url) && plannerWebCheckedDate(facts.checkedAt)
      ? { ...source, checkedAt: facts.checkedAt, verification: facts.basis === 'page-read' ? 'page-read' as const : 'catalog' as const } : undefined;
    const key = bayBayPageKey(source.url), kept = byPage.get(key);
    if (!kept || (!kept.priceSource && priceSource)) byPage.set(key, { id, source, priceSource });
  }
  const own = stop.link ? bayBayPageKey(stop.link.href) : undefined;
  const all = [...byPage.entries()], others = all.filter(([key]) => key !== own);
  const repeat = all.find(([key]) => key === own)?.[1];
  return (repeat && !repeat.priceSource && others.length ? others : all).map(([, citation]) => citation);
}
