export type DetectedContact = {
  type: 'phone' | 'email' | 'wechat' | 'keyword';
  value: string;
};

export type ContactAnalysis = {
  detectedMethods: ReturnType<typeof contactsToPreferenceMethods>;
  cleanedText: string;
  hasContact: boolean;
  uncertainMatches: string[];
  /** True when phone/email removed and no high-risk leftover contact patterns remain */
  removedFromText: boolean;
};

const PHONE_RE = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const WECHAT_RE = /(?:微信|wechat|wx|vx|威信|加我|联系方式)[:：\s]*[@]?([a-zA-Z0-9_-]{4,20})/gi;
const WECHAT_KEYWORD_RE = /(?:微信|wechat|wx|vx|威信|加我|联系方式)/gi;

export const detectContactsInText = (text: string): DetectedContact[] => {
  const found: DetectedContact[] = [];
  const seen = new Set<string>();

  const add = (type: DetectedContact['type'], value: string) => {
    const key = `${type}:${value}`;
    if (!value.trim() || seen.has(key)) return;
    seen.add(key);
    found.push({ type, value: value.trim() });
  };

  for (const m of text.matchAll(PHONE_RE)) add('phone', m[0]);
  for (const m of text.matchAll(EMAIL_RE)) add('email', m[0]);
  for (const m of text.matchAll(WECHAT_RE)) add('wechat', m[1] || m[0]);
  if (/加我|联系方式|微信|wechat/i.test(text) && !found.some((f) => f.type === 'wechat')) {
    add('keyword', '联系方式关键词');
  }

  return found;
};

export const contactsToPreferenceMethods = (detected: DetectedContact[]) =>
  detected
    .filter((d) => d.type !== 'keyword')
    .map((d) => ({
      type: d.type === 'wechat' ? 'wechat' as const : d.type === 'email' ? 'email' as const : d.type === 'phone' ? 'phone' as const : 'other' as const,
      label: d.type === 'wechat' ? '微信' : d.type === 'email' ? '邮箱' : d.type === 'phone' ? '电话' : '其他',
      value: d.value,
      note: '',
      enabled: true,
    }));

const normalizeCleanedText = (text: string) =>
  text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const removeAllMatches = (text: string, re: RegExp) => {
  let next = text;
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const globalRe = new RegExp(re.source, flags);
  for (const m of text.matchAll(globalRe)) {
    if (m[0]) next = next.split(m[0]).join(' ');
  }
  return next;
};

/** Detect contacts, build preference methods, and conservatively strip them from public description */
export const analyzeContactsInText = (text: string): ContactAnalysis => {
  const detected = detectContactsInText(text);
  const detectedMethods = contactsToPreferenceMethods(detected);
  const uncertainMatches: string[] = [];
  let cleanedText = text;

  const hadPhone = detected.some((d) => d.type === 'phone');
  const hadEmail = detected.some((d) => d.type === 'email');
  const hadWechat = detected.some((d) => d.type === 'wechat');
  const hadKeywordOnly = detected.some((d) => d.type === 'keyword');

  if (hadPhone) cleanedText = removeAllMatches(cleanedText, PHONE_RE);
  if (hadEmail) cleanedText = removeAllMatches(cleanedText, EMAIL_RE);

  if (hadWechat) {
    cleanedText = removeAllMatches(cleanedText, WECHAT_RE);
  } else if (hadKeywordOnly) {
    uncertainMatches.push('联系方式关键词');
    cleanedText = cleanedText.replace(WECHAT_KEYWORD_RE, ' ');
  }

  cleanedText = normalizeCleanedText(cleanedText);
  const leftover = detectContactsInText(cleanedText);
  const removedPhoneEmail = (!hadPhone || !leftover.some((d) => d.type === 'phone'))
    && (!hadEmail || !leftover.some((d) => d.type === 'email'));
  const removedWechat = !hadWechat || !leftover.some((d) => d.type === 'wechat');
  const removedFromText = removedPhoneEmail && removedWechat && leftover.length === 0;

  if (hadWechat && leftover.some((d) => d.type === 'wechat')) {
    uncertainMatches.push('微信号');
  }
  if (hadKeywordOnly && leftover.length > 0) {
    uncertainMatches.push('正文仍含联系方式相关文字');
  }

  return {
    detectedMethods,
    cleanedText,
    hasContact: detected.length > 0,
    uncertainMatches,
    removedFromText,
  };
};
