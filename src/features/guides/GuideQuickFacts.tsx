import { useMemo } from 'react';
import { useUiCopy } from '../../components/ui/ui-copy';
import type { Guide } from '../../data/guides';
import { linkifyPhones } from '../../lib/phone-links';
import { guideQuickFacts, quickFactIn, type QuickFact } from './guide-quick-facts';

/**
 * H08 (GR-03): "30 秒看懂" for a guide without an editorial record — up to three of the article's own sentences (guide-quick-facts.ts):
 * the first sourced fact, the first phone number as a tap-to-call chip, the first deadline or fee. Labelled 从本文整理; a row
 * with no translation in the reader's language is left out, and the card is not shown when no row is left.
 */
export function QuickFactsCard({ guide, facts }: { guide: Guide; facts: readonly QuickFact[] }) {
  const { t, locale } = useUiCopy();
  const rows = facts.flatMap(fact => { const row = quickFactIn(fact, guide, locale); return row ? [{ fact, ...row }] : []; });
  if (!rows.length) return null;
  const label = { fact: t('先知道', 'Key fact'), phone: t('打电话', 'Call'), deadline: t('日期与期限', 'Dates and deadlines'), fee: t('费用', 'Cost') };
  return <section className="gd-keyfacts" data-fallback="" aria-labelledby="gd-keyfacts-title">
    <h2 id="gd-keyfacts-title">{t('30 秒看懂', 'In 30 seconds')}<span className="gd-keyfacts__from">{t('从本文整理', 'From this guide')}</span></h2>
    <ol>{rows.map(({ fact, label: context, text }) => <li key={fact.kind}>
      <span className="gd-keyfacts__label">{label[fact.kind]}</span>
      {/* Who the sentence is about when it does not say so itself ("SMUHSD："): the label or body its text opens with. */}
      <span className="gd-keyfacts__value">{context && <span className="gd-keyfacts__context">{context}{t('：', ': ')}</span>}{linkifyPhones(text, { variant: 'inline' })}</span>
    </li>)}</ol>
    <a className="gd-keyfacts__sources" href="#guide-sources">{t('看文末官方来源', 'See the official sources')}</a>
  </section>;
}

/**
 * The fallback card of an article without an editorial record. Only the guides that can have one load this module, with
 * their record (guide-blocks.ts QuickFactsBlock); the rest of the guide pages never download the sentence rules.
 */
export function GuideQuickFacts({ guide, today }: { guide: Guide; today?: string }) {
  const facts = useMemo(() => guideQuickFacts(guide, today), [guide, today]);
  return facts.length ? <QuickFactsCard guide={guide} facts={facts} /> : null;
}
