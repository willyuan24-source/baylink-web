import { getLocale } from '../i18n/locale';

const HAN = /[㐀-鿿]/;
const loadTable = () => import('../i18n/api-errors-en');

/**
 * English for the API's Chinese error messages on an English page (I18N-SEO-06): by the error code when the API sends
 * one, else by the exact message (i18n/api-errors-en.ts, loaded only when an English page shows an API error). Other
 * languages keep the message — 繁體 converts it on render like any other text — and so does an unknown message.
 */
export async function localizeApiMessage(message: string, code?: unknown): Promise<string> {
  if (getLocale() !== 'en' || !HAN.test(message)) return message;
  try {
    const { API_ERRORS_EN, API_ERROR_CODES_EN } = await loadTable();
    return (typeof code === 'string' && Object.hasOwn(API_ERROR_CODES_EN, code) ? API_ERROR_CODES_EN[code] : undefined)
      ?? (Object.hasOwn(API_ERRORS_EN, message.trim()) ? API_ERRORS_EN[message.trim()] : undefined) ?? message;
  } catch { return message; }
}

/** The same for an API error object's `error` and `message` fields (api.ts throws these). */
export async function localizeApiError<T>(error: T): Promise<T> {
  if (getLocale() !== 'en' || !error || typeof error !== 'object') return error;
  const record = error as Record<string, unknown>;
  const fields = (['error', 'message'] as const).filter(key => typeof record[key] === 'string' && HAN.test(record[key] as string));
  if (!fields.length) return error;
  const localized: Record<string, unknown> = { ...record };
  for (const key of fields) localized[key] = await localizeApiMessage(record[key] as string, record.code);
  return localized as T;
}
