/**
 * The lime phrase of a guide cover's hook (UI9-C, G19; guide-hook-highlight.ts holds the listed phrases and the card logic).
 * These run on the guide cards' hook lines and at generate time.
 */
// A fee ($46, $6.50), a phone number (800-510-2020, 1‑800‑434‑0222 with kept hyphens), a share (62.5%) or a number with its
// unit (21 天, 40 个工作积分, 5 years, 10/26–27). The unit is one CJK word or one English word, so the phrase stays short.
const NUMBER_RUN = /\$\s?\d[\d,.]*|(?:1[-‑])?\d{3}[-‑]\d{3}[-‑]\d{4}|\d+(?:[.,/:–-]\d+)*\s?(?:%|[个項项条條次天周週月年岁歲小时分钟元人张張份步]+|(?:days?|weeks?|months?|years?|hours?|minutes?|steps?|people|credits?|percent)\b)?/i;
const CLAUSE = /[，、,;；：:。.!?！？（(]/;

/**
 * The lime phrase of a hook without a listed one: its first number, fee or phone run, else its first clause. A hook that is
 * one clause gets none ('') rather than a lime hook from end to end ("合租前先讲清楚这些事").
 */
export function hookHighlight(hook: string): string {
  const text = hook.trim();
  const run = NUMBER_RUN.exec(text)?.[0].trim();
  if (run && /\d/.test(run)) return run;
  const clause = text.split(CLAUSE)[0].trim();
  return clause === text ? '' : clause;
}

/**
 * The hook split at its lime phrase (the first occurrence), for <em>: [before, phrase, after]. A phrase that is not in the
 * hook (a conversion that changed it) gives no highlight rather than a wrong one.
 */
export function splitHook(hook: string, phrase: string | undefined): [string, string, string] | null {
  if (!phrase) return null;
  const at = hook.indexOf(phrase);
  return at < 0 ? null : [hook.slice(0, at), phrase, hook.slice(at + phrase.length)];
}
