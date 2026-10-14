import { Fragment, type ReactNode } from 'react';
import { PhoneChip } from '../../lib/phone-links';
import { phoneDirectoryOf, type PhoneDirectoryEntry } from '../../lib/phone-numbers';
import { translateText, useLocale, type Locale } from '../../i18n/locale';

/** Bay Area counties as Chinese readers name them (the county AAA lines in the senior guide list them in English). */
const COUNTIES: readonly { zh: string; en: string }[] = [
  { zh: '旧金山', en: 'San Francisco' }, { zh: '圣马特奥', en: 'San Mateo' }, { zh: '圣克拉拉', en: 'Santa Clara' }, { zh: '阿拉米达', en: 'Alameda' },
  { zh: '康特拉科斯塔', en: 'Contra Costa' }, { zh: '马林', en: 'Marin' }, { zh: '索诺玛', en: 'Sonoma' }, { zh: '纳帕', en: 'Napa' },
  { zh: '索拉诺', en: 'Solano' }, { zh: '圣克鲁兹', en: 'Santa Cruz' },
];

/** "Napa/Solano" → "纳帕／索拉诺"; null when any part is not a county we name (the label then stays as written). */
function countyNameZh(label: string): string | null {
  const parts = label.split('/').map(part => COUNTIES.find(county => county.en === part.trim())?.zh);
  return parts.every(Boolean) ? parts.join('／') : null;
}

function Label({ label, locale }: { label: string; locale: Locale }) {
  const zh = locale === 'en' ? null : countyNameZh(label);
  if (!zh) return <span className="phone-directory-label">{label}</span>;
  return <span className="phone-directory-label gd-county"><span className="gd-county__zh">{translateText(zh, locale)}</span><span className="gd-county__en" lang="en" translate="no">{label}</span></span>;
}

/**
 * A guide's county number lists as one grid (phone-links' PhoneDirectory) with the county in Chinese and its English name on a
 * second line (H64, GR-08); below 420 px it is one column (guide-article.css). Any other list renders as given.
 */
export function GuidePhoneDirectoryOr({ items, children }: { items: string[]; children: ReactNode }) {
  const locale = useLocale();
  const entries: PhoneDirectoryEntry[] | null = phoneDirectoryOf(items, locale);
  if (!entries) return <Fragment>{children}</Fragment>;
  return <ul className="phone-directory gd-phone-directory">
    {entries.map(entry => <li key={`${entry.label}-${entry.tel}`}>
      <Label label={entry.label} locale={locale} />
      <PhoneChip number={entry.number} tel={entry.tel} name={locale === 'en' ? entry.label : translateText(countyNameZh(entry.label) ?? entry.label, locale)} variant="block" />
    </li>)}
  </ul>;
}
