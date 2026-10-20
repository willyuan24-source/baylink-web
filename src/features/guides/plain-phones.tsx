import { Fragment } from 'react';
import { translateText, useLocale } from '../../i18n/locale';
import { linkifyGuidePhones, usePlainPhones } from './plain-phone-text';

/** PhoneText for a guide: the reader's language, tap-to-call chips, except the numbers the page's 简洁 provider keeps as text. */
export function GuidePhoneText({ text }: { text: string }) {
  const locale = useLocale();
  const except = usePlainPhones();
  return <Fragment>{linkifyGuidePhones(translateText(text, locale), { except })}</Fragment>;
}
