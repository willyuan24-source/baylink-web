import { Check } from 'lucide-react';
import { useUiCopy } from '../../components/ui/ui-copy';
import type { FreebieOffer } from '../../components/FreebieBoard';
import { readerSentences } from './reader-text';
import { PhoneLinked } from './ReaderText';

/**
 * An offer's two answers (design.md §4.9; the SFMTA 65+ template): "先看领取条件" as a checklist, one condition per line,
 * then "怎么领 · 怎么用" as numbered steps. Both come from the listing's own reviewed text, split by sentence in the
 * reader's language, with tap-to-call numbers; no generic "以官方为准" line (CNT-1011-06): the source row says that.
 */
export function BenefitSteps({ offer }: { offer: FreebieOffer }) {
  const { t, locale } = useUiCopy();
  const conditions = readerSentences(offer.requirement, locale);
  const steps = readerSentences(offer.description, locale);
  return <>
    {conditions.length > 0 && <section className="detail-conditions" aria-labelledby="offer-conditions-title">
      <h2 id="offer-conditions-title">{t('先看领取条件', 'Check who qualifies')}</h2>
      <ul>{conditions.map(line => <li key={line}><Check aria-hidden="true" strokeWidth={2} /><p><PhoneLinked text={line} /></p></li>)}</ul>
    </section>}
    {steps.length > 0 && <section className="detail-steps" aria-labelledby="offer-steps-title">
      <h2 id="offer-steps-title">{t('怎么领 · 怎么用', 'How to get and use it')}</h2>
      <ol>{steps.map((line, index) => <li key={line}><span aria-hidden="true">{index + 1}</span><p><PhoneLinked text={line} /></p></li>)}</ol>
    </section>}
  </>;
}
