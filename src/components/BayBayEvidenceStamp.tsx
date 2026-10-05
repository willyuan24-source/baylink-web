import { translateText, useLocale } from '../i18n/locale';
import type { BayBayEvidence } from '../lib/baybay-assistant';
import { plannerWebCheckedDate } from '../lib/planner-web-search';

/** A source's retrieval method/date does not promise current availability. */
export function BayBayEvidenceStamp({ source }: { source?: BayBayEvidence }) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  if (!source) return null;
  const day = plannerWebCheckedDate(source.checkedAt);
  const method = source.verification === 'catalog' ? t('资料快照', 'Catalog snapshot')
    : source.verification === 'page-read' ? t('网页读取', 'Page read')
      : source.verification === 'api' ? t('接口获取', 'API retrieved')
        : source.verification === 'search-result' ? t('搜索线索（未读正文）', 'Search lead (page not read)')
          : day ? t('资料日期', 'Source date') : null;
  return method ? <small>{method}{day && ` · ${day}`}{day && source.checkedAt?.length !== 10 && t('（湾区日期）', ' (Bay Area date)')}</small> : null;
}
