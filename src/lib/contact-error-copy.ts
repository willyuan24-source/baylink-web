import { getLocale, type Locale } from '../i18n/locale';

const messages = {
  CONTACT_DAILY_LIMIT: {
    'zh-Hans': '该账号或已验证手机号今日联系请求已达上限，请明天再试。',
    'zh-Hant': '此帳號或已驗證手機號碼今日的聯絡請求已達上限，請明天再試。',
    en: 'This account or verified phone number has reached today’s contact request limit. Please try again tomorrow.',
  },
  CONTACT_QUOTA_UNAVAILABLE: {
    'zh-Hans': '暂时无法确认联系请求额度，请稍后重试。',
    'zh-Hant': '暫時無法確認聯絡請求額度，請稍後重試。',
    en: 'We can’t confirm your contact request allowance right now. Please try again later.',
  },
} as const;
type ContactQuotaCode = keyof typeof messages;

const knownCode = (value: unknown): value is ContactQuotaCode => typeof value === 'string' && Object.hasOwn(messages, value);

/** Only known public messages bypass the generic suppression of server errors. */
export function contactQuotaErrorMessage(error: unknown, locale: Locale = getLocale()): string | undefined {
  const record = error && typeof error === 'object' ? error as { code?: unknown; error?: unknown; message?: unknown } : undefined;
  if (knownCode(record?.code)) return messages[record.code][locale];
  const raw = typeof error === 'string' ? error.trim() : typeof record?.error === 'string' ? record.error.trim() : typeof record?.message === 'string' ? record.message.trim() : '';
  if (knownCode(raw)) return messages[raw][locale];
  // Older servers returned the public Chinese limit message without a code.
  if (raw === '今日联系方式请求次数已达上限。') return messages.CONTACT_DAILY_LIMIT[locale];
  for (const code of Object.keys(messages) as ContactQuotaCode[]) {
    if (Object.values(messages[code]).some(message => raw === message)) return messages[code][locale];
  }
  return undefined;
}
