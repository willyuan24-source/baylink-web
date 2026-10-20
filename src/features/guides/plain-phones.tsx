import { createContext, Fragment, useContext } from 'react';
import { translateText, useLocale } from '../../i18n/locale';
import { linkifyPhones } from '../../lib/phone-links';

/**
 * 简洁显示 on a guide (UI9-GUIDES): each number keeps at most two tap targets — the bar's 拨打 and its contact's — so the other
 * copies on the page (30 秒看懂, step conclusions, prose, sources, diagrams) print as text (linkifyPhones' `except`). Guide-only,
 * so no other route carries it; without a provider every number is a chip as before.
 */
const PlainPhones = createContext<ReadonlySet<string> | undefined>(undefined);
export const PlainPhonesProvider = PlainPhones.Provider;
/** The tel numbers that print as text here; undefined outside a provider. */
export const usePlainPhones = () => useContext(PlainPhones);

/** PhoneText for a guide: the reader's language, tap-to-call chips, except the numbers the page's 简洁 provider keeps as text. */
export function GuidePhoneText({ text }: { text: string }) {
  const locale = useLocale();
  const except = usePlainPhones();
  return <Fragment>{linkifyPhones(translateText(text, locale), { except })}</Fragment>;
}
