import { ArrowUp } from 'lucide-react';
import { useUiCopy } from '../../components/ui/ui-copy';

/** Questions people ask BAYLINK, one per audience: a family outing, a parent's benefits, a newcomer's first week. */
const QUESTIONS = [
  { zh: '这周末带爸妈去哪，不用开车？', en: 'Where can we take my parents this weekend without a car?' },
  { zh: '家里长辈 65 岁以上，在湾区先了解哪些福利？', en: 'My parents are over 65. Which Bay Area benefits should we look into first?' },
  { zh: '刚搬来湾区，第一周先办哪几件事？', en: 'I just moved to the Bay Area. What should I take care of in the first week?' },
] as const;

/**
 * ⑤ 问 BayBay (G14, P06): a brand-deep band with the otter, the H2 and its AI 助手 tag, how it answers, and three one-tap
 * questions that open the panel and send. No sample answer: an answer is only real when BayBay gives it, with its sources.
 * Hidden in 简洁 (the tab bar's 问问 stays).
 */
export function BayBayDemoCard({ onAsk }: { onAsk: (question: string) => void }) {
  const { t } = useUiCopy();
  return <section className="home-baybay" aria-labelledby="home-baybay-title" data-simple="hide">
    <div className="home-baybay__head">
      <img src="/brand/otter.svg" alt="" width={48} height={48} decoding="async" loading="lazy" />
      <h2 id="home-baybay-title">{t('问 BayBay', 'Ask BayBay')}</h2><span className="home-ai">{t('AI 助手', 'AI assistant')}</span>
    </div>
    <p>{t('先给一句结论，再附站内来源和核对日期', 'A short answer first, then the sources on BAYLINK and when they were checked')}</p>
    <ul aria-label={t('可以这样问', 'Try asking')}>
      {QUESTIONS.map(question => <li key={question.zh}>
        <button type="button" onClick={() => onAsk(t(question.zh, question.en))}>{t(question.zh, question.en)}<ArrowUp aria-hidden="true" strokeWidth={1.75} /></button>
      </li>)}
    </ul>
  </section>;
}
