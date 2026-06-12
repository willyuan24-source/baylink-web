export type DetectedContact = {
  type: 'phone' | 'email' | 'wechat' | 'keyword';
  value: string;
};

const PHONE_RE = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const WECHAT_RE = /(?:微信|wechat|wx|vx|威信|加我|联系方式)[:：\s]*[@]?([a-zA-Z0-9_-]{4,20})/gi;

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
